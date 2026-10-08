// ============================================================================
//  Comprendre une note prise au telephone
// ----------------------------------------------------------------------------
//  Le vendeur ecrit ce qu'il aurait griffonne sur son carnet :
//  « envoyer le devis a Mme Dupont par mail », « demander a Simon de rappeler
//  Colpaert jeudi », « me renseigner sur le delai du receveur et rappeler ».
//
//  Cette fonction en tire une tache propre : ce qu'il faut faire, pour quand,
//  pour qui, et le nom du client s'il y en a un. Le rapprochement du nom avec
//  un dossier se fait ensuite dans la page, pas ici : la fonction ne recoit
//  aucune liste de clients.
//
//  Si elle echoue, la page enregistre la note telle quelle. Perdre la note
//  serait pire que la ranger approximativement.
// ============================================================================

const SUPABASE_URL = 'https://hzploaweyewjyxdhpmvo.supabase.co';
const CLE_PUBLIQUE = 'sb_publishable_NfYsr2yMHIYRJ6F3H96EXg_KWZE4_RQ';
const MODELE = 'claude-sonnet-5-5';

const ENTETE = { 'Content-Type': 'application/json; charset=utf-8' };
const erreur = (code, message) =>
  new Response(JSON.stringify({ erreur: message }), { status: code, headers: ENTETE });

const CONSIGNES = `Tu ranges une note prise a la volee par un vendeur de Top Amenagement, un
magasin de carrelage, salle de bain et parquet a Bailleul. Il l'a ecrite entre
deux phrases au telephone, sans soin.

Tu rends un objet JSON, et rien d'autre :
{"texte":"...","echeance":"AAAA-MM-JJ ou null","pour_qui":"prenom ou null","client":"nom ou null"}

Comment remplir chaque champ :
- texte : l'action a faire, reformulee a l'infinitif, courte et claire.
  « je dois envoyer le devis a mme dupont » devient « Envoyer le devis a
  Mme Dupont ». Garde les precisions utiles, enleve le reste.
- echeance : la date visee, calculee a partir de la date du jour donnee
  ci-dessous. « demain », « jeudi », « la semaine prochaine », « avant
  samedi », « dans 3 jours » se traduisent en date. Un jour de la semaine seul
  designe le prochain a venir. Si rien n'indique de date, mets null : cela veut
  dire des que possible, ce n'est pas une erreur.
- pour_qui : le prenom de la personne chargee de la tache, uniquement si la
  note en designe une autre que celui qui ecrit. « demander a Simon de
  rappeler » donne Simon. Sinon null.
- client : le nom du client concerne, tel qu'il est ecrit dans la note, sans
  civilite. « rappeler Mme Dupont » donne Dupont. Si aucun client n'est
  nomme, mets null. N'invente jamais un nom.

Regles : n'ajoute aucune information absente de la note. Pas d'emoji, pas de
tiret cadratin. Reponds uniquement par l'objet JSON.`;

export default async (requete) => {
  if (requete.method !== 'POST') return erreur(405, 'Methode non autorisee');

  const cle = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!cle.startsWith('sk-ant-')) return erreur(503, 'Cle API Claude absente ou invalide.');

  const jeton = (requete.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jeton) return erreur(401, 'Connexion requise');

  const qui = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jeton}`, apikey: CLE_PUBLIQUE },
  });
  if (!qui.ok) return erreur(401, `Session refusee par Supabase (${qui.status}).`);

  let d;
  try { d = await requete.json(); } catch { return erreur(400, 'Requete illisible'); }

  const note = String(d.note || '').trim().slice(0, 600);
  if (!note) return erreur(400, 'Note vide');

  // La date du jour vient de la page : le serveur peut etre sur un autre
  // fuseau, et « jeudi » n'a de sens que depuis le bon jour.
  const aujourdhui = /^\d{4}-\d{2}-\d{2}$/.test(d.aujourdhui || '')
    ? d.aujourdhui : new Date().toISOString().slice(0, 10);
  const jour = new Date(aujourdhui + 'T12:00:00Z')
    .toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

  // Les prenoms de l'equipe aident a reconnaitre « demande a Simon ». Rien
  // d'autre ne quitte le site : ni noms de famille, ni identifiants.
  const equipe = (Array.isArray(d.prenoms) ? d.prenoms : [])
    .map((x) => String(x).slice(0, 40)).filter(Boolean).slice(0, 20);

  try {
    const rep = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': cle, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODELE,
        max_tokens: 300,
        system: CONSIGNES,
        messages: [{
          role: 'user',
          content: `Nous sommes le ${jour} (${aujourdhui}).`
            + (equipe.length ? `\nPrenoms de l'equipe : ${equipe.join(', ')}.` : '')
            + `\n\nLa note :\n${note}`,
        }],
      }),
    });

    if (!rep.ok) {
      const detail = await rep.text();
      console.error('Anthropic', rep.status, detail.slice(0, 300));
      if (/credit|billing|quota/i.test(detail)) {
        return erreur(502, 'Le credit Claude est epuise. Rechargez-le sur console.anthropic.com.');
      }
      return erreur(502, `Claude a repondu ${rep.status}.`);
    }

    const data = await rep.json();
    const brut = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();

    let lu = {};
    try { lu = JSON.parse(brut.replace(/^```(?:json)?|```$/gm, '').trim()); } catch { /* ignore */ }

    const texte = String(lu.texte || '').trim().slice(0, 300);
    if (!texte) {
      console.error('Tache illisible', brut.slice(0, 200));
      return erreur(502, 'Reponse inattendue.');
    }
    // Une date hors format ou dans un passe lointain serait pire qu'aucune date.
    const echeance = /^\d{4}-\d{2}-\d{2}$/.test(lu.echeance || '') && lu.echeance >= aujourdhui
      ? lu.echeance : null;

    return new Response(JSON.stringify({
      texte, echeance,
      pour_qui: lu.pour_qui ? String(lu.pour_qui).trim().slice(0, 40) : null,
      client: lu.client ? String(lu.client).trim().slice(0, 80) : null,
    }), { status: 200, headers: ENTETE });
  } catch (e) {
    console.error('ia-tache', e);
    return erreur(502, 'Claude est injoignable : ' + e.message);
  }
};

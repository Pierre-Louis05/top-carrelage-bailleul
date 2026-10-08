// ============================================================================
//  Deviner l'univers d'un document Sequoia
// ----------------------------------------------------------------------------
//  Sequoia indique parfois l'univers dans « Client : PARTICULIER SANITAIRE ».
//  Souvent non : sur DM08044, le champ dit seulement PROFESSIONEL, et le
//  vendeur devait choisir a la main. Les designations, elles, le disent
//  toujours, mais pas avec des mots qu'une liste de mots-cles attraperait :
//  « LINEN CLOUD 4D/100X100X2/A/R ANTISLIP » ne contient pas « carrelage ».
//
//  D'ou cette lecture par un modele. Rien n'est enregistre a partir d'ici :
//  la reponse pre-remplit la liste deroulante, le vendeur garde le dernier mot.
// ============================================================================

const SUPABASE_URL = 'https://hzploaweyewjyxdhpmvo.supabase.co';
const CLE_PUBLIQUE = 'sb_publishable_NfYsr2yMHIYRJ6F3H96EXg_KWZE4_RQ';
const MODELE = 'claude-sonnet-5-5';

const ENTETE = { 'Content-Type': 'application/json; charset=utf-8' };
const erreur = (code, message) =>
  new Response(JSON.stringify({ erreur: message }), { status: code, headers: ENTETE });

const UNIVERS_VALIDES = ['carrelage', 'sanitaire', 'parquet', 'pierre', 'autre'];

const CONSIGNES = `Tu classes un devis de Top Amenagement, un magasin de carrelage, salle de bain et
parquet. On te donne les designations de produits d'un document. Tu reponds par
l'univers principal du chantier.

Les cinq valeurs possibles, et ce qu'elles couvrent :
- carrelage : carrelage sol et mur, gres cerame, faience, dalles de terrasse,
  plots de terrasse, colles, joints, profiles, plinthes carrelees.
- sanitaire : salle de bain et WC. Receveurs, parois et portes de douche,
  baignoires, vasques, lavabos, meubles de salle de bain, robinetterie,
  mitigeurs, colonnes de douche, seche-serviettes, siphons, WC.
- parquet : parquet massif ou contrecolle, stratifie, sous-couches, plinthes
  bois, barres de seuil et de jonction.
- pierre : pierre naturelle, travertin, marbre, pierre reconstituee.
- autre : rien de tout cela, ou impossible a trancher.

Regles :
- Un document peut melanger plusieurs univers. Choisis celui qui pese le plus,
  en montant et en quantite.
- Les consommables seuls (colle, joint, croisillons) ne font pas un univers :
  regarde ce qu'ils servent a poser.
- Dans le doute, reponds autre plutot que de deviner.

Reponds uniquement par un objet JSON, sans texte autour :
{"univers":"<une des cinq valeurs>","confiance":"sure|moyenne|faible","raison":"<huit mots maximum>"}`;

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

  // On n'envoie que les designations, pas le document entier : ni le nom du
  // client, ni ses coordonnees, ni les prix n'aident a classer un chantier.
  const lignes = (Array.isArray(d.designations) ? d.designations : [])
    .map((x) => String(x).slice(0, 160)).filter(Boolean).slice(0, 40);
  if (!lignes.length) return erreur(400, 'Aucune designation a lire');

  try {
    const rep = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': cle, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODELE,
        max_tokens: 200,
        system: CONSIGNES,
        messages: [{ role: 'user', content: lignes.map((l) => '- ' + l).join('\n') }],
      }),
    });

    if (!rep.ok) {
      const detail = await rep.text();
      console.error('Anthropic', rep.status, detail.slice(0, 300));
      return erreur(502, `Claude a repondu ${rep.status}.`);
    }

    const data = await rep.json();
    const texte = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();

    // Le modele repond du JSON, mais on ne le croit pas sur parole : une
    // valeur hors liste remplirait la fiche avec un univers qui n'existe pas.
    let lu = {};
    try { lu = JSON.parse(texte.replace(/^```(?:json)?|```$/gm, '').trim()); } catch { /* ignore */ }
    if (!UNIVERS_VALIDES.includes(lu.univers)) {
      console.error('Univers hors liste', texte.slice(0, 200));
      return erreur(502, 'Reponse inattendue.');
    }

    return new Response(JSON.stringify({
      univers: lu.univers,
      confiance: ['sure', 'moyenne', 'faible'].includes(lu.confiance) ? lu.confiance : 'moyenne',
      raison: String(lu.raison || '').slice(0, 80),
    }), { status: 200, headers: ENTETE });
  } catch (e) {
    console.error('ia-univers', e);
    return erreur(502, 'Claude est injoignable : ' + e.message);
  }
};

// ============================================================================
//  Le point du jour
// ----------------------------------------------------------------------------
//  L'ecran « Ma journee » affiche deja les chiffres et les listes, sans IA et
//  sans attendre. Cette fonction ajoute ce qu'un tableau ne dit pas : par quoi
//  commencer, ce qui traine depuis trop longtemps, ce qui peut attendre.
//
//  Un seul appel pour toute la page, pas un par dossier : c'est ce qui garde
//  la depense a quelques centimes par jour.
// ============================================================================

const SUPABASE_URL = 'https://hzploaweyewjyxdhpmvo.supabase.co';
const CLE_PUBLIQUE = 'sb_publishable_NfYsr2yMHIYRJ6F3H96EXg_KWZE4_RQ';
const MODELE = 'claude-sonnet-5-5';

const ENTETE = { 'Content-Type': 'application/json; charset=utf-8' };
const erreur = (code, message) =>
  new Response(JSON.stringify({ erreur: message }), { status: code, headers: ENTETE });

const CONSIGNES = `Tu es l'assistant d'un vendeur de Top Amenagement, un magasin de carrelage,
salle de bain et parquet a Bailleul. On te donne ce qui l'attend aujourd'hui.
Tu ecris un point du jour, court, qu'il lit en arrivant le matin.

Ce qu'on attend de toi :
- Dis par quoi commencer, et pourquoi. Le retard et le montant priment sur
  l'anciennete seule.
- Signale ce qui va etre perdu si on ne fait rien : un devis qui expire, une
  relance en retard, un echantillon dehors depuis trop longtemps.
- Dis aussi quand il n'y a rien d'urgent. Ne gonfle pas une journee calme.
- Tu ne connais que ce qui est ecrit ci-dessous. N'invente aucun fait, aucun
  nom, aucun chiffre.

La forme :
- Cinq phrases maximum, en francais, en vouvoyant.
- Pas de liste a puces, pas de titre, pas d'emoji, pas de tiret cadratin.
- Nomme les clients concernes quand c'est utile, pas tous.
- Pas de formule de politesse, ni d'introduction : tu entres dans le sujet.`;

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

  const resume = String(d.resume || '').slice(0, 6000);
  if (!resume.trim()) return erreur(400, 'Rien a resumer');

  try {
    const rep = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': cle, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODELE,
        max_tokens: 400,
        system: CONSIGNES,
        messages: [{ role: 'user', content: resume }],
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
    const texte = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (!texte) return erreur(502, 'Reponse vide.');
    return new Response(JSON.stringify({ texte }), { status: 200, headers: ENTETE });
  } catch (e) {
    console.error('ia-journee', e);
    return erreur(502, 'Claude est injoignable : ' + e.message);
  }
};

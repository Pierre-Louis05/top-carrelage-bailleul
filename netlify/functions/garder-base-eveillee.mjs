// Tache planifiee : interroge Supabase une fois par jour.
//
// Le plan gratuit de Supabase met un projet en pause apres sept jours sans
// activite. En pause, le formulaire de contact echoue et l'espace equipe ne
// s'ouvre plus. Une lecture quotidienne suffit a garder le projet eveille.
//
// Cette tache ne peut pas relancer un projet deja en pause : il faut alors
// cliquer sur "Resume project" dans le tableau de bord Supabase.
//
// La requete reprend celle que la page Avis fait deja publiquement, avec la
// cle publique du site : elle ne lit rien qui ne soit deja visible.

const SUPABASE_URL = 'https://hzploaweyewjyxdhpmvo.supabase.co';
const CLE_PUBLIQUE = 'sb_publishable_NfYsr2yMHIYRJ6F3H96EXg_KWZE4_RQ';

export default async () => {
  const debut = Date.now();
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/testimonials?select=id&status=eq.approuve&limit=1`,
      { headers: { apikey: CLE_PUBLIQUE, Authorization: `Bearer ${CLE_PUBLIQUE}` } }
    );
    const duree = Date.now() - debut;
    const message = res.ok
      ? `Supabase actif (${duree} ms)`
      : `Supabase a repondu ${res.status} en ${duree} ms : verifier le tableau de bord`;
    // Visible dans Netlify > Logs > Functions > garder-base-eveillee
    (res.ok ? console.log : console.error)(message);
    return new Response(message, { status: res.ok ? 200 : 502 });
  } catch (err) {
    const message = `Supabase injoignable : ${err.message}. Le projet est peut-etre en pause.`;
    console.error(message);
    return new Response(message, { status: 502 });
  }
};

// Tous les jours a 6 h UTC. Une fois par jour laisse une large marge sur le
// delai de sept jours.
export const config = { schedule: '0 6 * * *' };

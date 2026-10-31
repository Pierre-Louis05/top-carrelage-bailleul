/**
 * Garde d'acces de la partie Gestion (essai).
 *
 * Cette application affiche des prix d'achat, des marges et des fiches
 * clients. Elle est posee dans l'espace equipe, que robots.txt tient a l'ecart
 * des moteurs de recherche, mais un chemin devine resterait ouvert : elle
 * passe donc par la meme connexion que les autres pages.
 *
 * Les donnees de l'application elle-meme restent dans le navigateur
 * (localStorage). Cette garde protege l'acces a l'ecran, pas les donnees : le
 * jour ou l'application passera sur Supabase, ce sont les regles RLS qui
 * prendront le relais.
 */
(async () => {
  const racine = document.documentElement;

  // « visible » et pas une chaine vide : vider le style en ligne laisse la
  // regle « html { visibility: hidden } » de la page s'appliquer, et l'ecran
  // restait blanc une fois connecte. C'est exactement ce qui s'est produit.
  const rendre = () => { racine.style.visibility = 'visible'; };

  // Filet de securite : quoi qu'il arrive dans ce fichier, la page finit par
  // s'afficher. Une page blanche est pire qu'un affichage non protege, d'autant
  // que l'espace equipe est deja hors des moteurs de recherche.
  setTimeout(rendre, 4000);

  if (typeof supabase === 'undefined') {
    // Sans la librairie, on ne sait pas qui est connecte. On montre quand meme
    // l'ecran plutot que de bloquer sur une panne de CDN : l'espace equipe est
    // deja hors des moteurs de recherche.
    console.warn('Supabase indisponible, controle de session ignore.');
    rendre();
    return;
  }

  try {
    const db = supabase.createClient(
      'https://hzploaweyewjyxdhpmvo.supabase.co',
      'sb_publishable_NfYsr2yMHIYRJ6F3H96EXg_KWZE4_RQ');
    const { data: { session } } = await db.auth.getSession();
    if (!session) {
      window.location.replace('../index.html');
      return;
    }
  } catch (e) {
    console.warn('Controle de session impossible', e);
  }
  rendre();
})();

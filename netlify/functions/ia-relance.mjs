// ============================================================================
//  Redacteur de messages de relance
// ----------------------------------------------------------------------------
//  Appele depuis la page Relances de l'espace equipe. Rend un brouillon de
//  mail ou de SMS pour UN client precis. Rien n'est envoye : le vendeur relit,
//  corrige, puis envoie lui-meme depuis sa messagerie. C'est la premiere des
//  six regles validees pour les agents.
//
//  La cle API vit dans une variable d'environnement Netlify, jamais dans la
//  page : le code de l'espace equipe est public, tout le monde peut le lire.
//
//  Deux garde-fous sur la depense :
//   - seul un membre connecte peut appeler cette fonction, verifie aupres de
//     Supabase a chaque appel ;
//   - la reponse est bornee en longueur, un message de relance tient en
//     quelques lignes.
// ============================================================================

const SUPABASE_URL = 'https://hzploaweyewjyxdhpmvo.supabase.co';
// La cle publique du projet, la meme que celle des pages. L'endpoint
// /auth/v1/user exige qu'elle soit dans l'en-tete apikey : y mettre le jeton de
// l'utilisateur fait repondre « Invalid API key », et tout appel etait refuse
// alors que le vendeur etait bien connecte.
const CLE_PUBLIQUE = 'sb_publishable_NfYsr2yMHIYRJ6F3H96EXg_KWZE4_RQ';
const MODELE = 'claude-sonnet-5-5';

const ENTETE = { 'Content-Type': 'application/json; charset=utf-8' };
const erreur = (code, message) =>
  new Response(JSON.stringify({ erreur: message }), { status: code, headers: ENTETE });

/**
 * Les six regles validees par le magasin, plus la charte de ton.
 * Elles sont ecrites ici et pas dans la page : une regle que le navigateur
 * peut modifier n'est pas une regle.
 */
const CONSIGNES = `Tu ecris pour Top Amenagement, un magasin de carrelage, salle de bain et parquet
a Bailleul dans le Nord. Tu rediges le message qu'un vendeur va envoyer a un client
pour relancer un devis en attente.

Ce que tu dois respecter, sans exception :
- Vouvoiement, ton professionnel et chaleureux, jamais familier ni insistant.
- Aucune promesse sur un prix, un delai, une disponibilite ou un stock. Le vendeur
  seul engage le magasin. Si le client doit savoir quelque chose la-dessus, invite-le
  a appeler le magasin.
- N'invente aucun fait. Tu n'utilises que les informations fournies ci-dessous.
  Si une information manque, n'y fais pas allusion.
- Le magasin vend et conseille, il ne pose pas. La pose est faite par l'artisan du
  client. N'ecris jamais que nous posons, installons ou realisons le chantier.
- Pas d'emojis. Pas de tirets cadratins. Pas de nom de fournisseur ni de fabricant.
- Ne parle jamais de cuisine, le magasin n'en fait pas.
- Ne promets pas de rappeler a une date precise.

La forme :
- Un mail : une ligne "Objet :" puis le corps. Quatre a huit lignes, pas plus.
- Un SMS : trois phrases maximum, sans objet.
- Signe avec le prenom du vendeur, puis "Top Amenagement, Bailleul, 03 28 48 08 08".
- Ecris en francais, directement le message, sans commentaire ni explication autour.`;

export default async (requete) => {
  if (requete.method !== 'POST') return erreur(405, 'Methode non autorisee');

  // Le .trim() n'est pas decoratif : une cle collee depuis la console arrive
  // souvent avec un espace ou un retour a la ligne, et l'API la refuse alors
  // que la valeur a l'air juste a l'ecran.
  const cle = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!cle) {
    return erreur(503,
      "La cle API Claude n'est pas encore installee. Dans Netlify, ouvrez "
      + "Site configuration puis Environment variables, et ajoutez ANTHROPIC_API_KEY.");
  }
  // On ne revele jamais la valeur, seulement sa forme : une cle Anthropic
  // commence par sk-ant-. Dire « refusee » quand ce n'est meme pas une cle
  // Anthropic envoie chercher au mauvais endroit.
  if (!cle.startsWith('sk-ant-')) {
    return erreur(503,
      "La valeur enregistree dans ANTHROPIC_API_KEY ne ressemble pas a une cle "
      + "Anthropic : elle devrait commencer par sk-ant-. Corrigez-la dans Netlify, "
      + "puis relancez un deploiement.");
  }

  // 1. Qui appelle ? Sans cette verification, n'importe qui pourrait consommer
  //    les credits du magasin en appelant l'adresse de la fonction.
  const jeton = (requete.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jeton) return erreur(401, 'Connexion requise');

  const qui = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jeton}`, apikey: CLE_PUBLIQUE },
  });
  if (!qui.ok) {
    // On distingue les deux cas : un jeton perime se reconnecte, une panne de
    // Supabase ne se corrige pas en se reconnectant. Dire l'un pour l'autre
    // envoie le vendeur chercher au mauvais endroit.
    const detail = await qui.text();
    console.error('Verification de session', qui.status, detail.slice(0, 300));
    // Le code de Supabase part dans le message. Dire seulement « session
    // expiree » a deja coute deux allers-retours : les deux causes possibles
    // donnaient exactement la meme phrase a l'ecran.
    let code = '';
    try { code = JSON.parse(detail).error_code || JSON.parse(detail).message || ''; } catch { /* ignore */ }
    return qui.status === 401 || qui.status === 403
      ? erreur(401, `Session refusee par Supabase (${qui.status}${code ? ' ' + code : ''}).`)
      : erreur(502, `Verification de session impossible (${qui.status}).`);
  }

  // 2. Le contexte, tel que la page l'a rassemble
  let d;
  try { d = await requete.json(); } catch { return erreur(400, 'Requete illisible'); }

  const forme = d.forme === 'sms' ? 'SMS' : 'mail';
  const faits = [
    d.client ? `Client : ${d.client}` : null,
    d.type_client === 'professionnel' ? 'C\'est un professionnel.' : null,
    d.projet ? `Projet : ${d.projet}` : null,
    d.univers ? `Univers : ${d.univers}` : null,
    d.numero_devis ? `Devis numero ${d.numero_devis}` : null,
    d.date_devis ? `Devis remis le ${d.date_devis}` : null,
    d.jours ? `Cela fait ${d.jours} jours.` : null,
    d.montant ? `Montant du devis : ${d.montant} euros TTC.` : null,
    d.rang ? `C'est la relance numero ${d.rang}.` : null,
    d.historique ? `Ce qui s'est dit precedemment : ${d.historique}` : null,
    d.vendeur ? `Le vendeur qui signe s'appelle ${d.vendeur}.` : null,
  ].filter(Boolean).join('\n');

  if (!d.client) return erreur(400, 'Nom du client manquant');

  const consigneRang = Number(d.rang) >= 3
    ? "\n\nC'est la derniere relance. Laisse la porte ouverte sans insister : "
      + "dis simplement que le client peut revenir quand il le souhaite."
    : '';

  // 3. L'appel
  try {
    const rep = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': cle,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELE,
        max_tokens: 700,
        system: CONSIGNES,
        messages: [{
          role: 'user',
          content: `Redige un ${forme} de relance.\n\n${faits}${consigneRang}`,
        }],
      }),
    });

    if (!rep.ok) {
      const detail = await rep.text();
      console.error('Anthropic', rep.status, detail.slice(0, 400));
      let motif = '';
      try { motif = JSON.parse(detail)?.error?.message || ''; } catch { /* ignore */ }
      if (rep.status === 401) {
        return erreur(502,
          "La cle API Claude est refusee par Anthropic"
          + (motif ? ` (${motif})` : '')
          + ". Creez-en une sur console.anthropic.com, remplacez ANTHROPIC_API_KEY "
          + "dans Netlify, puis relancez un deploiement.");
      }
      if (rep.status === 429) return erreur(502, 'Trop de demandes a la suite. Reessayez dans une minute.');
      if (/credit|billing|quota/i.test(detail)) {
        return erreur(502, 'Le credit Claude est epuise. Rechargez-le sur console.anthropic.com.');
      }
      return erreur(502, `Claude a repondu ${rep.status}${motif ? ' : ' + motif : '.'}`);
    }

    const data = await rep.json();
    const texte = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (!texte) return erreur(502, 'Reponse vide.');

    return new Response(JSON.stringify({ texte, forme: d.forme === 'sms' ? 'sms' : 'mail' }),
      { status: 200, headers: ENTETE });
  } catch (e) {
    console.error('ia-relance', e);
    return erreur(502, 'Claude est injoignable : ' + e.message);
  }
};

/**
 * Suivi client — fonctions partagées par les quatre pages du lot 1.
 *
 * Deux choses vivent ici parce qu'elles sont le cœur du système et qu'il ne
 * faut surtout pas qu'elles divergent d'une page à l'autre :
 *   - la lecture d'un PDF Sequoia,
 *   - la reconnaissance d'un client existant.
 */

/* ===== Vocabulaire affiché ===== */

const ETAPES = {
  premier_passage: { libelle: 'Premier passage', couleur: '#5F6B7E', ordre: 1 },
  devis_envoye:    { libelle: 'Devis envoyé',    couleur: '#4BC1F0', ordre: 2 },
  en_relance:      { libelle: 'En relance',      couleur: '#F5A62A', ordre: 3 },
  signe:           { libelle: 'Signé',           couleur: '#1F8A5B', ordre: 4 },
  facture:         { libelle: 'Facturé',         couleur: '#14263C', ordre: 5 },
  apres_vente:     { libelle: 'Après-vente',     couleur: '#223D56', ordre: 6 },
  en_sommeil:      { libelle: 'En sommeil',      couleur: '#9AA8BC', ordre: 7 },
  perdu:           { libelle: 'Perdu',           couleur: '#ED2442', ordre: 8 },
};

const UNIVERS = {
  carrelage: { libelle: 'Carrelage',       couleur: '#ED2442' },
  sanitaire: { libelle: 'Salle de bain',   couleur: '#4BC1F0' },
  parquet:   { libelle: 'Parquet',         couleur: '#F5A62A' },
  pierre:    { libelle: 'Pierre naturelle', couleur: '#8A6F4C' },
  autre:     { libelle: 'Autre',           couleur: '#5F6B7E' },
};

const BUDGETS = {
  moins_2k: 'moins de 2 000 €', '2_5k': '2 000 à 5 000 €',
  '5_10k': '5 000 à 10 000 €', plus_10k: 'plus de 10 000 €',
};

const RAISONS_PERDU = {
  prix: 'Trop cher', delai: 'Délai trop long', concurrent: 'Parti chez un concurrent',
  abandonne: 'Projet abandonné', autre: 'Autre raison',
};

/* ===== Petits utilitaires ===== */

const euros = (n) =>
  n === null || n === undefined || n === '' ? '—'
    : Number(n).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const dateCourte = (d) =>
  !d ? '—' : new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });

const dateLongue = (d) =>
  !d ? '—' : new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

/** Échappe le texte avant de l'injecter dans du HTML. */
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Ramène un numéro de téléphone à ses chiffres, au format français à dix.
 * « +33 6 12 34 56 78 », « 0612345678 » et « 06.12.34.56.78 » donnent la même
 * chaîne : c'est ce qui permet de reconnaître un client d'un document à l'autre.
 */
function normaliserTel(tel) {
  if (!tel) return null;
  let n = String(tel).replace(/[^\d+]/g, '');
  if (n.startsWith('+33')) n = '0' + n.slice(3);
  else if (n.startsWith('0033')) n = '0' + n.slice(4);
  else if (n.startsWith('33') && n.length === 11) n = '0' + n.slice(2);
  n = n.replace(/\D/g, '');
  return n.length >= 9 ? n : null;
}

/** Compare deux noms sans tenir compte de la casse, des accents ni des civilités. */
function cleNom(nom) {
  return String(nom ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\b(M|MME|MR|MLLE|MONSIEUR|MADAME|ET|SARL|SAS|EURL|SCI)\b\.?/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

/* ===== Lecture d'un PDF Sequoia ===== */

let pdfjs = null;

async function chargerPdfJs() {
  if (pdfjs) return pdfjs;
  const base = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82';
  pdfjs = await import(`${base}/pdf.min.mjs`);
  pdfjs.GlobalWorkerOptions.workerSrc = `${base}/pdf.worker.min.mjs`;
  return pdfjs;
}

/**
 * Extrait le texte d'un PDF en conservant les positions.
 *
 * La mise en page des factures diffère de celle des devis : lire une suite de
 * mots ne suffit pas, il faut savoir ce qui est sur la même ligne et dans quel
 * ordre horizontal. On regroupe donc les fragments par ordonnée.
 */
async function lirePdf(fichier) {
  const lib = await chargerPdfJs();
  const buf = await fichier.arrayBuffer();
  const doc = await lib.getDocument({ data: buf }).promise;
  const lignes = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const largeurPage = page.getViewport({ scale: 1 }).width;
    const contenu = await page.getTextContent();

    const bouts = contenu.items
      .filter((it) => it.str && it.str.trim())
      // La largeur du fragment sert à replacer chaque mot quand pdf.js en
      // regroupe plusieurs dans un même morceau.
      .map((it) => ({ x: it.transform[4], y: it.transform[5], large: it.width, texte: it.str }))
      .sort((a, b) => b.y - a.y || a.x - b.x);           // de haut en bas

    // Regroupement par proximité plutôt que par arrondi sur une grille.
    // Sur DM08044, « Reste à payer : » est à 175,00 et son montant à 176,05 :
    // l'arrondi au multiple de 3 les jetait dans deux lignes différentes et le
    // champ ressortait vide. L'écart entre deux vraies lignes de ce modèle ne
    // descend jamais sous 6 points, la tolérance peut donc rester large.
    for (const bout of bouts) {
      const courante = lignes[lignes.length - 1];
      if (courante && courante.page === p && Math.abs(courante.y - bout.y) <= 2.6) {
        courante.morceaux.push(bout);
      } else {
        lignes.push({ page: p, y: bout.y, largeurPage, texte: '', morceaux: [bout] });
      }
    }

    for (const l of lignes) {
      if (l.page !== p || l.texte) continue;
      l.morceaux.sort((a, b) => a.x - b.x);
      l.texte = l.morceaux.map((m) => m.texte).join(' ').replace(/\s+/g, ' ').trim();
    }
  }
  return lignes;
}

/* ===== Interprétation du contenu ===== */

const RE_NUMERO = /\b(DM|CM|FM)\s?(\d{4,10})\b/i;
const RE_DATE   = /\b(\d{2})[/.-](\d{2})[/.-](\d{4})\b/;
const RE_TEL    = /(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}/;
const RE_MAIL   = /[\w.+-]+@[\w-]+\.[\w.-]+/;

const TYPE_PAR_PREFIXE = { DM: 'devis', CM: 'commande', FM: 'facture' };

// Le modèle Sequoia place le magasin à gauche et le client à droite, comme sur
// une enveloppe à fenêtre. Cette fraction de la largeur sépare les deux cadres :
// sur un A4 de 595 points, le bloc de gauche s'arrête vers 125 et celui de
// droite commence à 314, la marge est donc confortable.
const PART_COLONNE_DROITE = 0.45;

/** Convertit « 1 234,56 » en nombre. Rend null si rien d'exploitable. */
function nombre(txt) {
  if (!txt) return null;
  const m = String(txt).replace(/\s| |€/g, '').match(/-?\d+(?:[.,]\d+)?/);
  return m ? parseFloat(m[0].replace(',', '.')) : null;
}

/** Le texte d'une ligne, restreint à une moitié de la page. */
function moitie(ligne, cote) {
  const seuil = (ligne.largeurPage || 595) * PART_COLONNE_DROITE;
  return ligne.morceaux
    .filter((m) => (cote === 'droite' ? m.x >= seuil : m.x < seuil))
    .map((m) => m.texte).join(' ').replace(/\s+/g, ' ').trim();
}

/** Cherche la valeur qui suit une étiquette, sur la même ligne. */
function valeurApres(lignes, motif, cote) {
  for (const l of lignes) {
    const t = cote ? moitie(l, cote) : l.texte;
    const m = t.match(motif);
    if (m) return (m[1] ?? '').trim();
  }
  return null;
}

/**
 * Redécoupe les fragments en mots, en répartissant l'abscisse.
 *
 * pdf.js regroupe parfois plusieurs cellules dans un même fragment, parfois
 * non, selon la façon dont le PDF a été écrit. En repassant par les mots, la
 * lecture des colonnes donne le même résultat dans les deux cas.
 */
function jetons(morceaux) {
  const out = [];
  for (const m of morceaux) {
    const t = String(m.texte);
    const large = m.large || t.length * 3.2;
    let i = 0;
    for (const mot of t.split(/\s+/)) {
      if (mot) out.push({ x: m.x + (large * i) / Math.max(t.length, 1), texte: mot });
      i += mot.length + 1;
    }
  }
  return out.sort((a, b) => a.x - b.x);
}

/**
 * Lit le cadre client, en haut à droite du document.
 *
 * C'est la correction la plus importante qu'ait apportée le premier vrai PDF.
 * « Client : PROFESSIONEL » est le TYPE de client, pas son nom, et le nom
 * n'apparaît derrière aucune étiquette : il est seulement à sa place sur la
 * page, dans le cadre d'adresse de droite, en face de celui du magasin.
 * Chercher un mot en capitales dans tout le texte avait ramené ETERNO, une
 * marque citée en suite de désignation d'un produit.
 *
 * Le repérage est donc positionnel, et il règle du même coup deux autres
 * erreurs : le téléphone lu était celui du magasin, et le code postal du
 * magasin était écarté alors qu'un client peut très bien être à Bailleul lui
 * aussi, ce qui est le cas sur DM08044.
 */
function cadreClient(lignes) {
  let fin = lignes.findIndex((l) => RE_NUMERO.test(l.texte));
  if (fin < 0) fin = Math.min(lignes.length, 20);

  const bloc = [];
  for (const l of lignes.slice(0, fin)) {
    const t = moitie(l, 'droite');
    if (!t) continue;
    if (/^(Exemplaire|Duplicata|Original|Copie)\b/i.test(t)) continue;  // mention d'impression
    bloc.push(t);
  }

  let nom = null, cp = null, ville = null, email = null;
  const adresse = [], tels = [];

  for (const t of bloc) {
    if (/^E-?mail\s*:/i.test(t)) { email = t.match(RE_MAIL)?.[0] ?? email; continue; }
    if (/^(T[ée]l|Portable|Mobile|Fax)\b/i.test(t)) {
      if (!/^Fax/i.test(t)) for (const m of t.matchAll(new RegExp(RE_TEL, 'g'))) tels.push(m[0]);
      continue;
    }
    const mCp = t.match(/^(\d{5})\s+(.+)$/);
    if (mCp) { cp = mCp[1]; ville = mCp[2].trim(); continue; }
    if (!nom) { nom = t; continue; }
    adresse.push(t);
  }

  // Sequoia imprime « Tel : fixe / portable ». On retient le portable quand il
  // existe : c'est le numéro qui joint vraiment le client, et celui par lequel
  // on reconnaît son dossier d'un document à l'autre.
  const telephone = tels.find((t) => /^0[67]/.test(normaliserTel(t) ?? '')) ?? tels[0] ?? null;

  return {
    nom, telephone, email,
    adresse: adresse.join(', ') || null,
    code_postal: cp, ville,
    tous_telephones: tels,
  };
}

/**
 * Classe une ligne de document.
 *
 * Sequoia n'a pas de champ commentaire : toute explication devient une ligne.
 * D'où ces quatre cas, constatés sur de vrais documents.
 */
function classerLigne(l) {
  const pu  = l.pu;
  const qte = l.qte;
  if (pu === null || pu === undefined)            return 'commentaire';
  if (qte !== null && qte < 0)                    return 'remise';
  if (qte === 0)                                  return 'reference';
  return 'produit';
}

/**
 * Lit un document Sequoia et rend ce qu'on a compris.
 *
 * Rien n'est enregistré à partir d'ici : le vendeur voit toujours un écran de
 * validation. Les champs non trouvés valent null plutôt qu'une valeur devinée,
 * pour que l'écran les montre vides au lieu de mentir. C'est pour la même
 * raison qu'aucun repli ne va chercher un téléphone ailleurs que dans le cadre
 * client : un champ vide se corrige en deux secondes, un numéro de magasin
 * glissé dans un dossier client se propage et fausse les rapprochements.
 */
function interpreterSequoia(lignes) {
  const tout = lignes.map((l) => l.texte);
  const texteBrut = tout.join('\n');

  // Type et numéro
  let type_doc = null, numero = null;
  for (const t of tout) {
    const m = t.match(RE_NUMERO);
    if (m) {
      type_doc = TYPE_PAR_PREFIXE[m[1].toUpperCase()];
      numero = m[1].toUpperCase() + m[2];
      break;
    }
  }

  // Dates : la première est celle du document
  const dates = [];
  for (const t of tout) {
    const m = t.match(RE_DATE);
    if (m) dates.push(`${m[3]}-${m[2]}-${m[1]}`);
  }
  const date_doc = dates[0] ?? null;

  const client = cadreClient(lignes);

  // « Client : PARTICULIER SANITAIRE » donne le type ET l'univers. Cette
  // étiquette est dans la colonne de gauche : la lire sur la ligne entière
  // ramasserait aussi le numéro du devis, imprimé en face.
  const champClient = valeurApres(lignes, /Client\s*:\s*(.+)/i, 'gauche') ?? '';
  const majClient = champClient.toUpperCase();
  const type_client = /PROFESSIONEL|PROFESSIONNEL|PRO\b/.test(majClient) ? 'professionnel' : 'particulier';
  let univers = null;
  if (/SANITAIRE/.test(majClient))      univers = 'sanitaire';
  else if (/PARQUET/.test(majClient))   univers = 'parquet';
  else if (/PIERRE/.test(majClient))    univers = 'pierre';
  else if (/CARRELAGE/.test(majClient)) univers = 'carrelage';

  const commercial =
    (valeurApres(lignes, /Commercial\s*:\s*([A-ZÀ-Ÿ\- ]+)/i, 'gauche') ?? '').trim().toUpperCase() || null;

  // Totaux
  const total_ht  = nombre(valeurApres(lignes, /TOTAL\s*H\.?T\.?\s*:?\s*([\d\s.,]+)/i));
  const total_ttc = nombre(valeurApres(lignes, /(?:TOTAL\s*T\.?T\.?C\.?|NET\s*A\s*PAYER)\s*:?\s*([\d\s.,]+)/i));
  const acompte   = nombre(valeurApres(lignes, /ACOMPTE[^:]*:?\s*([\d\s.,]+)/i));
  const reste     = nombre(valeurApres(lignes, /RESTE[^:]*:?\s*([\d\s.,]+)/i));
  const poids_kg  = nombre(valeurApres(lignes, /POIDS[^:]*:?\s*([\d\s.,]+)/i));

  // Document lié : la facture cite « COMMANDE CM… », le bon de commande ne cite rien
  const numero_lie = texteBrut.match(/COMMANDE\s+(CM\s?\d{4,10})/i)?.[1]?.replace(/\s/g, '') ?? null;

  // Validité du devis
  let date_expiration = null;
  const jours = texteBrut.match(/DEVIS\s+VALABLE\s+(\d+)\s+JOURS?/i);
  if (jours && date_doc) {
    const d = new Date(date_doc);
    d.setDate(d.getDate() + parseInt(jours[1], 10));
    date_expiration = d.toISOString().slice(0, 10);
  }

  const lignesDoc = extraireLignes(lignes);

  // Contrôle de lecture : la somme des lignes doit retomber sur le total HT.
  // Si elle n'y retombe pas, c'est le tableau qui a été mal lu, et l'écran de
  // validation le dit au lieu de laisser croire que tout est juste.
  const somme = lignesDoc
    .filter((l) => l.nature === 'produit' || l.nature === 'remise')
    .reduce((s, l) => s + (l.montant ?? 0), 0);
  const controle_lignes =
    total_ht === null || !lignesDoc.length ? null
      : { somme: +somme.toFixed(2), total_ht, concorde: Math.abs(somme - total_ht) < 1 };

  return {
    type_doc, numero, date_doc, date_expiration,
    total_ht, total_ttc, acompte, reste_a_payer: reste, poids_kg,
    numero_lie, texte_brut: texteBrut,
    client: {
      nom: client.nom,
      telephone: client.telephone,
      telephone_norme: normaliserTel(client.telephone),
      email: client.email,
      adresse: client.adresse,
      code_postal: client.code_postal,
      ville: client.ville,
      type_client,
    },
    univers,
    commercial,
    lignes: lignesDoc,
    controle_lignes,
  };
}

/**
 * Extrait les lignes de produits.
 *
 * L'en-tête du tableau annonce DÉSIGNATION, FORMAT, QTÉ, UNITÉ, PU HT, REM,
 * plus une dernière colonne sans titre. L'unité reste l'ancre la plus fiable :
 * le nombre qui la précède est la quantité, ceux qui la suivent sont le prix
 * catalogue puis le prix net.
 *
 * Sans cette ancre, le format du carreau trompe la lecture : sur
 * « LINEN CLOUD 4D/100X100X2/A/R 100X100X20 0.000 M2 », compter les nombres de
 * gauche à droite donne une quantité tirée du format.
 */
const UNITES = ['M2', 'M²', 'ML', 'U', 'PCE', 'PCS', 'SAC', 'BTE', 'KG', 'L', 'P', 'LOT', 'ENS', 'H'];

function extraireLignes(lignes) {
  const sortie = [];
  let dansTableau = false;
  let xFormat = null;

  for (const l of lignes) {
    const t = l.texte;

    if (/D[ÉE]SIGNATION/i.test(t) && /(QT[ÉE]|QUANTIT[ÉE])/i.test(t)) {
      dansTableau = true;
      xFormat = jetons(l.morceaux).find((j) => /^FORMAT$/i.test(j.texte))?.x ?? null;
      continue;
    }
    if (/TOTAL\s*H\.?T|CONDITIONS|MODE DE R[ÈE]GLEMENT|Page\s+\d|DEVIS VALABLE/i.test(t)) {
      dansTableau = false;
      continue;
    }
    if (!dansTableau || t.length < 2) continue;

    const lue = lireLigne(jetons(l.morceaux), xFormat, t);

    // Sequoia fait déborder une désignation trop longue sur la ligne suivante.
    // Sans unité ni prix, cette suite appartient au produit du dessus : la
    // rattacher évite de créer une fausse ligne, comme « ETERNO » sur DM08044.
    if (!lue && sortie.length) {
      const prec = sortie[sortie.length - 1];
      prec.designation = `${prec.designation} ${t}`.replace(/\s+/g, ' ').trim();
      prec.texte = `${prec.texte} ${t}`.trim();
      continue;
    }
    if (lue) sortie.push(lue);
  }
  return sortie;
}

/** Lit une ligne du tableau à partir de ses mots placés. Rend null si ce n'en est pas une. */
function lireLigne(jets, xFormat, texte) {
  const estNombre = (m) => /^-?\d+(?:[.,]\d+)?$/.test(m);

  // L'unité la plus à droite qui soit précédée d'un nombre : chercher la
  // première attraperait le « L » ou le « P » d'un libellé.
  let iU = -1;
  for (let i = jets.length - 1; i > 0; i--) {
    if (UNITES.includes(jets[i].texte.toUpperCase().replace(/\./g, '')) && estNombre(jets[i - 1].texte)) {
      iU = i; break;
    }
  }

  if (iU < 0) {
    // Pas d'unité. Une ligne de remise porte quand même un prix ; une suite de
    // désignation n'en porte aucun, et on la rend au produit du dessus.
    const prix = jets.filter((j) => /^-?\d+[.,]\d{2}$/.test(j.texte)).map((j) => nombre(j.texte));
    if (!prix.length) return null;
    const nombres = jets.filter((j) => estNombre(j.texte)).map((j) => nombre(j.texte));
    const ligne = {
      designation: jets.filter((j) => !estNombre(j.texte)).map((j) => j.texte).join(' ').trim() || texte,
      format: null,
      qte: nombres.length > prix.length ? nombres[0] : null,
      pu: prix[0], prix_net: prix[prix.length - 1], montant: null, texte,
    };
    ligne.montant = ligne.qte === null ? ligne.prix_net : +(ligne.qte * ligne.prix_net).toFixed(2);
    ligne.nature = classerLigne(ligne);
    return ligne;
  }

  const qte = nombre(jets[iU - 1].texte);
  const apres = jets.slice(iU + 1).filter((j) => estNombre(j.texte)).map((j) => nombre(j.texte));
  const pu = apres.length ? apres[0] : null;

  // La dernière colonne, sans en-tête sur le modèle Sequoia, porte le prix
  // après remise. C'est elle qui fait le montant : sur DM08044, 100 × 2,17
  // plus 25 × 29,17 retombe exactement sur le total HT de 946,25.
  const prix_net = apres.length > 1 ? apres[apres.length - 1] : pu;

  const avant = jets.slice(0, iU - 1);
  const gauche = xFormat === null ? avant : avant.filter((j) => j.x < xFormat - 6);
  const droite = xFormat === null ? [] : avant.filter((j) => j.x >= xFormat - 6);

  const ligne = {
    designation: gauche.map((j) => j.texte).join(' ').trim() || texte,
    format: droite.map((j) => j.texte).join(' ').trim() || null,
    qte, pu, prix_net,
    montant: qte !== null && prix_net !== null ? +(qte * prix_net).toFixed(2) : null,
    texte,
  };
  ligne.nature = classerLigne(ligne);
  return ligne;
}

/**
 * Cherche un dossier client correspondant.
 *
 * L'ordre vient du cahier des charges : téléphone d'abord parce que c'est le
 * plus fiable, puis nom et adresse. Un nom seul ne suffit jamais à rattacher
 * automatiquement : on rend « doute » et le vendeur tranche.
 */
async function trouverClient(db, infos) {
  if (infos.telephone_norme) {
    const { data } = await db.from('suivi_clients').select('*')
      .eq('telephone_norme', infos.telephone_norme).limit(1);
    if (data && data.length) return { certitude: 'sur', client: data[0], motif: 'même téléphone' };
  }

  if (infos.nom) {
    const { data } = await db.from('suivi_clients').select('*').limit(500);
    const cle = cleNom(infos.nom);
    if (data) {
      const exact = data.filter((c) => cleNom(c.nom) === cle);
      if (exact.length === 1) {
        const memeVille = infos.ville && exact[0].ville &&
          cleNom(exact[0].ville) === cleNom(infos.ville);
        return memeVille
          ? { certitude: 'sur',  client: exact[0], motif: 'même nom et même ville' }
          : { certitude: 'doute', client: exact[0], motif: 'même nom, adresse non confirmée' };
      }
      const proches = data.filter((c) => {
        const k = cleNom(c.nom);
        return k && cle && (k.includes(cle) || cle.includes(k));
      });
      if (proches.length === 1) {
        return { certitude: 'doute', client: proches[0], motif: 'nom proche' };
      }
    }
  }

  return { certitude: 'nouveau', client: null, motif: 'aucun dossier ressemblant' };
}

/** Écrit une ligne d'historique. Jamais bloquant : un échec ici ne doit rien casser. */
async function tracer(db, projetId, type_action, texte, auteurId) {
  try {
    await db.from('suivi_historique').insert({
      projet_id: projetId, type_action, texte, auteur_id: auteurId,
    });
  } catch (e) {
    console.warn('Historique non enregistré', e);
  }
}

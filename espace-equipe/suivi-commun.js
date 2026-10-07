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
    const contenu = await page.getTextContent();
    const paquets = new Map();

    for (const item of contenu.items) {
      if (!item.str || !item.str.trim()) continue;
      const x = item.transform[4];
      const y = Math.round(item.transform[5] / 3) * 3;  // tolérance de 3 points
      if (!paquets.has(y)) paquets.set(y, []);
      paquets.get(y).push({ x, texte: item.str });
    }

    [...paquets.entries()]
      .sort((a, b) => b[0] - a[0])                      // de haut en bas
      .forEach(([y, morceaux]) => {
        morceaux.sort((a, b) => a.x - b.x);
        lignes.push({
          page: p, y,
          texte: morceaux.map((m) => m.texte).join(' ').replace(/\s+/g, ' ').trim(),
          morceaux,
        });
      });
  }
  return lignes;
}

/* ===== Interprétation du contenu ===== */

const RE_NUMERO = /\b(DM|CM|FM)\s?(\d{4,10})\b/i;
const RE_DATE   = /\b(\d{2})[/.-](\d{2})[/.-](\d{4})\b/;
const RE_TEL    = /(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}/;
const RE_MAIL   = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const RE_CP     = /\b(\d{5})\s+([A-ZÀ-Ÿ][A-ZÀ-Ÿ'\- ]{2,})\b/;
const CP_MAGASIN = '59270';   // Bailleul : c'est nous, jamais le client

const TYPE_PAR_PREFIXE = { DM: 'devis', CM: 'commande', FM: 'facture' };

/** Convertit « 1 234,56 » en nombre. Rend null si rien d'exploitable. */
function nombre(txt) {
  if (!txt) return null;
  const m = String(txt).replace(/\s| |€/g, '').match(/-?\d+(?:[.,]\d+)?/);
  return m ? parseFloat(m[0].replace(',', '.')) : null;
}

/** Cherche la valeur qui suit une étiquette, sur la même ligne. */
function valeurApres(lignes, motif) {
  for (const l of lignes) {
    const m = l.texte.match(motif);
    if (m) return (m[1] ?? '').trim();
  }
  return null;
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
 * pour que l'écran les montre vides au lieu de mentir.
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

  // Cadre client
  const telBrut = texteBrut.match(RE_TEL)?.[0] ?? null;
  const email   = texteBrut.match(RE_MAIL)?.[0] ?? null;
  // L'en-tete du document porte l'adresse du magasin. Prendre le premier code
  // postal venu reviendrait a domicilier tous les clients a Bailleul.
  const cpVille = [...texteBrut.matchAll(new RegExp(RE_CP, 'g'))]
    .map((m) => ({ cp: m[1], ville: m[2].trim() }))
    .find((v) => v.cp !== CP_MAGASIN) ?? null;

  // « Client : PARTICULIER SANITAIRE » donne le type ET l'univers
  const champClient = valeurApres(lignes, /Client\s*:\s*(.+)/i) ?? '';
  const majClient = champClient.toUpperCase();
  const type_client = /PROFESSIONEL|PROFESSIONNEL|PRO\b/.test(majClient) ? 'professionnel' : 'particulier';
  let univers = null;
  if (/SANITAIRE/.test(majClient))      univers = 'sanitaire';
  else if (/PARQUET/.test(majClient))   univers = 'parquet';
  else if (/PIERRE/.test(majClient))    univers = 'pierre';
  else if (/CARRELAGE/.test(majClient)) univers = 'carrelage';

  const commercial = (valeurApres(lignes, /Commercial\s*:\s*([A-ZÀ-Ÿ\- ]+)/i) ?? '').trim().toUpperCase() || null;

  // Nom du client : la ligne du cadre adresse, hors étiquettes connues
  let nom = null;
  for (const l of lignes.slice(0, 40)) {
    const t = l.texte.trim();
    if (t.length < 4 || t.length > 60) continue;
    if (/Client\s*:|Commercial\s*:|DEVIS|FACTURE|COMMANDE|SARL|TVA|SIRET|Page|Top|BAILLEUL|AMENAGEMENT|CARRELAGE\b/i.test(t)) continue;
    if (/^(M|MME|MR|MLLE|MONSIEUR|MADAME)\b/i.test(t) || /^[A-ZÀ-Ÿ][A-ZÀ-Ÿ'\- ]{3,}$/.test(t)) { nom = t; break; }
  }

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

  return {
    type_doc, numero, date_doc, date_expiration,
    total_ht, total_ttc, acompte, reste_a_payer: reste, poids_kg,
    numero_lie, texte_brut: texteBrut,
    client: {
      nom,
      telephone: telBrut,
      telephone_norme: normaliserTel(telBrut),
      email,
      code_postal: cpVille?.cp ?? null,
      ville: cpVille?.ville ?? null,
      type_client,
    },
    univers,
    commercial,
    lignes: extraireLignes(lignes),
  };
}

/**
 * Extrait les lignes de produits.
 *
 * L'en-tete du tableau annonce DESIGNATION, FORMAT, QTE, UNITE, PU HT, MONTANT.
 * L'unite est donc l'ancre la plus fiable : le nombre qui la precede est la
 * quantite, ceux qui la suivent sont le prix unitaire puis le montant.
 *
 * Sans cette ancre, le format du carreau trompe la lecture : sur
 * « CARRELAGE GRES 60X60 0 M2 82,78 0,00 », compter les nombres de gauche a
 * droite donne une quantite de 60 au lieu de 0.
 */
const UNITES = ['M2', 'M²', 'ML', 'U', 'PCE', 'SAC', 'BTE', 'KG', 'L', 'P', 'LOT', 'ENS', 'H'];

function extraireLignes(lignes) {
  const sortie = [];
  let dansTableau = false;

  for (const l of lignes) {
    const t = l.texte;
    if (/D[ÉE]SIGNATION/i.test(t) && /(QT[ÉE]|QUANTIT[ÉE])/i.test(t)) { dansTableau = true; continue; }
    if (/TOTAL\s*H\.?T|CONDITIONS|MODE DE R[ÈE]GLEMENT|Page\s+\d|DEVIS VALABLE/i.test(t)) { dansTableau = false; continue; }
    if (!dansTableau || t.length < 2) continue;

    sortie.push(lireLigne(t));
  }
  return sortie;
}

function lireLigne(t) {
  const mots = t.split(/\s+/);
  const estNombre = (m) => /^-?\d+(?:[.,]\d+)?$/.test(m);

  // On cherche l'unite la plus a droite qui soit precedee d'un nombre : c'est
  // la colonne UNITE. Chercher la premiere attraperait le « L » d'un libelle.
  let iUnite = -1;
  for (let i = mots.length - 1; i > 0; i--) {
    if (UNITES.includes(mots[i].toUpperCase()) && estNombre(mots[i - 1])) { iUnite = i; break; }
  }

  let qte = null, pu = null, designation = t;

  if (iUnite > 0) {
    qte = nombre(mots[iUnite - 1]);
    const apres = mots.slice(iUnite + 1).filter(estNombre).map(nombre);
    pu = apres.length ? apres[0] : null;
    // Tout ce qui precede la quantite est la designation, format compris.
    designation = mots.slice(0, iUnite - 1).join(' ').trim();
  } else {
    // Pas d'unite : soit un commentaire, soit une ligne de remise.
    const nombres = mots.filter(estNombre).map(nombre);
    const prix = mots.filter((m) => /^-?\d+[.,]\d{2}$/.test(m)).map(nombre);
    if (prix.length) {
      pu = prix[0];
      qte = nombres.length > prix.length ? nombres[0] : null;
      designation = mots.filter((m) => !estNombre(m)).join(' ').trim();
    }
  }

  const ligne = { designation: designation || t, qte, pu, texte: t };
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

/**
 * Jeu d'essai : des donnees fausses pour voir l'application vivante.
 *
 * Le cahier des charges interdit les donnees inventees dans le code livre.
 * Pierre-Louis a demande une exception pour pouvoir juger les ecrans, qui sont
 * tous vides tant que rien n'est saisi. L'exception tient parce que ces
 * donnees ne partent jamais de son navigateur, qu'un bandeau les signale tant
 * qu'elles sont la, et qu'un bouton les efface.
 *
 * Deux precautions qui comptent :
 *  - aucun nom de vrai client, de vrai fournisseur ni de vraie marque ;
 *  - aucun identifiant legal invente. SIRET, TVA et IBAN restent vides : un
 *    faux numero recopie par erreur sur un document aurait de vraies suites.
 */
(function () {
  const S = () => window.Store;

  const jour = (decalage) => {
    const d = new Date();
    d.setDate(d.getDate() + decalage);
    return d.toISOString().slice(0, 10);
  };
  const moisPasse = (n) => {
    const d = new Date();
    d.setMonth(d.getMonth() - n, 12);
    return d.toISOString().slice(0, 10);
  };

  function construire() {
    const S_ = S();
    const id = () => S_.uid();

    // Les trois grilles de transport du magasin, relevees sur la fiche affichee
    // au comptoir. Ce sont de vrais tarifs : un bandeau invite a les verifier
    // avant de s'en servir pour chiffrer, une erreur de saisie se paierait sur
    // un devis.
    const tr = (nom, pays, o) => Object.assign({ id: id(), nom, pays, actif: true }, o);
    const transporteurs = [
      tr('SERRET', 'Espagne', {
        mini_kg: 2000, forfait: 255, ramasse: 14, frais_facture: 0,
        plafond_kg: 24000, plafond_prix: 2200, poids_reference: 8000,
        tranches: [
          { de: 2001, a: 5000, prix_tonne: 136.76 },
          { de: 5001, a: 10000, prix_tonne: 127.22 },
          { de: 10001, a: 15000, prix_tonne: 119.88 },
          { de: 15001, a: 20000, prix_tonne: 110.10 },
        ],
        envoi: 'mercredi soir', chargement: 'le mardi', arrivage: 'environ le vendredi',
        note: 'Minimum 2000 kg, plus 20 € par ramasse. Cumul de poids.',
      }),
      tr('DEHOSSE', 'Italie', {
        mini_kg: 1500, forfait: 145, ramasse: 40, frais_facture: 3,
        plafond_kg: 24000, plafond_prix: 0, poids_reference: 8000,
        tranches: [
          { de: 1501, a: 5000, prix_tonne: 125 },
          { de: 5001, a: 24000, prix_tonne: 115 },
        ],
        envoi: 'mercredi soir', chargement: 'le mardi suivant', arrivage: 'environ le vendredi',
        note: 'Cumul de poids. Envoi TUS et CAP le mardi soir.',
      }),
      tr('CODOGNOTTO', 'Portugal', {
        mini_kg: 2500, forfait: 240, ramasse: 50, frais_facture: 0,
        plafond_kg: 24000, plafond_prix: 0, poids_reference: 8000,
        tranches: [
          { de: 2501, a: 3000, prix_tonne: 93 },
          { de: 3001, a: 5001, prix_tonne: 90 },
          { de: 5001, a: 15000, prix_tonne: 89 },
          { de: 15001, a: 24000, prix_tonne: 87 },
        ],
        envoi: 'le samedi', chargement: 'le mercredi', arrivage: 'environ le vendredi',
        note: 'Cumul de poids. KERION sans ramasse, ALELUIA à transférer en Espagne.',
      }),
    ];
    const [serret, dehosse, codognotto] = transporteurs;

    const f1 = { id: id(), nom: 'Céramiques du Littoral', code: 'CERLIT', pays: 'Espagne',
                 famille: 'Carrelage', transporteur_id: serret.id, contact: 'Service commercial',
                 email: '', tel: '', adresse: '', cp: '', ville: '', delai_jours: 21, notes: '' };
    const f2 = { id: id(), nom: 'Bois et Sols Réunis', code: 'BOISOL', pays: 'Portugal',
                 famille: 'Parquet', transporteur_id: codognotto.id, contact: 'Service commercial',
                 email: '', tel: '', adresse: '', cp: '', ville: '', delai_jours: 14, notes: '' };

    const art = (ref, designation, unite, achat, vente, stock, alerte, fo, empl, poids, format, mult, usine) =>
      ({ id: id(), ref, designation, format: format || '', usine: usine || '', unite,
         unite_stock: unite === 'm²' ? 'M2' : 'PCS',
         multiple_vente: mult || 0, mini_palette: 0,
         poids_unitaire: poids || 0, code_barre: '', photo: '', commentaire: '',
         prix_achat: achat, prix_vente: vente, tva: 20,
         stock, stock_alerte: alerte, fournisseur_id: fo, emplacement: empl,
         cree_le: jour(-150) + 'T09:00:00.000Z', maj_le: jour(-20) + 'T09:00:00.000Z' });

    const a = [
      art('CAR-6060-BEI', 'Carrelage grès cérame 60x60 beige mat', 'm²', 18.40, 32.90, 148, 40, f1.id, 'Allée A - Rack 2', 21.2, '60X60X9', 1.44, 'MARGRES'),
      art('CAR-6060-GRI', 'Carrelage grès cérame 60x60 gris anthracite', 'm²', 19.10, 34.50, 22, 40, f1.id, 'Allée A - Rack 3', 21.2, '60X60X9', 1.44, 'MARGRES'),
      art('CAR-3060-BLA', 'Faïence murale 30x60 blanc brillant', 'm²', 9.70, 19.90, 310, 60, f1.id, 'Allée A - Rack 5', 14.5, '30X60X8', 1.08, 'MARGRES'),
      art('CAR-TER-2020', 'Carreau terrasse 20mm 60x60 pierre', 'm²', 26.80, 48.00, 64, 30, f1.id, 'Extérieur - Palette 4', 46.0, '60X60X20', 0.72, 'ALELUIA'),
      art('PLO-NM1-110', 'Plot réglable 110 mm tête fixe', 'pce', 1.85, 3.60, 420, 150, f1.id, 'Extérieur - Bac 1', 0.18, '25/40', 0, 'ETERNO'),
      art('COL-C2TE-25', 'Colle carrelage C2TE sac 25 kg', 'sac', 11.20, 21.50, 74, 30, f1.id, 'Allée C - Sol', 25.0, '', 0, 'KERAKOLL'),
      art('JOI-FIN-5', 'Joint fin sac 5 kg gris perle', 'sac', 7.40, 14.90, 12, 25, f1.id, 'Allée C - Étagère', 5.0, '', 0, 'KERAKOLL'),
      art('SAN-REC-9012', 'Receveur de douche 90x120 blanc', 'pce', 212.00, 398.00, 6, 4, f1.id, 'Allée D - Box 2', 38.0, '90X120', 0, 'HIDRONATUR'),
      art('SAN-MIT-LAV', 'Mitigeur lavabo nickel brossé', 'pce', 78.50, 149.00, 18, 8, f1.id, 'Allée D - Box 5', 2.4, '', 0, 'ODESIGN'),
      art('SAN-VAS-5135', 'Vasque à poser 51x35 blanc mat', 'pce', 96.00, 189.00, 9, 5, f1.id, 'Allée D - Box 6', 11.0, '510X350X110', 0, 'ODESIGN'),
      art('PAR-CHE-1190', 'Parquet contrecollé chêne naturel 1190x185', 'm²', 29.40, 54.00, 96, 40, f2.id, 'Allée E - Rack 1', 9.8, '1190X185X10', 2.2, 'PARQWOOD'),
      art('PAR-SOU-21DB', 'Sous-couche acoustique 21 dB rouleau 10 m', 'pce', 42.00, 78.00, 7, 10, f2.id, 'Allée E - Sol', 4.2, '1X10M', 0, 'BERRY'),
      art('PAR-PLI-1950', 'Plinthe chêne naturel 1950 x 65', 'pce', 10.60, 19.90, 54, 20, f2.id, 'Allée E - Rack 2', 1.1, '1950X65', 0, 'PARQWOOD'),
    ];
    const ref = (r) => a.find(x => x.ref === r);

    // Les vendeurs du magasin. Ce sont de vrais prenoms, donnes par
    // Pierre-Louis : ce n'est pas une donnee inventee, et il peut les
    // renommer ou les desactiver depuis l'ecran Commerciaux.
    const co = (n, actif) => ({ id: id(), nom: n, actif: actif !== false });
    const commerciaux = [
      co('Pierre-Louis'), co('Jérémie'), co('Simon'),
      co('Louis'), co('Louise'), co('Manon'), co('Freddy', false),
    ];
    const [pl, jeremie, simon, , louise, manon] = commerciaux;

    const cl = (type, nom, contact, ville, cp, tel) =>
      ({ id: id(), type, nom, contact: contact || '', email: '', tel: tel || '',
         adresse: '', cp: cp || '', ville: ville || '', notes: '', created: jour(-120),
         commercial_id: '' });

    const clients = [
      cl('particulier', 'MARTIN Julien', '', 'Bailleul', '59270', '06 00 00 00 01'),
      cl('particulier', 'DUBOIS Claire', '', 'Hazebrouck', '59190', '06 00 00 00 02'),
      cl('particulier', 'LEROY Sébastien', '', 'Armentières', '59280', '06 00 00 00 03'),
      cl('particulier', 'FONTAINE Amélie', '', 'Merville', '59660', '06 00 00 00 04'),
      cl('pro', 'SARL BÂTI CONFORT', 'M. Delattre', 'Nieppe', '59850', '03 00 00 00 05'),
      cl('pro', 'SCI LES ACACIAS', 'Mme Carpentier', 'Estaires', '59940', '03 00 00 00 06'),
    ];
    // Chacun suivi par quelqu'un, sauf le dernier : on voit ainsi a quoi
    // ressemble la ligne « Non attribué » dans les chiffres.
    [pl, jeremie, simon, pl, louise, null].forEach((c, i) => {
      clients[i].commercial_id = c ? c.id : '';
    });

    const ligne = (article, qte, remise) => ({
      article_id: article.id, designation: article.designation, qte,
      pu: article.prix_vente, pu_interne: article.prix_achat,
      remise_pct: remise || 0, tva: article.tva,
    });

    // Devis : un de chaque etat, dont un envoye depuis longtemps pour que
    // l'ecran Relances ne soit pas vide, et un qui expire dans trois jours.
    const devis = [
      { id: id(), numero: 'DEV-2026-0001', date: jour(-42), client_id: clients[0].id,
        lignes: [ligne(ref('CAR-6060-BEI'), 38.5, 5), ligne(ref('COL-C2TE-25'), 8), ligne(ref('JOI-FIN-5'), 3)],
        remise_pct: 0, statut: 'accepté', validite: 30, notes: 'Pose par son artisan.', commande_id: null, commercial_id: pl.id },
      { id: id(), numero: 'DEV-2026-0002', date: jour(-27), client_id: clients[4].id,
        lignes: [ligne(ref('CAR-TER-2020'), 62), ligne(ref('PLO-NM1-110'), 180)],
        remise_pct: 3, statut: 'envoyé', validite: 30, notes: 'Terrasse sur plots.', commande_id: null, commercial_id: louise.id },
      { id: id(), numero: 'DEV-2026-0003', date: jour(-19), client_id: clients[1].id,
        lignes: [ligne(ref('SAN-REC-9012'), 1), ligne(ref('SAN-MIT-LAV'), 2), ligne(ref('SAN-VAS-5135'), 1), ligne(ref('CAR-3060-BLA'), 24)],
        remise_pct: 0, statut: 'envoyé', validite: 30, notes: '', commande_id: null, commercial_id: jeremie.id },
      { id: id(), numero: 'DEV-2026-0004', date: jour(-3), client_id: clients[2].id,
        lignes: [ligne(ref('PAR-CHE-1190'), 46), ligne(ref('PAR-SOU-21DB'), 5), ligne(ref('PAR-PLI-1950'), 28)],
        remise_pct: 0, statut: 'brouillon', validite: 30, notes: 'Attend le métrage définitif.', commande_id: null, commercial_id: simon.id },
      { id: id(), numero: 'DEV-2026-0005', date: jour(-58), client_id: clients[3].id,
        lignes: [ligne(ref('CAR-6060-GRI'), 31)],
        remise_pct: 0, statut: 'expiré', validite: 30, notes: '', commande_id: null, commercial_id: manon.id },
    ];

    const commandes = [
      { id: id(), numero: 'CMD-2026-0001', date: jour(-40), client_id: clients[0].id,
        devis_id: devis[0].id, lignes: JSON.parse(JSON.stringify(devis[0].lignes)), remise_pct: 0,
        statut: 'facturée', date_livraison: jour(-24), notes: '', facture_id: null, stock_sorti: true, commercial_id: pl.id },
      { id: id(), numero: 'CMD-2026-0002', date: jour(-11), client_id: clients[5].id,
        lignes: [ligne(ref('CAR-3060-BLA'), 42), ligne(ref('COL-C2TE-25'), 6)],
        remise_pct: 0, statut: 'en cours', date_livraison: jour(6), notes: 'Livraison sur chantier.', facture_id: null, commercial_id: louise.id },
      { id: id(), numero: 'CMD-2026-0003', date: jour(-5), client_id: clients[2].id,
        lignes: [ligne(ref('SAN-MIT-LAV'), 1)], remise_pct: 0,
        statut: 'commandée', date_livraison: jour(14), notes: '', facture_id: null, commercial_id: simon.id },
    ];
    devis[0].commande_id = commandes[0].id;

    const paiement = (date, montant, mode) => ({ date, montant, mode: mode || 'Virement' });

    const factures = [
      { id: id(), numero: 'FAC-2026-0001', date: moisPasse(3), date_echeance: S_.addDays(moisPasse(3), 30),
        client_id: clients[3].id, commande_id: null,
        lignes: [ligne(ref('CAR-6060-BEI'), 52), ligne(ref('COL-C2TE-25'), 10)],
        remise_pct: 0, paiements: [], notes: '', commercial_id: manon.id },
      { id: id(), numero: 'FAC-2026-0002', date: moisPasse(2), date_echeance: S_.addDays(moisPasse(2), 30),
        client_id: clients[4].id, commande_id: null,
        lignes: [ligne(ref('PAR-CHE-1190'), 72), ligne(ref('PAR-PLI-1950'), 40), ligne(ref('PAR-SOU-21DB'), 8)],
        remise_pct: 2, paiements: [], notes: '', commercial_id: jeremie.id },
      { id: id(), numero: 'FAC-2026-0003', date: moisPasse(1), date_echeance: S_.addDays(moisPasse(1), 30),
        client_id: clients[1].id, commande_id: null,
        lignes: [ligne(ref('SAN-REC-9012'), 1), ligne(ref('SAN-VAS-5135'), 2)],
        remise_pct: 0, paiements: [], notes: '', commercial_id: jeremie.id },
      { id: id(), numero: 'FAC-2026-0004', date: jour(-24), date_echeance: jour(6),
        client_id: clients[0].id, commande_id: commandes[0].id,
        lignes: JSON.parse(JSON.stringify(commandes[0].lignes)),
        remise_pct: 0, paiements: [], notes: '', commercial_id: pl.id },
    ];
    commandes[0].facture_id = factures[3].id;

    // Les deux plus anciennes sont reglees, la troisieme a moitie, la derniere
    // attend encore : l'ecran Relances et les indicateurs ont de quoi montrer.
    const totalTtc = (f) => S_.lineTotals(f.lignes, f.remise_pct).ttc;
    factures[0].paiements.push(paiement(S_.addDays(factures[0].date, 12), Math.round(totalTtc(factures[0]) * 100) / 100));
    factures[1].paiements.push(paiement(S_.addDays(factures[1].date, 26), Math.round(totalTtc(factures[1]) * 100) / 100));
    factures[2].paiements.push(paiement(S_.addDays(factures[2].date, 20), Math.round(totalTtc(factures[2]) * 0.4 * 100) / 100));

    const achats = [
      { id: id(), numero: 'ACH-2026-0001', date: jour(-34), fournisseur_id: f1.id,
        lignes: [{ article_id: ref('CAR-6060-BEI').id, designation: ref('CAR-6060-BEI').designation, qte: 120, prix: 18.40 },
                 { article_id: ref('COL-C2TE-25').id, designation: ref('COL-C2TE-25').designation, qte: 60, prix: 11.20 }],
        remise_pct: 4, statut: 'reçu', date_envoi: jour(-30), date_reception: jour(-16), notes: '' },
      { id: id(), numero: 'ACH-2026-0002', date: jour(-7), fournisseur_id: f2.id,
        lignes: [{ article_id: ref('PAR-SOU-21DB').id, designation: ref('PAR-SOU-21DB').designation, qte: 24, prix: 42.00 },
                 { article_id: ref('PAR-PLI-1950').id, designation: ref('PAR-PLI-1950').designation, qte: 60, prix: 10.60 }],
        remise_pct: 0, statut: 'expédié', date_envoi: jour(-2), date_reception: '', notes: 'Arrivage annoncé sous quinze jours.' },
    ];

    const mvt = (date, article, qte, motif, reference) =>
      ({ id: id(), date, article_id: article.id, qte, motif, ref: reference });

    const mouvements = [
      mvt(jour(-16), ref('CAR-6060-BEI'), 120, 'Réception achat', 'ACH-2026-0001'),
      mvt(jour(-16), ref('COL-C2TE-25'), 60, 'Réception achat', 'ACH-2026-0001'),
      mvt(jour(-24), ref('CAR-6060-BEI'), -38.5, 'Facture client', 'FAC-2026-0004'),
      mvt(jour(-24), ref('COL-C2TE-25'), -8, 'Facture client', 'FAC-2026-0004'),
      mvt(jour(-24), ref('JOI-FIN-5'), -3, 'Facture client', 'FAC-2026-0004'),
      mvt(jour(-9), ref('CAR-6060-GRI'), -18, 'Vente comptoir', ''),
    ];

    const annee = new Date().getFullYear();
    const objectifs = [{ id: id(), annee, mois: 0, montant: 540000, commercial: '' }];

    return {
      version: 1,
      settings: {
        company: {
          name: 'Top Aménagement Bailleul',
          address: '22 avenue de l\'Europe, 59270 Bailleul',
          phone: '03 28 48 08 08',
          email: 'topcarrelagebailleul@yahoo.com',
          // Jamais d'identifiant legal invente : un faux numero recopie sur un
          // document aurait de vraies consequences.
          siret: '', tva_intra: '', iban: '',
          legal_note: 'Conditions de paiement : à réception de facture, sauf accord contraire.'
        },
        tva_rates: [20, 10], default_tva: 20,
        devis_prefix: 'DEV', commande_prefix: 'CMD', facture_prefix: 'FAC', achat_prefix: 'ACH',
        delai_relance_jours: 15, delai_stockage_alerte: 14,
        tel_reception: '', validite_devis_jours: 30,
        objectif_ca_mensuel: 45000, objectif_ca_annuel: 540000,
        gazole_pct: 4.5, gazole_maj: jour(-12), coef_vente: 1.6,
        commercial: 'Pierre-Louis',
        jeu_essai: true,
      },
      // Les compteurs repartent au-dela des numeros utilises, sinon le premier
      // vrai document reprendrait un numero deja pris.
      counters: { DEV: devis.length, CMD: commandes.length, FAC: factures.length, ACH: achats.length },
      commerciaux, transporteurs, clients, fournisseurs: [f1, f2], articles: a,
      devis, commandes, factures, achats, mouvements, objectifs,
    };
  }

  function charger() {
    const db = S().db;
    const rempli = (db.clients.length + db.devis.length + db.factures.length + db.articles.length) > 0;
    if (rempli && !db.settings.jeu_essai) {
      if (!confirm('Des données sont déjà enregistrées dans ce navigateur.\n\n'
                 + 'Charger le jeu d\'essai va les remplacer. Exportez une sauvegarde avant si vous y tenez.\n\n'
                 + 'Continuer ?')) return;
    }
    const neuf = construire();
    Object.keys(S().db).forEach(k => { delete S().db[k]; });
    Object.assign(S().db, neuf);
    S().save();
    location.reload();
  }

  function effacer() {
    if (!confirm('Effacer le jeu d\'essai et repartir d\'une application vide ?')) return;
    S().resetAll();
    location.reload();
  }

  function bandeau() {
    const zone = document.getElementById('bandeau-essai');
    if (!zone) return;
    const db = S().db;
    if (db.settings.jeu_essai) {
      zone.className = 'bandeau-essai actif';
      zone.innerHTML = '<span><b>Jeu d\'essai.</b> Ces clients, articles et montants sont inventés, '
        + 'uniquement pour voir les écrans remplis.</span>'
        + '<button type="button" class="btn ghost" id="essai-effacer">Effacer et repartir à vide</button>';
      document.getElementById('essai-effacer').addEventListener('click', effacer);
      return;
    }
    const vide = (db.clients.length + db.devis.length + db.factures.length + db.articles.length) === 0;
    if (!vide) { zone.className = 'bandeau-essai'; zone.innerHTML = ''; return; }
    zone.className = 'bandeau-essai propose';
    zone.innerHTML = '<span>L\'application est vide. Vous pouvez la remplir avec des données inventées '
      + 'pour voir à quoi elle ressemble.</span>'
      + '<button type="button" class="btn gold" id="essai-charger">Charger un jeu d\'essai</button>';
    document.getElementById('essai-charger').addEventListener('click', charger);
  }

  // app.js charge les donnees au DOMContentLoaded, pas a la lecture du script.
  // Dessiner le bandeau tout de suite trouvait donc Store.db encore vide.
  // Notre ecouteur est pose apres le sien, il passe donc apres lui.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bandeau);
  else bandeau();

  window.JeuEssai = { charger, effacer };
})();

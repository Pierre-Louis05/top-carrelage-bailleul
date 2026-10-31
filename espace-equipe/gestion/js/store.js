/* Couche données : localStorage + sauvegarde JSON.
   Toutes les lectures/écritures passent par try/catch. */
(function () {
  const KEY = 'topamenagement.v1';
  const VERSION = 1;

  const emptyDb = () => ({
    version: VERSION,
    settings: {
      company: {
        name: 'Top Aménagement Bailleul',
        address: '22 avenue de l\'Europe, 59270 Bailleul',
        phone: '',
        email: '',
        siret: '',
        tva_intra: '',
        iban: '',
        legal_note: 'Conditions de paiement : à réception de facture, sauf accord contraire.'
      },
      tva_rates: [20, 10],
      default_tva: 20,
      devis_prefix: 'DEV',
      commande_prefix: 'CMD',
      facture_prefix: 'FAC',
      achat_prefix: 'ACH',
      delai_relance_jours: 15,
      delai_stockage_alerte: 14,
      tel_reception: '',
      validite_devis_jours: 30,
      objectif_ca_mensuel: 0,
      objectif_ca_annuel: 0,
      commercial: ''
    },
    counters: { DEV: 0, CMD: 0, FAC: 0, ACH: 0 },
    commerciaux: [],    // { id, nom, actif } : qui suit le client, et de qui est le chiffre
    clients: [],        // { id, type:'particulier'|'pro', nom, contact, email, tel, adresse, cp, ville, notes, created, commercial_id }
    fournisseurs: [],   // { id, nom, contact, email, tel, adresse, cp, ville, delai_jours, notes }
    articles: [],       // { id, ref, designation, unite, prix_achat, prix_vente, tva, stock, stock_alerte, fournisseur_id, emplacement }
    devis: [],          // { id, numero, date, client_id, lignes:[], remise_pct, statut, validite, notes, commande_id }
    commandes: [],      // { id, numero, date, client_id, devis_id, lignes, remise_pct, statut, date_livraison, notes, facture_id }
    factures: [],       // { id, numero, date, date_echeance, client_id, commande_id, lignes, remise_pct, statut, paiements:[{date,montant,mode}], notes }
    achats: [],         // { id, numero, date, fournisseur_id, lignes:[{article_id, designation, qte, prix}], statut:'commande'|'recu', date_reception, notes }
    mouvements: [],     // { id, date, article_id, qte (+/-), motif, ref }
    objectifs: []       // { id, annee, mois (0 = annuel), montant, commercial }
  });

  let db = null;
  let saveError = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) { db = emptyDb(); return db; }
      const parsed = JSON.parse(raw);
      db = Object.assign(emptyDb(), parsed);
      db.settings = Object.assign(emptyDb().settings, parsed.settings || {});
      db.counters = Object.assign({ DEV: 0, CMD: 0, FAC: 0, ACH: 0 }, parsed.counters || {});
      return db;
    } catch (e) {
      console.warn('Lecture impossible, données vides utilisées', e);
      db = emptyDb();
      return db;
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
      saveError = null;
      return true;
    } catch (e) {
      saveError = e;
      console.warn('Sauvegarde impossible (navigateur bloqué ou plein)', e);
      return false;
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* Numérotation automatique : DEV-2026-0001 */
  function nextNumber(kind) {
    const prefix = db.settings[kind.toLowerCase() + '_prefix'] || kind;
    db.counters[kind] = (db.counters[kind] || 0) + 1;
    const year = new Date().getFullYear();
    return `${prefix}-${year}-${String(db.counters[kind]).padStart(4, '0')}`;
  }

  /* Calculs */
  function lineTotals(lines, remisePct) {
    let ht = 0;
    const byTva = {};
    (lines || []).forEach(l => {
      const montant = (Number(l.qte) || 0) * (Number(l.pu) || 0) * (1 - (Number(l.remise_pct) || 0) / 100);
      ht += montant;
      const t = Number(l.tva) || 20;
      byTva[t] = (byTva[t] || 0) + montant;
    });
    const brut = (lines || []).reduce((s, l) => s + (Number(l.qte) || 0) * (Number(l.pu) || 0), 0);
    const remiseLignes = brut - ht;
    const remise = ht * ((Number(remisePct) || 0) / 100);
    const factor = 1 - (Number(remisePct) || 0) / 100;
    let totalHt = ht - remise;
    const tvaDetail = {};
    let tva = 0;
    Object.keys(byTva).forEach(rate => {
      const base = byTva[rate] * factor;
      const montantTva = base * (Number(rate) / 100);
      tvaDetail[rate] = { base, tva: montantTva };
      tva += montantTva;
    });
    /* brut = prix catalogue ; remiseLignes = remises par ligne ; remise = remise globale ; ht = net HT */
    return { brut, remiseLignes, remise, ht: totalHt, tva, ttc: totalHt + tva, tvaDetail };
  }

  function money(n) {
    const v = Number(n) || 0;
    return v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  }

  function num(n, digits = 2) {
    return (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: digits });
  }

  function dateFr(iso) {
    if (!iso) return '';
    const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
    return isNaN(d) ? iso : d.toLocaleDateString('fr-FR');
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function addDays(iso, days) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + Number(days || 0));
    return d.toISOString().slice(0, 10);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* Sauvegarde / restauration fichier JSON */
  function exportJson() {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    // Une sauvegarde de donnees inventees doit se reconnaitre a son nom : on
    // ne voudrait pas la restaurer un jour en croyant reprendre du reel.
    const marque = db.settings && db.settings.jeu_essai ? 'JEU-D-ESSAI-' : '';
    a.download = `topamenagement-${marque}sauvegarde-${today()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    try { localStorage.setItem('topamenagement.lastExport', String(Date.now())); } catch (e) { /* ignoré */ }
  }

  function importJson(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          if (!parsed || typeof parsed !== 'object' || !parsed.settings) throw new Error('Fichier non reconnu');
          db = Object.assign(emptyDb(), parsed);
          db.settings = Object.assign(emptyDb().settings, parsed.settings);
          save();
          resolve(true);
        } catch (e) { reject(e); }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  function resetAll() {
    db = emptyDb();
    save();
  }

  window.Store = {
    load, save, uid, nextNumber, lineTotals, money, num, dateFr, today, addDays,
    escapeHtml, exportJson, importJson, resetAll,
    get db() { return db; },
    get saveError() { return saveError; }
  };
})();

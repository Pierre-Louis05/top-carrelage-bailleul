/* Tableau de bord, statistiques, objectifs, export comptable */
(function () {
  const S = () => window.Store;
  const UI = window.UI;
  const I = UI.icon;
  const V = () => window.Ventes;
  const esc = UI.esc;
  const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  const MOIS_LONG = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  /* CA HT facturé par mois (index 0..11) pour une année */
  function caParMois(annee) {
    const res = Array(12).fill(0);
    S().db.factures.forEach(f => {
      if (!f.date || Number(f.date.slice(0, 4)) !== annee) return;
      res[Number(f.date.slice(5, 7)) - 1] += V().totalFacture(f).ht;
    });
    return res;
  }

  function objectifMois(annee, mois) {
    const db = S().db;
    const special = db.objectifs.find(o => o.annee === annee && o.mois === mois + 1);
    if (special) return Number(special.montant) || 0;
    return Number(db.settings.objectif_ca_mensuel) || 0;
  }

  function objectifAnnee(annee) {
    const db = S().db;
    const special = db.objectifs.find(o => o.annee === annee && o.mois === 0);
    if (special) return Number(special.montant) || 0;
    const mensuels = Array.from({ length: 12 }, (_, i) => objectifMois(annee, i)).reduce((a, b) => a + b, 0);
    return mensuels || Number(db.settings.objectif_ca_annuel) || 0;
  }

  const pct = (a, b) => b > 0 ? Math.round((a / b) * 100) : 0;

  /* Histogramme : valeurs, libellés, objectifs optionnels (ligne pointillée) */
  function chart(values, labels, objectifs, currentIdx) {
    const max = Math.max(1, ...values, ...(objectifs || [0]));
    const cols = values.map((v, i) => {
      const obj = objectifs ? objectifs[i] : 0;
      const hit = obj > 0 && v >= obj;
      const h = (v / max) * 100;
      return `<div class="col" title="${labels[i]} : ${S().money(v)}${obj ? ' · objectif ' + S().money(obj) : ''}">
        <div class="val">${v >= 1000 ? (v / 1000).toFixed(1).replace('.', ',') + ' k' : (v ? Math.round(v) + '' : '')}</div>
        <div class="fill ${hit ? 'hit' : ''}" style="height:${h}%;${i === currentIdx ? 'outline:2px solid var(--gold);outline-offset:2px;' : ''}"></div>
        <small>${labels[i]}</small></div>`;
    }).join('');
    const legend = objectifs ? `<div class="legend"><span><i style="background:var(--navy)"></i>CA réalisé</span><span><i style="background:var(--gold)"></i>Objectif atteint</span></div>` : '';
    return `<div class="chart">${cols}</div>${legend}`;
  }

  function topClients(annee) {
    const db = S().db;
    const map = {};
    db.factures.forEach(f => {
      if (Number(f.date.slice(0, 4)) !== annee) return;
      map[f.client_id] = (map[f.client_id] || 0) + V().totalFacture(f).ht;
    });
    const rows = Object.keys(map).map(id => ({ nom: V().clientNom(id), ca: map[id] })).sort((a, b) => b.ca - a.ca).slice(0, 6);
    if (!rows.length) return `<div class="empty"><strong>Pas encore de facture cette année</strong>Le classement apparaîtra après la première facture.</div>`;
    const max = rows[0].ca || 1;
    return rows.map(r => `<div class="hbar"><div class="top"><span>${esc(r.nom)}</span><strong>${S().money(r.ca)}</strong></div>
      <div class="progress"><span style="width:${(r.ca / max) * 100}%"></span></div></div>`).join('');
  }

  /* ---------- Tableau de bord ---------- */
  function tableau(box) {
    const db = S().db;
    const now = new Date();
    const annee = now.getFullYear(), moisIdx = now.getMonth();
    const ca = caParMois(annee);
    const caAnnee = ca.reduce((a, b) => a + b, 0);
    const caMois = ca[moisIdx];
    const objMois = objectifMois(annee, moisIdx);
    const objAn = objectifAnnee(annee);
    const impayes = db.factures.reduce((s, f) => s + V().resteAPayer(f), 0);
    const devisEnCours = db.devis.filter(d => d.statut === 'envoyé');
    const montantDevis = devisEnCours.reduce((s, d) => s + V().totalDevis(d).ht, 0);
    const alertes = db.articles.filter(window.Stock.enAlerte).length;
    const aFacturer = db.commandes.filter(c => !c.facture_id && c.statut !== 'annulée').length;
    const objArr = Array.from({ length: 12 }, (_, i) => objectifMois(annee, i));
    const recent = db.devis.slice().sort((a, b) => (b.numero || '').localeCompare(a.numero || '')).slice(0, 5);

    const alerts = [];
    if (impayes > 0.009) alerts.push(`<a class="btn ghost small" href="#relances">${S().money(impayes)} à relancer</a>`);
    if (alertes) alerts.push(`<a class="btn ghost small" href="#mouvements">${alertes} article(s) en stock bas</a>`);
    if (aFacturer) alerts.push(`<a class="btn ghost small" href="#commandes">${aFacturer} commande(s) à facturer</a>`);

    box.innerHTML = `
      ${alerts.length ? `<div class="btn-row" style="margin-bottom:18px"><span class="muted" style="font-weight:600">À traiter :</span>${alerts.join('')}</div>` : ''}
      <div class="grid grid-kpi">
        <div class="card kpi"><div class="label">CA du mois (HT)</div><div class="value">${S().money(caMois)}</div>
          <div class="sub">Objectif ${S().money(objMois)} · <strong>${pct(caMois, objMois)} %</strong></div>
          <div class="progress"><span style="width:${Math.min(100, pct(caMois, objMois))}%"></span></div></div>
        <div class="card kpi"><div class="label">CA de l'année (HT)</div><div class="value">${S().money(caAnnee)}</div>
          <div class="sub">Objectif ${S().money(objAn)} · <strong>${pct(caAnnee, objAn)} %</strong></div>
          <div class="progress"><span style="width:${Math.min(100, pct(caAnnee, objAn))}%"></span></div></div>
        <div class="card kpi ${impayes > 0.009 ? 'alert' : 'ok'}"><div class="label">Impayés</div><div class="value">${S().money(impayes)}</div><div class="sub"><a href="#relances">Voir les relances</a></div></div>
        <div class="card kpi"><div class="label">Devis en attente</div><div class="value">${S().money(montantDevis)}</div><div class="sub">${devisEnCours.length} devis envoyé(s)</div></div>
      </div>
      <div class="grid grid-2" style="margin-top:18px">
        <div class="card"><div class="card-head"><h2>Chiffre d'affaires ${annee}</h2><a class="muted" href="#objectifs">Modifier les objectifs</a></div>
          ${chart(ca, MOIS, objArr, moisIdx)}</div>
        <div class="card"><div class="card-head"><h2>Derniers devis</h2><a class="muted" href="#devis">Tout voir</a></div>
          ${UI.table(recent, [
            { label: 'N°', render: d => `<a class="link" href="#devis-${d.id}">${esc(d.numero)}</a><small>${esc(V().clientNom(d.client_id))}</small>` },
            { label: 'Statut', render: d => UI.badge(d.statut) },
            { label: 'TTC', num: true, cls: 'strong', render: d => S().money(V().totalDevis(d).ttc) }
          ], { title: 'Aucun devis', text: 'Créez votre premier devis.', action: `<br><a class="btn gold" href="#nouveau-devis-">${I('plus')} Nouveau devis</a>` })}</div>
      </div>
      <div class="grid grid-2">
        <div class="card"><div class="card-head"><h2>Meilleurs clients ${annee}</h2></div>${topClients(annee)}</div>
        <div class="card"><div class="card-head"><h2>Accès rapides</h2></div>
          <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px">
            <a class="btn gold" href="#nouveau-devis-">${I('plus')} Nouveau devis</a>
            <a class="btn ghost" href="#clients">${I('users')} Clients</a>
            <a class="btn ghost" href="#articles">${I('box')} Stock</a>
            <a class="btn ghost" href="#export">${I('export')} Export compta</a>
          </div></div>
      </div>`;
  }

  /* ---------- Statistiques ---------- */
  function statistiques(box) {
    const db = S().db;
    const annee = new Date().getFullYear();
    const ca = caParMois(annee);
    const caTotal = ca.reduce((a, b) => a + b, 0);
    const factAnnee = db.factures.filter(f => Number(f.date.slice(0, 4)) === annee);
    const panier = factAnnee.length ? caTotal / factAnnee.length : 0;
    const parArticle = {};
    db.factures.forEach(f => (f.lignes || []).forEach(l => {
      const k = l.designation || '—';
      parArticle[k] = (parArticle[k] || 0) + (Number(l.qte) || 0) * (Number(l.pu) || 0) * (1 - (Number(l.remise_pct) || 0) / 100);
    }));
    const topArt = Object.keys(parArticle).map(k => ({ k, v: parArticle[k] })).sort((a, b) => b.v - a.v).slice(0, 8);
    const envoyes = db.devis.filter(d => d.statut !== 'brouillon').length;
    const accept = db.devis.filter(d => d.statut === 'accepté' || d.commande_id).length;
    const refuses = db.devis.filter(d => d.statut === 'refusé').length;
    const encaisse = db.factures.reduce((s, f) => s + V().totalPaye(f), 0);

    box.innerHTML = `
      <div class="grid grid-kpi">
        <div class="card kpi"><div class="label">Factures ${annee}</div><div class="value">${factAnnee.length}</div></div>
        <div class="card kpi"><div class="label">Panier moyen HT</div><div class="value">${S().money(panier)}</div></div>
        <div class="card kpi"><div class="label">Taux d'acceptation</div><div class="value">${pct(accept, envoyes || 1)} %</div><div class="sub">${refuses} devis refusé(s)</div></div>
        <div class="card kpi"><div class="label">Total encaissé</div><div class="value">${S().money(encaisse)}</div></div>
      </div>
      <div class="grid grid-2" style="margin-top:18px">
        <div class="card"><div class="card-head"><h2>Évolution du CA HT ${annee}</h2></div>${chart(ca, MOIS)}</div>
        <div class="card"><div class="card-head"><h2>Ventes par article (HT, cumul)</h2></div>
          ${topArt.length ? topArt.map(x => `<div class="hbar"><div class="top"><span>${esc(x.k)}</span><strong>${S().money(x.v)}</strong></div>
            <div class="progress navy"><span style="width:${(x.v / topArt[0].v) * 100}%"></span></div></div>`).join('') : `<div class="empty"><strong>Pas encore de ventes</strong></div>`}
        </div>
      </div>`;
  }

  /* ---------- Objectifs ---------- */
  function objectifs(box) {
    const db = S().db;
    const annee = new Date().getFullYear();
    const ca = caParMois(annee);
    box.innerHTML = `
      <div class="grid grid-2">
        <div class="card"><div class="card-head"><h2>Objectifs par défaut</h2></div>
          <div class="grid grid-form" style="grid-template-columns:1fr 1fr">
            <div class="field"><label>CA mensuel HT (€)</label><input id="ob-m" type="number" min="0" value="${db.settings.objectif_ca_mensuel || 0}"></div>
            <div class="field"><label>CA annuel HT (€)</label><input id="ob-a" type="number" min="0" value="${db.settings.objectif_ca_annuel || 0}"></div>
          </div>
          <p class="help">Valeurs appliquées à tous les mois qui n'ont pas d'objectif personnalisé.</p>
          <button class="btn gold" id="ob-save" style="margin-top:12px">Enregistrer</button>
        </div>
        <div class="card"><div class="card-head"><h2>Avancement ${annee}</h2></div>
          <div id="ob-sum"></div>
        </div>
      </div>
      <div class="card"><div class="card-head"><h2>Objectif par mois</h2><span class="muted">Laissez la valeur par défaut si rien de spécial</span></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Mois</th><th class="num">Objectif HT</th><th class="num">Réalisé HT</th><th style="min-width:180px">Avancement</th></tr></thead>
          <tbody>${MOIS_LONG.map((m, i) => {
            const obj = objectifMois(annee, i), real = ca[i];
            return `<tr><td data-label="Mois"><strong>${m}</strong></td>
              <td class="num" data-label="Objectif HT"><input type="number" min="0" data-mois="${i + 1}" value="${obj}" style="max-width:150px;margin-left:auto;text-align:right"></td>
              <td class="num" data-label="Réalisé HT">${S().money(real)}</td>
              <td data-label="Avancement"><div class="progress" style="margin-top:0"><span style="width:${Math.min(100, pct(real, obj))}%"></span></div><small class="muted">${pct(real, obj)} %</small></td></tr>`;
          }).join('')}</tbody></table></div>
        <div class="btn-row end" style="margin-top:14px"><button class="btn" id="ob-mois-save">Enregistrer les objectifs mensuels</button></div>
      </div>`;

    const sumBox = document.getElementById('ob-sum');
    const annuel = ca.reduce((a, b) => a + b, 0), objAn = objectifAnnee(annee);
    sumBox.innerHTML = `<div class="kpi" style="box-shadow:none;border:none;padding:0"><div class="value">${S().money(annuel)}</div>
      <div class="sub">sur ${S().money(objAn)} visés · <strong>${pct(annuel, objAn)} %</strong></div>
      <div class="progress"><span style="width:${Math.min(100, pct(annuel, objAn))}%"></span></div></div>
      <p class="help" style="margin-top:14px">${pct(annuel, objAn) >= 100 ? 'Objectif annuel atteint, bravo !' : 'Reste ' + S().money(Math.max(0, objAn - annuel)) + ' à facturer pour atteindre l\'objectif.'}</p>`;

    document.getElementById('ob-save').onclick = () => {
      db.settings.objectif_ca_mensuel = Number(document.getElementById('ob-m').value) || 0;
      db.settings.objectif_ca_annuel = Number(document.getElementById('ob-a').value) || 0;
      UI.commit('Objectifs par défaut enregistrés');
    };
    document.getElementById('ob-mois-save').onclick = () => {
      box.querySelectorAll('[data-mois]').forEach(inp => {
        const mois = Number(inp.dataset.mois);
        const montant = Number(inp.value) || 0;
        db.objectifs = db.objectifs.filter(o => !(o.annee === annee && o.mois === mois));
        if (montant !== (Number(db.settings.objectif_ca_mensuel) || 0)) db.objectifs.push({ id: S().uid(), annee, mois, montant, commercial: db.settings.commercial });
      });
      UI.commit('Objectifs mensuels enregistrés');
    };
  }

  /* ---------- Export comptable (CSV, séparateur ;, décimales à virgule) ---------- */
  function csv(rows) {
    const q = v => {
      const s = v == null ? '' : String(v);
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return rows.map(r => r.map(q).join(';')).join('\r\n');
  }
  const dec = n => (Number(n) || 0).toFixed(2).replace('.', ',');

  function download(name, content) {
    const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function exportCompta(kind, debut, fin) {
    const db = S().db;
    const dans = d => (!debut || d >= debut) && (!fin || d <= fin);
    const clientNom = V().clientNom;
    const today = S().today();
    if (kind === 'ventes') {
      const rows = [['Date', 'N° facture', 'Client', 'Base HT', 'Taux TVA', 'Montant TVA', 'Total TTC', 'Encaissé', 'Reste dû']];
      db.factures.filter(f => dans(f.date)).sort((a, b) => a.date.localeCompare(b.date)).forEach(f => {
        const t = V().totalFacture(f);
        Object.keys(t.tvaDetail).sort().forEach(r => {
          const d = t.tvaDetail[r];
          rows.push([S().dateFr(f.date), f.numero, clientNom(f.client_id), dec(d.base), r + ' %', dec(d.tva), dec(d.base + d.tva), dec(V().totalPaye(f)), dec(V().resteAPayer(f))]);
        });
      });
      download(`export-ventes-${today}.csv`, csv(rows));
    }
    if (kind === 'encaissements') {
      const rows = [['Date', 'N° facture', 'Client', 'Mode', 'Montant']];
      db.factures.forEach(f => (f.paiements || []).filter(p => dans(p.date)).forEach(p => {
        rows.push([S().dateFr(p.date), f.numero, clientNom(f.client_id), p.mode, dec(p.montant)]);
      }));
      download(`export-encaissements-${today}.csv`, csv(rows));
    }
    if (kind === 'achats') {
      const rows = [['Date', 'N° achat', 'Fournisseur', 'Désignation', 'Quantité', 'PU HT', 'Total HT']];
      db.achats.filter(a => dans(a.date)).forEach(a => {
        const f = (db.fournisseurs.find(x => x.id === a.fournisseur_id) || {}).nom || '';
        (a.lignes || []).forEach(l => rows.push([S().dateFr(a.date), a.numero, f, l.designation, dec(l.qte), dec(l.pu), dec((Number(l.qte) || 0) * (Number(l.pu) || 0))]));
      });
      download(`export-achats-${today}.csv`, csv(rows));
    }
    if (kind === 'stock') {
      const rows = [['Réf', 'Désignation', 'Unité', 'Stock', 'Prix achat HT', 'Valeur HT']];
      db.articles.forEach(a => rows.push([a.ref, a.designation, a.unite, dec(a.stock), dec(a.prix_achat), dec((a.stock || 0) * (a.prix_achat || 0))]));
      download(`export-stock-${today}.csv`, csv(rows));
    }
    UI.toast('Fichier téléchargé');
  }

  function exportView(box) {
    const y = new Date().getFullYear();
    const exports = [
      { k: 'ventes', t: 'Journal des ventes', d: 'Factures ligne par ligne, par taux de TVA', primary: true },
      { k: 'encaissements', t: 'Encaissements', d: 'Tous les paiements reçus, avec le mode' },
      { k: 'achats', t: 'Journal des achats', d: 'Lignes des achats fournisseurs' },
      { k: 'stock', t: 'Inventaire du stock', d: 'Quantités et valeur au prix d\'achat' }
    ];
    box.innerHTML = `
      <div class="card">
        <div class="card-head"><div><h2>Période</h2><span class="muted">Laissez vide pour tout exporter</span></div></div>
        <div class="grid grid-form" style="grid-template-columns:repeat(auto-fit,minmax(180px,220px))">
          <div class="field"><label>Du</label><input type="date" id="ex-d" value="${y}-01-01"></div>
          <div class="field"><label>Au</label><input type="date" id="ex-f" value="${y}-12-31"></div>
        </div>
      </div>
      <div class="grid grid-2">
        ${exports.map(e => `<div class="card" style="display:flex;flex-direction:column;gap:10px">
          <div><div style="font-weight:700;color:var(--navy)">${e.t}</div><div class="muted" style="font-size:13px">${e.d}</div></div>
          <div class="btn-row end" style="margin-top:auto"><button class="btn ${e.primary ? 'gold' : 'ghost'}" data-ex="${e.k}">${I('export')} Télécharger CSV</button></div>
        </div>`).join('')}
      </div>
      <div class="card"><div class="card-head"><div><h2>Sauvegarde complète</h2><span class="muted">Toutes vos données, au format JSON</span></div>
        <button class="btn" id="ex-json">Télécharger la sauvegarde</button></div></div>`;
    box.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => exportCompta(b.dataset.ex, document.getElementById('ex-d').value, document.getElementById('ex-f').value));
    document.getElementById('ex-json').onclick = () => S().exportJson();
  }

  UI.register('tableau', { title: 'Tableau de bord', sub: () => new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }), render: tableau });
  UI.register('statistiques', { title: 'Statistiques', sub: 'Activité commerciale de l\'année en cours', render: statistiques });
  UI.register('objectifs', { title: 'Objectifs', sub: 'Suivre le chiffre d\'affaires', render: objectifs });
  UI.register('export', { title: 'Export comptabilité', sub: 'Fichiers pour votre expert-comptable', render: exportView });

  window.Stats = { caParMois, objectifMois, objectifAnnee };
})();

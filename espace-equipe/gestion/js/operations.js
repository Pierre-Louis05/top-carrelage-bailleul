/* Suivi des commandes (tableau), commandes automatiques du stock bas,
   import des tarifs d'usine (Excel / CSV), SMS d'arrivage */
(function () {
  const S = () => window.Store;
  const UI = window.UI;
  const I = UI.icon;
  const esc = UI.esc;
  const V = () => window.Ventes;
  const ST = () => window.Stock;

  const COLS_CLIENT = [
    { k: 'commandée', label: 'À préparer', hint: 'Commandes validées' },
    { k: 'en cours', label: 'En cours', hint: 'En préparation ou en commande fournisseur' },
    { k: 'livrée', label: 'Livrées', hint: 'À facturer' },
    { k: 'facturée', label: 'Facturées', hint: 'Dossier terminé' }
  ];
  const COLS_ACHAT = [
    { k: 'commande', label: 'Commandé', hint: 'Bon envoyé à l\'usine' },
    { k: 'expédié', label: 'Expédié', hint: 'En route, arrivée attendue' },
    { k: 'reçu', label: 'Reçu', hint: 'En stock, surveiller le délai de stockage' }
  ];

  const fournisseurNom = id => (S().db.fournisseurs.find(f => f.id === id) || {}).nom || '—';
  const clientNom = id => V().clientNom(id);
  const joursDepuis = iso => Math.floor((new Date(S().today() + 'T00:00:00') - new Date(iso + 'T00:00:00')) / 86400000);

  /* ---------- SMS (ouvre l'application SMS du téléphone avec le message prêt) ---------- */
  function lienSms(tel, message) {
    const num = (tel || '').replace(/\s+/g, '');
    return `sms:${num}?body=${encodeURIComponent(message)}`;
  }

  function messageArrivage(a) {
    const s = S().db.settings;
    return `Bonjour, la commande ${a.numero} (${fournisseurNom(a.fournisseur_id)}) est arrivée au magasin ${s.company.name}. ` +
      `Expédiée le ${a.date_envoi ? S().dateFr(a.date_envoi) : '—'}, reçue le ${S().dateFr(a.date_reception || S().today())}. ` +
      `Merci de passer la prendre ou de nous confirmer la livraison.`;
  }

  /* ---------- Tableau de suivi (type « drive ») ---------- */
  function suivi(box) {
    const db = S().db;
    const tab = box.dataset.tab || 'clients';
    const cols = tab === 'clients' ? COLS_CLIENT : COLS_ACHAT;
    const items = tab === 'clients' ? db.commandes : db.achats;
    const statutOf = x => x.statut;
    const enCours = items.filter(x => !['facturée', 'reçu', 'annulée'].includes(x.statut));
    const seuilStock = db.settings.delai_stockage_alerte || 14;
    const montant = x => tab === 'clients' ? V().totalDevis(x).ht : ST().totalAchat(x);
    const retards = tab === 'achats' ? items.filter(a => a.statut === 'reçu' && a.date_reception && joursDepuis(a.date_reception) > seuilStock) : [];

    box.innerHTML = `
      <div class="card" style="padding:12px 16px">
        <div class="card-head" style="margin:0">
          <div class="btn-row">
            <button class="btn ${tab === 'clients' ? '' : 'ghost'}" data-tab="clients">Commandes clients</button>
            <button class="btn ${tab === 'achats' ? '' : 'ghost'}" data-tab="achats">Commandes fournisseurs</button>
          </div>
          <div class="btn-row">
            ${tab === 'achats' ? `<button class="btn gold" id="sv-auto">${I('plus')} Commander le stock bas</button>` : `<a class="btn gold" href="#nouveau-devis-">${I('plus')} Nouveau devis</a>`}
          </div>
        </div>
      </div>
      <div class="grid grid-kpi" style="margin-bottom:18px">
        <div class="card kpi"><div class="label">En cours</div><div class="value">${enCours.length}</div><div class="sub">${S().money(enCours.reduce((s, x) => s + montant(x), 0))} HT</div></div>
        ${tab === 'achats' ? `<div class="card kpi ${retards.length ? 'alert' : 'ok'}"><div class="label">Stock trop ancien</div><div class="value">${retards.length}</div><div class="sub">reçus il y a plus de ${seuilStock} jours</div></div>` : ''}
      </div>
      <div class="kanban">${cols.map(c => {
        const list = items.filter(x => statutOf(x) === c.k).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        return `<section class="kcol">
          <header><div><strong>${esc(c.label)}</strong><small>${esc(c.hint)}</small></div><span class="badge navy">${list.length}</span></header>
          <div class="kbody">${list.length ? list.map(x => {
            const href = tab === 'clients' ? '#commande-' + x.id : '#achat-' + x.id;
            const titre = tab === 'clients' ? clientNom(x.client_id) : fournisseurNom(x.fournisseur_id);
            const extra = tab === 'achats' && x.statut === 'reçu' && x.date_reception
              ? `<span class="badge ${joursDepuis(x.date_reception) > seuilStock ? 'danger' : 'ok'}">en stock ${joursDepuis(x.date_reception)} j</span>`
              : tab === 'achats' && x.statut === 'expédié' && x.date_envoi
                ? `<span class="badge gold">expédié le ${S().dateFr(x.date_envoi)}</span>` : '';
            return `<a class="kcard" href="${href}">
              <div class="kcard-top"><strong>${esc(x.numero)}</strong><span class="muted">${S().dateFr(x.date)}</span></div>
              <div class="kcard-title">${esc(titre)}</div>
              <div class="kcard-bottom"><span>${S().money(montant(x))} HT</span>${extra}</div>
            </a>`;
          }).join('') : `<div class="kempty">Aucune commande</div>`}</div>
        </section>`;
      }).join('')}</div>`;

    box.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { box.dataset.tab = b.dataset.tab; suivi(box); });
    const auto = document.getElementById('sv-auto');
    if (auto) auto.onclick = commandesStockBas;
  }

  /* ---------- Commandes fournisseurs automatiques depuis le stock bas ---------- */
  function commandesStockBas() {
    const db = S().db;
    const bas = db.articles.filter(ST().enAlerte);
    if (!bas.length) { UI.toast('Aucun article en stock bas.'); return; }
    const groupes = {};
    bas.forEach(a => {
      const k = a.fournisseur_id || '';
      (groupes[k] = groupes[k] || []).push(a);
    });
    const lignesHtml = Object.keys(groupes).map(k => `
      <div style="margin-bottom:14px">
        <div class="strong" style="font-weight:700;color:var(--navy);margin-bottom:6px">${esc(k ? fournisseurNom(k) : 'Sans fournisseur (à compléter)')}</div>
        ${groupes[k].map(a => {
          const suggere = Math.max(1, Math.ceil(((Number(a.stock_alerte) || 0) * 2) - (Number(a.stock) || 0)));
          return `<div class="list-item"><div style="flex:1"><div>${esc(a.designation)}</div><small class="muted">stock ${S().num(a.stock)} ${esc(a.unite)} · seuil ${S().num(a.stock_alerte)}</small></div>
            <div class="field" style="width:110px"><input type="number" min="0" step="1" data-q="${a.id}" value="${suggere}" aria-label="Quantité à commander"></div></div>`;
        }).join('')}
      </div>`).join('');
    UI.modal('Commander le stock bas', `<p class="muted" style="margin-top:0">Une commande est créée par fournisseur. Quantité suggérée : de quoi revenir à deux fois le seuil d'alerte.</p>${lignesHtml}`, [
      { label: 'Annuler', cls: 'ghost', fn: (b, close) => close() },
      { label: 'Créer les commandes', cls: 'gold', fn: (b, close) => {
        Object.keys(groupes).forEach(k => {
          if (!k) return;
          const lignes = groupes[k].map(a => {
            const qte = Number(b.querySelector(`[data-q="${a.id}"]`).value) || 0;
            return { article_id: a.id, designation: a.designation, qte, pu: Number(a.prix_achat) || 0, tva: a.tva || 20 };
          }).filter(l => l.qte > 0);
          if (!lignes.length) return;
          db.achats.push({ id: S().uid(), numero: S().nextNumber('ACH'), date: S().today(), fournisseur_id: k, lignes,
            statut: 'commande', notes: 'Généré depuis le stock bas', remise_pct: 0, date_envoi: '', date_reception: '' });
        });
        close();
        UI.commit('Commandes fournisseurs créées');
        UI.go('suivi');
      } }
    ], { wide: true });
  }

  /* ---------- Import des tarifs d'usine (Excel ou CSV) ---------- */
  const COL_MATCH = {
    ref: /^(r[ée]f|ref|code|article|n°|sku)/i,
    designation: /(d[ée]signation|libell[ée]|produit|description|nom)/i,
    prix_achat: /(prix.*(achat|net|usine|tarif|pu)|^pu|^tarif|^net|^px)/i,
    prix_vente: /(prix.*(vente|public|ttc|ht)|pvc)/i,
    unite: /^(unit[ée]|u$|uv)/i,
    tva: /^tva/i
  };

  function parseCsv(text) {
    const sep = (text.split('\n')[0].match(/;/g) || []).length >= (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    return text.split(/\r?\n/).filter(l => l.trim()).map(line => {
      const out = []; let cur = '', q = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
        else if (c === sep && !q) { out.push(cur); cur = ''; }
        else cur += c;
      }
      out.push(cur);
      return out.map(s => s.trim());
    });
  }

  function loadXlsx() {
    return new Promise((resolve, reject) => {
      if (window.XLSX) return resolve(window.XLSX);
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = () => resolve(window.XLSX);
      s.onerror = () => reject(new Error('Module Excel indisponible : enregistrez le tarif en CSV puis réessayez.'));
      document.head.appendChild(s);
    });
  }

  function detectHeader(rows) {
    let best = { idx: 0, score: -1 };
    rows.slice(0, 15).forEach((r, idx) => {
      const score = r.filter(c => String(c).trim()).length + Object.values(COL_MATCH).filter(re => r.some(c => re.test(String(c).trim()))).length * 3;
      if (score > best.score) best = { idx, score };
    });
    const header = rows[best.idx].map(c => String(c || '').trim());
    const map = {};
    Object.keys(COL_MATCH).forEach(key => {
      const i = header.findIndex(h => COL_MATCH[key].test(h));
      if (i >= 0) map[key] = i;
    });
    return { start: best.idx + 1, map, header };
  }

  function importModal() {
    const db = S().db;
    const html = `
      <div class="grid grid-form" style="grid-template-columns:1fr 1fr">
        <div class="field"><label>Fournisseur (usine) *</label><select id="im-f">${UI.options(db.fournisseurs, '', f => f.nom, '— choisir —')}</select></div>
        <div class="field"><label>Fichier (Excel .xlsx ou CSV)</label><input type="file" id="im-file" accept=".xlsx,.xls,.csv"></div>
      </div>
      <p class="help">Le logiciel reconnaît les colonnes : référence, désignation, prix d'achat, prix de vente, unité et TVA. Vous vérifiez l'aperçu avant d'importer. Les articles déjà connus (même référence et même fournisseur) sont mis à jour, sans toucher au stock.</p>
      <div id="im-preview"></div>`;
    let parsed = null;
    const m = UI.modal('Importer un tarif d\'usine', html, [
      { label: 'Annuler', cls: 'ghost', fn: (b, close) => close() },
      { label: 'Importer', cls: 'gold', fn: (b, close) => {
        const fid = b.querySelector('#im-f').value;
        if (!fid || !parsed || !parsed.items.length) { UI.toast('Choisissez le fournisseur et un fichier valide.', true); return; }
        let crees = 0, maj = 0;
        parsed.items.forEach(it => {
          const existant = db.articles.find(a => a.ref === it.ref && a.fournisseur_id === fid);
          if (existant) {
            Object.assign(existant, { designation: it.designation || existant.designation, prix_achat: it.prix_achat ?? existant.prix_achat,
              prix_vente: it.prix_vente ?? existant.prix_vente, unite: it.unite || existant.unite, tva: it.tva || existant.tva });
            maj++;
          } else {
            db.articles.push({ id: S().uid(), ref: it.ref, designation: it.designation, unite: it.unite || 'pce', prix_achat: it.prix_achat || 0,
              prix_vente: it.prix_vente || 0, tva: it.tva || db.settings.default_tva, stock: 0, stock_alerte: 0, fournisseur_id: fid, emplacement: '' });
            crees++;
          }
        });
        close();
        UI.commit(`Tarif importé : ${crees} nouveau(x), ${maj} mis à jour`);
      } }
    ], { wide: true });

    m.body.querySelector('#im-file').onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const prev = m.body.querySelector('#im-preview');
      prev.innerHTML = '<p class="muted">Lecture du fichier…</p>';
      try {
        let rows;
        if (/\.csv$/i.test(f.name)) rows = parseCsv(await f.text());
        else {
          const XLSX = await loadXlsx();
          const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
          rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }).map(r => r.map(c => String(c)));
        }
        const { start, map, header } = detectHeader(rows);
        if (map.ref === undefined || map.designation === undefined) {
          prev.innerHTML = `<div class="empty"><strong>Colonnes non reconnues</strong>Il faut au moins une colonne référence et une colonne désignation. Colonnes trouvées : ${esc(header.filter(Boolean).join(', '))}</div>`;
          return;
        }
        const num = v => { const n = parseFloat(String(v).replace(/\s/g, '').replace('€', '').replace(',', '.')); return isNaN(n) ? undefined : n; };
        const items = rows.slice(start).map(r => ({
          ref: String(r[map.ref] || '').trim(),
          designation: String(r[map.designation] || '').trim(),
          prix_achat: map.prix_achat !== undefined ? num(r[map.prix_achat]) : undefined,
          prix_vente: map.prix_vente !== undefined ? num(r[map.prix_vente]) : undefined,
          unite: map.unite !== undefined ? String(r[map.unite] || '').trim() : '',
          tva: map.tva !== undefined ? num(r[map.tva]) : undefined
        })).filter(it => it.ref && it.designation);
        parsed = { items };
        prev.innerHTML = `<div class="card-head" style="margin-top:12px"><h2>Aperçu : ${items.length} article(s)</h2><span class="muted">Colonnes reconnues : ${Object.keys(map).join(', ')}</span></div>
          ${UI.table(items.slice(0, 8), [
            { label: 'Réf.', render: x => esc(x.ref) },
            { label: 'Désignation', render: x => esc(x.designation) },
            { label: 'Prix achat', num: true, render: x => x.prix_achat !== undefined ? S().money(x.prix_achat) : '—' },
            { label: 'Prix vente', num: true, render: x => x.prix_vente !== undefined ? S().money(x.prix_vente) : '—' },
            { label: 'Unité', render: x => esc(x.unite) || '—' }
          ])}${items.length > 8 ? `<p class="muted">… et ${items.length - 8} autres lignes</p>` : ''}`;
      } catch (err) {
        prev.innerHTML = `<div class="empty"><strong>Lecture impossible</strong>${esc(err.message)}</div>`;
      }
    };
  }

  /* ---------- Route ---------- */
  UI.register('suivi', { title: 'Suivi des commandes', sub: 'Tableau de toutes les commandes en cours', render: suivi });

  window.Ops = { importModal, commandesStockBas, lienSms, messageArrivage, joursDepuis, COLS_ACHAT };
})();

/* Devis, commandes, factures, paiements */
(function () {
  const S = () => window.Store;
  const UI = window.UI;
  const esc = UI.esc;
  const I = UI.icon;

  /* ---------- Calculs ---------- */
  const totalDevis = (d) => S().lineTotals(d.lignes, d.remise_pct);
  const totalFacture = (f) => S().lineTotals(f.lignes, f.remise_pct);
  const totalPaye = (f) => (f.paiements || []).reduce((s, p) => s + (Number(p.montant) || 0), 0);
  const resteAPayer = (f) => Math.max(0, totalFacture(f).ttc - totalPaye(f));

  function statutFacture(f) {
    const reste = resteAPayer(f);
    if (reste <= 0.009) return 'payée';
    if (totalPaye(f) > 0) return 'partielle';
    if (f.date_echeance && f.date_echeance < S().today()) return 'en retard';
    return 'à payer';
  }

  function clientNom(id) {
    const c = S().db.clients.find(x => x.id === id);
    return c ? c.nom : '— client supprimé —';
  }

  function clientSelect(selectedId) {
    const list = S().db.clients.slice().sort((a, b) => a.nom.localeCompare(b.nom));
    return `<div class="btn-row" style="flex-wrap:nowrap;gap:8px">
      <select name="client_id" style="flex:1;min-width:0">${UI.options(list, selectedId, c => c.nom, list.length ? '— choisir un client —' : '— aucun client encore —')}</select>
      <button type="button" class="btn ghost" data-newclient title="Créer un nouveau client" style="padding:0 12px">${I('plus')}<span class="hide-sm">Client</span></button>
    </div>`;
  }

  /* Bouton « + Client » : ajoute le client à la liste et le sélectionne, sans quitter le devis */
  function bindNewClient(root) {
    const btn = root.querySelector('[data-newclient]');
    if (!btn) return;
    btn.onclick = () => window.Clients.quickClient(c => {
      const sel = root.querySelector('[name="client_id"]');
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.nom; opt.selected = true;
      const all = Array.from(sel.options).filter(o => o.value);
      all.push(opt);
      all.sort((a, b) => a.textContent.localeCompare(b.textContent));
      const placeholder = sel.options[0];
      sel.innerHTML = '';
      sel.appendChild(placeholder);
      all.forEach(o => sel.appendChild(o));
      sel.value = c.id;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  /* Marge calculée à partir des prix internes : affichée uniquement dans le logiciel */
  function margeHtml(lignes) {
    const avecInterne = lignes.filter(l => l.pu_interne !== undefined && l.pu_interne !== null && l.pu_interne !== '');
    if (!avecInterne.length) return '';
    const marge = lignes.reduce((s, l) => {
      const net = (Number(l.pu) || 0) * (1 - (Number(l.remise_pct) || 0) / 100);
      const interne = (l.pu_interne === '' || l.pu_interne == null) ? net : Number(l.pu_interne);
      return s + (Number(l.qte) || 0) * (net - interne);
    }, 0);
    return `<div class="internal-note">Privé, visible par vous seulement : marge sur prix internes ${S().money(marge)}</div>`;
  }

  /* Bandeau de suivi d'une vente : Devis → Commande → Facture → Encaissement */
  function pipeline(stage, links) {
    const steps = [
      { k: 'Devis', href: links.devis },
      { k: 'Commande', href: links.commande },
      { k: 'Facture', href: links.facture },
      { k: 'Encaissement', href: links.facture }
    ];
    return `<div class="pipeline">${steps.map((s, i) => {
      const cls = i < stage ? 'done' : i === stage ? 'current' : 'todo';
      const inner = `<span class="dot">${i < stage ? I('check') : (i + 1)}</span><span>${s.k}</span>`;
      return `<div class="pstep ${cls}">${s.href && i <= stage ? `<a href="${s.href}">${inner}</a>` : inner}</div>`;
    }).join('')}</div>`;
  }

  /* Totaux HT / TVA / TTC affichés sous les lignes */
  function totalsHtml(t) {
    const tva = Object.keys(t.tvaDetail).sort().map(r =>
      `<div class="row"><span>TVA ${r} % sur ${S().money(t.tvaDetail[r].base)}</span><span>${S().money(t.tvaDetail[r].tva)}</span></div>`).join('');
    const remises = (t.remiseLignes || 0) + (t.remise || 0);
    return `<div class="totals">
      <div class="row"><span>Montant brut</span><span>${S().money(t.brut)}</span></div>
      ${remises > 0.005 ? `<div class="row"><span>Remises</span><span>- ${S().money(remises)}</span></div>` : ''}
      <div class="row"><span><strong>Montant net HT</strong></span><span><strong>${S().money(t.ht)}</strong></span></div>
      ${tva}
      <div class="row grand"><span>Total TTC</span><span>${S().money(t.ttc)}</span></div>
    </div>`;
  }

  /* Barre d'action collante + suivi des modifications */
  function bindDirty(root, bar) {
    const dirty = bar.querySelector('.dirty');
    const mark = () => { dirty.classList.add('on'); dirty.textContent = 'Modifications non enregistrées'; };
    root.addEventListener('input', mark);
    root.addEventListener('change', mark);
  }

  /* Liste avec filtre de statut + recherche */
  function listPage(box, cfg) {
    const state = { q: '', statut: 'tous', commercial: 'tous' };
    const statuts = ['tous'].concat(cfg.statuts);
    const C = () => window.Commerciaux;

    // Un document sans commercial reste visible quand on filtre sur « Non
    // attribué » : c'est justement ceux-la qu'on cherche a retrouver.
    const garderCommercial = (x) => {
      if (state.commercial === 'tous') return true;
      const id = C() ? C().duDocument(x) : (x.commercial_id || '');
      return state.commercial === 'aucun' ? !id : id === state.commercial;
    };
    const retenus = () => cfg.items().filter(x =>
      (state.statut === 'tous' || cfg.statutOf(x) === state.statut) && garderCommercial(x));

    // Quand un filtre cache tout, dire « créez votre premier devis » est faux
    // et deroutant : il en existe, ils sont juste masques.
    const vide = () => (state.statut !== 'tous' || state.commercial !== 'tous' || state.q)
      && cfg.items().length
      ? { title: 'Rien ne correspond à ce filtre',
          text: 'Changez de statut, de commercial, ou videz la recherche.' }
      : cfg.empty;

    function draw() {
      const q = state.q.toLowerCase();
      const items = retenus().filter(x => (!q || (cfg.searchText(x)).toLowerCase().includes(q)))
        .sort((a, b) => (b.numero || '').localeCompare(a.numero || ''));
      const counts = {};
      cfg.items().forEach(x => { const s = cfg.statutOf(x); counts[s] = (counts[s] || 0) + 1; });
      box.innerHTML = `
        ${cfg.kpis ? `<div class="grid grid-kpi" style="margin-bottom:18px">${cfg.kpis().map(k => `
          <div class="card kpi ${k.cls || ''}"><div class="label">${esc(k.label)}</div><div class="value">${k.value}</div>${k.sub ? `<div class="sub">${k.sub}</div>` : ''}</div>`).join('')}</div>` : ''}
        <div class="card">
          <div class="card-head">
            <div class="btn-row" id="chips">
              ${statuts.map(s => `<button class="btn ${state.statut === s ? '' : 'ghost'} small" data-statut="${esc(s)}">${esc(s === 'tous' ? 'Tous' : s)} <span class="muted">${s === 'tous' ? cfg.items().length : (counts[s] || 0)}</span></button>`).join('')}
            </div>
            <div class="btn-row">
              ${(C() && C().actifs().length) ? `<select id="filtre-commercial" class="filtre-commercial">
                <option value="tous">Tous les commerciaux</option>
                <option value="aucun" ${state.commercial === 'aucun' ? 'selected' : ''}>Non attribué</option>
                ${C().actifs().map(c => `<option value="${c.id}" ${state.commercial === c.id ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}
              </select>` : ''}
              ${UI.searchBox('Rechercher…', state.q)}
              ${cfg.newRoute ? `<a class="btn gold" href="#${cfg.newRoute}">${I('plus')} ${esc(cfg.newLabel)}</a>` : ''}
            </div>
          </div>
          <div id="list-body">${UI.table(items, cfg.cols, vide())}</div>
        </div>`;
      box.querySelectorAll('[data-statut]').forEach(b => b.onclick = () => { state.statut = b.dataset.statut; draw(); });
      const selC = box.querySelector('#filtre-commercial');
      if (selC) selC.onchange = () => { state.commercial = selC.value; draw(); };
      UI.bindSearch(box, v => { state.q = v; const body = box.querySelector('#list-body'); body.innerHTML = UI.table(
        retenus().filter(x => (!v || cfg.searchText(x).toLowerCase().includes(v.toLowerCase())))
          .sort((a, b) => (b.numero || '').localeCompare(a.numero || '')), cfg.cols, vide()); });
    }
    draw();
  }

  /* ---------- DEVIS ---------- */
  function listeDevis(box) {
    const db = S().db;
    listPage(box, {
      items: () => db.devis,
      statuts: ['brouillon', 'envoyé', 'accepté', 'refusé'],
      statutOf: d => d.statut,
      searchText: d => d.numero + ' ' + clientNom(d.client_id),
      newRoute: 'nouveau-devis-', newLabel: 'Nouveau devis',
      kpis: () => {
        const envoyes = db.devis.filter(d => d.statut === 'envoyé');
        const acceptes = db.devis.filter(d => d.statut === 'accepté' || d.commande_id);
        const taux = db.devis.length ? Math.round(acceptes.length / db.devis.length * 100) : 0;
        return [
          { label: 'En attente de réponse', value: S().money(envoyes.reduce((s, d) => s + totalDevis(d).ht, 0)), sub: `${envoyes.length} devis envoyé(s)` },
          { label: 'Devis acceptés', value: acceptes.length, sub: `${S().money(acceptes.reduce((s, d) => s + totalDevis(d).ht, 0))} HT`, cls: 'ok' },
          { label: 'Taux de transformation', value: taux + ' %', sub: `sur ${db.devis.length} devis` }
        ];
      },
      cols: [
        { label: 'N°', render: d => `<a class="link" href="#devis-${d.id}">${esc(d.numero)}</a><small>${S().dateFr(d.date)}</small>` },
        { label: 'Client', render: d => esc(clientNom(d.client_id)) },
        { label: 'Commercial', render: d => { const C = window.Commerciaux; const n = C ? C.nom(C.duDocument(d)) : ''; return n ? esc(n) : '<span class="muted">non attribué</span>'; } },
        { label: 'Statut', render: d => UI.badge(d.statut) },
        { label: 'Total TTC', num: true, cls: 'strong', render: d => S().money(totalDevis(d).ttc) }
      ],
      empty: { title: 'Aucun devis pour le moment', text: 'Créez votre premier devis en quelques clics.', action: `<br><a class="btn gold" href="#nouveau-devis-">${I('plus')} Nouveau devis</a>` }
    });
  }

  function editDevis(box, id, clientPreset) {
    const db = S().db;
    const isNew = !id;
    const d = isNew
      ? { id: S().uid(), date: S().today(), client_id: clientPreset || '', lignes: [], remise_pct: 0, statut: 'brouillon', notes: '' }
      : db.devis.find(x => x.id === id);
    if (!d) { box.innerHTML = '<div class="card"><div class="empty"><strong>Devis introuvable</strong></div></div>'; return; }
    const lignes = d.lignes;
    if (isNew && !lignes.length) lignes.push({ article_id: '', designation: '', qte: 1, pu: 0, remise_pct: 0, tva: db.settings.default_tva });
    const locked = d.statut === 'accepté' && !isNew && !!d.commande_id;

    box.innerHTML = `
      ${isNew ? '' : pipeline(d.commande_id ? 1 : 0, { devis: '#devis-' + d.id, commande: d.commande_id ? '#commande-' + d.commande_id : '' })}
      <div class="card">
        <div class="grid grid-form">
          <div class="field"><label>Client *</label>${clientSelect(d.client_id)}</div>
          <div class="field"><label>Date</label><input type="date" name="date" value="${d.date}"></div>
          <div class="field"><label>Statut</label>
            <select name="statut">${['brouillon', 'envoyé', 'accepté', 'refusé', 'expiré'].map(s => `<option ${d.statut === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
          <div class="field"><label>Remise globale (%)</label><input type="number" min="0" max="100" step="0.5" name="remise_pct" value="${d.remise_pct || 0}"></div>
          <div class="field"><label>Commercial</label>${window.Commerciaux ? window.Commerciaux.select(d.commercial_id || (isNew ? window.Commerciaux.duDocument(d) : '')) : ''}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Lignes du devis</h2><span class="muted">Un prix d'article se remplit automatiquement</span></div>
        <div id="lines"></div>
        <div id="totals" style="margin-top:14px"></div>
      </div>
      <div class="card">
        <div class="field"><label>Notes et conditions</label><textarea name="notes">${esc(d.notes)}</textarea></div>
      </div>
      <div class="savebar">
        <div class="btn-row">
          <a class="btn ghost" href="#devis">${I('back')} Retour</a>
          ${isNew ? '' : `<a class="btn ghost" href="#apercu-devis:${d.id}">${I('print')} Aperçu / PDF</a>`}
          ${isNew ? '' : `<button class="btn ghost danger" id="dv-del">${I('trash')} Supprimer</button>`}
        </div>
        <div class="btn-row">
          <span class="dirty"></span>
          ${!isNew && d.statut === 'brouillon' ? `<button class="btn ghost" id="dv-sent">Marquer envoyé et imprimer</button>` : ''}
          ${!isNew && d.statut === 'envoyé' ? `<button class="btn ghost" id="dv-acc">Client a accepté</button>` : ''}
          ${!isNew && d.statut === 'accepté' && !d.commande_id ? `<button class="btn gold" id="dv-cmd">Transformer en commande</button>` : ''}
          ${d.commande_id ? `<a class="btn ghost" href="#commande-${d.commande_id}">Voir la commande</a>` : ''}
          <button class="btn" id="dv-save">${I('check')} Enregistrer</button>
        </div>
      </div>`;

    const bar = box.querySelector('.savebar');
    const refreshTotals = () => {
      const remise = Number(box.querySelector('[name="remise_pct"]').value) || 0;
      document.getElementById('totals').innerHTML = `<div style="display:flex;justify-content:flex-end">${totalsHtml(S().lineTotals(lignes, remise))}</div>`;
    };
    UI.lineEditor(document.getElementById('lines'), lignes, { interne: true, onChange: () => { refreshTotals(); bar.querySelector('.dirty').textContent = 'Modifications non enregistrées'; bar.querySelector('.dirty').classList.add('on'); } });
    refreshTotals();
    box.querySelector('[name="remise_pct"]').addEventListener('input', refreshTotals);

    // Changer de client propose le commercial qui le suit, sauf si on en a
    // deja choisi un a la main : le choix explicite prime toujours.
    const selClient = box.querySelector('[name="client_id"]');
    const selCommercial = box.querySelector('[name="commercial_id"]');
    if (selClient && selCommercial) {
      selClient.addEventListener('change', () => {
        if (selCommercial.value) return;
        const cl = db.clients.find(x => x.id === selClient.value);
        if (cl && cl.commercial_id) selCommercial.value = cl.commercial_id;
      });
    }
    bindDirty(box.querySelector('.card'), bar);

    function readHeader() {
      d.client_id = box.querySelector('[name="client_id"]').value;
      d.date = box.querySelector('[name="date"]').value;
      d.statut = box.querySelector('[name="statut"]').value;
      d.remise_pct = Number(box.querySelector('[name="remise_pct"]').value) || 0;
      d.notes = box.querySelector('[name="notes"]').value;
      const selCom = box.querySelector('[name="commercial_id"]');
      if (selCom) d.commercial_id = selCom.value;
    }
    document.getElementById('dv-save').onclick = () => {
      readHeader();
      if (!d.client_id) { UI.toast('Choisissez un client.', true); return; }
      for (let i = lignes.length - 1; i >= 0; i--) if (!(lignes[i].designation || '').trim()) lignes.splice(i, 1);
      if (!lignes.length) { UI.toast('Ajoutez au moins une ligne avec une désignation.', true); return; }
      if (isNew) { d.numero = S().nextNumber('DEV'); db.devis.push(d); }
      UI.commit(isNew ? 'Devis créé' : 'Devis enregistré');
      if (isNew) UI.go('devis-' + d.id);
    };
    bindNewClient(box);
    if (!isNew) {
      const setStatut = (statut, after) => {
        readHeader();
        if (!d.client_id || !lignes.length) { UI.toast('Complétez le client et au moins une ligne.', true); return; }
        d.statut = statut;
        S().save();
        if (after) after();
        else UI.commit('Devis : ' + statut);
      };
      const sentBtn = document.getElementById('dv-sent');
      if (sentBtn) sentBtn.onclick = () => setStatut('envoyé', () => { UI.toast('Devis marqué envoyé'); UI.go('apercu-devis:' + d.id); });
      const accBtn = document.getElementById('dv-acc');
      if (accBtn) accBtn.onclick = () => setStatut('accepté', () => UI.commit('Devis accepté, vous pouvez le transformer en commande'));
      document.getElementById('dv-del').onclick = () => UI.confirmBox('Supprimer ce devis ? Cette action est définitive.', () => {
        S().db.devis = S().db.devis.filter(x => x.id !== d.id); UI.commit('Devis supprimé'); UI.go('devis');
      });
      const cmdBtn = document.getElementById('dv-cmd');
      if (cmdBtn) cmdBtn.onclick = () => { readHeader(); S().save(); creerCommande(d); };
    }
    if (locked) box.querySelectorAll('input,select,textarea').forEach(el => el.disabled = true);
  }

  function creerCommande(devis) {
    const cmd = {
      id: S().uid(), numero: S().nextNumber('CMD'), date: S().today(), client_id: devis.client_id,
      devis_id: devis.id, lignes: JSON.parse(JSON.stringify(devis.lignes)), remise_pct: devis.remise_pct || 0,
      commercial_id: window.Commerciaux ? window.Commerciaux.duDocument(devis) : (devis.commercial_id || ''),
      statut: 'commandée', date_livraison: '', notes: devis.notes, facture_id: null, stock_sorti: false
    };
    S().db.commandes.push(cmd);
    devis.commande_id = cmd.id;
    devis.statut = 'accepté';
    UI.commit('Commande ' + cmd.numero + ' créée');
    UI.go('commande-' + cmd.id);
  }

  /* ---------- COMMANDES ---------- */
  function listeCommandes(box) {
    const db = S().db;
    listPage(box, {
      items: () => db.commandes,
      statuts: ['commandée', 'en cours', 'livrée', 'facturée', 'annulée'],
      statutOf: c => c.statut,
      searchText: c => c.numero + ' ' + clientNom(c.client_id),
      kpis: () => {
        const aFacturer = db.commandes.filter(c => !c.facture_id && c.statut !== 'annulée');
        return [
          { label: 'À facturer', value: S().money(aFacturer.reduce((s, c) => s + totalDevis(c).ht, 0)), sub: `${aFacturer.length} commande(s)`, cls: aFacturer.length ? 'alert' : '' },
          { label: 'Commandes en cours', value: db.commandes.filter(c => ['commandée', 'en cours'].includes(c.statut)).length }
        ];
      },
      cols: [
        { label: 'N°', render: c => `<a class="link" href="#commande-${c.id}">${esc(c.numero)}</a><small>${S().dateFr(c.date)}</small>` },
        { label: 'Client', render: c => esc(clientNom(c.client_id)) },
        { label: 'Livraison', render: c => c.date_livraison ? S().dateFr(c.date_livraison) : '<span class="muted">—</span>' },
        { label: 'Statut', render: c => UI.badge(c.statut) },
        { label: 'Total TTC', num: true, cls: 'strong', render: c => S().money(totalDevis(c).ttc) }
      ],
      empty: { title: 'Aucune commande', text: 'Une commande naît d\'un devis accepté.' }
    });
  }

  function editCommande(box, id) {
    const db = S().db;
    const c = db.commandes.find(x => x.id === id);
    if (!c) { box.innerHTML = '<div class="card"><div class="empty"><strong>Commande introuvable</strong></div></div>'; return; }
    box.innerHTML = `
      ${pipeline(c.facture_id ? 2 : 1, { devis: c.devis_id ? '#devis-' + c.devis_id : '', commande: '#commande-' + c.id, facture: c.facture_id ? '#facture-' + c.facture_id : '' })}
      <div class="card">
        <div class="grid grid-form">
          <div class="field"><label>Client</label><div class="strong" style="padding:9px 0;font-weight:650;color:var(--navy)">${esc(clientNom(c.client_id))}</div></div>
          <div class="field"><label>Date</label><input type="date" name="date" value="${c.date}"></div>
          <div class="field"><label>Livraison prévue</label><input type="date" name="date_livraison" value="${c.date_livraison || ''}"></div>
          <div class="field"><label>Statut</label>
            <select name="statut">${['commandée', 'en cours', 'livrée', 'facturée', 'annulée'].map(s => `<option ${c.statut === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
          <div class="field"><label>Commercial</label>${window.Commerciaux ? window.Commerciaux.select(window.Commerciaux.duDocument(c)) : ''}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Lignes</h2></div>
        <div id="lines"></div>
        <div id="totals" style="display:flex;justify-content:flex-end;margin-top:14px"></div>
      </div>
      <div class="card"><div class="field"><label>Notes</label><textarea name="notes">${esc(c.notes)}</textarea></div></div>
      <div class="savebar">
        <div class="btn-row">
          <a class="btn ghost" href="#commandes">${I('back')} Retour</a>
          ${c.devis_id ? `<a class="btn ghost" href="#devis-${c.devis_id}">Devis d'origine</a>` : ''}
        </div>
        <div class="btn-row">
          <span class="dirty"></span>
          ${c.facture_id ? `<a class="btn ghost" href="#facture-${c.facture_id}">Voir la facture</a>` : `<button class="btn gold" id="cm-fact">Créer la facture</button>`}
          <button class="btn" id="cm-save">${I('check')} Enregistrer</button>
        </div>
      </div>`;
    const bar = box.querySelector('.savebar');
    const refresh = () => { document.getElementById('totals').innerHTML = totalsHtml(S().lineTotals(c.lignes, c.remise_pct)) + margeHtml(c.lignes); };
    UI.lineEditor(document.getElementById('lines'), c.lignes, { interne: true, onChange: () => { refresh(); bar.querySelector('.dirty').classList.add('on'); bar.querySelector('.dirty').textContent = 'Modifications non enregistrées'; } });
    refresh();
    bindDirty(box.querySelector('.card'), bar);

    function save() {
      c.date = box.querySelector('[name="date"]').value;
      c.date_livraison = box.querySelector('[name="date_livraison"]').value;
      c.statut = box.querySelector('[name="statut"]').value;
      c.notes = box.querySelector('[name="notes"]').value;
      const selCom = box.querySelector('[name="commercial_id"]');
      if (selCom) c.commercial_id = selCom.value;
    }
    document.getElementById('cm-save').onclick = () => { save(); UI.commit('Commande enregistrée'); };
    const fb = document.getElementById('cm-fact');
    if (fb) fb.onclick = () => {
      save();
      if (!c.lignes.length) { UI.toast('La commande n\'a aucune ligne.', true); return; }
      creerFacture(c);
    };
  }

  /* Facture créée depuis une commande : sortie de stock automatique, une seule fois */
  function creerFacture(cmd) {
    const db = S().db;
    const f = {
      id: S().uid(), numero: S().nextNumber('FAC'), date: S().today(), date_echeance: S().addDays(S().today(), 30),
      client_id: cmd.client_id, commande_id: cmd.id, lignes: JSON.parse(JSON.stringify(cmd.lignes)),
      remise_pct: cmd.remise_pct || 0, paiements: [], notes: cmd.notes || '',
      commercial_id: window.Commerciaux ? window.Commerciaux.duDocument(cmd) : (cmd.commercial_id || '')
    };
    db.factures.push(f);
    cmd.facture_id = f.id;
    cmd.statut = 'facturée';
    if (!cmd.stock_sorti) {
      f.lignes.forEach(l => { if (l.article_id) window.Stock.mouvement(l.article_id, -(Number(l.qte) || 0), 'Vente', f.numero); });
      cmd.stock_sorti = true;
    }
    UI.commit('Facture ' + f.numero + ' créée');
    UI.go('facture-' + f.id);
  }

  /* ---------- FACTURES ---------- */
  function listeFactures(box) {
    const db = S().db;
    listPage(box, {
      items: () => db.factures,
      statuts: ['à payer', 'partielle', 'en retard', 'payée'],
      statutOf: statutFacture,
      searchText: f => f.numero + ' ' + clientNom(f.client_id),
      kpis: () => {
        const total = db.factures.reduce((s, f) => s + totalFacture(f).ttc, 0);
        const reste = db.factures.reduce((s, f) => s + resteAPayer(f), 0);
        const retard = db.factures.filter(f => statutFacture(f) === 'en retard');
        return [
          { label: 'Total facturé TTC', value: S().money(total) },
          { label: 'Reste à encaisser', value: S().money(reste), cls: reste > 0 ? '' : 'ok' },
          { label: 'En retard', value: S().money(retard.reduce((s, f) => s + resteAPayer(f), 0)), sub: `${retard.length} facture(s)`, cls: retard.length ? 'alert' : '' }
        ];
      },
      cols: [
        { label: 'N°', render: f => `<a class="link" href="#facture-${f.id}">${esc(f.numero)}</a><small>${S().dateFr(f.date)}</small>` },
        { label: 'Client', render: f => esc(clientNom(f.client_id)) },
        { label: 'Échéance', render: f => S().dateFr(f.date_echeance) },
        { label: 'Commercial', render: f => { const C = window.Commerciaux; const n = C ? C.nom(C.duDocument(f)) : ''; return n ? esc(n) : '<span class="muted">non attribué</span>'; } },
        { label: 'Statut', render: f => UI.badge(statutFacture(f)) },
        { label: 'Total TTC', num: true, render: f => S().money(totalFacture(f).ttc) },
        { label: 'Reste dû', num: true, cls: 'strong', render: f => S().money(resteAPayer(f)) }
      ],
      empty: { title: 'Aucune facture', text: 'Les factures se créent depuis une commande.' }
    });
  }

  function editFacture(box, id) {
    const db = S().db;
    const f = db.factures.find(x => x.id === id);
    if (!f) { box.innerHTML = '<div class="card"><div class="empty"><strong>Facture introuvable</strong></div></div>'; return; }
    const t = totalFacture(f);
    const paye = totalPaye(f);
    const reste = resteAPayer(f);
    const statut = statutFacture(f);
    const pct = t.ttc ? Math.min(100, Math.round(paye / t.ttc * 100)) : 0;
    box.innerHTML = `
      ${pipeline(statut === 'payée' ? 3 : 2, { devis: '', commande: f.commande_id ? '#commande-' + f.commande_id : '', facture: '#facture-' + f.id })}
      <div class="grid grid-kpi" style="margin-bottom:18px">
        <div class="card kpi"><div class="label">Total TTC</div><div class="value">${S().money(t.ttc)}</div><div class="sub">${S().money(t.ht)} HT</div></div>
        <div class="card kpi ok"><div class="label">Encaissé</div><div class="value">${S().money(paye)}</div><div class="progress"><span style="width:${pct}%"></span></div></div>
        <div class="card kpi ${reste > 0 ? 'alert' : 'ok'}"><div class="label">Reste dû</div><div class="value">${S().money(reste)}</div><div class="sub">${UI.badge(statut)}</div></div>
      </div>
      <div class="card">
        <div class="card-head">
          <div><h2 style="font-size:18px">${esc(f.numero)} · ${esc(clientNom(f.client_id))}</h2>
            <div class="muted">Émise le ${S().dateFr(f.date)}</div></div>
          <div class="btn-row">
            <a class="btn ghost" href="#apercu-facture:${f.id}">${I('print')} Aperçu / PDF</a>
            ${f.commande_id ? `<a class="btn ghost" href="#commande-${f.commande_id}">Commande</a>` : ''}
          </div>
        </div>
        <div class="grid grid-form">
          <div class="field"><label>Date d'échéance</label><input type="date" id="fa-ech" value="${f.date_echeance || ''}"></div>
          <div class="field"><label>Commercial</label>${window.Commerciaux ? window.Commerciaux.select(window.Commerciaux.duDocument(f)) : ''}</div>
        </div>
      </div>
      <div class="grid grid-2">
        <div class="card">
          <div class="card-head"><h2>Encaissements</h2></div>
          <div id="pays"></div>
          <div class="grid grid-form" style="margin-top:14px;align-items:end">
            <div class="field"><label>Date</label><input type="date" id="pay-date" value="${S().today()}"></div>
            <div class="field"><label>Montant (€)</label><input type="number" step="0.01" id="pay-m" value="${reste.toFixed(2)}"></div>
            <div class="field"><label>Mode</label><select id="pay-mode"><option>Virement</option><option>Chèque</option><option>Carte bancaire</option><option>Espèces</option><option>Prélèvement</option></select></div>
            <div class="field"><button class="btn gold" id="pay-add" style="width:100%">Enregistrer</button></div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h2>Récapitulatif</h2></div>
          ${totalsHtml(t)}
          <div class="totals" style="margin-top:10px"><div class="row"><span>Déjà réglé</span><span>- ${S().money(paye)}</span></div><div class="row grand" style="font-size:16px"><span>Reste à payer</span><span>${S().money(reste)}</span></div></div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Lignes facturées</h2></div>
        ${UI.table(f.lignes, [
          { label: 'Désignation', render: l => esc(l.designation) },
          { label: 'Qté', num: true, render: l => S().num(l.qte) },
          { label: 'PU HT', num: true, render: l => S().money(l.pu) },
          { label: 'TVA', render: l => `${l.tva} %` },
          { label: 'Total HT', num: true, cls: 'strong', render: l => S().money((Number(l.qte) || 0) * (Number(l.pu) || 0) * (1 - (Number(l.remise_pct) || 0) / 100)) }
        ], 'Aucune ligne')}
      </div>`;

    function drawPays() {
      document.getElementById('pays').innerHTML = UI.table(f.paiements || [], [
        { label: 'Date', render: p => S().dateFr(p.date) },
        { label: 'Mode', render: p => esc(p.mode) },
        { label: 'Montant', num: true, cls: 'strong', render: p => S().money(p.montant) },
        { label: '', render: p => `<button class="btn ghost small icon" data-delp="${p.id}" aria-label="Supprimer le paiement">${I('trash')}</button>` }
      ], { title: 'Aucun encaissement', text: 'Saisissez un paiement ci-dessous.' });
      document.querySelectorAll('[data-delp]').forEach(b => b.onclick = () => {
        f.paiements = f.paiements.filter(p => p.id !== b.dataset.delp);
        UI.commit('Encaissement supprimé');
      });
    }
    drawPays();
    document.getElementById('fa-ech').onchange = (e) => { f.date_echeance = e.target.value; UI.commit('Échéance mise à jour'); };
    const selComF = box.querySelector('[name="commercial_id"]');
    if (selComF) selComF.onchange = () => { f.commercial_id = selComF.value; UI.commit('Commercial mis à jour'); };
    document.getElementById('pay-add').onclick = () => {
      const m = Number(document.getElementById('pay-m').value);
      if (!m || m <= 0) { UI.toast('Montant invalide.', true); return; }
      f.paiements = f.paiements || [];
      f.paiements.push({ id: S().uid(), date: document.getElementById('pay-date').value, montant: m, mode: document.getElementById('pay-mode').value });
      UI.commit('Encaissement enregistré');
    };
  }

  UI.register('devis', { title: 'Devis', sub: 'Propositions envoyées à vos clients', render: listeDevis });
  UI.register('nouveau-devis-', { title: 'Nouveau devis', sub: 'Ajoutez les lignes, la remise et les conditions', render: (box, id) => editDevis(box, null, id) });
  UI.register('devis-', { title: 'Devis', sub: 'Modifier le devis', render: (box, id) => editDevis(box, id) });
  UI.register('commandes', { title: 'Commandes', sub: 'Devis acceptés, prêts à être livrés et facturés', render: listeCommandes });
  UI.register('commande-', { title: 'Commande', sub: 'Suivi de la commande', render: (box, id) => editCommande(box, id) });
  UI.register('factures', { title: 'Factures', sub: 'Facturation client et encaissements', render: listeFactures });
  UI.register('facture-', { title: 'Facture', sub: 'Paiements et récapitulatif', render: (box, id) => editFacture(box, id) });

  window.Ventes = { totalDevis, totalFacture, totalPaye, resteAPayer, statutFacture, clientNom, creerFacture, totalsHtml };
})();

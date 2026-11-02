/* Socle UI : icônes, navigation, routes, modales, notifications, tableaux, éditeur de lignes */
(function () {
  const S = () => window.Store;
  const esc = (s) => S().escapeHtml(s);
  const views = {};

  /* ---------- Icônes (traits, style cohérent) ---------- */
  const PATHS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    quote: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
    order: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    invoice: '<path d="M4 2h16v20l-3-2-3 2-3-2-3 2-3-2-1 1z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    truck: '<path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    move: '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L23 7H6"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    export: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    print: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.8 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2-1.5 0-2.6-.6-3.1-1.6M12 6v2m0 8v2"/>'
  };
  function icon(name, cls) {
    return `<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || ''}</svg>`;
  }

  /* ---------- Navigation ---------- */
  const NAV = [
    { group: null, items: [{ view: 'tableau', label: 'Tableau de bord', icon: 'dashboard' }] },
    { group: 'Ventes', items: [
      { view: 'suivi', label: 'Suivi des commandes', icon: 'dashboard' },
      { view: 'devis', label: 'Devis', icon: 'quote' },
      { view: 'commandes', label: 'Commandes', icon: 'order' },
      { view: 'factures', label: 'Factures', icon: 'invoice' },
      { view: 'relances', label: 'Relances', icon: 'bell', badge: 'relances' }
    ] },
    { group: 'Contacts', items: [
      { view: 'clients', label: 'Clients', icon: 'users' },
      { view: 'fournisseurs', label: 'Fournisseurs', icon: 'truck' },
      { view: 'commerciaux', label: 'Commerciaux', icon: 'users' },
      { view: 'transporteurs', label: 'Transporteurs', icon: 'truck' }
    ] },
    { group: 'Stock & achats', items: [
      { view: 'articles', label: 'Articles & stock', icon: 'box', badge: 'stock' },
      { view: 'mouvements', label: 'Mouvements', icon: 'move' },
      { view: 'achats', label: 'Achats', icon: 'cart' }
    ] },
    { group: 'Pilotage', items: [
      { view: 'statistiques', label: 'Statistiques', icon: 'chart' },
      { view: 'objectifs', label: 'Objectifs', icon: 'target' },
      { view: 'export', label: 'Export compta', icon: 'export' },
      { view: 'parametres', label: 'Paramètres', icon: 'settings' }
    ] }
  ];

  function renderNav() {
    const db = S().db;
    const counts = {
      relances: db.factures.filter(f => window.Ventes && window.Ventes.resteAPayer(f) > 0.009 && window.Ventes.statutFacture(f) === 'en retard').length,
      stock: db.articles.filter(a => window.Stock && window.Stock.enAlerte(a)).length
    };
    const cur = currentRoute();
    document.getElementById('nav').innerHTML = NAV.map(g => `
      ${g.group ? `<div class="nav-group-title">${g.group}</div>` : ''}
      ${g.items.map(i => {
        const n = i.badge ? counts[i.badge] : 0;
        return `<a data-view="${i.view}" href="#${i.view}" class="${cur === i.view ? 'active' : ''}">${icon(i.icon)}<span>${i.label}</span>${n ? `<span class="nav-badge">${n}</span>` : ''}</a>`;
      }).join('')}`).join('');
  }

  function register(name, def) { views[name] = def; }

  function parseRoute() {
    const h = (location.hash || '#tableau').replace('#', '');
    if (views[h]) return { name: h, id: null, view: views[h] };
    const dynKey = Object.keys(views).filter(k => k.endsWith('-') && h.startsWith(k)).sort((a, b) => b.length - a.length)[0];
    if (dynKey) return { name: dynKey, id: decodeURIComponent(h.slice(dynKey.length)), view: views[dynKey] };
    return { name: 'tableau', id: null, view: views.tableau };
  }
  function currentRoute() { return parseRoute().name; }
  function go(name) { if (location.hash === '#' + name) render(); else location.hash = name; }

  function render() {
    // Les panneaux de suggestions d'article vivent dans le body pour echapper
    // au defilement du tableau. Changer d'ecran ne les emporte donc pas : on
    // les retire ici, sinon ils s'accumulent a chaque devis ouvert.
    document.querySelectorAll('body > .ar-inline').forEach(x => x.remove());
    const route = parseRoute();
    const view = route.view;
    const title = typeof view.title === 'function' ? view.title(route.id) : view.title;
    document.title = title + ' — Top Aménagement';
    document.getElementById('page-title').textContent = title;
    document.getElementById('page-sub').textContent = view.sub ? (typeof view.sub === 'function' ? view.sub(route.id) : view.sub) : '';
    renderNav();
    const box = document.getElementById('page');
    box.innerHTML = '';
    try {
      view.render(box, route.id);
    } catch (e) {
      console.error(e);
      box.innerHTML = `<div class="card"><div class="empty"><strong>Un problème est survenu sur cette page</strong>${esc(e.message)}</div></div>`;
    }
    document.getElementById('sidebar').classList.remove('open');
    document.body.classList.remove('nav-open');
    window.scrollTo({ top: 0 });
  }

  /* ---------- Notifications ---------- */
  function toast(msg, isError) {
    const wrap = document.getElementById('toasts');
    const t = document.createElement('div');
    t.className = 'toast' + (isError ? ' error' : '');
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2800);
  }

  /* ---------- Modales ---------- */
  function modal(title, content, buttons, opts) {
    opts = opts || {};
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="modal ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <h3>${esc(title)}</h3>
      <div class="modal-body"></div>
      <div class="modal-actions"></div>
    </div>`;
    const body = ov.querySelector('.modal-body');
    if (typeof content === 'string') body.innerHTML = content; else body.appendChild(content);
    const actions = ov.querySelector('.modal-actions');
    const close = () => { document.removeEventListener('keydown', onKey); ov.remove(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    (buttons || [{ label: 'Fermer', cls: 'ghost', fn: close }]).forEach(b => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn ' + (b.cls || '');
      btn.textContent = b.label;
      btn.onclick = () => b.fn(body, close);
      actions.appendChild(btn);
    });
    ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
    document.body.appendChild(ov);
    const first = body.querySelector('input,select,textarea');
    if (first) setTimeout(() => first.focus(), 30);
    return { close, body };
  }

  function confirmBox(message, onYes, label) {
    modal('Confirmer l\'action', `<p>${esc(message)}</p>`, [
      { label: 'Annuler', cls: 'ghost', fn: (b, close) => close() },
      { label: label || 'Supprimer', cls: 'solid-danger', fn: (b, close) => { close(); onYes(); } }
    ]);
  }

  /* ---------- Sauvegarde + rafraîchissement ---------- */
  function commit(msg) {
    const ok = S().save();
    if (!ok) toast('Sauvegarde impossible : exportez vos données depuis Paramètres.', true);
    else if (msg) toast(msg);
    render();
  }

  /* Sauvegarde sans re-rendu complet (saisie en continu) */
  function saveQuiet() { return S().save(); }

  function debounce(fn, ms) {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms || 200); };
  }

  function options(list, selectedId, labelFn, emptyLabel) {
    let html = emptyLabel ? `<option value="">${esc(emptyLabel)}</option>` : '';
    list.forEach(item => {
      html += `<option value="${item.id}" ${item.id === selectedId ? 'selected' : ''}>${esc(labelFn(item))}</option>`;
    });
    return html;
  }

  /* ---------- Tableau ---------- */
  function table(rows, cols, emptyOpts) {
    const e = typeof emptyOpts === 'string' ? { title: emptyOpts } : (emptyOpts || {});
    if (!rows.length) return `<div class="empty"><strong>${esc(e.title || 'Rien à afficher')}</strong>${esc(e.text || '')}${e.action || ''}</div>`;
    const head = cols.map(c => `<th class="${c.num ? 'num' : ''}">${esc(c.label)}</th>`).join('');
    const body = rows.map(r => `<tr>${cols.map(c => `<td class="${c.num ? 'num' : ''} ${c.cls || ''}" data-label="${esc(c.label)}">${c.render(r)}</td>`).join('')}</tr>`).join('');
    return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function badge(statut) {
    const map = {
      'brouillon': 'navy', 'envoyé': 'gold', 'accepté': 'ok', 'refusé': 'danger', 'expiré': 'warn',
      'commandée': 'gold', 'en cours': 'gold', 'livrée': 'ok', 'facturée': 'ok', 'annulée': 'danger',
      'à payer': 'warn', 'payée': 'ok', 'partielle': 'gold', 'en retard': 'danger',
      'commande': 'gold', 'reçu': 'ok'
    };
    return `<span class="badge ${map[statut] || ''}">${esc(statut)}</span>`;
  }

  /* Éditeur de lignes (devis, commandes, factures, achats) */
  function lineEditor(container, lignes, opts) {
    opts = opts || {};
    const articles = S().db.articles;
    const tvaRates = S().db.settings.tva_rates;
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap lines';
    wrap.innerHTML = `<table>
      <thead><tr>
        <th style="min-width:230px">Désignation</th>
        <th class="num" style="width:90px">Qté</th>
        <th class="num" style="width:120px">${opts.achat ? 'Prix achat HT' : 'Prix unit. HT'}</th>
        ${opts.achat ? '' : '<th class="num" style="width:90px">Remise</th><th style="width:90px">TVA</th>'}
        ${opts.interne ? '<th class="num" style="width:120px" title="Visible uniquement par vous, jamais sur les documents client">Prix interne</th>' : ''}
        <th class="num" style="width:130px">Total HT</th>
        <th style="width:44px"></th>
      </tr></thead><tbody></tbody></table>`;
    const tbody = wrap.querySelector('tbody');
    const totalOf = l => (Number(l.qte) || 0) * (Number(l.pu) || 0) * (1 - (Number(l.remise_pct) || 0) / 100);
    /* Plus de liste complete en HTML : avec 20 000 references, la construire a
       chaque ligne figeait la page. La recherche passe par ChoixArticle, qui
       garde un index en memoire et ne dessine que les premiers resultats. */
    const findArticle = (txt) => articles.find(a => (a.ref + ' — ' + a.designation) === txt || a.designation === txt || a.ref === txt);

    function drawRow(l, idx) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="ar-cellule">
            <input data-k="designation" value="${esc(l.designation || '')}" placeholder="Référence, désignation…" autocomplete="off" spellcheck="false">
            <button type="button" class="ar-loupe" data-chercher title="Recherche avancée, avec filtre par usine" aria-label="Recherche avancée">${icon('search') || '⌕'}</button>
          </div>
          <small class="muted ar-note" style="display:block;margin-top:4px">${l.article_id ? esc(articles.find(x => x.id === l.article_id)?.ref || '') : 'Prestation libre'}</small>
        </td>
        <td><input type="number" step="0.01" min="0" data-k="qte" value="${l.qte ?? 1}"></td>
        <td><input type="number" step="0.01" min="0" data-k="pu" value="${l.pu ?? 0}"></td>
        ${opts.achat ? '' : `<td><input type="number" step="0.1" min="0" max="100" data-k="remise_pct" value="${l.remise_pct ?? 0}"></td>
        <td><select data-k="tva">${tvaRates.map(r => `<option value="${r}" ${Number(l.tva) === r ? 'selected' : ''}>${r} %</option>`).join('')}</select></td>`}
        ${opts.interne ? `<td><input type="number" step="0.01" min="0" data-k="pu_interne" value="${l.pu_interne ?? ''}" placeholder="—" title="Prix négocié, visible seulement par vous"></td>` : ''}
        <td class="amount" data-total>${S().money(totalOf(l))}</td>
        <td><button type="button" class="btn ghost small icon" data-del title="Supprimer la ligne" aria-label="Supprimer la ligne">${icon('trash')}</button></td>`;
      tr.querySelectorAll('[data-k]').forEach(inp => {
        const k = inp.dataset.k;
        const apply = () => {
          if (k === 'designation') {
            const a = findArticle(inp.value.trim());
            if (a && a.id !== l.article_id) {
              l.article_id = a.id; l.designation = a.designation;
              l.pu = opts.achat ? a.prix_achat : a.prix_vente;
              l.tva = a.tva || 20;
              tr.querySelector('[data-k="pu"]').value = l.pu;
              const t = tr.querySelector('[data-k="tva"]'); if (t) t.value = l.tva;
              inp.value = a.designation;
            } else if (!a) {
              l.article_id = ''; l.designation = inp.value;
            }
          } else {
            l[k] = inp.type === 'number' ? Number(inp.value) : inp.value;
          }
          tr.querySelector('[data-total]').textContent = S().money(totalOf(l));
          if (opts.onChange) opts.onChange();
        };
        inp.addEventListener(inp.tagName === 'SELECT' || inp.type === 'number' ? 'input' : 'input', apply);
        if (inp.tagName === 'SELECT') inp.addEventListener('change', apply);
      });
      /* Recherche d'article sur la cellule Designation : suggestions sous le
         champ, et une loupe pour la recherche complete avec filtre par usine. */
      const champ = tr.querySelector('[data-k="designation"]');
      const note = tr.querySelector('.ar-note');
      let pos = -1;

      /* Le panneau de suggestions vit dans le body, pas dans la cellule : le
         tableau des lignes defile horizontalement, et il y rognait la liste a
         une seule ligne visible. Pose en « fixed », il suit le champ. */
      const panneau = document.createElement('div');
      panneau.className = 'ar-inline';
      panneau.hidden = true;
      document.body.appendChild(panneau);

      const placer = () => {
        const r = champ.getBoundingClientRect();
        panneau.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 540)) + 'px';
        panneau.style.top = (r.bottom + 4) + 'px';
      };

      const remplir = (a) => {
        l.article_id = a.id;
        l.designation = a.designation;
        l.pu = opts.achat ? a.prix_achat : a.prix_vente;
        l.tva = a.tva || 20;
        if (!opts.achat && a.prix_achat) l.pu_interne = a.prix_achat;
        champ.value = a.designation;
        tr.querySelector('[data-k="pu"]').value = l.pu;
        const t = tr.querySelector('[data-k="tva"]'); if (t) t.value = l.tva;
        const pi = tr.querySelector('[data-k="pu_interne"]');
        if (pi && l.pu_interne != null) pi.value = l.pu_interne;
        if (note) note.textContent = [a.ref, a.format, a.usine].filter(Boolean).join(' · ');
        tr.querySelector('[data-total]').textContent = S().money(totalOf(l));
        fermerPanneau();
        if (opts.onChange) opts.onChange();
      };

      function fermerPanneau() {
        panneau.hidden = true; panneau.innerHTML = ''; pos = -1;
        window.removeEventListener('scroll', placer, true);
        window.removeEventListener('resize', placer);
      }

      function suggerer() {
        const CA = window.ChoixArticle;
        const q = champ.value.trim();
        if (!CA || q.length < 2) { fermerPanneau(); return; }
        const r = CA.chercher(q, {}, 10);
        if (!r.articles.length) { fermerPanneau(); return; }
        panneau.innerHTML = r.articles.map((a, i) => CA.ligneResultat(a, opts.achat, i)).join('')
          + (r.total > r.articles.length
             ? `<button type="button" class="ar-tout" data-tout>Voir les ${r.total} résultats et filtrer par usine</button>` : '');
        panneau.hidden = false;
        placer();
        window.addEventListener('scroll', placer, true);
        window.addEventListener('resize', placer);
        pos = -1;
        panneau.querySelectorAll('.ar-item').forEach(b => b.onclick = () => {
          const a = S().db.articles.find(x => x.id === b.dataset.id);
          if (a) remplir(a);
        });
        const tout = panneau.querySelector('[data-tout]');
        if (tout) tout.onclick = () => { fermerPanneau(); CA.ouvrir({ terme: q, achat: opts.achat, onChoisir: remplir }); };
      }

      champ.addEventListener('input', suggerer);
      champ.addEventListener('keydown', (e) => {
        const items = [...panneau.querySelectorAll('.ar-item')];
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          if (!items.length) return;
          e.preventDefault();
          pos = (pos + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
          items.forEach((x, i) => x.classList.toggle('actif', i === pos));
          items[pos].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter' && pos >= 0 && items[pos]) {
          e.preventDefault(); items[pos].click();
        } else if (e.key === 'Escape') { fermerPanneau(); }
      });
      champ.addEventListener('blur', () => setTimeout(fermerPanneau, 150));
      tr.querySelector('[data-chercher]').onclick = () => {
        if (!window.ChoixArticle) return;
        fermerPanneau();
        window.ChoixArticle.ouvrir({ terme: champ.value.trim(), achat: opts.achat, onChoisir: remplir });
      };

      tr.querySelector('[data-del]').onclick = () => {
        panneau.remove();
        lignes.splice(idx, 1); drawAll(); if (opts.onChange) opts.onChange();
      };
      tbody.appendChild(tr);
    }

    function drawAll() {
      document.querySelectorAll('body > .ar-inline').forEach(x => x.remove());
      tbody.innerHTML = '';
      if (!lignes.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-cell"><div class="empty" style="padding:22px"><strong>Aucune ligne</strong>Choisissez un article du stock ou saisissez une prestation libre.</div></td></tr>`;
      }
      lignes.forEach((l, i) => drawRow(l, i));
    }

    const addRow = document.createElement('div');
    addRow.className = 'btn-row';
    addRow.style.marginTop = '10px';
    addRow.innerHTML = `<button type="button" class="btn ghost small">${icon('plus')} Ajouter une ligne</button>`;
    addRow.querySelector('button').onclick = () => {
      lignes.push({ article_id: '', designation: '', qte: 1, pu: 0, remise_pct: 0, tva: S().db.settings.default_tva });
      drawAll();
      if (opts.onChange) opts.onChange();
      const last = tbody.querySelector('tr:last-child [data-k="designation"]');
      if (last) last.focus();
    };

    drawAll();
    container.appendChild(wrap);
    container.appendChild(addRow);
    return { refresh: drawAll };
  }

  /* Recherche avec filtre en direct : ne re-rend que la liste */
  function searchBox(placeholder, value, onInput) {
    return `<div class="search">${icon('search')}<input type="search" placeholder="${esc(placeholder)}" value="${esc(value || '')}" data-search></div>`;
  }
  function bindSearch(box, onInput) {
    const inp = box.querySelector('[data-search]');
    if (!inp) return;
    inp.addEventListener('input', debounce(() => onInput(inp.value), 120));
  }

  function setupShell() {
    const sidebar = document.getElementById('sidebar');
    const toggle = () => { sidebar.classList.toggle('open'); document.body.classList.toggle('nav-open'); };
    document.getElementById('menu-btn').onclick = toggle;
    document.getElementById('scrim').onclick = toggle;
    window.addEventListener('hashchange', render);
    document.addEventListener('keydown', e => {
      if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) {
        const s = document.querySelector('[data-search]'); if (s) { e.preventDefault(); s.focus(); }
      }
    });
  }

  window.UI = {
    icon, register, go, render, toast, modal, confirmBox, commit, saveQuiet, debounce, options,
    lineEditor, table, badge, searchBox, bindSearch, setupShell, currentRoute, renderNav, esc
  };
})();

/* Stock, articles, mouvements, achats fournisseurs */
(function () {
  const S = () => window.Store;
  const UI = window.UI;
  const I = UI.icon;
  const esc = UI.esc;

  /* Mouvement : qte > 0 entrée, qte < 0 sortie. Met à jour le stock de l'article. */
  function mouvement(articleId, qte, motif, ref) {
    const db = S().db;
    const a = db.articles.find(x => x.id === articleId);
    if (!a) return;
    a.stock = (Number(a.stock) || 0) + Number(qte);
    db.mouvements.push({ id: S().uid(), date: S().today(), article_id: articleId, qte: Number(qte), motif, ref: ref || '' });
  }

  const enAlerte = (a) => (Number(a.stock) || 0) <= (Number(a.stock_alerte) || 0) && (Number(a.stock_alerte) || 0) > 0;
  const valeurStock = () => S().db.articles.reduce((s, a) => s + (Number(a.stock) || 0) * (Number(a.prix_achat) || 0), 0);
  const fournisseurNom = id => (S().db.fournisseurs.find(f => f.id === id) || {}).nom || '—';

  /* ---------- Articles ---------- */
  function listeArticles(box) {
    const db = S().db;
    const state = { q: '', filtre: 'tous' };
    const alertes = db.articles.filter(enAlerte).length;

    const drawList = () => {
      const q = state.q.toLowerCase();
      const list = db.articles
        .filter(a => (state.filtre === 'tous' || enAlerte(a)) && (!q || (a.ref + ' ' + a.designation + ' ' + a.emplacement).toLowerCase().includes(q)))
        .sort((a, b) => a.designation.localeCompare(b.designation));
      document.getElementById('list-body').innerHTML = UI.table(list, [
        { label: 'Article', render: a => `<a class="link" href="#article-${a.id}">${esc(a.designation)}</a><small>${esc(a.ref)}${a.emplacement ? ' · ' + esc(a.emplacement) : ''}</small>` },
        { label: 'Fournisseur', render: a => esc(fournisseurNom(a.fournisseur_id)) },
        { label: 'Prix achat', num: true, render: a => S().money(a.prix_achat) },
        { label: 'Prix vente', num: true, render: a => S().money(a.prix_vente) },
        { label: 'Stock', num: true, render: a => `<strong>${S().num(a.stock)}</strong> <span class="muted">${esc(a.unite)}</span> ${enAlerte(a) ? '<span class="badge danger">Stock bas</span>' : ''}` }
      ], { title: 'Aucun article', text: 'Ajoutez vos produits pour suivre les quantités.' });
    };

    const draw = () => {
      box.innerHTML = `
        <div class="grid grid-kpi" style="margin-bottom:18px">
          <div class="card kpi"><div class="label">Articles référencés</div><div class="value">${db.articles.length}</div></div>
          <div class="card kpi ${alertes ? 'alert' : 'ok'}"><div class="label">Stock bas</div><div class="value">${alertes}</div><div class="sub">sous le seuil d'alerte</div></div>
          <div class="card kpi"><div class="label">Valeur du stock</div><div class="value">${S().money(valeurStock())}</div><div class="sub">au prix d'achat</div></div>
        </div>
        <div class="card">
          <div class="card-head">
            <div class="btn-row">
              <button class="btn ${state.filtre === 'tous' ? '' : 'ghost'} small" data-f="tous">Tous</button>
              <button class="btn ${state.filtre === 'bas' ? '' : 'ghost'} small" data-f="bas">Stock bas ${alertes ? `(${alertes})` : ''}</button>
            </div>
            <div class="btn-row">
              ${UI.searchBox('Référence, désignation…', state.q)}
              <button class="btn ghost" id="st-imp">${I('export')} Importer un tarif</button>
              <button class="btn ghost" id="st-mv">${I('move')} Mouvement</button>
              <button class="btn gold" id="st-new">${I('plus')} Nouvel article</button>
            </div>
          </div>
          <div id="list-body"></div>
        </div>`;
      drawList();
      box.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { state.filtre = b.dataset.f; draw(); });
      document.getElementById('st-new').onclick = () => articleModal(null);
      document.getElementById('st-mv').onclick = () => mouvementModal(null);
      document.getElementById('st-imp').onclick = () => window.Ops.importModal();
    };
    draw();
    UI.bindSearch(box, v => { state.q = v; drawList(); });
  }

  function articleForm(a, isNew) {
    const db = S().db;
    const f = a || { unite: 'm²', unite_stock: 'M2', tva: 20, stock: 0, stock_alerte: 0 };
    const T = window.Transport;
    const ch = (l, html, aide) => `<div class="field"><label>${l}</label>${html}${aide ? `<span class="aide-champ">${aide}</span>` : ''}</div>`;
    return `
      <div class="sous-titre-form">Identification</div>
      <div class="grid grid-form">
        ${ch('Code article *', `<input name="ref" value="${esc(f.ref)}">`)}
        ${ch('Désignation *', `<input name="designation" value="${esc(f.designation)}">`)}
        ${ch('Format', `<input name="format" value="${esc(f.format)}" placeholder="60x60x9, 45X90X9…">`)}
        ${ch('Code-barres', `<input name="code_barre" value="${esc(f.code_barre)}" inputmode="numeric">`)}
        ${ch('Fournisseur', `<select name="fournisseur_id">${UI.options(db.fournisseurs, f.fournisseur_id, x => x.nom + (x.pays ? ' · ' + x.pays : ''), '— aucun —')}</select>`)}
        ${ch('Emplacement', `<input name="emplacement" value="${esc(f.emplacement)}" placeholder="Allée, rack, bain…">`)}
      </div>

      <div class="sous-titre-form">Unités et conditionnement</div>
      <div class="grid grid-form">
        ${ch('Unité de saisie', `<input name="unite" value="${esc(f.unite)}" placeholder="m², pièce, sac…">`, 'Ce qui est tapé sur le devis')}
        ${ch('Unité de stock', `<input name="unite_stock" value="${esc(f.unite_stock)}" placeholder="M2, PCS…">`, 'Ce qui est compté au dépôt')}
        ${ch('Multiple de vente', `<input name="multiple_vente" type="number" step="0.001" min="0" value="${f.multiple_vente ?? ''}">`, 'Contenu d\'une boîte, par exemple 1,620 m²')}
        ${ch('Minimum pour le tarif palette', `<input name="mini_palette" type="number" step="0.01" min="0" value="${f.mini_palette ?? ''}">`, 'En unité de saisie')}
        ${ch('Poids unitaire (kg)', `<input name="poids_unitaire" type="number" step="0.001" min="0" value="${f.poids_unitaire ?? ''}">`, 'Sert au calcul du transport')}
        ${ch('Seuil d\'alerte', `<input name="stock_alerte" type="number" step="0.01" min="0" value="${f.stock_alerte ?? 0}">`)}
        ${isNew ? ch('Stock initial', `<input name="stock" type="number" step="0.01" value="0">`) : ''}
      </div>

      <div class="sous-titre-form">Prix</div>
      <div class="grid grid-form">
        ${ch('Prix d\'achat HT (€)', `<input name="prix_achat" type="number" step="0.01" min="0" value="${f.prix_achat ?? ''}">`)}
        ${ch('Prix de vente HT (€)', `<input name="prix_vente" type="number" step="0.01" min="0" value="${f.prix_vente ?? ''}">`)}
        ${ch('TVA', `<select name="tva">${db.settings.tva_rates.map(r => `<option value="${r}" ${Number(f.tva) === r ? 'selected' : ''}>${r} %</option>`).join('')}</select>`)}
      </div>
      <div id="apercu-revient" class="apercu-revient"></div>

      <div class="sous-titre-form">Photo et commentaire</div>
      <div class="grid grid-form">
        <div class="field">
          <label>Photo du produit</label>
          <div class="zone-photo">
            <img id="ap-photo" src="${f.photo || ''}" alt="" ${f.photo ? '' : 'hidden'}>
            <div class="btn-row">
              <label class="btn ghost small" style="cursor:pointer">Choisir une image
                <input type="file" id="ap-fichier" accept="image/*" hidden></label>
              <button type="button" class="btn ghost small" id="ap-vider" ${f.photo ? '' : 'hidden'}>Retirer</button>
            </div>
          </div>
          <span class="aide-champ">L'image est réduite avant d'être enregistrée, pour ne pas saturer le navigateur.</span>
        </div>
        ${ch('Commentaire', `<textarea name="commentaire" rows="4">${esc(f.commentaire)}</textarea>`)}
      </div>
      <input type="hidden" name="photo" value="${esc(f.photo)}">`;
  }

  /* Reduction de l'image avant enregistrement : une photo d'appareil fait
     plusieurs mega-octets, et le navigateur refuse d'enregistrer au-dela de
     quelques mega pour toute l'application. */
  function reduireImage(fichier, cote) {
    return new Promise((ok, ko) => {
      const lecteur = new FileReader();
      lecteur.onerror = () => ko(lecteur.error);
      lecteur.onload = () => {
        const img = new Image();
        img.onerror = () => ko(new Error('Image illisible'));
        img.onload = () => {
          const r = Math.min(1, cote / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * r);
          c.height = Math.round(img.height * r);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          ok(c.toDataURL('image/jpeg', 0.72));
        };
        img.src = lecteur.result;
      };
      lecteur.readAsDataURL(fichier);
    });
  }

  function articleModal(a) {
    const isNew = !a;
    const db = S().db;
    UI.modal(isNew ? 'Nouvel article' : 'Modifier l\'article', articleForm(a, isNew), [
      { label: 'Annuler', cls: 'ghost', fn: (b, close) => close() },
      { label: 'Enregistrer', cls: '', fn: (b, close) => {
        const g = n => b.querySelector(`[name="${n}"]`);
        const txt = n => (g(n) ? g(n).value.trim() : '');
        const nb = n => { const e = g(n); return e && e.value !== '' ? (Number(e.value) || 0) : 0; };
        const o = {
          ref: txt('ref'), designation: txt('designation'), format: txt('format'),
          code_barre: txt('code_barre'), unite: txt('unite'), unite_stock: txt('unite_stock'),
          multiple_vente: nb('multiple_vente'), mini_palette: nb('mini_palette'),
          poids_unitaire: nb('poids_unitaire'),
          prix_achat: nb('prix_achat'), prix_vente: nb('prix_vente'),
          tva: Number(g('tva').value), fournisseur_id: g('fournisseur_id').value,
          emplacement: txt('emplacement'), stock_alerte: nb('stock_alerte'),
          photo: g('photo').value, commentaire: txt('commentaire'),
          maj_le: new Date().toISOString(),
        };
        if (!o.ref || !o.designation) { UI.toast('Code article et désignation sont obligatoires.', true); return; }
        const doublon = db.articles.find(x => x.ref.toLowerCase() === o.ref.toLowerCase() && (!a || x.id !== a.id));
        if (doublon) { UI.toast('Ce code article existe déjà.', true); return; }
        if (isNew) {
          o.id = S().uid(); o.stock = 0; o.cree_le = new Date().toISOString();
          db.articles.push(o);
          const init = nb('stock');
          if (init) mouvement(o.id, init, 'Stock initial', '');
        } else Object.assign(a, o);
        close();
        if (!S().save()) { UI.toast('Enregistrement refusé par le navigateur : la photo est peut-être trop lourde.', true); return; }
        UI.commit('Article enregistré');
      } }
    ], { wide: true });

    /* Apercu du prix de revient rendu, qui se met a jour pendant la saisie. */
    const racine = document.querySelector('.modal');
    const zone = document.getElementById('apercu-revient');
    const recalc = () => {
      const T = window.Transport;
      const q = n => racine.querySelector(`[name="${n}"]`);
      const poids = Number(q('poids_unitaire').value) || 0;
      const achat = Number(q('prix_achat').value) || 0;
      const vente = Number(q('prix_vente').value) || 0;
      const fo = S().db.fournisseurs.find(x => x.id === q('fournisseur_id').value);
      const t = (T && fo) ? T.parId(fo.transporteur_id) : null;
      if (!zone) return;
      if (!t || !poids) {
        zone.innerHTML = `<span class="muted">Transport non calculé${!poids ? ' : poids unitaire manquant'
          : ' : aucun transporteur sur le fournisseur'}.</span>`;
        return;
      }
      const parKg = T.coutParKg(t);
      const transport = poids * parKg;
      const revient = achat + transport;
      const coef = Number(S().db.settings.coef_vente) || 0;
      const conseille = coef ? revient * coef : 0;
      const marge = vente - revient;
      zone.innerHTML = `
        <div><span>Transport</span><strong>${S().money(transport)}</strong>
          <small>${esc(t.nom)} · ${S().money(parKg)} le kg</small></div>
        <div><span>Prix de revient rendu</span><strong>${S().money(revient)}</strong>
          <small>achat ${S().money(achat)} + transport</small></div>
        ${conseille ? `<div><span>Prix de vente conseillé</span><strong>${S().money(conseille)}</strong>
          <small>coefficient ${S().num(coef)}</small></div>` : ''}
        ${vente ? `<div class="${marge >= 0 ? '' : 'negatif'}"><span>Marge au prix saisi</span>
          <strong>${S().money(marge)}</strong>
          <small>${revient ? S().num((marge / revient) * 100) + ' %' : ''}</small></div>` : ''}`;
    };
    ['poids_unitaire', 'prix_achat', 'prix_vente', 'fournisseur_id'].forEach(n => {
      const e = racine.querySelector(`[name="${n}"]`);
      if (e) { e.addEventListener('input', recalc); e.addEventListener('change', recalc); }
    });
    recalc();

    /* Photo */
    const img = document.getElementById('ap-photo');
    const champPhoto = racine.querySelector('[name="photo"]');
    const btnVider = document.getElementById('ap-vider');
    document.getElementById('ap-fichier').addEventListener('change', async (e) => {
      const fichier = e.target.files && e.target.files[0];
      if (!fichier) return;
      try {
        const data = await reduireImage(fichier, 420);
        champPhoto.value = data;
        img.src = data; img.hidden = false; btnVider.hidden = false;
      } catch (err) { UI.toast('Image illisible.', true); }
    });
    btnVider.addEventListener('click', () => {
      champPhoto.value = ''; img.src = ''; img.hidden = true; btnVider.hidden = true;
    });
  }

  /* Fiche article : stock, prix, historique */
  function ficheArticle(box, id) {
    const db = S().db;
    const a = db.articles.find(x => x.id === id);
    if (!a) { box.innerHTML = '<div class="card"><div class="empty"><strong>Article introuvable</strong></div></div>'; return; }
    const mvts = db.mouvements.filter(m => m.article_id === id).slice().reverse();
    box.innerHTML = `
      <div class="grid grid-kpi" style="margin-bottom:18px">
        <div class="card kpi ${enAlerte(a) ? 'alert' : 'ok'}"><div class="label">Stock actuel</div><div class="value">${S().num(a.stock)} ${esc(a.unite)}</div><div class="sub">seuil d'alerte : ${S().num(a.stock_alerte)}</div></div>
        <div class="card kpi"><div class="label">Prix d'achat HT</div><div class="value">${S().money(a.prix_achat)}</div></div>
        <div class="card kpi"><div class="label">Prix de vente HT</div><div class="value">${S().money(a.prix_vente)}</div><div class="sub">TVA ${a.tva} %</div></div>
      </div>
      <div class="card">
        <div class="card-head">
          <div><div style="font-size:18px;font-weight:750;color:var(--navy)">${esc(a.designation)}</div>
          <div class="muted">${esc(a.ref)} · ${esc(fournisseurNom(a.fournisseur_id))}${a.emplacement ? ' · ' + esc(a.emplacement) : ''}</div></div>
          <div class="btn-row">
            <button class="btn ghost" id="fa-mv">${I('move')} Mouvement</button>
            <button class="btn gold" id="fa-edit">Modifier</button>
          </div>
        </div>
      </div>
      <div class="card"><div class="card-head"><h2>Historique</h2></div>${UI.table(mvts, [
        { label: 'Date', render: m => S().dateFr(m.date) },
        { label: 'Motif', render: m => esc(m.motif) + (m.ref ? `<small>${esc(m.ref)}</small>` : '') },
        { label: 'Quantité', num: true, cls: 'strong', render: m => `<span style="color:${m.qte < 0 ? 'var(--danger)' : 'var(--ok)'}">${m.qte > 0 ? '+' : ''}${S().num(m.qte)}</span>` }
      ], { title: 'Aucun mouvement', text: 'Les entrées et sorties apparaîtront ici.' })}</div>`;
    document.getElementById('fa-edit').onclick = () => articleModal(a);
    document.getElementById('fa-mv').onclick = () => mouvementModal(a.id);
  }

  function mouvementModal(articleId) {
    const db = S().db;
    const html = `
      <div class="grid grid-form">
        <div class="field full"><label>Article</label><select name="art">${UI.options(db.articles.slice().sort((x, y) => x.designation.localeCompare(y.designation)), articleId, a => a.designation + ' (' + a.ref + ')', '— choisir —')}</select></div>
        <div class="field"><label>Type</label><select name="type"><option value="1">Entrée (réception)</option><option value="-1">Sortie (casse, perte, usage)</option></select></div>
        <div class="field"><label>Quantité</label><input name="qte" type="number" step="0.01" min="0"></div>
        <div class="field full"><label>Motif</label><input name="motif" placeholder="Inventaire, casse, chantier…"></div>
      </div>`;
    UI.modal('Mouvement de stock', html, [
      { label: 'Annuler', cls: 'ghost', fn: (b, close) => close() },
      { label: 'Valider', cls: 'gold', fn: (b, close) => {
        const id = b.querySelector('[name="art"]').value;
        const q = Number(b.querySelector('[name="qte"]').value) * Number(b.querySelector('[name="type"]').value);
        if (!id || !q) { UI.toast('Choisissez un article et une quantité.', true); return; }
        mouvement(id, q, b.querySelector('[name="motif"]').value.trim() || 'Mouvement manuel', '');
        close(); UI.commit('Stock mis à jour');
      } }
    ]);
  }

  function mouvementsView(box) {
    const db = S().db;
    const art = id => (db.articles.find(a => a.id === id) || {}).designation || '—';
    const bas = db.articles.filter(enAlerte);
    box.innerHTML = `
      <div class="grid grid-2">
        <div class="card"><div class="card-head"><h2>Stock bas</h2><span class="badge ${bas.length ? 'danger' : 'ok'}">${bas.length}</span></div>
          ${UI.table(bas, [
            { label: 'Article', render: a => `<a class="link" href="#article-${a.id}">${esc(a.designation)}</a>` },
            { label: 'Stock', num: true, render: a => `${S().num(a.stock)} ${esc(a.unite)}` },
            { label: 'Seuil', num: true, render: a => S().num(a.stock_alerte) }
          ], { title: 'Rien à signaler', text: 'Tous les stocks sont au-dessus de leur seuil.' })}
        </div>
        <div class="card"><div class="card-head"><h2>Nouveau mouvement</h2></div>
          <p class="muted">Enregistrez une entrée (réception) ou une sortie (casse, perte, usage interne).</p>
          <button class="btn gold" id="mv-new">${I('move')} Saisir un mouvement</button>
        </div>
      </div>
      <div class="card"><div class="card-head"><h2>Historique récent</h2><span class="muted">200 derniers</span></div>
        ${UI.table(db.mouvements.slice().reverse().slice(0, 200), [
          { label: 'Date', render: m => S().dateFr(m.date) },
          { label: 'Article', render: m => esc(art(m.article_id)) },
          { label: 'Motif', render: m => esc(m.motif) + (m.ref ? `<small>${esc(m.ref)}</small>` : '') },
          { label: 'Quantité', num: true, cls: 'strong', render: m => `<span style="color:${m.qte < 0 ? 'var(--danger)' : 'var(--ok)'}">${m.qte > 0 ? '+' : ''}${S().num(m.qte)}</span>` }
        ], { title: 'Aucun mouvement', text: 'Les entrées et sorties apparaîtront ici.' })}
      </div>`;
    document.getElementById('mv-new').onclick = () => mouvementModal(null);
  }

  /* ---------- Achats fournisseurs ---------- */
  /* Total HT après le prix spécial négocié de la commande (remise_pct) */
  function totalAchat(a) {
    const brut = (a.lignes || []).reduce((s, l) => s + (Number(l.qte) || 0) * (Number(l.pu) || 0), 0);
    return brut * (1 - (Number(a.remise_pct) || 0) / 100);
  }

  function listeAchats(box) {
    const db = S().db;
    const items = db.achats.slice().sort((a, b) => (b.numero || '').localeCompare(a.numero || ''));
    const enCours = items.filter(a => a.statut !== 'reçu');
    box.innerHTML = `
      <div class="grid grid-kpi" style="margin-bottom:18px">
        <div class="card kpi"><div class="label">Achats</div><div class="value">${items.length}</div></div>
        <div class="card kpi ${enCours.length ? 'alert' : 'ok'}"><div class="label">En attente de réception</div><div class="value">${enCours.length}</div><div class="sub">${S().money(enCours.reduce((s, a) => s + totalAchat(a), 0))} HT</div></div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Bons de commande fournisseurs</h2><a class="btn gold" href="#nouvel-achat-">${I('plus')} Nouvel achat</a></div>
        ${UI.table(items, [
          { label: 'N°', render: a => `<a class="link" href="#achat-${a.id}">${esc(a.numero)}</a><small>${S().dateFr(a.date)}</small>` },
          { label: 'Fournisseur', render: a => esc(fournisseurNom(a.fournisseur_id)) },
          { label: 'Statut', render: a => UI.badge(a.statut) },
          { label: 'Total HT', num: true, cls: 'strong', render: a => S().money(totalAchat(a)) }
        ], { title: 'Aucun achat', text: 'Créez un bon de commande pour réapprovisionner le stock.' })}
      </div>`;
  }

  function editAchat(box, id) {
    const db = S().db;
    const isNew = !id;
    const a = isNew
      ? { id: S().uid(), date: S().today(), fournisseur_id: '', lignes: [], statut: 'commande', notes: '' }
      : db.achats.find(x => x.id === id);
    if (!a) { box.innerHTML = '<div class="card"><div class="empty"><strong>Achat introuvable</strong></div></div>'; return; }
    const lignes = a.lignes;
    box.innerHTML = `
      <div class="card">
        <div class="grid grid-form">
          <div class="field"><label>Fournisseur *</label><select name="f">${UI.options(db.fournisseurs, a.fournisseur_id, x => x.nom, '— choisir —')}</select></div>
          <div class="field"><label>Date</label><input type="date" name="date" value="${a.date}"></div>
          <div class="field"><label>Statut</label><select name="statut">${['commande', 'expédié', 'reçu'].map(s => `<option ${a.statut === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
          <div class="field"><label>Date d'envoi usine</label><input type="date" name="date_envoi" value="${a.date_envoi || ''}"></div>
          <div class="field"><label>Prix spécial de cette commande (remise %)</label><input type="number" step="0.5" min="0" max="100" name="remise_pct" value="${a.remise_pct || 0}"></div>
        </div>
        <p class="help">Le prix spécial s'applique à toute la commande. Il reste visible uniquement dans le logiciel.</p>
      </div>
      <div class="card">
        <div class="card-head"><h2>Articles commandés</h2><span class="muted">Le prix d'achat de l'article se met à jour à la réception</span></div>
        <div id="lines"></div>
        <div id="tot" style="display:flex;justify-content:flex-end;margin-top:14px"></div>
      </div>
      <div class="card"><div class="field"><label>Notes</label><textarea name="notes">${esc(a.notes)}</textarea></div></div>
      <div class="savebar">
        <div class="btn-row"><a class="btn ghost" href="#achats">${I('back')} Retour</a></div>
        <div class="btn-row">
          <span class="dirty"></span>
          ${!isNew && a.statut === 'commande' ? `<button class="btn ghost" id="ac-exp">Marquer expédié</button>` : ''}
          ${!isNew && a.statut !== 'reçu' ? `<button class="btn gold" id="ac-recu">Marquer reçu (entre en stock)</button>` : ''}
          ${!isNew && a.statut === 'reçu' ? `<a class="btn ghost" href="${Ops.lienSms(S().db.settings.tel_reception, Ops.messageArrivage(a))}">${I('mail')} SMS d'arrivage</a>` : ''}
          <button class="btn" id="ac-save">${I('check')} Enregistrer</button>
        </div>
      </div>`;
    const bar = box.querySelector('.savebar');
    UI.lineEditor(document.getElementById('lines'), lignes, { achat: true, onChange: () => {
      document.getElementById('tot').innerHTML = `<div class="totals"><div class="row grand"><span>Total HT</span><span>${S().money(totalAchat(a))}</span></div></div>`;
      bar.querySelector('.dirty').classList.add('on'); bar.querySelector('.dirty').textContent = 'Modifications non enregistrées';
    } });
    document.getElementById('tot').innerHTML = `<div class="totals"><div class="row grand"><span>Total HT</span><span>${S().money(totalAchat(a))}</span></div></div>`;

    function saveHeader() {
      a.fournisseur_id = box.querySelector('[name="f"]').value;
      a.date = box.querySelector('[name="date"]').value;
      a.statut = box.querySelector('[name="statut"]').value;
      a.notes = box.querySelector('[name="notes"]').value;
      a.date_envoi = box.querySelector('[name="date_envoi"]').value;
      a.remise_pct = Number(box.querySelector('[name="remise_pct"]').value) || 0;
    }
    document.getElementById('ac-save').onclick = () => {
      saveHeader();
      if (!a.fournisseur_id) { UI.toast('Choisissez un fournisseur.', true); return; }
      if (isNew) { a.numero = S().nextNumber('ACH'); db.achats.push(a); }
      UI.commit(isNew ? 'Achat créé' : 'Achat enregistré');
      if (isNew) UI.go('achat-' + a.id);
    };
    const ex = document.getElementById('ac-exp');
    if (ex) ex.onclick = () => {
      saveHeader();
      a.statut = 'expédié';
      if (!a.date_envoi) a.date_envoi = S().today();
      UI.commit('Commande marquée expédiée');
    };
    const rb = document.getElementById('ac-recu');
    if (rb) rb.onclick = () => {
      saveHeader();
      a.statut = 'reçu';
      a.date_reception = S().today();
      lignes.forEach(l => {
        if (!l.article_id) return;
        mouvement(l.article_id, Number(l.qte) || 0, 'Réception achat', a.numero);
        const art = db.articles.find(x => x.id === l.article_id);
        if (art && l.pu) art.prix_achat = Number(l.pu);
      });
      UI.commit('Achat reçu, stock mis à jour');
    };
  }

  UI.register('articles', { title: 'Articles & stock', sub: 'Produits, quantités et seuils d\'alerte', render: listeArticles });
  UI.register('article-', { title: 'Article', sub: 'Fiche article', render: (box, id) => ficheArticle(box, id) });
  UI.register('mouvements', { title: 'Mouvements de stock', sub: 'Entrées, sorties et alertes', render: mouvementsView });
  UI.register('achats', { title: 'Achats', sub: 'Commandes passées à vos fournisseurs', render: listeAchats });
  UI.register('nouvel-achat-', { title: 'Nouvel achat', sub: 'Bon de commande fournisseur', render: (box) => editAchat(box, null) });
  UI.register('achat-', { title: 'Achat', sub: 'Bon de commande fournisseur', render: (box, id) => editAchat(box, id) });

  window.Stock = { mouvement, enAlerte, valeurStock, totalAchat };
})();

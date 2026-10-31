/* Clients, fournisseurs, compte client, relances */
(function () {
  const S = () => window.Store;
  const UI = window.UI;
  const I = UI.icon;
  const esc = UI.esc;
  const V = () => window.Ventes;

  const initials = (nom) => (nom || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

  /* ---------- Solde client ---------- */
  function soldeClient(clientId) {
    let facture = 0, paye = 0, dernier = null;
    S().db.factures.filter(f => f.client_id === clientId).forEach(f => {
      facture += V().totalFacture(f).ttc;
      paye += V().totalPaye(f);
      if (!dernier || f.date > dernier) dernier = f.date;
    });
    return { facture, paye, solde: facture - paye, dernier };
  }

  /* ---------- Formulaires ---------- */
  function clientForm(c) {
    c = c || {};
    return `
      <div class="grid grid-form">
        <div class="field"><label>Type</label>
          <select name="type"><option value="particulier" ${c.type !== 'pro' ? 'selected' : ''}>Particulier</option>
          <option value="pro" ${c.type === 'pro' ? 'selected' : ''}>Professionnel</option></select></div>
        <div class="field"><label>Nom ou raison sociale *</label><input name="nom" value="${esc(c.nom)}" required></div>
        <div class="field"><label>Personne de contact</label><input name="contact" value="${esc(c.contact)}"></div>
        <div class="field"><label>Téléphone</label><input name="tel" value="${esc(c.tel)}" inputmode="tel"></div>
        <div class="field"><label>Email</label><input name="email" type="email" value="${esc(c.email)}"></div>
        <div class="field"><label>Adresse</label><input name="adresse" value="${esc(c.adresse)}"></div>
        <div class="field"><label>Code postal</label><input name="cp" value="${esc(c.cp)}" inputmode="numeric"></div>
        <div class="field"><label>Ville</label><input name="ville" value="${esc(c.ville)}"></div>
        <div class="field"><label>Commercial qui suit ce client</label>${window.Commerciaux ? window.Commerciaux.select(c.commercial_id) : ''}</div>
        <div class="field full"><label>Notes</label><textarea name="notes">${esc(c.notes)}</textarea></div>
      </div>`;
  }

  function fournisseurForm(f) {
    f = f || {};
    return `
      <div class="grid grid-form">
        <div class="field"><label>Nom *</label><input name="nom" value="${esc(f.nom)}"></div>
        <div class="field"><label>Personne de contact</label><input name="contact" value="${esc(f.contact)}"></div>
        <div class="field"><label>Téléphone</label><input name="tel" value="${esc(f.tel)}"></div>
        <div class="field"><label>Email</label><input name="email" type="email" value="${esc(f.email)}"></div>
        <div class="field"><label>Adresse</label><input name="adresse" value="${esc(f.adresse)}"></div>
        <div class="field"><label>Code postal</label><input name="cp" value="${esc(f.cp)}"></div>
        <div class="field"><label>Ville</label><input name="ville" value="${esc(f.ville)}"></div>
        <div class="field"><label>Délai de livraison (jours)</label><input name="delai_jours" type="number" min="0" value="${esc(f.delai_jours)}"></div>
        <div class="field full"><label>Notes</label><textarea name="notes">${esc(f.notes)}</textarea></div>
      </div>`;
  }

  function readForm(body) {
    const o = {};
    body.querySelectorAll('[name]').forEach(el => { o[el.name] = el.value.trim(); });
    return o;
  }

  /* ---------- Liste clients ---------- */
  function listeClients(box) {
    const db = S().db;
    const state = { q: '' };
    const drawList = () => {
      const q = state.q.toLowerCase();
      const list = db.clients
        .filter(c => !q || (c.nom + ' ' + c.ville + ' ' + c.email + ' ' + c.tel + ' ' + c.contact).toLowerCase().includes(q))
        .sort((a, b) => a.nom.localeCompare(b.nom));
      document.getElementById('list-body').innerHTML = UI.table(list, [
        { label: 'Client', render: c => `<div class="btn-row" style="gap:10px;flex-wrap:nowrap"><span class="avatar">${esc(initials(c.nom))}</span><div><a class="link" href="#client-${c.id}">${esc(c.nom)}</a><small>${c.type === 'pro' ? 'Professionnel' : 'Particulier'}${c.ville ? ' · ' + esc(c.ville) : ''}</small></div></div>` },
        { label: 'Contact', render: c => `${esc(c.tel)}<small>${esc(c.email)}</small>` },
        { label: 'Solde dû', num: true, cls: 'strong', render: c => { const s = soldeClient(c.id).solde; return s > 0.009 ? `<span class="badge danger">${S().money(s)}</span>` : `<span class="badge ok">à jour</span>`; } }
      ], { title: state.q ? 'Aucun résultat' : 'Aucun client', text: state.q ? 'Essayez un autre mot.' : 'Ajoutez votre premier client pour créer des devis.' });
    };
    const draw = () => {
      const total = db.clients.reduce((s, c) => s + soldeClient(c.id).solde, 0);
      box.innerHTML = `
        <div class="grid grid-kpi" style="margin-bottom:18px">
          <div class="card kpi"><div class="label">Clients</div><div class="value">${db.clients.length}</div><div class="sub">${db.clients.filter(c => c.type === 'pro').length} professionnel(s)</div></div>
          <div class="card kpi ${total > 0 ? 'alert' : 'ok'}"><div class="label">Total des soldes dus</div><div class="value">${S().money(total)}</div></div>
        </div>
        <div class="card">
          <div class="card-head">
            ${UI.searchBox('Nom, ville, téléphone…', state.q)}
            <button class="btn gold" id="cli-new">${I('plus')} Nouveau client</button>
          </div>
          <div id="list-body"></div>
        </div>`;
      document.getElementById('cli-new').onclick = () => clientModal(null);
      drawList();
    };
    draw();
    UI.bindSearch(box, v => { state.q = v; drawList(); });
  }

  function clientModal(c) {
    const isNew = !c;
    UI.modal(isNew ? 'Nouveau client' : 'Modifier le client', clientForm(c), [
      { label: 'Annuler', cls: 'ghost', fn: (b, close) => close() },
      { label: 'Enregistrer', cls: '', fn: (b, close) => {
        const o = readForm(b);
        if (!o.nom) { UI.toast('Le nom est obligatoire.', true); return; }
        if (isNew) { o.id = S().uid(); o.created = S().today(); S().db.clients.push(o); }
        else Object.assign(c, o);
        close();
        UI.commit(isNew ? 'Client créé' : 'Client mis à jour');
        if (isNew) UI.go('client-' + o.id);
      } }
    ], { wide: true });
  }

  /* ---------- Fiche client ---------- */
  function fiche(box, id) {
    const db = S().db;
    const c = db.clients.find(x => x.id === id);
    if (!c) { box.innerHTML = '<div class="card"><div class="empty"><strong>Client introuvable</strong></div></div>'; return; }
    const s = soldeClient(id);
    const devis = db.devis.filter(d => d.client_id === id).sort((a, b) => b.date.localeCompare(a.date));
    const commandes = db.commandes.filter(d => d.client_id === id).sort((a, b) => b.date.localeCompare(a.date));
    const factures = db.factures.filter(d => d.client_id === id).sort((a, b) => b.date.localeCompare(a.date));
    box.innerHTML = `
      <div class="card">
        <div class="card-head">
          <div class="btn-row" style="flex-wrap:nowrap;gap:14px"><span class="avatar" style="width:52px;height:52px;flex-basis:52px;font-size:18px;border-radius:14px">${esc(initials(c.nom))}</span>
            <div><div style="font-size:20px;font-weight:750;color:var(--navy)">${esc(c.nom)}</div>
            <div class="muted">${c.type === 'pro' ? 'Professionnel' : 'Particulier'}${c.contact ? ' · ' + esc(c.contact) : ''}</div></div></div>
          <div class="btn-row">
            <button class="btn ghost" id="cf-edit">Modifier</button>
            <button class="btn gold" id="cf-devis">${I('plus')} Nouveau devis</button>
            <button class="btn ghost icon danger" id="cf-del" aria-label="Supprimer le client">${I('trash')}</button>
          </div>
        </div>
        <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px 24px;font-size:13.5px;color:var(--text-2)">
          <div>${I('mail')} ${esc(c.email) || '<span class="muted">Pas d\'email</span>'}</div>
          <div>Tél. ${esc(c.tel) || '<span class="muted">—</span>'}</div>
          <div>${esc(c.adresse)} ${esc(c.cp)} ${esc(c.ville)}</div>
        </div>
        ${c.notes ? `<p class="muted" style="margin:12px 0 0;padding-top:12px;border-top:1px solid var(--line-2)">${esc(c.notes)}</p>` : ''}
      </div>
      <div class="grid grid-kpi" style="margin-bottom:18px">
        <div class="card kpi"><div class="label">Total facturé TTC</div><div class="value">${S().money(s.facture)}</div></div>
        <div class="card kpi ok"><div class="label">Total encaissé</div><div class="value">${S().money(s.paye)}</div></div>
        <div class="card kpi ${s.solde > 0.009 ? 'alert' : 'ok'}"><div class="label">Solde dû</div><div class="value">${S().money(s.solde)}</div><div class="sub">${s.dernier ? 'Dernière facture le ' + S().dateFr(s.dernier) : 'Aucune facture'}</div></div>
      </div>
      <div class="grid grid-2">
        <div class="card"><div class="card-head"><h2>Factures</h2><span class="muted">${factures.length}</span></div>${UI.table(factures, [
          { label: 'N°', render: f => `<a class="link" href="#facture-${f.id}">${esc(f.numero)}</a><small>${S().dateFr(f.date)}</small>` },
          { label: 'Statut', render: f => UI.badge(V().statutFacture(f)) },
          { label: 'Reste dû', num: true, cls: 'strong', render: f => S().money(V().resteAPayer(f)) }
        ], { title: 'Aucune facture', text: 'Elles apparaîtront ici après une commande.' })}</div>
        <div class="card"><div class="card-head"><h2>Devis</h2><span class="muted">${devis.length}</span></div>${UI.table(devis, [
          { label: 'N°', render: d => `<a class="link" href="#devis-${d.id}">${esc(d.numero)}</a><small>${S().dateFr(d.date)}</small>` },
          { label: 'Statut', render: d => UI.badge(d.statut) },
          { label: 'Total TTC', num: true, render: d => S().money(V().totalDevis(d).ttc) }
        ], { title: 'Aucun devis', text: 'Créez un devis pour ce client.' })}</div>
      </div>
      <div class="card"><div class="card-head"><h2>Commandes</h2><span class="muted">${commandes.length}</span></div>${UI.table(commandes, [
        { label: 'N°', render: c2 => `<a class="link" href="#commande-${c2.id}">${esc(c2.numero)}</a><small>${S().dateFr(c2.date)}</small>` },
        { label: 'Statut', render: c2 => UI.badge(c2.statut) },
        { label: 'Total TTC', num: true, render: c2 => S().money(V().totalDevis(c2).ttc) }
      ], 'Aucune commande pour ce client.')}</div>`;
    document.getElementById('cf-edit').onclick = () => clientModal(c);
    document.getElementById('cf-devis').onclick = () => UI.go('nouveau-devis-' + c.id);
    document.getElementById('cf-del').onclick = () => UI.confirmBox('Supprimer ce client ? Ses devis et factures seront conservés mais sans fiche client.', () => {
      S().db.clients = S().db.clients.filter(x => x.id !== id);
      UI.commit('Client supprimé'); UI.go('clients');
    });
  }

  /* ---------- Relances ---------- */
  function relances(box) {
    const db = S().db;
    const today = S().today();
    const jours = (a, b) => Math.floor((new Date(a + 'T00:00:00') - new Date(b + 'T00:00:00')) / 86400000);
    const impayes = db.factures
      .filter(f => V().resteAPayer(f) > 0.009)
      .map(f => ({ f, retard: f.date_echeance ? jours(today, f.date_echeance) : 0 }))
      .sort((a, b) => b.retard - a.retard);
    const delai = db.settings.delai_relance_jours || 15;
    const dormants = db.devis.filter(d => d.statut === 'envoyé' && jours(today, d.date) >= delai)
      .sort((a, b) => a.date.localeCompare(b.date));
    const totalDu = impayes.reduce((s, x) => s + V().resteAPayer(x.f), 0);
    /* Validité du devis = date d'émission + durée de validité des paramètres */
    const validite = db.settings.validite_devis_jours || 30;
    const expiration = d => S().addDays(d.date, validite);
    const expirant = db.devis
      .filter(d => d.statut === 'envoyé')
      .map(d => ({ d, restant: jours(expiration(d), today) }))
      .filter(x => x.restant <= 7)
      .sort((a, b) => a.restant - b.restant);
    const clientNom = id => V().clientNom(id);
    const contact = id => { const c = db.clients.find(x => x.id === id) || {}; return c.contact || c.nom || ''; };
    const signature = `${db.settings.commercial || ''}\n${db.settings.company.name}`;

    box.innerHTML = `
      <div class="grid grid-kpi" style="margin-bottom:18px">
        <div class="card kpi ${impayes.length ? 'alert' : 'ok'}"><div class="label">Montant à relancer</div><div class="value">${S().money(totalDu)}</div><div class="sub">${impayes.length} facture(s) non soldée(s)</div></div>
        <div class="card kpi"><div class="label">Devis sans réponse</div><div class="value">${dormants.length}</div><div class="sub">envoyés il y a ${delai} jours ou plus</div></div>
      </div>
      <div class="card">
        <div class="card-head"><div><h2>Devis bientôt expirés</h2><span class="muted">Validité de ${validite} jours, relance conseillée à J-7</span></div><span class="badge ${expirant.length ? 'warn' : 'ok'}">${expirant.length}</span></div>
        ${UI.table(expirant, [
          { label: 'Devis', render: x => `<a class="link" href="#devis-${x.d.id}">${esc(x.d.numero)}</a><small>${esc(clientNom(x.d.client_id))}</small>` },
          { label: 'Expire le', render: x => S().dateFr(expiration(x.d)) },
          { label: 'Délai', render: x => x.restant < 0 ? `<span class="badge danger">expiré depuis ${-x.restant} j</span>` : x.restant === 0 ? `<span class="badge warn">expire aujourd'hui</span>` : `<span class="badge warn">dans ${x.restant} j</span>` },
          { label: 'Total TTC', num: true, render: x => S().money(V().totalDevis(x.d).ttc) },
          { label: '', render: x => `<button class="btn ghost small" data-relance-devis="${x.d.id}">${I('mail')} Relancer</button>` }
        ], { title: 'Aucun devis proche de l\'expiration', text: 'Tout est dans les temps.' })}
      </div>
      <div class="card">
        <div class="card-head"><h2>Factures impayées</h2></div>
        ${UI.table(impayes, [
          { label: 'Facture', render: x => `<a class="link" href="#facture-${x.f.id}">${esc(x.f.numero)}</a><small>${esc(clientNom(x.f.client_id))}</small>` },
          { label: 'Échéance', render: x => S().dateFr(x.f.date_echeance) },
          { label: 'Retard', render: x => x.retard > 0 ? `<span class="badge danger">${x.retard} j</span>` : `<span class="badge ok">pas encore échu</span>` },
          { label: 'Reste dû', num: true, cls: 'strong', render: x => S().money(V().resteAPayer(x.f)) },
          { label: '', render: x => `<button class="btn ghost small" data-mail="${x.f.id}">${I('mail')} Relancer</button>` }
        ], { title: 'Aucune facture impayée', text: 'Tout est encaissé. Bravo !' })}
      </div>
      <div class="card">
        <div class="card-head"><h2>Devis sans réponse</h2></div>
        ${UI.table(dormants, [
          { label: 'Devis', render: d => `<a class="link" href="#devis-${d.id}">${esc(d.numero)}</a><small>${esc(clientNom(d.client_id))}</small>` },
          { label: 'Envoyé le', render: d => S().dateFr(d.date) },
          { label: 'Total TTC', num: true, render: d => S().money(V().totalDevis(d).ttc) },
          { label: '', render: d => `<button class="btn ghost small" data-relance-devis="${d.id}">${I('mail')} Relancer</button>` }
        ], { title: 'Aucun devis à relancer', text: `Les devis envoyés depuis plus de ${delai} jours apparaissent ici.` })}
      </div>`;

    box.querySelectorAll('[data-mail]').forEach(b => b.onclick = () => {
      const f = db.factures.find(x => x.id === b.dataset.mail);
      const txt = `Bonjour ${contact(f.client_id)},\n\nJe me permets de revenir vers vous au sujet de la facture ${f.numero}. Le solde de ${S().money(V().resteAPayer(f))} n'a pas encore été réglé.\n\nPourriez-vous me confirmer la date de règlement ? Si un souci vous retient, dites-le-moi, on trouvera une solution.\n\nBien cordialement,\n${signature}`;
      copyModal('Relance facture ' + f.numero, txt);
    });
    box.querySelectorAll('[data-relance-devis]').forEach(b => b.onclick = () => {
      const d = db.devis.find(x => x.id === b.dataset.relanceDevis);
      const txt = `Bonjour ${contact(d.client_id)},\n\nJe reviens vers vous au sujet du devis ${d.numero} envoyé le ${S().dateFr(d.date)}. Avez-vous eu le temps de le regarder ? Je reste disponible pour répondre à vos questions ou ajuster le projet.\n\nBonne journée,\n${signature}`;
      copyModal('Relance devis ' + d.numero, txt);
    });
  }

  function copyModal(title, text) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="field"><label>Message prêt à copier</label><textarea style="min-height:230px">${esc(text)}</textarea></div>`;
    const ta = wrap.querySelector('textarea');
    UI.modal(title, wrap, [
      { label: 'Fermer', cls: 'ghost', fn: (b, close) => close() },
      { label: 'Copier le message', cls: 'gold', fn: (b, close) => {
        const done = () => UI.toast('Message copié');
        if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(done, () => { ta.select(); document.execCommand('copy'); done(); });
        else { ta.select(); document.execCommand('copy'); done(); }
      } }
    ], { wide: true });
  }

  /* ---------- Fournisseurs ---------- */
  function listeFournisseurs(box) {
    const db = S().db;
    const state = { q: '' };
    const draw = () => {
      const q = state.q.toLowerCase();
      const list = db.fournisseurs.filter(f => !q || (f.nom + ' ' + f.contact + ' ' + f.ville).toLowerCase().includes(q))
        .sort((a, b) => a.nom.localeCompare(b.nom));
      box.innerHTML = `
        <div class="card">
          <div class="card-head">${UI.searchBox('Nom, contact, ville…', state.q)}<button class="btn gold" id="fo-new">${I('plus')} Nouveau fournisseur</button></div>
          <div id="list-body"></div>
        </div>`;
      document.getElementById('list-body').innerHTML = UI.table(list, [
        { label: 'Fournisseur', render: f => `<span class="link">${esc(f.nom)}</span><small>${esc(f.ville)}</small>` },
        { label: 'Contact', render: f => `${esc(f.contact)}<small>${esc(f.email)}</small>` },
        { label: 'Téléphone', render: f => esc(f.tel) },
        { label: 'Délai', num: true, render: f => f.delai_jours ? f.delai_jours + ' j' : '—' },
        { label: '', render: f => `<button class="btn ghost small" data-fo="${f.id}">Modifier</button>` }
      ], { title: 'Aucun fournisseur', text: 'Ajoutez vos fournisseurs pour gérer vos achats.' });
      document.getElementById('fo-new').onclick = () => fournisseurModal(null);
      box.querySelectorAll('[data-fo]').forEach(b => b.onclick = () => fournisseurModal(db.fournisseurs.find(x => x.id === b.dataset.fo)));
    };
    draw();
    UI.bindSearch(box, v => { state.q = v; draw(); const inp = box.querySelector('[data-search]'); if (inp) { inp.focus(); inp.setSelectionRange(v.length, v.length); } });
  }

  function fournisseurModal(f) {
    const isNew = !f;
    UI.modal(isNew ? 'Nouveau fournisseur' : 'Modifier le fournisseur', fournisseurForm(f), [
      { label: 'Annuler', cls: 'ghost', fn: (b, close) => close() },
      { label: 'Enregistrer', cls: '', fn: (b, close) => {
        const o = readForm(b);
        if (!o.nom) { UI.toast('Le nom est obligatoire.', true); return; }
        if (isNew) { o.id = S().uid(); S().db.fournisseurs.push(o); } else Object.assign(f, o);
        close(); UI.commit('Fournisseur enregistré');
      } }
    ], { wide: true });
  }

  /* Création rapide (4 champs) depuis un devis : le client est sélectionné sans quitter la page */
  function quickClient(onCreated) {
    const html = `
      <div class="grid grid-form">
        <div class="field full"><label>Type</label>
          <div class="btn-row" role="radiogroup">
            <label class="btn ghost small" style="margin:0"><input type="radio" name="type" value="particulier" checked style="width:auto;min-height:0;margin-right:6px">Particulier</label>
            <label class="btn ghost small" style="margin:0"><input type="radio" name="type" value="pro" style="width:auto;min-height:0;margin-right:6px">Professionnel</label>
          </div></div>
        <div class="field full"><label>Nom ou raison sociale *</label><input name="nom" autofocus></div>
        <div class="field"><label>Téléphone</label><input name="tel" inputmode="tel"></div>
        <div class="field"><label>Email</label><input name="email" type="email"></div>
        <div class="field"><label>Ville</label><input name="ville"></div>
        <div class="field"><label>Adresse (facultatif)</label><input name="adresse"></div>
      </div>
      <p class="help">Vous pourrez compléter la fiche plus tard, depuis la page Clients.</p>`;
    UI.modal('Nouveau client', html, [
      { label: 'Annuler', cls: 'ghost', fn: (b, close) => close() },
      { label: 'Créer et sélectionner', cls: 'gold', fn: (b, close) => {
        const o = readForm(b);
        o.type = (b.querySelector('[name="type"]:checked') || {}).value || 'particulier';
        if (!o.nom) { UI.toast('Indiquez le nom du client.', true); b.querySelector('[name="nom"]').focus(); return; }
        o.id = S().uid(); o.created = S().today(); o.contact = o.contact || '';
        o.cp = o.cp || ''; o.notes = o.notes || '';
        S().db.clients.push(o);
        S().save();
        close();
        UI.toast('Client créé : ' + o.nom);
        if (onCreated) onCreated(o);
      } }
    ]);
  }

  UI.register('clients', { title: 'Clients', sub: 'Fiches clients, soldes et historique', render: listeClients });
  UI.register('nouveau-client', { title: 'Clients', sub: 'Fiches clients, soldes et historique', render: (box) => { listeClients(box); quickClient((c) => UI.go('client-' + c.id)); } });
  UI.register('client-', {
    title: id => { const c = S().db.clients.find(x => x.id === id); return c ? c.nom : 'Client'; },
    sub: 'Fiche client',
    render: (box, id) => fiche(box, id)
  });
  UI.register('relances', { title: 'Relances', sub: 'Factures impayées et devis sans réponse', render: relances });
  UI.register('fournisseurs', { title: 'Fournisseurs', sub: 'Vos partenaires d\'achat', render: listeFournisseurs });

  window.Clients = { soldeClient, clientModal, copyModal, quickClient };
})();

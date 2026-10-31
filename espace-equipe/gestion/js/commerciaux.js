/**
 * Commerciaux : qui suit quel client, et de qui est le chiffre.
 *
 * Un document garde SON commercial, independamment de la fiche client. Un
 * collegue qui depanne un client absent doit voir sa vente comptee pour lui,
 * et le client reste suivi par son commercial habituel. C'est pour ca que
 * `commercial_id` existe a la fois sur le client et sur chaque document.
 */
(function () {
  const S = () => window.Store;
  const UI = window.UI;
  const I = UI.icon;
  const esc = UI.esc;

  const tous = () => S().db.commerciaux || [];
  const actifs = () => tous().filter(c => c.actif !== false);

  function nom(id) {
    if (!id) return '';
    const c = tous().find(x => x.id === id);
    return c ? c.nom : '— supprimé —';
  }

  /**
   * Liste deroulante. On garde toujours le commercial deja enregistre, meme
   * s'il a ete desactive depuis : sinon un vieux devis changerait de mains
   * tout seul a la premiere ouverture.
   */
  function select(selectedId, champ) {
    const liste = actifs().slice();
    if (selectedId && !liste.some(c => c.id === selectedId)) {
      const ancien = tous().find(c => c.id === selectedId);
      if (ancien) liste.push(ancien);
    }
    liste.sort((a, b) => a.nom.localeCompare(b.nom));
    return `<select name="${champ || 'commercial_id'}">
      <option value="">Non attribué</option>
      ${liste.map(c => `<option value="${c.id}" ${selectedId === c.id ? 'selected' : ''}>${esc(c.nom)}${c.actif === false ? ' (inactif)' : ''}</option>`).join('')}
    </select>`;
  }

  /** Le commercial d'un document, en retombant sur celui du client. */
  function duDocument(doc) {
    if (!doc) return '';
    if (doc.commercial_id) return doc.commercial_id;
    const cl = S().db.clients.find(c => c.id === doc.client_id);
    return (cl && cl.commercial_id) || '';
  }

  /* ---------- Ecran de gestion ---------- */
  function page(box) {
    const db = S().db;
    const liste = tous().slice().sort((a, b) => a.nom.localeCompare(b.nom));

    const compte = (id) => ({
      clients: db.clients.filter(c => c.commercial_id === id).length,
      devis: db.devis.filter(d => duDocument(d) === id).length,
      factures: db.factures.filter(f => duDocument(f) === id).length,
    });

    box.innerHTML = `
      <div class="card">
        <div class="card-head">
          <div><h2>Commerciaux</h2><span class="muted">Pour suivre ses clients et voir son propre chiffre</span></div>
          <div class="btn-row"><button class="btn gold" id="co-add">${I('plus')} Ajouter</button></div>
        </div>
        ${liste.length ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>Nom</th><th>État</th><th class="num">Clients</th><th class="num">Devis</th><th class="num">Factures</th><th></th></tr></thead>
          <tbody>${liste.map(c => {
            const n = compte(c.id);
            return `<tr>
              <td data-label="Nom"><strong>${esc(c.nom)}</strong></td>
              <td data-label="État">${c.actif === false ? '<span class="badge">inactif</span>' : '<span class="badge ok">actif</span>'}</td>
              <td data-label="Clients" class="num">${n.clients}</td>
              <td data-label="Devis" class="num">${n.devis}</td>
              <td data-label="Factures" class="num">${n.factures}</td>
              <td class="num"><div class="btn-row" style="justify-content:flex-end">
                <button class="btn ghost small" data-ren="${c.id}">Renommer</button>
                <button class="btn ghost small" data-act="${c.id}">${c.actif === false ? 'Réactiver' : 'Désactiver'}</button>
              </div></td></tr>`;
          }).join('')}</tbody></table></div>`
        : `<div class="empty"><strong>Aucun commercial enregistré</strong>
             <div class="muted">Ajoutez les vendeurs du magasin pour attribuer les clients et suivre le chiffre de chacun.</div></div>`}
      </div>`;

    box.querySelector('#co-add').onclick = () => {
      UI.modal('Nouveau commercial',
        '<div class="field"><label>Prénom ou nom *</label><input name="nom" autofocus></div>', [
        { label: 'Annuler', cls: 'ghost', fn: (b, close) => close() },
        { label: 'Ajouter', cls: '', fn: (b, close) => {
          const v = b.querySelector('[name=nom]').value.trim();
          if (!v) { UI.toast('Le nom est obligatoire.', true); return; }
          if (tous().some(c => c.nom.toLowerCase() === v.toLowerCase())) {
            UI.toast('Ce commercial existe déjà.', true); return;
          }
          S().db.commerciaux.push({ id: S().uid(), nom: v, actif: true });
          close(); UI.commit('Commercial ajouté');
        } }
      ]);
    };

    box.querySelectorAll('[data-ren]').forEach(b => b.onclick = () => {
      const c = tous().find(x => x.id === b.dataset.ren);
      UI.modal('Renommer', `<div class="field"><label>Nom</label><input name="nom" value="${esc(c.nom)}" autofocus></div>`, [
        { label: 'Annuler', cls: 'ghost', fn: (x, close) => close() },
        { label: 'Enregistrer', cls: '', fn: (x, close) => {
          const v = x.querySelector('[name=nom]').value.trim();
          if (!v) { UI.toast('Le nom est obligatoire.', true); return; }
          c.nom = v; close(); UI.commit('Commercial renommé');
        } }
      ]);
    });

    // On desactive au lieu de supprimer : effacer la fiche laisserait des
    // documents attribues a quelqu'un qui n'existe plus, et fausserait les
    // chiffres deja sortis.
    box.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
      const c = tous().find(x => x.id === b.dataset.act);
      c.actif = c.actif === false;
      UI.commit(c.actif ? 'Commercial réactivé' : 'Commercial désactivé');
    });
  }

  UI.register('commerciaux', {
    title: 'Commerciaux', sub: 'Attribution des clients et chiffre par vendeur', render: page
  });

  window.Commerciaux = { tous, actifs, nom, select, duDocument };
})();

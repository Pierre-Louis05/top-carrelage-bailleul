/**
 * Transporteurs et cout du transport.
 *
 * Dans le carrelage, le transport se calcule au CUMUL DE POIDS d'un camion,
 * pas article par article : plus le camion est rempli, moins la tonne coute.
 * On ne peut donc pas attribuer un cout « juste » a un article isole.
 *
 * La regle retenue, qui est celle du metier : chaque transporteur porte un
 * POIDS DE REFERENCE, le remplissage habituel de ses camions. Le prix a la
 * tonne de la tranche correspondante donne un cout au kilo, qu'on multiplie
 * par le poids de l'article. Le simulateur permet de verifier n'importe quel
 * poids, et de changer la reference en connaissance de cause.
 *
 * L'indexation gazole s'ajoute par-dessus, en pourcentage, parce qu'elle
 * change tous les mois.
 */
(function () {
  const S = () => window.Store;
  const UI = window.UI;
  const I = UI.icon;
  const esc = UI.esc;

  const tous = () => S().db.transporteurs || [];
  const actifs = () => tous().filter(t => t.actif !== false);
  const parId = (id) => tous().find(t => t.id === id) || null;

  /**
   * Cout d'un envoi, pour un poids donne.
   * Rend le detail, pas seulement le total : le vendeur doit pouvoir verifier
   * d'ou sort le chiffre avant de le reporter sur un devis.
   */
  function cout(t, poidsKg, options) {
    const o = options || {};
    const poids = Number(poidsKg) || 0;
    if (!t || poids <= 0) return null;

    const lignes = [];
    let base = 0;
    let tranche = null;

    if (t.plafond_kg && poids > Number(t.plafond_kg)) {
      return { impossible: true,
               message: `Au-delà de ${S().num(t.plafond_kg, 0)} kg, il faut plusieurs camions.` };
    }

    const mini = Number(t.mini_kg) || 0;
    if (mini && poids < mini) {
      base = Number(t.forfait) || 0;
      lignes.push({ libelle: `Forfait sous ${S().num(mini, 0)} kg`, montant: base });
    } else {
      tranche = (t.tranches || []).find(tr =>
        poids >= (Number(tr.de) || 0) && poids <= (Number(tr.a) || Infinity));
      if (!tranche) {
        // Au-dela de la derniere tranche, on prend la derniere : c'est ce que
        // font les grilles, qui s'arretent au camion complet.
        tranche = (t.tranches || [])[(t.tranches || []).length - 1];
      }
      if (!tranche) return { impossible: true, message: 'Aucune tranche de poids renseignée.' };
      base = (poids / 1000) * (Number(tranche.prix_tonne) || 0);
      lignes.push({ libelle: `${S().num(poids, 0)} kg à ${S().money(tranche.prix_tonne)} la tonne`, montant: base });
    }

    // Le prix camion complet plafonne le calcul : au-dela, on paie le camion.
    if (t.plafond_prix && base > Number(t.plafond_prix)) {
      base = Number(t.plafond_prix);
      lignes.length = 0;
      lignes.push({ libelle: 'Camion complet', montant: base });
    }

    let total = base;
    if (o.ramasse && Number(t.ramasse)) {
      total += Number(t.ramasse);
      lignes.push({ libelle: 'Ramasse', montant: Number(t.ramasse) });
    }
    if (Number(t.frais_facture)) {
      total += Number(t.frais_facture);
      lignes.push({ libelle: 'Frais de facture', montant: Number(t.frais_facture) });
    }

    const pct = Number(S().db.settings.gazole_pct) || 0;
    let gazole = 0;
    if (pct) {
      gazole = total * (pct / 100);
      total += gazole;
      lignes.push({ libelle: `Indexation gazole ${S().num(pct)} %`, montant: gazole });
    }

    return { total, lignes, tranche, parKg: total / poids, parTonne: (total / poids) * 1000 };
  }

  /** Cout au kilo d'un transporteur, au poids de reference. */
  function coutParKg(t) {
    if (!t) return 0;
    const ref = Number(t.poids_reference) || 0;
    if (!ref) return 0;
    const c = cout(t, ref, { ramasse: false });
    return c && !c.impossible ? c.parKg : 0;
  }

  /** Cout transport d'une unite d'article, d'apres son poids et son fournisseur. */
  function coutArticle(article) {
    if (!article) return 0;
    const poids = Number(article.poids_unitaire) || 0;
    if (!poids) return 0;
    const fo = S().db.fournisseurs.find(f => f.id === article.fournisseur_id);
    const t = fo ? parId(fo.transporteur_id) : null;
    return t ? poids * coutParKg(t) : 0;
  }

  /* ---------- Ecran ---------- */
  function page(box) {
    const st = S().db.settings;
    const liste = tous().slice().sort((a, b) => (a.pays || '').localeCompare(b.pays || '') || a.nom.localeCompare(b.nom));

    box.innerHTML = `
      <div class="card">
        <div class="card-head">
          <div><h2>Indexation gazole</h2><span class="muted">Elle s'ajoute à tous les calculs de transport</span></div>
        </div>
        <div class="grid grid-form">
          <div class="field"><label>Indexation en cours (%)</label>
            <input type="number" step="0.01" id="gz-pct" value="${st.gazole_pct || 0}"></div>
          <div class="field"><label>Mise à jour le</label>
            <input type="date" id="gz-date" value="${st.gazole_maj || ''}"></div>
          <div class="field"><label>Coefficient de vente conseillé</label>
            <input type="number" step="0.01" min="0" id="gz-coef" value="${st.coef_vente || 0}"
                   placeholder="1,60 pour prix de revient + 60 %"></div>
        </div>
        <p class="help">Le coût de revient rendu d'un article vaut prix d'achat plus transport.
          Le coefficient sert à proposer un prix de vente, jamais à le forcer.</p>
        <div class="btn-row" style="margin-top:12px"><button class="btn" id="gz-save">${I('check')} Enregistrer</button></div>
      </div>

      <div class="card" style="margin-top:18px">
        <div class="card-head">
          <div><h2>Transporteurs</h2><span class="muted">Une grille par pays d'expédition</span></div>
          <div class="btn-row"><button class="btn gold" id="tr-add">${I('plus')} Ajouter</button></div>
        </div>
        ${liste.length ? liste.map(carte).join('') : `<div class="empty"><strong>Aucun transporteur</strong>
          <div class="muted">Ajoutez vos grilles pour calculer le transport dans le prix de revient.</div></div>`}
      </div>`;

    document.getElementById('gz-save').onclick = () => {
      st.gazole_pct = Number(document.getElementById('gz-pct').value) || 0;
      st.gazole_maj = document.getElementById('gz-date').value;
      st.coef_vente = Number(document.getElementById('gz-coef').value) || 0;
      UI.commit('Paramètres de transport enregistrés');
    };
    document.getElementById('tr-add').onclick = () => modale(null);
    box.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => modale(parId(b.dataset.edit)));
    box.querySelectorAll('[data-simu]').forEach(b => b.onclick = () => simulateur(parId(b.dataset.simu)));
  }

  function carte(t) {
    const ref = Number(t.poids_reference) || 0;
    const parKg = coutParKg(t);
    return `
      <div class="bloc-transporteur">
        <div class="card-head">
          <div><strong style="font-size:16px">${esc(t.nom)}</strong>
            ${t.pays ? `<span class="badge">${esc(t.pays)}</span>` : ''}
            ${t.actif === false ? '<span class="badge">inactif</span>' : ''}
            <div class="muted">${t.mini_kg ? 'Minimum ' + S().num(t.mini_kg, 0) + ' kg · ' : ''}cumul de poids</div></div>
          <div class="btn-row">
            <button class="btn ghost small" data-simu="${t.id}">Simuler un envoi</button>
            <button class="btn ghost small" data-edit="${t.id}">Modifier</button>
          </div>
        </div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>De</th><th>À</th><th class="num">Prix à la tonne</th></tr></thead>
          <tbody>
            ${t.forfait ? `<tr><td colspan="2">Forfait sous le minimum</td><td class="num">${S().money(t.forfait)}</td></tr>` : ''}
            ${(t.tranches || []).map(tr => `<tr>
              <td data-label="De">${S().num(tr.de, 0)} kg</td>
              <td data-label="À">${tr.a ? S().num(tr.a, 0) + ' kg' : '—'}</td>
              <td data-label="Prix à la tonne" class="num strong">${S().money(tr.prix_tonne)}</td></tr>`).join('')}
            ${t.plafond_prix ? `<tr><td colspan="2">Camion complet (${S().num(t.plafond_kg, 0)} kg)</td>
              <td class="num">${S().money(t.plafond_prix)}</td></tr>` : ''}
          </tbody></table></div>
        <div class="infos-transporteur">
          ${t.ramasse ? `<span>Ramasse ${S().money(t.ramasse)}</span>` : ''}
          ${t.frais_facture ? `<span>Frais de facture ${S().money(t.frais_facture)}</span>` : ''}
          ${ref ? `<span><b>Référence ${S().num(ref, 0)} kg</b> soit ${S().money(parKg)} le kg</span>`
                : '<span class="alerte-douce">Poids de référence non renseigné : aucun coût transport ne sera calculé</span>'}
          ${t.envoi ? `<span>Envoi : ${esc(t.envoi)}</span>` : ''}
          ${t.chargement ? `<span>Chargement : ${esc(t.chargement)}</span>` : ''}
          ${t.arrivage ? `<span>Arrivage : ${esc(t.arrivage)}</span>` : ''}
          ${t.contact ? `<span>${esc(t.contact)}${t.telephone ? ' · ' + esc(t.telephone) : ''}</span>` : ''}
        </div>
        ${t.note ? `<p class="help">${esc(t.note)}</p>` : ''}
      </div>`;
  }

  function champ(l, html, pleine) {
    return `<div class="field ${pleine ? 'full' : ''}"><label>${l}</label>${html}</div>`;
  }

  function modale(t) {
    const isNew = !t;
    const v = t || { actif: true, tranches: [{ de: '', a: '', prix_tonne: '' }] };
    const trHtml = (tr, i) => `
      <div class="ligne-tranche" data-i="${i}">
        <input type="number" min="0" step="1" class="t-de" value="${tr.de ?? ''}" placeholder="de (kg)">
        <input type="number" min="0" step="1" class="t-a" value="${tr.a ?? ''}" placeholder="à (kg)">
        <input type="number" min="0" step="0.01" class="t-prix" value="${tr.prix_tonne ?? ''}" placeholder="€ / tonne">
        <button type="button" class="btn ghost small t-del">Retirer</button>
      </div>`;

    UI.modal(isNew ? 'Nouveau transporteur' : 'Modifier le transporteur', `
      <div class="grid grid-form">
        ${champ('Nom *', `<input name="nom" value="${esc(v.nom)}">`)}
        ${champ('Pays d\'expédition', `<input name="pays" value="${esc(v.pays)}" placeholder="Espagne, Italie, Portugal…">`)}
        ${champ('Poids minimum (kg)', `<input name="mini_kg" type="number" min="0" value="${v.mini_kg ?? ''}">`)}
        ${champ('Forfait sous le minimum (€)', `<input name="forfait" type="number" min="0" step="0.01" value="${v.forfait ?? ''}">`)}
        ${champ('Camion complet à partir de (kg)', `<input name="plafond_kg" type="number" min="0" value="${v.plafond_kg ?? ''}">`)}
        ${champ('Prix du camion complet (€)', `<input name="plafond_prix" type="number" min="0" step="0.01" value="${v.plafond_prix ?? ''}">`)}
        ${champ('Ramasse (€ HT)', `<input name="ramasse" type="number" min="0" step="0.01" value="${v.ramasse ?? ''}">`)}
        ${champ('Frais de facture (€)', `<input name="frais_facture" type="number" min="0" step="0.01" value="${v.frais_facture ?? ''}">`)}
        ${champ('Poids de référence (kg) *', `<input name="poids_reference" type="number" min="0" value="${v.poids_reference ?? ''}">`)}
        ${champ('Actif', `<select name="actif"><option value="1" ${v.actif !== false ? 'selected' : ''}>Oui</option><option value="0" ${v.actif === false ? 'selected' : ''}>Non</option></select>`)}
        ${champ('Envoi des commandes', `<input name="envoi" value="${esc(v.envoi)}" placeholder="mercredi soir">`)}
        ${champ('Chargement', `<input name="chargement" value="${esc(v.chargement)}" placeholder="le mardi">`)}
        ${champ('Arrivage', `<input name="arrivage" value="${esc(v.arrivage)}" placeholder="environ le vendredi">`)}
        ${champ('Contact', `<input name="contact" value="${esc(v.contact)}">`)}
        ${champ('Téléphone', `<input name="telephone" value="${esc(v.telephone)}" inputmode="tel">`)}
        ${champ('Note', `<textarea name="note">${esc(v.note)}</textarea>`, true)}
      </div>
      <div class="field full" style="margin-top:6px">
        <label>Tranches de poids</label>
        <div id="tranches">${(v.tranches || []).map(trHtml).join('')}</div>
        <div class="btn-row" style="margin-top:8px"><button type="button" class="btn ghost small" id="t-add">Ajouter une tranche</button></div>
        <p class="help">Le poids de référence est le remplissage habituel de vos camions.
          C'est lui qui donne le coût au kilo appliqué aux articles.</p>
      </div>`, [
      { label: 'Annuler', cls: 'ghost', fn: (b, close) => close() },
      { label: 'Enregistrer', cls: '', fn: (b, close) => {
        const g = n => b.querySelector(`[name="${n}"]`);
        const nb = n => { const x = Number(g(n).value); return Number.isFinite(x) && g(n).value !== '' ? x : 0; };
        const nom = g('nom').value.trim();
        if (!nom) { UI.toast('Le nom est obligatoire.', true); return; }
        const tranches = [...b.querySelectorAll('.ligne-tranche')].map(l => ({
          de: Number(l.querySelector('.t-de').value) || 0,
          a: Number(l.querySelector('.t-a').value) || 0,
          prix_tonne: Number(l.querySelector('.t-prix').value) || 0,
        })).filter(x => x.prix_tonne > 0).sort((x, y) => x.de - y.de);
        const o = {
          nom, pays: g('pays').value.trim(),
          mini_kg: nb('mini_kg'), forfait: nb('forfait'),
          plafond_kg: nb('plafond_kg'), plafond_prix: nb('plafond_prix'),
          ramasse: nb('ramasse'), frais_facture: nb('frais_facture'),
          poids_reference: nb('poids_reference'),
          actif: g('actif').value === '1',
          envoi: g('envoi').value.trim(), chargement: g('chargement').value.trim(),
          arrivage: g('arrivage').value.trim(), contact: g('contact').value.trim(),
          telephone: g('telephone').value.trim(), note: g('note').value.trim(),
          tranches,
        };
        if (isNew) { o.id = S().uid(); S().db.transporteurs.push(o); }
        else Object.assign(t, o);
        close(); UI.commit('Transporteur enregistré');
      } }
    ], { wide: true });

    const zone = document.getElementById('tranches');
    const brancher = () => zone.querySelectorAll('.t-del').forEach(b => b.onclick = () => {
      if (zone.children.length > 1) b.closest('.ligne-tranche').remove();
    });
    brancher();
    document.getElementById('t-add').onclick = () => {
      zone.insertAdjacentHTML('beforeend', trHtml({}, zone.children.length));
      brancher();
    };
  }

  function simulateur(t) {
    if (!t) return;
    const calcul = (poids, ramasse) => {
      const c = cout(t, poids, { ramasse });
      if (!c) return '<p class="help">Saisissez un poids.</p>';
      if (c.impossible) return `<div class="empty"><strong>${esc(c.message)}</strong></div>`;
      return `<div class="table-wrap"><table class="table">
        <tbody>${c.lignes.map(l => `<tr><td>${esc(l.libelle)}</td>
          <td class="num">${S().money(l.montant)}</td></tr>`).join('')}
          <tr><td><strong>Total transport</strong></td><td class="num strong">${S().money(c.total)}</td></tr>
          <tr><td class="muted">Soit à la tonne</td><td class="num muted">${S().money(c.parTonne)}</td></tr>
          <tr><td class="muted">Soit au kilo</td><td class="num muted">${S().money(c.parKg)}</td></tr>
        </tbody></table></div>`;
    };

    UI.modal(`Simuler un envoi · ${t.nom}`, `
      <div class="grid grid-form">
        <div class="field"><label>Poids total (kg)</label>
          <input type="number" min="0" id="sim-poids" value="${t.poids_reference || t.mini_kg || 1000}"></div>
        <div class="field"><label>Ramasse</label>
          <select id="sim-ram"><option value="0">Non</option><option value="1">Oui</option></select></div>
      </div>
      <div id="sim-res" style="margin-top:10px"></div>`, [
      { label: 'Fermer', cls: 'ghost', fn: (b, close) => close() }
    ], { wide: true });

    const refresh = () => {
      document.getElementById('sim-res').innerHTML =
        calcul(Number(document.getElementById('sim-poids').value),
               document.getElementById('sim-ram').value === '1');
    };
    document.getElementById('sim-poids').addEventListener('input', refresh);
    document.getElementById('sim-ram').addEventListener('change', refresh);
    refresh();
  }

  UI.register('transporteurs', {
    title: 'Transporteurs', sub: 'Grilles de transport et indexation gazole', render: page
  });

  window.Transport = { tous, actifs, parId, cout, coutParKg, coutArticle };
})();

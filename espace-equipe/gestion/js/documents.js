/* Aperçu imprimable (devis / facture) et paramètres */
(function () {
  const S = () => window.Store;
  const UI = window.UI;
  const I = UI.icon;
  const V = () => window.Ventes;
  const esc = UI.esc;

  /* Document devis ou facture, prêt à imprimer en PDF */
  function docHtml(kind, obj) {
    const db = S().db;
    const co = db.settings.company;
    const cli = db.clients.find(c => c.id === obj.client_id) || {};
    const t = kind === 'devis' ? V().totalDevis(obj) : V().totalFacture(obj);
    const titre = kind === 'devis' ? 'Devis' : 'Facture';
    const lignes = (obj.lignes || []).map(l => {
      const tot = (Number(l.qte) || 0) * (Number(l.pu) || 0) * (1 - (Number(l.remise_pct) || 0) / 100);
      return `<tr>
        <td>${esc(l.designation)}</td>
        <td class="num">${S().num(l.qte)}</td>
        <td class="num">${S().money(l.pu)}</td>
        <td class="num">${Number(l.remise_pct) ? S().num(l.remise_pct) + ' %' : '—'}</td>
        <td class="num">${l.tva} %</td>
        <td class="num"><strong>${S().money(tot)}</strong></td></tr>`;
    }).join('');
    const tvaRows = Object.keys(t.tvaDetail).sort().map(r =>
      `<div class="row"><span>TVA ${r} %</span><span>${S().money(t.tvaDetail[r].tva)}</span></div>`).join('');
    const pied = kind === 'devis'
      ? `Devis valable ${db.settings.validite_devis_jours} jours. Pour accord, faire précéder la signature de la mention « Bon pour accord ».`
      : `Échéance le ${S().dateFr(obj.date_echeance)}.${co.iban ? ' IBAN : ' + esc(co.iban) + '.' : ''} ${esc(co.legal_note)}`;

    return `
      <article class="doc">
        <header class="doc-head">
          <div>
            <div class="company">${esc(co.name)}</div>
            <div class="muted">${esc(co.address)}</div>
            <div class="muted">${[co.phone, co.email].filter(Boolean).map(esc).join(' · ')}</div>
            ${co.siret ? `<div class="muted">SIRET ${esc(co.siret)}</div>` : ''}
            ${co.tva_intra ? `<div class="muted">TVA intracommunautaire ${esc(co.tva_intra)}</div>` : ''}
          </div>
          <div style="text-align:right">
            <div class="doc-title">${titre} ${esc(obj.numero)}</div>
            <div class="muted">Date : ${S().dateFr(obj.date)}</div>
            ${kind === 'facture' ? `<div class="muted">Échéance : ${S().dateFr(obj.date_echeance)}</div>` : ''}
          </div>
        </header>
        <section style="margin-bottom:22px;padding:14px 16px;background:#F7F9FC;border-radius:10px;max-width:360px">
          <div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:4px">Client</div>
          <div style="font-weight:700;color:var(--navy)">${esc(cli.nom)}</div>
          ${cli.contact ? `<div>${esc(cli.contact)}</div>` : ''}
          <div>${esc(cli.adresse)}</div>
          <div>${esc(cli.cp)} ${esc(cli.ville)}</div>
        </section>
        <div class="table-wrap"><table>
          <thead><tr><th>Désignation</th><th class="num">Qté</th><th class="num">PU HT</th><th class="num">Remise</th><th class="num">TVA</th><th class="num">Total HT</th></tr></thead>
          <tbody>${lignes}</tbody></table></div>
        <div class="totals" style="margin-top:16px">
          <div class="row"><span>Montant brut</span><span>${S().money(t.brut)}</span></div>
          ${(t.remiseLignes + t.remise) > 0.005 ? `<div class="row"><span>Remises</span><span>- ${S().money(t.remiseLignes + t.remise)}</span></div>` : ''}
          <div class="row"><span><strong>Montant net HT</strong></span><span><strong>${S().money(t.ht)}</strong></span></div>
          ${tvaRows}
          <div class="row grand"><span>Total TTC</span><span>${S().money(t.ttc)}</span></div>
          ${kind === 'facture' ? `<div class="row"><span>Déjà réglé</span><span>- ${S().money(V().totalPaye(obj))}</span></div>
            <div class="row grand" style="font-size:16px"><span>Reste à payer</span><span>${S().money(V().resteAPayer(obj))}</span></div>` : ''}
        </div>
        ${obj.notes ? `<p style="margin-top:20px"><strong>Notes :</strong> ${esc(obj.notes)}</p>` : ''}
        <footer class="muted" style="margin-top:26px;padding-top:12px;border-top:1px solid var(--line);font-size:12px">${pied}</footer>
      </article>`;
  }

  function apercu(box, id) {
    const [kind, realId] = (id || '').split(':');
    const db = S().db;
    const obj = kind === 'devis' ? db.devis.find(x => x.id === realId) : db.factures.find(x => x.id === realId);
    if (!obj) { box.innerHTML = '<div class="card"><div class="empty"><strong>Document introuvable</strong></div></div>'; return; }
    const back = kind === 'devis' ? '#devis-' + obj.id : '#facture-' + obj.id;
    const cli = db.clients.find(c => c.id === obj.client_id) || {};
    const log = obj.journal || (obj.journal = []);
    const fmt = iso => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const imprimes = log.filter(e => e.type === 'impression');
    const envoyes = log.filter(e => e.type === 'envoi');
    const statusTxt = [
      imprimes.length ? `Imprimé ${imprimes.length} fois, dernière fois le ${fmt(imprimes[imprimes.length - 1].date)}` : 'Jamais imprimé',
      envoyes.length ? `envoyé par email le ${fmt(envoyes[envoyes.length - 1].date)}` : ''
    ].filter(Boolean).join(' · ');
    box.innerHTML = `
      <div class="btn-row between no-print" style="margin-bottom:14px;align-items:center">
        <div class="btn-row"><a class="btn ghost" href="${back}">${I('back')} Retour</a>
          <span class="badge ${imprimes.length ? 'navy' : 'warn'}">${esc(statusTxt)}</span></div>
        <div class="btn-row">
          <button class="btn ghost" id="pr-mail">${I('mail')} Envoyer par email</button>
          <button class="btn gold" id="pr-print">${I('print')} Imprimer ou PDF</button>
        </div>
      </div>
      <p class="help no-print" style="margin:0 0 14px">Pour joindre le document, enregistrez-le en PDF depuis la fenêtre d'impression, puis ajoutez-le au message.</p>
      ${docHtml(kind, obj)}`;

    document.getElementById('pr-print').onclick = () => {
      log.push({ type: 'impression', date: new Date().toISOString() });
      S().save();
      window.print();
      UI.render();
    };
    document.getElementById('pr-mail').onclick = () => {
      const label = kind === 'devis' ? 'Devis' : 'Facture';
      const subject = `${label} ${obj.numero} — ${db.settings.company.name}`;
      const body = `Bonjour ${cli.contact || cli.nom || ''},\n\nVeuillez trouver ci-joint notre ${label.toLowerCase()} ${obj.numero}` +
        (kind === 'devis' ? ` (montant net : ${S().money(V().totalDevis(obj).ttc)} TTC, valable ${db.settings.validite_devis_jours} jours).` : ` d'un montant de ${S().money(V().totalFacture(obj).ttc)} TTC, à régler avant le ${S().dateFr(obj.date_echeance)}.`) +
        `\n\nJe reste à votre disposition pour toute question.\n\nBien cordialement,\n${db.settings.commercial || ''}\n${db.settings.company.name}\n${db.settings.company.phone || ''}`;
      log.push({ type: 'envoi', date: new Date().toISOString(), to: cli.email || '' });
      S().save();
      window.location.href = `mailto:${encodeURIComponent(cli.email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      UI.toast('Message préparé dans votre messagerie');
      setTimeout(() => UI.render(), 300);
    };
  }

  /* ---------- Paramètres ---------- */
  function settings(box) {
    const st = S().db.settings;
    const c = st.company;
    const field = (label, attrs, full) => `<div class="field ${full ? 'full' : ''}"><label>${label}</label>${attrs}</div>`;
    box.innerHTML = `<div id="settings-root">
      <div class="card">
        <div class="card-head"><div><h2>Entreprise</h2><span class="muted">Apparaît en haut de vos devis et factures</span></div></div>
        <div class="grid grid-form">
          ${field('Nom', `<input data-c="name" value="${esc(c.name)}">`)}
          ${field('Adresse', `<input data-c="address" value="${esc(c.address)}">`)}
          ${field('Téléphone', `<input data-c="phone" value="${esc(c.phone)}">`)}
          ${field('Email', `<input data-c="email" value="${esc(c.email)}">`)}
          ${field('SIRET', `<input data-c="siret" value="${esc(c.siret)}">`)}
          ${field('N° TVA intracommunautaire', `<input data-c="tva_intra" value="${esc(c.tva_intra)}">`)}
          ${field('IBAN', `<input data-c="iban" value="${esc(c.iban)}">`)}
          ${field('Nom du commercial', `<input data-s="commercial" value="${esc(st.commercial)}">`)}
          ${field('Mention en bas de facture', `<textarea data-c="legal_note">${esc(c.legal_note)}</textarea>`, true)}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><div><h2>Ventes et numérotation</h2><span class="muted">Taux de TVA disponibles : ${st.tva_rates.join(' %, ')} %</span></div></div>
        <div class="grid grid-form">
          ${field('Préfixe devis', `<input data-s="devis_prefix" value="${esc(st.devis_prefix)}">`)}
          ${field('Préfixe commande', `<input data-s="commande_prefix" value="${esc(st.commande_prefix)}">`)}
          ${field('Préfixe facture', `<input data-s="facture_prefix" value="${esc(st.facture_prefix)}">`)}
          ${field('Préfixe achat', `<input data-s="achat_prefix" value="${esc(st.achat_prefix)}">`)}
          ${field('TVA par défaut', `<select data-s="default_tva" data-num="1">${st.tva_rates.map(r => `<option value="${r}" ${st.default_tva === r ? 'selected' : ''}>${r} %</option>`).join('')}</select>`)}
          ${field('Validité des devis (jours)', `<input type="number" min="0" data-s="validite_devis_jours" data-num="1" value="${st.validite_devis_jours}">`)}
          ${field('Relance après (jours)', `<input type="number" min="0" data-s="delai_relance_jours" data-num="1" value="${st.delai_relance_jours}">`)}
          ${field('Alerte stock ancien après (jours)', `<input type="number" min="0" data-s="delai_stockage_alerte" data-num="1" value="${st.delai_stockage_alerte || 14}">`)}
          ${field('Téléphone réception (SMS d\'arrivage)', `<input data-s="tel_reception" value="${esc(st.tel_reception)}" inputmode="tel" placeholder="06 00 00 00 00">`)}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><div><h2>Sauvegarde et restauration</h2><span class="muted">Les données sont stockées dans ce navigateur. Exportez une sauvegarde régulièrement.</span></div></div>
        <div class="btn-row">
          <button class="btn" id="se-export">${I('export')} Exporter la sauvegarde</button>
          <label class="btn ghost" style="cursor:pointer">Importer une sauvegarde<input type="file" accept="application/json" id="se-import" hidden></label>
          <button class="btn ghost danger" id="se-reset">Tout effacer</button>
        </div>
      </div>
      <div class="savebar"><span class="dirty"></span><button class="btn" id="se-save">${I('check')} Enregistrer les paramètres</button></div>
    </div>`;

    const root = document.getElementById('settings-root');
    const bar = root.querySelector('.savebar');
    root.addEventListener('input', () => { bar.querySelector('.dirty').classList.add('on'); bar.querySelector('.dirty').textContent = 'Modifications non enregistrées'; });
    document.getElementById('se-save').onclick = () => {
      root.querySelectorAll('[data-c]').forEach(el => { st.company[el.dataset.c] = el.value.trim(); });
      root.querySelectorAll('[data-s]').forEach(el => {
        st[el.dataset.s] = el.dataset.num ? Number(el.value) || 0 : el.value.trim();
      });
      UI.commit('Paramètres enregistrés');
    };
    document.getElementById('se-export').onclick = () => S().exportJson();
    document.getElementById('se-import').onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      UI.confirmBox('Remplacer toutes les données actuelles par cette sauvegarde ?', async () => {
        try { await S().importJson(f); UI.toast('Sauvegarde restaurée'); UI.render(); }
        catch (err) { UI.toast('Fichier invalide : ' + err.message, true); }
      }, 'Remplacer');
    };
    document.getElementById('se-reset').onclick = () => UI.confirmBox('Effacer toutes les données ? Pensez à exporter une sauvegarde avant.', () => {
      S().resetAll(); UI.toast('Données effacées'); UI.render();
    });
  }

  UI.register('apercu-', { title: 'Aperçu', sub: 'Document prêt à imprimer', render: apercu });
  UI.register('parametres', { title: 'Paramètres', sub: 'Entreprise, numérotation, sauvegarde', render: settings });
})();

/**
 * Recherche d'article.
 *
 * Le magasin aura plus de 20 000 references. La version precedente construisait
 * une liste HTML de tous les articles, reconstruite a chaque ligne de devis :
 * inutilisable a cette echelle.
 *
 * Ici, un index en memoire est construit une fois, puis reutilise. La recherche
 * parcourt des chaines deja mises en minuscules, ce qui tient en quelques
 * millisecondes sur 20 000 lignes, et seuls les premiers resultats sont mis en
 * HTML : c'est le dessin qui coute, pas la recherche.
 *
 * Le filtre par usine repond a une demande precise de Pierre-Louis : quand il
 * cherche une reference, il sait de quelle usine elle vient.
 */
(function () {
  const S = () => window.Store;
  const UI = window.UI;
  const I = UI.icon;
  const esc = UI.esc;

  let index = null;
  let signature = '';

  /**
   * Minuscules sans accents. Indispensable ici : personne ne tape le trema de
   * « Faience », ni l'accent de « Gres cerame », et une recherche qui ne les
   * trouve pas passe pour cassee.
   */
  const plat = (x) => String(x || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  /** La signature change des qu'un article est ajoute, retire ou renomme. */
  function signatureActuelle() {
    const a = S().db.articles;
    return a.length + ':' + (a.length ? (a[a.length - 1].id + a[a.length - 1].ref) : '');
  }

  function construireIndex() {
    const sig = signatureActuelle();
    if (index && sig === signature) return index;
    index = S().db.articles.map(a => ({
      a,
      t: plat([a.ref, a.designation, a.format, a.usine, a.code_barre, a.emplacement]
          .filter(Boolean).join(' ')),
      // L'usine mise a plat une fois pour toutes : la recalculer a chaque
      // ligne doublait le temps du filtre « mot + usine » sur 20 000 articles.
      u: plat(a.usine),
      r: plat(a.ref),
    }));
    signature = sig;
    return index;
  }

  /** Force la reconstruction : a appeler apres une modification d'article. */
  function invalider() { index = null; signature = ''; }

  function usines() {
    const vues = new Map();
    S().db.articles.forEach(a => {
      const u = (a.usine || '').trim();
      if (u) vues.set(u.toLowerCase(), u);
    });
    return [...vues.values()].sort((x, y) => x.localeCompare(y));
  }

  /**
   * Cherche. Rend les articles retenus et le nombre total trouve, pour pouvoir
   * dire « 340 resultats, affinez » sans tout dessiner.
   */
  function chercher(q, filtres, limite) {
    const f = filtres || {};
    const mots = plat(q).trim().split(/\s+/).filter(Boolean);
    const usine = plat(f.usine);
    const fournisseur = f.fournisseur_id || '';
    const max = limite || 25;

    const out = [];
    let total = 0;
    for (const e of construireIndex()) {
      if (usine && e.u !== usine) continue;
      if (fournisseur && e.a.fournisseur_id !== fournisseur) continue;
      if (mots.length && !mots.every(m => e.t.includes(m))) continue;
      total++;
      if (out.length < max * 4) out.push(e.a);
    }
    // Ce qui commence par la recherche passe devant : on tape le debut d'une
    // reference bien plus souvent qu'un morceau du milieu.
    if (mots.length) {
      const d = mots[0];
      out.sort((x, y) => {
        const dx = plat(x.ref).startsWith(d) ? 0 : 1;
        const dy = plat(y.ref).startsWith(d) ? 0 : 1;
        return dx - dy || String(x.ref || '').localeCompare(String(y.ref || ''));
      });
    } else {
      out.sort((x, y) => (x.ref || '').localeCompare(y.ref || ''));
    }
    return { articles: out.slice(0, max), total };
  }

  const prixDe = (a, achat) => achat ? a.prix_achat : a.prix_vente;

  function ligneResultat(a, achat, i) {
    const dispo = Number(a.stock) || 0;
    return `<button type="button" class="ar-item" data-id="${a.id}" data-i="${i}">
      <span class="ar-ref">${esc(a.ref)}</span>
      <span class="ar-des">${esc(a.designation)}</span>
      <span class="ar-meta">${[a.format, a.usine].filter(Boolean).map(esc).join(' · ')}</span>
      <span class="ar-stock ${dispo <= 0 ? 'vide' : ''}">${S().num(dispo)} ${esc(a.unite || '')}</span>
      <span class="ar-prix">${S().money(prixDe(a, achat))}</span>
    </button>`;
  }

  /* ---------- Recherche avancee, en fenetre ---------- */
  function ouvrir(options) {
    const o = options || {};
    const db = S().db;
    const listeUsines = usines();

    // UI.modal rend { close, body } : c'est par la qu'on ferme apres un choix.
    // Chercher le bouton dans le DOM ne marchait pas, la fenetre restait
    // ouverte par-dessus le devis qu'on venait de remplir.
    const fenetre = UI.modal('Rechercher un article', `
      <div class="ar-filtres">
        <input type="search" id="ar-q" placeholder="Référence, désignation, format, code-barres…"
               value="${esc(o.terme || '')}" autocomplete="off" spellcheck="false">
        <select id="ar-usine">
          <option value="">Toutes les usines</option>
          ${listeUsines.map(u => `<option value="${esc(u)}" ${o.usine === u ? 'selected' : ''}>${esc(u)}</option>`).join('')}
        </select>
        <select id="ar-fourn">
          <option value="">Tous les fournisseurs</option>
          ${db.fournisseurs.map(f => `<option value="${f.id}">${esc(f.nom)}</option>`).join('')}
        </select>
      </div>
      <div class="ar-entete">
        <span>Référence</span><span>Désignation</span><span>Format et usine</span>
        <span class="num">Stock</span><span class="num">${o.achat ? 'Achat' : 'Vente'}</span>
      </div>
      <div class="ar-resultats" id="ar-res"></div>
      <div class="ar-pied" id="ar-pied"></div>`, [
      { label: 'Fermer', cls: 'ghost', fn: (b, close) => close() }
    ], { wide: true });

    const champ = document.getElementById('ar-q');
    const zone = document.getElementById('ar-res');
    const pied = document.getElementById('ar-pied');
    let courants = [];
    let pos = -1;

    const dessiner = () => {
      const debut = performance.now();
      const r = chercher(champ.value, {
        usine: document.getElementById('ar-usine').value,
        fournisseur_id: document.getElementById('ar-fourn').value,
      }, 40);
      courants = r.articles;
      pos = -1;
      zone.innerHTML = courants.length
        ? courants.map((a, i) => ligneResultat(a, o.achat, i)).join('')
        : `<div class="ar-rien">Aucun article ne correspond.</div>`;
      const ms = Math.round(performance.now() - debut);
      pied.textContent = r.total
        ? `${r.total} article${r.total > 1 ? 's' : ''} trouvé${r.total > 1 ? 's' : ''}`
          + (r.total > courants.length ? `, ${courants.length} affichés` : '')
          + ` · ${ms} ms`
        : '';
      zone.querySelectorAll('.ar-item').forEach(b => b.onclick = () => {
        const a = db.articles.find(x => x.id === b.dataset.id);
        if (a && o.onChoisir) o.onChoisir(a);
        fenetre.close();
      });
    };

    champ.addEventListener('input', dessiner);
    document.getElementById('ar-usine').addEventListener('change', dessiner);
    document.getElementById('ar-fourn').addEventListener('change', dessiner);
    champ.addEventListener('keydown', (e) => {
      const items = [...zone.querySelectorAll('.ar-item')];
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!items.length) return;
        pos = (pos + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach((x, i) => x.classList.toggle('actif', i === pos));
        items[pos].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && pos >= 0 && items[pos]) {
        e.preventDefault(); items[pos].click();
      }
    });
    dessiner();
    champ.focus();
    champ.select();
  }

  window.ChoixArticle = { chercher, ouvrir, usines, invalider, ligneResultat, construireIndex };
})();

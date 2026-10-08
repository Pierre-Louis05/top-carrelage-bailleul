/**
 * Sidebar collapsible — Espace Équipe Top Carrelage
 * Behavior: collapsed (icons only) by default
 *           expands on hover
 *           pin button keeps it expanded permanently (saved in localStorage)
 */
(function () {
/* ===========================================================================
   Icones du menu.
   Elles remplacent les emojis, que la charte Top Amenagement interdit et qui
   s'affichaient differemment d'un appareil a l'autre. Trait de 1,7 px,
   24 x 24, meme facture que les icones du site public.
   =========================================================================== */
const ICONES = {
  demandes:  '<path d="M3 9h18M8 3v4M16 3v4"/><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 14h3"/>',
  messages:  '<path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z"/>',
  avis:      '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  stock:     '<path d="M3 9h18M3 15h18M9 3v18M15 3v18"/><rect x="3" y="3" width="18" height="18" rx="2"/>',
  suivi:     '<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  passage:   '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/><path d="M14 6l4 4"/>',
  relance:   '<path d="M3.5 5.5A2 2 0 0 1 5.5 3.5h2l1.5 3.6-1.8 1.3a12 12 0 0 0 5.4 5.4l1.3-1.8 3.6 1.5v2a2 2 0 0 1-2 2A14.5 14.5 0 0 1 3.5 5.5z"/><path d="M16.5 2.5v3h3"/>',
  depot:     '<path d="M12 3v11M8 10l4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  planning:  '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 14h2M14 14h2M8 17h2"/>',
  horaires:  '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  pointage:  '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
  conges:    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  commandes: '<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>',
  presence:  '<circle cx="9" cy="8" r="3.4"/><path d="M2 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5"/><path d="M17 8.5a3 3 0 0 0 0-5"/><path d="M19 20c0-2.4-.9-4.2-2.3-5.3"/>',
};


/* Icones de contenu, utilisees dans les pages et pas seulement dans le menu. */
Object.assign(ICONES, {
  telephone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1A19.5 19.5 0 0 1 4.7 13 19.8 19.8 0 0 1 1.6 4.4 2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L7.9 9.9a16 16 0 0 0 6.2 6.2l1.9-1.9a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.1 2z"/>',
  mail:      '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
  date:      '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  corbeille: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
  dossier:   '<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  vide:      '<path d="M3 9h4l2 4h6l2-4h4"/><path d="M5 5h14l2 8v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z"/>',
  loupe:     '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  colis:     '<path d="M3 7l9-4 9 4"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10M3 7l9 4 9-4"/>',
  camion:    '<path d="M3 16V6a1 1 0 0 1 1-1h10v11"/><path d="M14 9h4l3 3v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  personne:  '<circle cx="12" cy="8" r="3.6"/><path d="M4 21c0-3.9 3.6-6.5 8-6.5s8 2.6 8 6.5"/>',
  groupe:    '<circle cx="9" cy="8" r="3.4"/><path d="M2 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5"/><path d="M17 8.5a3 3 0 0 0 0-5M19 20c0-2.4-.9-4.2-2.3-5.3"/>',
  alerte:    '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  valide:    '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.3 2.4 2.4 4.6-4.9"/>',
  horloge:   '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  repas:     '<path d="M6 3v8a3 3 0 0 0 6 0V3"/><path d="M9 11v10"/><path d="M17 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4v9"/>',
  soleil:    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  aube:      '<path d="M17 18a5 5 0 0 0-10 0"/><path d="M12 4v3M4.9 10.9l1.4 1.4M2 18h2M20 18h2M17.7 12.3l1.4-1.4"/><path d="M2 22h20"/>',
  maison:    '<path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  bulle:     '<path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z"/>',
  graphique: '<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>',
  liste:     '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  casier:    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18"/><path d="M10 7h4M10 12.5h4M10 17.5h4"/>',
  douche:    '<path d="M8 20v-7a4 4 0 0 1 8 0v7"/><path d="M12 9V5a2 2 0 0 1 2-2h5"/><path d="M7 20h10"/><path d="M10 13h.01M14 13h.01M12 16h.01"/>',
  crayon:    '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/><path d="M14 6l4 4"/>',
  sapin:     '<path d="M12 3 7 11h3l-4 6h12l-4-6h3z"/><path d="M12 17v4"/>',
});

/* Les pages fabriquent leur contenu en JavaScript : les marqueurs n'existent
   pas encore au premier passage. On redessine donc a chaque ajout au document. */

/* ===========================================================================
   Pastilles de nouveautes.
   Elles comptent ce qui attend quelqu'un, sur chaque entree du menu et sur
   toutes les pages. Sans elles, il fallait ouvrir chaque page pour savoir
   s'il y avait du nouveau.
   =========================================================================== */
const A_COMPTER = [
  { lien: 'dashboard.html',  table: 'rdv_requests',     colonne: 'status', valeur: 'nouveau' },
  { lien: 'messages.html',   table: 'contact_requests', colonne: 'status', valeur: 'nouveau' },
  { lien: 'temoignages.html',table: 'testimonials',     colonne: 'status', valeur: 'en_attente' },
  { lien: 'suivi.html',      table: 'suivi_projets',    colonne: 'etape',  valeur: 'premier_passage' },
  // Les relances ne se comptent pas par egalite mais par date : tout ce qui
  // est du aujourd'hui ou en retard. D'ou ce filtre libre.
  { lien: 'relances.html',   table: 'suivi_projets',
    filtre: (q) => q.not('prochaine_relance', 'is', null)
                    .lte('prochaine_relance', new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
                                                .toISOString().slice(0, 10))
                    .eq('relance_arretee', false) },
];

/**
 * Retrouve un lien du menu a partir de son nom de fichier.
 *
 * Netlify sert les pages sans « .html » et reecrit les liens en chemins
 * absolus : href="suivi.html" devient href="/espace-equipe/suivi". Chercher la
 * chaine exacte ne trouvait donc rien en production, et aucune pastille ne
 * s'affichait en ligne alors que tout marchait en local. On compare le dernier
 * segment du chemin, sans extension.
 */
function lienVers(page) {
  const cible = page.replace(/\.html$/, '');
  return [...document.querySelectorAll('.sidebar-link')].find((a) => {
    const h = (a.getAttribute('href') || '').replace(/[?#].*$/, '');
    return h.replace(/\.html$/, '').split('/').filter(Boolean).pop() === cible;
  }) ?? null;
}

async function compterNouveautes() {
  // Les pages declarent leur client avec « const db » : une declaration
  // lexicale, qui n'est pas une propriete de window et qu'on ne peut donc pas
  // lire d'ici de facon fiable. On ouvre notre propre connexion, avec la meme
  // cle publique que les dix-sept pages.
  if (typeof supabase === 'undefined') return;
  if (!compterNouveautes._base) {
    compterNouveautes._base = supabase.createClient(
      'https://hzploaweyewjyxdhpmvo.supabase.co',
      'sb_publishable_NfYsr2yMHIYRJ6F3H96EXg_KWZE4_RQ');
  }
  const base = compterNouveautes._base;

  const { data: { session } } = await base.auth.getSession();
  if (!session) return;

  let total = 0;
  for (const c of A_COMPTER) {
    const lien = lienVers(c.lien);
    if (!lien) continue;
    try {
      let requete = base.from(c.table).select('id', { count: 'exact', head: true });
      requete = c.filtre ? c.filtre(requete) : requete.eq(c.colonne, c.valeur);
      const { count, error } = await requete;
      if (error || !count) { retirerPastille(lien); continue; }
      poserPastille(lien, count);
      total += count;
    } catch (e) {
      retirerPastille(lien);   // table absente : on n'affiche rien plutot qu'un zero
    }
  }
  // Le titre de l'onglet porte le total : on le voit sans revenir sur le site.
  const titre = document.title.replace(/^\(\d+\)\s*/, '');
  document.title = total ? `(${total}) ${titre}` : titre;
}

function poserPastille(lien, n) {
  let p = lien.querySelector('.sidebar-badge');
  if (!p) {
    p = document.createElement('span');
    p.className = 'sidebar-badge';
    lien.appendChild(p);
  }
  p.textContent = n > 99 ? '99+' : n;
  p.style.display = '';
  lien.classList.add('a-du-nouveau');
}

function retirerPastille(lien) {
  lien.querySelector('.sidebar-badge')?.remove();
  lien.classList.remove('a-du-nouveau');
}

function surveillerIcones() {
  dessinerIcones(document);
  new MutationObserver((changements) => {
    for (const c of changements) {
      if (c.addedNodes.length) { dessinerIcones(document); return; }
    }
  }).observe(document.body, { childList: true, subtree: true });
}

function dessinerIcones(racine) {
  racine.querySelectorAll('[data-ico]').forEach((el) => {
    const d = ICONES[el.dataset.ico];
    if (!d || el.firstChild) return;
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">${d}</svg>`;
  });
}

  function init() {
    const sidebar = document.querySelector('.sidebar');
    surveillerIcones();
    compterNouveautes();
    // Les collegues traitent les demandes pendant la journee : on rafraichit.
    setInterval(compterNouveautes, 60000);
    const main    = document.querySelector('.main-content');
    if (!sidebar || !main) return;

    // ── Restructure logo zone ──────────────────────────
    const logoEl = sidebar.querySelector('.sidebar-logo');
    if (logoEl) {
      // "MM" icon visible when collapsed
      const icon = document.createElement('div');
      icon.className = 'sidebar-logo-icon';
      icon.setAttribute('aria-hidden', 'true');
      logoEl.prepend(icon);

      // Wrap existing text content in .sidebar-logo-texts
      const main2   = logoEl.querySelector('.sidebar-logo-main');
      const sub     = logoEl.querySelector('.sidebar-logo-sub');
      if (main2 || sub) {
        const texts = document.createElement('div');
        texts.className = 'sidebar-logo-texts';
        if (main2) texts.appendChild(main2);
        if (sub)   texts.appendChild(sub);
        logoEl.appendChild(texts);
      }

      // Pin button
      const pinBtn = document.createElement('button');
      pinBtn.id = 'sidebarPinBtn';
      logoEl.appendChild(pinBtn);

      pinBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const nowPinned = !sidebar.classList.contains('pinned');
        applyPin(nowPinned);
        localStorage.setItem('mm-sidebar-pinned', nowPinned);
      });
    }

    // ── Wrap label text in sidebar-links ──────────────
    // Links look like: <a><span>emoji</span> Label text</a>
    // We need the label text in a <span> so CSS can fade it.
    sidebar.querySelectorAll('.sidebar-link').forEach(function (link) {
      link.childNodes.forEach(function (node) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
          const span = document.createElement('span');
          span.className = 'sidebar-link-label';
          span.textContent = node.textContent;
          node.replaceWith(span);
        }
      });
      // Add tooltip (shown when collapsed and NOT hovering sidebar)
      const labelEl = link.querySelector('.sidebar-link-label');
      if (labelEl) {
        link.setAttribute('data-tip', labelEl.textContent.trim());
      }
    });

    // ── Read saved pin state ───────────────────────────
    // Le menu est ouvert par defaut. Replie, il n'affichait que des icones et
    // il fallait survoler pour savoir ou l'on cliquait : c'est ce qui le
    // rendait difficile a prendre en main. Qui prefere le replier garde son
    // choix, mais ce n'est plus l'etat de depart.
    const memorise = localStorage.getItem('mm-sidebar-pinned');
    const savedPinned = memorise === null ? true : memorise === 'true';

    function applyPin(pinned) {
      sidebar.classList.toggle('pinned', pinned);
      sidebar.classList.toggle('expanded', pinned);
      main.classList.toggle('sidebar-pinned', pinned);

      const btn = document.getElementById('sidebarPinBtn');
      if (btn) {
        btn.innerHTML   = pinned ? '◀' : '▶';
        btn.title       = pinned ? 'Réduire la barre latérale' : 'Épingler';
      }
    }

    applyPin(savedPinned);

    // ── Menu téléphone ────────────────────────────────
    // Sous 900 px la barre sort de l'écran. Sans ce bouton, créé ici pour
    // toutes les pages d'un coup, elle était tout simplement inatteignable.
    const topbar = main.querySelector('.topbar');
    if (topbar) {
      const btn = document.createElement('button');
      btn.className = 'btn-menu';
      btn.id = 'btnMenuMobile';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Ouvrir le menu');
      btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = '<span></span>';
      topbar.prepend(btn);

      const voile = document.createElement('div');
      voile.className = 'voile-menu';
      document.body.appendChild(voile);

      function basculer(ouvrir) {
        sidebar.classList.toggle('mobile-open', ouvrir);
        voile.classList.toggle('visible', ouvrir);
        btn.setAttribute('aria-expanded', String(ouvrir));
        document.body.style.overflow = ouvrir ? 'hidden' : '';
      }

      btn.addEventListener('click', function () {
        basculer(!sidebar.classList.contains('mobile-open'));
      });
      voile.addEventListener('click', function () { basculer(false); });
      // On referme après un clic sur un lien, sinon le menu reste ouvert
      // par-dessus la page qu'on vient d'ouvrir.
      sidebar.querySelectorAll('.sidebar-link').forEach(function (a) {
        a.addEventListener('click', function () { basculer(false); });
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') basculer(false);
      });
      // Retour au grand écran : on nettoie l'état téléphone.
      window.addEventListener('resize', function () {
        if (window.innerWidth > 900 && sidebar.classList.contains('mobile-open')) {
          basculer(false);
        }
      });
    }

    // ── Hover behaviour ───────────────────────────────
    // Ne s'applique qu'au grand écran : sur un téléphone, un « survol »
    // déclenché par un doigt ouvrirait la barre par accident.
    sidebar.addEventListener('mouseenter', function () {
      if (window.innerWidth <= 900) return;
      if (!sidebar.classList.contains('pinned')) {
        sidebar.classList.add('expanded');
        main.classList.add('sidebar-pinned');
      }
    });

    sidebar.addEventListener('mouseleave', function () {
      if (window.innerWidth <= 900) return;
      if (!sidebar.classList.contains('pinned')) {
        sidebar.classList.remove('expanded');
        main.classList.remove('sidebar-pinned');
      }
    });
  }

  // Run after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

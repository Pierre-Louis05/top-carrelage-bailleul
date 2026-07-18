/**
 * Sidebar collapsible — Espace Équipe Top Carrelage
 * Behavior: collapsed (icons only) by default
 *           expands on hover
 *           pin button keeps it expanded permanently (saved in localStorage)
 */
(function () {
  function init() {
    const sidebar = document.querySelector('.sidebar');
    const main    = document.querySelector('.main-content');
    if (!sidebar || !main) return;

    // ── Restructure logo zone ──────────────────────────
    const logoEl = sidebar.querySelector('.sidebar-logo');
    if (logoEl) {
      // "MM" icon visible when collapsed
      const icon = document.createElement('div');
      icon.className = 'sidebar-logo-icon';
      icon.textContent = 'MM';
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
    const savedPinned = localStorage.getItem('mm-sidebar-pinned') === 'true';

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

    // ── Hover behaviour ───────────────────────────────
    sidebar.addEventListener('mouseenter', function () {
      if (!sidebar.classList.contains('pinned')) {
        sidebar.classList.add('expanded');
        main.classList.add('sidebar-pinned');
      }
    });

    sidebar.addEventListener('mouseleave', function () {
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

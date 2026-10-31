/* Démarrage de l'application */
(function () {
  function boot() {
    window.Store.load();
    window.UI.setupShell();
    if (!location.hash) location.hash = 'tableau';
    window.UI.render();
    if (window.Store.saveError) {
      window.UI.toast('Le stockage du navigateur est indisponible : les données ne seront pas conservées.', true);
    }
    // Rappel de sauvegarde si plus de 7 jours (une fois par session)
    try {
      const last = localStorage.getItem('topamenagement.lastExport');
      const seen = sessionStorage.getItem('topamenagement.remind');
      if (!seen && window.Store.db.devis.length + window.Store.db.factures.length > 0 &&
          (!last || (Date.now() - Number(last)) > 7 * 86400000)) {
        sessionStorage.setItem('topamenagement.remind', '1');
        setTimeout(() => window.UI.toast('Pensez à télécharger une sauvegarde (Paramètres).'), 1200);
      }
    } catch (e) { /* stockage bloqué : pas de rappel */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

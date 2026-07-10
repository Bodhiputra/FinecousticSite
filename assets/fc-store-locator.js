(function () {
  function initLocatorSearch() {
    var searchInput = document.getElementById('fc-locator-search');
    var body = document.getElementById('fc-locator-body');
    if (!searchInput || !body) return;

    searchInput.addEventListener('input', function () {
      var q = searchInput.value.trim().toLowerCase();
      var emptyState = document.getElementById('fc-locator-empty');
      var emptyQuery = document.getElementById('fc-locator-empty-query');
      var anyVisible = false;

      body.querySelectorAll('.fc-locator-card').forEach(function (card) {
        var match = !q || (card.dataset.country || '').toLowerCase().includes(q);
        card.classList.toggle('fc-locator-card--hidden', !match);
        if (match) anyVisible = true;
      });

      if (emptyState) {
        emptyState.classList.toggle('visible', !anyVisible && q.length > 0);
        if (emptyQuery) emptyQuery.textContent = searchInput.value.trim();
      }
    });
  }

  function init() {
    initLocatorSearch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', function (evt) {
    if (!evt.target.querySelector || !evt.target.querySelector('#fc-locator-search')) return;
    init();
  });
})();

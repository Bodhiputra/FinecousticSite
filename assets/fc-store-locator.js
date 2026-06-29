(function () {
  var ROW_HEIGHT = 8;
  var layoutFrame = null;

  function getLocatorGap(body) {
    var gap = parseFloat(getComputedStyle(body).rowGap);
    return Number.isFinite(gap) ? gap : 16;
  }

  function layoutLocatorMasonry() {
    var body = document.getElementById('fc-locator-body');
    if (!body) return;

    var gap = getLocatorGap(body);
    var cards = body.querySelectorAll('.fc-locator-card');

    cards.forEach(function (card) {
      card.style.gridRowEnd = 'span 1';
    });

    cards.forEach(function (card) {
      if (card.style.display === 'none') {
        card.style.gridRowEnd = '';
        return;
      }

      var height = card.scrollHeight;
      var span = Math.ceil((height + gap) / (ROW_HEIGHT + gap));
      card.style.gridRowEnd = 'span ' + Math.max(span, 1);
    });
  }

  function scheduleLocatorLayout() {
    if (layoutFrame) cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(function () {
      layoutFrame = null;
      layoutLocatorMasonry();
    });
  }

  function initLocatorSearch() {
    var searchInput = document.getElementById('fc-locator-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', function () {
      var q = searchInput.value.trim().toLowerCase();
      var cards = document.querySelectorAll('#fc-locator-body .fc-locator-card');
      var emptyState = document.getElementById('fc-locator-empty');
      var emptyQuery = document.getElementById('fc-locator-empty-query');
      var anyVisible = false;

      cards.forEach(function (card) {
        var match = !q || (card.dataset.country || '').toLowerCase().includes(q);
        card.style.display = match ? '' : 'none';
        if (match) anyVisible = true;
      });

      if (emptyState) {
        emptyState.classList.toggle('visible', !anyVisible && q.length > 0);
        if (emptyQuery) emptyQuery.textContent = searchInput.value.trim();
      }

      scheduleLocatorLayout();
    });
  }

  function initLocatorSection() {
    initLocatorSearch();
    scheduleLocatorLayout();
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(scheduleLocatorLayout, 120);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLocatorSection);
  } else {
    initLocatorSection();
  }

  document.addEventListener('shopify:section:load', initLocatorSection);

  if (typeof ResizeObserver !== 'undefined') {
    var body = document.getElementById('fc-locator-body');
    if (body) {
      new ResizeObserver(scheduleLocatorLayout).observe(body);
    }
  }
})();

(function () {

  function updateGridColumns() {
    const grid = document.getElementById('fc-dl-grid');
    if (!grid) return;
    const cards = grid.querySelectorAll('.fc-dl-card:not(.fc-hidden)');
    const maxCols = parseInt(grid.dataset.cols, 10) || 5;
    const cols = Math.max(1, Math.min(cards.length, maxCols));
    grid.style.setProperty('--fc-product-cols', String(cols));
  }

  function fcFitNames() {
    document.querySelectorAll('#fc-dl-grid .fc-dl-card-name').forEach(function (el) {
      el.style.fontSize = '';
      var size = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > el.offsetWidth && size > 7) {
        size -= 0.5;
        el.style.fontSize = size + 'px';
      }
    });
  }

  function init() {
    if (!document.getElementById('fc-dl-grid')) return;
    updateGridColumns();
    fcFitNames();
  }

  init();
  document.addEventListener('shopify:section:load', function (evt) {
    if (!evt.target.querySelector || !evt.target.querySelector('#fc-dl-grid')) return;
    init();
  });

  var fcFitTimer;
  window.addEventListener('resize', function () {
    clearTimeout(fcFitTimer);
    fcFitTimer = setTimeout(function () {
      updateGridColumns();
      fcFitNames();
    }, 120);
  });

})();

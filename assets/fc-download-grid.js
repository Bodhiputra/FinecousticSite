(function () {

  function updateGridColumns(grid) {
    if (!grid) return;
    const cards = grid.querySelectorAll('.fc-dl-card:not(.fc-hidden)');
    const maxCols = parseInt(grid.dataset.cols, 10) || 5;
    const cols = Math.max(1, Math.min(cards.length, maxCols));
    grid.style.setProperty('--fc-product-cols', String(cols));
  }

  function fcFitNames(grid) {
    if (!grid) return;
    grid.querySelectorAll('.fc-dl-card-name').forEach(function (el) {
      el.style.fontSize = '';
      var size = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > el.offsetWidth && size > 7) {
        size -= 0.5;
        el.style.fontSize = size + 'px';
      }
    });
  }

  function initGrid(grid) {
    if (!grid) return;
    updateGridColumns(grid);
    fcFitNames(grid);
  }

  function initAll() {
    document.querySelectorAll('.fc-dl-grid').forEach(initGrid);
  }

  window.FcDownloadGrid = { init: initGrid };

  initAll();
  document.addEventListener('shopify:section:load', function (evt) {
    if (!evt.target.querySelector || !evt.target.querySelector('.fc-dl-grid')) return;
    initAll();
  });

  var fcFitTimer;
  window.addEventListener('resize', function () {
    clearTimeout(fcFitTimer);
    fcFitTimer = setTimeout(initAll, 120);
  });

})();

(function () {
  var root = document.querySelector('.fc-pdp[data-section-id]');
  if (!root) return;

  var sId = root.getAttribute('data-section-id');
  var variantId = parseInt(root.querySelector('[data-variant-id]')?.getAttribute('data-variant-id') || '0', 10);
  var gallery = root.querySelector('[data-fc-pdp-gallery]');
  var slides = root.querySelectorAll('.fc-pdp__slide');
  var total = slides.length;

  function keepVideosPlaying() {
    root.querySelectorAll('video').forEach(function (video) {
      video.muted = true;
      video.loop = true;
      video.autoplay = true;
      var playPromise = video.play();
      if (playPromise && playPromise.catch) playPromise.catch(function () {});
    });
  }

  if (gallery && total > 1 && window.FcIgGallery) {
    window.FcIgGallery({
      viewport: gallery.querySelector('.fc-pdp__stage'),
      slideSelector: '.fc-pdp__slide',
      loop: true,
      onChange: keepVideosPlaying
    }).init();
  } else {
    keepVideosPlaying();
  }

  root.querySelectorAll('video').forEach(function (video) {
    video.addEventListener('pause', function () {
      if (!video.ended) keepVideosPlaying();
    });
  });

  function syncPrices(html) {
    root.querySelectorAll('[data-fc-pdp-price]').forEach(function (el) {
      el.innerHTML = html;
    });
    root.querySelectorAll('[data-variant-id]').forEach(function (el) {
      el.dataset.variantId = variantId;
    });
    var dock = document.getElementById('fc-pdp-dock-' + sId);
    if (dock) {
      dock.querySelectorAll('[data-variant-id]').forEach(function (el) {
        el.dataset.variantId = variantId;
      });
    }
  }

  root.querySelectorAll('.fc-pdp__variant').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      variantId = parseInt(btn.dataset.variantId, 10);
      root.querySelectorAll('.fc-pdp__variant').forEach(function (b) {
        b.classList.toggle('is-selected', b === btn);
      });
      if (btn.dataset.variantPrice) syncPrices(btn.dataset.variantPrice);
    });
  });

  root.querySelectorAll('.fc-pdp__atc').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (window.fcAddToCart) window.fcAddToCart(variantId, 1);
    });
  });

  var dock = document.getElementById('fc-pdp-dock-' + sId);
  if (dock) dock.hidden = false;
})();

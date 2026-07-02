(function () {
  var root = document.querySelector('.fc-pdp-u[data-section-id]');
  if (!root) return;

  var sId = root.getAttribute('data-section-id');
  var variantId = parseInt(root.querySelector('[data-variant-id]')?.getAttribute('data-variant-id') || '0', 10);
  var gallery = root.querySelector('[data-fc-pdp-gallery]');
  var slides = root.querySelectorAll('.fc-pdp-u__slide');
  var total = slides.length;
  var variantGallery = gallery && gallery.hasAttribute('data-fc-variant-gallery');
  var heroImg = root.querySelector('[data-fc-variant-slide] .fc-pdp-u__slide-media');

  function syncSlideVideos() {
    root.querySelectorAll('.fc-pdp-u__slide').forEach(function (slide) {
      var video = slide.querySelector('video');
      if (!video) return;
      video.muted = true;
      video.loop = true;
      if (slide.classList.contains('is-active')) {
        if (video.preload === 'none') video.preload = 'metadata';
        var playPromise = video.play();
        if (playPromise && playPromise.catch) playPromise.catch(function () {});
      } else {
        video.pause();
        try { video.currentTime = 0; } catch (e) {}
      }
    });
  }

  function scheduleHeroVideos() {
    var run = function () { syncSlideVideos(); };
    if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 600 });
    else setTimeout(run, 0);
  }

  var desktopStack = root.hasAttribute('data-fc-desktop-stack');
  var desktopMq = window.matchMedia('(min-width: 990px)');

  function isDesktopStack() {
    return desktopStack && desktopMq.matches;
  }

  function resetSlidesViewport() {
    if (!gallery) return;
    var slidesEl = gallery.querySelector('.fc-pdp-u__slides');
    if (!slidesEl) return;
    slidesEl.classList.remove('fc-ig-viewport', 'is-dragging', 'is-animating');
    slidesEl.style.height = '';
    slidesEl.style.maxHeight = '';
    delete slidesEl.dataset.fcIgGalleryBound;
    var track = slidesEl.querySelector('.fc-ig-track');
    if (track) {
      Array.from(track.children).forEach(function (node) {
        node.classList.remove('fc-ig-slide');
        node.style.transform = '';
        slidesEl.appendChild(node);
      });
      track.remove();
    }
  }

  function teardownHorizontalGallery() {
    if (!gallery) return;
    gallery.querySelectorAll('.fc-ig-dots').forEach(function (el) { el.remove(); });
    gallery.classList.remove('fc-ig-viewport', 'is-dragging', 'is-animating');
    resetSlidesViewport();
    delete gallery.dataset.fcIgGalleryBound;
    if (!isDesktopStack()) {
      root.querySelectorAll('.fc-pdp-u__slide').forEach(function (slide) {
        slide.classList.add('is-active');
      });
    }
  }

  var desktopScrollIo = null;

  function destroyDesktopScrollGallery() {
    if (desktopScrollIo) {
      desktopScrollIo.disconnect();
      desktopScrollIo = null;
    }
  }

  function initDesktopScrollGallery() {
    destroyDesktopScrollGallery();
    resetSlidesViewport();
    if (!isDesktopStack() || variantGallery || total <= 1) {
      if (isDesktopStack()) {
        root.querySelectorAll('.fc-pdp-u__slide').forEach(function (slide) {
          slide.classList.add('is-active');
        });
      }
      return;
    }

    root.querySelectorAll('.fc-pdp-u__slide').forEach(function (slide, i) {
      slide.classList.toggle('is-active', i === 0);
    });

    desktopScrollIo = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var slide = entry.target;
          root.querySelectorAll('.fc-pdp-u__slide').forEach(function (s) {
            s.classList.toggle('is-active', s === slide);
          });
          syncSlideVideos();
        });
      },
      { root: null, rootMargin: '-42% 0px -42% 0px', threshold: 0 }
    );

    slides.forEach(function (slide) {
      desktopScrollIo.observe(slide);
    });
    scheduleHeroVideos();
  }

  function initHorizontalGallery() {
    if (!gallery || variantGallery || total <= 1 || !window.FcIgGallery) return;
    if (gallery.dataset.fcIgGalleryBound === '1') return;
    window.FcIgGallery({
      viewport: gallery.querySelector('.fc-pdp-u__slides'),
      slideSelector: '.fc-pdp-u__slide',
      loop: true,
      onChange: syncSlideVideos
    }).init();
    scheduleHeroVideos();
  }

  function layoutDesktopAccordions() {
    if (!desktopStack) return;
    var slot = root.querySelector('[data-fc-desktop-accordions]');
    var specsInner = document.querySelector('[data-fc-specs-inbox-inner]');
    var specsMount = document.querySelector('[data-fc-specs-inbox-mount]');
    if (!slot || !specsInner || !specsMount) return;

    if (isDesktopStack()) {
      slot.appendChild(specsInner);
    } else if (specsInner.parentElement !== specsMount) {
      specsMount.appendChild(specsInner);
    }
  }

  function updateGalleryMode() {
    if (isDesktopStack()) {
      teardownHorizontalGallery();
      initDesktopScrollGallery();
      return;
    }

    destroyDesktopScrollGallery();

    if (variantGallery && gallery) {
      gallery.querySelectorAll('.fc-ig-dots').forEach(function (el) { el.remove(); });
      gallery.classList.remove('fc-ig-viewport');
      resetSlidesViewport();
      scheduleHeroVideos();
    } else {
      initHorizontalGallery();
      if (!gallery || gallery.dataset.fcIgGalleryBound !== '1') scheduleHeroVideos();
    }
  }

  function runDesktopLayout() {
    layoutDesktopAccordions();
    updateGalleryMode();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runDesktopLayout);
  } else {
    runDesktopLayout();
  }

  if (desktopStack) {
    desktopMq.addEventListener('change', runDesktopLayout);
  }

  function swapVariantHero(src, alt) {
    if (!heroImg || !src) return;
    heroImg.src = src;
    heroImg.removeAttribute('srcset');
    heroImg.removeAttribute('sizes');
    if (alt) heroImg.alt = alt;
  }

  var fcProductData = null;
  try {
    var fcDataEl = document.querySelector('script[id^="fc-data-"]');
    if (fcDataEl) fcProductData = JSON.parse(fcDataEl.textContent);
  } catch (e) {}

  function variantImageForId(id) {
    if (!fcProductData || !fcProductData.variants) return '';
    for (var i = 0; i < fcProductData.variants.length; i++) {
      if (fcProductData.variants[i].id === id && fcProductData.variants[i].image) {
        return fcProductData.variants[i].image;
      }
    }
    return '';
  }

  function syncPrices(html) {
    document.querySelectorAll('#fc-pdp-u-dock-' + sId + ' [data-fc-pdp-price], #' + root.id + ' [data-fc-pdp-price]').forEach(function (el) {
      el.innerHTML = html;
    });
    root.querySelectorAll('[data-variant-id]').forEach(function (el) {
      el.dataset.variantId = variantId;
    });
    var dock = document.getElementById('fc-pdp-u-dock-' + sId);
    if (dock) {
      dock.querySelectorAll('[data-variant-id]').forEach(function (el) {
        el.dataset.variantId = variantId;
      });
    }
  }

  function syncAtcState(available) {
    document.querySelectorAll('#fc-pdp-u-dock-' + sId + ' .fc-pdp-u__atc, #' + root.id + ' .fc-pdp-u__atc').forEach(function (atc) {
      atc.classList.toggle('is-oos', !available);
      atc.disabled = !available;
      atc.setAttribute('aria-disabled', available ? 'false' : 'true');
      var label = atc.querySelector('[data-fc-pdp-atc-label]');
      if (label) label.textContent = available ? 'Add to bag' : 'Sold Out';
    });
  }

  root.querySelectorAll('.fc-pdp-u__variant').forEach(function (btn) {
    btn.addEventListener('click', function () {
      variantId = parseInt(btn.dataset.variantId, 10);
      root.querySelectorAll('.fc-pdp-u__variant').forEach(function (b) {
        var selected = b === btn;
        b.classList.toggle('is-selected', selected);
        b.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
      if (btn.dataset.variantPrice) syncPrices(btn.dataset.variantPrice);
      syncAtcState(btn.dataset.variantAvailable === 'true');
      if (variantGallery) {
        var nextSrc = btn.dataset.variantImage || variantImageForId(variantId);
        swapVariantHero(nextSrc, btn.textContent ? btn.textContent.trim() : '');
      }
    });
  });

  root.querySelectorAll('.fc-pdp-u__atc').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      if (window.fcAddToCart) window.fcAddToCart(variantId, 1);
    });
  });

  /* Accordion open/close animation — wrap body in grid container */
  document.querySelectorAll('details.fc-pdp-acc').forEach(function (acc) {
    var body = acc.querySelector('.fc-pdp-acc__body');
    if (!body || body.parentElement.classList.contains('fc-pdp-acc__body-wrap')) return;
    var wrap = document.createElement('div');
    wrap.className = 'fc-pdp-acc__body-wrap';
    var inner = document.createElement('div');
    inner.className = 'fc-pdp-acc__body-inner';
    acc.insertBefore(wrap, body);
    wrap.appendChild(inner);
    inner.appendChild(body);

    acc.addEventListener('click', function (e) {
      if (e.target.closest('summary') === null) return;
      e.preventDefault();
      if (acc.open) {
        acc.classList.add('is-closing');
        wrap.addEventListener('transitionend', function handler() {
          wrap.removeEventListener('transitionend', handler);
          acc.removeAttribute('open');
          acc.classList.remove('is-closing');
        });
      } else {
        acc.setAttribute('open', '');
      }
    });
  });
})();

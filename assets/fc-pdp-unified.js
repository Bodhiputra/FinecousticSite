(function () {
  var root = document.querySelector('.fc-pdp-u[data-section-id]');
  if (!root) return;

  var fcProductData = null;
  try {
    var fcDataEl = document.querySelector('script[id^="fc-data-"]');
    if (fcDataEl) fcProductData = JSON.parse(fcDataEl.textContent);
  } catch (e) {
    console.error('fc-product-data JSON parse failed — add-to-bag may not work correctly.', e);
  }

  var isStudioPdp = root.hasAttribute('data-fc-studio-pdp');
  var purchaseCta = root.getAttribute('data-fc-purchase-cta') || 'add_to_bag';
  var comingSoonMode = isStudioPdp && purchaseCta === 'coming_soon';
  var purchaseModeSectionKey =
    root.getAttribute('data-fc-purchase-mode-section') || 'fc_purchase_mode_bridge';
  var purchaseModeRefreshPending = false;
  var COMING_SOON_LABEL = 'Coming Soon.';
  var NOT_AVAILABLE_LABEL = 'Not Available In Your Region';
  var sId = root.getAttribute('data-section-id');

  function isLaunchLockedAtc(btn) {
    return comingSoonMode || (btn && btn.classList.contains('is-coming-soon'));
  }

  function applyPurchaseModeFromServer(modeRaw) {
    if (!isStudioPdp) return;
    var mode = String(modeRaw || '')
      .toLowerCase()
      .trim();
    if (mode !== 'coming_soon' && mode !== 'add_to_bag') return;

    purchaseCta = mode;
    comingSoonMode = mode === 'coming_soon';
    root.setAttribute('data-fc-purchase-cta', purchaseCta);

    if (comingSoonMode) {
      allAtcButtons().forEach(function (atc) {
        applyComingSoonAtcState(atc);
      });
      return;
    }

    allAtcButtons().forEach(function (atc) {
      atc.classList.remove('is-coming-soon');
    });

    if (!comingSoonMode) {
      var activeEl = root.querySelector('[data-variant-id]');
      var activeId = activeEl ? parseInt(activeEl.getAttribute('data-variant-id') || '0', 10) : variantId;
      if (!activeId) activeId = variantId;
      syncAtcStateForVariant(activeId, true);
      fetchCartQtySync();
    }
  }

  function refreshPurchaseModeFromServer() {
    if (!isStudioPdp || purchaseModeRefreshPending) return;
    var handle = root.getAttribute('data-product-handle');
    if (!handle) return;

    purchaseModeRefreshPending = true;
    var rootPath = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
    var url =
      rootPath +
      'products/' +
      encodeURIComponent(handle) +
      '?sections=' +
      encodeURIComponent(purchaseModeSectionKey) +
      '&_=' +
      Date.now();

    fetch(url, { credentials: 'same-origin', cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('purchase mode refresh ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var html = data && data[purchaseModeSectionKey];
        if (!html) return;
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var bridge = doc.querySelector('[data-fc-purchase-mode]');
        if (!bridge) return;
        applyPurchaseModeFromServer(bridge.getAttribute('data-fc-purchase-mode'));
      })
      .catch(function (err) {
        console.warn('fc-pdp: purchase mode refresh failed', err);
      })
      .finally(function () {
        purchaseModeRefreshPending = false;
      });
  }

  function applyComingSoonAtcState(atc) {
    if (!atc) return;
    var label = atc.querySelector('[data-fc-pdp-atc-label]');
    atc.dataset.fcPurchasable = 'false';
    atc.dataset.fcAtcLabelDefault = COMING_SOON_LABEL;
    atc.classList.add('is-oos', 'is-coming-soon');
    atc.setAttribute('aria-disabled', 'true');
    atc.disabled = false;
    if (label) label.textContent = COMING_SOON_LABEL;
  }

  function applyNotAvailableAtcState(atc) {
    if (!atc) return;
    var label = atc.querySelector('[data-fc-pdp-atc-label]');
    atc.dataset.fcPurchasable = 'false';
    atc.dataset.fcAtcLabelDefault = NOT_AVAILABLE_LABEL;
    atc.classList.add('is-oos', 'is-coming-soon');
    atc.setAttribute('aria-disabled', 'true');
    atc.disabled = false;
    if (label) label.textContent = NOT_AVAILABLE_LABEL;
  }
  var selectedVariantEl = root.querySelector(
    '.fc-pdp-studio__swatch.is-selected[data-variant-id], .fc-pdp-u__atc[data-variant-id]'
  );
  var variantId = parseInt(
    (selectedVariantEl || root.querySelector('[data-variant-id]'))?.getAttribute('data-variant-id') || '0',
    10
  );
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
    syncSlideVideos();
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
    slidesEl.classList.remove('fc-ig-viewport', 'fc-ig-viewport--vertical', 'is-dragging', 'is-animating');
    slidesEl.style.height = '';
    slidesEl.style.maxHeight = '';
    delete slidesEl.dataset.fcIgGalleryBound;
    delete slidesEl.dataset.fcIgDragBound;
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

  function teardownGallery() {
    if (!gallery) return;
    gallery.querySelectorAll('.fc-ig-dots').forEach(function (el) { el.remove(); });
    gallery.classList.remove('fc-ig-viewport', 'fc-ig-viewport--vertical', 'is-dragging', 'is-animating');
    resetSlidesViewport();
    delete gallery.dataset.fcIgGalleryBound;
    if (!isDesktopStack()) {
      root.querySelectorAll('.fc-pdp-u__slide').forEach(function (slide) {
        slide.classList.add('is-active');
      });
    }
  }

  var desktopScrollRaf = null;
  var desktopScrollLastActive = null;

  function destroyDesktopScrollGallery() {
    window.removeEventListener('scroll', onDesktopScrollGalleryScroll);
    if (desktopScrollRaf) {
      cancelAnimationFrame(desktopScrollRaf);
      desktopScrollRaf = null;
    }
    desktopScrollLastActive = null;
  }

  function findActiveScrollSlide() {
    if (window.scrollY < 48 && slides[0]) return slides[0];
    var focusY = window.innerHeight * 0.33;
    var active = slides[0];
    for (var i = slides.length - 1; i >= 0; i--) {
      var rect = slides[i].getBoundingClientRect();
      if (rect.top <= focusY) {
        active = slides[i];
        break;
      }
    }
    return active;
  }

  function setActiveScrollSlide(activeSlide) {
    if (!activeSlide || activeSlide === desktopScrollLastActive) return;
    desktopScrollLastActive = activeSlide;
    root.querySelectorAll('.fc-pdp-u__slide').forEach(function (s) {
      s.classList.toggle('is-active', s === activeSlide);
    });
    syncSlideVideos();
  }

  function onDesktopScrollGalleryScroll() {
    if (desktopScrollRaf) return;
    desktopScrollRaf = requestAnimationFrame(function () {
      desktopScrollRaf = null;
      var centered = findActiveScrollSlide();
      if (centered) setActiveScrollSlide(centered);
    });
  }

  function initDesktopScrollGallery() {
    destroyDesktopScrollGallery();
    if (!isDesktopStack() || variantGallery || total <= 1) {
      if (isDesktopStack()) {
        root.querySelectorAll('.fc-pdp-u__slide').forEach(function (slide) {
          slide.classList.add('is-active');
        });
      }
      scheduleHeroVideos();
      return;
    }

    setActiveScrollSlide(slides[0]);
    window.addEventListener('scroll', onDesktopScrollGalleryScroll, { passive: true });
    onDesktopScrollGalleryScroll();
    scheduleHeroVideos();
  }

  function initHorizontalGallery() {
    if (!gallery || variantGallery || total <= 1 || !window.FcIgGallery) return;
    var slidesEl = gallery.querySelector('.fc-pdp-u__slides');
    if (!slidesEl || slidesEl.dataset.fcIgGalleryBound === '1') return;
    window.FcIgGallery({
      viewport: slidesEl,
      slideSelector: '.fc-pdp-u__slide',
      loop: true,
      onChange: syncSlideVideos
    }).init();
    scheduleHeroVideos();
  }

  function updateGalleryMode() {
    if (isStudioPdp) return;

    teardownGallery();
    destroyDesktopScrollGallery();

    if (isDesktopStack()) {
      initDesktopScrollGallery();
      return;
    }

    if (variantGallery) {
      scheduleHeroVideos();
      return;
    }

    initHorizontalGallery();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateGalleryMode);
  } else {
    updateGalleryMode();
  }

  if (desktopStack) {
    desktopMq.addEventListener('change', updateGalleryMode);
  }

  function bindExclusiveAccordions(container) {
    if (!container || container.dataset.fcAccExclusiveBound === '1') return;
    container.dataset.fcAccExclusiveBound = '1';

    container.querySelectorAll('details.fc-pdp-acc > summary').forEach(function (summary) {
      summary.addEventListener('click', function () {
        var clicked = summary.parentElement;
        container.querySelectorAll('details.fc-pdp-acc').forEach(function (other) {
          if (other !== clicked) other.removeAttribute('open');
        });
      });
    });
  }

  function bindSpecTabs(container) {
    if (!container || container.dataset.fcSpecTabsBound === '1') return;
    container.dataset.fcSpecTabsBound = '1';
    container.querySelectorAll('[data-spec-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.getAttribute('data-spec-tab');
        container.querySelectorAll('[data-spec-tab]').forEach(function (btn) {
          var active = btn.getAttribute('data-spec-tab') === target;
          btn.classList.toggle('is-active', active);
          btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        container.querySelectorAll('[data-spec-panel]').forEach(function (panel) {
          panel.classList.toggle('is-active', panel.getAttribute('data-spec-panel') === target);
        });
      });
    });
  }

  root.querySelectorAll('.fc-pdp-specs-inbox__inner').forEach(function (inner) {
    bindExclusiveAccordions(inner);
    bindSpecTabs(inner);
  });

  function swapVariantHero(src, alt) {
    if (!heroImg || !src) return;

    var currentSrc = heroImg.currentSrc || heroImg.src || '';
    if (currentSrc && currentSrc.split('?')[0] === src.split('?')[0]) {
      if (alt) heroImg.alt = alt;
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      heroImg.src = src;
      heroImg.removeAttribute('srcset');
      heroImg.removeAttribute('sizes');
      if (alt) heroImg.alt = alt;
      return;
    }

    var slide = heroImg.closest('[data-fc-variant-slide]');
    if (!slide) {
      heroImg.src = src;
      heroImg.removeAttribute('srcset');
      heroImg.removeAttribute('sizes');
      if (alt) heroImg.alt = alt;
      return;
    }

    var incoming = document.createElement('img');
    incoming.className = heroImg.className;
    incoming.src = src;
    incoming.alt = alt || heroImg.alt || '';
    incoming.loading = 'eager';
    incoming.decoding = 'async';
    incoming.style.opacity = '0';
    incoming.style.transition = 'opacity 0.45s ease';
    incoming.style.position = 'absolute';
    incoming.style.left = '50%';
    incoming.style.top = '0';
    incoming.style.transform = 'translateX(-50%)';
    incoming.style.pointerEvents = 'none';
    incoming.style.zIndex = '2';

    slide.style.position = 'relative';
    slide.appendChild(incoming);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        incoming.style.opacity = '1';
      });
    });

    function finish() {
      heroImg.src = src;
      heroImg.removeAttribute('srcset');
      heroImg.removeAttribute('sizes');
      if (alt) heroImg.alt = alt;
      incoming.remove();
      if (!slide.querySelector('.fc-pdp-u__slide-media[style*="opacity"]')) {
        slide.style.position = '';
      }
    }

    incoming.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 520);
  }

  function pulseAtcButton(btn) {
    if (!btn || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    btn.classList.remove('fc-atc-feedback');
    void btn.offsetWidth;
    btn.classList.add('fc-atc-feedback');
    btn.addEventListener(
      'animationend',
      function () {
        btn.classList.remove('fc-atc-feedback');
      },
      { once: true }
    );
  }

  function variantImageForId(id) {
    if (!fcProductData || !fcProductData.variants) return '';
    for (var i = 0; i < fcProductData.variants.length; i++) {
      if (fcProductData.variants[i].id === id && fcProductData.variants[i].image) {
        return fcProductData.variants[i].image;
      }
    }
    return '';
  }

  function priceHtmlForVariant(id) {
    var tpl = root.querySelector('template.fc-vprice-tpl[data-variant-id="' + id + '"]');
    return tpl ? tpl.innerHTML.trim() : '';
  }

  function syncPrices(html) {
    document.querySelectorAll('#fc-pdp-u-dock-' + sId + ' [data-fc-pdp-price], #' + root.id + ' [data-fc-pdp-price]').forEach(function (el) {
      el.innerHTML = html;
    });
    // Only the add-to-bag button follows the active variant.
    // Swatches and price templates keep their own data-variant-id.
    allAtcButtons().forEach(function (atc) {
      atc.dataset.variantId = String(variantId);
    });
  }

  function allAtcButtons() {
    return document.querySelectorAll('#fc-pdp-u-dock-' + sId + ' .fc-pdp-u__atc, #' + root.id + ' .fc-pdp-u__atc');
  }

  function variantFromData(id) {
    if (!fcProductData || !fcProductData.variants) return null;
    var targetId = Number(id);
    if (!targetId) return null;
    for (var i = 0; i < fcProductData.variants.length; i++) {
      if (Number(fcProductData.variants[i].id) === targetId) return fcProductData.variants[i];
    }
    return null;
  }

  function isAddToBagLaunchMode() {
    return !comingSoonMode && purchaseCta === 'add_to_bag';
  }

  function variantPurchasable(v) {
    if (!v) return false;
    if (comingSoonMode) return false;
    return !!v.available;
  }

  function atcQtyMaxForVariant(v) {
    if (!v) return null;
    if (isAddToBagLaunchMode()) {
      var max = null;
      if (v.quantityRuleMax != null && v.quantityRuleMax !== '') max = Number(v.quantityRuleMax);
      if (v.inventoryManagement === 'shopify' && v.inventoryPolicy !== 'continue') {
        var inv = Number(v.inventoryQuantity);
        if (Number.isFinite(inv) && inv > 0 && (max === null || inv < max)) max = inv;
      }
      return max;
    }
    if (!v.available) return null;
    var max = null;
    if (v.quantityRuleMax != null && v.quantityRuleMax !== '') max = Number(v.quantityRuleMax);
    if (v.inventoryManagement === 'shopify' && v.inventoryPolicy !== 'continue') {
      var inv = Number(v.inventoryQuantity);
      if (Number.isFinite(inv) && inv > 0 && (max === null || inv < max)) max = inv;
    }
    return max;
  }

  function canAddVariant(v, qtyInCart) {
    if (!variantPurchasable(v)) return false;
    var maxQty = atcQtyMaxForVariant(v);
    if (maxQty !== null && qtyInCart >= maxQty) return false;
    return true;
  }

  function restoreServerAtcLabels() {
    allAtcButtons().forEach(function (atc) {
      var defaultLabel = atc.dataset.fcAtcLabelDefault;
      if (comingSoonMode || defaultLabel === COMING_SOON_LABEL) {
        applyComingSoonAtcState(atc);
        return;
      }
      if (defaultLabel === NOT_AVAILABLE_LABEL) {
        applyNotAvailableAtcState(atc);
        return;
      }
      var purchasable = atc.dataset.fcPurchasable !== 'false';
      var label = atc.querySelector('[data-fc-pdp-atc-label]');
      if (label && defaultLabel) label.textContent = defaultLabel;
      atc.disabled = false;
      atc.classList.remove('is-coming-soon');
      if (purchasable) {
        atc.classList.remove('is-oos');
        atc.removeAttribute('aria-disabled');
      } else {
        atc.classList.add('is-oos');
        atc.setAttribute('aria-disabled', 'true');
      }
    });
  }

  function applyVariantMetaToAtc(v, updateLabel) {
    if (!v) return;
    var maxQty = atcQtyMaxForVariant(v);
    allAtcButtons().forEach(function (atc) {
      atc.dataset.variantId = String(v.id);
      if (maxQty !== null && maxQty > 0) atc.dataset.qtyMax = String(maxQty);
      else delete atc.dataset.qtyMax;
      atc.disabled = false;
      if (comingSoonMode) {
        if (updateLabel) applyComingSoonAtcState(atc);
        return;
      }
      if (!updateLabel) return;
      var label = atc.querySelector('[data-fc-pdp-atc-label]');
      if (variantPurchasable(v)) {
        atc.dataset.fcPurchasable = 'true';
        atc.dataset.fcAtcLabelDefault = 'Add to bag';
        atc.classList.remove('is-oos', 'is-coming-soon');
        atc.removeAttribute('aria-disabled');
        if (label) label.textContent = 'Add to bag';
      } else if (isAddToBagLaunchMode()) {
        applyNotAvailableAtcState(atc);
      } else {
        atc.dataset.fcPurchasable = 'false';
        atc.dataset.fcAtcLabelDefault = 'Sold Out';
        atc.classList.add('is-oos');
        atc.classList.remove('is-coming-soon');
        atc.setAttribute('aria-disabled', 'true');
        if (label) label.textContent = 'Sold Out';
      }
    });
  }

  function syncAtcStateForVariant(id, updateLabel) {
    applyVariantMetaToAtc(variantFromData(id), !!updateLabel);
    applyAtcQtyForVariantId(id);
  }

  function cartQtyByVariantFromProductData() {
    var map = {};
    if (!fcProductData || !Array.isArray(fcProductData.variants)) return map;
    fcProductData.variants.forEach(function (v) {
      map[Number(v.id)] = Math.max(0, Number(v.cartQty) || 0);
    });
    return map;
  }

  function updateProductDataCartQty(cart) {
    if (!fcProductData || !Array.isArray(fcProductData.variants) || !cart || !Array.isArray(cart.items)) return;
    var map = {};
    cart.items.forEach(function (item) {
      var id = Number(item.variant_id);
      if (!id) return;
      map[id] = (map[id] || 0) + Number(item.quantity || 0);
    });
    fcProductData.variants.forEach(function (v) {
      v.cartQty = map[Number(v.id)] || 0;
    });
  }

  function applyAtcQtyForVariantId(id) {
    if (!window.fcApplyPdpAtcQty) return;
    var map = cartQtyByVariantFromProductData();
    var qty = map[Number(id)];
    if (qty == null) {
      var atcWithQty = root.querySelector('.fc-pdp-u__atc[data-variant-id="' + id + '"][data-fc-qty]');
      qty = atcWithQty ? parseInt(atcWithQty.dataset.fcQty, 10) || 0 : 0;
    }
    allAtcButtons().forEach(function (atc) {
      window.fcApplyPdpAtcQty(atc, qty);
    });
  }

  function hydrateAtcQtyFromProductData() {
    applyAtcQtyForVariantId(variantId);
  }

  function syncAtcQtyFromCart(cart) {
    updateProductDataCartQty(cart);
    if (window.fcSyncPriceTagsFromCart) {
      window.fcSyncPriceTagsFromCart(cart);
    }
    applyAtcQtyForVariantId(variantId);
  }

  function fetchCartQtySync() {
    if (window.fcFetchCartForUiSync) {
      return window.fcFetchCartForUiSync().then(function (cart) {
        syncAtcQtyFromCart(cart);
        return cart;
      });
    }
    return fetch('/cart.js')
      .then(function (res) {
        return res.json();
      })
      .then(function (cart) {
        syncAtcQtyFromCart(cart);
        return cart;
      })
      .catch(function () {});
  }

  async function openBagDrawer() {
    if (window.fcOpenCartDrawerImmediate && window.fcOpenCartDrawerImmediate()) return true;
    if (window.fcOpenCartDrawer) return window.fcOpenCartDrawer();
    return false;
  }

  function waitForStudioHeroImage() {
    return new Promise(function (resolve) {
      var studioImg = root.querySelector(
        '.fc-pdp-u__slide.is-active[data-fc-variant-hidden="false"] .fc-pdp-u__slide-media, ' +
          '.fc-pdp-u__slide.is-active:not([data-fc-variant-hidden="true"]) .fc-pdp-u__slide-media'
      );
      if (!studioImg || studioImg.tagName !== 'IMG') {
        resolve();
        return;
      }
      if (studioImg.complete && studioImg.naturalWidth > 0) {
        resolve();
        return;
      }
      var settled = false;
      function done() {
        if (settled) return;
        settled = true;
        resolve();
      }
      studioImg.addEventListener('load', done, { once: true });
      studioImg.addEventListener('error', done, { once: true });
      window.setTimeout(done, 4000);
    });
  }

  var studioGalleryMap = null;
  try {
    var mapEl = document.getElementById('fc-studio-variant-gallery-map');
    if (mapEl) studioGalleryMap = JSON.parse(mapEl.textContent);
  } catch (e) {
    studioGalleryMap = null;
  }

  function studioGalleryMediaIdsForVariant(vid) {
    if (!studioGalleryMap) return null;
    var key = String(vid);
    var ids = studioGalleryMap[key];
    return ids && ids.length ? ids.map(String) : null;
  }

  function studioColorToneForVariant(vid) {
    var swatch = root.querySelector(
      '.fc-pdp-studio__swatch[data-variant-id="' + vid + '"], .fc-pdp-u__variant[data-variant-id="' + vid + '"]'
    );
    var label = swatch ? (swatch.getAttribute('aria-label') || swatch.getAttribute('title') || '') : '';
    return label.trim().toLowerCase();
  }

  function studioSwatchForTone(tone) {
    if (!tone) return null;
    var want = tone.toLowerCase();
    var swatches = root.querySelectorAll('.fc-pdp-studio__swatch[data-variant-id]');
    for (var i = 0; i < swatches.length; i++) {
      var label = (swatches[i].getAttribute('aria-label') || swatches[i].getAttribute('title') || '')
        .trim()
        .toLowerCase();
      if (label === want) return swatches[i];
    }
    return null;
  }

  function mediaVisibleForColor(tone, el) {
    var itemTone = (el.getAttribute('data-fc-color-tone') || 'white').toLowerCase();
    if (tone === 'black') return itemTone === 'black';
    if (tone === 'white') return itemTone !== 'black';
    return true;
  }

  function syncStudioThumbsOverflow(galleryEl) {
    if (!galleryEl) return;
    var outer = galleryEl.querySelector('[data-fc-studio-thumbs-outer]');
    var track = galleryEl.querySelector('[data-fc-studio-thumbs]');
    if (!outer || !track) return;
    var hasOverflow = track.scrollWidth > outer.clientWidth + 2;
    outer.classList.toggle('has-overflow', hasOverflow);
    var atEnd = track.scrollLeft + outer.clientWidth >= track.scrollWidth - 2;
    outer.classList.toggle('is-at-end', !hasOverflow || atEnd);
  }

  function scrollStudioThumbIntoViewIfNeeded(thumb, galleryEl) {
    if (!thumb || !galleryEl) return;
    var track = galleryEl.querySelector('[data-fc-studio-thumbs]');
    if (!track || track.scrollWidth <= track.clientWidth + 2) return;

    var pad = 6;
    var left = thumb.offsetLeft;
    var right = left + thumb.offsetWidth;
    var viewLeft = track.scrollLeft;
    var viewRight = viewLeft + track.clientWidth;

    if (left >= viewLeft + pad && right <= viewRight - pad) return;

    if (left < viewLeft + pad) {
      track.scrollLeft = Math.max(0, left - pad);
    } else if (right > viewRight - pad) {
      track.scrollLeft = Math.min(track.scrollWidth - track.clientWidth, right - track.clientWidth + pad);
    }
    syncStudioThumbsOverflow(galleryEl);
  }

  function revealStudioActiveThumb(galleryEl) {
    var g = galleryEl || root.querySelector('[data-fc-studio-gallery]');
    if (!g) return;
    var thumb = g.querySelector('[data-fc-studio-thumb].is-active[data-fc-media-id]');
    scrollStudioThumbIntoViewIfNeeded(thumb, g);
  }

  window.fcStudioRevealActiveThumb = revealStudioActiveThumb;

  var studioColorSyncLock = false;

  function studioSelectedColorTone() {
    var swatch = root.querySelector('.fc-pdp-studio__swatch.is-selected[data-variant-id]');
    if (swatch) {
      return (swatch.getAttribute('aria-label') || swatch.getAttribute('title') || '').trim().toLowerCase();
    }
    return studioColorToneForVariant(variantId);
  }

  function studioToneForMediaId(mediaId) {
    var galleryEl = root.querySelector('[data-fc-studio-gallery]');
    if (!galleryEl || !mediaId) return '';
    var thumbEl = galleryEl.querySelector(
      '[data-fc-studio-thumb][data-fc-media-id="' + String(mediaId) + '"]'
    );
    var slideEl = galleryEl.querySelector(
      '.fc-pdp-u__slide[data-fc-media-id="' + String(mediaId) + '"]'
    );
    var indexed = thumbEl || slideEl;
    if (indexed) {
      var rawIndex = thumbEl
        ? thumbEl.getAttribute('data-fc-studio-thumb')
        : slideEl.getAttribute('data-slide-index');
      var mediaIndex = parseInt(rawIndex, 10);
      if (!isNaN(mediaIndex)) return mediaIndex < 3 ? 'white' : 'black';
    }
    var toneSource = thumbEl || slideEl;
    return toneSource ? (toneSource.getAttribute('data-fc-color-tone') || '').toLowerCase() : '';
  }

  function studioEnsureAllSlidesVisible() {
    var galleryEl = root.querySelector('[data-fc-studio-gallery]');
    if (!galleryEl) return;
    galleryEl.querySelectorAll('.fc-pdp-u__slide[data-fc-media-id]').forEach(function (slide) {
      slide.removeAttribute('hidden');
      slide.setAttribute('data-fc-variant-hidden', 'false');
    });
    galleryEl.querySelectorAll('[data-fc-studio-thumb][data-fc-media-id]').forEach(function (thumb) {
      thumb.hidden = false;
    });
  }

  function studioSetActiveMediaFocus(focusMediaId, options) {
    options = options || {};
    if (!isStudioPdp || !focusMediaId) return;
    studioEnsureAllSlidesVisible();
    var galleryEl = root.querySelector('[data-fc-studio-gallery]');
    if (!galleryEl) return;

    var focusId = String(focusMediaId);
    var slides = galleryEl.querySelectorAll('.fc-pdp-u__slide[data-fc-media-id]');
    var thumbs = galleryEl.querySelectorAll('[data-fc-studio-thumb][data-fc-media-id]');

    slides.forEach(function (slide) {
      var active = slide.getAttribute('data-fc-media-id') === focusId;
      slide.classList.toggle('is-active', active);
    });

    thumbs.forEach(function (thumb) {
      var active = thumb.getAttribute('data-fc-media-id') === focusId;
      thumb.classList.toggle('is-active', active);
      thumb.setAttribute('aria-current', active ? 'true' : 'false');
    });

    syncStudioThumbsOverflow(galleryEl);
    revealStudioActiveThumb(galleryEl);

    if (options.goTo !== false && typeof window.fcStudioGoToMedia === 'function') {
      var goMediaId = focusId;
      requestAnimationFrame(function () {
        window.fcStudioGoToMedia(goMediaId);
      });
    }
  }

  function studioSyncVariantFromMedia(mediaId) {
    if (!isStudioPdp || studioColorSyncLock || !mediaId) return;
    var tone = studioToneForMediaId(mediaId);
    if (!tone) return;

    var currentTone = studioSelectedColorTone();
    studioColorSyncLock = true;
    try {
      if (tone !== currentTone) {
        var swatch = studioSwatchForTone(tone);
        if (swatch) applyVariantSwitch(swatch, { skipStudioGallery: true });
      }
      studioSetActiveMediaFocus(mediaId, { goTo: false });
    } finally {
      studioColorSyncLock = false;
    }
  }

  function studioSyncColorFromActiveMedia(mediaId) {
    if (!isStudioPdp || studioColorSyncLock) return;
    if (!mediaId) return;

    var tone = studioToneForMediaId(mediaId);
    var currentTone = studioSelectedColorTone();
    studioColorSyncLock = true;
    try {
      if (tone && tone !== currentTone) {
        var swatch = studioSwatchForTone(tone);
        if (swatch) applyVariantSwitch(swatch, { skipStudioGallery: true });
      }
      studioSetActiveMediaFocus(mediaId, { goTo: true });
    } finally {
      studioColorSyncLock = false;
    }
  }

  window.fcStudioSyncColorFromActiveMedia = studioSyncColorFromActiveMedia;
  window.fcStudioSyncVariantFromMedia = studioSyncVariantFromMedia;

  function studioSlideIsVisible(slide) {
    return slide.getAttribute('data-fc-variant-hidden') !== 'true';
  }

  function studioFirstMediaIdForTone(tone) {
    var want = (tone || '').toLowerCase();
    if (!want) return null;
    var galleryEl = root.querySelector('[data-fc-studio-gallery]');
    if (!galleryEl) return null;
    var nodes = galleryEl.querySelectorAll(
      '.fc-pdp-u__slide[data-fc-media-id][data-fc-color-tone], [data-fc-studio-thumb][data-fc-media-id][data-fc-color-tone]'
    );
    for (var i = 0; i < nodes.length; i++) {
      if ((nodes[i].getAttribute('data-fc-color-tone') || '').toLowerCase() === want) {
        return nodes[i].getAttribute('data-fc-media-id');
      }
    }
    return null;
  }

  function applyStudioVariantGallery(vid, focusMediaId) {
    if (!isStudioPdp) return;
    var colorTone = studioColorToneForVariant(vid);
    var focus = focusMediaId || studioFirstMediaIdForTone(colorTone);
    if (focus) studioSetActiveMediaFocus(focus, { goTo: true });
    else studioEnsureAllSlidesVisible();
  }

  if (isStudioPdp && variantId) {
    applyStudioVariantGallery(variantId);
  }

  (function bindStudioThumbsOverflow() {
    if (!isStudioPdp) return;
    var galleryEl = root.querySelector('[data-fc-studio-gallery]');
    if (!galleryEl) return;
    var track = galleryEl.querySelector('[data-fc-studio-thumbs]');
    var thumbOuter = galleryEl.querySelector('[data-fc-studio-thumbs-outer]');
    var wheelTarget = thumbOuter || track;
    if (!track) return;
    track.addEventListener('scroll', function () {
      syncStudioThumbsOverflow(galleryEl);
    }, { passive: true });
    window.addEventListener('resize', function () {
      syncStudioThumbsOverflow(galleryEl);
    }, { passive: true });
    syncStudioThumbsOverflow(galleryEl);

    function onStudioThumbsWheel(e) {
      if (!window.matchMedia('(min-width: 990px)').matches) return;
      var deltaY = e.deltaY || 0;
      var deltaX = e.deltaX || 0;
      if (Math.abs(deltaY) < 1 && Math.abs(deltaX) < 1) return;

      var delta = Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX;
      if (delta === 0) return;

      e.preventDefault();
      e.stopPropagation();

      var next = track.scrollLeft + delta;
      var max = Math.max(0, track.scrollWidth - track.clientWidth);
      track.scrollLeft = Math.max(0, Math.min(max, next));
      syncStudioThumbsOverflow(galleryEl);
    }

    var wheelHost = thumbOuter || track;
    wheelHost.addEventListener('wheel', onStudioThumbsWheel, { passive: false, capture: true });
  })();

  (function bindStudioThumbColorSwitch() {
    if (!isStudioPdp) return;
    var galleryEl = root.querySelector('[data-fc-studio-gallery]');
    if (!galleryEl) return;
    galleryEl.addEventListener(
      'click',
      function (e) {
        var thumb = e.target.closest('[data-fc-studio-thumb][data-fc-media-id]');
        if (!thumb) return;
        e.preventDefault();
        e.stopImmediatePropagation();

        var mediaId = thumb.getAttribute('data-fc-media-id');
        studioSyncColorFromActiveMedia(mediaId);
      },
      true
    );
  })();

  function applyVariantSwitch(btn, options) {
    options = options || {};
    variantId = parseInt(btn.dataset.variantId, 10);
    var variantScope =
      btn.closest('[data-fc-pdp-variants]') ||
      btn.closest('.fc-pdp-u__siblings') ||
      btn.closest('.fc-pdp-u__variant-list') ||
      root;
    variantScope.querySelectorAll('.fc-pdp-u__variant').forEach(function (b) {
      var selected = b === btn;
      b.classList.toggle('is-selected', selected);
      if (b.tagName === 'BUTTON') {
        b.setAttribute('aria-pressed', selected ? 'true' : 'false');
      }
    });
    if (btn.dataset.variantId) {
      var html = priceHtmlForVariant(variantId);
      if (html) syncPrices(html);
    }
    syncAtcStateForVariant(variantId, true);
    if (variantGallery) {
      var nextSrc = btn.dataset.variantImage || variantImageForId(variantId);
      swapVariantHero(nextSrc, btn.textContent ? btn.textContent.trim() : '');
    } else if (isStudioPdp && !options.skipStudioGallery) {
      var swatchTone = (btn.getAttribute('aria-label') || btn.getAttribute('title') || '').trim().toLowerCase();
      var focusMediaId = studioFirstMediaIdForTone(swatchTone);
      applyStudioVariantGallery(variantId, focusMediaId);
    }
    fetchCartQtySync();
  }

  root.querySelectorAll('.fc-pdp-u__variant').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      if (btn.classList.contains('is-selected')) return;

      if (btn.classList.contains('fc-pdp-u__sibling') && btn.tagName === 'A' && btn.href) {
        e.preventDefault();
        if (window.fcTransitionLoader && window.fcTransitionLoader.navigate) {
          window.fcTransitionLoader.navigate(btn.href);
        } else {
          window.location.assign(btn.href);
        }
        return;
      }

      if (!btn.dataset.variantId) return;

      e.preventDefault();

      if (btn.classList.contains('fc-pdp-studio__swatch')) {
        applyVariantSwitch(btn);
        return;
      }

      if (isStudioPdp && window.fcTransitionLoader && window.fcTransitionLoader.run) {
        window.fcTransitionLoader.run(function () {
          applyVariantSwitch(btn);
          return waitForStudioHeroImage();
        });
        return;
      }

      applyVariantSwitch(btn);
    });
  });

  function setAtcPending(pending) {
    allAtcButtons().forEach(function (atc) {
      atc.dataset.fcAtcPending = pending ? '1' : '0';
    });
  }

  allAtcButtons().forEach(function (btn) {
    btn.addEventListener(
      'pointerdown',
      function () {
        if (typeof window.fcLoadCartDrawerScripts === 'function') {
          window.fcLoadCartDrawerScripts();
        }
      },
      { passive: true }
    );

    btn.addEventListener('click', async function () {
      if (btn.disabled || isLaunchLockedAtc(btn)) return;
      if (btn.dataset.fcPurchasable === 'false') return;
      if (btn.dataset.fcAtcPending === '1') return;

      var activeVariantId = Number(btn.dataset.variantId) || variantId;
      if (!activeVariantId) return;

      var v = variantFromData(activeVariantId);
      var prevQty = Number(btn.dataset.fcQty || 0);
      var maxQty = v ? atcQtyMaxForVariant(v) : btn.dataset.qtyMax ? Number(btn.dataset.qtyMax) : null;

      if (v && !variantPurchasable(v)) return;

      if (maxQty !== null && !Number.isNaN(maxQty) && prevQty >= maxQty) {
        await openBagDrawer();
        pulseAtcButton(btn);
        return;
      }

      if (!window.fcAddToCart) {
        console.error('Add to bag unavailable: fc-cart.js did not load.');
        return;
      }

      setAtcPending(true);

      try {
        var addMeta =
          fcProductData && v
            ? {
                variantId: activeVariantId,
                productTitle: fcProductData.title,
                variantTitle: v.title,
                price: v.price,
                priceRaw: Number(v.priceRaw) || 0,
                image: v.image || fcProductData.image,
                url: fcProductData.url,
              }
            : null;

        var ok = await window.fcAddToCart(activeVariantId, 1, addMeta);
        if (!ok) {
          if (window.fcFetchCartForUiSync) await window.fcFetchCartForUiSync();
          return;
        }
        if (window.fcApplyPdpAtcQty) {
          var nextQty = prevQty + 1;
          allAtcButtons().forEach(function (atc) {
            window.fcApplyPdpAtcQty(atc, nextQty);
          });
        }
        pulseAtcButton(btn);
      } finally {
        setAtcPending(false);
      }
    });
  });

  function bootAtcState() {
    hydrateAtcQtyFromProductData();
    if (isStudioPdp && isAddToBagLaunchMode()) {
      syncAtcStateForVariant(variantId, true);
    }

    if (typeof window.fcLoadCartDrawerScripts === 'function') {
      window.fcLoadCartDrawerScripts();
    }
    if (customElements.get('cart-drawer')) {
      /* cart-drawer.js already in theme — ready for instant open */
    } else {
      customElements.whenDefined('cart-drawer').catch(function () {});
    }

    var cartSync = fetchCartQtySync();
    return cartSync;
  }

  bootAtcState();

  if (isStudioPdp) {
    refreshPurchaseModeFromServer();
  }

  window.addEventListener('pageshow', function () {
    fetchCartQtySync();
    if (isStudioPdp) refreshPurchaseModeFromServer();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && isStudioPdp) {
      refreshPurchaseModeFromServer();
    }
  });

  if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
    subscribe(PUB_SUB_EVENTS.cartUpdate, function (event) {
      if (event && event.cartData) syncAtcQtyFromCart(event.cartData);
      else fetchCartQtySync();
    });
  }
})();

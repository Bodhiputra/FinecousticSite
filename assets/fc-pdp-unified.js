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

  function readLaunchTs() {
    var fromRoot = parseInt(root.getAttribute('data-fc-launch-ts') || '0', 10);
    if (fromRoot) return fromRoot;
    var countdownEl = document.querySelector('[data-fc-countdown][data-launch-ts]');
    if (countdownEl) {
      var fromCountdown = parseInt(countdownEl.getAttribute('data-launch-ts'), 10);
      if (fromCountdown) return fromCountdown;
    }
    var meta = document.querySelector('meta[name="fc-launch-ts"]');
    if (meta && meta.content) {
      var fromMeta = parseInt(meta.content, 10);
      if (fromMeta) return fromMeta;
    }
    return 1786723200;
  }

  var launchTs = readLaunchTs();

  function isStoreLaunched() {
    var meta = document.querySelector('meta[name="fc-store-launched"]');
    return meta && meta.content === 'true';
  }

  function isLaunchLive() {
    if (isStoreLaunched()) return true;
    return launchTs > 0 && Math.floor(Date.now() / 1000) >= launchTs;
  }

  function isLaunchLockedAtc(atc) {
    if (!atc) return false;
    if (isLaunchLive()) return false;
    return atc.dataset.fcLaunchLocked === 'true' || atc.classList.contains('is-launch-locked');
  }

  function hasStaleLaunchUi() {
    return !!document.querySelector(
      '[data-fc-countdown], .fc-pdp-u__atc.is-launch-locked, .fc-pdp-u__atc[data-fc-launch-locked="true"], .fc-pdp-u__atc.is-oos, .fc-pdp-u__atc[data-fc-purchasable="false"]'
    );
  }

  function hideLaunchCountdownUi() {
    if (!isLaunchLive()) return;
    document.querySelectorAll('[data-fc-countdown]').forEach(function (el) {
      el.remove();
    });
  }

  function getProductHandle() {
    var fromRoot = root.getAttribute('data-product-handle');
    if (fromRoot) return fromRoot;
    var match = window.location.pathname.match(/\/products\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function mergeFreshVariants(productJson) {
    if (!productJson || !Array.isArray(productJson.variants)) return false;
    if (!fcProductData || !Array.isArray(fcProductData.variants)) return false;
    productJson.variants.forEach(function (fresh) {
      var fid = Number(fresh.id);
      for (var i = 0; i < fcProductData.variants.length; i++) {
        if (Number(fcProductData.variants[i].id) === fid) {
          fcProductData.variants[i].available = !!fresh.available;
          fcProductData.variants[i].inventoryQuantity = fresh.inventory_quantity || 0;
          break;
        }
      }
    });
    return true;
  }

  function refreshAvailabilityFromStore() {
    if (!isLaunchLive() || !hasStaleLaunchUi()) return Promise.resolve(false);
    var handle = getProductHandle();
    if (!handle) return Promise.resolve(false);
    return fetch('/products/' + encodeURIComponent(handle) + '.js', {
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (productJson) {
        if (!mergeFreshVariants(productJson)) return false;
        unlockStaleLaunchGate();
        reconcileStaleSoldOutFromData();
        syncAtcStateForVariant(variantId, true);
        return true;
      })
      .catch(function () {
        return false;
      });
  }

  function reconcileStaleSoldOutFromData() {
    if (!fcProductData || !Array.isArray(fcProductData.variants)) return;
    var v = variantFromData(variantId);
    if (!v) {
      for (var i = 0; i < fcProductData.variants.length; i++) {
        if (fcProductData.variants[i] && fcProductData.variants[i].available) {
          v = fcProductData.variants[i];
          break;
        }
      }
      if (!v) v = fcProductData.variants[0];
    }
    if (!v) return;
    allAtcButtons().forEach(function (atc) {
      if (isLaunchLockedAtc(atc)) return;
      if (v.available) {
        atc.classList.remove('is-oos');
        atc.dataset.fcPurchasable = 'true';
        atc.disabled = false;
        atc.removeAttribute('aria-disabled');
        var label = atc.querySelector('[data-fc-pdp-atc-label]');
        if (label) label.textContent = 'Add to bag';
        atc.dataset.fcAtcLabelDefault = 'Add to bag';
      }
    });
  }

  function unlockStaleLaunchGate() {
    if (!isLaunchLive()) return;
    hideLaunchCountdownUi();
    document.querySelectorAll('.fc-pdp-u__atc').forEach(function (atc) {
      atc.disabled = false;
      atc.classList.remove('is-launch-locked');
      delete atc.dataset.fcLaunchLocked;
      atc.removeAttribute('aria-disabled');
      if (fcProductData && Array.isArray(fcProductData.variants)) {
        var vid = Number(atc.dataset.variantId) || variantId;
        var v = variantFromData(vid);
        if (v && v.available) {
          atc.dataset.fcPurchasable = 'true';
          atc.classList.remove('is-oos');
        }
      }
    });
  }

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

  function variantPurchasable(v) {
    return !!(v && v.available);
  }

  function atcQtyMaxForVariant(v) {
    if (!v || !v.available) return null;
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
      if (isLaunchLockedAtc(atc)) {
        atc.disabled = true;
        atc.classList.add('is-launch-locked');
        atc.dataset.fcPurchasable = 'false';
        atc.setAttribute('aria-disabled', 'true');
        return;
      }
      var purchasable = atc.dataset.fcPurchasable !== 'false';
      var defaultLabel = atc.dataset.fcAtcLabelDefault;
      var label = atc.querySelector('[data-fc-pdp-atc-label]');
      if (label && defaultLabel) label.textContent = defaultLabel;
      atc.disabled = false;
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
      if (isLaunchLockedAtc(atc)) {
        atc.disabled = true;
        atc.classList.add('is-launch-locked');
        atc.dataset.fcPurchasable = 'false';
        atc.setAttribute('aria-disabled', 'true');
        return;
      }
      atc.dataset.variantId = String(v.id);
      if (maxQty !== null && maxQty > 0) atc.dataset.qtyMax = String(maxQty);
      else delete atc.dataset.qtyMax;
      atc.disabled = false;
      atc.classList.remove('is-launch-locked');
      delete atc.dataset.fcLaunchLocked;
      if (!updateLabel) return;
      var label = atc.querySelector('[data-fc-pdp-atc-label]');
      if (v.available) {
        atc.dataset.fcPurchasable = 'true';
        atc.dataset.fcAtcLabelDefault = 'Add to bag';
        atc.classList.remove('is-oos');
        atc.removeAttribute('aria-disabled');
        if (label) label.textContent = 'Add to bag';
      } else {
        atc.dataset.fcPurchasable = 'false';
        atc.dataset.fcAtcLabelDefault = 'Sold Out';
        atc.classList.add('is-oos');
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
    if (hasStaleLaunchUi()) {
      unlockStaleLaunchGate();
      reconcileStaleSoldOutFromData();
      syncAtcStateForVariant(variantId, true);
    } else {
      applyAtcQtyForVariantId(variantId);
    }
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

  root.querySelectorAll('.fc-pdp-u__variant').forEach(function (btn) {
    btn.addEventListener('click', function () {
      variantId = parseInt(btn.dataset.variantId, 10);
      root.querySelectorAll('.fc-pdp-u__variant').forEach(function (b) {
        var selected = b === btn;
        b.classList.toggle('is-selected', selected);
        b.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
      if (btn.dataset.variantId) {
        var html = priceHtmlForVariant(variantId);
        if (html) syncPrices(html);
      }
      syncAtcStateForVariant(variantId, true);
      if (variantGallery) {
        var nextSrc = btn.dataset.variantImage || variantImageForId(variantId);
        swapVariantHero(nextSrc, btn.textContent ? btn.textContent.trim() : '');
      }
      fetchCartQtySync();
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
      if (btn.classList.contains('is-oos') && btn.dataset.fcPurchasable === 'false') return;
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
        var nextQty = prevQty + 1;
        if (window.fcApplyPdpAtcQty) {
          allAtcButtons().forEach(function (atc) {
            window.fcApplyPdpAtcQty(atc, nextQty);
          });
        }

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
        pulseAtcButton(btn);
      } finally {
        setAtcPending(false);
      }
    });
  });

  function bootAtcState() {
    hydrateAtcQtyFromProductData();

    if (typeof window.fcLoadCartDrawerScripts === 'function') {
      window.fcLoadCartDrawerScripts();
    }
    if (customElements.get('cart-drawer')) {
      /* cart-drawer.js already in theme — ready for instant open */
    } else {
      customElements.whenDefined('cart-drawer').catch(function () {});
    }

    var cartSync = fetchCartQtySync();
    var chain = Promise.resolve();

    if (hasStaleLaunchUi() && isLaunchLive()) {
      unlockStaleLaunchGate();
      chain = refreshAvailabilityFromStore().then(function () {
        reconcileStaleSoldOutFromData();
        syncAtcStateForVariant(variantId, true);
      });
    }

    return Promise.all([chain, cartSync]);
  }

  bootAtcState();

  window.addEventListener('fc-launch-live', function () {
    if (!hasStaleLaunchUi()) return;
    refreshAvailabilityFromStore().then(function () {
      fetchCartQtySync();
    });
  });

  window.addEventListener('pageshow', function () {
    if (hasStaleLaunchUi() && isLaunchLive()) {
      bootAtcState();
      return;
    }
    fetchCartQtySync();
  });

  if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
    subscribe(PUB_SUB_EVENTS.cartUpdate, function (event) {
      if (event && event.cartData) syncAtcQtyFromCart(event.cartData);
      else fetchCartQtySync();
    });
  }
})();

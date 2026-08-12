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
      if (atc.dataset.fcLaunchLocked === 'true' || atc.classList.contains('is-launch-locked')) {
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
      if (atc.dataset.fcLaunchLocked === 'true' || atc.classList.contains('is-launch-locked')) {
        atc.disabled = true;
        atc.classList.add('is-launch-locked');
        atc.dataset.fcPurchasable = 'false';
        atc.setAttribute('aria-disabled', 'true');
        return;
      }
      atc.dataset.variantId = String(variantId);
      if (maxQty !== null && maxQty > 0) atc.dataset.qtyMax = String(maxQty);
      else delete atc.dataset.qtyMax;
      atc.disabled = false;
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
  }

  function syncAtcQtyFromCart(cart) {
    if (window.fcSyncPriceTagsFromCart) {
      window.fcSyncPriceTagsFromCart(cart);
    }
    if (!cart || !Array.isArray(cart.items)) return;

    var qty = 0;
    cart.items.forEach(function (item) {
      if (Number(item.variant_id) === variantId) qty += Number(item.quantity || 0);
    });

    if (window.fcApplyPdpAtcQty) {
      allAtcButtons().forEach(function (atc) {
        window.fcApplyPdpAtcQty(atc, qty);
      });
    }

    syncAtcStateForVariant(variantId);
  }

  function fetchCartQtySync() {
    return fetch('/cart.js')
      .then(function (res) {
        return res.json();
      })
      .then(function (cart) {
        syncAtcQtyFromCart(cart);
      })
      .catch(function () {});
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

  allAtcButtons().forEach(function (btn) {
    btn.addEventListener('click', async function () {
      if (btn.disabled || btn.dataset.fcLaunchLocked === 'true' || btn.classList.contains('is-launch-locked')) return;
      var v = variantFromData(variantId);
      var prevQty = Number(btn.dataset.fcQty || 0);

      if (!canAddVariant(v, prevQty)) {
        if (window.fcOpenCartDrawer) await window.fcOpenCartDrawer();
        return;
      }

      if (!window.fcAddToCart) return;

      var nextQty = prevQty + 1;
      if (window.fcApplyPdpAtcQty) {
        allAtcButtons().forEach(function (atc) {
          window.fcApplyPdpAtcQty(atc, nextQty);
        });
      }

      var ok = await window.fcAddToCart(variantId, 1);
      if (!ok) {
        if (window.fcApplyPdpAtcQty) {
          allAtcButtons().forEach(function (atc) {
            window.fcApplyPdpAtcQty(atc, prevQty);
          });
        }
        if (window.fcOpenCartDrawer) await window.fcOpenCartDrawer();
        return;
      }
      fetchCartQtySync();
    });
  });

  restoreServerAtcLabels();
  syncAtcStateForVariant(variantId, false);
  fetchCartQtySync().then(restoreServerAtcLabels);

  if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
    subscribe(PUB_SUB_EVENTS.cartUpdate, function (event) {
      if (event && event.cartData) syncAtcQtyFromCart(event.cartData);
      else fetchCartQtySync();
    });
  }
})();

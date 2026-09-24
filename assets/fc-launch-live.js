(function () {
  var LAUNCH_TS = 1786723200;
  function readLaunchTs() {
    var launchTsMeta = document.querySelector('meta[name="fc-launch-ts"]');
    if (launchTsMeta && launchTsMeta.content) {
      var parsed = parseInt(launchTsMeta.content, 10);
      if (parsed) return parsed;
    }
    var countdownEl = document.querySelector('[data-fc-countdown][data-launch-ts]');
    if (countdownEl) {
      var fromCountdown = parseInt(countdownEl.getAttribute('data-launch-ts'), 10);
      if (fromCountdown) return fromCountdown;
    }
    var pdpRoot = document.querySelector('.fc-pdp-u[data-fc-launch-ts]');
    if (pdpRoot) {
      var fromPdp = parseInt(pdpRoot.getAttribute('data-fc-launch-ts'), 10);
      if (fromPdp) return fromPdp;
    }
    return LAUNCH_TS;
  }

  function isStoreLaunched() {
    var storeLaunchedMeta = document.querySelector('meta[name="fc-store-launched"]');
    return storeLaunchedMeta && storeLaunchedMeta.content === 'true';
  }

  function isLive() {
    if (isStoreLaunched()) return true;
    var launchTs = readLaunchTs();
    return launchTs > 0 && Math.floor(Date.now() / 1000) >= launchTs;
  }

  function hasStaleLaunchUi() {
    return !!document.querySelector(
      '[data-fc-countdown], .is-launch-locked, [data-fc-launch-locked="true"], .fc-tag--launch-locked, .fc-tag-oos-wrap, .fc-pdp-u__atc.is-oos, .fc-pdp-u__atc[data-fc-purchasable="false"]'
    );
  }

  window.fcIsLaunchLive = isLive;

  function readProductData() {
    var el = document.querySelector('script[id^="fc-data-"]');
    if (!el) return null;
    try {
      return JSON.parse(el.textContent);
    } catch (e) {
      return null;
    }
  }

  function variantById(variantId) {
    var pd = readProductData();
    if (!pd || !Array.isArray(pd.variants)) return null;
    var target = Number(variantId);
    if (!target) return null;
    for (var i = 0; i < pd.variants.length; i++) {
      if (Number(pd.variants[i].id) === target) return pd.variants[i];
    }
    return null;
  }

  function applyHeroLaunchedCta(stack) {
    if (!stack || stack.dataset.fcClientLaunched === '1') return;
    stack.dataset.fcClientLaunched = '1';
    stack.classList.remove('fc-preorder-hero-stack--countdown');
    stack.classList.add('fc-preorder-hero-stack--launched');
    if (stack.querySelector('.fc-preorder-hero-launched-cta')) return;
    var cta = document.createElement('div');
    cta.className = 'fc-preorder-hero-launched-cta';
    cta.innerHTML =
      '<p class="website-hero__available-copy">Ready to fit in your space.</p>' +
      '<a class="website-hero__discover-more" href="/products/hako-nomad-fbs1">Discover More</a>';
    stack.appendChild(cta);
  }

  function removeCountdownNodes() {
    document.querySelectorAll('[data-fc-countdown]').forEach(function (cd) {
      var stack = cd.closest('.fc-preorder-hero-stack--countdown');
      if (stack) applyHeroLaunchedCta(stack);
      cd.remove();
    });
  }

  function setPdpAtcLabel(atc, text) {
    var label = atc.querySelector('[data-fc-pdp-atc-label]');
    if (label) label.textContent = text;
    atc.dataset.fcAtcLabelDefault = text;
  }

  function unlockPurchaseControls() {
    document
      .querySelectorAll(
        '.fc-pdp-u__atc.is-launch-locked, .fc-pdp-u__atc[data-fc-launch-locked="true"], .fc-card__tag.fc-tag--launch-locked, .fc-card__tag[data-fc-launch-locked="true"], [data-fc-launch-locked="true"]'
      )
      .forEach(function (el) {
        el.classList.remove('is-launch-locked', 'fc-tag--launch-locked');
        delete el.dataset.fcLaunchLocked;
        el.disabled = false;
        el.removeAttribute('aria-disabled');
      });
  }

  function upgradeLaunchLockedShopTag(tag) {
    if (!tag || !tag.classList.contains('fc-tag--launch-locked')) return false;
    var variantId = tag.dataset.variantId;
    if (!variantId) return false;

    tag.classList.remove('fc-tag--launch-locked');
    delete tag.dataset.fcLaunchLocked;

    var lock = tag.querySelector('.fc-card__atc-lock');
    if (lock) lock.remove();

    if (!tag.querySelector('.fc-tag-rip')) {
      var rip = document.createElement('span');
      rip.className = 'fc-tag-rip';
      tag.appendChild(rip);
    }

    if (!tag.querySelector('.fc-card__atc-plus')) {
      var plus = document.createElement('button');
      plus.className = 'fc-card__atc-plus';
      plus.type = 'button';
      plus.dataset.variantId = variantId;
      plus.setAttribute('aria-label', 'Add to cart');
      plus.innerHTML = '<span class="fc-qty-label"></span>';
      tag.appendChild(plus);
    }

    var card = tag.closest('.fc-card');
    if (card) {
      delete card.dataset.fcCardBound;
      delete tag.dataset.fcPriceTagBound;
    }

    return true;
  }

  function reconcileShopGridTags() {
    var upgraded = false;
    document.querySelectorAll('.fc-card__tag.fc-tag--launch-locked, .fc-card__tag[data-fc-launch-locked="true"]').forEach(function (tag) {
      if (upgradeLaunchLockedShopTag(tag)) upgraded = true;
    });
    return upgraded;
  }

  function handleFromCard(card) {
    var url = card.getAttribute('data-url') || '';
    var match = url.match(/\/products\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function fetchProductJsonByHandle(handle) {
    if (!handle) return Promise.resolve(null);
    return fetch('/products/' + encodeURIComponent(handle) + '.js', {
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .catch(function () {
        return null;
      });
  }

  function patchFcDataProduct(productJson) {
    if (!productJson || !productJson.id) return;
    var el = document.getElementById('fc-data-' + productJson.id);
    if (!el) return;
    try {
      var data = JSON.parse(el.textContent);
      if (!data || !Array.isArray(data.variants) || !Array.isArray(productJson.variants)) return;
      productJson.variants.forEach(function (fresh) {
        var fid = Number(fresh.id);
        for (var i = 0; i < data.variants.length; i++) {
          if (Number(data.variants[i].id) === fid) {
            data.variants[i].available = !!fresh.available;
            data.variants[i].inventoryQuantity = fresh.inventory_quantity || 0;
            break;
          }
        }
      });
      el.textContent = JSON.stringify(data);
    } catch (e) {}
  }

  function upgradeOosShopCard(card, productJson) {
    var oosWrap = card.querySelector('.fc-tag-oos-wrap');
    if (!oosWrap || !productJson || !productJson.available) return false;

    var variant = null;
    for (var i = 0; i < productJson.variants.length; i++) {
      if (productJson.variants[i].available) {
        variant = productJson.variants[i];
        break;
      }
    }
    if (!variant) return false;

    var priceEl = oosWrap.querySelector('.fc-card__price');
    var nameEl = oosWrap.querySelector('.fc-card__name');

    var tag = document.createElement('div');
    tag.className = 'fc-card__tag';
    tag.dataset.variantId = String(variant.id);

    var body = document.createElement('div');
    body.className = 'fc-card__tag-body';
    if (priceEl) body.appendChild(priceEl.cloneNode(true));
    if (nameEl) body.appendChild(nameEl.cloneNode(true));

    var rip = document.createElement('span');
    rip.className = 'fc-tag-rip';

    var plus = document.createElement('button');
    plus.className = 'fc-card__atc-plus';
    plus.type = 'button';
    plus.dataset.variantId = String(variant.id);
    plus.setAttribute('aria-label', 'Add to cart');
    plus.innerHTML = '<span class="fc-qty-label"></span>';

    tag.appendChild(body);
    tag.appendChild(rip);
    tag.appendChild(plus);
    oosWrap.replaceWith(tag);
    delete card.dataset.fcCardBound;
    return true;
  }

  function reconcileShopGridAvailability() {
    var cards = document.querySelectorAll('.fc-card[data-url]');
    if (!cards.length) return Promise.resolve(false);

    var jobs = [];
    cards.forEach(function (card) {
      var needsHeal =
        card.querySelector('.fc-tag-oos-wrap, .fc-tag--oos') ||
        card.querySelector('.fc-card__tag.fc-tag--launch-locked, .fc-card__tag[data-fc-launch-locked="true"]');
      if (!needsHeal) return;

      var handle = handleFromCard(card);
      if (!handle) return;

      jobs.push(
        fetchProductJsonByHandle(handle).then(function (productJson) {
          if (!productJson) return false;
          patchFcDataProduct(productJson);
          var upgraded = false;
          if (productJson.available && card.querySelector('.fc-tag-oos-wrap, .fc-tag--oos')) {
            if (upgradeOosShopCard(card, productJson)) upgraded = true;
          }
          if (productJson.available) {
            var lockedTag = card.querySelector('.fc-card__tag.fc-tag--launch-locked, .fc-card__tag[data-fc-launch-locked="true"]');
            if (lockedTag && upgradeLaunchLockedShopTag(lockedTag)) upgraded = true;
          }
          return upgraded;
        })
      );
    });

    if (!jobs.length) return Promise.resolve(false);
    return Promise.all(jobs).then(function (results) {
      return results.some(Boolean);
    });
  }

  function getProductHandle() {
    var root = document.querySelector('.fc-pdp-u[data-product-handle]');
    if (root && root.getAttribute('data-product-handle')) {
      return root.getAttribute('data-product-handle');
    }
    var match = window.location.pathname.match(/\/products\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function fetchFreshProductJson() {
    var handle = getProductHandle();
    if (!handle) return Promise.resolve(null);
    return fetch('/products/' + encodeURIComponent(handle) + '.js', {
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .catch(function () {
        return null;
      });
  }

  function applyPdpAvailabilityFromProductJson(productJson) {
    if (!productJson || !Array.isArray(productJson.variants)) return;
    document.querySelectorAll('.fc-pdp-u__atc[data-variant-id]').forEach(function (atc) {
      var vid = Number(atc.dataset.variantId);
      var fresh = null;
      for (var i = 0; i < productJson.variants.length; i++) {
        if (Number(productJson.variants[i].id) === vid) {
          fresh = productJson.variants[i];
          break;
        }
      }
      if (!fresh) {
        atc.classList.remove('is-launch-locked');
        delete atc.dataset.fcLaunchLocked;
        atc.disabled = false;
        atc.removeAttribute('aria-disabled');
        return;
      }
      atc.classList.remove('is-launch-locked');
      delete atc.dataset.fcLaunchLocked;
      if (fresh.available) {
        atc.classList.remove('is-oos');
        atc.dataset.fcPurchasable = 'true';
        atc.disabled = false;
        atc.removeAttribute('aria-disabled');
        setPdpAtcLabel(atc, 'Add to bag');
      } else {
        atc.classList.add('is-oos');
        atc.dataset.fcPurchasable = 'false';
        atc.setAttribute('aria-disabled', 'true');
        setPdpAtcLabel(atc, 'Sold Out');
      }
    });
  }

  function reconcilePdpAvailabilityFromEmbedded() {
    document.querySelectorAll('.fc-pdp-u__atc[data-variant-id]').forEach(function (atc) {
      var v = variantById(atc.dataset.variantId);
      if (!v) {
        atc.classList.remove('is-launch-locked');
        delete atc.dataset.fcLaunchLocked;
        atc.disabled = false;
        atc.removeAttribute('aria-disabled');
        return;
      }
      if (v.available) {
        atc.classList.remove('is-oos', 'is-launch-locked');
        delete atc.dataset.fcLaunchLocked;
        atc.dataset.fcPurchasable = 'true';
        atc.disabled = false;
        atc.removeAttribute('aria-disabled');
        setPdpAtcLabel(atc, 'Add to bag');
      }
    });
  }

  function reconcilePdpAvailability() {
    if (getProductHandle()) {
      fetchFreshProductJson().then(function (productJson) {
        if (productJson) applyPdpAvailabilityFromProductJson(productJson);
        else reconcilePdpAvailabilityFromEmbedded();
      });
      return;
    }
    reconcilePdpAvailabilityFromEmbedded();
  }

  function fixLiveStorefront() {
    if (!isLive()) return;
    if (!hasStaleLaunchUi()) return;
    if (window.__fcStorefrontHealInFlight) return;

    window.__fcStorefrontHealInFlight = Promise.resolve()
      .then(function () {
        removeCountdownNodes();
        unlockPurchaseControls();
        reconcilePdpAvailability();
        reconcileShopGridTags();
        return reconcileShopGridAvailability();
      })
      .finally(function () {
        window.dispatchEvent(new CustomEvent('fc-launch-live'));
        window.__fcStorefrontHealInFlight = null;
      });
  }

  fixLiveStorefront();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixLiveStorefront);
  }
  window.addEventListener('pageshow', function () {
    fixLiveStorefront();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && isLive()) {
      fixLiveStorefront();
    }
  });
})();

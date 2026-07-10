/**
 * Price tag: + button and unripped tag body add to cart; rip + qty on first add.
 */
window.fcApplyPdpAtcQty = function (atc, qty) {
  if (!atc) return;
  qty = Math.max(0, Number(qty) || 0);
  atc.dataset.fcQty = String(qty);

  var qtyEl = atc.querySelector('[data-fc-pdp-atc-qty]');
  var qtySep = atc.querySelector('[data-fc-pdp-atc-qty-sep]');

  if (qty > 0) {
    atc.classList.add('fc-atc-active');
    if (qtyEl) {
      qtyEl.textContent = String(qty);
      qtyEl.hidden = false;
    }
    if (qtySep) qtySep.hidden = false;
  } else {
    atc.classList.remove('fc-atc-active');
    if (qtyEl) {
      qtyEl.textContent = '';
      qtyEl.hidden = true;
    }
    if (qtySep) qtySep.hidden = true;
  }
};

window.fcApplyPriceTagQty = function (tag, qty) {
  if (!tag) return;
  qty = Math.max(0, Number(qty) || 0);
  var maxQty = tag.dataset.qtyMax ? Number(tag.dataset.qtyMax) : null;
  if (maxQty !== null && !Number.isNaN(maxQty) && qty > maxQty) qty = maxQty;
  tag.dataset.fcQty = String(qty);

  var plus = tag.querySelector('.fc-card__atc-plus');
  var label = tag.querySelector('.fc-qty-label');

  if (qty > 0) {
    tag.classList.add('fc-tag-active');
    if (plus) plus.classList.add('fc-active');
    if (label) label.textContent = String(qty);
  } else {
    tag.classList.remove('fc-tag-active');
    if (plus) plus.classList.remove('fc-active');
    if (label) label.textContent = '';
  }
};

window.fcSyncPriceTagsFromCart = function (cart) {
  if (!cart || !Array.isArray(cart.items)) return;

  var qtyByVariant = {};
  cart.items.forEach(function (item) {
    var id = Number(item.variant_id);
    if (!id) return;
    qtyByVariant[id] = (qtyByVariant[id] || 0) + Number(item.quantity || 0);
  });

  document.querySelectorAll('.fc-card__tag[data-variant-id]').forEach(function (tag) {
    var variantId = Number(tag.dataset.variantId);
    window.fcApplyPriceTagQty(tag, qtyByVariant[variantId] || 0);
  });

  document.querySelectorAll('.fc-pdp-u__atc[data-variant-id]').forEach(function (atc) {
    var variantId = Number(atc.dataset.variantId);
    window.fcApplyPdpAtcQty(atc, qtyByVariant[variantId] || 0);
  });
};

(function () {
  function syncFromCartEndpoint() {
    if (
      !document.querySelector('.fc-card__tag[data-variant-id]') &&
      !document.querySelector('.fc-pdp-u__atc[data-variant-id]')
    ) {
      return Promise.resolve();
    }
    return fetch('/cart.js')
      .then(function (res) {
        return res.json();
      })
      .then(function (cart) {
        window.fcSyncPriceTagsFromCart(cart);
      })
      .catch(function () {});
  }

  function bindCartSync() {
    if (typeof subscribe !== 'function' || typeof PUB_SUB_EVENTS === 'undefined') return;
    subscribe(PUB_SUB_EVENTS.cartUpdate, function (event) {
      if (event && event.cartData) {
        window.fcSyncPriceTagsFromCart(event.cartData);
        return;
      }
      syncFromCartEndpoint();
    });
  }

  function initCartSync() {
    bindCartSync();
    syncFromCartEndpoint();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCartSync, { once: true });
  } else {
    initCartSync();
  }
})();

window.fcWirePriceTag = function (tag, options) {
  options = options || {};
  var getVariantId =
    options.getVariantId ||
    function () {
      return Number(tag.dataset.variantId);
    };
  var onAdd = options.onAdd;
  if (!tag || tag.classList.contains('fc-tag--oos') || tag.classList.contains('fc-tag--coming-soon') || typeof onAdd !== 'function') return;
  if (tag.dataset.fcPriceTagBound === '1') return;
  tag.dataset.fcPriceTagBound = '1';

  var plus = tag.querySelector('.fc-card__atc-plus');
  if (!plus) return;

  async function handleAtc(e) {
    e.preventDefault();
    e.stopPropagation();
    var variantId = getVariantId();
    if (!variantId) return;

    var prevQty = Number(tag.dataset.fcQty || 0);
    var maxQty = tag.dataset.qtyMax ? Number(tag.dataset.qtyMax) : null;
    if (maxQty !== null && !Number.isNaN(maxQty) && prevQty >= maxQty) {
      if (window.fcOpenCartDrawer) await window.fcOpenCartDrawer();
      return;
    }

    var nextQty = prevQty + 1;

    window.fcApplyPriceTagQty(tag, nextQty);

    var ok = await onAdd(variantId, 1);
    if (!ok) window.fcApplyPriceTagQty(tag, prevQty);
  }

  plus.addEventListener('click', handleAtc);

  var body = tag.querySelector('.fc-card__tag-body');
  if (body) {
    body.addEventListener('click', function (e) {
      if (e.target.closest('.fc-card__atc-plus')) return;
      if (tag.classList.contains('fc-tag-active')) {
        e.preventDefault();
        e.stopPropagation();
        if (window.fcOpenCartDrawer) window.fcOpenCartDrawer();
        return;
      }
      handleAtc(e);
    });
  }
};

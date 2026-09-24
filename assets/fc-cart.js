/**
 * Shared add-to-cart for shop grid and PDP.
 */
(function () {
  function fcCartDrawerSectionReady(state) {
    return Boolean(state && state.sections && state.sections['cart-drawer']);
  }

  function fcOpenCartDrawerUi(cartDrawer) {
    if (!cartDrawer) return false;
    if (typeof cartDrawer.open === 'function') {
      cartDrawer.open();
      return true;
    }
    document.getElementById('cart-icon-bubble')?.click();
    return true;
  }

  var fcCartUiSyncPromise = null;

  function fcReadCartSnapshotFromDom() {
    var byVariant = {};
    var selectors =
      'cart-drawer input.quantity__input[data-quantity-variant-id], cart-items input.quantity__input[data-quantity-variant-id]';

    document.querySelectorAll(selectors).forEach(function (input) {
      var vid = Number(input.dataset.quantityVariantId);
      if (!vid) return;
      var q = parseInt(input.getAttribute('value'), 10);
      if (Number.isNaN(q)) q = parseInt(input.value, 10) || 0;
      if (!q) return;
      byVariant[vid] = (byVariant[vid] || 0) + q;
    });

    var items = Object.keys(byVariant).map(function (vid) {
      return { variant_id: Number(vid), quantity: byVariant[vid] };
    });

    var itemCount = 0;
    document.querySelectorAll('.cart-count-bubble span[aria-hidden="true"]').forEach(function (el) {
      var n = parseInt(el.textContent, 10);
      if (!Number.isNaN(n)) itemCount = Math.max(itemCount, n);
    });

    if (!itemCount && items.length) {
      itemCount = items.reduce(function (sum, item) {
        return sum + item.quantity;
      }, 0);
    }

    return { items: items, item_count: itemCount };
  }

  window.fcReadCartSnapshotFromDom = fcReadCartSnapshotFromDom;

  async function fcFetchCartForUiSync() {
    if (fcCartUiSyncPromise) return fcCartUiSyncPromise;
    fcCartUiSyncPromise = fcFetchCart()
      .then(function (cart) {
        if (window.fcSyncPriceTagsFromCart) window.fcSyncPriceTagsFromCart(cart);
        return cart;
      })
      .finally(function () {
        fcCartUiSyncPromise = null;
      });
    return fcCartUiSyncPromise;
  }

  window.fcFetchCartForUiSync = fcFetchCartForUiSync;

  function fcSetQuantityInputValue(input, qty) {
    if (!input) return;
    qty = Math.max(0, Number(qty) || 0);
    input.value = String(qty);
    input.setAttribute('value', String(qty));
    input.dataset.cartQuantity = String(qty);
    var qtyInput = input.closest('quantity-input');
    if (qtyInput && typeof qtyInput.validateQtyRules === 'function') {
      qtyInput.validateQtyRules();
    }
  }

  function fcApplyCartDrawerVariantQty(variantId, qty) {
    var vid = Number(variantId);
    if (!vid) return;
    document.querySelectorAll('cart-drawer input.quantity__input[data-quantity-variant-id]').forEach(function (input) {
      if (Number(input.dataset.quantityVariantId) === vid) {
        fcSetQuantityInputValue(input, qty);
      }
    });
  }

  function fcBumpCartDrawerVariantQty(variantId, delta) {
    var vid = Number(variantId);
    if (!vid || !delta) return false;
    var bumped = false;
    document.querySelectorAll('cart-drawer input.quantity__input[data-quantity-variant-id]').forEach(function (input) {
      if (Number(input.dataset.quantityVariantId) !== vid) return;
      var prev = parseInt(input.value, 10);
      if (Number.isNaN(prev)) prev = parseInt(input.dataset.cartQuantity, 10) || 0;
      fcSetQuantityInputValue(input, Math.max(0, prev + delta));
      bumped = true;
    });
    return bumped;
  }

  function fcBumpCartCountBubble(delta) {
    if (!delta) return;
    document.querySelectorAll('.cart-count-bubble span[aria-hidden="true"]').forEach(function (el) {
      var prev = parseInt(el.textContent, 10) || 0;
      var next = Math.max(0, prev + delta);
      if (next < 100) el.textContent = String(next);
      var bubble = el.closest('.cart-count-bubble');
      if (bubble) bubble.classList.toggle('hidden', next === 0);
    });
  }

  function fcApplyVariantQtyInUi(variantId, qty) {
    var vid = Number(variantId);
    if (!vid) return;
    qty = Math.max(0, Number(qty) || 0);

    document.querySelectorAll('.fc-card__tag[data-variant-id]').forEach(function (tag) {
      if (Number(tag.dataset.variantId) === vid && window.fcApplyPriceTagQty) {
        window.fcApplyPriceTagQty(tag, qty);
      }
    });

    document.querySelectorAll('.fc-pdp-u__atc[data-variant-id]').forEach(function (atc) {
      if (Number(atc.dataset.variantId) === vid && window.fcApplyPdpAtcQty) {
        window.fcApplyPdpAtcQty(atc, qty);
      }
    });

    fcApplyCartDrawerVariantQty(vid, qty);
  }

  function fcBumpShopPdpVariantQty(variantId, delta) {
    var vid = Number(variantId);
    if (!vid || !delta) return;

    document.querySelectorAll('.fc-card__tag[data-variant-id]').forEach(function (tag) {
      if (Number(tag.dataset.variantId) !== vid) return;
      var next = Math.max(0, Number(tag.dataset.fcQty || 0) + delta);
      if (window.fcApplyPriceTagQty) window.fcApplyPriceTagQty(tag, next);
    });

    document.querySelectorAll('.fc-pdp-u__atc[data-variant-id]').forEach(function (atc) {
      if (Number(atc.dataset.variantId) !== vid) return;
      var next = Math.max(0, Number(atc.dataset.fcQty || 0) + delta);
      if (window.fcApplyPdpAtcQty) window.fcApplyPdpAtcQty(atc, next);
    });
  }

  function fcBumpVariantQtyInUi(variantId, delta) {
    var vid = Number(variantId);
    if (!vid || !delta) return;

    fcBumpShopPdpVariantQty(vid, delta);
    fcBumpCartDrawerVariantQty(vid, delta);
    fcBumpCartCountBubble(delta);
  }

  window.fcApplyVariantQtyInUi = fcApplyVariantQtyInUi;
  window.fcBumpVariantQtyInUi = fcBumpVariantQtyInUi;
  window.fcBumpCartDrawerVariantQty = fcBumpCartDrawerVariantQty;
  window.fcBumpCartCountBubble = fcBumpCartCountBubble;

  async function fcEnsureCartDrawerOnly() {
    if (!customElements.get('cart-drawer')) {
      await customElements.whenDefined('cart-drawer');
    }
  }

  async function fcEnsureCartUi() {
    if (typeof window.fcLoadCartDrawerScripts === 'function') {
      await window.fcLoadCartDrawerScripts();
    }
    await fcEnsureCartDrawerOnly();
  }

  function fcCartDrawerHasLines(cartDrawer) {
    if (!cartDrawer) return false;
    return !!cartDrawer.querySelector('cart-drawer-items .cart-item');
  }

  function fcSectionRootHasCartItems(sectionRoot) {
    return !!(sectionRoot && sectionRoot.querySelector('.cart-item'));
  }

  function fcSyncCartDrawerEmptyMarkup(cartDrawer, sectionRoot) {
    if (!cartDrawer || !sectionRoot || fcSectionRootHasCartItems(sectionRoot)) return;

    if (typeof cartDrawer.applyEmptyState === 'function') {
      cartDrawer.applyEmptyState();
    }

    var freshEmpty = sectionRoot.querySelector('.drawer__inner-empty');
    if (!freshEmpty) {
      if (typeof window.fcInjectCartDrawerEmptyFallback === 'function') {
        window.fcInjectCartDrawerEmptyFallback(cartDrawer);
      }
      return;
    }

    var liveEmpty = cartDrawer.querySelector('.drawer__inner-empty');
    if (liveEmpty) {
      liveEmpty.replaceWith(freshEmpty.cloneNode(true));
      return;
    }

    var anchor = cartDrawer.querySelector('cart-drawer-items');
    if (anchor) {
      anchor.insertAdjacentElement('beforebegin', freshEmpty.cloneNode(true));
    }
  }

  window.fcSyncCartDrawerEmptyMarkup = fcSyncCartDrawerEmptyMarkup;

  function fcOpenCartDrawerImmediate() {
    var cartDrawer = document.querySelector('cart-drawer');
    if (!cartDrawer) return false;
    if (fcCartDrawerHasLines(cartDrawer) && typeof cartDrawer.clearEmptyState === 'function') {
      cartDrawer.clearEmptyState();
    }
    return fcOpenCartDrawerUi(cartDrawer);
  }

  window.fcOpenCartDrawerImmediate = fcOpenCartDrawerImmediate;

  function fcEscapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fcResolveVariantMeta(variantId) {
    var vid = Number(variantId);
    if (!vid) return null;

    var scripts = document.querySelectorAll('script[id^="fc-data-"]');
    for (var i = 0; i < scripts.length; i++) {
      try {
        var data = JSON.parse(scripts[i].textContent);
        if (!data || !Array.isArray(data.variants)) continue;
        for (var j = 0; j < data.variants.length; j++) {
          var variant = data.variants[j];
          if (Number(variant.id) !== vid) continue;
          return {
            variantId: vid,
            productTitle: data.title,
            variantTitle: variant.title,
            price: variant.price || data.price,
            priceRaw: Number(variant.priceRaw) || 0,
            image: variant.image || data.image,
            url: data.url,
          };
        }
      } catch (e) {}
    }

    var atc = document.querySelector('.fc-pdp-u__atc[data-variant-id="' + vid + '"]');
    if (atc) {
      var root = document.querySelector('.fc-pdp-u[data-section-id]');
      var titleEl = root && root.querySelector('.fc-pdp-u__title, [data-fc-pdp-title]');
      var priceEl = root && root.querySelector('[data-fc-pdp-price]');
      var imgEl = root && root.querySelector('.fc-pdp-u__slide-media, .fc-pdp-u__slide img');
      return {
        variantId: vid,
        productTitle: titleEl ? titleEl.textContent.trim() : 'Product',
        variantTitle: '',
        price: priceEl ? priceEl.textContent.trim() : '',
        priceRaw: priceEl ? fcParseMoneyTextToCents(priceEl.textContent.trim()) : 0,
        image: imgEl ? imgEl.currentSrc || imgEl.src : '',
        url: window.location.pathname,
      };
    }

    return null;
  }

  function fcEnsureCartDrawerItemsShell() {
    var container = document.getElementById('CartDrawer-CartItems');
    if (!container) return null;

    var wrapper = container.querySelector('.drawer__cart-items-wrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'drawer__cart-items-wrapper';
      wrapper.innerHTML =
        '<table class="cart-items" role="table"><tbody role="rowgroup"></tbody></table>';
      var live = container.querySelector('#CartDrawer-LiveRegionText');
      container.insertBefore(wrapper, live || null);
    }

    return wrapper.querySelector('tbody');
  }

  function fcUpdateDrawerHeadingQty(delta) {
    var el = document.getElementById('CartDrawer-BagQty');
    if (!el || !delta) return;
    var match = el.textContent.match(/\((\d+)\)/);
    var prev = match ? parseInt(match[1], 10) : 0;
    var next = Math.max(0, prev + delta);
    el.textContent = next > 0 ? '(' + next + ')' : '';
  }

  window.fcUpdateDrawerHeadingQty = fcUpdateDrawerHeadingQty;

  function fcClearCartDrawerErrors() {
    var cartErrors = document.getElementById('CartDrawer-CartErrors');
    if (cartErrors) cartErrors.textContent = '';
    document.querySelectorAll('.cart-drawer .cart-item__error-text').forEach(function (el) {
      el.textContent = '';
    });
  }

  window.fcClearCartDrawerErrors = fcClearCartDrawerErrors;

  function fcInjectCartDrawerEmptyFallback(cartDrawer) {
    cartDrawer = cartDrawer || document.querySelector('cart-drawer');
    if (!cartDrawer) return;

    if (typeof cartDrawer.applyEmptyState === 'function') {
      cartDrawer.applyEmptyState();
    }

    var drawerItems = cartDrawer.querySelector('cart-drawer-items');
    if (drawerItems) drawerItems.classList.add('is-empty');

    fcClearCartDrawerErrors();

    if (cartDrawer.querySelector('.drawer__inner-empty')) return;

    var cfg = window.fcCartDrawerEmpty || {};
    var emptyText = cfg.emptyText || 'Your bag is empty.';
    var continueLabel = cfg.continueLabel || 'Continue shopping';
    var shopUrl = cfg.shopUrl || '/collections/all?sort_by=created-descending';
    var closeOnShop = cfg.closeOnShop === true;

    var empty = document.createElement('div');
    empty.className = 'drawer__inner-empty';

    var warnings = document.createElement('div');
    warnings.className = 'cart-drawer__warnings center';

    var content = document.createElement('div');
    content.className = 'cart-drawer__empty-content';

    var title = document.createElement('h2');
    title.className = 'cart__empty-text';
    title.textContent = emptyText;

    content.appendChild(title);

    if (closeOnShop) {
      var closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'button';
      closeBtn.textContent = continueLabel;
      closeBtn.addEventListener('click', function () {
        if (typeof cartDrawer.close === 'function') cartDrawer.close();
      });
      content.appendChild(closeBtn);
    } else {
      var link = document.createElement('a');
      link.href = shopUrl;
      link.className = 'button';
      link.textContent = continueLabel;
      content.appendChild(link);
    }

    warnings.appendChild(content);
    empty.appendChild(warnings);

    var anchor = cartDrawer.querySelector('cart-drawer-items');
    if (anchor) {
      anchor.insertAdjacentElement('beforebegin', empty);
    } else {
      var inner = cartDrawer.querySelector('.drawer__inner');
      if (inner) inner.insertBefore(empty, inner.firstChild);
    }
  }

  window.fcInjectCartDrawerEmptyFallback = fcInjectCartDrawerEmptyFallback;

  function fcShowCartDrawerEmptyOptimistic() {
    var cartDrawer = document.querySelector('cart-drawer');
    if (!cartDrawer) return;

    fcInjectCartDrawerEmptyFallback(cartDrawer);

    fcFetchCartApi('/?sections=cart-drawer&variant=' + Date.now(), { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('Empty cart section fetch failed');
        return fcParseJsonResponse(res);
      })
      .then(function (data) {
        var sectionRoot = fcParseCartDrawerRoot(data['cart-drawer']);
        if (sectionRoot) fcSyncCartDrawerEmptyMarkup(cartDrawer, sectionRoot);
      })
      .catch(function (err) {
        console.error(err);
      });
  }

  window.fcShowCartDrawerEmptyOptimistic = fcShowCartDrawerEmptyOptimistic;

  function fcCartDrawerIcon(name) {
    var icons = {
      minus:
        '<svg xmlns="http://www.w3.org/2000/svg" fill="none" class="icon icon-minus" viewBox="0 0 10 2"><path fill="currentColor" fill-rule="evenodd" d="M.5 1C.5.7.7.5 1 .5h8a.5.5 0 1 1 0 1H1A.5.5 0 0 1 .5 1" clip-rule="evenodd"/></svg>',
      plus:
        '<svg xmlns="http://www.w3.org/2000/svg" fill="none" class="icon icon-plus" viewBox="0 0 10 10"><path fill="currentColor" fill-rule="evenodd" d="M1 4.51a.5.5 0 0 0 0 1h3.5l.01 3.5a.5.5 0 0 0 1-.01V5.5l3.5-.01a.5.5 0 0 0-.01-1H5.5L5.49.99a.5.5 0 0 0-1 .01v3.5l-3.5.01z" clip-rule="evenodd"/></svg>',
      remove:
        '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-remove" viewBox="0 0 16 16"><path fill="currentColor" d="M14 3h-3.53a3.07 3.07 0 0 0-.6-1.65C9.44.82 8.8.5 8 .5s-1.44.32-1.87.85A3.06 3.06 0 0 0 5.53 3H2a.5.5 0 0 0 0 1h1.25v10c0 .28.22.5.5.5h8.5a.5.5 0 0 0 .5-.5V4H14a.5.5 0 0 0 0-1M6.91 1.98c.23-.29.58-.48 1.09-.48s.85.19 1.09.48c.2.24.3.6.36 1.02h-2.9c.05-.42.17-.78.36-1.02m4.84 11.52h-7.5V4h7.5z"/><path fill="currentColor" d="M6.55 5.25a.5.5 0 0 0-.5.5v6a.5.5 0 0 0 1 0v-6a.5.5 0 0 0-.5-.5m2.9 0a.5.5 0 0 0-.5.5v6a.5.5 0 0 0 1 0v-6a.5.5 0 0 0-.5-.5"/></svg>',
    };
    return icons[name] || '';
  }

  function fcBuildOptimisticCartRowHtml(meta, qty) {
    var title = fcEscapeHtml(meta.productTitle);
    var url = fcEscapeHtml(meta.url || '#');
    var price = fcEscapeHtml(meta.price || '');
    var variantId = meta.variantId;
    var img = meta.image
      ? '<img class="cart-item__image" src="' +
        fcEscapeHtml(meta.image) +
        '" alt="' +
        title +
        '" loading="eager" width="160" height="160">'
      : '';
    var variantHtml = '';
    if (meta.variantTitle && meta.variantTitle !== 'Default Title') {
      variantHtml =
        '<dl><div class="product-option"><dt>Variant</dt><dd>' +
        fcEscapeHtml(meta.variantTitle) +
        '</dd></div></dl>';
    }

    return (
      '<td class="cart-item__media" role="cell">' +
      '<a href="' +
      url +
      '" class="cart-item__link" tabindex="-1" aria-hidden="true"> </a>' +
      img +
      '</td>' +
      '<td class="cart-item__details" role="cell">' +
      '<a href="' +
      url +
      '" class="cart-item__name h4 break">' +
      title +
      '</a>' +
      variantHtml +
      '</td>' +
      '<td class="cart-item__totals right" role="cell">' +
      '<div class="cart-item__price-wrapper">' +
      price +
      '</div>' +
      '</td>' +
      '<td class="cart-item__quantity" role="cell">' +
      '<div class="cart-item__quantity-wrapper quantity-popover-wrapper">' +
      '<div class="cart-item__line-price">' +
      price +
      '</div>' +
      '<div class="cart-item__quantity-controls">' +
      '<div class="quantity-popover-container">' +
      '<quantity-input class="quantity cart-quantity">' +
      '<button class="quantity__button" name="minus" type="button" aria-label="Decrease quantity">' +
      '<span class="svg-wrapper">' +
      fcCartDrawerIcon('minus') +
      '</span>' +
      '</button>' +
      '<input class="quantity__input" type="number" data-quantity-variant-id="' +
      variantId +
      '" name="updates[]" value="' +
      qty +
      '" min="0" data-min="0" step="1" data-cart-quantity="' +
      qty +
      '" aria-label="Quantity" id="Drawer-quantity-opt-' +
      variantId +
      '" data-index="opt">' +
      '<button class="quantity__button" name="plus" type="button" aria-label="Increase quantity">' +
      '<span class="svg-wrapper">' +
      fcCartDrawerIcon('plus') +
      '</span>' +
      '</button>' +
      '</quantity-input>' +
      '</div>' +
      '<cart-remove-button id="CartDrawer-Remove-opt-' +
      variantId +
      '" data-index="opt" data-variant-id="' +
      variantId +
      '">' +
      '<button type="button" class="button button--tertiary cart-remove-button" aria-label="Remove ' +
      title +
      '" data-variant-id="' +
      variantId +
      '">' +
      '<span class="svg-wrapper">' +
      fcCartDrawerIcon('remove') +
      '</span>' +
      '</button>' +
      '</cart-remove-button>' +
      '</div>' +
      '</div>' +
      '</td>'
    );
  }

  var fcMoneyFormatSample = '';

  function fcRememberMoneyFormatSample(text) {
    if (text && String(text).trim()) fcMoneyFormatSample = String(text).trim();
  }

  function fcParseMoneyTextToCents(text) {
    if (!text) return 0;
    var s = String(text).trim().replace(/\s+[A-Z]{3}\s*$/, '');
    var digits = s.replace(/[^\d.,]/g, '');
    if (!digits) return 0;

    if (digits.indexOf(',') !== -1 && digits.indexOf('.') !== -1) {
      digits = digits.replace(/,/g, '');
    } else if (digits.indexOf(',') !== -1 && digits.indexOf('.') === -1) {
      var parts = digits.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        digits = parts[0].replace(/\./g, '') + '.' + parts[1];
      } else {
        digits = digits.replace(/,/g, '');
      }
    }

    var num = parseFloat(digits);
    if (Number.isNaN(num)) return 0;
    return Math.round(num * 100);
  }

  function fcFormatMoneyCents(cents) {
    var sample = fcMoneyFormatSample;
    if (!sample) {
      var sampleEl = document.querySelector('.cart-drawer .totals__total-value');
      if (sampleEl && sampleEl.textContent) sample = sampleEl.textContent.trim();
    }

    var amount = (Math.max(0, Math.round(Number(cents) || 0)) / 100).toFixed(2);
    if (!sample) return '$' + amount + ' USD';

    var replaced = sample.replace(/(\d[\d.,]*)/, amount);
    return replaced === sample ? sample.replace(/[\d.,]+/, amount) : replaced;
  }

  window.fcFormatMoneyCents = fcFormatMoneyCents;

  function fcReadRowUnitPriceCents(row, qty) {
    if (!row) return 0;
    var fromData = parseInt(row.dataset.fcUnitPriceCents, 10);
    if (!Number.isNaN(fromData) && fromData >= 0) return fromData;

    qty = Math.max(1, Number(qty) || 1);
    var priceEl =
      row.querySelector('.cart-item__totals .cart-item__discounted-prices .price--end') ||
      row.querySelector('.cart-item__totals .price--end') ||
      row.querySelector('.cart-item__line-price span:last-child') ||
      row.querySelector('.cart-item__line-price');

    var lineCents = fcParseMoneyTextToCents(priceEl ? priceEl.textContent : '');
    if (!lineCents) return 0;
    return Math.round(lineCents / qty);
  }

  function fcComputeCartDrawerTotalCents() {
    var total = 0;
    document.querySelectorAll('cart-drawer-items tr.cart-item').forEach(function (row) {
      var input = row.querySelector('input.quantity__input');
      var qty = input ? parseInt(input.value, 10) || 0 : 0;
      if (!qty) return;
      var unitCents = fcReadRowUnitPriceCents(row, qty);
      if (unitCents > 0) row.dataset.fcUnitPriceCents = String(unitCents);
      total += unitCents * qty;
    });
    return total;
  }

  function fcUpdateCartDrawerTotalOptimistic() {
    var totalEl = document.querySelector('.cart-drawer .totals__total-value');
    if (!totalEl) return;
    fcRememberMoneyFormatSample(totalEl.textContent);
    totalEl.textContent = fcFormatMoneyCents(fcComputeCartDrawerTotalCents());
  }

  window.fcUpdateCartDrawerTotalOptimistic = fcUpdateCartDrawerTotalOptimistic;

  function fcPrepareCartDrawerForCheckout() {
    var cartDrawer = document.querySelector('cart-drawer');
    var drawerItems = document.querySelector('cart-drawer-items');
    if (drawerItems) drawerItems.classList.remove('is-empty');
    if (cartDrawer) cartDrawer.classList.remove('is-empty');

    var checkout = document.getElementById('CartDrawer-Checkout');
    if (checkout) checkout.disabled = false;

    fcUpdateCartDrawerTotalOptimistic();
  }

  function fcShowOptimisticCartLine(variantId, qty, meta) {
    meta = meta || fcResolveVariantMeta(variantId);

    if (fcBumpCartDrawerVariantQty(variantId, qty)) {
      fcUpdateDrawerHeadingQty(qty);
      fcPrepareCartDrawerForCheckout(meta);
      return true;
    }

    if (!meta) return false;

    var tbody = fcEnsureCartDrawerItemsShell();
    if (!tbody) return false;

    var optId = 'CartDrawer-Item-opt-' + variantId;
    var existing = document.getElementById(optId);
    if (existing) {
      var input = existing.querySelector('input.quantity__input');
      var prev = input ? parseInt(input.value, 10) || 0 : 0;
      fcSetQuantityInputValue(input, prev + qty);
      fcUpdateDrawerHeadingQty(qty);
      fcPrepareCartDrawerForCheckout(meta);
      return true;
    }

    var row = document.createElement('tr');
    row.id = optId;
    row.className = 'cart-item fc-cart-line--optimistic';
    row.setAttribute('role', 'row');
    if (meta.priceRaw) row.dataset.fcUnitPriceCents = String(meta.priceRaw);
    else if (meta.price) row.dataset.fcUnitPriceCents = String(fcParseMoneyTextToCents(meta.price));
    row.innerHTML = fcBuildOptimisticCartRowHtml(meta, qty);
    tbody.appendChild(row);
    fcUpdateDrawerHeadingQty(qty);

    var cartDrawer = document.querySelector('cart-drawer');
    if (cartDrawer && typeof cartDrawer.clearEmptyState === 'function') {
      cartDrawer.clearEmptyState();
    }

    var heading = document.getElementById('CartDrawer-Heading');
    if (heading) heading.hidden = false;

    fcPrepareCartDrawerForCheckout(meta);

    return true;
  }

  function fcAddToCartPrelude(variantId, qty, meta) {
    if (typeof window.fcLoadCartDrawerScripts === 'function') {
      window.fcLoadCartDrawerScripts();
    }
    fcOpenCartDrawerImmediate();
    fcShowOptimisticCartLine(variantId, qty, meta);
    fcBumpCartCountBubble(qty);
  }

  window.fcAddToCartPrelude = fcAddToCartPrelude;

  function fcParseCartDrawerRoot(sectionHtml) {
    if (!sectionHtml) return null;
    return new DOMParser().parseFromString(sectionHtml, 'text/html').querySelector('#CartDrawer');
  }

  function fcFindCartRowForVariant(root, variantId) {
    if (!root || !variantId) return null;
    var vid = String(variantId);
    var inputs = root.querySelectorAll('input.quantity__input[data-quantity-variant-id="' + vid + '"]');
    for (var i = 0; i < inputs.length; i++) {
      var row = inputs[i].closest('tr.cart-item');
      if (row) return row;
    }
    return null;
  }

  function fcPatchCartIconBubble(cartDrawer, sectionHtml) {
    if (!sectionHtml) return;
    var bubble = document.getElementById('cart-icon-bubble');
    if (!bubble) return;
    var inner =
      cartDrawer && typeof cartDrawer.getSectionInnerHTML === 'function'
        ? cartDrawer.getSectionInnerHTML(sectionHtml)
        : fcGetSectionInnerHTML(sectionHtml);
    if (inner) bubble.innerHTML = inner;
  }

  function fcGetSectionInnerHTML(html, selector) {
    var target = new DOMParser().parseFromString(html, 'text/html').querySelector(selector || '.shopify-section');
    return target ? target.innerHTML : '';
  }

  function fcSyncCartDrawerLinesFromSection(cartDrawer, sectionRoot) {
    if (!cartDrawer || !sectionRoot) return;

    sectionRoot.querySelectorAll('input.quantity__input[data-quantity-variant-id]').forEach(function (freshInput) {
      var vid = freshInput.dataset.quantityVariantId;
      if (!vid) return;
      if (document.getElementById('CartDrawer-Item-opt-' + vid)) return;

      var liveInput = cartDrawer.querySelector('input.quantity__input[data-quantity-variant-id="' + vid + '"]');
      if (liveInput) {
        fcSetQuantityInputValue(liveInput, parseInt(freshInput.value, 10) || 0);
      }
    });
  }

  /** Keep optimistic row DOM — swap ids/index only so controls never disappear. */
  function fcPromoteOptimisticCartRow(optRow, freshRow) {
    if (!optRow || !freshRow) return false;

    if (freshRow.id) optRow.id = freshRow.id;

    var freshInput = freshRow.querySelector('input.quantity__input');
    var liveInput = optRow.querySelector('input.quantity__input');
    if (freshInput && liveInput) {
      fcSetQuantityInputValue(liveInput, parseInt(freshInput.value, 10) || 0);
      ['id', 'data-index', 'max', 'data-min', 'step', 'data-cart-quantity'].forEach(function (attr) {
        var val = freshInput.getAttribute(attr);
        if (val != null) liveInput.setAttribute(attr, val);
      });
    }

    var freshRemove = freshRow.querySelector('cart-remove-button');
    var liveRemove = optRow.querySelector('cart-remove-button');
    if (freshRemove && liveRemove) {
      if (freshRemove.id) liveRemove.id = freshRemove.id;
      if (freshRemove.dataset.index) liveRemove.dataset.index = freshRemove.dataset.index;
      if (freshRemove.dataset.variantId) liveRemove.dataset.variantId = freshRemove.dataset.variantId;
    }

    optRow.classList.remove('fc-cart-line--optimistic');
    return true;
  }

  /** Patch footer/bubble (and one line when optimistic) — avoids full drawer HTML swap. */
  function fcPatchCartDrawerFromSections(cartDrawer, state, variantId) {
    if (!cartDrawer || !state || !state.sections || !state.sections['cart-drawer']) return false;
    if (!cartDrawer.classList.contains('active')) return false;

    var sectionRoot = fcParseCartDrawerRoot(state.sections['cart-drawer']);
    if (!sectionRoot) return false;

    var patchedLine = false;
    if (variantId) {
      var optRow = document.getElementById('CartDrawer-Item-opt-' + variantId);
      var freshRow = fcFindCartRowForVariant(sectionRoot, variantId);
      if (optRow && freshRow) {
        fcPromoteOptimisticCartRow(optRow, freshRow);
        patchedLine = true;
      } else if (optRow && !freshRow) {
        optRow.remove();
        patchedLine = true;
      } else {
        fcSyncCartDrawerLinesFromSection(cartDrawer, sectionRoot);
        patchedLine = true;
      }
    } else {
      fcSyncCartDrawerLinesFromSection(cartDrawer, sectionRoot);
      patchedLine = true;
    }

    var freshFooter = sectionRoot.querySelector('.drawer__footer');
    var liveFooter = cartDrawer.querySelector('.drawer__footer');
    if (freshFooter && liveFooter) {
      liveFooter.innerHTML = freshFooter.innerHTML;
    }

    var freshQty = sectionRoot.querySelector('#CartDrawer-BagQty');
    var liveQty = document.getElementById('CartDrawer-BagQty');
    if (freshQty && liveQty) {
      liveQty.textContent = freshQty.textContent;
    }

    var freshHeading = sectionRoot.querySelector('#CartDrawer-Heading');
    var liveHeading = document.getElementById('CartDrawer-Heading');
    if (freshHeading && liveHeading) {
      liveHeading.hidden = freshHeading.hidden;
    }

    fcPatchCartIconBubble(cartDrawer, state.sections['cart-icon-bubble']);

    if (fcSectionRootHasCartItems(sectionRoot)) {
      if (typeof cartDrawer.clearEmptyState === 'function') {
        cartDrawer.clearEmptyState();
      }
    } else {
      fcSyncCartDrawerEmptyMarkup(cartDrawer, sectionRoot);
    }

    if (typeof cartDrawer.setHeaderCartIconAccessibility === 'function') {
      cartDrawer.setHeaderCartIconAccessibility();
    }

    return patchedLine;
  }

  function fcApplyCartDrawerSections(cartDrawer, state, variantId) {
    if (!cartDrawer || !state || !state.sections) return false;
    if (fcPatchCartDrawerFromSections(cartDrawer, state, variantId)) return true;
    if (typeof cartDrawer.renderContents === 'function') {
      cartDrawer.renderContents(state);
      return true;
    }
    return false;
  }

  async function fcRefreshCartDrawerFromServer() {
    var cartDrawer = document.querySelector('cart-drawer');
    if (!cartDrawer) return false;
    var sectionIds =
      typeof cartDrawer.getSectionsToRender === 'function'
        ? cartDrawer.getSectionsToRender().map(function (s) {
            return s.id;
          })
        : ['cart-drawer', 'cart-icon-bubble'];
    if (!sectionIds.length) return false;
    var res = await fcFetchCartApi('/?sections=' + sectionIds.join(','));
    if (!res.ok) return false;
    var sections = await fcParseJsonResponse(res);
    return fcApplyCartDrawerSections(cartDrawer, { sections: sections }, null);
  }

  async function fcReconcileCartUi() {
    try {
      var cart = await fcFetchCart();
      if (window.fcSyncPriceTagsFromCart) window.fcSyncPriceTagsFromCart(cart);
      await fcRefreshCartDrawerFromServer();
      return cart;
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  window.fcReconcileCartUi = fcReconcileCartUi;

  async function fcPublishCartState(cart) {
    if (window.fcSyncPriceTagsFromCart) window.fcSyncPriceTagsFromCart(cart);
    if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
      await publish(PUB_SUB_EVENTS.cartUpdate, { source: 'fc-cart', cartData: cart });
    }
  }

  function fcCartFeedbackPulse() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var icon = document.getElementById('cart-icon-bubble');
    if (!icon) return;
    icon.classList.remove('fc-cart-feedback');
    void icon.offsetWidth;
    icon.classList.add('fc-cart-feedback');
    icon.addEventListener(
      'animationend',
      function () {
        icon.classList.remove('fc-cart-feedback');
      },
      { once: true }
    );
  }

  window.fcCartFeedbackPulse = fcCartFeedbackPulse;

  function fcIsLocalThemeDev() {
    var host = window.location.hostname;
    return host === '127.0.0.1' || host === 'localhost';
  }

  var fcCartOpChain = Promise.resolve();
  var fcCartRateLimitedUntil = 0;

  /** Serializes cart API calls; UI prelude in fcAddToCart runs before this queue. */
  function fcEnqueueCartOp(fn) {
    var op = fcCartOpChain.then(fn);
    fcCartOpChain = op.catch(function () {});
    return op;
  }

  function fcCartApiUrl(path) {
    return path;
  }

  async function fcFetchCartApi(url, options) {
    if (Date.now() < fcCartRateLimitedUntil) {
      return new Response('', { status: 429, statusText: 'Too Many Requests (local cooldown)' });
    }

    options = options || {};
    if (!options.credentials) options.credentials = 'same-origin';

    var lastRes = null;
    var attempts = fcIsLocalThemeDev() ? 2 : 3;
    var delays = fcIsLocalThemeDev() ? [0, 350] : [0, 500, 1500];

    for (var attempt = 0; attempt < attempts; attempt++) {
      if (delays[attempt]) {
        await new Promise(function (resolve) {
          setTimeout(resolve, delays[attempt]);
        });
      }
      lastRes = await fetch(fcCartApiUrl(url), options);
      if (lastRes.ok) return lastRes;

      if (lastRes.status === 429) {
        if (fcIsLocalThemeDev()) {
          fcCartRateLimitedUntil = Date.now() + 2000;
        }
        return lastRes;
      }

      if (lastRes.status !== 502 && lastRes.status !== 503) return lastRes;
    }
    return lastRes;
  }

  async function fcParseJsonResponse(res) {
    var text = await res.text();
    if (!text || text.charAt(0) === '<') {
      var hint = fcIsLocalThemeDev()
        ? 'Local theme preview cart API is unavailable (proxy rate limit or 502). Wait ~30s, hard-refresh, or restart shopify theme dev. Disable VPN if enabled.'
        : 'Cart API returned an unexpected HTML response';
      throw new Error(hint);
    }
    try {
      return JSON.parse(text);
    } catch (parseErr) {
      throw new Error('Cart API returned invalid JSON');
    }
  }

  async function fcFetchCart() {
    var res = await fcFetchCartApi('/cart.js');
    if (!res.ok) throw new Error('Cart fetch failed ' + res.status);
    return fcParseJsonResponse(res);
  }

  async function fcOpenCartDrawer() {
    try {
      var cartDrawer = document.querySelector('cart-drawer');
      if (!cartDrawer) {
        await fcEnsureCartUi();
        document.getElementById('cart-icon-bubble')?.click();
        return true;
      }

      var wasOpen = cartDrawer.classList.contains('active');
      var hasDomLines = cartDrawer.querySelector('cart-drawer-items tbody tr.cart-item');
      var uiReady = fcEnsureCartUi();

      if (!wasOpen && hasDomLines) {
        fcOpenCartDrawerUi(cartDrawer);
      }

      if (typeof cartDrawer.getSectionsToRender === 'function') {
        var sectionIds = cartDrawer.getSectionsToRender().map(function (s) {
          return s.id;
        });
        if (sectionIds.length) {
          var res = await fcFetchCartApi('/?sections=' + sectionIds.join(','));
          if (!res.ok) throw new Error('Cart sections fetch failed ' + res.status);
          var sections = await fcParseJsonResponse(res);

          await uiReady;

          if (!wasOpen && hasDomLines) {
            fcApplyCartDrawerSections(cartDrawer, { sections: sections }, null);
          } else if (typeof cartDrawer.renderContents === 'function') {
            cartDrawer.renderContents({ sections: sections });
          }

          await fcPublishCartState(fcReadCartSnapshotFromDom());
          return true;
        }
      }

      await uiReady;

      try {
        var cartFallback = await fcFetchCart();
        await fcPublishCartState(cartFallback);
      } catch (countErr) {
        console.error(countErr);
      }

      fcOpenCartDrawerUi(cartDrawer);

      return true;
    } catch (e) {
      console.error('Open cart drawer error:', e);
      return false;
    }
  }

  async function fcAddToCart(variantId, qty, meta) {
    if (!variantId) return false;
    qty = Number(qty) || 1;

    fcAddToCartPrelude(variantId, qty, meta);

    return fcEnqueueCartOp(async function () {
      try {
        var cartDrawer = document.querySelector('cart-drawer');
        var sections =
          cartDrawer && typeof cartDrawer.getSectionsToRender === 'function'
            ? cartDrawer.getSectionsToRender().map(function (s) {
                return s.id;
              })
            : [];

        var res = await fcFetchCartApi('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [{ id: variantId, quantity: qty }],
            sections: sections,
            sections_url: window.location.pathname,
          }),
        });

        var state = await fcParseJsonResponse(res);
        if (!res.ok) {
          throw new Error(state.description || state.message || 'Cart add failed ' + res.status);
        }

        if (cartDrawer && fcCartDrawerSectionReady(state)) {
          fcApplyCartDrawerSections(cartDrawer, state, variantId);
        } else {
          await fcRefreshCartDrawerFromServer();
        }

        await fcPublishCartState(fcReadCartSnapshotFromDom());

        fcCartFeedbackPulse();
        return true;
      } catch (e) {
        console.error('Add to cart error:', e);
        await fcReconcileCartUi();
        return false;
      }
    });
  }

  window.fcAddToCart = fcAddToCart;
  window.fcOpenCartDrawer = fcOpenCartDrawer;

  var fcBagRemoveDialogPromise = null;

  function fcCloseBagRemoveDialog() {
    var dialog = document.getElementById('fc-bag-remove-dialog');
    if (!dialog) return;
    dialog.hidden = true;
    document.body.classList.remove('fc-bag-remove-open');
  }

  window.fcConfirmRemoveFromBag = function () {
    if (fcBagRemoveDialogPromise) return fcBagRemoveDialogPromise;

    var dialog = document.getElementById('fc-bag-remove-dialog');
    if (!dialog) {
      return Promise.resolve(window.confirm('Remove the item from your bag?'));
    }

    var dialogPromise = new Promise(function (resolve) {
      var confirmBtn = dialog.querySelector('.fc-bag-remove-dialog__confirm');
      var done = false;

      function finish(result) {
        if (done) return;
        done = true;
        fcCloseBagRemoveDialog();
        document.removeEventListener('keydown', onKeydown);
        confirmBtn.removeEventListener('click', onConfirm);
        dialog.querySelectorAll('[data-fc-bag-remove-dismiss]').forEach(function (el) {
          el.removeEventListener('click', onCancel);
        });
        resolve(result);
      }

      function onConfirm(e) {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        finish(true);
      }

      function onCancel(e) {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        finish(false);
      }

      function onKeydown(e) {
        if (e.key === 'Escape') onCancel();
      }

      confirmBtn.addEventListener('click', onConfirm);
      dialog.querySelectorAll('[data-fc-bag-remove-dismiss]').forEach(function (el) {
        el.addEventListener('click', onCancel);
      });
      document.addEventListener('keydown', onKeydown);

      dialog.hidden = false;
      document.body.classList.add('fc-bag-remove-open');
      confirmBtn.focus();
    });

    fcBagRemoveDialogPromise = dialogPromise.finally(function () {
      fcBagRemoveDialogPromise = null;
    });

    return fcBagRemoveDialogPromise;
  };
})();

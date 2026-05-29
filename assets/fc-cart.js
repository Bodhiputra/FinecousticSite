/**
 * Shared add-to-cart for shop grid and PDP.
 * MOCK_CART=true simulates cart UI when products are OOS in Admin.
 */
(function () {
  var MOCK_CART = true;
  var mockCartItems = {};

  function getProductByVariantId(variantId) {
    var els = document.querySelectorAll('[id^="fc-data-"]');
    for (var i = 0; i < els.length; i++) {
      try {
        var data = JSON.parse(els[i].textContent);
        var variant = data.variants.find(function (v) {
          return v.id === variantId;
        });
        if (variant) return { product: data, variant: variant };
      } catch (e) {}
    }
    return null;
  }

  function formatMockMoney(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  function renderMockCart() {
    var cartDrawer = document.querySelector('cart-drawer');
    var drawerItems = document.querySelector('cart-drawer-items');
    var cartItemsEl = document.getElementById('CartDrawer-CartItems');
    var checkoutBtn = document.getElementById('CartDrawer-Checkout');
    var totalEl = document.querySelector('.totals__total-value');
    var entries = Object.entries(mockCartItems);
    var totalQty = entries.reduce(function (s, pair) {
      return s + pair[1].qty;
    }, 0);

    document.querySelectorAll('.cart-count-bubble').forEach(function (el) {
      var n = el.querySelector('[aria-hidden="true"]');
      if (n) n.textContent = totalQty;
      el.classList.toggle('hidden', totalQty === 0);
    });

    var bagHeading = document.getElementById('CartDrawer-Heading');
    var bagQty = document.getElementById('CartDrawer-BagQty');
    var innerEmpty = document.querySelector('.drawer__inner-empty');

    if (entries.length === 0) {
      cartDrawer?.classList.add('is-empty');
      drawerItems?.classList.add('is-empty');
      if (bagHeading) bagHeading.hidden = true;
      if (bagQty) bagQty.textContent = '';
      if (innerEmpty) innerEmpty.style.display = '';
      if (cartItemsEl) cartItemsEl.innerHTML = '';
      if (checkoutBtn) checkoutBtn.disabled = true;
      return;
    }

    cartDrawer?.classList.remove('is-empty');
    drawerItems?.classList.remove('is-empty');
    if (bagHeading) bagHeading.hidden = false;
    if (bagQty) bagQty.textContent = '(' + totalQty + ')';
    if (innerEmpty) innerEmpty.style.display = 'none';
    if (checkoutBtn) checkoutBtn.disabled = false;

    var totalCents = entries.reduce(function (s, pair) {
      return s + pair[1].priceRaw * pair[1].qty;
    }, 0);
    if (totalEl) totalEl.textContent = formatMockMoney(totalCents);

    if (cartItemsEl) {
      cartItemsEl.innerHTML =
        '<div class="fc-receipt-items">' +
        entries
          .map(function (pair) {
            var vid = pair[0];
            var item = pair[1];
            return (
              '<div class="fc-receipt-item">' +
              '<div class="fc-receipt-item__img">' +
              '<img src="' +
              item.image +
              '" alt="' +
              item.title +
              '" width="80" height="80" loading="lazy">' +
              '</div>' +
              '<div class="fc-receipt-item__detail">' +
              '<span class="fc-receipt-item__name">' +
              item.title +
              '</span>' +
              '<div class="fc-receipt-item__bottom">' +
              '<span class="fc-receipt-item__price">' +
              formatMockMoney(item.priceRaw * item.qty) +
              '</span>' +
              '<div class="fc-receipt-qty">' +
              '<button class="fc-receipt-qty__btn" type="button" data-mock-minus="' +
              vid +
              '">−</button>' +
              '<span class="fc-receipt-qty__count">' +
              item.qty +
              '</span>' +
              '<button class="fc-receipt-qty__btn" type="button" data-mock-plus="' +
              vid +
              '">+</button>' +
              '</div>' +
              '</div>' +
              '</div>' +
              '</div>'
            );
          })
          .join('') +
        '</div>';

      cartItemsEl.querySelectorAll('[data-mock-minus]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.dataset.mockMinus;
          if (mockCartItems[id]) {
            mockCartItems[id].qty -= 1;
            if (mockCartItems[id].qty <= 0) delete mockCartItems[id];
            renderMockCart();
          }
        });
      });
      cartItemsEl.querySelectorAll('[data-mock-plus]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.dataset.mockPlus;
          if (mockCartItems[id]) {
            mockCartItems[id].qty += 1;
            renderMockCart();
          }
        });
      });
    }

    if (cartDrawer && typeof cartDrawer.open === 'function') {
      cartDrawer.open();
    } else {
      document.querySelector('.drawer')?.classList.add('active');
    }
  }

  function mockAddToCart(variantId, qty) {
    var found = getProductByVariantId(variantId);
    if (!found) return false;
    var product = found.product;
    var variant = found.variant;
    var key = String(variantId);
    if (mockCartItems[key]) {
      mockCartItems[key].qty += qty;
    } else {
      mockCartItems[key] = {
        title: product.title,
        price: variant.price,
        priceRaw: variant.priceRaw,
        image: variant.image || product.image,
        variantTitle: variant.title !== 'Default Title' ? variant.title : null,
        qty: qty,
      };
    }
    renderMockCart();
    return true;
  }

  async function fcAddToCart(variantId, qty) {
    if (!variantId) return false;

    if (MOCK_CART) return mockAddToCart(variantId, qty);

    try {
      var cartDrawer = document.querySelector('cart-drawer');
      var sections =
        cartDrawer && typeof cartDrawer.getSectionsToRender === 'function'
          ? cartDrawer.getSectionsToRender().map(function (s) {
              return s.id;
            })
          : [];

      var res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ id: variantId, quantity: qty }],
          sections: sections,
          sections_url: window.location.pathname,
        }),
      });

      if (!res.ok) throw new Error('Cart add failed ' + res.status);
      var state = await res.json();

      if (cartDrawer && state.sections && typeof cartDrawer.renderContents === 'function') {
        cartDrawer.renderContents(state);
      } else {
        var countRes = await fetch('/cart.js');
        var cart = await countRes.json();
        document.querySelectorAll('.cart-count-bubble').forEach(function (el) {
          var n = el.querySelector('[aria-hidden="true"]');
          if (n) n.textContent = cart.item_count;
          el.classList.remove('hidden');
        });
      }

      if (cartDrawer && typeof cartDrawer.open === 'function') {
        cartDrawer.open();
      } else {
        document.getElementById('cart-icon-bubble')?.click();
      }
      return true;
    } catch (e) {
      console.error('Add to cart error:', e);
      return false;
    }
  }

  window.fcAddToCart = fcAddToCart;
})();

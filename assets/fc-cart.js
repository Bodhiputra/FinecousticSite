/**
 * Shared add-to-cart for shop grid and PDP.
 */
(function () {
  async function fcAddToCart(variantId, qty) {
    if (!variantId) return false;

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

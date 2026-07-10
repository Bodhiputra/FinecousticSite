/**
 * Shared add-to-cart for shop grid and PDP.
 */
(function () {
  function fcCartSectionsReady(cartDrawer, state) {
    if (!cartDrawer || !state || !state.sections) return false;
    if (typeof cartDrawer.getSectionsToRender !== 'function') return false;
    return cartDrawer.getSectionsToRender().every(function (s) {
      return Boolean(state.sections[s.id]);
    });
  }

  async function fcEnsureCartUi() {
    if (typeof window.fcLoadCartDrawerScripts === 'function') {
      await window.fcLoadCartDrawerScripts();
    }
    if (!customElements.get('cart-drawer')) {
      await customElements.whenDefined('cart-drawer');
    }
  }

  async function fcPublishCartState(cart) {
    if (window.fcSyncPriceTagsFromCart) window.fcSyncPriceTagsFromCart(cart);
    if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
      await publish(PUB_SUB_EVENTS.cartUpdate, { source: 'fc-cart', cartData: cart });
    }
  }

  async function fcFetchCart() {
    var res = await fetch('/cart.js');
    return res.json();
  }

  async function fcOpenCartDrawer() {
    try {
      await fcEnsureCartUi();

      var cartDrawer = document.querySelector('cart-drawer');
      if (!cartDrawer) {
        document.getElementById('cart-icon-bubble')?.click();
        return true;
      }

      if (typeof cartDrawer.getSectionsToRender === 'function' && typeof cartDrawer.renderContents === 'function') {
        var sectionIds = cartDrawer.getSectionsToRender().map(function (s) {
          return s.id;
        });
        if (sectionIds.length) {
          var res = await fetch('/?sections=' + sectionIds.join(','));
          var sections = await res.json();
          cartDrawer.renderContents({ sections: sections });
          try {
            var cart = await fcFetchCart();
            await fcPublishCartState(cart);
          } catch (syncErr) {
            console.error(syncErr);
          }
          return true;
        }
      }

      try {
        var cartFallback = await fcFetchCart();
        await fcPublishCartState(cartFallback);
      } catch (countErr) {
        console.error(countErr);
      }

      if (typeof cartDrawer.open === 'function') {
        cartDrawer.open();
      } else {
        document.getElementById('cart-icon-bubble')?.click();
      }

      return true;
    } catch (e) {
      console.error('Open cart drawer error:', e);
      return false;
    }
  }

  async function fcAddToCart(variantId, qty) {
    if (!variantId) return false;

    try {
      await fcEnsureCartUi();

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

      var state = await res.json();
      if (!res.ok) {
        throw new Error(state.description || state.message || 'Cart add failed ' + res.status);
      }

      var rendered = false;
      if (cartDrawer && fcCartSectionsReady(cartDrawer, state) && typeof cartDrawer.renderContents === 'function') {
        try {
          cartDrawer.renderContents(state);
          rendered = true;
        } catch (renderErr) {
          console.error('Cart drawer render failed:', renderErr);
        }
      }

      if (!rendered) {
        try {
          var cart = await fcFetchCart();
          document.querySelectorAll('.cart-count-bubble').forEach(function (el) {
            var n = el.querySelector('[aria-hidden="true"]');
            if (n) n.textContent = cart.item_count;
            el.classList.remove('hidden');
          });
          if (cartDrawer && cart.item_count > 0 && typeof cartDrawer.clearEmptyState === 'function') {
            cartDrawer.clearEmptyState();
          } else if (cartDrawer && cartDrawer.classList.contains('is-empty') && cart.item_count > 0) {
            cartDrawer.classList.remove('is-empty');
          }
          await fcPublishCartState(cart);
        } catch (countErr) {
          console.error(countErr);
        }

        if (cartDrawer && typeof cartDrawer.open === 'function') {
          cartDrawer.open();
        } else {
          document.getElementById('cart-icon-bubble')?.click();
        }
      } else {
        if (cartDrawer && typeof cartDrawer.clearEmptyState === 'function') {
          cartDrawer.clearEmptyState();
        }
        try {
          var cartAfterRender = await fcFetchCart();
          await fcPublishCartState(cartAfterRender);
        } catch (syncErr) {
          console.error(syncErr);
        }
      }

      return true;
    } catch (e) {
      console.error('Add to cart error:', e);
      return false;
    }
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

    fcBagRemoveDialogPromise = dialogPromise
      .then(function (confirmed) {
        if (!confirmed) return false;
        if (typeof window.fcLoadCartDrawerScripts === 'function') {
          return window.fcLoadCartDrawerScripts().then(function () {
            return customElements.whenDefined('cart-drawer-items').then(function () {
              return true;
            });
          });
        }
        return customElements.whenDefined('cart-drawer-items').then(function () {
          return true;
        });
      })
      .catch(function () {
        return false;
      })
      .finally(function () {
        fcBagRemoveDialogPromise = null;
      });

    return fcBagRemoveDialogPromise;
  };
})();

class CartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('click', (event) => {
      event.preventDefault();
      const cartItems = this.closest('cart-items') || this.closest('cart-drawer-items');
      if (!cartItems) return;

      const remove = async () => {
        if (typeof window.fcLoadCartDrawerScripts === 'function') {
          try {
            await window.fcLoadCartDrawerScripts();
          } catch (loadErr) {
            console.error(loadErr);
            return;
          }
        }
        if (cartItems.tagName === 'CART-DRAWER-ITEMS') {
          await customElements.whenDefined('cart-drawer-items');
        }
        if (typeof cartItems.updateQuantity !== 'function') {
          console.error('Cart drawer items not ready — reload and try again.');
          return;
        }
        cartItems.updateQuantity(this.dataset.index, 0, event, undefined, this.dataset.variantId);
      };

      if (cartItems.tagName === 'CART-DRAWER-ITEMS' && typeof window.fcConfirmRemoveFromBag === 'function') {
        window.fcConfirmRemoveFromBag().then((confirmed) => {
          if (confirmed) remove();
        });
        return;
      }

      remove();
    });
  }
}

customElements.define('cart-remove-button', CartRemoveButton);

function formatCartErrors(errors) {
  if (!errors) return '';
  if (typeof errors === 'string') return errors;
  if (Array.isArray(errors)) return errors.filter(Boolean).join(' ');
  if (typeof errors === 'object') {
    return Object.values(errors)
      .flat()
      .filter(Boolean)
      .map((value) => (typeof value === 'string' ? value : ''))
      .join(' ')
      .trim();
  }
  return String(errors);
}

class CartItems extends HTMLElement {
  constructor() {
    super();
    this.lineItemStatusElement =
      document.getElementById('shopping-cart-line-item-status') || document.getElementById('CartDrawer-LineItemStatus');

    const onChangeHandler =
      this.tagName === 'CART-DRAWER-ITEMS'
        ? this.onChange.bind(this)
        : debounce(this.onChange.bind(this), ON_CHANGE_DEBOUNCE_TIMER);

    this.addEventListener('change', onChangeHandler);
  }

  cartUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      if (event.source === 'cart-items' || event.source === 'fc-cart') {
        return;
      }
      return this.onCartUpdate();
    });
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  resetQuantityInput(id) {
    const input =
      this.querySelector(`#Quantity-${id}`) || this.querySelector(`#Drawer-quantity-${id}`);
    if (!input) return;
    input.value = input.getAttribute('value');
    this.isEnterPressed = false;
  }

  setValidity(event, index, message) {
    event.target.setCustomValidity(message);
    event.target.reportValidity();
    this.resetQuantityInput(index);
    event.target.select();
  }

  validateQuantity(event) {
    const inputValue = parseInt(event.target.value);
    const index = event.target.dataset.index;
    let message = '';

    if (inputValue < event.target.dataset.min) {
      message = window.quickOrderListStrings.min_error.replace('[min]', event.target.dataset.min);
    } else if (inputValue > parseInt(event.target.max)) {
      message = window.quickOrderListStrings.max_error.replace('[max]', event.target.max);
    } else if (inputValue % parseInt(event.target.step) !== 0) {
      message = window.quickOrderListStrings.step_error.replace('[step]', event.target.step);
    }

    if (message) {
      this.setValidity(event, index, message);
    } else if (inputValue === 0 && this.tagName === 'CART-DRAWER-ITEMS') {
      event.target.setCustomValidity('');
      event.target.reportValidity();
      const self = this;
      const confirmRemove =
        typeof window.fcConfirmRemoveFromBag === 'function'
          ? window.fcConfirmRemoveFromBag()
          : Promise.resolve(window.confirm('Remove the item from your bag?'));

      confirmRemove.then((confirmed) => {
        if (confirmed) {
          self.updateQuantity(
            index,
            inputValue,
            event,
            document.activeElement.getAttribute('name'),
            event.target.dataset.quantityVariantId
          );
        } else {
          self.resetQuantityInput(index);
        }
      });
    } else {
      event.target.setCustomValidity('');
      event.target.reportValidity();
      this.updateQuantity(
        index,
        inputValue,
        event,
        document.activeElement.getAttribute('name'),
        event.target.dataset.quantityVariantId
      );
    }
  }

  onChange(event) {
    this.validateQuantity(event);
  }

  optimisticRemoveLine(line, variantId) {
    if (this.tagName !== 'CART-DRAWER-ITEMS') return null;

    let lineItem = document.getElementById(`CartDrawer-Item-${line}`);
    if (!lineItem && variantId) {
      lineItem = document.getElementById(`CartDrawer-Item-opt-${variantId}`);
    }
    if (!lineItem && variantId) {
      const input = document.querySelector(
        `cart-drawer input.quantity__input[data-quantity-variant-id="${variantId}"]`
      );
      lineItem = input?.closest('tr.cart-item') || null;
    }
    if (!lineItem) return null;

    const qtyInput = lineItem.querySelector('input.quantity__input');
    const lineQty = qtyInput ? parseInt(qtyInput.value, 10) || 1 : 1;
    const resolvedVariantId = variantId || qtyInput?.dataset?.quantityVariantId;
    const parent = lineItem.parentElement;
    const snapshot = {
      html: lineItem.outerHTML,
      parent,
      lineQty,
      variantId: resolvedVariantId,
      bubbleCounts: [],
    };

    lineItem.remove();

    document.querySelectorAll('.cart-count-bubble span[aria-hidden="true"]').forEach((el) => {
      const prev = parseInt(el.textContent, 10) || 0;
      snapshot.bubbleCounts.push({
        el,
        prev,
        bubble: el.closest('.cart-count-bubble'),
        hadHidden: el.closest('.cart-count-bubble')?.classList.contains('hidden'),
      });
      const next = Math.max(0, prev - lineQty);
      if (next < 100) el.textContent = String(next);
      const bubble = el.closest('.cart-count-bubble');
      if (bubble) bubble.classList.toggle('hidden', next === 0);
    });

    if (resolvedVariantId && typeof window.fcBumpVariantQtyInUi === 'function') {
      window.fcBumpVariantQtyInUi(resolvedVariantId, -lineQty);
    }

    if (typeof window.fcUpdateDrawerHeadingQty === 'function') {
      window.fcUpdateDrawerHeadingQty(-lineQty);
    }

    if (this.querySelectorAll('.cart-item').length === 0) {
      this.classList.add('is-empty');
      const cartDrawerWrapper = document.querySelector('cart-drawer');
      if (cartDrawerWrapper) cartDrawerWrapper.classList.add('is-empty');
      if (typeof window.fcClearCartDrawerErrors === 'function') {
        window.fcClearCartDrawerErrors();
      }
      if (typeof window.fcShowCartDrawerEmptyOptimistic === 'function') {
        window.fcShowCartDrawerEmptyOptimistic();
      }
    } else if (typeof window.fcUpdateCartDrawerTotalOptimistic === 'function') {
      window.fcUpdateCartDrawerTotalOptimistic();
    }

    return snapshot;
  }

  optimisticDrawerQuantityDelta(line, nextQty, variantId) {
    if (this.tagName !== 'CART-DRAWER-ITEMS') return null;

    const qtyInput = document.getElementById(`Drawer-quantity-${line}`);
    const prevQty = qtyInput ? parseInt(qtyInput.getAttribute('value'), 10) || 0 : 0;
    const delta = nextQty - prevQty;
    if (!delta) return null;

    if (qtyInput) {
      qtyInput.setAttribute('value', String(nextQty));
      qtyInput.dataset.cartQuantity = String(nextQty);
    }

    const vid = Number(variantId);
    if (vid) {
      document.querySelectorAll('.fc-card__tag[data-variant-id]').forEach((tag) => {
        if (Number(tag.dataset.variantId) === vid && window.fcApplyPriceTagQty) {
          window.fcApplyPriceTagQty(tag, Math.max(0, Number(tag.dataset.fcQty || 0) + delta));
        }
      });
      document.querySelectorAll('.fc-pdp-u__atc[data-variant-id]').forEach((atc) => {
        if (Number(atc.dataset.variantId) === vid && window.fcApplyPdpAtcQty) {
          window.fcApplyPdpAtcQty(atc, Math.max(0, Number(atc.dataset.fcQty || 0) + delta));
        }
      });
    }

    if (typeof window.fcBumpCartCountBubble === 'function') {
      window.fcBumpCartCountBubble(delta);
    }

    const headingQty = document.getElementById('CartDrawer-BagQty');
    if (headingQty) {
      const match = headingQty.textContent.match(/\((\d+)\)/);
      const headingPrev = match ? parseInt(match[1], 10) : 0;
      const headingNext = Math.max(0, headingPrev + delta);
      headingQty.textContent = headingNext > 0 ? `(${headingNext})` : '';
    }

    if (typeof window.fcUpdateCartDrawerTotalOptimistic === 'function') {
      window.fcUpdateCartDrawerTotalOptimistic();
    }

    return { line, prevQty, nextQty, delta, variantId: vid || variantId };
  }

  rollbackOptimisticDrawerQuantity(snapshot) {
    if (!snapshot) return;

    const qtyInput = document.getElementById(`Drawer-quantity-${snapshot.line}`);
    if (qtyInput) {
      qtyInput.value = snapshot.prevQty;
      qtyInput.setAttribute('value', String(snapshot.prevQty));
      qtyInput.dataset.cartQuantity = String(snapshot.prevQty);
      const qtyInputEl = qtyInput.closest('quantity-input');
      if (qtyInputEl && typeof qtyInputEl.validateQtyRules === 'function') {
        qtyInputEl.validateQtyRules();
      }
    }

    const vid = Number(snapshot.variantId);
    if (vid) {
      document.querySelectorAll('.fc-card__tag[data-variant-id]').forEach((tag) => {
        if (Number(tag.dataset.variantId) === vid && window.fcApplyPriceTagQty) {
          window.fcApplyPriceTagQty(tag, Math.max(0, Number(tag.dataset.fcQty || 0) - snapshot.delta));
        }
      });
      document.querySelectorAll('.fc-pdp-u__atc[data-variant-id]').forEach((atc) => {
        if (Number(atc.dataset.variantId) === vid && window.fcApplyPdpAtcQty) {
          window.fcApplyPdpAtcQty(atc, Math.max(0, Number(atc.dataset.fcQty || 0) - snapshot.delta));
        }
      });
    }

    if (typeof window.fcBumpCartCountBubble === 'function') {
      window.fcBumpCartCountBubble(-snapshot.delta);
    }

    const headingQty = document.getElementById('CartDrawer-BagQty');
    if (headingQty) {
      const match = headingQty.textContent.match(/\((\d+)\)/);
      const headingPrev = match ? parseInt(match[1], 10) : 0;
      const headingNext = Math.max(0, headingPrev - snapshot.delta);
      headingQty.textContent = headingNext > 0 ? `(${headingNext})` : '';
    }
  }

  patchDrawerAfterQuantityChange(parsedState, line) {
    const sectionHtml = parsedState.sections?.['cart-drawer'];
    if (sectionHtml) {
      const parsed = new DOMParser().parseFromString(sectionHtml, 'text/html');
      const newRow = parsed.getElementById(`CartDrawer-Item-${line}`);
      const oldRow = document.getElementById(`CartDrawer-Item-${line}`);
      if (newRow && oldRow) {
        oldRow.replaceWith(document.importNode(newRow, true));
      }

      const drawerRoot = document.getElementById('CartDrawer');
      const newFooter = parsed.querySelector('.drawer__footer');
      const oldFooter = drawerRoot?.querySelector('.drawer__footer');
      if (newFooter && oldFooter) {
        oldFooter.innerHTML = newFooter.innerHTML;
      }
    }

    const bubbleHtml = parsedState.sections?.['cart-icon-bubble'];
    if (bubbleHtml) {
      const bubbleRoot = document.getElementById('cart-icon-bubble');
      const bubbleInner = this.getSectionInnerHTML(bubbleHtml, '#shopify-section-cart-icon-bubble');
      if (bubbleRoot && bubbleInner) {
        const bubbleTarget = bubbleRoot.querySelector('#shopify-section-cart-icon-bubble') || bubbleRoot;
        bubbleTarget.innerHTML = bubbleInner;
      }
    } else if (typeof parsedState.item_count === 'number') {
      document.querySelectorAll('#cart-icon-bubble .cart-count-bubble span[aria-hidden="true"]').forEach((el) => {
        const count = parsedState.item_count;
        if (count < 100) el.textContent = String(count);
        el.closest('.cart-count-bubble')?.classList.toggle('hidden', count === 0);
      });
    }

    if (typeof parsedState.item_count === 'number') {
      const headingQty = document.getElementById('CartDrawer-BagQty');
      if (headingQty) {
        headingQty.textContent = parsedState.item_count > 0 ? `(${parsedState.item_count})` : '';
      }
    }

    if (window.fcSyncPriceTagsFromCart && Array.isArray(parsedState.items)) {
      window.fcSyncPriceTagsFromCart(parsedState);
    }
  }

  rollbackOptimisticRemove(snapshot) {
    if (!snapshot?.html || !snapshot.parent) return;

    const temp = document.createElement('div');
    temp.innerHTML = snapshot.html;
    const node = temp.firstElementChild;
    if (node) snapshot.parent.appendChild(node);

    snapshot.bubbleCounts.forEach(({ el, prev, bubble, hadHidden }) => {
      if (prev < 100) el.textContent = String(prev);
      if (bubble) bubble.classList.toggle('hidden', Boolean(hadHidden));
    });

    if (snapshot.variantId && typeof window.fcBumpVariantQtyInUi === 'function') {
      window.fcBumpVariantQtyInUi(snapshot.variantId, snapshot.lineQty);
    }

    if (typeof window.fcUpdateDrawerHeadingQty === 'function') {
      window.fcUpdateDrawerHeadingQty(snapshot.lineQty);
    }

    const cartDrawerWrapper = document.querySelector('cart-drawer');
    if (cartDrawerWrapper) {
      cartDrawerWrapper.querySelector('.drawer__inner-empty')?.remove();
      if (typeof cartDrawerWrapper.clearEmptyState === 'function') {
        cartDrawerWrapper.clearEmptyState();
      }
    }

    this.classList.remove('is-empty');
    cartDrawerWrapper?.classList.remove('is-empty');
  }

  onCartUpdate() {
    if (this.tagName === 'CART-DRAWER-ITEMS') {
      return fetch(`${routes.cart_url}?section_id=cart-drawer`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const selectors = ['cart-drawer-items', '.cart-drawer__footer'];
          for (const selector of selectors) {
            const targetElement = document.querySelector(selector);
            const sourceElement = html.querySelector(selector);
            if (targetElement && sourceElement) {
              targetElement.replaceWith(sourceElement);
            }
          }
          const cartDrawer = document.querySelector('cart-drawer');
          if (cartDrawer) {
            if (html.querySelector('.cart-item')) {
              if (typeof cartDrawer.clearEmptyState === 'function') {
                cartDrawer.clearEmptyState();
              }
            } else if (typeof window.fcSyncCartDrawerEmptyMarkup === 'function') {
              const sectionRoot = html.querySelector('#CartDrawer');
              if (sectionRoot) window.fcSyncCartDrawerEmptyMarkup(cartDrawer, sectionRoot);
            } else if (typeof cartDrawer.applyEmptyState === 'function') {
              cartDrawer.applyEmptyState();
            }
          }
        })
        .catch((e) => {
          console.error(e);
        });
    } else {
      return fetch(`${routes.cart_url}?section_id=main-cart-items`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const sourceQty = html.querySelector('cart-items');
          this.innerHTML = sourceQty.innerHTML;
        })
        .catch((e) => {
          console.error(e);
        });
    }
  }

  getSectionsToRender() {
    return [
      {
        id: 'main-cart-items',
        section: document.getElementById('main-cart-items').dataset.id,
        selector: '.js-contents',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
      {
        id: 'cart-live-region-text',
        section: 'cart-live-region-text',
        selector: '.shopify-section',
      },
      {
        id: 'main-cart-footer',
        section: document.getElementById('main-cart-footer').dataset.id,
        selector: '.js-contents',
      },
    ];
  }

  updateQuantity(line, quantity, event, name, variantId) {
    const isDrawerRemove = this.tagName === 'CART-DRAWER-ITEMS' && quantity === 0;
    const isDrawerQtyChange = this.tagName === 'CART-DRAWER-ITEMS' && quantity !== 0;
    const removeSnapshot = isDrawerRemove ? this.optimisticRemoveLine(line, variantId) : null;
    const qtySnapshot = isDrawerQtyChange ? this.optimisticDrawerQuantityDelta(line, quantity, variantId) : null;

    if (!isDrawerRemove && !isDrawerQtyChange) {
      this.enableLoading(line);
    }

    const body = JSON.stringify({
      line,
      quantity,
      sections: this.getSectionsToRender().map((section) => section.section),
      sections_url: window.location.pathname,
    });
    const eventTarget = event.currentTarget instanceof CartRemoveButton ? 'clear' : 'change';

    fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
      .then((response) => {
        return response.text();
      })
      .then((state) => {
        const parsedState = JSON.parse(state);

        CartPerformance.measure(`${eventTarget}:paint-updated-sections"`, () => {
          const quantityElement =
            document.getElementById(`Quantity-${line}`) || document.getElementById(`Drawer-quantity-${line}`);
          const items = document.querySelectorAll('.cart-item');

          if (parsedState.errors) {
            const errorMessage = formatCartErrors(parsedState.errors);
            const itemRemoved =
              quantity === 0 &&
              (!parsedState.items || !parsedState.items[line - 1] || parsedState.items.length < items.length);

            if (errorMessage && !itemRemoved) {
              if (removeSnapshot) this.rollbackOptimisticRemove(removeSnapshot);
              if (qtySnapshot) this.rollbackOptimisticDrawerQuantity(qtySnapshot);
              if (quantityElement) {
                quantityElement.value = quantityElement.getAttribute('value');
              }
              this.updateLiveRegions(line, errorMessage);
              return;
            }
          }

          this.classList.toggle('is-empty', parsedState.item_count === 0);
          const cartDrawerWrapper = document.querySelector('cart-drawer');
          const cartFooter = document.getElementById('main-cart-footer');

          if (cartFooter) cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);
          if (cartDrawerWrapper) cartDrawerWrapper.classList.toggle('is-empty', parsedState.item_count === 0);

          if (isDrawerQtyChange) {
            this.patchDrawerAfterQuantityChange(parsedState, line);
          } else {
            this.getSectionsToRender().forEach((section) => {
              const root = document.getElementById(section.id);
              if (!root || !parsedState.sections?.[section.section]) return;

              const elementToReplace = section.selector
                ? root.querySelector(section.selector) || root
                : root;
              if (!elementToReplace) return;

              elementToReplace.innerHTML = this.getSectionInnerHTML(
                parsedState.sections[section.section],
                section.selector
              );
            });

            if (
              parsedState.item_count === 0 &&
              cartDrawerWrapper &&
              parsedState.sections?.['cart-drawer'] &&
              typeof window.fcSyncCartDrawerEmptyMarkup === 'function'
            ) {
              const sectionRoot = new DOMParser()
                .parseFromString(parsedState.sections['cart-drawer'], 'text/html')
                .querySelector('#CartDrawer');
              if (sectionRoot) window.fcSyncCartDrawerEmptyMarkup(cartDrawerWrapper, sectionRoot);
            } else if (parsedState.item_count === 0 && cartDrawerWrapper) {
              if (typeof window.fcShowCartDrawerEmptyOptimistic === 'function') {
                window.fcShowCartDrawerEmptyOptimistic();
              } else if (typeof cartDrawerWrapper.applyEmptyState === 'function') {
                cartDrawerWrapper.applyEmptyState();
              }
            }
          }

          let message = '';
          const cartErrorsEl = document.getElementById('CartDrawer-CartErrors');

          if (quantity === 0 && !parsedState.errors) {
            if (cartErrorsEl) cartErrorsEl.textContent = '';
            if (typeof parsedState.item_count === 'number') {
              const headingQty = document.getElementById('CartDrawer-BagQty');
              if (headingQty) {
                headingQty.textContent = parsedState.item_count > 0 ? `(${parsedState.item_count})` : '';
              }
            }
          } else if (
            quantity !== 0 &&
            items.length === parsedState.items.length &&
            quantityElement &&
            parsedState.items[line - 1] &&
            parsedState.items[line - 1].quantity !== parseInt(quantityElement.value, 10)
          ) {
            message = window.cartStrings.quantityError.replace(
              '[quantity]',
              parsedState.items[line - 1].quantity
            );
          }

          this.updateLiveRegions(line, message);

          if (parsedState.item_count === 0 && cartDrawerWrapper && typeof window.fcClearCartDrawerErrors === 'function') {
            window.fcClearCartDrawerErrors();
          }

          const lineItem =
            document.getElementById(`CartItem-${line}`) || document.getElementById(`CartDrawer-Item-${line}`);
          if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
            cartDrawerWrapper
              ? trapFocus(cartDrawerWrapper, lineItem.querySelector(`[name="${name}"]`))
              : lineItem.querySelector(`[name="${name}"]`).focus();
          } else if (parsedState.item_count === 0 && cartDrawerWrapper) {
            trapFocus(cartDrawerWrapper.querySelector('.drawer__inner-empty'), cartDrawerWrapper.querySelector('a'));
          } else if (document.querySelector('.cart-item') && cartDrawerWrapper) {
            trapFocus(cartDrawerWrapper, document.querySelector('.cart-item__name'));
          }
        });

        CartPerformance.measureFromEvent(`${eventTarget}:user-action`, event);

        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items', cartData: parsedState, variantId: variantId });
      })
      .catch(() => {
        if (removeSnapshot) this.rollbackOptimisticRemove(removeSnapshot);
        if (qtySnapshot) this.rollbackOptimisticDrawerQuantity(qtySnapshot);
        this.querySelectorAll('.loading__spinner').forEach((overlay) => overlay.classList.add('hidden'));
        const errors = document.getElementById('cart-errors') || document.getElementById('CartDrawer-CartErrors');
        if (errors) errors.textContent = window.cartStrings.error;
      })
      .finally(() => {
        if (!isDrawerRemove && !isDrawerQtyChange) this.disableLoading(line);
      });
  }

  updateLiveRegions(line, message) {
    const lineItemError =
      document.getElementById(`Line-item-error-${line}`) || document.getElementById(`CartDrawer-LineItemError-${line}`);
    const text = formatCartErrors(message) || (typeof message === 'string' ? message : '');
    if (lineItemError) lineItemError.querySelector('.cart-item__error-text').textContent = text;

    this.lineItemStatusElement.setAttribute('aria-hidden', true);

    const cartStatus =
      document.getElementById('cart-live-region-text') || document.getElementById('CartDrawer-LiveRegionText');
    cartStatus.setAttribute('aria-hidden', false);

    setTimeout(() => {
      cartStatus.setAttribute('aria-hidden', true);
    }, 1000);
  }

  getSectionInnerHTML(html, selector) {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const target = parsed.querySelector(selector);
    return target ? target.innerHTML : '';
  }

  enableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.add('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) => overlay.classList.remove('hidden'));

    document.activeElement.blur();
    this.lineItemStatusElement.setAttribute('aria-hidden', false);
  }

  disableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.remove('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    cartItemElements.forEach((overlay) => overlay.classList.add('hidden'));
    cartDrawerItemElements.forEach((overlay) => overlay.classList.add('hidden'));
  }
}

customElements.define('cart-items', CartItems);

class CartDrawerItems extends CartItems {
  getSectionsToRender() {
    return [
      {
        id: 'CartDrawer',
        section: 'cart-drawer',
        selector: '.drawer__inner',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '#shopify-section-cart-icon-bubble',
      },
    ];
  }
}

if (!customElements.get('cart-drawer-items')) {
  customElements.define('cart-drawer-items', CartDrawerItems);
}

if (!customElements.get('cart-note')) {
  customElements.define(
    'cart-note',
    class CartNote extends HTMLElement {
      constructor() {
        super();

        this.addEventListener(
          'input',
          debounce((event) => {
            const body = JSON.stringify({ note: event.target.value });
            fetch(`${routes.cart_update_url}`, { ...fetchConfig(), ...{ body } })
              .then(() => CartPerformance.measureFromEvent('note-update:user-action', event));
          }, ON_CHANGE_DEBOUNCE_TIMER)
        );
      }
    }
  );
}

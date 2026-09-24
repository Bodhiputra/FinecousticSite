class CartDrawer extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
    this.querySelector('#CartDrawer-Overlay').addEventListener('click', this.close.bind(this));
    this.setHeaderCartIconAccessibility();
  }

  setHeaderCartIconAccessibility() {
    const cartLink = document.querySelector('#cart-icon-bubble');
    if (!cartLink || cartLink.dataset.fcCartToggleBound === 'true') return;

    cartLink.dataset.fcCartToggleBound = 'true';
    cartLink.setAttribute('role', 'button');
    cartLink.setAttribute('aria-haspopup', 'dialog');
    cartLink.addEventListener('click', (event) => {
      event.preventDefault();
      if (this.classList.contains('active')) {
        this.close();
      } else {
        this.open(cartLink);
      }
    });
    cartLink.addEventListener('keydown', (event) => {
      if (event.code.toUpperCase() === 'SPACE') {
        event.preventDefault();
        if (this.classList.contains('active')) {
          this.close();
        } else {
          this.open(cartLink);
        }
      }
    });
  }

  open(triggeredBy) {
    if (triggeredBy) this.setActiveElement(triggeredBy);
    const cartDrawerNote = this.querySelector('[id^="Details-"] summary');
    if (cartDrawerNote && !cartDrawerNote.hasAttribute('role')) this.setSummaryAccessibility(cartDrawerNote);

    document.body.classList.add('overflow-hidden', 'fc-cart-open');
    const cartLink = document.querySelector('#cart-icon-bubble');
    if (cartLink) cartLink.setAttribute('aria-expanded', 'true');

    requestAnimationFrame(() => {
      this.classList.add('animate', 'active');
    });

    this.addEventListener(
      'transitionend',
      () => {
        const containerToTrapFocusOn = this.classList.contains('is-empty')
          ? this.querySelector('.drawer__inner-empty')
          : document.getElementById('CartDrawer');
        const focusElement = this.querySelector('.cart__empty-text') || this.querySelector('.drawer__heading') || this.querySelector('.drawer__inner');
        trapFocus(containerToTrapFocusOn, focusElement);
      },
      { once: true }
    );
  }

  close() {
    this.classList.remove('active');
    removeTrapFocus(this.activeElement);
    document.body.classList.remove('overflow-hidden', 'fc-cart-open');
    const cartLink = document.querySelector('#cart-icon-bubble');
    if (cartLink) cartLink.setAttribute('aria-expanded', 'false');
  }

  setSummaryAccessibility(cartDrawerNote) {
    cartDrawerNote.setAttribute('role', 'button');
    cartDrawerNote.setAttribute('aria-expanded', 'false');

    if (cartDrawerNote.nextElementSibling.getAttribute('id')) {
      cartDrawerNote.setAttribute('aria-controls', cartDrawerNote.nextElementSibling.id);
    }

    cartDrawerNote.addEventListener('click', (event) => {
      event.currentTarget.setAttribute('aria-expanded', !event.currentTarget.closest('details').hasAttribute('open'));
    });

    cartDrawerNote.parentElement.addEventListener('keyup', onKeyUpEscape);
  }

  applyEmptyState() {
    this.classList.add('is-empty');
    const drawerItems = this.querySelector('cart-drawer-items');
    if (drawerItems) drawerItems.classList.add('is-empty');
    const heading = this.querySelector('#CartDrawer-Heading');
    if (heading) heading.hidden = true;
    const headingQty = this.querySelector('#CartDrawer-BagQty');
    if (headingQty) headingQty.textContent = '';
  }

  clearEmptyState() {
    this.classList.remove('is-empty');
    const drawerItems = this.querySelector('cart-drawer-items');
    if (drawerItems) drawerItems.classList.remove('is-empty');
    const heading = this.querySelector('#CartDrawer-Heading');
    if (heading) heading.hidden = false;
    this.querySelector('.drawer__inner-empty')?.remove();
  }

  sectionHtmlHasCartItems(sectionHtml) {
    if (!sectionHtml) return null;
    const parsed = new DOMParser().parseFromString(sectionHtml, 'text/html');
    return !!parsed.querySelector('.cart-item');
  }

  renderContents(parsedState) {
    const sectionHtml = parsedState.sections?.['cart-drawer'];
    const hasItems =
      typeof parsedState.item_count === 'number'
        ? parsedState.item_count > 0
        : this.sectionHtmlHasCartItems(sectionHtml);

    if (hasItems) {
      this.clearEmptyState();
    } else if (typeof this.applyEmptyState === 'function') {
      this.applyEmptyState();
    }

    this.querySelector('.drawer__inner')?.classList.remove('is-empty');
    this.productId = parsedState.id;
    var wasOpen = this.classList.contains('active');
    this.getSectionsToRender().forEach((section) => {
      const sectionHtml = parsedState.sections?.[section.id];
      if (!sectionHtml) return;

      const sectionElement = section.selector
        ? document.querySelector(section.selector)
        : document.getElementById(section.id);

      if (!sectionElement) return;
      sectionElement.innerHTML = this.getSectionInnerHTML(sectionHtml, section.selector);
    });

    if (hasItems) {
      this.clearEmptyState();
    } else {
      this.applyEmptyState();
      if (typeof window.fcSyncCartDrawerEmptyMarkup === 'function' && sectionHtml) {
        const sectionRoot = new DOMParser().parseFromString(sectionHtml, 'text/html').querySelector('#CartDrawer');
        if (sectionRoot) window.fcSyncCartDrawerEmptyMarkup(this, sectionRoot);
      }
    }

    var overlay = this.querySelector('#CartDrawer-Overlay');
    if (overlay) {
      overlay.addEventListener('click', this.close.bind(this));
    }
    this.setHeaderCartIconAccessibility();
    if (!wasOpen) this.open();
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    const target = new DOMParser().parseFromString(html, 'text/html').querySelector(selector);
    return target ? target.innerHTML : '';
  }

  getSectionsToRender() {
    return [
      {
        id: 'cart-drawer',
        selector: '#CartDrawer',
      },
      {
        id: 'cart-icon-bubble',
      },
    ];
  }

  getSectionDOM(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector);
  }

  setActiveElement(element) {
    this.activeElement = element;
  }
}

customElements.define('cart-drawer', CartDrawer);

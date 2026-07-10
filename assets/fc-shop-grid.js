(function () {

  /* ── colour map for swatches ── */
  const COLOR_CSS = {
    black: '#1a1a1a', white: '#e8e8e8', graphite: '#3d3d3d',
    silver: '#b0b0b0', grey: '#666', gray: '#666',
    red: '#cc3333', blue: '#3366cc', navy: '#1a2040',
    green: '#336633', pink: '#cc6699', purple: '#663399',
    yellow: '#cccc00', gold: '#c8a800', orange: '#cc6633',
    brown: '#7a5c3a', beige: '#c8b99a',
  };

  /* ── cart add (shared with PDP via fc-cart.js) ── */
  async function addToCart(variantId, qty) {
    if (window.fcAddToCart) return window.fcAddToCart(variantId, qty);
    return false;
  }

  /* ── state ── */
  let expVariantId = null;
  let expQty = 0;

  /* ── DOM refs ── */
  const overlay    = document.getElementById('fc-overlay');
  const expanded   = document.getElementById('fc-expanded');
  const expImageWrap = document.getElementById('fc-exp-image-wrap');
  const expCat     = document.getElementById('fc-exp-category');
  const expName    = document.getElementById('fc-exp-name');
  const expPrice   = document.getElementById('fc-exp-price');
  const expColors  = document.getElementById('fc-exp-colors');
  const expColorNm = document.getElementById('fc-exp-color-name');
  const expSwatches= document.getElementById('fc-exp-swatches');
  const expClose   = document.getElementById('fc-exp-close');
  const expAtcBtn  = document.getElementById('fc-exp-atc-btn');
  const expStepper = document.getElementById('fc-exp-stepper');
  const expCount   = document.getElementById('fc-exp-count');
  const expMinus   = document.getElementById('fc-exp-minus');
  const expPlus    = document.getElementById('fc-exp-plus');

  /* ── read product JSON data ── */
  function getProductData(id) {
    try {
      const el = document.getElementById('fc-data-' + id);
      return el ? JSON.parse(el.textContent) : null;
    } catch (e) { return null; }
  }

  /* ── populate expanded card ── */
  function populate(data) {
    expImageWrap.innerHTML = '<img src="' + data.image + '" alt="' + (data.imageAlt || data.title).replace(/"/g, '&quot;') + '" width="900" height="900" loading="eager">';
    expCat.textContent  = data.type || '';
    expName.textContent = data.title;
    expPrice.textContent = data.price;

    expColors.classList.add('hidden');
    expSwatches.innerHTML = '';
    expVariantId = data.variants[0] ? data.variants[0].id : null;
    expQty = 0;

    /* default to first available variant */
    const firstAvail = data.variants.find(v => v.available);
    if (firstAvail) expVariantId = firstAvail.id;

    if (data.hasColor && data.variants.length > 1) {
      expColors.classList.remove('hidden');

      /* collect unique colors */
      const seen = new Set();
      data.variants.forEach(variant => {
        if (!variant.color || seen.has(variant.color)) return;
        seen.add(variant.color);

        const btn = document.createElement('button');
        btn.className = 'fc-color-swatch' + (variant.id === expVariantId ? ' active' : '');
        if (!variant.available) btn.classList.add('unavailable');
        btn.dataset.variantId = variant.id;
        btn.dataset.color = variant.color;
        btn.dataset.image = variant.image || data.image;
        btn.title = variant.color;
        btn.type = 'button';
        btn.setAttribute('aria-label', variant.color);

        const css = COLOR_CSS[variant.color.toLowerCase()] || '#555';
        btn.style.background = css;
        if (variant.color.toLowerCase() === 'white') {
          btn.style.border = '2px solid rgba(255,255,255,0.2)';
        }

        btn.addEventListener('click', () => {
          if (!variant.available) return;
          expSwatches.querySelectorAll('.fc-color-swatch').forEach(s => s.classList.remove('active'));
          btn.classList.add('active');
          expVariantId = Number(btn.dataset.variantId);
          expColorNm.textContent = variant.color;
          if (btn.dataset.image) {
            const curImg = expImageWrap.querySelector('img');
            if (curImg) curImg.src = btn.dataset.image;
          }
          /* update price */
          const v = data.variants.find(vv => vv.id === expVariantId);
          if (v) expPrice.textContent = v.price;
        });

        expSwatches.appendChild(btn);
      });

      /* set initial color name */
      const activeVariant = data.variants.find(v => v.id === expVariantId);
      expColorNm.textContent = activeVariant ? (activeVariant.color || '') : '';
    }

    /* reset ATC */
    expanded.classList.remove('exp-added');
    expCount.textContent = '1';
    expAtcBtn.disabled = !firstAvail;
    expAtcBtn.textContent = firstAvail ? 'Add to Cart' : 'Sold Out';
  }

  /* ── open expanded card, animating from card element ── */
  function openExpanded(card) {
    const id   = card.dataset.productId;
    const data = getProductData(id);
    if (!data) return;

    populate(data);

    const rect  = card.getBoundingClientRect();
    const cardCX = rect.left + rect.width  / 2;
    const cardCY = rect.top  + rect.height / 2;

    const expandedW = Math.min(680, window.innerWidth * 0.92);
    const scale = rect.width / expandedW;
    const dx = cardCX - window.innerWidth  / 2;
    const dy = cardCY - window.innerHeight / 2;

    expanded.style.width      = expandedW + 'px';
    expanded.style.transition = 'none';
    expanded.style.transform  = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scale})`;
    expanded.style.opacity    = '0';

    overlay.classList.add('active');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        expanded.style.transition = 'transform 0.48s cubic-bezier(0.34, 1.1, 0.64, 1), opacity 0.28s ease';
        expanded.style.transform  = 'translate(-50%, -50%) scale(1)';
        expanded.style.opacity    = '1';
        expanded.classList.add('open');
      });
    });
  }

  function closeExpanded() {
    expanded.style.transition = 'transform 0.28s ease, opacity 0.22s ease';
    expanded.style.transform  = 'translate(-50%, -50%) scale(0.94)';
    expanded.style.opacity    = '0';
    overlay.classList.remove('active');
    setTimeout(() => {
      expanded.classList.remove('open', 'exp-added');
      expanded.style.transition = 'none';
    }, 280);
  }

  /* ── image click → product page; + button only → add to cart ── */
  function fcWireShopCards() {
    if (!window.fcWirePriceTag || !window.fcAddToCart) return;

    document.querySelectorAll('.fc-card').forEach(card => {
      if (card.dataset.fcCardBound === '1') return;
      card.dataset.fcCardBound = '1';

      const url = card.dataset.url;
      const image = card.querySelector('.fc-card__image');
      if (image && url) {
        image.addEventListener('click', () => {
          window.location.href = url;
        });
      }

      const tag = card.querySelector('.fc-card__tag');
      if (tag) window.fcWirePriceTag(tag, { onAdd: addToCart });
    });
  }

  function fcRunWhenCartReady(fn) {
    function run() {
      if (!window.fcWirePriceTag || !window.fcAddToCart) {
        setTimeout(run, 32);
        return;
      }
      if (customElements.get('cart-drawer')) {
        fn();
        return;
      }
      customElements.whenDefined('cart-drawer').then(fn).catch(function () {
        setTimeout(run, 32);
      });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      run();
    }
  }

  fcRunWhenCartReady(function () {
    if (window.fcLoadCartDrawerScripts) window.fcLoadCartDrawerScripts();
    fcWireShopCards();
  });


  /* ── expanded ATC ── */
  expAtcBtn.addEventListener('click', async () => {
    if (!expVariantId) return;
    expQty = 1;
    expCount.textContent = 1;
    expanded.classList.add('exp-added');
    await addToCart(expVariantId, 1);
  });

  expPlus.addEventListener('click', async () => {
    expQty++;
    expCount.textContent = expQty;
    await addToCart(expVariantId, 1);
  });

  expMinus.addEventListener('click', () => {
    if (expQty <= 1) {
      expQty = 0;
      expanded.classList.remove('exp-added');
    } else {
      expQty--;
      expCount.textContent = expQty;
    }
  });

  /* ── close ── */
  expClose.addEventListener('click', closeExpanded);
  overlay .addEventListener('click', closeExpanded);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeExpanded(); });

  /* ── grid columns: JS = visible product count; CSS media queries cap 5→4→3→2 ── */
  function updateGridColumns(visibleCount) {
    const grid = document.getElementById('fc-grid');
    if (!grid) return;
    const settingMax = parseInt(grid.dataset.cols || '5', 10);
    const cols = Math.max(1, Math.min(visibleCount, settingMax));
    grid.style.setProperty('--fc-product-cols', String(cols));
  }

  function syncGridColumns() {
    const visibleCount = document.querySelectorAll('.fc-card:not(.fc-hidden)').length;
    updateGridColumns(visibleCount);
  }

  let currentFilter = 'all';

  function fcClampScroll() {
    requestAnimationFrame(function () {
      var maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      if (window.scrollY > maxY) window.scrollTo(0, maxY);
    });
  }

  function fcResetShopScroll() {
    window.scrollTo(0, 0);
    fcClampScroll();
  }

  /* ── filter shared logic ── */
  function applyFilter(filter, opts) {
    opts = opts || {};
    var animate = opts.animate === true;

    if (filter !== currentFilter) fcResetShopScroll();
    currentFilter = filter;
    const cards = Array.from(document.querySelectorAll('.fc-card'));
    let visibleCount = 0;

    const toShow = [];
    const toHide = [];
    cards.forEach(function (card) {
      card.classList.remove('fc-card-animate');
      const visible = filter === 'all' || card.dataset.category === filter;
      if (visible) { visibleCount++; toShow.push(card); }
      else { toHide.push(card); }
    });

    const soonEl = document.getElementById('fc-grid-soon');
    const showSoon = filter === 'speakers' && visibleCount === 0;
    const zone = document.getElementById('fc-shop-swipe-zone');

    requestAnimationFrame(function () {
      toHide.forEach(function (card) { card.classList.add('fc-hidden'); });
      toShow.forEach(function (card) {
        card.classList.remove('fc-hidden');
        card.style.animationDelay = '0ms';
        if (animate) card.classList.add('fc-card-animate');
      });
      if (soonEl) soonEl.hidden = !showSoon;
      if (zone) zone.classList.toggle('fc-shop-swipe-zone--soon', showSoon);
      updateGridColumns(visibleCount);
      fcClampScroll();
    });
  }

  /* ── filter carousel ── */
  const FILTERS = [
    { key: 'all',         label: 'All Products' },
    { key: 'speakers',    label: 'Speakers' },
    { key: 'microphones', label: 'Microphones' },
    { key: 'earphones',   label: 'Earphones' },
  ];

  function fcResetCardImageStack(imageWrap) {
    if (!imageWrap) return;
    imageWrap.querySelectorAll('.fc-ig-dots').forEach(el => el.remove());
    imageWrap.classList.remove('fc-ig-viewport', 'is-dragging');
    delete imageWrap.dataset.fcIgGalleryBound;
    delete imageWrap.dataset.fcSwipeBound;
    delete imageWrap.dataset.fcSwiped;
    const track = imageWrap.querySelector('.fc-ig-track');
    if (track) {
      Array.from(track.querySelectorAll('.fc-card__img')).forEach(img => {
        img.classList.remove('fc-ig-slide', 'is-active');
        img.style.transform = '';
        imageWrap.appendChild(img);
      });
      track.remove();
    }
  }

  function fcInitCarousel() {
    if (!document.getElementById('fc-collection-header') || !window.FcTitleCarousel) return;
    window.FcTitleCarousel({
      id: 'fc-collection',
      extraSwipeId: 'fc-shop-swipe-zone',
      N: FILTERS.length,
      onSlide: function (logIdx, meta) {
        applyFilter(FILTERS[logIdx].key, { animate: !(meta && meta.initial) });
      },
      getInitialIdx: function () {
        var urlFilter = new URLSearchParams(window.location.search).get('filter');
        var idx = urlFilter ? FILTERS.findIndex(function (f) { return f.key === urlFilter; }) : -1;
        return idx >= 0 ? idx : 0;
      }
    }).init();
  }

  function fcInitCards() {
    document.querySelectorAll('.fc-card').forEach(card => {
      fcResetCardImageStack(card.querySelector('.fc-card__image'));
    });
  }

  function fcRunWhenReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  fcRunWhenReady(function () {
    fcInitCarousel();
    fcInitCards();
    syncGridColumns();
    fcClampScroll();
  });

  let fcFitTimer;
  window.addEventListener('resize', () => {
    clearTimeout(fcFitTimer);
    fcFitTimer = setTimeout(() => {
      syncGridColumns();
      fcClampScroll();
    }, 120);
  });

  let fcScrollClampTimer;
  window.addEventListener('scroll', function () {
    clearTimeout(fcScrollClampTimer);
    fcScrollClampTimer = setTimeout(fcClampScroll, 80);
  }, { passive: true });

  window.addEventListener('scrollend', fcClampScroll, { passive: true });

  document.addEventListener('shopify:section:load', function (evt) {
    if (!evt.target.querySelector || !evt.target.querySelector('#fc-collection-track')) return;
    fcInitCarousel();
    fcInitCards();
    fcWireShopCards();
  });

  const fcSection = document.getElementById('fc-grid')?.closest('.shopify-section');
  if (fcSection) {
    new MutationObserver(function () {
      if (document.getElementById('fc-collection-track')) {
        fcInitCarousel();
        fcInitCards();
        fcWireShopCards();
      }
    }).observe(fcSection, { childList: true });
  }

})();

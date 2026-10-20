(function () {
  var root = document.querySelector('.fc-pdp-studio[data-section-id]');
  if (!root) return;

  var gallery = root.querySelector('[data-fc-studio-gallery]');
  if (gallery) {
    var viewport = gallery.querySelector('[data-fc-studio-slides]');
    var slides = viewport ? viewport.querySelectorAll('.fc-pdp-u__slide[data-slide-index]') : [];
    var total = slides.length;

    if (total > 0 && viewport) {
      var prevBtn = gallery.querySelector('[data-fc-studio-prev]');
      var nextBtn = gallery.querySelector('[data-fc-studio-next]');
      var thumbs = gallery.querySelectorAll('[data-fc-studio-thumb]');

      function syncThumbs(activeIndex) {
        thumbs.forEach(function (thumb) {
          var ti = parseInt(thumb.getAttribute('data-fc-studio-thumb'), 10);
          var active = ti === activeIndex;
          thumb.classList.toggle('is-active', active);
          thumb.setAttribute('aria-current', active ? 'true' : 'false');
        });
      }

      if (total > 1 && typeof window.FcIgGallery === 'function') {
        var igGallery = window.FcIgGallery({
          viewport: viewport,
          slideSelector: '.fc-pdp-u__slide',
          prevBtn: prevBtn,
          nextBtn: nextBtn,
          loop: true,
          mouse: true,
          swipeThreshold: 36,
          onChange: function (i) {
            syncThumbs(i);
          },
        });
        igGallery.init();
        syncThumbs(igGallery.getIndex());

        thumbs.forEach(function (thumb) {
          thumb.addEventListener('click', function () {
            var ti = parseInt(thumb.getAttribute('data-fc-studio-thumb'), 10);
            if (!Number.isNaN(ti)) igGallery.goTo(ti, true);
          });
        });
      } else if (total > 1) {
        var index = 0;
        slides.forEach(function (slide, i) {
          if (slide.classList.contains('is-active')) index = i;
        });

        function setIndex(next) {
          index = ((next % total) + total) % total;
          slides.forEach(function (slide, i) {
            var active = i === index;
            slide.classList.toggle('is-active', active);
            slide.hidden = !active;
          });
          syncThumbs(index);
        }

        if (prevBtn) prevBtn.addEventListener('click', function () { setIndex(index - 1); });
        if (nextBtn) nextBtn.addEventListener('click', function () { setIndex(index + 1); });
        thumbs.forEach(function (thumb) {
          thumb.addEventListener('click', function () {
            var ti = parseInt(thumb.getAttribute('data-fc-studio-thumb'), 10);
            if (!Number.isNaN(ti)) setIndex(ti);
          });
        });
        setIndex(index);
      }
    }
  }

  var scrollBtn = document.querySelector('[data-fc-studio-scroll-catalog]');
  var catalogSection = root.closest('.shopify-section.fc-pdp-studio-section') || root;
  if (scrollBtn && catalogSection) {
    var scrollReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var scrollVisible = false;

    function navClearancePx() {
      var raw = getComputedStyle(document.documentElement).getPropertyValue('--fc-nav-clearance').trim();
      var n = parseFloat(raw);
      return Number.isFinite(n) ? n : 96;
    }

    function setScrollBtnVisible(show) {
      if (scrollVisible === show) return;
      scrollVisible = show;
      scrollBtn.classList.toggle('is-visible', show);
      scrollBtn.hidden = !show;
      scrollBtn.setAttribute('aria-hidden', show ? 'false' : 'true');
    }

    function updateScrollBtn() {
      var rect = catalogSection.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var show = rect.bottom < vh * 0.55 && rect.top < navClearancePx();
      setScrollBtnVisible(show);
    }

    function scrollToCatalog() {
      if (typeof window.fcStudioRevealCatalogInstant === 'function') {
        window.fcStudioRevealCatalogInstant(catalogSection);
      } else {
        catalogSection.classList.add('fc-studio-reveal--shown');
      }
      setScrollBtnVisible(false);

      var top = catalogSection.getBoundingClientRect().top + window.pageYOffset - navClearancePx();
      window.scrollTo({
        top: Math.max(0, top),
        behavior: scrollReducedMotion ? 'auto' : 'smooth',
      });
    }

    scrollBtn.addEventListener('click', scrollToCatalog);

    if ('IntersectionObserver' in window) {
      var scrollObserver = new IntersectionObserver(
        function () {
          updateScrollBtn();
        },
        { threshold: [0, 0.15, 0.35, 0.55, 0.75, 1] }
      );
      scrollObserver.observe(catalogSection);
    }

    window.addEventListener('scroll', updateScrollBtn, { passive: true });
    window.addEventListener('resize', updateScrollBtn, { passive: true });
    updateScrollBtn();
  }

  var accRoot = root.querySelector('.fc-pdp-studio__accordions');
  if (!accRoot || accRoot.dataset.fcAccAnimBound === '1') return;
  accRoot.dataset.fcAccAnimBound = '1';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ACC_MS = reducedMotion ? 0 : 450;
  var ACC_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

  function accPanel(details) {
    return details.querySelector('.fc-pdp-studio__acc-panel');
  }

  function accContentHeight(panel) {
    var body = panel.querySelector('.fc-pdp-studio__acc-body');
    if (!body) return 0;
    return body.scrollHeight;
  }

  function clearPanelInline(panel) {
    panel.style.height = '';
    panel.style.overflow = '';
    panel.style.transition = '';
  }

  function animatePanelHeight(panel, toPx, done) {
    if (ACC_MS === 0) {
      panel.style.overflow = 'hidden';
      panel.style.height = toPx + 'px';
      if (done) done();
      return;
    }

    var fromPx = panel.getBoundingClientRect().height;
    panel.style.overflow = 'hidden';
    panel.style.height = fromPx + 'px';
    panel.offsetHeight;
    panel.style.transition = 'height ' + ACC_MS + 'ms ' + ACC_EASE;
    panel.style.height = toPx + 'px';

    function onEnd(ev) {
      if (ev.propertyName !== 'height') return;
      panel.removeEventListener('transitionend', onEnd);
      panel.style.transition = '';
      if (done) done();
    }
    panel.addEventListener('transitionend', onEnd);
  }

  var allDetails = accRoot.querySelectorAll('details.fc-pdp-studio__acc-box');

  allDetails.forEach(function (details) {
    var panel = accPanel(details);
    if (!panel) return;
    if (details.open) {
      clearPanelInline(panel);
      panel.style.height = 'auto';
      panel.style.overflow = 'visible';
    } else {
      panel.style.overflow = 'hidden';
      panel.style.height = '0px';
    }
  });

  function closeDetails(details, cb) {
    if (!details.open) {
      if (cb) cb();
      return;
    }
    var panel = accPanel(details);
    if (!panel) {
      details.removeAttribute('open');
      if (cb) cb();
      return;
    }
    animatePanelHeight(panel, 0, function () {
      details.removeAttribute('open');
      panel.style.overflow = 'hidden';
      panel.style.height = '0px';
      if (cb) cb();
    });
  }

  function openDetails(details, cb) {
    var panel = accPanel(details);
    if (!panel) {
      details.setAttribute('open', '');
      if (cb) cb();
      return;
    }
    details.setAttribute('open', '');
    panel.style.overflow = 'hidden';
    panel.style.height = '0px';
    var target = accContentHeight(panel);
    animatePanelHeight(panel, target, function () {
      panel.style.height = 'auto';
      panel.style.overflow = 'visible';
      if (cb) cb();
    });
  }

  allDetails.forEach(function (details) {
    var summary = details.querySelector('.fc-pdp-studio__acc-summary');
    if (!summary) return;

    summary.addEventListener('click', function (e) {
      e.preventDefault();
      var opening = !details.open;

      if (opening) {
        var toClose = [];
        allDetails.forEach(function (other) {
          if (other !== details && other.open) toClose.push(other);
        });
        var step = 0;
        function afterCloses() {
          openDetails(details);
        }
        function closeNext() {
          if (step >= toClose.length) {
            afterCloses();
            return;
          }
          closeDetails(toClose[step++], closeNext);
        }
        closeNext();
      } else {
        closeDetails(details);
      }
    });
  });
})();

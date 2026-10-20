(function () {
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var REVEAL_IO = {
    threshold: [0, 0.12, 0.18, 0.25],
    rootMargin: '0px 0px -8% 0px',
  };

  var FEATURE_ROW_IO = {
    threshold: [0, 0.15, 0.22, 0.35],
    rootMargin: '0px 0px -6% 0px',
  };

  var MIN_RATIO = 0.12;
  var MIN_ROW_RATIO = 0.18;

  function studioSections(root) {
    return Array.prototype.slice.call(root.querySelectorAll('.shopify-section')).filter(function (el) {
      return (
        el.classList.contains('fc-pdp-studio-blank-section') ||
        el.classList.contains('fc-pdp-studio-section') ||
        el.classList.contains('fc-pdp-studio-driver-section') ||
        el.classList.contains('fc-pdp-studio-io-section') ||
        el.classList.contains('fc-pdp-studio-specs-section')
      );
    });
  }

  function featureRows(root) {
    root = root || document;
    return Array.prototype.slice.call(root.querySelectorAll('.fc-pdp-studio-features__row'));
  }

  function reveal(wrap) {
    if (wrap.classList.contains('fc-studio-reveal--shown')) return;
    wrap.classList.add('fc-studio-reveal--shown');
  }

  /** Jump-to-catalog: show catalog immediately (no scroll-in animation wait). */
  window.fcStudioRevealCatalogInstant = function (sectionWrap) {
    if (!sectionWrap) return;
    sectionWrap.classList.add('fc-studio-reveal--shown', 'fc-studio-reveal--instant');
    window.setTimeout(function () {
      sectionWrap.classList.remove('fc-studio-reveal--instant');
    }, 80);
  };

  function revealRow(row) {
    if (row.classList.contains('fc-studio-reveal-row--shown')) return;
    row.classList.add('fc-studio-reveal-row--shown');
  }

  function onIntersect(entries, observer, minRatio, revealFn) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      if (entry.intersectionRatio < minRatio) return;
      revealFn(entry.target);
      observer.unobserve(entry.target);
    });
  }

  function watchSections(sections) {
    if (!sections.length) return;

    if (reducedMotion) {
      sections.forEach(reveal);
      return;
    }

    var observer = new IntersectionObserver(function (entries, obs) {
      onIntersect(entries, obs, MIN_RATIO, reveal);
    }, REVEAL_IO);
    sections.forEach(function (wrap) {
      observer.observe(wrap);
    });
  }

  function watchFeatureRows(rows) {
    if (!rows.length) return;

    if (reducedMotion) {
      rows.forEach(revealRow);
      return;
    }

    var observer = new IntersectionObserver(function (entries, obs) {
      onIntersect(entries, obs, MIN_ROW_RATIO, revealRow);
    }, FEATURE_ROW_IO);
    rows.forEach(function (row) {
      observer.observe(row);
    });
  }

  function init(root) {
    root = root || document;
    var main = root.querySelector('#MainContent') || root;
    watchSections(studioSections(main));
    watchFeatureRows(featureRows(main));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init(document);
    });
  } else {
    init(document);
  }

  document.addEventListener('shopify:section:load', function (event) {
    var wrap = event.target;
    if (!wrap || !wrap.classList) return;
    if (!wrap.matches || !wrap.matches('.shopify-section')) return;

    if (wrap.classList.contains('fc-pdp-studio-features-section')) {
      watchFeatureRows(featureRows(wrap));
      return;
    }

    if (
      !wrap.classList.contains('fc-pdp-studio-blank-section') &&
      !wrap.classList.contains('fc-pdp-studio-section') &&
      !wrap.classList.contains('fc-pdp-studio-driver-section') &&
      !wrap.classList.contains('fc-pdp-studio-io-section') &&
      !wrap.classList.contains('fc-pdp-studio-specs-section')
    ) {
      return;
    }

    watchSections([wrap]);
  });
})();

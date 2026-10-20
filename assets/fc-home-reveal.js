(function () {
  if (!document.documentElement.classList.contains('js')) return;
  if (!document.body.classList.contains('template-index')) return;

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var HOME_SECTION_SELECTOR =
    '.fc-home-studio-landing-section,' +
    '.fc-home-hako-series-section,' +
    '.section-website-hero,' +
    '.fc-creator-feedback-section,' +
    '.fc-nomad-video-duo-section';

  var REVEAL_IO = {
    threshold: [0, 0.08, 0.12, 0.2],
    rootMargin: '0px 0px -6% 0px',
  };

  var MIN_RATIO = 0.08;

  function homeSections(root) {
    root = root || document;
    var main = root.querySelector('#MainContent') || root;
    return Array.prototype.slice.call(main.querySelectorAll('.shopify-section')).filter(function (el) {
      return el.matches(HOME_SECTION_SELECTOR);
    });
  }

  function isStudioHero(wrap) {
    return wrap && wrap.classList && wrap.classList.contains('fc-home-studio-landing-section');
  }

  function reveal(wrap) {
    if (wrap.classList.contains('fc-home-reveal--shown')) return;
    wrap.classList.add('fc-home-reveal--shown');
  }

  function revealAfterPaint(wrap) {
    if (reducedMotion) {
      reveal(wrap);
      return;
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        reveal(wrap);
      });
    });
  }

  function onIntersect(entries, observer) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      if (entry.intersectionRatio < MIN_RATIO) return;
      revealAfterPaint(entry.target);
      observer.unobserve(entry.target);
    });
  }

  function watchSections(sections, opts) {
    opts = opts || {};
    if (!sections.length) return;

    if (reducedMotion) {
      sections.forEach(reveal);
      return;
    }

    var observer = new IntersectionObserver(onIntersect, REVEAL_IO);
    sections.forEach(function (wrap) {
      if (isStudioHero(wrap) && opts.deferHero) return;

      var rect = wrap.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
        revealAfterPaint(wrap);
        return;
      }
      observer.observe(wrap);
    });
  }

  function revealStudioHero(sections) {
    var hero = sections.find(isStudioHero);
    if (!hero) return;
    revealAfterPaint(hero);
  }

  function init(root) {
    var sections = homeSections(root);
    var loaderPending = document.documentElement.classList.contains('fc-site-loader-pending');

    if (loaderPending && !reducedMotion) {
      watchSections(sections, { deferHero: true });
      document.addEventListener(
        'fcSiteLoaderDone',
        function onDone() {
          document.removeEventListener('fcSiteLoaderDone', onDone);
          revealStudioHero(sections);
        },
        { once: true }
      );
      return;
    }

    watchSections(sections);
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
    if (!wrap || !wrap.matches || !wrap.matches('.shopify-section')) return;
    if (!wrap.matches(HOME_SECTION_SELECTOR)) return;
    watchSections([wrap]);
  });
})();

(function () {

  const POLICIES = [
    { key: 'privacy-policy',       id: 'fc-pol-privacy'  },
    { key: 'shipping-policy',      id: 'fc-pol-shipping' },
    { key: 'refund-policy',        id: 'fc-pol-refund'   },
    { key: 'terms-and-conditions', id: 'fc-pol-terms'    },
  ];

  function applyPolicy(key) {
    document.querySelectorAll('.fc-policy-panel').forEach(panel => {
      panel.classList.remove('fc-pol-active');
      if (panel.dataset.policy === key) panel.classList.add('fc-pol-active');
    });
    const url = new URL(window.location.href);
    if (key === 'privacy-policy') {
      url.searchParams.delete('policy');
    } else {
      url.searchParams.set('policy', key);
    }
    history.pushState(null, '', url.toString());
  }

  function initCarousel() {
    if (!document.getElementById('fc-policies-header') || !window.FcTitleCarousel) return;
    window.FcTitleCarousel({
      id: 'fc-policies',
      extraSwipeId: 'fc-policy-wrap',
      swipeThreshold: 40,
      extraSwipeThreshold: 72,
      extraSwipeHorizontalRatio: 2.25,
      N: POLICIES.length,
      onSlide: function (logIdx) { applyPolicy(POLICIES[logIdx].key); },
      getInitialIdx: function () {
        var urlPolicy = new URLSearchParams(window.location.search).get('policy');
        var idx = urlPolicy ? POLICIES.findIndex(function (p) { return p.key === urlPolicy; }) : -1;
        return idx >= 0 ? idx : 0;
      }
    }).init();
  }

  function init() {
    if (!document.getElementById('fc-policies-header')) return;
    initCarousel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  document.addEventListener('shopify:section:load', function (evt) {
    if (!evt.target.querySelector || !evt.target.querySelector('#fc-policies-header')) return;
    init();
  });

  (function titleCaseTerms() {
    const panel = document.getElementById('fc-pol-terms');
    if (!panel) return;
    panel.querySelectorAll('h1, h2, h3, h4').forEach(el => {
      el.textContent = el.textContent.replace(/\S+/g, w =>
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      );
    });
  })();

})();

(function () {
  if (typeof Shopify !== 'undefined' && Shopify.designMode) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function staggerEnter(nodes, className, stepMs, maxDelay) {
    Array.prototype.forEach.call(nodes, function (node, index) {
      var delay = Math.min(index * stepMs, maxDelay || 9999);
      node.style.animationDelay = delay + 'ms';
      node.classList.add(className);
    });
  }

  function initStoreLocatorEnter() {
    var body = document.getElementById('fc-locator-body');
    if (!body || body.dataset.fcLocatorEnter === '1') return;
    body.dataset.fcLocatorEnter = '1';

    var title = document.querySelector('.fc-sl-title');
    if (title) title.classList.add('fc-locator-enter');

    staggerEnter(body.querySelectorAll('.fc-locator-card'), 'fc-locator-enter', 45, 480);
  }

  function initAccountEnter() {
    var root = document.querySelector('.customer.account, .customer.order, .customer.addresses');
    if (!root || root.dataset.fcAccountEnter === '1') return;
    root.dataset.fcAccountEnter = '1';

    var header = root.querySelector(':scope > div:first-child, :scope > h1');
    if (header) {
      header.classList.add('fc-account-enter-block');
      header.style.animationDelay = '0ms';
    }

    var blocks = root.querySelectorAll(':scope > div');
    staggerEnter(blocks, 'fc-account-enter-block', 70, 420);
  }

  function init() {
    initStoreLocatorEnter();
    initAccountEnter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', function (evt) {
    if (!evt.target) return;
    if (evt.target.querySelector('#fc-locator-body')) initStoreLocatorEnter();
    if (evt.target.querySelector('.customer.account, .customer.order, .customer.addresses')) initAccountEnter();
  });
})();

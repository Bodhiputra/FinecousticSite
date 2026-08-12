(function () {
  var MIN_VISIBLE_MS = 2200;
  var EXIT_MS = 700;

  function init() {
    var loader = document.getElementById('fc-site-loader');
    var root = document.documentElement;
    if (!loader || !root.classList.contains('fc-site-loader-pending')) {
      if (loader) loader.remove();
      root.classList.remove('fc-site-loader-pending', 'fc-site-loader-active');
      return;
    }

    if (root.classList.contains('shopify-design-mode')) {
      loader.remove();
      root.classList.remove('fc-site-loader-pending', 'fc-site-loader-active');
      return;
    }

    var startedAt = Date.now();
    root.classList.add('fc-site-loader-active');

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        loader.classList.add('is-entering');
      });
    });

    function finishExit() {
      loader.remove();
      root.classList.remove(
        'fc-site-loader-pending',
        'fc-site-loader-active',
        'fc-site-loader-revealing'
      );
    }

    function beginExit() {
      root.classList.remove('fc-site-loader-pending');
      root.classList.add('fc-site-loader-revealing');
      loader.classList.add('is-exiting');
      loader.classList.remove('is-entering');

      var done = false;
      function onTransitionEnd(event) {
        if (event.target !== loader || event.propertyName !== 'opacity') return;
        if (done) return;
        done = true;
        loader.removeEventListener('transitionend', onTransitionEnd);
        finishExit();
      }

      loader.addEventListener('transitionend', onTransitionEnd);
      window.setTimeout(function () {
        if (!done && loader.parentNode) {
          done = true;
          finishExit();
        }
      }, EXIT_MS + 120);
    }

    function scheduleExit() {
      var elapsed = Date.now() - startedAt;
      var wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
      window.setTimeout(beginExit, wait);
    }

    if (document.fonts && document.fonts.ready) {
      Promise.race([
        document.fonts.ready,
        new Promise(function (resolve) {
          window.setTimeout(resolve, 1500);
        }),
      ]).then(scheduleExit);
    } else {
      scheduleExit();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

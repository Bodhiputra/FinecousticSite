(function () {
  var EXIT_MS = 850;
  var MIN_SHOW_MS = 520;
  var NAV_DELAY_MS = 280;

  function loaderEl() {
    return document.getElementById('fc-transition-loader');
  }

  function show() {
    var el = loaderEl();
    if (!el) return;
    var root = document.documentElement;
    root.classList.add('fc-transition-loader-active');
    el.setAttribute('aria-hidden', 'false');
    el.classList.remove('is-exiting');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.classList.add('is-entering');
      });
    });
  }

  function hide() {
    var el = loaderEl();
    if (!el) return Promise.resolve();
    return new Promise(function (resolve) {
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        el.classList.remove('is-exiting', 'is-entering');
        el.setAttribute('aria-hidden', 'true');
        document.documentElement.classList.remove('fc-transition-loader-active');
        resolve();
      }

      el.classList.add('is-exiting');
      el.classList.remove('is-entering');

      function onTransitionEnd(event) {
        if (event.target !== el || event.propertyName !== 'opacity') return;
        el.removeEventListener('transitionend', onTransitionEnd);
        finish();
      }
      el.addEventListener('transitionend', onTransitionEnd);
      window.setTimeout(finish, EXIT_MS + 120);
    });
  }

  function runWithLoader(workFn) {
    var started = Date.now();
    show();
    return Promise.resolve()
      .then(function () {
        return workFn ? workFn() : undefined;
      })
      .finally(function () {
        var wait = Math.max(0, MIN_SHOW_MS - (Date.now() - started));
        window.setTimeout(function () {
          hide();
        }, wait);
      });
  }

  function navigate(url) {
    if (!url) return;
    show();
    window.setTimeout(function () {
      window.location.assign(url);
    }, NAV_DELAY_MS);
  }

  window.fcTransitionLoader = {
    show: show,
    hide: hide,
    run: runWithLoader,
    navigate: navigate,
  };
})();

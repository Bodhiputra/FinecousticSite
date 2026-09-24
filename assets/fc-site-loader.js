(function () {
  var MIN_VISIBLE_MS = 1300;
  var EXIT_MS = 850;

  function shouldSkipLoader() {
    try {
      if (document.documentElement.classList.contains('shopify-design-mode')) return true;
      if (!document.documentElement.classList.contains('fc-site-loader-pending')) return true;
      var nav = performance.getEntriesByType('navigation')[0];
      if (nav && nav.type === 'reload') return true;
      if (sessionStorage.getItem('fc-site-loader-seen') === '1') return true;
    } catch (e) {}
    return false;
  }

  function markLoaderSeen() {
    try {
      sessionStorage.setItem('fc-site-loader-seen', '1');
    } catch (e) {}
  }

  function init() {
    var loader = document.getElementById('fc-site-loader');
    var root = document.documentElement;
    if (!loader || shouldSkipLoader()) {
      if (loader) loader.remove();
      root.classList.remove('fc-site-loader-pending', 'fc-site-loader-active', 'fc-site-loader-revealing');
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
      markLoaderSeen();
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
          window.setTimeout(resolve, 800);
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

(function () {
  function loadCreatorFeedbackSection() {
    var path = window.location.pathname.replace(/\/+$/, '') || '/';
    if (path !== '/') return;
    if (document.querySelector('.fc-creator-feedback')) return;

    var anchor = document.querySelector('.fc-nomad-video-duo-section');
    if (!anchor || !anchor.id) return;

    var base = anchor.id.replace(/^shopify-section-/, '').replace(/__fc_nomad_video_duo$/, '');
    var keys = [base + '__fc_creator_feedback_home', base + '__fc_creator_feedback'];

    function injectHtml(html) {
      anchor.insertAdjacentHTML('beforebegin', html);
      var cssPath = '/cdn/shop/t/4/assets/fc-creator-feedback.css';
      if (!document.querySelector('link[href*="fc-creator-feedback.css"]')) {
        var links = document.querySelectorAll('link[rel="stylesheet"][href*="/assets/"]');
        var cssHref = '';
        for (var i = 0; i < links.length; i++) {
          var href = links[i].getAttribute('href') || '';
          var match = href.match(/^(.*\/assets\/)[^/?]+/);
          if (match) {
            cssHref = match[1] + 'fc-creator-feedback.css';
            break;
          }
        }
        if (!cssHref) cssHref = cssPath;
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = cssHref;
        document.head.appendChild(link);
      }
      if (!document.querySelector('script[src*="fc-creator-feedback.js"]')) {
        var scripts = document.querySelectorAll('script[src*="/assets/"]');
        var jsSrc = '';
        for (var j = 0; j < scripts.length; j++) {
          var src = scripts[j].getAttribute('src') || '';
          var jsMatch = src.match(/^(.*\/assets\/)[^/?]+/);
          if (jsMatch) {
            jsSrc = jsMatch[1] + 'fc-creator-feedback.js';
            break;
          }
        }
        if (jsSrc) {
          var script = document.createElement('script');
          script.src = jsSrc;
          script.defer = true;
          document.body.appendChild(script);
        }
      }
    }

    function tryKey(i) {
      if (i >= keys.length) return;
      fetch('/?sections=' + encodeURIComponent(keys[i]) + '&variant=' + Date.now(), { cache: 'no-store' })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          var html = data[keys[i]];
          if (!html) {
            tryKey(i + 1);
            return;
          }
          injectHtml(html);
        })
        .catch(function () { tryKey(i + 1); });
    }

    tryKey(0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadCreatorFeedbackSection);
  } else {
    loadCreatorFeedbackSection();
  }
})();

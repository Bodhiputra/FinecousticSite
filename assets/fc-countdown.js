(function () {
  var SELECTOR = '[data-fc-countdown]';
  var ROLL_MS = 720;
  var REDUCE_MOTION =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function pad(n) {
    return String(Math.max(0, n));
  }

  function resetTrack(track, next) {
    track.style.transition = 'none';
    track.classList.remove('is-rolling');
    track.innerHTML = '<span class="fc-countdown__roll-value">' + next + '</span>';
    void track.offsetWidth;
    track.style.transition = '';
  }

  function finishRoll(track, rollRoot, next) {
    resetTrack(track, next);
    rollRoot.dataset.currentValue = next;
    if (track.dataset.rollTimer) {
      window.clearTimeout(parseInt(track.dataset.rollTimer, 10));
      delete track.dataset.rollTimer;
    }
  }

  function setRollUnit(rollRoot, nextValue) {
    if (!rollRoot) return;

    var next = pad(nextValue);
    var current = rollRoot.dataset.currentValue || '';
    if (current === next) return;

    var track = rollRoot.querySelector('[data-fc-roll-track]');
    if (!track) return;

    if (!current || REDUCE_MOTION) {
      finishRoll(track, rollRoot, next);
      return;
    }

    if (track.classList.contains('is-rolling')) {
      finishRoll(track, rollRoot, next);
      return;
    }

    track.innerHTML =
      '<span class="fc-countdown__roll-value">' + current + '</span>' +
      '<span class="fc-countdown__roll-value">' + next + '</span>';
    track.classList.remove('is-rolling');
    void track.offsetWidth;

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        track.classList.add('is-rolling');
      });
    });

    function onEnd(event) {
      if (event.target !== track || event.propertyName !== 'transform') return;
      track.removeEventListener('transitionend', onEnd);
      finishRoll(track, rollRoot, next);
    }

    track.addEventListener('transitionend', onEnd);
    track.dataset.rollTimer = String(
      window.setTimeout(function () {
        track.removeEventListener('transitionend', onEnd);
        finishRoll(track, rollRoot, next);
      }, ROLL_MS + 80)
    );
  }

  function applyClientLaunchedHero(countdownRoot) {
    var stack = countdownRoot.closest('.fc-preorder-hero-stack--countdown');
    if (!stack || stack.dataset.fcClientLaunched === '1') return;
    stack.dataset.fcClientLaunched = '1';
    stack.classList.remove('fc-preorder-hero-stack--countdown');
    stack.classList.add('fc-preorder-hero-stack--launched');
    countdownRoot.remove();
    var cta = document.createElement('div');
    cta.className = 'fc-preorder-hero-launched-cta';
    cta.innerHTML =
      '<p class="website-hero__available-copy">Ready to fit in your space.</p>' +
      '<a class="website-hero__discover-more" href="/products/hako-nomad-fbs1">Discover More</a>';
    stack.appendChild(cta);
    document.documentElement.classList.remove('fc-site-loader-pending');
  }

  function unlockLaunchLockedControls() {
    document
      .querySelectorAll(
        '.fc-pdp-u__atc.is-launch-locked, .fc-pdp-u__atc[data-fc-launch-locked="true"], .fc-card__tag.fc-tag--launch-locked, [data-fc-launch-locked="true"]'
      )
      .forEach(function (el) {
        el.classList.remove('is-launch-locked', 'fc-tag--launch-locked');
        delete el.dataset.fcLaunchLocked;
        el.disabled = false;
        el.removeAttribute('aria-disabled');
      });
    window.dispatchEvent(new CustomEvent('fc-launch-live'));
  }

  function stopCountdownTimers() {
    if (window.__fcCountdownInterval) {
      window.clearInterval(window.__fcCountdownInterval);
      window.__fcCountdownInterval = null;
    }
  }

  function tryRefreshHeroSection(countdownRoot, launchTs) {
    if (window.__fcHeroSectionRefreshAttempted) {
      applyClientLaunchedHero(countdownRoot);
      unlockLaunchLockedControls();
      return;
    }
    window.__fcHeroSectionRefreshAttempted = true;

    var sectionEl = countdownRoot.closest('[id^="shopify-section-"]');
    if (!sectionEl) {
      applyClientLaunchedHero(countdownRoot);
      unlockLaunchLockedControls();
      return;
    }

    var sectionKey = sectionEl.id.replace(/^shopify-section-/, '');
    var bust = String(Date.now());
    var url =
      window.location.pathname +
      '?sections=' +
      encodeURIComponent(sectionKey) +
      '&variant=' +
      bust +
      '&_fc=' +
      bust;

    fetch(url, { credentials: 'same-origin', cache: 'no-store' })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        var html = data && data[sectionKey];
        if (!html || html.indexOf('data-fc-countdown') !== -1) {
          applyClientLaunchedHero(countdownRoot);
          unlockLaunchLockedControls();
          return;
        }
        sectionEl.outerHTML = html;
        unlockLaunchLockedControls();
      })
      .catch(function () {
        applyClientLaunchedHero(countdownRoot);
        unlockLaunchLockedControls();
      });
  }

  function completeLaunch(countdownRoot, launchTs) {
    stopCountdownTimers();
    if (countdownRoot) countdownRoot.classList.add('is-complete');
    unlockLaunchLockedControls();
    if (window.__fcLaunchCompleteHandled) {
      if (countdownRoot && countdownRoot.parentNode) countdownRoot.remove();
      return;
    }
    window.__fcLaunchCompleteHandled = true;
    window.setTimeout(function () {
      if (countdownRoot && countdownRoot.parentNode) {
        tryRefreshHeroSection(countdownRoot, launchTs);
      }
    }, 400);
  }

  function isPastLaunch(launchTs) {
    return launchTs > 0 && Math.floor(Date.now() / 1000) >= launchTs;
  }

  function isStoreLaunched() {
    var meta = document.querySelector('meta[name="fc-store-launched"]');
    return meta && meta.content === 'true';
  }

  function shouldTreatAsLive(launchTs) {
    return isStoreLaunched() || isPastLaunch(launchTs);
  }

  function tick(root) {
    var launchTs = parseInt(root.getAttribute('data-launch-ts'), 10);
    if (!launchTs) return;

    var now = Math.floor(Date.now() / 1000);
    var remaining = Math.max(0, launchTs - now);

    var days = Math.floor(remaining / 86400);
    remaining -= days * 86400;
    var hours = Math.floor(remaining / 3600);
    remaining -= hours * 3600;
    var minutes = Math.floor(remaining / 60);
    var seconds = remaining - minutes * 60;

    setRollUnit(root.querySelector('[data-fc-countdown-roll="days"]'), days);
    setRollUnit(root.querySelector('[data-fc-countdown-roll="hours"]'), hours);
    setRollUnit(root.querySelector('[data-fc-countdown-roll="minutes"]'), minutes);
    setRollUnit(root.querySelector('[data-fc-countdown-roll="seconds"]'), seconds);

    var a11y = root.querySelector('[data-fc-countdown-a11y]');
    if (a11y) {
      a11y.textContent =
        pad(days) + ' days, ' + pad(hours) + ' hours, ' + pad(minutes) + ' minutes, ' + pad(seconds) + ' seconds remaining';
    }

    if (launchTs - now <= 0) {
      completeLaunch(root, launchTs);
    }
  }

  function init() {
    var nodes = document.querySelectorAll(SELECTOR);
    if (!nodes.length) return;

    var launchTs = parseInt(nodes[0].getAttribute('data-launch-ts'), 10) || 0;
    if (shouldTreatAsLive(launchTs)) {
      nodes.forEach(function (root) {
        completeLaunch(root, parseInt(root.getAttribute('data-launch-ts'), 10) || launchTs);
      });
      return;
    }

    nodes.forEach(tick);
    stopCountdownTimers();
    window.__fcCountdownInterval = window.setInterval(function () {
      document.querySelectorAll(SELECTOR).forEach(tick);
    }, 1000);
  }

  function onStoreLive() {
    var nodes = document.querySelectorAll(SELECTOR);
    if (!nodes.length) {
      unlockLaunchLockedControls();
      return;
    }
    nodes.forEach(function (root) {
      completeLaunch(root, parseInt(root.getAttribute('data-launch-ts'), 10) || 0);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('pageshow', function () {
    onStoreLive();
  });
  window.addEventListener('fc-launch-live', onStoreLive);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') onStoreLive();
  });
})();

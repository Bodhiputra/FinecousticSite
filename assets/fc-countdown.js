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
      root.classList.add('is-complete');
    }
  }

  function init() {
    var nodes = document.querySelectorAll(SELECTOR);
    if (!nodes.length) return;

    nodes.forEach(tick);
    window.setInterval(function () {
      nodes.forEach(tick);
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

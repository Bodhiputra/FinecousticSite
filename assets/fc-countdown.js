(function () {
  var SELECTOR = '[data-fc-countdown]';

  function pad(n) {
    return String(Math.max(0, n));
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

    var daysEl = root.querySelector('[data-fc-countdown-days]');
    var hoursEl = root.querySelector('[data-fc-countdown-hours]');
    var minutesEl = root.querySelector('[data-fc-countdown-minutes]');
    var secondsEl = root.querySelector('[data-fc-countdown-seconds]');

    if (daysEl) daysEl.textContent = pad(days);
    if (hoursEl) hoursEl.textContent = pad(hours);
    if (minutesEl) minutesEl.textContent = pad(minutes);
    if (secondsEl) secondsEl.textContent = pad(seconds);

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

window.FcCarousel = function (cfg) {
  var N          = cfg.N;
  var onSlide    = cfg.onSlide    || function () {};
  var getInitIdx = cfg.getInitialIdx || function () { return 0; };

  var track, viewport, prevBtn, nextBtn;
  var domIdx  = 1;
  var logIdx  = 0;
  var sliding = false;

  function getItems() {
    return Array.from(track.querySelectorAll('.fc-title-item'));
  }

  function getCurrentTx() {
    var t = window.getComputedStyle(track).transform;
    if (!t || t === 'none') return 0;
    var m = t.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,([^,]+),/);
    return m ? parseFloat(m[1]) : 0;
  }

  function offsetForDom(i) {
    var items    = getItems();
    var item     = items[i];
    if (!item || !viewport) return 0;
    var vpRect   = viewport.getBoundingClientRect();
    var itemRect = item.getBoundingClientRect();
    var tx       = getCurrentTx();
    return tx + (vpRect.left + vpRect.width / 2) - (itemRect.left + itemRect.width / 2);
  }

  function snapToDom(i) {
    track.style.transition = 'none';
    track.style.transform  = 'translateX(' + offsetForDom(i) + 'px)';
    track.getBoundingClientRect();
  }

  function slideToDom(i, onEnd) {
    track.style.transition = 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)';
    track.style.transform  = 'translateX(' + offsetForDom(i) + 'px)';
    track.addEventListener('transitionend', function h() {
      track.removeEventListener('transitionend', h);
      if (onEnd) onEnd();
      sliding = false;
    }, { once: true });
  }

  function slideByDir(dir) {
    if (sliding) return;
    sliding = true;
    var targetDom = domIdx + dir;
    var items     = getItems();
    items.forEach(function (el, i) { el.classList.toggle('fc-title-active', i === targetDom); });
    logIdx = targetDom === 0 ? N - 1 : targetDom === N + 1 ? 0 : targetDom - 1;
    slideToDom(targetDom, function () {
      if (targetDom === 0 || targetDom === N + 1) {
        domIdx = targetDom === 0 ? N : 1;
        track.style.opacity = '0';
        getItems().forEach(function (el) { el.style.transition = 'none'; });
        snapToDom(domIdx);
        getItems().forEach(function (el, i) { el.classList.toggle('fc-title-active', i === domIdx); });
        track.getBoundingClientRect();
        requestAnimationFrame(function () {
          getItems().forEach(function (el) { el.style.transition = ''; });
          track.style.opacity = '1';
        });
      } else {
        domIdx = targetDom;
      }
    });
    onSlide(logIdx);
  }

  function init() {
    track    = document.getElementById(cfg.trackId);
    viewport = document.getElementById(cfg.viewportId);
    prevBtn  = cfg.prevSelector ? document.querySelector(cfg.prevSelector) : null;
    nextBtn  = cfg.nextSelector ? document.querySelector(cfg.nextSelector) : null;
    if (!track) return;

    logIdx  = 0;
    domIdx  = 1;
    sliding = false;

    getItems().forEach(function (el, i) { el.classList.toggle('fc-title-active', i === 1); });

    if (prevBtn) prevBtn.addEventListener('click', function () { slideByDir(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { slideByDir(+1); });

    var dragged = false;
    track.addEventListener('click', function (e) {
      if (dragged) { dragged = false; return; }
      var item = e.target.closest('.fc-title-item');
      if (!item) return;
      var idx = getItems().indexOf(item);
      if (idx === domIdx) return;
      slideByDir(idx > domIdx ? 1 : -1);
    });

    if (viewport) {
      var touchX = 0;
      viewport.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
      viewport.addEventListener('touchend', function (e) {
        var dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 40) slideByDir(dx < 0 ? 1 : -1);
      }, { passive: true });

      var mouseStartX  = 0;
      var mouseDragging = false;
      viewport.addEventListener('mousedown', function (e) {
        mouseStartX   = e.clientX;
        mouseDragging = true;
        dragged       = false;
      });
      viewport.addEventListener('mousemove', function (e) {
        if (mouseDragging && Math.abs(e.clientX - mouseStartX) > 5) dragged = true;
      });
      var endDrag = function (e) {
        if (!mouseDragging) return;
        mouseDragging = false;
        var dx = e.clientX - mouseStartX;
        if (Math.abs(dx) > 40) slideByDir(dx < 0 ? 1 : -1);
      };
      viewport.addEventListener('mouseup', endDrag);
      viewport.addEventListener('mouseleave', endDrag);
    }

    if (cfg.extraSwipeId) {
      var extra = document.getElementById(cfg.extraSwipeId);
      if (extra) {
        var extraTouchX = 0;
        extra.addEventListener('touchstart', function (e) { extraTouchX = e.touches[0].clientX; }, { passive: true });
        extra.addEventListener('touchend', function (e) {
          var dx = e.changedTouches[0].clientX - extraTouchX;
          if (Math.abs(dx) > 40) slideByDir(dx < 0 ? 1 : -1);
        }, { passive: true });
      }
    }

    var resizing = false;
    window.addEventListener('resize', function () {
      if (resizing) return;
      resizing = true;
      requestAnimationFrame(function () {
        if (track) {
          track.style.transition = 'none';
          track.style.transform  = 'translateX(' + offsetForDom(domIdx) + 'px)';
          track.getBoundingClientRect();
        }
        resizing = false;
      });
    });

    track.style.opacity = '0';
    requestAnimationFrame(function () {
      var initIdx = getInitIdx();
      if (initIdx > 0) {
        logIdx = initIdx;
        domIdx = logIdx + 1;
        getItems().forEach(function (el, i) { el.classList.toggle('fc-title-active', i === domIdx); });
        snapToDom(domIdx);
      } else {
        snapToDom(domIdx);
      }
      onSlide(logIdx);
      track.style.opacity = '1';
    });
  }

  return { init: init, slideByDir: slideByDir };
};

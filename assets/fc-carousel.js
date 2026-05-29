/* Finecoustic carousels — Instagram-style: follow-finger drag, velocity snap, dot pagination */

(function () {
  'use strict';

  function resolveEl(el) {
    if (!el) return null;
    if (typeof el === 'string') return document.querySelector(el);
    return el;
  }

  function getTx(el) {
    var t = window.getComputedStyle(el).transform;
    if (!t || t === 'none') return 0;
    var m = t.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,([^,]+),/);
    return m ? parseFloat(m[1]) : 0;
  }

  /* ── Instagram-style dot pagination ── */
  function buildDots(container, count, activeIdx, onSelect) {
    if (!container || count <= 1) return null;
    container.innerHTML = '';
    container.classList.add('fc-ig-dots');
    container.setAttribute('role', 'tablist');

    var dots = [];
    for (var i = 0; i < count; i++) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'fc-ig-dot' + (i === activeIdx ? ' is-active' : '');
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-label', 'Slide ' + (i + 1));
      dot.setAttribute('aria-selected', i === activeIdx ? 'true' : 'false');
      (function (idx) {
        dot.addEventListener('click', function () {
          if (onSelect) onSelect(idx);
        });
      })(i);
      container.appendChild(dot);
      dots.push(dot);
    }
    return dots;
  }

  function setActiveDot(dots, idx) {
    if (!dots) return;
    dots.forEach(function (dot, i) {
      var active = i === idx;
      dot.classList.toggle('is-active', active);
      dot.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  /* ── Pointer drag with velocity (touch + mouse) ── */
  function bindPointerDrag(el, handlers) {
    if (!el || el.dataset.fcIgDragBound === '1') return;
    el.dataset.fcIgDragBound = '1';

    var startX = 0;
    var startY = 0;
    var lastX = 0;
    var lastT = 0;
    var velocity = 0;
    var dragging = false;
    var decided = false;
    var isHorizontal = false;

    function reset() {
      dragging = false;
      decided = false;
      isHorizontal = false;
      velocity = 0;
    }

    function onStart(clientX, clientY) {
      startX = lastX = clientX;
      startY = clientY;
      lastT = Date.now();
      dragging = true;
      decided = false;
      isHorizontal = false;
      velocity = 0;
      if (handlers.onStart) handlers.onStart();
    }

    function onMove(clientX, clientY, preventDefault) {
      if (!dragging) return;
      var dx = clientX - startX;
      var dy = clientY - startY;

      if (!decided && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        decided = true;
        isHorizontal = Math.abs(dx) > Math.abs(dy);
      }
      if (!decided) return;

      if (isHorizontal) {
        if (preventDefault) preventDefault();
        var now = Date.now();
        var dt = now - lastT;
        if (dt > 0) velocity = (clientX - lastX) / dt;
        lastX = clientX;
        lastT = now;
        if (handlers.onDrag) handlers.onDrag(dx, dy);
      }
    }

    function onEnd(clientX, clientY) {
      if (!dragging) return;
      var dx = clientX - startX;
      var dy = clientY - startY;
      dragging = false;
      if (handlers.onEnd) handlers.onEnd(dx, dy, velocity, isHorizontal);
      reset();
    }

    el.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      onStart(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    el.addEventListener('touchmove', function (e) {
      if (e.touches.length !== 1) return;
      onMove(e.touches[0].clientX, e.touches[0].clientY, function () {
        if (isHorizontal) e.preventDefault();
      });
    }, { passive: false });

    el.addEventListener('touchend', function (e) {
      var t = e.changedTouches[0];
      onEnd(t.clientX, t.clientY);
    }, { passive: true });

    el.addEventListener('touchcancel', function () {
      if (handlers.onCancel) handlers.onCancel();
      reset();
    }, { passive: true });

    if (handlers.mouse !== false) {
      el.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        e.preventDefault();
        onStart(e.clientX, e.clientY);
      });

      window.addEventListener('mousemove', function (e) {
        if (!dragging) return;
        onMove(e.clientX, e.clientY);
      });

      window.addEventListener('mouseup', function (e) {
        if (!dragging) return;
        onEnd(e.clientX, e.clientY);
      });
    }
  }

  function shouldAdvance(dx, velocity, threshold) {
    threshold = threshold || 40;
    if (Math.abs(velocity) > 0.35) return velocity < 0 ? 1 : -1;
    if (Math.abs(dx) >= threshold) return dx < 0 ? 1 : -1;
    return 0;
  }

  /* ── Full-width image gallery (Instagram post carousel) ── */
  window.FcIgGallery = function (cfg) {
    var viewport = resolveEl(cfg.viewport);
    if (!viewport) return { init: function () {} };

    var track = resolveEl(cfg.track);
    var slideSelector = cfg.slideSelector || '.fc-ig-slide, .fc-pdp-u__slide, .fc-pdp__slide, [data-slide-index]';
    var slides;
    var index = cfg.initialIndex || 0;
    var loop = cfg.loop !== false;
    var animating = false;
    var dotsEl = resolveEl(cfg.dotsEl);
    var dotNodes = null;
    var onChange = cfg.onChange || function () {};

    function getSlides() {
      return track ? Array.from(track.querySelectorAll(slideSelector)) : [];
    }

    function ensureTrack() {
      track = resolveEl(cfg.track);
      if (track) return track;

      track = document.createElement('div');
      track.className = 'fc-ig-track';
      var movable = Array.from(viewport.children).filter(function (node) {
        return node.matches(slideSelector);
      });
      movable.forEach(function (node) {
        node.classList.add('fc-ig-slide');
        track.appendChild(node);
      });
      viewport.insertBefore(track, viewport.firstChild);
      return track;
    }

    function slideWidth() {
      return viewport ? viewport.getBoundingClientRect().width : 0;
    }

    function setTransform(x, animate) {
      track.style.transition = animate
        ? 'transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)'
        : 'none';
      track.style.transform = 'translate3d(' + x + 'px, 0, 0)';
    }

    function offsetForIndex(i) {
      return -i * slideWidth();
    }

    function snapTo(i, animate) {
      index = i;
      setTransform(offsetForIndex(index), animate !== false);
      slides.forEach(function (slide, si) {
        slide.classList.toggle('is-active', si === index);
      });
      setActiveDot(dotNodes, index);
      onChange(index);
    }

    function goTo(next, animate) {
      if (!slides.length || animating) return;
      var target = next;
      if (loop) {
        if (target < 0) target = slides.length - 1;
        if (target >= slides.length) target = 0;
      } else {
        target = Math.max(0, Math.min(slides.length - 1, target));
      }
      if (target === index) {
        snapTo(index, animate);
        return;
      }
      animating = true;
      snapTo(target, animate);
      track.addEventListener('transitionend', function h() {
        track.removeEventListener('transitionend', h);
        animating = false;
      }, { once: true });
    }

    function init() {
      if (viewport.dataset.fcIgGalleryBound === '1') return;
      viewport.dataset.fcIgGalleryBound = '1';
      viewport.classList.add('fc-ig-viewport');

      ensureTrack();
      slides = getSlides();
      if (slides.length <= 1) return;

      if (!dotsEl) {
        dotsEl = viewport.querySelector('.fc-ig-dots');
        if (!dotsEl) {
          dotsEl = document.createElement('div');
          dotsEl.className = 'fc-ig-dots';
          viewport.appendChild(dotsEl);
        }
      }
      dotNodes = buildDots(dotsEl, slides.length, index, function (i) {
        goTo(i, true);
      });

      snapTo(Math.min(index, slides.length - 1), false);

      var prevBtn = resolveEl(cfg.prevBtn);
      var nextBtn = resolveEl(cfg.nextBtn);
      if (prevBtn) prevBtn.addEventListener('click', function () { goTo(index - 1, true); });
      if (nextBtn) nextBtn.addEventListener('click', function () { goTo(index + 1, true); });

      var dragBase = 0;
      bindPointerDrag(viewport, {
        mouse: cfg.mouse !== false,
        onStart: function () {
          dragBase = offsetForIndex(index);
          viewport.classList.add('is-dragging');
          animating = false;
        },
        onDrag: function (dx) {
          var w = slideWidth();
          var x = dragBase + dx;
          if (!loop) {
            var min = -(slides.length - 1) * w;
            if (x > 0) x = x * 0.28;
            else if (x < min) x = min + (x - min) * 0.28;
          }
          setTransform(x, false);
        },
        onEnd: function (dx, dy, velocity, isHorizontal) {
          viewport.classList.remove('is-dragging');
          if (!isHorizontal) {
            snapTo(index, true);
            return;
          }
          var dir = shouldAdvance(dx, velocity, cfg.swipeThreshold || 36);
          if (Math.abs(dx) > 8) viewport.dataset.fcSwiped = '1';
          if (dir === 0) snapTo(index, true);
          else goTo(index + dir, true);
        },
        onCancel: function () {
          viewport.classList.remove('is-dragging');
          snapTo(index, true);
        }
      });

      var resizing = false;
      window.addEventListener('resize', function () {
        if (resizing) return;
        resizing = true;
        requestAnimationFrame(function () {
          snapTo(index, false);
          resizing = false;
        });
      });
    }

    return { init: init, goTo: goTo, getIndex: function () { return index; } };
  };

  /* ── Title / category carousel (infinite, centered active item) ── */
  window.FcCarousel = function (cfg) {
    var N          = cfg.N;
    var onSlide    = cfg.onSlide || function () {};
    var getInitIdx = cfg.getInitialIdx || function () { return 0; };
    var swipeThreshold = cfg.swipeThreshold || 40;
    var showDots = cfg.dots === true;

    var track, viewport, prevBtn, nextBtn, dotsWrap, dotNodes;
    var domIdx  = 1;
    var logIdx  = 0;
    var sliding = false;
    var dragBaseTx = 0;

    function getItems() {
      return Array.from(track.querySelectorAll('.fc-title-item'));
    }

    function offsetForDom(i) {
      var items    = getItems();
      var item     = items[i];
      if (!item || !viewport) return 0;
      var vpRect   = viewport.getBoundingClientRect();
      var itemRect = item.getBoundingClientRect();
      var tx       = getTx(track);
      return tx + (vpRect.left + vpRect.width / 2) - (itemRect.left + itemRect.width / 2);
    }

    function snapToDom(i, animate) {
      track.style.transition = animate === false ? 'none' : 'transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)';
      track.style.transform  = 'translate3d(' + offsetForDom(i) + 'px, 0, 0)';
    }

    function updateDots() {
      setActiveDot(dotNodes, logIdx);
    }

    function slideToDom(i, onEnd) {
      track.style.transition = 'transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)';
      track.style.transform  = 'translate3d(' + offsetForDom(i) + 'px, 0, 0)';
      track.addEventListener('transitionend', function h() {
        track.removeEventListener('transitionend', h);
        if (onEnd) onEnd();
        sliding = false;
      }, { once: true });
    }

    function domIdxToLogIdx(i) {
      if (i === 0) return N - 1;
      if (i === N + 1) return 0;
      return i - 1;
    }

    function nearestDomIdx() {
      var items = getItems();
      if (!viewport || !items.length) return domIdx;
      var vpRect = viewport.getBoundingClientRect();
      var vpCenter = vpRect.left + vpRect.width / 2;
      var bestIdx = domIdx;
      var bestDist = Infinity;
      items.forEach(function (item, i) {
        var rect = item.getBoundingClientRect();
        var dist = Math.abs(rect.left + rect.width / 2 - vpCenter);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      });
      return bestIdx;
    }

    function setActiveVisual(i) {
      getItems().forEach(function (el, idx) {
        el.classList.toggle('fc-title-active', idx === i);
      });
    }

    function commitLogIdx(i) {
      var newLogIdx = domIdxToLogIdx(i);
      if (newLogIdx !== logIdx) {
        logIdx = newLogIdx;
        updateDots();
        onSlide(logIdx);
      }
    }

    /* Loop wrap (e.g. Terms → Privacy): skip animating into clone slides — viewport would stay on the old title for the whole slide. */
    function jumpToDomIdx(targetDom) {
      domIdx = targetDom === 0 ? N : 1;
      commitLogIdx(domIdx);
      track.style.opacity = '0';
      getItems().forEach(function (el) { el.style.transition = 'none'; });
      snapToDom(domIdx, false);
      setActiveVisual(domIdx);
      track.getBoundingClientRect();
      requestAnimationFrame(function () {
        getItems().forEach(function (el) { el.style.transition = ''; });
        track.style.opacity = '1';
        sliding = false;
      });
    }

    function goToDomIdx(targetDom) {
      if (sliding) return;
      if (targetDom === domIdx) {
        snapToDom(domIdx, true);
        return;
      }
      if (targetDom === 0 || targetDom === N + 1) {
        sliding = true;
        jumpToDomIdx(targetDom);
        return;
      }
      sliding = true;
      commitLogIdx(targetDom);
      setActiveVisual(targetDom);
      slideToDom(targetDom, function () {
        domIdx = targetDom;
        sliding = false;
      });
    }

    function snapAfterDrag(dx, velocity, isHorizontal) {
      if (!isHorizontal || sliding) {
        snapToDom(domIdx, true);
        return;
      }
      if (Math.abs(dx) < swipeThreshold && Math.abs(velocity || 0) < 0.35) {
        snapToDom(domIdx, true);
        return;
      }
      goToDomIdx(nearestDomIdx());
    }

    function slideByDir(dir) {
      if (sliding) return;
      goToDomIdx(domIdx + dir);
    }

    function goToLogIdx(idx) {
      if (idx === logIdx || sliding) return;
      goToDomIdx(idx + 1);
    }

    function getRoot() {
      if (!cfg.root) return document;
      return resolveEl(cfg.root) || document;
    }

    function handleSwipe(dx, dy, velocity, isHorizontal) {
      snapAfterDrag(dx, velocity, isHorizontal);
    }

    function bindSwipeGesture(el, opts) {
      if (!el || el.dataset.fcSwipeBound === '1') return;
      el.dataset.fcSwipeBound = '1';
      opts = opts || {};
      var pointerActive = false;
      var syncTrack = opts.syncTrack !== false;

      bindPointerDrag(el, {
        mouse: opts.mouse,
        onStart: function () {
          if (sliding) return;
          pointerActive = true;
          dragBaseTx = getTx(track);
          if (viewport) viewport.classList.add('is-dragging');
        },
        onDrag: function (dx, dy) {
          if (!pointerActive) return;
          if (opts.onDrag) opts.onDrag(dx, dy);
          if (syncTrack && track && viewport && viewport.classList.contains('is-dragging') && !sliding) {
            track.style.transition = 'none';
            track.style.transform = 'translate3d(' + (dragBaseTx + dx) + 'px, 0, 0)';
          }
        },
        onEnd: function (dx, dy, velocity, isHorizontal) {
          pointerActive = false;
          if (viewport) viewport.classList.remove('is-dragging');
          if (opts.onDrag) opts.onDrag(0, 0);
          handleSwipe(dx, dy, velocity, isHorizontal);
        },
        onCancel: function () {
          pointerActive = false;
          if (viewport) viewport.classList.remove('is-dragging');
          snapToDom(domIdx, true);
        }
      });
    }

    function getExtraSwipeElements() {
      var ids = [];
      if (cfg.extraSwipeId) ids.push(cfg.extraSwipeId);
      if (cfg.extraSwipeIds) ids = ids.concat(cfg.extraSwipeIds);
      return ids
        .map(function (id) { return document.getElementById(id); })
        .filter(Boolean);
    }

    function removeTitleDots(root) {
      if (!root) return;
      var next = root.nextElementSibling;
      if (next && next.classList.contains('fc-ig-dots--title')) next.remove();
      dotsWrap = null;
      dotNodes = null;
    }

    function ensureDots(root) {
      if (!showDots || N <= 1) return;
      dotsWrap = root.querySelector('.fc-ig-dots');
      if (!dotsWrap) {
        dotsWrap = document.createElement('div');
        dotsWrap.className = 'fc-ig-dots fc-ig-dots--title';
        root.insertAdjacentElement('afterend', dotsWrap);
      }
      dotNodes = buildDots(dotsWrap, N, logIdx, goToLogIdx);
    }

    function init() {
      var root   = getRoot();
      track    = document.getElementById(cfg.trackId);
      viewport = document.getElementById(cfg.viewportId);
      if (!root || !track) return;

      if (!showDots) removeTitleDots(root);
      if (track.dataset.fcCarouselBound === '1') return;

      prevBtn  = cfg.prevSelector ? root.querySelector(cfg.prevSelector) : null;
      nextBtn  = cfg.nextSelector ? root.querySelector(cfg.nextSelector) : null;
      track.dataset.fcCarouselBound = '1';

      logIdx  = 0;
      domIdx  = 1;
      sliding = false;

      getItems().forEach(function (el, i) { el.classList.toggle('fc-title-active', i === 1); });
      if (showDots) ensureDots(root);

      if (prevBtn) prevBtn.addEventListener('click', function () { slideByDir(-1); });
      if (nextBtn) nextBtn.addEventListener('click', function () { slideByDir(+1); });

      var dragged = false;
      track.addEventListener('click', function (e) {
        if (dragged) { dragged = false; return; }
        var item = e.target.closest('.fc-title-item');
        if (!item) return;
        var idx = getItems().indexOf(item);
        if (idx === domIdx) return;
        goToDomIdx(idx);
      });

      if (viewport) {
        bindSwipeGesture(viewport, {
          mouse: true,
          onDrag: function (dx) {
            if (Math.abs(dx) > 5) dragged = true;
          }
        });
      }
      getExtraSwipeElements().forEach(function (el) { bindSwipeGesture(el); });

      var resizing = false;
      window.addEventListener('resize', function () {
        if (resizing) return;
        resizing = true;
        requestAnimationFrame(function () {
          if (track) snapToDom(domIdx, false);
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
          updateDots();
          snapToDom(domIdx, false);
        } else {
          snapToDom(domIdx, false);
        }
        onSlide(logIdx);
        track.style.opacity = '1';
      });
    }

    return { init: init, slideByDir: slideByDir, goTo: goToLogIdx };
  };

  /**
   * Standard init for snippets/fc-title-carousel.liquid ({id}-header, {id}-track, {id}-viewport).
   */
  window.FcTitleCarousel = function (cfg) {
    var id = cfg.id;
    if (!id) return { init: function () {} };

    var carousel = window.FcCarousel({
      root: '#' + id + '-header',
      trackId: id + '-track',
      viewportId: id + '-viewport',
      prevSelector: '.fc-filter-nav__prev',
      nextSelector: '.fc-filter-nav__next',
      extraSwipeId: cfg.extraSwipeId || null,
      extraSwipeIds: cfg.extraSwipeIds || null,
      swipeThreshold: cfg.swipeThreshold || 40,
      dots: false,
      N: cfg.N,
      onSlide: cfg.onSlide || function () {},
      getInitialIdx: cfg.getInitialIdx || function () { return 0; }
    });

    function clearBindings() {
      var root = document.getElementById(id + '-header');
      if (root) {
        var stray = root.nextElementSibling;
        if (stray && stray.classList.contains('fc-ig-dots')) stray.remove();
      }
      var track = document.getElementById(id + '-track');
      var viewport = document.getElementById(id + '-viewport');
      if (track) delete track.dataset.fcCarouselBound;
      if (viewport) delete viewport.dataset.fcIgDragBound;
      if (cfg.extraSwipeId) {
        var zone = document.getElementById(cfg.extraSwipeId);
        if (zone) delete zone.dataset.fcIgDragBound;
      }
      if (cfg.extraSwipeIds) {
        cfg.extraSwipeIds.forEach(function (zoneId) {
          var z = document.getElementById(zoneId);
          if (z) delete z.dataset.fcIgDragBound;
        });
      }
    }

    return {
      init: function () {
        clearBindings();
        carousel.init();
      },
      slideByDir: carousel.slideByDir,
      goTo: carousel.goTo
    };
  };
})();

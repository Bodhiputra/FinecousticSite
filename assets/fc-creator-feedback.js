(function () {
  var SCRIPT_ID = 'fc-instagram-embed-js';
  var SCRIPT_SRC = 'https://www.instagram.com/embed.js';
  var SUBSECTIONS = ['fbs1', 'fbs2'];
  var oembedCache = Object.create(null);

  /* Auto-calibrate IG embed crops: fixed aspect viewport + measured iframe chrome. */
  var IG_CROP_TOP_RATIO = { post: 0.11, reel: 0.11, carousel: 0.11 };
  var IG_CROP_MIN_BOTTOM_RATIO = { post: 0.34, reel: 0.34, carousel: 0.34 };
  var IG_CROP_MIN_BOTTOM_RATIO_MOBILE = { post: 0.355, reel: 0.355, carousel: 0.355 };
  var IG_LAYOUT_ASPECT = { portrait: 16 / 9, landscape: 9 / 16, square: 1 };
  var mobileCropMedia = window.matchMedia('(max-width: 749px)');
  var igCropObservers = new WeakMap();

  function getEmbedLayout(cropEl) {
    var post = cropEl.closest('.fc-creator-feedback__post');
    if (!post) return 'portrait';
    if (post.classList.contains('fc-creator-feedback__post--media-landscape')) return 'landscape';
    if (post.classList.contains('fc-creator-feedback__post--media-square')) return 'square';
    return 'portrait';
  }

  function readIframeHeight(iframe) {
    var h = iframe.offsetHeight || parseInt(iframe.getAttribute('height'), 10) || 0;
    if (h < 120 && iframe.style.height) {
      h = parseInt(iframe.style.height, 10) || h;
    }
    return h;
  }

  function presetNumber(cropEl, key, fallback) {
    var raw = cropEl.getAttribute(key);
    var n = raw ? parseInt(raw, 10) : NaN;
    return isNaN(n) ? fallback : n;
  }

  function getCropWidth(cropEl, isMobile) {
    var width = cropEl.clientWidth || 0;
    if (width < 40 && cropEl.parentElement) {
      width = cropEl.parentElement.clientWidth || 0;
    }
    if (!isMobile || mobileCropMedia.matches) return width;

    var vw = window.innerWidth || 390;
    var pageGutter = 48;
    var avatar = 52;
    var gutter = 14;
    return Math.min(360, Math.max(280, vw - pageGutter * 2 - avatar - gutter));
  }

  function computeCropValues(cropEl, iframeH, isMobile) {
    var embedType = cropEl.getAttribute('data-fc-ig-embed-type') || 'post';
    var layout = getEmbedLayout(cropEl);
    var aspect = IG_LAYOUT_ASPECT[layout] || IG_LAYOUT_ASPECT.portrait;
    var width = getCropWidth(cropEl, isMobile);
    if (width < 40) return null;

    var presetTop = presetNumber(
      cropEl,
      isMobile ? 'data-fc-ig-preset-top-mobile' : 'data-fc-ig-preset-top',
      isMobile ? 64 : 68
    );
    var presetBottom = presetNumber(
      cropEl,
      isMobile ? 'data-fc-ig-preset-bottom-mobile' : 'data-fc-ig-preset-bottom',
      isMobile ? 450 : 310
    );
    var presetHeight = presetNumber(
      cropEl,
      isMobile ? 'data-fc-ig-preset-height-mobile' : 'data-fc-ig-preset-height',
      920
    );

    var topRatio = IG_CROP_TOP_RATIO[embedType] || IG_CROP_TOP_RATIO.post;
    var minBottomRatio = isMobile
      ? IG_CROP_MIN_BOTTOM_RATIO_MOBILE[embedType] || IG_CROP_MIN_BOTTOM_RATIO_MOBILE.post
      : IG_CROP_MIN_BOTTOM_RATIO[embedType] || IG_CROP_MIN_BOTTOM_RATIO.post;
    var top = Math.max(Math.round(iframeH * topRatio), presetTop);
    var targetVisible = Math.round(width * aspect);
    var bottomFromLayout = iframeH - top - targetVisible;
    var minBottom = Math.max(Math.round(iframeH * minBottomRatio), presetBottom);
    var minVisible = layout === 'landscape' ? 100 : 160;
    var bottom = Math.max(bottomFromLayout, minBottom);
    var maxBottom = Math.max(0, iframeH - top - minVisible);
    bottom = Math.min(bottom, maxBottom);

    return {
      top: top,
      bottom: bottom,
      embedHeight: Math.max(iframeH, presetHeight),
    };
  }

  function calibrateEmbedCrop(cropEl) {
    if (!cropEl || cropEl.getAttribute('data-fc-ig-crop-mode') === 'manual') return true;

    var iframe = cropEl.querySelector('iframe');
    if (!iframe) return false;

    var iframeH = readIframeHeight(iframe);
    if (iframeH < 120) return false;

    var desktop = computeCropValues(cropEl, iframeH, false);
    var mobile = computeCropValues(cropEl, iframeH, true);
    if (!desktop || !mobile) return false;

    cropEl.style.setProperty('--fc-ig-embed-height', desktop.embedHeight + 'px');
    cropEl.style.setProperty('--fc-ig-crop-top', desktop.top + 'px');
    cropEl.style.setProperty('--fc-ig-crop-bottom', desktop.bottom + 'px');
    cropEl.style.setProperty('--fc-ig-embed-height-mobile', mobile.embedHeight + 'px');
    cropEl.style.setProperty('--fc-ig-crop-top-mobile', mobile.top + 'px');
    cropEl.style.setProperty('--fc-ig-crop-bottom-mobile', mobile.bottom + 'px');
    cropEl.classList.add('is-calibrated');
    return true;
  }

  function bindEmbedCropObserver(cropEl) {
    if (typeof ResizeObserver === 'undefined' || igCropObservers.has(cropEl)) return;

    var resizeTimer = null;
    var ro = new ResizeObserver(function () {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        resizeTimer = null;
        calibrateEmbedCrop(cropEl);
      }, 120);
    });
    ro.observe(cropEl);
    igCropObservers.set(cropEl, ro);
  }

  function watchEmbedCrop(cropEl) {
    if (!cropEl || cropEl.getAttribute('data-fc-ig-crop-watched') === '1') return;
    cropEl.setAttribute('data-fc-ig-crop-watched', '1');

    var attempts = 0;
    var calibrated = false;
    var mo = null;

    var tryCalibrate = function () {
      if (calibrated) return;
      if (calibrateEmbedCrop(cropEl)) {
        calibrated = true;
        bindEmbedCropObserver(cropEl);
        if (mo) mo.disconnect();
        return;
      }
      attempts += 1;
      if (attempts < 50) window.setTimeout(tryCalibrate, 120);
    };

    mo = new MutationObserver(function () {
      if (!calibrated) tryCalibrate();
    });
    mo.observe(cropEl, { childList: true, subtree: true });
    tryCalibrate();
  }

  function initEmbedCrops(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-fc-ig-crop]').forEach(watchEmbedCrop);
  }

  function recalibratePanel(panel) {
    if (!panel) return;
    panel.querySelectorAll('[data-fc-ig-crop]').forEach(function (cropEl) {
      cropEl.removeAttribute('data-fc-ig-crop-watched');
      cropEl.classList.remove('is-calibrated');
      watchEmbedCrop(cropEl);
    });
  }

  function processPanelEmbedsIfNeeded(panel) {
    if (!panel) return;
    if (!panel.querySelector('.instagram-media:not([data-instgrm-payload-id])')) return;
    processEmbeds();
  }

  function softCalibratePanel(panel) {
    if (!panel) return;
    panel.querySelectorAll('[data-fc-ig-crop]').forEach(function (cropEl) {
      if (cropEl.getAttribute('data-fc-ig-crop-watched') === '1') {
        calibrateEmbedCrop(cropEl);
        return;
      }
      watchEmbedCrop(cropEl);
    });
  }

  function schedulePanelCropCalibration(panel, delays) {
    if (!panel) return;
    delays.forEach(function (ms) {
      window.setTimeout(function () {
        if (!panel.isConnected || panel.hidden) return;
        softCalibratePanel(panel);
      }, ms);
    });
  }

  function getActivePanel(section) {
    return section.querySelector('.fc-creator-feedback__panel.is-active');
  }

  function recalibrateSection(section) {
    if (!section) return;
    recalibratePanel(getActivePanel(section));
    schedulePanelCropCalibration(getActivePanel(section), [200]);
  }

  function bindMobileCropRecalibration(section) {
    if (!section || section.dataset.fcMobileCropBound === '1') return;
    section.dataset.fcMobileCropBound = '1';

    var handler = function () {
      recalibrateSection(section);
    };

    if (typeof mobileCropMedia.addEventListener === 'function') {
      mobileCropMedia.addEventListener('change', handler);
    } else if (typeof mobileCropMedia.addListener === 'function') {
      mobileCropMedia.addListener(handler);
    }

    window.addEventListener('orientationchange', function () {
      window.setTimeout(function () {
        recalibrateSection(section);
      }, 250);
    });
  }

  function processEmbeds() {
    if (window.instgrm && window.instgrm.Embeds && typeof window.instgrm.Embeds.process === 'function') {
      window.instgrm.Embeds.process();
    }
  }

  function loadInstagramEmbed() {
    if (document.getElementById(SCRIPT_ID)) {
      processEmbeds();
      window.setTimeout(function () {
        document.querySelectorAll('.fc-creator-feedback').forEach(function (section) {
          schedulePanelCropCalibration(getActivePanel(section), [200, 900]);
        });
      }, 200);
      return;
    }

    var script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = SCRIPT_SRC;
    script.onload = function () {
      processEmbeds();
      window.setTimeout(function () {
        document.querySelectorAll('.fc-creator-feedback').forEach(function (section) {
          schedulePanelCropCalibration(getActivePanel(section), [200, 900]);
        });
      }, 200);
    };
    document.body.appendChild(script);
  }

  function fetchInstagramThumbnail(postUrl) {
    if (oembedCache[postUrl]) {
      return Promise.resolve(oembedCache[postUrl]);
    }

    var graphUrl =
      'https://graph.facebook.com/v22.0/instagram_oembed?url=' +
      encodeURIComponent(postUrl) +
      '&omitscript=true&maxwidth=640';

    return fetch(graphUrl)
      .then(function (response) {
        if (!response.ok) throw new Error('oembed failed');
        return response.json();
      })
      .then(function (data) {
        var thumb = data && data.thumbnail_url ? data.thumbnail_url : '';
        oembedCache[postUrl] = thumb;
        return thumb;
      })
      .catch(function () {
        return fetch(
          'https://www.instagram.com/oembed/?url=' + encodeURIComponent(postUrl) + '&omitscript=1'
        )
          .then(function (response) {
            if (!response.ok) throw new Error('oembed failed');
            return response.json();
          })
          .then(function (data) {
            var thumb = data && data.thumbnail_url ? data.thumbnail_url : '';
            oembedCache[postUrl] = thumb;
            return thumb;
          })
          .catch(function () {
            oembedCache[postUrl] = '';
            return '';
          });
      });
  }

  function loadInstagramThumbnails(root) {
    var scope = root || document;
    var links = scope.querySelectorAll('[data-fc-ig-thumbnail][data-oembed-url]');

    links.forEach(function (link) {
      var img = link.querySelector('.fc-creator-feedback__ig-thumb-img');
      if (!img || (img.getAttribute('src') && img.getAttribute('src') !== '')) return;

      var postUrl = link.getAttribute('data-oembed-url');
      if (!postUrl) return;

      fetchInstagramThumbnail(postUrl).then(function (thumbUrl) {
        if (thumbUrl) img.src = thumbUrl;
      });
    });
  }

  function initInstagramMedia(section) {
    loadInstagramThumbnails(section);
    if (section.dataset.hasEmbed === '1') loadInstagramEmbed();
    var activePanel = getActivePanel(section);
    initEmbedCrops(activePanel || section);
    schedulePanelCropCalibration(activePanel, [400, 1200]);
  }

  function buildMarqueeTrack(panel) {
    if (!panel || panel.querySelector('[data-fc-feedback-track]')) {
      return panel ? panel.querySelector('[data-fc-feedback-track]') : null;
    }

    var posts = panel.querySelectorAll('.fc-creator-feedback__post');
    if (!posts.length) return null;

    var track = document.createElement('div');
    track.className = 'fc-creator-feedback__track';
    track.setAttribute('data-fc-feedback-track', '');

    var set = document.createElement('div');
    set.className = 'fc-creator-feedback__track-set';

    posts.forEach(function (post) {
      set.appendChild(post);
    });

    track.appendChild(set);
    panel.appendChild(track);

    return track;
  }

  function CreatorFeedback(section) {
    this.section = section;
    this.feedbackPage = section.querySelector('[data-fc-feedback-page]');
    this.viewport = section.querySelector('[data-fc-feedback-viewport]');
    this.tabs = section.querySelectorAll('.fc-creator-feedback__product-tab');
    this.panels = section.querySelectorAll('.fc-creator-feedback__panel');
    this.dwellMulti = parseInt(section.dataset.dwellMulti, 10) || 8000;
    this.dwellSingle = parseInt(section.dataset.dwellSingle, 10) || 10000;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.interactive = this.reducedMotion;
    this.pointerInside = false;
    this.touchActive = false;
    this.touchStartY = 0;
    this.subsectionIndex = 0;
    this.advanceTimer = null;
    this.startTimer = null;
    this.rafId = null;
    this.lastTick = 0;
    this.cachedMaxScroll = 0;
    this.scrollMetricsAt = 0;

    this.onMouseEnter = this.onMouseEnter.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.onTabClick = this.onTabClick.bind(this);

    this.bind();
    this.setupPanels();
    initInstagramMedia(section);
    bindMobileCropRecalibration(section);
    this.scheduleStartActiveTrack(450);
  }

  CreatorFeedback.prototype.isMobileViewport = function () {
    return mobileCropMedia.matches;
  };

  CreatorFeedback.prototype.bind = function () {
    var self = this;
    var page = this.feedbackPage || this.section;

    page.addEventListener('mouseenter', this.onMouseEnter);
    page.addEventListener('mouseleave', this.onMouseLeave);

    if (this.viewport) {
      this.viewport.addEventListener('touchstart', this.onTouchStart, { passive: true });
      this.viewport.addEventListener('touchmove', this.onTouchMove, { passive: true });
      this.viewport.addEventListener('touchend', this.onTouchEnd, { passive: true });
      this.viewport.addEventListener('touchcancel', this.onTouchEnd, { passive: true });
    }

    this.tabs.forEach(function (tab) {
      tab.addEventListener('click', self.onTabClick);
    });
  };

  CreatorFeedback.prototype.destroy = function () {
    this.stopContinuousScroll();
    this.clearAdvanceTimer();
    this.clearStartTimer();

    var page = this.feedbackPage || this.section;
    page.removeEventListener('mouseenter', this.onMouseEnter);
    page.removeEventListener('mouseleave', this.onMouseLeave);
    if (this.viewport) {
      this.viewport.removeEventListener('touchstart', this.onTouchStart);
      this.viewport.removeEventListener('touchmove', this.onTouchMove);
      this.viewport.removeEventListener('touchend', this.onTouchEnd);
      this.viewport.removeEventListener('touchcancel', this.onTouchEnd);
    }
  };

  CreatorFeedback.prototype.setInteractiveState = function (interactive) {
    this.interactive = interactive;
    if (this.feedbackPage) {
      this.feedbackPage.classList.toggle('is-interactive', interactive);
    }
  };

  CreatorFeedback.prototype.clearAdvanceTimer = function () {
    if (this.advanceTimer) {
      window.clearTimeout(this.advanceTimer);
      this.advanceTimer = null;
    }
  };

  CreatorFeedback.prototype.clearStartTimer = function () {
    if (this.startTimer) {
      window.clearTimeout(this.startTimer);
      this.startTimer = null;
    }
  };

  CreatorFeedback.prototype.scheduleStartActiveTrack = function (delayMs) {
    var self = this;
    this.clearStartTimer();
    this.startTimer = window.setTimeout(function () {
      self.startTimer = null;
      self.activateSubsection(self.subsectionIndex, { restart: true });
    }, delayMs || 0);
  };

  CreatorFeedback.prototype.setupPanels = function () {
    this.panels.forEach(function (panel) {
      buildMarqueeTrack(panel);
    });
  };

  CreatorFeedback.prototype.getPanelPostCount = function (key) {
    var panel = this.section.querySelector('.fc-creator-feedback__panel[data-subsection="' + key + '"]');
    return panel ? parseInt(panel.getAttribute('data-post-count'), 10) || 0 : 0;
  };

  CreatorFeedback.prototype.nextSubsectionWithPosts = function (startIdx) {
    for (var step = 1; step <= SUBSECTIONS.length; step += 1) {
      var candidate = (startIdx + step) % SUBSECTIONS.length;
      if (this.getPanelPostCount(SUBSECTIONS[candidate]) > 0) return candidate;
    }
    return startIdx;
  };

  CreatorFeedback.prototype.getTrackDurationSeconds = function (postCount) {
    return postCount <= 1 ? this.dwellSingle / 1000 : (this.dwellMulti / 1000) * postCount;
  };

  CreatorFeedback.prototype.refreshScrollMetrics = function (force) {
    if (!this.viewport) return 0;
    var now = performance.now();
    if (force || now - this.scrollMetricsAt > 250) {
      this.cachedMaxScroll = Math.max(0, this.viewport.scrollHeight - this.viewport.clientHeight);
      this.scrollMetricsAt = now;
    }
    return this.cachedMaxScroll;
  };

  CreatorFeedback.prototype.getMaxScroll = function () {
    return this.refreshScrollMetrics(false);
  };

  CreatorFeedback.prototype.getScrollSpeed = function () {
    var key = SUBSECTIONS[this.subsectionIndex];
    var postCount = this.getPanelPostCount(key);
    var maxScroll = this.getMaxScroll();
    if (maxScroll <= 0) return 0;

    var durationMs =
      postCount <= 1 ? this.dwellSingle : this.dwellMulti * Math.max(postCount, 1);
    return maxScroll / (durationMs / 1000);
  };

  CreatorFeedback.prototype.stopContinuousScroll = function () {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  };

  CreatorFeedback.prototype.onMouseEnter = function () {
    this.pointerInside = true;
    this.updateInteractive();
  };

  CreatorFeedback.prototype.onMouseLeave = function () {
    this.pointerInside = false;
    this.updateInteractive();
  };

  CreatorFeedback.prototype.resumeAutoScroll = function () {
    if (this.interactive || this.reducedMotion || !this.viewport) return;

    var maxScroll = this.getMaxScroll();
    if (maxScroll > 0 && this.viewport.scrollTop >= maxScroll - 2) {
      this.advanceSubsection();
      return;
    }

    this.startContinuousScroll();
  };

  CreatorFeedback.prototype.startContinuousScroll = function () {
    var self = this;
    this.stopContinuousScroll();
    this.clearAdvanceTimer();

    if (this.interactive || this.reducedMotion) return;

    var maxScroll = this.getMaxScroll();
    if (maxScroll > 0 && this.viewport.scrollTop >= maxScroll - 2) {
      return;
    }

    var speed = this.getScrollSpeed();
    if (speed <= 0) {
      var key = SUBSECTIONS[this.subsectionIndex];
      var postCount = this.getPanelPostCount(key);
      var duration = this.getTrackDurationSeconds(postCount) * 1000;
      var self = this;
      this.advanceTimer = window.setTimeout(function () {
        if (!self.interactive) self.advanceSubsection();
      }, duration);
      return;
    }

    this.lastTick = performance.now();
    this.refreshScrollMetrics(true);
    var cachedMaxScroll = this.cachedMaxScroll;
    var metricsFrame = 0;

    function tick(now) {
      if (self.interactive || self.reducedMotion) {
        self.stopContinuousScroll();
        return;
      }

      var dt = Math.min((now - self.lastTick) / 1000, 0.05);
      self.lastTick = now;

      metricsFrame += 1;
      if (metricsFrame >= 12) {
        metricsFrame = 0;
        cachedMaxScroll = self.refreshScrollMetrics(true);
      }

      if (cachedMaxScroll <= 0) {
        self.stopContinuousScroll();
        return;
      }

      var nextTop = self.viewport.scrollTop + speed * dt;

      if (nextTop >= cachedMaxScroll) {
        self.viewport.scrollTop = cachedMaxScroll;
        self.advanceSubsection();
        return;
      }

      self.viewport.scrollTop = nextTop;
      self.rafId = requestAnimationFrame(tick);
    }

    this.rafId = requestAnimationFrame(tick);
  };

  CreatorFeedback.prototype.advanceSubsection = function () {
    if (this.interactive) return;

    this.stopContinuousScroll();
    this.clearAdvanceTimer();
    var next = this.nextSubsectionWithPosts(this.subsectionIndex);
    this.activateSubsection(next, { restart: true });
  };

  CreatorFeedback.prototype.updateInteractive = function () {
    var shouldInteractive = this.reducedMotion;
    if (this.isMobileViewport()) {
      shouldInteractive = shouldInteractive || this.touchActive;
    } else {
      shouldInteractive = shouldInteractive || this.pointerInside || this.touchActive;
    }
    this.setInteractiveState(shouldInteractive);

    if (shouldInteractive) {
      this.stopContinuousScroll();
      this.clearAdvanceTimer();
      return;
    }

    this.resumeAutoScroll();
  };

  CreatorFeedback.prototype.onTouchStart = function (evt) {
    if (!this.isMobileViewport() || !evt.touches.length) return;
    this.touchStartY = evt.touches[0].clientY;
    this.touchActive = false;
  };

  CreatorFeedback.prototype.onTouchMove = function (evt) {
    if (!this.isMobileViewport() || !evt.touches.length) return;
    if (Math.abs(evt.touches[0].clientY - this.touchStartY) > 8) {
      if (!this.touchActive) {
        this.touchActive = true;
        this.updateInteractive();
      }
    }
  };

  CreatorFeedback.prototype.onTouchEnd = function () {
    if (!this.isMobileViewport()) return;
    var self = this;
    this.touchActive = false;
    window.setTimeout(function () {
      self.updateInteractive();
    }, 120);
  };

  CreatorFeedback.prototype.onTabClick = function (evt) {
    var tab = evt.currentTarget;
    var key = tab.getAttribute('data-subsection');
    var idx = SUBSECTIONS.indexOf(key);
    if (idx < 0) return;
    this.subsectionIndex = idx;
    this.activateSubsection(idx, { restart: true });
  };

  CreatorFeedback.prototype.activateSubsection = function (idx, opts) {
    var key = SUBSECTIONS[idx];
    if (!key) return;
    var restart = !opts || opts.restart !== false;

    this.subsectionIndex = idx;
    this.stopContinuousScroll();
    this.clearAdvanceTimer();

    this.panels.forEach(function (panel) {
      var active = panel.getAttribute('data-subsection') === key;
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
    });

    this.tabs.forEach(function (tab) {
      var active = tab.getAttribute('data-subsection') === key;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    if (this.viewport) {
      this.viewport.scrollTop = 0;
      this.refreshScrollMetrics(true);
    }

    var activePanel = this.section.querySelector('.fc-creator-feedback__panel[data-subsection="' + key + '"]');
    processPanelEmbedsIfNeeded(activePanel);
    initEmbedCrops(activePanel);
    softCalibratePanel(activePanel);
    schedulePanelCropCalibration(activePanel, [700]);

    if (restart && !this.interactive && !this.reducedMotion) {
      var self = this;
      window.requestAnimationFrame(function () {
        self.refreshScrollMetrics(true);
        self.startContinuousScroll();
      });
    }
  };

  var instances = new WeakMap();

  function initSection(section) {
    if (!section || instances.has(section)) return;
    if (typeof Shopify !== 'undefined' && Shopify.designMode) {
      initInstagramMedia(section);
      bindMobileCropRecalibration(section);
      return;
    }
    instances.set(section, new CreatorFeedback(section));
  }

  function initAll(root) {
    (root || document).querySelectorAll('.fc-creator-feedback').forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initAll();
    }, { once: true });
  } else {
    initAll();
  }

  document.addEventListener('shopify:section:load', function (evt) {
    if (!evt.target) return;
    var section =
      evt.target.querySelector('.fc-creator-feedback') ||
      (evt.target.classList && evt.target.classList.contains('fc-creator-feedback') ? evt.target : null);
    if (section) initSection(section);
  });

  document.addEventListener('shopify:section:unload', function (evt) {
    if (!evt.target) return;
    var section = evt.target.querySelector('.fc-creator-feedback');
    if (!section || !instances.has(section)) return;
    instances.get(section).destroy();
    instances.delete(section);
  });
})();

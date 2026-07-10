/**
 * PDP product video — native Shopify sources, manual loop, lazy play on scroll.
 */
(function () {
  function tryPlay(video) {
    if (!video || document.hidden) return;
    video.muted = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    var p = video.play();
    if (p && p.catch) {
      p.catch(function () {
        video.addEventListener(
          'canplay',
          function () {
            tryPlay(video);
          },
          { once: true }
        );
      });
    }
  }

  function bindLoop(video, media) {
    var shouldLoop = media && media.dataset.fcLoop === 'true';
    if (!shouldLoop) return;
    video.addEventListener('ended', function () {
      video.currentTime = 0;
      tryPlay(video);
    });
  }

  function initVideo(video, media) {
    if (!video || video.dataset.fcPdpVideoInit === '1') return;
    video.dataset.fcPdpVideoInit = '1';
    bindLoop(video, media);
    if (video.preload === 'none') video.preload = 'metadata';
    tryPlay(video);
  }

  function pauseVideo(video) {
    if (!video || video.dataset.fcPdpVideoInit !== '1') return;
    video.pause();
  }

  function boot() {
    document.querySelectorAll('[data-fc-pdp-video-wrap]').forEach(function (wrap) {
      var media = wrap.querySelector('.fc-pdp-u__video-media');
      var video = media && media.querySelector('video');
      if (!media || !video) return;

      if (!('IntersectionObserver' in window)) {
        initVideo(video, media);
        return;
      }

      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) initVideo(video, media);
            else pauseVideo(video);
          });
        },
        { rootMargin: '200px 0px', threshold: 0.01 }
      );

      io.observe(media);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

  (function () {
    if (typeof Shopify !== 'undefined' && Shopify.designMode) return;
    if (window.matchMedia('(max-width: 749px)').matches) return;

    var footer = document.querySelector('footer.footer');
    if (!footer) return;

    var bottomLinks = footer.querySelector('.fc-footer__bottom-links');
    if (!bottomLinks) return;

    var revealed = false;

    function reveal(baseDelay) {
      if (revealed) return;
      revealed = true;
      setTimeout(function () {
        bottomLinks.style.opacity = '1';
        bottomLinks.style.transform = 'translateY(0)';
      }, baseDelay);
    }

    function isInView() {
      var r = footer.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    }

    if (!('IntersectionObserver' in window)) {
      reveal(0);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting || revealed) return;
      reveal(0);
      io.disconnect();
    }, { threshold: 0 });
    io.observe(footer);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (!revealed && isInView()) reveal(400);
      });
    });
    window.addEventListener('load', function () {
      if (!revealed && isInView()) reveal(400);
    });
  })();

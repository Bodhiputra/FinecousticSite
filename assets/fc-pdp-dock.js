/**
 * Hide fixed PDP Add to bag dock when the footer bar enters the viewport.
 */
(function () {
  function bindDockToFooter() {
    var footerBar = document.querySelector('.fc-footer__bottom-links');
    if (!footerBar) return;

    var docks = document.querySelectorAll('.fc-pdp-u__dock, .fc-pdp__dock');
    if (!docks.length) return;

    var observer = new IntersectionObserver(
      function (entries) {
        var footerVisible = entries.some(function (entry) {
          return entry.isIntersecting;
        });
        docks.forEach(function (dock) {
          dock.classList.toggle('fc-pdp-dock--footer-visible', footerVisible);
        });
      },
      { threshold: 0 }
    );

    observer.observe(footerBar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindDockToFooter);
  } else {
    bindDockToFooter();
  }
})();

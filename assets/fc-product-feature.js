(function(){
  const root = document.getElementById('tws-features-{{ section.id }}');
  if (!root) return;

  const list = root.querySelectorAll('.tws-feature-item');
  const panels = root.querySelectorAll('.tws-hero-card');
  const sidebarList = root.querySelector('.tws-feature-list');

  let currentIndex = 0;

  function setActive(idx) {
    currentIndex = idx; // update current index
    list.forEach((el, i) => {
      el.classList.toggle('is-active', i === idx);
      el.setAttribute('aria-selected', i === idx ? 'true' : 'false');
    });
    panels.forEach((p, i) => {
      p.classList.toggle('is-visible', i === idx);
    });
    const visiblePanel = panels[idx];
    const visibleHeroImage = visiblePanel.querySelector('.hero-image-wrap');
    if (sidebarList && visibleHeroImage) {
      sidebarList.style.maxHeight = visibleHeroImage.offsetHeight + 'px';
    }
  }

  list.forEach((li, i) => {
    li.addEventListener('click', () => setActive(i));
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setActive(i);
      }
    });
  });

  const initialActive = Array.from(list).findIndex(el => el.classList.contains('is-active')) || 0;
  setActive(initialActive);

  window.addEventListener('resize', () => {
    const visiblePanel = panels[currentIndex];
    const visibleHeroImage = visiblePanel.querySelector('.hero-image-wrap');
    if (sidebarList && visibleHeroImage) {
      sidebarList.style.maxHeight = visibleHeroImage.offsetHeight + 'px';
    }
  });

  // -------- Auto rotate every 5 seconds --------
  setInterval(() => {
    const nextIndex = (currentIndex + 1) % list.length;
    setActive(nextIndex);
  }, 5000);

})();

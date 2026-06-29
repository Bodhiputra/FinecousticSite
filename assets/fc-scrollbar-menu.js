var wrapper = document.querySelector('.custom-product-tabs-wrapper');
var tabs = document.querySelectorAll('.custom-product-tabs a');
var wrapperOffset = wrapper.offsetTop;

function scrollTabIntoView(tab) {
  if (wrapper.scrollWidth > wrapper.clientWidth) {
    var scrollLeft = tab.offsetLeft - wrapper.clientWidth / 2 + tab.offsetWidth / 2;
    wrapper.scrollTo({ left: scrollLeft, behavior: 'smooth' });
  }
}

// Function to handle scroll events
function onScroll() {
  // Sticky navbar
  if (window.scrollY >= wrapperOffset) {
    wrapper.classList.add('sticky');
  } else {
    wrapper.classList.remove('sticky');
  }

  // Highlight active tab
  var scrollPos = window.scrollY + 120;
  for (var i = 0; i < tabs.length; i++) {
    var tab = tabs[i];
    var target = document.querySelector(tab.getAttribute('href'));
    if (target &&
        target.offsetTop <= scrollPos &&
        (target.offsetTop + target.offsetHeight) > scrollPos) {

      // Remove active from all tabs
      for (var j = 0; j < tabs.length; j++) {
        tabs[j].classList.remove('active');
      }
      tab.classList.add('active');

      scrollTabIntoView(tab);
    }
  }
}

// Function to handle tab clicks
function onTabClick(e) {
  e.preventDefault();
  var target = document.querySelector(this.getAttribute('href'));
  if (target) {
    // Smooth vertical scroll
    window.scrollTo({ top: target.offsetTop - 100, behavior: 'smooth' });
    scrollTabIntoView(this);
  }
}

// Attach scroll event
window.addEventListener('scroll', onScroll);

// Attach click events to tabs
for (var i = 0; i < tabs.length; i++) {
  tabs[i].addEventListener('click', onTabClick);
}

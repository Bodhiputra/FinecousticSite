(function () {

  const TABS = [
    { key: 'faq',     id: 'fc-sup-faq'        },
    { key: 'contact', id: 'fc-sup-contact'     },
    { key: 'support', id: 'fc-sup-support'     },
    { key: 'track',   id: 'fc-sup-trackorder'  },
  ];

  function applyTab(key) {
    document.querySelectorAll('.fc-support-panel').forEach(panel => {
      panel.classList.remove('fc-sup-active');
      if (panel.dataset.tab === key) panel.classList.add('fc-sup-active');
    });
    const url = new URL(window.location.href);
    key === 'faq' ? url.searchParams.delete('tab') : url.searchParams.set('tab', key);
    history.pushState(null, '', url.toString());
  }

  /* ── FAQ CATEGORIES ── */
  function initFaqCategories() {
    const catCards = document.querySelectorAll('.fc-faq-cat-card');
    const list     = document.getElementById('fc-faq-list');
    if (!catCards.length || !list) return;

    function filterCat(cat) {
      list.classList.add('fc-faq-switching');
      setTimeout(() => {
        list.querySelectorAll('.fc-faq-item').forEach(item => {
          item.style.display = item.dataset.cat === cat ? '' : 'none';
        });
        list.classList.remove('fc-faq-switching');
      }, 150);
    }

    catCards.forEach(card => {
      card.addEventListener('click', () => {
        catCards.forEach(c => c.classList.remove('fc-cat-active'));
        card.classList.add('fc-cat-active');
        filterCat(card.dataset.cat);
      });
    });

    /* apply first active card on load */
    const firstActive = document.querySelector('.fc-faq-cat-card.fc-cat-active');
    if (firstActive) filterCat(firstActive.dataset.cat);
  }

  /* ── FAQ ACCORDION ── */
  function initFaq() {
    document.querySelectorAll('.fc-faq-item').forEach(item => {
      item.querySelector('.fc-faq-q').addEventListener('click', () => item.classList.toggle('open'));
    });
  }

  /* ── SMART FORM ── */
  function updateFormFields(type) {
    const fieldOrder    = document.querySelector('.fc-sup-field-order');
    const fieldProduct  = document.querySelector('.fc-sup-field-product');
    const fieldPhoto    = document.querySelector('.fc-sup-field-photo');
    const fieldVideo    = document.querySelector('.fc-sup-field-video');
    const fieldMediaOpt = document.querySelector('.fc-sup-field-media-opt');
    const fieldOther    = document.querySelector('.fc-sup-field-other');
    const msgLabel      = document.getElementById('fc-message-label');
    const msgInput      = document.getElementById('support-message');

    if (!fieldOrder) return;

    const show = el => { if (!el) return; el.classList.remove('fc-sup-field--hidden'); el.classList.add('fc-sup-field--visible'); };
    const hide = el => { if (!el) return; el.classList.add('fc-sup-field--hidden'); el.classList.remove('fc-sup-field--visible'); };

    hide(fieldOrder); hide(fieldProduct); hide(fieldPhoto); hide(fieldVideo); hide(fieldMediaOpt); hide(fieldOther);

    switch (type) {
      case 'refund':
        show(fieldOrder); show(fieldPhoto); show(fieldVideo);
        if (msgLabel) msgLabel.textContent = 'Describe the issue';
        if (msgInput) msgInput.placeholder = 'Describe the issue — e.g. wrong product received, defective unit...';
        break;
      case 'warranty':
        show(fieldOrder); show(fieldPhoto); show(fieldVideo);
        if (msgLabel) msgLabel.textContent = 'Describe the defect';
        if (msgInput) msgInput.placeholder = 'Describe the defect or quality issue in detail...';
        break;
      case 'technical':
        show(fieldProduct); show(fieldMediaOpt);
        if (msgLabel) msgLabel.textContent = 'Describe the issue';
        if (msgInput) msgInput.placeholder = 'Describe the technical issue you are experiencing...';
        break;
      case 'complaint':
        show(fieldOrder); show(fieldMediaOpt);
        if (msgLabel) msgLabel.textContent = 'Tell us what happened';
        if (msgInput) msgInput.placeholder = 'Tell us what happened and how we can improve...';
        break;
      case 'other':
        show(fieldOther);
        if (msgLabel) msgLabel.textContent = 'Your message';
        if (msgInput) msgInput.placeholder = 'How can we help?';
        break;
      default:
        if (msgLabel) msgLabel.textContent = 'Your message';
        if (msgInput) msgInput.placeholder = 'How can we help?';
    }
  }

  function showFormSuccess(formId, successId) {
    const form       = document.getElementById(formId);
    const successMsg = document.getElementById(successId);
    if (form)       form.style.display       = 'none';
    if (successMsg) successMsg.style.display = 'block';
  }

  function resetFormSuccess(formId, successId, postedParam) {
    const form       = document.getElementById(formId);
    const successMsg = document.getElementById(successId);
    if (form) {
      form.style.display = '';
      form.reset();
    }
    if (successMsg) successMsg.style.display = 'none';

    const url = new URL(window.location.href);
    url.searchParams.delete(postedParam);
    history.replaceState(null, '', url.toString());
  }

  function initFormSuccess() {
    const params = new URLSearchParams(window.location.search);

    if (params.get('contact_posted') === 'true') {
      showFormSuccess('fc-aftersales-form', 'fc-sup-success-msg');
    }

    if (params.get('inquiry_posted') === 'true') {
      showFormSuccess('fc-contact-form', 'fc-contact-success-msg');
    }
  }

  function initFormSuccessReset() {
    document.querySelectorAll('[data-fc-reset-form]').forEach(btn => {
      btn.addEventListener('click', () => {
        const which = btn.dataset.fcResetForm;
        if (which === 'contact') {
          resetFormSuccess('fc-contact-form', 'fc-contact-success-msg', 'inquiry_posted');
          const contactOtherFld = document.querySelector('.fc-contact-field-other');
          if (contactOtherFld) {
            contactOtherFld.classList.add('fc-sup-field--hidden');
            contactOtherFld.classList.remove('fc-sup-field--visible');
          }
        } else if (which === 'support') {
          resetFormSuccess('fc-aftersales-form', 'fc-sup-success-msg', 'contact_posted');
          updateFormFields('');
        }
      });
    });
  }

  function initSmartForm() {
    const typeSelect = document.getElementById('support-type');
    if (!typeSelect) return;

    typeSelect.addEventListener('change', () => updateFormFields(typeSelect.value));

    const params  = new URLSearchParams(window.location.search);
    const urlType = params.get('type');
    if (urlType && typeSelect.querySelector(`option[value="${urlType}"]`)) {
      typeSelect.value = urlType;
    }
    updateFormFields(typeSelect.value || '');

    const inquirySelect   = document.getElementById('contact-inquiry');
    const contactOtherFld = document.querySelector('.fc-contact-field-other');
    if (inquirySelect && contactOtherFld) {
      inquirySelect.addEventListener('change', () => {
        const isOther = inquirySelect.value === 'Other';
        contactOtherFld.classList.toggle('fc-sup-field--hidden',  !isOther);
        contactOtherFld.classList.toggle('fc-sup-field--visible',  isOther);
      });

      // Pre-select inquiry type from URL param (e.g. ?inquiry=Wholesale+%2F+B2B)
      const urlInquiry = params.get('inquiry');
      if (urlInquiry) {
        const matchOpt = Array.from(inquirySelect.options).find(o => o.value === urlInquiry);
        if (matchOpt) {
          inquirySelect.value = urlInquiry;
          if (urlInquiry === 'Other') {
            contactOtherFld.classList.remove('fc-sup-field--hidden');
            contactOtherFld.classList.add('fc-sup-field--visible');
          }
        }
      }
    }
  }

  /* ── FORM VALIDATION ── */
  function initFileUpload() {
    const form = document.getElementById('fc-aftersales-form');
    if (!form) return;

    form.addEventListener('submit', e => {
      const type       = document.getElementById('support-type')?.value;
      const photoTypes = ['refund', 'warranty'];
      const orderTypes = ['refund', 'warranty', 'complaint'];
      const photoError = document.getElementById('fc-photo-error');
      const orderError = document.getElementById('fc-order-error');
      const orderInput = document.getElementById('support-order');
      const photoLink  = document.getElementById('support-photo');
      let valid = true;

      if (orderTypes.includes(type) && orderInput && !orderInput.value.trim()) {
        if (orderError) orderError.style.display = 'block';
        valid = false;
      } else if (orderError) orderError.style.display = 'none';

      if (photoTypes.includes(type) && photoLink && !photoLink.value.trim()) {
        if (photoError) photoError.style.display = 'block';
        valid = false;
      } else if (photoError) photoError.style.display = 'none';

      if (!valid) e.preventDefault();
    });
  }

  /* ── TRACK ORDER ── */
  function initTrackOrder() {
    const form  = document.getElementById('fc-track-form');
    const input = document.getElementById('fc-track-input');
    if (!form || !input) return;
    form.addEventListener('submit', e => {
      e.preventDefault();
      const num = input.value.trim();
      if (num) window.open('https://track.yanwen.com/en/result?bills=' + encodeURIComponent(num), '_blank');
    });
  }

  function getInitialTabIdx() {
    var params = new URLSearchParams(window.location.search);
    var urlTab = params.get('tab');
    if (urlTab) {
      var idx = TABS.findIndex(function (t) { return t.key === urlTab; });
      if (idx >= 0) return idx;
    }
    if (params.get('inquiry_posted') === 'true') return 1;
    if (params.get('contact_posted') === 'true') return 2;
    if (params.get('type')) return 2;
    return 0;
  }

  function initSupportContent() {
    var wrap = document.getElementById('fc-support-wrap');
    if (!wrap || wrap.dataset.fcSupportBound === '1') return;
    wrap.dataset.fcSupportBound = '1';
    initFaqCategories();
    initFaq();
    initFormSuccess();
    initFormSuccessReset();
    initSmartForm();
    initFileUpload();
    initTrackOrder();
  }

  function initCarousel() {
    if (!document.getElementById('fc-support-header') || !window.FcTitleCarousel) return;
    window.FcTitleCarousel({
      id: 'fc-support',
      extraSwipeId: 'fc-support-wrap',
      N: TABS.length,
      onSlide: function (logIdx) { applyTab(TABS[logIdx].key); },
      getInitialIdx: getInitialTabIdx
    }).init();
  }

  function init() {
    if (!document.getElementById('fc-support-header')) return;
    initCarousel();
    initSupportContent();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  document.addEventListener('shopify:section:load', function (evt) {
    var section = evt.target;
    if (!section || !section.querySelector || !section.querySelector('#fc-support-header')) return;
    var wrap = section.querySelector('#fc-support-wrap');
    if (wrap) delete wrap.dataset.fcSupportBound;
    init();
  });

})();

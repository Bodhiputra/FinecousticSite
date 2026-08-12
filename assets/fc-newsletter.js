(function () {
  if (window.__fcNewsletterBound) return;
  window.__fcNewsletterBound = true;

  var CONFIRM_MS = 10000;

  function showConfirm(field) {
    if (!field || field.classList.contains('is-confirming')) return;

    if (field.dataset.fcConfirmTimer) {
      window.clearTimeout(parseInt(field.dataset.fcConfirmTimer, 10));
    }

    field.classList.add('is-confirming');

    var timer = window.setTimeout(function () {
      hideConfirm(field);
    }, CONFIRM_MS);

    field.dataset.fcConfirmTimer = String(timer);
  }

  function hideConfirm(field) {
    if (!field) return;

    field.classList.remove('is-confirming');

    if (field.dataset.fcConfirmTimer) {
      window.clearTimeout(parseInt(field.dataset.fcConfirmTimer, 10));
      delete field.dataset.fcConfirmTimer;
    }

    var input = field.querySelector('.fc-newsletter__input');
    if (input) {
      input.value = '';
    }
  }

  function submitForm(form, field) {
    var formData = new FormData(form);
    var action = (form.getAttribute('action') || '/contact').split('#')[0];

    fetch(action, {
      method: 'POST',
      body: formData,
      credentials: 'same-origin',
      headers: { Accept: 'text/html' },
    }).catch(function () {});

    showConfirm(field);
  }

  function handleFormSubmit(event) {
    var form = event.currentTarget;
    var field = form.querySelector('.fc-newsletter__field');
    var input = form.querySelector('.fc-newsletter__input');

    event.preventDefault();
    event.stopPropagation();

    if (!field || !input) return;

    if (field.classList.contains('is-confirming')) return;

    if (!input.checkValidity()) {
      input.reportValidity();
      return;
    }

    submitForm(form, field);
  }

  function bindForms(root) {
    (root || document).querySelectorAll('.fc-newsletter__form').forEach(function (form) {
      if (form.dataset.fcNewsletterBound === 'true') return;
      form.dataset.fcNewsletterBound = 'true';
      form.setAttribute('novalidate', 'novalidate');
      form.addEventListener('submit', handleFormSubmit);
    });
  }

  bindForms();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      bindForms();
    }, { once: true });
  }

  document.addEventListener('shopify:section:load', function (event) {
    bindForms(event.target);
  });
})();

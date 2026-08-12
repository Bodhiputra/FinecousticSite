(function () {
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

  function submitForm(form, field, input) {
    if (!form || !field || !input) return;
    if (field.classList.contains('is-confirming')) return;

    if (!input.checkValidity()) {
      input.reportValidity();
      return;
    }

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

  function bindForm(form) {
    if (!form || form.dataset.fcNewsletterBound === 'true') return;
    form.dataset.fcNewsletterBound = 'true';
    form.setAttribute('novalidate', 'novalidate');

    var field = form.querySelector('.fc-newsletter__field');
    var input = form.querySelector('.fc-newsletter__input');
    var button = form.querySelector('[data-fc-newsletter-submit]');

    form.addEventListener(
      'submit',
      function (event) {
        event.preventDefault();
        event.stopPropagation();
        submitForm(form, field, input);
      },
      true
    );

    if (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        submitForm(form, field, input);
      });
    }

    if (input) {
      input.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        submitForm(form, field, input);
      });
    }
  }

  function bindForms(root) {
    (root || document).querySelectorAll('.fc-newsletter__form').forEach(bindForm);
  }

  /* Block native navigation immediately — before any other submit handlers. */
  document.addEventListener(
    'submit',
    function (event) {
      var form = event.target;
      if (!form || !form.classList || !form.classList.contains('fc-newsletter__form')) return;
      event.preventDefault();
      event.stopPropagation();
    },
    true
  );

  bindForms();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      bindForms();
    }, { once: true });
  }

  document.addEventListener('shopify:section:load', function (event) {
    bindForms(event.target);
  });

  window.fcNewsletterBindForms = bindForms;
})();

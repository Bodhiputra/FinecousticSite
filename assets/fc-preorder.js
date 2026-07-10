(function () {
  'use strict';

  var FLOW_CLASS = 'fc-preorder-flow';
  var STORAGE_EMAIL = 'fc_preorder_email';
  var STORAGE_MARKETING = 'fc_preorder_marketing';
  var STORAGE_SESSION = 'fc_preorder_session_id';
  var STORAGE_PENDING_CHECKOUT = 'fc_preorder_pending_checkout';
  var STORAGE_QUESTIONNAIRE = 'fc_preorder_questionnaire';
  var STORAGE_RESERVE_EMAIL = 'fc_preorder_reserve_email';

  function normalizeEmail(email) {
    return (email || '').trim().toLowerCase();
  }

  function emailsMatch(a, b) {
    var left = normalizeEmail(a);
    var right = normalizeEmail(b);
    return left !== '' && left === right;
  }

  function getReserveOwnerEmail() {
    try {
      return sessionStorage.getItem(STORAGE_RESERVE_EMAIL) || '';
    } catch (e) {
      return '';
    }
  }

  function setReserveOwnerEmail(email) {
    try {
      var normalized = normalizeEmail(email);
      if (normalized) {
        sessionStorage.setItem(STORAGE_RESERVE_EMAIL, normalized);
      }
    } catch (e) { /* ignore */ }
  }

  function clearReserveSessionState() {
    clearPendingCheckout();
    try {
      var raw = sessionStorage.getItem(STORAGE_QUESTIONNAIRE);
      if (raw) {
        var data = JSON.parse(raw);
        if (data && data.intent === 'reserve') {
          sessionStorage.removeItem(STORAGE_QUESTIONNAIRE);
        }
      }
      sessionStorage.removeItem(STORAGE_RESERVE_EMAIL);
    } catch (e) { /* ignore */ }
  }

  function hasCompletedDecline() {
    try {
      var raw = sessionStorage.getItem(STORAGE_QUESTIONNAIRE);
      if (!raw) return false;
      var data = JSON.parse(raw);
      return !!(data && data.intent === 'decline');
    } catch (e) {
      return false;
    }
  }

  function getStoredQuestionnaire() {
    try {
      var raw = sessionStorage.getItem(STORAGE_QUESTIONNAIRE);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function hasCompletedReserveForEmail(email) {
    var data = getStoredQuestionnaire();
    if (!data || data.intent !== 'reserve') return false;
    var recordEmail = data.email || getReserveOwnerEmail();
    return emailsMatch(recordEmail, email);
  }

  function resumeReserveCheckout(variantId, checkoutUrl, note) {
    var checkout = (checkoutUrl || '/checkout').trim() || '/checkout';
    var summary = (note || '').trim() || 'Preorder questionnaire completed';

    return fetch(window.routes.cart_add_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        items: [{
          id: parseInt(variantId, 10),
          quantity: 1,
          properties: {
            _Questionnaire: summary,
            _Email: getStoredEmail()
          }
        }]
      })
    }).then(function (res) {
      return res.json().then(function (data) {
        return { ok: res.ok, data: data };
      });
    }).then(function (result) {
      if (!result.ok) {
        throw new Error((result.data && result.data.description) || 'Could not add to cart');
      }
      setReserveOwnerEmail(getStoredEmail());
      setPendingCheckout();
      redirectToCheckout(checkout);
    });
  }

  function getLineItemEmail(item) {
    if (!item || !item.properties) return '';
    if (Array.isArray(item.properties)) {
      var match = item.properties.find(function (prop) {
        return prop && (prop.name === '_Email' || prop.first === '_Email');
      });
      if (!match) return '';
      return match.value || match.last || '';
    }
    return item.properties._Email || '';
  }

  function cartPreorderTicketItems(cart, variantId) {
    var vid = parseInt(variantId, 10);
    if (!vid || !cart || !cart.items) return [];
    return cart.items.filter(function (item) {
      return item.variant_id === vid;
    });
  }

  function removePreorderTicketsFromCart(variantId, onlyKeys) {
    return fetchCart().then(function (cart) {
      var matches = cartPreorderTicketItems(cart, variantId);
      if (!matches.length) return cart;

      var updates = {};
      matches.forEach(function (item) {
        if (!onlyKeys || onlyKeys.indexOf(item.key) !== -1) {
          updates[item.key] = 0;
        }
      });

      if (!Object.keys(updates).length) return cart;

      return fetch(window.routes.cart_update_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ updates: updates })
      }).then(function (res) {
        return res.json();
      });
    });
  }

  function reconcilePreorderTicketForEmail(variantId, email) {
    var normalized = normalizeEmail(email);
    if (!variantId) return Promise.resolve(false);

    return fetchCart()
      .then(function (cart) {
        return normalizePreorderCart(cart, variantId);
      })
      .then(function (cart) {
        var matches = cartPreorderTicketItems(cart, variantId);
        if (!matches.length) {
          if (!hasCompletedReserveForEmail(normalized)) {
            if (!normalized || !emailsMatch(normalized, getReserveOwnerEmail())) {
              clearReserveSessionState();
            }
          }
          return { cart: cart, hasTicket: false };
        }

        if (!normalized) {
          return { cart: cart, hasTicket: true };
        }

        var owner = getReserveOwnerEmail();
        var staleKeys = [];
        var valid = null;

        matches.forEach(function (item) {
          var lineEmail = getLineItemEmail(item);
          if (lineEmail && emailsMatch(lineEmail, normalized)) {
            valid = item;
            return;
          }
          if (!lineEmail && owner && emailsMatch(owner, normalized)) {
            valid = item;
            return;
          }
          staleKeys.push(item.key);
        });

        if (staleKeys.length) {
          return removePreorderTicketsFromCart(variantId, staleKeys).then(function (nextCart) {
            if (!valid) clearReserveSessionState();
            return {
              cart: nextCart,
              hasTicket: !!valid
            };
          });
        }

        if (!valid) {
          clearReserveSessionState();
          return { cart: cart, hasTicket: false };
        }

        if (!owner || !emailsMatch(owner, normalized)) {
          setReserveOwnerEmail(normalized);
        }

        return { cart: cart, hasTicket: true };
      })
      .then(function (result) {
        return result.hasTicket;
      })
      .catch(function () {
        return false;
      });
  }

  function handleEmailChanged() {
    clearReserveSessionState();
    document.querySelectorAll('.fc-preorder-offers[data-variant-id]').forEach(function (section) {
      removePreorderTicketsFromCart(section.dataset.variantId).then(function () {
        syncOffersCta(section);
        syncDeclineLink(section);
      });
    });
  }

  function setPendingCheckout() {
    try {
      sessionStorage.setItem(STORAGE_PENDING_CHECKOUT, '1');
    } catch (e) { /* ignore */ }
  }

  function hasPendingCheckout() {
    try {
      if (!emailsMatch(getStoredEmail(), getReserveOwnerEmail())) return false;
      return sessionStorage.getItem(STORAGE_PENDING_CHECKOUT) === '1';
    } catch (e) {
      return false;
    }
  }

  function clearPendingCheckout() {
    try {
      sessionStorage.removeItem(STORAGE_PENDING_CHECKOUT);
    } catch (e) { /* ignore */ }
  }

  function fetchCart() {
    var cartUrl = (window.routes && window.routes.cart_url ? window.routes.cart_url : '/cart') + '.js';
    return fetch(cartUrl, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    }).then(function (res) {
      if (!res.ok) throw new Error('Could not load cart');
      return res.json();
    });
  }

  function cartHasPreorderTicket(cart, variantId) {
    var vid = parseInt(variantId, 10);
    if (!vid || !cart || !cart.items) return false;
    return cart.items.some(function (item) {
      return item.variant_id === vid;
    });
  }

  function normalizePreorderCart(cart, variantId) {
    var vid = parseInt(variantId, 10);
    if (!vid || !cart || !cart.items || !cart.items.length) {
      return Promise.resolve(cart || { items: [] });
    }

    var matches = cart.items.filter(function (item) {
      return item.variant_id === vid;
    });

    if (!matches.length) return Promise.resolve(cart);

    var updates = {};
    var needsUpdate = false;

    if (matches.length > 1) {
      matches.forEach(function (item, index) {
        updates[item.key] = index === 0 ? 1 : 0;
      });
      needsUpdate = true;
    } else if (matches[0].quantity > 1) {
      updates[matches[0].key] = 1;
      needsUpdate = true;
    }

    if (!needsUpdate) return Promise.resolve(cart);

    return fetch(window.routes.cart_update_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ updates: updates })
    }).then(function (res) {
      return res.json();
    });
  }

  function ensureSinglePreorderTicket(variantId) {
    return reconcilePreorderTicketForEmail(variantId, getStoredEmail());
  }

  function redirectToCheckout(checkoutUrl) {
    window.location.replace((checkoutUrl || '/checkout').trim() || '/checkout');
  }

  function getIntent() {
    try {
      return new URLSearchParams(window.location.search).get('intent') || 'reserve';
    } catch (e) {
      return 'reserve';
    }
  }

  function getSurvey(intent) {
    var data = window.FC_PREORDER_SURVEY;
    if (!data) return [];
    return intent === 'decline' ? (data.decline || []) : (data.reserve || []);
  }

  function optionLabel(option) {
    return option.letter + ') ' + option.text;
  }

  function getStoredEmail() {
    try {
      return sessionStorage.getItem(STORAGE_EMAIL) || '';
    } catch (e) {
      return '';
    }
  }

  function getStoredMarketing() {
    try {
      return sessionStorage.getItem(STORAGE_MARKETING) || '';
    } catch (e) {
      return '';
    }
  }

  function getSessionId() {
    try {
      var id = sessionStorage.getItem(STORAGE_SESSION);
      if (!id) {
        id = 'fc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
        sessionStorage.setItem(STORAGE_SESSION, id);
      }
      return id;
    } catch (e) {
      return 'fc_unknown';
    }
  }

  function formatQuestionAnswer(q, resp) {
    resp = resp || { letters: [], other: '' };
    var parts = resp.letters.map(function (letter) {
      var opt = q.options.find(function (o) { return o.letter === letter; });
      if (!opt) return letter;
      if (opt.other && resp.other.trim()) {
        return optionLabel(opt) + ' — ' + resp.other.trim();
      }
      return optionLabel(opt);
    });
    return parts.join('; ');
  }

  function formatResponses(questions, responses) {
    return questions.map(function (q) {
      var resp = responses[q.id] || { letters: [], other: '' };
      return q.title + ': ' + formatQuestionAnswer(q, resp);
    });
  }

  function buildSurveyPayload(section, intent, questions, responses, checkoutStarted) {
    var payload = {
      intent: intent,
      email: getStoredEmail(),
      accepts_marketing: getStoredMarketing() === '1',
      summary: formatResponses(questions, responses).join(' | '),
      session_id: getSessionId(),
      checkout_started: !!checkoutStarted,
      page_url: window.location.href,
      secret: section.dataset.surveySecret || ''
    };

    questions.forEach(function (q) {
      payload[q.id] = formatQuestionAnswer(q, responses[q.id]);
    });

    payload.responses = responses;

    return payload;
  }

  function submitSurveyToWebhook(section, payload) {
    var url = (section.dataset.surveyWebhook || '').trim();
    if (!url) return;

    try {
      fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(function () { /* fire-and-forget */ });
    } catch (e) { /* ignore */ }
  }

  function initQuestionnaire(section) {
    if (section.dataset.fcQInit) return;
    section.dataset.fcQInit = '1';

    var root = section.querySelector('[data-fc-preorder-q-root]');
    if (!root) return;

    var intent = getIntent();
    var questions = getSurvey(intent);
    if (!questions.length) return;

    var progressEl = section.querySelector('[data-fc-q-progress]');
    var progressFillEl = section.querySelector('[data-fc-q-progress-fill]');
    var titleEl = section.querySelector('[data-fc-q-title]');
    var hintEl = section.querySelector('[data-fc-q-hint]');
    var optionsEl = section.querySelector('[data-fc-q-options]');
    var backBtn = section.querySelector('[data-fc-q-back]');
    var errorEl = section.querySelector('[data-fc-q-error]');
    var doneEl = section.querySelector('[data-fc-q-done]');
    var doneTextEl = section.querySelector('[data-fc-q-done-text]');
    var variantId = section.dataset.variantId;
    var doneDecline = section.dataset.doneDecline || 'Thank you for your support in helping us grow!';
    var declineRedirect = (section.dataset.declineRedirect || '/').trim() || '/';
    var checkoutUrl = (section.dataset.checkoutUrl || '/checkout').trim() || '/checkout';

    var step = 0;
    var responses = {};
    var advanceTimer = null;
    var completed = false;

    root.hidden = true;

    function beginQuestionnaire() {
      root.hidden = false;
      renderStep();
    }

    function guardReserveFlow() {
      if (intent !== 'reserve' || !variantId) {
        beginQuestionnaire();
        return;
      }

      var stored = getStoredQuestionnaire();

      ensureSinglePreorderTicket(variantId).then(function (hasTicket) {
        if (hasTicket) {
          setPendingCheckout();
          redirectToCheckout(checkoutUrl);
          return;
        }

        if (hasCompletedReserveForEmail(getStoredEmail())) {
          setQuestionnaireLoading(true);
          resumeReserveCheckout(variantId, checkoutUrl, stored ? stored.summary : '')
            .catch(function (err) {
              setQuestionnaireLoading(false);
              showError(err.message || 'Something went wrong. Try again.');
            });
          return;
        }

        beginQuestionnaire();
      });
    }

    function clearAdvanceTimer() {
      if (advanceTimer) {
        clearTimeout(advanceTimer);
        advanceTimer = null;
      }
    }

    function setQuestionnaireLoading(loading) {
      root.classList.toggle('is-loading', loading);
      if (backBtn) backBtn.disabled = loading;
    }

    function updateBackButton() {
      if (backBtn) backBtn.hidden = step === 0;
    }

    function currentQuestion() {
      return questions[step];
    }

    function currentResponse() {
      var q = currentQuestion();
      if (!responses[q.id]) {
        responses[q.id] = { letters: [], other: '' };
      }
      return responses[q.id];
    }

    function clearError() {
      if (!errorEl) return;
      errorEl.hidden = true;
      errorEl.textContent = '';
    }

    function showError(msg) {
      if (!errorEl) return;
      errorEl.textContent = msg;
      errorEl.hidden = false;
    }

    function isOtherSelected(q, resp) {
      return q.options.some(function (opt) {
        return opt.other && resp.letters.indexOf(opt.letter) !== -1;
      });
    }

    function updateOptionSelectionUI() {
      var resp = currentResponse();
      section.querySelectorAll('.fc-preorder-q__option').forEach(function (el) {
        var letter = el.dataset.letter;
        if (!letter) return;
        var selected = resp.letters.indexOf(letter) !== -1;
        el.classList.toggle('is-selected', selected);
        el.setAttribute('aria-selected', selected ? 'true' : 'false');
      });
    }

    function selectOtherOption(letter) {
      var q = currentQuestion();
      var resp = currentResponse();

      if (resp.letters.indexOf(letter) !== -1) {
        updateOptionSelectionUI();
        return true;
      }

      if (q.max === 1) {
        resp.letters = [letter];
      } else if (resp.letters.length >= q.max) {
        showError('Choose ' + q.max + ' main answers.');
        return false;
      } else {
        resp.letters.push(letter);
      }

      clearError();
      updateOptionSelectionUI();
      return true;
    }

    function renderStep() {
      var q = currentQuestion();
      var resp = currentResponse();
      clearError();

      if (progressEl) {
        progressEl.textContent = 'Question ' + (step + 1) + ' of ' + questions.length;
      }
      if (progressFillEl) {
        progressFillEl.style.width = Math.round(((step + 1) / questions.length) * 100) + '%';
      }
      if (titleEl) titleEl.textContent = q.title;
      if (hintEl) {
        if (q.hint) {
          hintEl.textContent = q.hint;
          hintEl.hidden = false;
        } else {
          hintEl.textContent = '';
          hintEl.hidden = true;
        }
      }
      if (optionsEl) {
        optionsEl.innerHTML = '';
        optionsEl.setAttribute('aria-multiselectable', q.max > 1 ? 'true' : 'false');

        q.options.forEach(function (opt) {
          var row = document.createElement('div');
          row.className = 'fc-preorder-q__row';
          var isSelected = resp.letters.indexOf(opt.letter) !== -1;

          if (opt.other) {
            var wrap = document.createElement('div');
            wrap.className = 'fc-preorder-q__option fc-preorder-q__option--other';
            wrap.dataset.letter = opt.letter;
            wrap.setAttribute('role', 'option');
            wrap.setAttribute('aria-selected', isSelected ? 'true' : 'false');
            if (isSelected) wrap.classList.add('is-selected');

            var letterSpan = document.createElement('span');
            letterSpan.className = 'fc-preorder-q__letter';
            letterSpan.textContent = opt.letter + ')';

            var otherInput = document.createElement('input');
            otherInput.type = 'text';
            otherInput.className = 'fc-preorder-q__other-inline';
            otherInput.placeholder = 'Other — please specify…';
            otherInput.value = isSelected ? (resp.other || '') : '';
            otherInput.dataset.fcQOther = opt.letter;
            otherInput.setAttribute('aria-label', opt.letter + ') Other');

            otherInput.addEventListener('focus', function () {
              selectOtherOption(opt.letter);
            });

            otherInput.addEventListener('input', function () {
              resp.other = otherInput.value;
              if ((resp.other || '').trim()) {
                selectOtherOption(opt.letter);
                maybeAutoAdvance();
              }
            });

            otherInput.addEventListener('keydown', function (event) {
              if (event.key === 'Enter') {
                event.preventDefault();
                syncOtherInputs();
                maybeAutoAdvance(true);
                return;
              }
              event.stopPropagation();
            });

            wrap.addEventListener('click', function (event) {
              if (event.target === otherInput) return;
              otherInput.focus();
            });

            wrap.appendChild(letterSpan);
            wrap.appendChild(otherInput);
            row.appendChild(wrap);
          } else {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'fc-preorder-q__option';
            btn.dataset.letter = opt.letter;
            btn.setAttribute('role', 'option');
            btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');

            if (isSelected) {
              btn.classList.add('is-selected');
            }

            var letterSpan = document.createElement('span');
            letterSpan.className = 'fc-preorder-q__letter';
            letterSpan.textContent = opt.letter + ')';

            var textSpan = document.createElement('span');
            textSpan.className = 'fc-preorder-q__text';
            textSpan.textContent = opt.text;

            btn.appendChild(letterSpan);
            btn.appendChild(textSpan);
            btn.addEventListener('click', function () {
              toggleLetter(opt.letter);
            });

            row.appendChild(btn);
          }

          optionsEl.appendChild(row);
        });
      }

      updateBackButton();
    }

    function syncOtherInputs() {
      var resp = currentResponse();
      section.querySelectorAll('[data-fc-q-other]').forEach(function (input) {
        var letter = input.dataset.fcQOther;
        if (resp.letters.indexOf(letter) !== -1) {
          resp.other = input.value;
        }
      });
    }

    function toggleLetter(letter) {
      var q = currentQuestion();
      var resp = currentResponse();
      var idx = resp.letters.indexOf(letter);
      var added = false;
      var opt = q.options.find(function (o) { return o.letter === letter; });

      if (q.max === 1) {
        if (idx === -1) {
          if (opt && !opt.other) resp.other = '';
          resp.letters = [letter];
          added = true;
        } else {
          resp.letters = [];
          if (opt && !opt.other) resp.other = '';
          clearAdvanceTimer();
        }
      } else if (idx !== -1) {
        resp.letters.splice(idx, 1);
        if (opt && opt.other) resp.other = '';
        clearAdvanceTimer();
      } else if (resp.letters.length >= q.max) {
        showError('Choose ' + q.max + ' main answers.');
        return;
      } else {
        resp.letters.push(letter);
        added = true;
      }

      clearError();
      renderStep();
      syncOtherInputs();

      if (added) {
        if (opt && opt.other) {
          var otherInput = section.querySelector('[data-fc-q-other="' + letter + '"]');
          if (otherInput) otherInput.focus();
        } else {
          maybeAutoAdvance();
        }
      }
    }

    function validateStep() {
      var q = currentQuestion();
      var resp = currentResponse();

      if (!resp.letters.length) {
        showError('Please select at least one answer.');
        return false;
      }

      if (q.max > 1 && resp.letters.length !== q.max) {
        showError('Choose ' + q.max + ' main answers.');
        return false;
      }

      if (isOtherSelected(q, resp) && !(resp.other || '').trim()) {
        showError('Please tell us more in the Other field.');
        return false;
      }

      return true;
    }

    function finishDecline() {
      if (completed) return;
      completed = true;
      clearAdvanceTimer();
      clearError();

      root.hidden = true;
      root.setAttribute('aria-hidden', 'true');
      section.classList.add('is-complete');

      if (doneTextEl) {
        doneTextEl.textContent = doneDecline;
      }

      if (doneEl) {
        doneEl.removeAttribute('hidden');
        doneEl.hidden = false;
        doneEl.classList.remove('is-visible');
        doneEl.classList.add('fc-preorder-questionnaire__done--overlay');
        doneEl.setAttribute('role', 'status');
        doneEl.setAttribute('aria-live', 'polite');

        if (doneEl.parentElement !== document.body) {
          document.body.appendChild(doneEl);
        }

        /* Force initial opacity:0 to paint before triggering transition */
        void doneEl.offsetWidth;
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            doneEl.classList.add('is-visible');
          });
        });
      }

      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

      window.setTimeout(function () {
        window.location.replace(declineRedirect);
      }, 3200);
    }

    function finishReserve() {
      if (!variantId) {
        showError('Preorder product is not configured. Set it in the theme editor.');
        return;
      }

      setQuestionnaireLoading(true);

      var note = formatResponses(questions, responses).join(' | ');

      ensureSinglePreorderTicket(variantId)
        .then(function (hasTicket) {
          if (hasTicket) {
            setPendingCheckout();
            redirectToCheckout(checkoutUrl);
            return null;
          }

          return fetch(window.routes.cart_add_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
              items: [{
                id: parseInt(variantId, 10),
                quantity: 1,
                properties: {
                  _Questionnaire: note,
                  _Email: getStoredEmail()
                }
              }]
            })
          }).then(function (res) {
            return res.json().then(function (data) {
              return { ok: res.ok, data: data };
            });
          });
        })
        .then(function (result) {
          if (!result) return;
          if (!result.ok) {
            throw new Error((result.data && result.data.description) || 'Could not add to cart');
          }
          setReserveOwnerEmail(getStoredEmail());
          setPendingCheckout();
          redirectToCheckout(checkoutUrl);
        })
        .catch(function (err) {
          setQuestionnaireLoading(false);
          showError(err.message || 'Something went wrong. Try again.');
        });
    }

    function tryCompleteOrNext() {
      if (completed) return;
      clearAdvanceTimer();
      syncOtherInputs();
      if (!validateStep()) return;
      onNext();
    }

    function maybeAutoAdvance(immediate) {
      if (completed) return;

      var q = currentQuestion();
      var resp = currentResponse();

      syncOtherInputs();

      if (!resp.letters.length) return;
      if (isOtherSelected(q, resp) && !(resp.other || '').trim()) return;

      clearAdvanceTimer();

      if (q.max === 1 || immediate) {
        advanceTimer = setTimeout(tryCompleteOrNext, immediate ? 0 : 140);
        return;
      }

      if (resp.letters.length >= q.max) {
        advanceTimer = setTimeout(tryCompleteOrNext, 140);
      }
    }

    function onBack() {
      if (step <= 0) return;
      clearAdvanceTimer();
      step -= 1;
      renderStep();
    }

    function onNext() {
      if (completed) return;

      syncOtherInputs();
      if (!validateStep()) return;

      if (step < questions.length - 1) {
        step += 1;
        renderStep();
        return;
      }

      try {
        var summaryLines = formatResponses(questions, responses);

        try {
          sessionStorage.setItem(STORAGE_QUESTIONNAIRE, JSON.stringify({
            intent: intent,
            email: getStoredEmail(),
            responses: responses,
            summary: summaryLines,
            at: Date.now()
          }));
        } catch (e) { /* ignore */ }

        submitSurveyToWebhook(
          section,
          buildSurveyPayload(section, intent, questions, responses, intent === 'reserve')
        );

        if (intent === 'reserve') {
          setReserveOwnerEmail(getStoredEmail());
        }

        if (intent === 'decline') {
          finishDecline();
        } else {
          finishReserve();
        }
      } catch (err) {
        completed = false;
        showError(err.message || 'Something went wrong. Try again.');
      }
    }

    function onKeyDown(event) {
      if (!root || root.hidden) return;
      var tag = event.target && event.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (event.key === 'Backspace' && step > 0) {
        event.preventDefault();
        onBack();
        return;
      }

      var key = (event.key || '').toUpperCase();
      if (key.length !== 1 || key < 'A' || key > 'Z') return;

      var q = currentQuestion();
      var match = q.options.find(function (opt) {
        return opt.letter === key;
      });
      if (!match) return;

      event.preventDefault();
      toggleLetter(key);
    }

    if (backBtn) {
      backBtn.addEventListener('click', onBack);
    }

    document.addEventListener('keydown', onKeyDown);
    guardReserveFlow();
  }

  function applyOffersCheckoutCta(cta, checkoutUrl, checkoutLabel) {
    cta.href = checkoutUrl;
    cta.textContent = checkoutLabel;
    cta.dataset.fcPoCheckoutMode = '1';
  }

  function isSectionCustomerReserved(section) {
    return section.dataset.customerReserved === 'true';
  }

  function parseReservedLookupResponse(res) {
    var contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      return false;
    }

    return res.json()
      .then(function (data) {
        return !!(data && data.ok && data.reserved);
      })
      .catch(function () {
        return false;
      });
  }

  function checkEmailReserved(section) {
    if (isSectionCustomerReserved(section)) {
      return Promise.resolve(true);
    }

    var url = (section.dataset.reservedCheckUrl || '').trim();
    var tag = (section.dataset.reservedTag || 'nomadpreorder').trim();
    var secret = (section.dataset.reservedCheckSecret || '').trim();
    var email = getStoredEmail();

    if (!url || !email) {
      return Promise.resolve(false);
    }

    var isSameOriginPath = url.charAt(0) === '/';

    if (isSameOriginPath) {
      var params = new URLSearchParams({
        email: email,
        tag: tag,
        secret: secret
      });

      return fetch(url + '?' + params.toString(), {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      }).then(parseReservedLookupResponse);
    }

    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        tag: tag,
        secret: secret
      })
    }).then(parseReservedLookupResponse);
  }

  function applyOffersReservedState(section) {
    var actions = section.querySelector('.fc-preorder-offers__actions');
    if (!actions) return;

    var message = section.dataset.reservedMessage || "You're on the list! We'll notify you when the launch date is announced.";
    var homeUrl = (section.dataset.homeUrl || '/').trim() || '/';
    var backLabel = (section.dataset.declineCompletedLabel || 'Back to Home Page').trim();

    actions.innerHTML = '';
    actions.classList.add('fc-preorder-offers__actions--reserved');
    section.dataset.fcPoReserved = '1';

    var copy = document.createElement('p');
    copy.className = 'fc-preorder-offers__reserved';
    copy.textContent = message;

    var backLink = document.createElement('a');
    backLink.className = 'fc-preorder-offers__decline';
    backLink.href = homeUrl;
    backLink.textContent = backLabel;

    actions.appendChild(copy);
    actions.appendChild(backLink);

    clearPendingCheckout();
  }

  function applyOffersReserveCta(cta, reserveUrl, reserveLabel) {
    cta.href = reserveUrl;
    cta.textContent = reserveLabel;
    delete cta.dataset.fcPoCheckoutMode;
  }

  function syncDeclineLink(section) {
    var declineLink = section.querySelector('.fc-preorder-offers__decline');
    if (!declineLink) return;

    var homeUrl = (section.dataset.homeUrl || '/').trim() || '/';
    var declineUrl = (section.dataset.declineUrl || '').trim();
    var declineLabel = (section.dataset.declineLabel || '').trim();
    var declineCompletedLabel = (section.dataset.declineCompletedLabel || 'Back to Home Page').trim();

    if (hasCompletedDecline()) {
      declineLink.href = homeUrl;
      declineLink.textContent = declineCompletedLabel;
      declineLink.dataset.fcPoDeclineComplete = '1';
      return;
    }

    if (declineUrl) declineLink.href = declineUrl;
    if (declineLabel) declineLink.textContent = declineLabel;
    delete declineLink.dataset.fcPoDeclineComplete;
  }

  function syncOffersCta(section) {
    if (section.dataset.fcPoReserved === '1') return;

    var variantId = section.dataset.variantId;
    var checkoutUrl = (section.dataset.checkoutUrl || '/checkout').trim() || '/checkout';
    var checkoutLabel = (section.dataset.checkoutCtaLabel || 'Complete your $2 reservation').trim();
    var reserveUrl = (section.dataset.reserveUrl || '').trim();
    var reserveLabel = (section.dataset.reserveLabel || 'Reserve discount for only $2').trim();
    var cta = section.querySelector('.fc-preorder-offers__cta');

    checkEmailReserved(section).then(function (isReserved) {
      if (isReserved) {
        applyOffersReservedState(section);
        return;
      }

      if (!variantId || !cta) return;

      syncDeclineLink(section);

      reconcilePreorderTicketForEmail(variantId, getStoredEmail()).then(function (hasTicket) {
        var completedReserve = hasCompletedReserveForEmail(getStoredEmail());

        if (hasTicket || completedReserve) {
          setPendingCheckout();
          applyOffersCheckoutCta(cta, checkoutUrl, checkoutLabel);
          return;
        }

        clearPendingCheckout();
        applyOffersReserveCta(cta, reserveUrl, reserveLabel);
      });
    });
  }

  function initOffersPage(section) {
    var checkoutUrl = (section.dataset.checkoutUrl || '/checkout').trim() || '/checkout';
    var variantId = section.dataset.variantId;

    if (!section.dataset.offersInit) {
      section.dataset.offersInit = '1';

      var cta = section.querySelector('.fc-preorder-offers__cta');
      if (cta) {
        cta.addEventListener('click', function (event) {
          if (section.dataset.fcPoReserved === '1') return;
          if (cta.dataset.fcPoCheckoutMode !== '1') return;
          event.preventDefault();

          reconcilePreorderTicketForEmail(variantId, getStoredEmail()).then(function (hasTicket) {
            if (hasTicket) {
              redirectToCheckout(checkoutUrl);
              return;
            }

            var stored = getStoredQuestionnaire();
            if (hasCompletedReserveForEmail(getStoredEmail())) {
              resumeReserveCheckout(variantId, checkoutUrl, stored ? stored.summary : '')
                .catch(function () {
                  redirectToCheckout(checkoutUrl);
                });
              return;
            }

            redirectToCheckout(checkoutUrl);
          });
        });
      }
    }

    if (isSectionCustomerReserved(section)) {
      applyOffersReservedState(section);
      return;
    }

    syncOffersCta(section);
  }

  function refreshOffersPages() {
    document.querySelectorAll('.fc-preorder-offers').forEach(function (section) {
      if (section.dataset.offersInit) {
        syncOffersCta(section);
      } else {
        initOffersPage(section);
      }
    });
  }

  function markFlowPages() {
    document.documentElement.classList.add(FLOW_CLASS);
    history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', function () {
      history.pushState(null, '', window.location.href);
    });
  }

  function boot() {
    if (document.querySelector('.fc-preorder-offers, .fc-preorder-questionnaire')) {
      markFlowPages();
    }

    document.querySelectorAll('.fc-preorder-questionnaire').forEach(initQuestionnaire);
    document.querySelectorAll('.fc-preorder-offers').forEach(initOffersPage);
  }

  window.addEventListener('fc-preorder-email-changed', handleEmailChanged);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.addEventListener('pageshow', function (event) {
    if (!document.querySelector('.fc-preorder-offers')) return;
    refreshOffersPages();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    if (!document.querySelector('.fc-preorder-offers')) return;
    refreshOffersPages();
  });
})();

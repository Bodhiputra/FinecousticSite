/**
 * Price tag: + button and unripped tag body add to cart; rip + qty on first add.
 */
window.fcWirePriceTag = function (tag, options) {
  options = options || {};
  var getVariantId =
    options.getVariantId ||
    function () {
      return Number(tag.dataset.variantId);
    };
  var onAdd = options.onAdd;
  if (!tag || tag.classList.contains('fc-tag--oos') || typeof onAdd !== 'function') return;

  var plus = tag.querySelector('.fc-card__atc-plus');
  if (!plus) return;

  var qty = 0;

  async function handleAtc(e) {
    e.preventDefault();
    e.stopPropagation();
    var variantId = getVariantId();
    if (!variantId) return;
    qty += 1;
    tag.classList.add('fc-tag-active');
    plus.classList.add('fc-active');
    var label = tag.querySelector('.fc-qty-label');
    if (label) label.textContent = String(qty);
    await onAdd(variantId, 1);
  }

  plus.addEventListener('click', handleAtc);

  var body = tag.querySelector('.fc-card__tag-body');
  if (body) {
    body.addEventListener('click', function (e) {
      if (tag.classList.contains('fc-tag-active')) return;
      if (e.target.closest('.fc-card__atc-plus')) return;
      handleAtc(e);
    });
  }
};

(function () {
  'use strict';

  /** Mirrors snippets/fc-exclude-product.liquid — hide internal / pre-order SKUs from browse UI */
  function fcExcludeProduct(handle) {
    var h = (handle || '').toLowerCase();
    if (!h) return false;
    if (h.indexOf('sonara-ufm1-test') !== -1) return true;
    if (h.indexOf('nomad-preorder') !== -1 || h.indexOf('hako-nomad-preorder') !== -1) return true;
    return false;
  }

  function fcProductDisplayName(title, handle) {
    var h = (handle || '').toLowerCase();
    if (!h) return title || '';
    if (h.indexOf('hako-nomad-l') !== -1) return 'Hako Nomad L';
    if (h.indexOf('hako-nomad') !== -1) return 'Hako Nomad';
    if (h.indexOf('resono') !== -1) return 'Resono';
    if (h.indexOf('sonara') !== -1) return 'Sonara';
    if (h.indexOf('groove-ows') !== -1) return 'Groove OWS';
    if (h.indexOf('groove-anc') !== -1) return 'Groove ANC';
    return title || '';
  }

  window.fcProductDisplayName = fcProductDisplayName;
  window.fcExcludeProduct = fcExcludeProduct;
})();

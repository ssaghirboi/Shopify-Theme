/**
 * AJAX cart drawer: open/close, render from /cart.js, qty via /cart/change.js
 */
(function () {
  'use strict';

  var drawer;
  var itemsEl;
  var subtotalEl;
  var countBadge;
  var freeShipText;
  var freeShipFill;
  var thresholdCents = 0;
  var moneyFormat = '${{ amount }}';

  function formatMoney(cents) {
    if (window.Shopify && typeof Shopify.formatMoney === 'function') {
      return Shopify.formatMoney(cents, moneyFormat);
    }
    var amount = (Number(cents) / 100).toFixed(2);
    return '$' + amount;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Liquid `escape` in data attributes leaves entities like &#39; — normalize for display */
  function decodeDataAttr(s) {
    if (s == null || s === '') return s;
    var t = document.createElement('textarea');
    t.innerHTML = s;
    return t.value;
  }

  function getCartRoot() {
    return window.Shopify && window.Shopify.routes && window.Shopify.routes.root ? window.Shopify.routes.root : '/';
  }

  function renderCart(cart) {
    if (!itemsEl) return;

    var count = cart.item_count || 0;
    if (countBadge) {
      countBadge.textContent = String(count);
      countBadge.hidden = count === 0;
      countBadge.setAttribute('aria-label', count + ' items');
    }

    if (!cart.items || !cart.items.length) {
      var emptyMsg = drawer && drawer.getAttribute('data-text-empty');
      itemsEl.innerHTML =
        '<p class="cart-drawer__empty">' +
        esc(decodeDataAttr(emptyMsg || 'Your cart is empty')) +
        '</p>';
    } else {
      var html = '';
      cart.items.forEach(function (item, index) {
        var line = index + 1;
        var imageUrl = item.image || (item.featured_image && item.featured_image.url) || '';
        var title = item.product_title || '';
        var alt = esc(title);
        var variant =
          item.variant_title && item.variant_title !== 'Default Title' ? item.variant_title : '';
        var lineCents = item.final_line_price != null ? item.final_line_price : item.line_price;
        html +=
          '<div class="cart-drawer__item" data-line="' +
          line +
          '">' +
          '<div class="cart-drawer__item-media">' +
          (imageUrl
            ? '<img src="' + String(imageUrl).replace(/"/g, '&quot;') + '" alt="' + alt + '" width="72" height="72" loading="lazy">'
            : '<div class="cart-drawer__item-placeholder"></div>') +
          '</div>' +
          '<div class="cart-drawer__item-info">' +
          '<div class="cart-drawer__item-top">' +
          '<span class="cart-drawer__item-title">' +
          esc(title) +
          '</span>' +
          '<span class="cart-drawer__item-price">' +
          formatMoney(lineCents) +
          '</span>' +
          '</div>';
        if (variant) {
          html += '<div class="cart-drawer__item-meta">' + esc(variant) + '</div>';
        }
        html +=
          '<div class="cart-drawer__item-actions">' +
          '<div class="cart-drawer__item-qty">' +
          '<button type="button" class="cart-drawer__qty-btn" data-qty-delta="-1" aria-label="Decrease quantity">−</button>' +
          '<span class="cart-drawer__qty-value">' +
          item.quantity +
          '</span>' +
          '<button type="button" class="cart-drawer__qty-btn" data-qty-delta="1" aria-label="Increase quantity">+</button>' +
          '</div>' +
          '<button type="button" class="cart-drawer__remove" data-remove-line aria-label="Remove">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M10 11v6M14 11v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' +
          '</button>' +
          '</div>' +
          '</div>' +
          '</div>';
      });
      itemsEl.innerHTML = html;
    }

    if (subtotalEl) {
      subtotalEl.textContent = formatMoney(cart.total_price || 0);
    }

    if (freeShipText && freeShipFill && thresholdCents > 0) {
      var total = cart.total_price || 0;
      var remaining = Math.max(0, thresholdCents - total);
      var pct = Math.min(100, (total / thresholdCents) * 100);
      freeShipFill.style.width = pct + '%';

      var unlocked = drawer && decodeDataAttr(drawer.getAttribute('data-text-unlocked'));
      var awayTpl = drawer && decodeDataAttr(drawer.getAttribute('data-text-away'));
      if (count === 0) {
        var base = drawer && decodeDataAttr(drawer.getAttribute('data-text-shipping-threshold'));
        freeShipText.textContent = (base || 'Free shipping on orders over {amount}').replace(
          '{amount}',
          formatMoney(thresholdCents)
        );
        freeShipFill.style.width = '0%';
      } else if (total >= thresholdCents) {
        freeShipText.textContent = unlocked || "You've earned free shipping!";
        freeShipFill.style.width = '100%';
      } else {
        freeShipText.textContent = (awayTpl || "You're only {amount} away from free shipping!").replace(
          '{amount}',
          formatMoney(remaining)
        );
      }
    }
  }

  function fetchCartJson() {
    return fetch(getCartRoot() + 'cart.js', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    }).then(function (r) {
      if (!r.ok) throw new Error('cart');
      return r.json();
    });
  }

  function openCart() {
    if (!drawer) return;
    fetchCartJson()
      .then(function (cart) {
        renderCart(cart);
        drawer.classList.add('is-open');
        drawer.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('cart-drawer-open');
      })
      .catch(function () {
        drawer.classList.add('is-open');
        drawer.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('cart-drawer-open');
      });
  }

  function closeCart() {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('cart-drawer-open');
  }

  function changeQty(line, quantity) {
    return fetch(getCartRoot() + 'cart/change.js', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ line: line, quantity: Math.max(0, quantity) }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error('change');
        return r.json();
      })
      .then(function (cart) {
        renderCart(cart);
      });
  }

  function onDrawerClick(e) {
    var target = e.target;
    if (target.closest('[data-cart-drawer-close]')) {
      closeCart();
      return;
    }

    var removeBtn = target.closest('[data-remove-line]');
    if (removeBtn) {
      var itemEl = removeBtn.closest('.cart-drawer__item');
      if (!itemEl) return;
      var line = parseInt(itemEl.getAttribute('data-line'), 10);
      if (line) changeQty(line, 0);
      return;
    }

    var qtyBtn = target.closest('[data-qty-delta]');
    if (qtyBtn) {
      var row = qtyBtn.closest('.cart-drawer__item');
      if (!row) return;
      var lineNum = parseInt(row.getAttribute('data-line'), 10);
      if (!lineNum) return;
      var delta = parseInt(qtyBtn.getAttribute('data-qty-delta'), 10) || 0;
      var qtySpan = row.querySelector('.cart-drawer__qty-value');
      var current = parseInt(qtySpan && qtySpan.textContent, 10) || 1;
      var next = Math.max(0, current + delta);
      changeQty(lineNum, next);
    }
  }

  function onDocumentClick(e) {
    var opener = e.target.closest('[data-open-cart-drawer]');
    if (opener) {
      e.preventDefault();
      openCart();
    }
  }

  function onFormSubmit(e) {
    var form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    var action = form.getAttribute('action') || '';
    if (action.indexOf('/cart/add') === -1) return;
    if (form.hasAttribute('data-no-ajax')) return;

    e.preventDefault();
    var fd = new FormData(form);

    fetch(getCartRoot() + 'cart/add.js', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: fd,
    })
      .then(function (r) {
        if (!r.ok) throw new Error('add');
        return r.json();
      })
      .then(function () {
        openCart();
      })
      .catch(function () {
        form.setAttribute('data-no-ajax', 'true');
        form.submit();
      });
  }

  function stripOpenCartParam() {
    try {
      var url = new URL(window.location.href);
      if (url.searchParams.get('open_cart') !== 'true') return;
      url.searchParams.delete('open_cart');
      var next = url.pathname + url.search + url.hash;
      window.history.replaceState({}, '', next || url.pathname);
    } catch (_) {}
  }

  function init() {
    drawer = document.getElementById('cart-drawer');
    if (!drawer) return;

    itemsEl = document.getElementById('cart-drawer-items');
    subtotalEl = document.getElementById('cart-drawer-subtotal');
    countBadge = document.getElementById('cart-drawer-count');
    freeShipText = document.getElementById('cart-drawer-free-shipping-text');
    freeShipFill = document.getElementById('cart-drawer-free-shipping-fill');
    thresholdCents = parseInt(drawer.getAttribute('data-free-shipping-threshold-cents'), 10) || 0;
    var mf = drawer.getAttribute('data-money-format');
    if (mf) moneyFormat = mf;

    drawer.addEventListener('click', onDrawerClick);
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('submit', onFormSubmit);

    try {
      if (new URLSearchParams(window.location.search).get('open_cart') === 'true') {
        stripOpenCartParam();
        openCart();
      }
    } catch (_) {}
  }

  window.themeCartDrawer = {
    openCart: openCart,
    closeCart: closeCart,
    renderCart: function () {
      return fetchCartJson().then(renderCart);
    },
    changeQty: changeQty,
    init: init,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

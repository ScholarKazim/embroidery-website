/* Khama — cart.js
   Reusable RTL left-side cart drawer for landing, /قياس, /products/*, /checkout.

   Public API on window.KhamaCart:
     open()                — open the drawer (renders fresh from localStorage)
     close()               — close it
     refresh()             — re-render from localStorage (after external writes)
     count()               — total quantity across all line items
     items()               — current cart items (array)
     removeItem(id)        — remove a line by id
     setQty(id, q)         — set qty (q <= 0 removes the line)

   Storage: `khama_cart` — array of items written by configurator.js.
   Each item shape: { id, kind, name, qty, priceLabel, config{...}, addedAt }

   Phase 7 will optionally sync this to Firestore on signed-in users.
*/
(function () {
  'use strict';

  // Soft-launch flag — must match configurator.js / calc.js. While true the cart
  // entry points are hidden (trigger button, badge) and the checkout CTA is not
  // rendered in the drawer footer, so users can't reach /checkout. All cart
  // logic stays intact — flip to false to expose the cart again.
  const SOFT_LAUNCH = false;

  const CART_KEY = 'khama_cart';
  const fmtNum = (n) => String(n);

  /* ============== Pricing (single source of truth) ==============
     Prices in IQD. robe is keyed by cut, scarf/cap by type. Exposed on
     window.KhamaPricing so configurator.js / calc.js / checkout.js share one
     table (cart.js loads before them on every page). Whole-class (دفعة) orders
     get a special price arranged directly — surfaced as a note, not computed. */
  const PRICING = {
    scarf: { regular: 30000, side: 30000, royal: 35000, american: 20000 },
    robe:  { regular: 35000, royal: 40000, gulf: 40000, american: 40000 },
    cap:   { regular: 20000, royal: 25000 },
  };
  const PRICE_BASE = { scarf: 30000, robe: 35000, cap: 20000 };
  function priceFor(kind, variant) {
    const m = PRICING[kind] || {};
    if (variant && m[variant] != null) return m[variant];
    return PRICE_BASE[kind] || 0;
  }
  function variantOf(item) {
    const c = (item && item.config) || {};
    return item && item.kind === 'robe' ? c.cut : c.type;
  }
  function itemUnitPrice(item) {
    const stored = Number(item && item.price);
    return stored > 0 ? stored : priceFor(item && item.kind, variantOf(item));
  }
  function formatPrice(n) { return Number(n || 0).toLocaleString('en-US') + ' دينار'; }
  window.KhamaPricing = {
    priceFor, formatPrice, variantOf, itemUnitPrice,
    label: (kind, variant) => formatPrice(priceFor(kind, variant)),
  };

  /* ============== Storage ============== */
  function readCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }
  function writeCart(items) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch {}
    syncCartCounts();
    window.dispatchEvent(new CustomEvent('khama:cart-update'));
  }
  function totalQty() {
    return readCart().reduce((n, it) => n + (it.qty || 1), 0);
  }
  function syncCartCounts() {
    const n = totalQty();
    document.querySelectorAll('[data-cart-count]').forEach(el => {
      if (n > 0) { el.hidden = false; el.textContent = fmtNum(n); }
      else el.hidden = true;
    });
    document.querySelectorAll('[data-cart-trigger]').forEach(btn => {
      btn.setAttribute('aria-label', n > 0 ? `السلة (${fmtNum(n)})` : 'السلة (فارغة)');
    });
  }

  /* ============== Format helpers ============== */
  function productLabel(kind) {
    return ({ scarf: 'وشاح إبرة وخيط', robe: 'روب إبرة وخيط', cap: 'قبعة إبرة وخيط' })[kind] || '';
  }
  function cutLabel(cut) {
    return ({ regular: 'عادي', royal: 'ملكي', american: 'أمريكي', gulf: 'خليجي' })[cut] || '';
  }
  function typeLabel(kind, type) {
    if (kind === 'cap') return ({ regular: 'عادية', royal: 'ملكية' })[type] || '';
    return ({ regular: 'عادي', side: 'جانبي', royal: 'ملكي', american: 'أمريكي' })[type] || '';
  }
  function scarfColorLabel(k){ return ({burgundy:'ماروني إبرة وخيط',red:'احمر عميق',mauve:'وردي ملكي',emerald:'اخضر داكن',blue:'ازرق داكن',teal:'ازرق فاتح'})[k] || ''; }
  function fontName(f){ return ({thmanyah:'خط ثمانية',naskh:'النسخ',thuluth:'الثلث'})[f] || 'خط ثمانية'; }
  function textColorLabel(t){ return t === 'silver' ? 'فضي' : 'ذهبي'; }

  function formatItemDetails(item) {
    const c = item.config || {};
    const out = [];

    if (item.kind === 'robe' && c.cut) {
      out.push(`النوع: ${cutLabel(c.cut)}`);
    }
    if ((item.kind === 'scarf' || item.kind === 'cap') && c.type) {
      out.push(`النوع: ${typeLabel(item.kind, c.type)}`);
    }
    if (item.kind === 'cap') {
      if (c.size === 'free') {
        out.push('المقاس: مرن');
        if (c.head) out.push(`محيط الرأس: ${fmtNum(c.head)} سم`);
      } else if (c.size) {
        out.push(`المقاس: ${c.size}`);
      }
    }
    if (item.kind !== 'cap') {
      // Body size (new model). Fall back to the bare letter for older cart items.
      if (c.refName)        out.push(`مقاس البدن: ${c.refName}`);
      else if (c.refLetter) out.push(`مقاس البدن: ${c.refLetter}`);
      const meas = [];
      if (c.shoulder) meas.push(`الكتف ${fmtNum(c.shoulder)}`);
      if (c.length)   meas.push(`الطول ${fmtNum(c.length)}`);
      if (c.sleeve)   meas.push(`الكم ${fmtNum(c.sleeve)}`);
      // Legacy items may still carry height/chest.
      if (!c.shoulder && c.height) meas.push(`الطول ${fmtNum(c.height)}`);
      if (!c.length && c.chest)    meas.push(`الصدر ${fmtNum(c.chest)}`);
      if (meas.length) out.push(`القياسات: ${meas.join(' · ')} سم`);
    }
    if (item.kind === 'scarf') {
      if (c.embroideryEnabled && c.name) {
        out.push(`التطريز: ${c.name}`);
        const bits = [`الخط: ${fontName(c.font)}`];
        if (c.scarfColor) bits.push(`الوشاح: ${scarfColorLabel(c.scarfColor)}`);
        bits.push(`الخيط: ${textColorLabel(c.textColor || (c.thread === 'silver' ? 'silver' : 'gold'))}`);
        out.push(bits.join(' · '));
      } else {
        out.push('بدون تطريز');
      }
    } else if (c.notes && c.notes.trim()) {
      // cap + robe carry free-form notes; truncate so the cart line stays compact.
      const trimmed = c.notes.trim();
      const short = trimmed.length > 70 ? trimmed.slice(0, 70) + '…' : trimmed;
      out.push(`ملاحظات: ${short}`);
    } else {
      out.push('بدون ملاحظات');
    }
    return out;
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  /* ============== Drawer markup ============== */
  function buildDrawer() {
    if (document.querySelector('[data-cart-drawer]')) return;
    const wrap = document.createElement('div');
    wrap.className = 'cart-drawer';
    wrap.setAttribute('data-cart-drawer', '');
    wrap.hidden = true;
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = `
      <div class="cart-backdrop" data-cart-close></div>
      <aside class="cart-panel" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <header class="cart-head">
          <h3 id="cart-title">السلة</h3>
          <button type="button" class="cart-close" data-cart-close aria-label="إغلاق السلة">&times;</button>
        </header>
        <div class="cart-body" data-cart-body></div>
        <footer class="cart-foot" data-cart-foot hidden>
          <div class="cart-summary cart-summary--money">
            <span class="cart-summary-lbl">الإجمالي</span>
            <span class="cart-summary-val" data-cart-money>0</span>
          </div>
          <div class="cart-summary cart-summary--sub">
            <span class="cart-summary-lbl">القطع</span>
            <span class="cart-summary-val" data-cart-total>0</span>
          </div>
          <p class="cart-batch-note">تطلبون دفعة كاملة؟ إلكم سعر خاص — <a href="/class">افتحوا صفحة دفعتكم</a>.</p>
          ${SOFT_LAUNCH ? '' : '<a href="/checkout" class="btn-pri cart-checkout">أكمل الطلب</a>'}
          <button type="button" class="btn-ghost cart-keep" data-cart-close>أكمل التسوق</button>
          <a href="/طلباتي" class="cart-track-link">طلباتي</a>
        </footer>
      </aside>
    `;
    document.body.appendChild(wrap);
  }

  /* ============== Render ============== */
  function render() {
    const drawer = document.querySelector('[data-cart-drawer]');
    if (!drawer) return;
    const body    = drawer.querySelector('[data-cart-body]');
    const foot    = drawer.querySelector('[data-cart-foot]');
    const totalEl = drawer.querySelector('[data-cart-total]');

    const items = readCart();
    body.innerHTML = '';

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'cart-empty';
      empty.innerHTML = `
        <div class="cart-empty-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 7h14l-1.4 10.5a2 2 0 0 1-2 1.5H8.4a2 2 0 0 1-2-1.5L5 7Z"/>
            <path d="M9 7V5a3 3 0 0 1 6 0v2"/>
          </svg>
        </div>
        <h4>ما عندك شي بالسلة بعد</h4>
        <p>اختر قطعتك وفصلها عليك. ثلاث قطع، كلها بقياسك إنت.</p>
        <a href="/products" class="btn-pri" data-cart-close>شوف المنتجات</a>
      `;
      body.appendChild(empty);
      foot.hidden = true;
      return;
    }

    const list = document.createElement('ul');
    list.className = 'cart-list';
    items.forEach(item => {
      const li = document.createElement('li');
      li.className = 'cart-item';
      li.dataset.id = item.id;
      const details = formatItemDetails(item);
      li.innerHTML = `
        <div class="cart-item-head">
          <span class="cart-item-kind" data-kind="${escapeHTML(item.kind)}" aria-hidden="true"></span>
          <h4 class="cart-item-title">${escapeHTML(item.name || productLabel(item.kind))}</h4>
          <button type="button" class="cart-item-remove" data-cart-remove="${escapeHTML(item.id)}" aria-label="احذف من السلة">&times;</button>
        </div>
        <ul class="cart-item-details">
          ${details.map(d => `<li>${escapeHTML(d)}</li>`).join('')}
        </ul>
        <div class="cart-item-foot">
          <div class="cart-item-qty" role="group" aria-label="الكمية">
            <button type="button" class="cart-qty-btn" data-cart-qty="-1" data-id="${escapeHTML(item.id)}" aria-label="نقص الكمية">−</button>
            <span class="cart-qty-val">${fmtNum(item.qty || 1)}</span>
            <button type="button" class="cart-qty-btn" data-cart-qty="1" data-id="${escapeHTML(item.id)}" aria-label="زود الكمية">+</button>
          </div>
          <span class="cart-item-price">${escapeHTML(formatPrice(itemUnitPrice(item) * (item.qty || 1)))}</span>
        </div>
      `;
      list.appendChild(li);
    });
    body.appendChild(list);
    foot.hidden = false;
    const moneyEl = drawer.querySelector('[data-cart-money]');
    const money = items.reduce((s, it) => s + itemUnitPrice(it) * (it.qty || 1), 0);
    if (moneyEl) moneyEl.textContent = formatPrice(money);
    if (totalEl) totalEl.textContent = `${fmtNum(totalQty())} قطع`;
  }

  /* ============== Open / close ============== */
  let drawer = null;
  let lastFocused = null;

  function ensureDrawer() {
    buildDrawer();
    drawer = document.querySelector('[data-cart-drawer]');
    if (!drawer) return null;
    if (drawer.dataset.khamaWired === '1') return drawer;
    drawer.dataset.khamaWired = '1';

    drawer.querySelectorAll('[data-cart-close]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        close();
      });
    });

    // Delegated qty + remove (re-render replaces nodes)
    drawer.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('[data-cart-remove]');
      if (removeBtn) {
        e.preventDefault();
        removeItem(removeBtn.dataset.cartRemove);
        return;
      }
      const qtyBtn = e.target.closest('[data-cart-qty]');
      if (qtyBtn) {
        e.preventDefault();
        const delta = parseInt(qtyBtn.dataset.cartQty, 10) || 0;
        adjustQty(qtyBtn.dataset.id, delta);
        return;
      }
      // Empty-state CTA also closes the drawer before navigating.
      const closeNav = e.target.closest('[data-cart-close]');
      if (closeNav && closeNav.tagName === 'A') {
        // Allow navigation but close first so the body unlocks.
        close();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !drawer.hidden) close();
    });

    return drawer;
  }

  function open() {
    const d = ensureDrawer();
    if (!d) return;
    render();
    lastFocused = document.activeElement;
    d.hidden = false;
    // Run the slide-in on the next frame so the transition fires.
    requestAnimationFrame(() => {
      d.classList.add('is-open');
      d.setAttribute('aria-hidden', 'false');
    });
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    const closeBtn = d.querySelector('.cart-close');
    if (closeBtn) setTimeout(() => closeBtn.focus(), 80);
  }
  function close() {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    setTimeout(() => { if (drawer && !drawer.classList.contains('is-open')) drawer.hidden = true; }, 360);
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    if (lastFocused && typeof lastFocused.focus === 'function') {
      try { lastFocused.focus(); } catch {}
    }
  }

  /* ============== Mutations ============== */
  function adjustQty(id, delta) {
    const items = readCart();
    const idx = items.findIndex(it => it.id === id);
    if (idx === -1) return;
    items[idx].qty = (items[idx].qty || 1) + delta;
    if (items[idx].qty < 1) items.splice(idx, 1);
    writeCart(items);
    render();
  }
  function setQty(id, q) {
    const items = readCart();
    const idx = items.findIndex(it => it.id === id);
    if (idx === -1) return;
    if (q <= 0) items.splice(idx, 1);
    else items[idx].qty = q;
    writeCart(items);
    render();
  }
  function removeItem(id) {
    const items = readCart();
    const next = items.filter(it => it.id !== id);
    writeCart(next);
    render();
  }

  /* ============== Trigger wiring ============== */
  function wireTriggers(root) {
    (root || document).querySelectorAll('[data-cart-trigger]').forEach(btn => {
      if (btn.dataset.khamaCartWired === '1') return;
      btn.dataset.khamaCartWired = '1';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        open();
      });
    });
  }

  /* ============== Public API ============== */
  window.KhamaCart = {
    open, close, refresh: render,
    count: totalQty,
    items: readCart,
    removeItem, setQty,
  };

  /* ============== Init ============== */
  function init() {
    if (SOFT_LAUNCH) {
      // Hide the cart entry points so the cart + checkout are unreachable.
      // Don't wire the triggers and don't sync the badge counts.
      document.querySelectorAll('[data-cart-trigger]').forEach(btn => { btn.hidden = true; });
      document.querySelectorAll('[data-cart-count]').forEach(el => { el.hidden = true; });
      return;
    }
    syncCartCounts();
    wireTriggers();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Cross-tab + same-tab updates
  window.addEventListener('storage', (e) => {
    if (SOFT_LAUNCH) return; // keep the cart entry points hidden during soft launch
    if (e.key === CART_KEY) {
      syncCartCounts();
      if (drawer && !drawer.hidden) render();
    }
  });
  window.addEventListener('khama:cart-update', () => {
    if (SOFT_LAUNCH) return; // keep the cart entry points hidden during soft launch
    syncCartCounts();
    if (drawer && !drawer.hidden) render();
  });
})();

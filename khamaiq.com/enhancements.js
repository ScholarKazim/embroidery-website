/* ============================================================
   إبرة وخيط — enhancements.js
   Interactive Delivery Estimator, Floating WhatsApp Concierge & Toasts
   ============================================================ */

(function () {
  'use strict';

  const WA_PHONE = '9647805088134';

  // 1. Toast Notification Utility
  window.showIkToast = function (message, duration = 3000) {
    let toast = document.getElementById('ik-global-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'ik-global-toast';
      toast.className = 'ik-toast';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<span class="ik-toast-icon">✓</span><span>${message}</span>`;
    toast.classList.add('is-visible');

    if (toast._timer) clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('is-visible');
    }, duration);
  };

  // 2. University Delivery Estimator
  function initDeliveryEstimator() {
    const uniSelect = document.getElementById('calc-uni-select');
    const orderTypeSelect = document.getElementById('calc-order-type');
    const resTime = document.getElementById('calc-res-time');
    const resPoint = document.getElementById('calc-res-point');
    const resPrice = document.getElementById('calc-res-price');
    const btnWa = document.getElementById('btn-delivery-calc-wa');

    if (!uniSelect || !resTime || !resPoint || !resPrice) return;

    // Fast delivery zones
    const fastUnis = ['جامعة بغداد', 'الجامعة المستنصرية', 'جامعة النهرين', 'الجامعة التكنولوجية', 'جامعة بابل', 'جامعة كربلاء', 'جامعة الكوفة', 'جامعة القادسية', 'جامعة الفراهيدي', 'جامعة المستقبل', 'جامعة الزهراء للبنات', 'جامعة وارث الأنبياء', 'جامعة العميد'];

    function calculateDelivery() {
      const selectedUniName = uniSelect.options[uniSelect.selectedIndex] ? uniSelect.options[uniSelect.selectedIndex].text : '';
      const isBatch = orderTypeSelect ? orderTypeSelect.value === 'batch' : false;

      let estTime = '24 - 48 ساعة';
      let pickup = 'بوابة الحرم الجامعي / سنتر الكلية';
      let cost = isBatch ? 'توصيل مجاني للدفعة 🎁' : '5,000 د.ع فقط (لباب البيت أو الكلية)';

      if (selectedUniName && !fastUnis.some(u => selectedUniName.includes(u))) {
        estTime = '48 - 72 ساعة';
      }

      if (isBatch) {
        pickup = 'تسليم مباشر لممثل الدفعة داخل الكلية';
      }

      resTime.textContent = estTime;
      resPoint.textContent = pickup;
      resPrice.textContent = cost;

      if (btnWa) {
        const msg = `مرحباً إبرة وخيط، حابب استفسر عن توصيل طلب تخرج:
• الوجهة: ${selectedUniName || 'جامعة عراقية'}
• نوع الطلب: ${isBatch ? 'طقم دفعة كاملة (10+ طلاب)' : 'طلب فردي'}
• مدة التوصيل المتوقعة: ${estTime}
• التكلفة: ${cost}`;
        btnWa.href = `https://wa.me/${WA_PHONE}?text=` + encodeURIComponent(msg);
      }
    }

    // Populate from KhamaUniDirectory if empty
    if (uniSelect.options.length <= 1 && window.KhamaUniDirectory && window.KhamaUniDirectory.unis) {
      window.KhamaUniDirectory.unis.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.name;
        opt.textContent = u.name;
        uniSelect.appendChild(opt);
      });
    }

    uniSelect.addEventListener('change', calculateDelivery);
    if (orderTypeSelect) orderTypeSelect.addEventListener('change', calculateDelivery);
    calculateDelivery();
  }

  // 3. Floating WhatsApp Concierge
  function initWhatsAppConcierge() {
    if (document.getElementById('wa-concierge-fab')) return;

    const fabContainer = document.createElement('div');
    fabContainer.id = 'wa-concierge-fab';
    fabContainer.className = 'wa-concierge-fab';

    fabContainer.innerHTML = `
      <div class="wa-concierge-menu" id="wa-concierge-menu" role="dialog" aria-label="المساعد الفوري">
        <div class="wa-menu-head">
          <h4 class="wa-menu-title"><span>🎓</span> مساعد إبرة وخيط</h4>
          <button class="wa-menu-close" id="wa-concierge-close" aria-label="إغلاق">&times;</button>
        </div>
        <a href="https://wa.me/${WA_PHONE}?text=${encodeURIComponent('مرحباً إبرة وخيط، حابب استشير الخياط بخصوص تفصيل روب ووشاح التخرج.')}" target="_blank" rel="noopener" class="wa-menu-item">
          <span class="wa-menu-item-icon">💬</span>
          <span>استشارة فورية مع الخياط</span>
        </a>
        <a href="/track" class="wa-menu-item">
          <span class="wa-menu-item-icon">🔍</span>
          <span>تتبع حالة طلبك المباشرة</span>
        </a>
        <a href="https://wa.me/${WA_PHONE}?text=${encodeURIComponent('مرحباً إبرة وخيط، أحتاج مساعدة في تحديد قياس الروب المناسب لطولي.')}" target="_blank" rel="noopener" class="wa-menu-item">
          <span class="wa-menu-item-icon">📏</span>
          <span>مساعدة في القياس والتفصيل</span>
        </a>
        <a href="https://wa.me/${WA_PHONE}?text=${encodeURIComponent('مرحباً إبرة وخيط، هل يتوفر لون وشاح أو قصة خاصة غير المعروضة بالمتجر؟')}" target="_blank" rel="noopener" class="wa-menu-item">
          <span class="wa-menu-item-icon">🎨</span>
          <span>طلب لون أو تطريز مخصص</span>
        </a>
      </div>
      <button class="wa-fab-btn" id="wa-concierge-btn" aria-label="المساعد السريع عبر واتساب">
        <svg viewBox="0 0 24 24"><path d="M17.5 14.4c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.87 1.21 3.07.15.2 2.09 3.2 5.07 4.49.71.31 1.26.49 1.69.63.71.23 1.36.19 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35zM12 2a10 10 0 0 0-8.55 15.19L2 22l4.94-1.3A10 10 0 1 0 12 2z"/></svg>
        <span>تحدث مع الخياط</span>
      </button>
    `;

    document.body.appendChild(fabContainer);

    const btn = document.getElementById('wa-concierge-btn');
    const menu = document.getElementById('wa-concierge-menu');
    const closeBtn = document.getElementById('wa-concierge-close');

    if (btn && menu) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('is-active');
      });
    }

    if (closeBtn && menu) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.remove('is-active');
      });
    }

    document.addEventListener('click', (e) => {
      if (menu && menu.classList.contains('is-active') && !fabContainer.contains(e.target)) {
        menu.classList.remove('is-active');
      }
    });
  }

  // Run on page load
  function init() {
    initDeliveryEstimator();
    initWhatsAppConcierge();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

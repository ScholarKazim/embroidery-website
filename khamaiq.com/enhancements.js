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

  // 4. Scarf Colors Visualizer (Front & Royal Back Views)
  function initColorVisualizer() {
    const swatchesContainer = document.getElementById('swatches');
    const photoFrame = document.getElementById('vis-photo');
    const curNameEl = document.getElementById('cur-name');
    const tabFront = document.getElementById('vis-tab-front');
    const tabBack = document.getElementById('vis-tab-back');

    if (!swatchesContainer || !photoFrame) return;
    if (swatchesContainer.children.length > 0) return;

    const VIS_COLORS = [
      {
        id: 'burgundy',
        name: 'ماروني خامة',
        hex: '#7a1832',
        front: 'khamaiq.com/assets/images/visualizer-burgundy.jpg?v=p2026_real',
        back:  'khamaiq.com/assets/images/visualizer-royal-back-burgundy.jpg?v=p2026_real'
      },
      {
        id: 'black',
        name: 'أسود ملكي',
        hex: '#1a1a1a',
        front: 'khamaiq.com/assets/images/visualizer-black.jpg?v=p2026_real',
        back:  'khamaiq.com/assets/images/visualizer-royal-back-black.jpg?v=p2026_real'
      },
      {
        id: 'navy',
        name: 'كحلي ملكي',
        hex: '#132247',
        front: 'khamaiq.com/assets/images/visualizer-navy.jpg?v=p2026_real',
        back:  'khamaiq.com/assets/images/visualizer-royal-back-navy.jpg?v=p2026_real'
      },
      {
        id: 'emerald',
        name: 'أخضر زمردي',
        hex: '#0e4937',
        front: 'khamaiq.com/assets/images/visualizer-emerald.jpg?v=p2026_real',
        back:  'khamaiq.com/assets/images/visualizer-royal-back-emerald.jpg?v=p2026_real'
      },
      {
        id: 'red',
        name: 'أحمر قاني',
        hex: '#a81c2f',
        front: 'khamaiq.com/assets/images/visualizer-red.jpg?v=p2026_real',
        back:  'khamaiq.com/assets/images/visualizer-royal-back-red.jpg?v=p2026_real'
      },
      {
        id: 'purple',
        name: 'بنفسجي ملكي',
        hex: '#4b1e5a',
        front: 'khamaiq.com/assets/images/visualizer-purple.jpg?v=p2026_real',
        back:  'khamaiq.com/assets/images/visualizer-royal-back-purple.jpg?v=p2026_real'
      },
      {
        id: 'mauve',
        name: 'وردي ملكي (موف)',
        hex: '#7d384e',
        front: 'khamaiq.com/assets/images/visualizer-mauve.jpg?v=p2026_real',
        back:  'khamaiq.com/assets/images/visualizer-royal-back-mauve.jpg?v=p2026_real'
      },
      {
        id: 'teal',
        name: 'بترولي (تيل)',
        hex: '#0b7285',
        front: 'khamaiq.com/assets/images/visualizer-teal.jpg?v=p2026_real',
        back:  'khamaiq.com/assets/images/visualizer-royal-back-teal.jpg?v=p2026_real'
      },
      {
        id: 'turquoise',
        name: 'تركوازي سماوي',
        hex: '#17a2b8',
        front: 'khamaiq.com/assets/images/visualizer-turquoise.jpg?v=p2026_real',
        back:  'khamaiq.com/assets/images/visualizer-royal-back-turquoise.jpg?v=p2026_real'
      }
    ];

    let currentColor = VIS_COLORS[0];
    let currentView = 'front';

    const layers = photoFrame.querySelectorAll('.vis-photo-layer');
    let activeLayerIndex = 0;

    function swapImage(src) {
      if (layers.length < 2) {
        if (layers[0]) layers[0].src = src;
        return;
      }
      photoFrame.classList.add('is-changing');
      const nextIndex = activeLayerIndex === 0 ? 1 : 0;
      const nextLayer = layers[nextIndex];
      const activeLayer = layers[activeLayerIndex];

      nextLayer.onload = () => {
        nextLayer.classList.add('is-active');
        activeLayer.classList.remove('is-active');
        activeLayerIndex = nextIndex;
        setTimeout(() => photoFrame.classList.remove('is-changing'), 400);
      };
      nextLayer.src = src;
    }

    function updateVisualizer() {
      const src = currentView === 'back' ? (currentColor.back || currentColor.front) : currentColor.front;
      swapImage(src);
      if (curNameEl) {
        const viewLabel = currentView === 'back' ? ' (قصة الظهر الملكية)' : '';
        curNameEl.textContent = currentColor.name + viewLabel;
      }
      document.querySelectorAll('#swatches .swatch').forEach(s => {
        if (!s.classList.contains('swatch-wa')) {
          s.classList.toggle('active', s.dataset.id === currentColor.id);
        }
      });
    }

    // Render Swatches
    swatchesContainer.innerHTML = '';
    VIS_COLORS.forEach(c => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch' + (c.id === currentColor.id ? ' active' : '');
      btn.dataset.id = c.id;
      btn.innerHTML = `
        <span class="dot" style="background:${c.hex};"></span>
        <span class="nm">${c.name}</span>
        <span class="hx">${c.hex}</span>
      `;
      btn.addEventListener('click', () => {
        currentColor = c;
        updateVisualizer();
      });
      swatchesContainer.appendChild(btn);
    });

    // WhatsApp custom color button
    const waSwatch = document.createElement('a');
    waSwatch.href = `https://wa.me/${WA_PHONE}?text=` + encodeURIComponent('مرحباً إبرة وخيط، حابب استفسر عن توفر ألوان وشاح إضافية.');
    waSwatch.className = 'swatch swatch-wa';
    waSwatch.target = '_blank';
    waSwatch.rel = 'noopener';
    waSwatch.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.5 14.4c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.87 1.21 3.07.15.2 2.09 3.2 5.07 4.49.71.31 1.26.49 1.69.63.71.23 1.36.19 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35zM12 2a10 10 0 0 0-8.55 15.19L2 22l4.94-1.3A10 10 0 1 0 12 2z"/></svg>
      <span class="nm" style="color:#25d366; font-weight:700;">ألوان أو طلبات خاصة؟ تواصل واتساب</span>
    `;
    swatchesContainer.appendChild(waSwatch);

    // Front/Back tabs
    if (tabFront && tabBack) {
      tabFront.addEventListener('click', () => {
        currentView = 'front';
        tabFront.classList.add('is-active');
        tabBack.classList.remove('is-active');
        updateVisualizer();
      });
      tabBack.addEventListener('click', () => {
        currentView = 'back';
        tabBack.classList.add('is-active');
        tabFront.classList.remove('is-active');
        updateVisualizer();
      });
    }

    // Preload visualizer photos
    VIS_COLORS.forEach(c => {
      if (c.front) { const imgF = new Image(); imgF.src = c.front; }
      if (c.back)  { const imgB = new Image(); imgB.src = c.back; }
    });
  }

  // Run on page load
  function init() {
    initWhatsAppConcierge();
    initColorVisualizer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

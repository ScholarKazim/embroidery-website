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
        front: 'static/assets/images/visualizer-burgundy.jpg?v=p2026_real',
        back:  'static/assets/images/visualizer-royal-back-burgundy.jpg?v=p2026_real'
      },
      {
        id: 'black',
        name: 'أسود ملكي',
        hex: '#1a1a1a',
        front: 'static/assets/images/visualizer-black.jpg?v=p2026_real',
        back:  'static/assets/images/visualizer-royal-back-black.jpg?v=p2026_real'
      },
      {
        id: 'navy',
        name: 'كحلي ملكي',
        hex: '#132247',
        front: 'static/assets/images/visualizer-navy.jpg?v=p2026_real',
        back:  'static/assets/images/visualizer-royal-back-navy.jpg?v=p2026_real'
      },
      {
        id: 'emerald',
        name: 'أخضر زمردي',
        hex: '#0e4937',
        front: 'static/assets/images/visualizer-emerald.jpg?v=p2026_real',
        back:  'static/assets/images/visualizer-royal-back-emerald.jpg?v=p2026_real'
      },
      {
        id: 'red',
        name: 'أحمر قاني',
        hex: '#a81c2f',
        front: 'static/assets/images/visualizer-red.jpg?v=p2026_real',
        back:  'static/assets/images/visualizer-royal-back-red.jpg?v=p2026_real'
      },
      {
        id: 'purple',
        name: 'بنفسجي ملكي',
        hex: '#4b1e5a',
        front: 'static/assets/images/visualizer-purple.jpg?v=p2026_real',
        back:  'static/assets/images/visualizer-royal-back-purple.jpg?v=p2026_real'
      },
      {
        id: 'mauve',
        name: 'وردي ملكي (موف)',
        hex: '#7d384e',
        front: 'static/assets/images/visualizer-mauve.jpg?v=p2026_real',
        back:  'static/assets/images/visualizer-royal-back-mauve.jpg?v=p2026_real'
      },
      {
        id: 'teal',
        name: 'بترولي (تيل)',
        hex: '#0b7285',
        front: 'static/assets/images/visualizer-teal.jpg?v=p2026_real',
        back:  'static/assets/images/visualizer-royal-back-teal.jpg?v=p2026_real'
      },
      {
        id: 'turquoise',
        name: 'تركوازي سماوي',
        hex: '#17a2b8',
        front: 'static/assets/images/visualizer-turquoise.jpg?v=p2026_real',
        back:  'static/assets/images/visualizer-royal-back-turquoise.jpg?v=p2026_real'
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

    initLiveEmbroideryEngine(photoFrame, () => currentColor);
  }

  // 5. Live Embroidery & Graduation Story Card Generator
  function initLiveEmbroideryEngine(photoFrame, getCurrentColor) {
    if (!photoFrame || document.getElementById('live-embroidery-panel')) return;

    let state = {
      name: 'محمد علي سعد',
      font: 'thuluth', // 'thuluth', 'ruqah', 'naskh', 'diwani'
      thread: 'gold'   // 'gold', 'silver'
    };

    // 1. Create floating overlay badge on the visualizer photo
    let overlay = photoFrame.querySelector('.vis-photo-embroidery-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'vis-photo-embroidery-overlay';
      photoFrame.appendChild(overlay);
    }

    function renderOverlay() {
      const threadClass = state.thread === 'gold' ? 'sash-ribbon-gold' : 'sash-ribbon-silver';
      const fontFamilies = {
        thuluth: '"Amiri", serif',
        ruqah: '"Aref Ruqaa", cursive, serif',
        naskh: '"Cairo", sans-serif',
        diwani: '"Amiri", serif'
      };
      const chosenFont = fontFamilies[state.font] || fontFamilies.thuluth;

      overlay.innerHTML = `
        <span class="vis-overlay-tag">✨ معاينة التطريز الحي (دفعة 2026)</span>
        <div class="vis-overlay-name ${threadClass}" style="font-family:${chosenFont};">
          ${escapeHtml(state.name || 'محمد علي سعد')}
        </div>
      `;
    }

    // 2. Create the customization toolbar below the visualizer controls
    const controlsContainer = document.querySelector('.tester-controls') || photoFrame.parentElement;
    if (!controlsContainer) return;

    const panel = document.createElement('div');
    panel.id = 'live-embroidery-panel';
    panel.className = 'live-embroidery-panel';
    panel.innerHTML = `
      <div class="live-emb-header">
        <h4 class="live-emb-title"><span>🧵</span> خصص تطريز اسمك على الوشاح</h4>
        <span class="live-emb-tag">معاينة مباشرة حية</span>
      </div>

      <div class="live-emb-input-wrap">
        <input type="text" class="live-emb-input" id="live-emb-name-input" value="${state.name}" maxlength="26" placeholder="اكتب اسمك للمعاينة (مثال: د. علي الكعبي)">
      </div>

      <div class="live-emb-pill-row">
        <span class="live-emb-pill-label">نوع الخط:</span>
        <button type="button" class="live-pill-btn is-active" data-font="thuluth">الثلث الملكي</button>
        <button type="button" class="live-pill-btn" data-font="ruqah">الرقعة</button>
        <button type="button" class="live-pill-btn" data-font="naskh">النسخ</button>
        <button type="button" class="live-pill-btn" data-font="diwani">الديواني</button>
      </div>

      <div class="live-emb-pill-row">
        <span class="live-emb-pill-label">نوع الخيط:</span>
        <button type="button" class="live-pill-btn is-active" data-thread="gold">قصب ذهبي لامع ✨</button>
        <button type="button" class="live-pill-btn" data-thread="silver">حرير فضي فاخر 🪡</button>
      </div>

      <div class="live-emb-actions">
        <button type="button" class="btn-card-story" id="btn-download-story-card">
          <span>📸</span>
          <span>تنزيل بطاقة تخرجي للستوري (Instagram / WhatsApp)</span>
        </button>
        <a href="#" target="_blank" rel="noopener" class="btn-share-vis-wa" id="btn-share-vis-wa">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.5 14.4c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.87 1.21 3.07.15.2 2.09 3.2 5.07 4.49.71.31 1.26.49 1.69.63.71.23 1.36.19 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35zM12 2a10 10 0 0 0-8.55 15.19L2 22l4.94-1.3A10 10 0 1 0 12 2z"/></svg>
          <span>شارك تصميمك واتساب</span>
        </a>
      </div>
    `;

    controlsContainer.appendChild(panel);
    renderOverlay();

    // Event listeners
    const nameInput = panel.querySelector('#live-emb-name-input');
    const waShareBtn = panel.querySelector('#btn-share-vis-wa');
    const downloadBtn = panel.querySelector('#btn-download-story-card');

    function updateWaLink() {
      const curColor = getCurrentColor();
      const colorTitle = curColor ? curColor.name : 'ماروني خامة';
      const text = `مرحباً، صممت وشاح تخرجي من متجر إبرة وخيط بلون (${colorTitle}) واسمي (${state.name}) مطرزاً بالقصب الذهبي! تقدر تشوف التفاصيل وتصمم قطعتك هنا: ${window.location.origin}`;
      waShareBtn.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
    }

    nameInput.addEventListener('input', () => {
      state.name = nameInput.value.trim() || 'اسم الخريج';
      renderOverlay();
      updateWaLink();
    });

    panel.querySelectorAll('[data-font]').forEach(btn => {
      btn.addEventListener('click', () => {
        panel.querySelectorAll('[data-font]').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        state.font = btn.dataset.font;
        renderOverlay();
      });
    });

    panel.querySelectorAll('[data-thread]').forEach(btn => {
      btn.addEventListener('click', () => {
        panel.querySelectorAll('[data-thread]').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        state.thread = btn.dataset.thread;
        renderOverlay();
      });
    });

    updateWaLink();

    // Generate High-Res 1080x1350 Story Card on Canvas
    downloadBtn.addEventListener('click', () => {
      downloadBtn.disabled = true;
      downloadBtn.innerHTML = `<span>⏳</span><span>جاري إنشاء بطاقة التخرج...</span>`;

      const curColor = getCurrentColor();
      const activeLayer = photoFrame.querySelector('.vis-photo-layer.is-active') || photoFrame.querySelector('.vis-photo-layer');
      
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1350;
      const ctx = canvas.getContext('2d');

      // 1. Background radial luxury gradient
      const bgGrad = ctx.createRadialGradient(540, 400, 100, 540, 675, 800);
      bgGrad.addColorStop(0, '#162438');
      bgGrad.addColorStop(0.6, '#0b1320');
      bgGrad.addColorStop(1, '#050a12');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1080, 1350);

      // 2. Luxury Gold Outer and Inner Border Frame
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
      ctx.lineWidth = 4;
      ctx.strokeRect(30, 30, 1020, 1290);

      ctx.strokeStyle = '#ba8d5d';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(40, 40, 1000, 1270);

      // Corner gold accents
      const drawCorner = (x, y, dx, dy) => {
        ctx.beginPath();
        ctx.moveTo(x, y + dy * 25);
        ctx.lineTo(x, y);
        ctx.lineTo(x + dx * 25, y);
        ctx.strokeStyle = '#f6e1bd';
        ctx.lineWidth = 3;
        ctx.stroke();
      };
      drawCorner(44, 44, 1, 1);
      drawCorner(1036, 44, -1, 1);
      drawCorner(44, 1306, 1, -1);
      drawCorner(1036, 1306, -1, -1);

      // 3. Top Branding Header
      ctx.fillStyle = '#ba8d5d';
      ctx.font = 'bold 24px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🎓 إبرة وخيط — الفخامة الأكاديمية الملكية', 540, 95);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px "Amiri", serif';
      ctx.fillText('دفعة تخرج 2026 — مبارك التخرج', 540, 145);

      // 4. Draw Graduate Scarf Photo
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Draw centered photo
        const pWidth = 720;
        const pHeight = 900;
        const px = (1080 - pWidth) / 2;
        const py = 180;

        // Clip rounded rectangle for image
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(px, py, pWidth, pHeight, 28);
        ctx.clip();
        ctx.drawImage(img, px, py, pWidth, pHeight);
        ctx.restore();

        // Border around photo
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(px, py, pWidth, pHeight, 28);
        ctx.stroke();

        // 5. Embroidery Bottom Banner
        const bannerH = 140;
        const bannerY = py + pHeight - bannerH - 24;
        ctx.fillStyle = 'rgba(11, 19, 32, 0.88)';
        ctx.beginPath();
        ctx.roundRect(px + 30, bannerY, pWidth - 60, bannerH, 20);
        ctx.fill();
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Tag: Color & Cut
        ctx.fillStyle = '#ba8d5d';
        ctx.font = 'bold 20px -apple-system, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`اللون الرسمي: ${curColor ? curColor.name : 'ماروني خامة'} · قصة ملكية`, px + pWidth - 60, bannerY + 40);

        // Student Embroidered Name
        ctx.fillStyle = state.thread === 'gold' ? '#f5d77f' : '#e0e6ed';
        ctx.font = 'bold 46px "Amiri", serif';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 10;
        ctx.fillText(state.name || 'محمد علي سعد', px + pWidth - 60, bannerY + 100);
        ctx.shadowBlur = 0;

        // 6. Footer Signature
        ctx.fillStyle = '#8a99ad';
        ctx.font = '20px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('تم التصميم عبر منصة إبرة وخيط · khama.iq', 540, 1260);

        // Convert to Download
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const link = document.createElement('a');
        link.download = `بطاقة_تخرج_${state.name.replace(/\s+/g, '_')}_2026.jpg`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        downloadBtn.disabled = false;
        downloadBtn.innerHTML = `<span>✓</span><span>تم التنزيل بنجاح!</span>`;
        if (window.showIkToast) {
          window.showIkToast('🎉 تم حفظ بطاقة تخرجك بنجاح! شاركها الآن على ستوري انستغرام أو واتساب');
        }
        setTimeout(() => {
          downloadBtn.innerHTML = `<span>📸</span><span>تنزيل بطاقة تخرجي للستوري (Instagram / WhatsApp)</span>`;
        }, 3000);
      };

      img.onerror = () => {
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = `<span>📸</span><span>تنزيل بطاقة تخرجي للستوري (Instagram / WhatsApp)</span>`;
        alert('حدث خطأ أثناء تحميل صورة النموذج للتصدير.');
      };

      img.src = activeLayer ? activeLayer.src : (curColor ? curColor.front : 'static/assets/images/visualizer-burgundy.jpg');
    });

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]);
    }
  }

  // 6. Register PWA Service Worker
  function initPwa() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.warn('PWA: Service Worker registration skipped:', err);
        });
      });
    }
  }

  // Run on page load
  function init() {
    initWhatsAppConcierge();
    initColorVisualizer();
    initPwa();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


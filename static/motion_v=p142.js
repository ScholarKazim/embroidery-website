/* Khama — motion.js
   Mobile-first interactions for the landing page:
   - Scroll progress + reveal-on-scroll
   - Nav scroll-reveal (hero → scrolled state)
   - Image placeholder → real image swap
   - Embroidery editor live preview + counter
   - Sign-up modal (gated editor actions, Phase 1 stub — Phase 3 wires Firebase)
   - Cart stub (reads localStorage.cart count, updates badge)
   - WhatsApp pill visibility
*/

/* ===== Track sticky-nav height for hero subtraction ===== */
const navEl = document.querySelector('[data-nav]');
function syncNavH() {
  if (!navEl) return;
  document.documentElement.style.setProperty('--nav-h', navEl.offsetHeight + 'px');
}
syncNavH();
window.addEventListener('resize', syncNavH, { passive: true });

/* ===== Scroll progress (top bar) =====
   The max-scroll distance is cached and only re-measured on resize / load /
   fonts-ready, so the per-frame scroll handler never reads `scrollHeight`
   (a layout-flushing property). Each scroll frame then reads only window.scrollY
   — which does NOT force a reflow — keeping the bar in step without jank. */
const progress = document.querySelector('.scroll-progress');
let progressTicking = false;
let scrollMax = 0;
function measureScrollMax() {
  scrollMax = document.documentElement.scrollHeight - window.innerHeight;
}
function updateProgress() {
  const p = scrollMax > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollMax)) : 0;
  if (progress) progress.style.setProperty('--p', p.toFixed(4));
  progressTicking = false;
}
window.addEventListener('scroll', () => {
  if (!progressTicking) { requestAnimationFrame(updateProgress); progressTicking = true; }
}, { passive: true });
window.addEventListener('resize', () => { measureScrollMax(); updateProgress(); }, { passive: true });
window.addEventListener('load', () => { measureScrollMax(); updateProgress(); }, { once: true });
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { measureScrollMax(); updateProgress(); }).catch(() => {});
}
measureScrollMax();
updateProgress();

/* ===== Nav scroll-reveal: hero → scrolled =====
   While the hero is in view, nav state is "hero" (only wordmark visible).
   When the hero is scrolled past, nav state flips to "scrolled" (full bar).
*/
const heroEl = document.getElementById('hero');
if (heroEl && navEl && 'IntersectionObserver' in window) {
  const navIO = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      // When less than ~10% of hero is visible, treat as "scrolled past hero"
      navEl.dataset.navState = entry.isIntersecting && entry.intersectionRatio > 0.1 ? 'hero' : 'scrolled';
    }
  }, { threshold: [0, 0.1, 0.5, 1] });
  navIO.observe(heroEl);
} else if (navEl) {
  navEl.dataset.navState = 'scrolled';
}

/* ===== Reveal-on-scroll ===== */
const reveals = document.querySelectorAll('.reveal, .reveal-stagger');
if ('IntersectionObserver' in window && reveals.length) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
  reveals.forEach(el => io.observe(el));
} else {
  reveals.forEach(el => el.classList.add('in'));
}

/* ===== Image placeholder → real image swap =====
   Reads /assets/images/manifest.json if present (a JSON array of available IDs,
   each "id" or "id.ext"). Only probes IDs in the manifest, which keeps the
   network log quiet while no images exist yet. Without a manifest, no probing.

   To add an image:
     1. Drop the file at /assets/images/{id}.{jpg|png|webp}
     2. Add `"{id}.jpg"` (with extension) to manifest.json
*/
const probeCache = new Map();
function loadImageOnce(url) {
  if (probeCache.has(url)) return probeCache.get(url);
  const p = new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
  probeCache.set(url, p);
  return p;
}
async function loadImageManifest() {
  // Skip when no placeholders are on the page — saves a network round-trip
  // on inner pages (e.g. /قياس) that don't render any.
  if (!document.querySelector('.image-placeholder[data-prompt-id]')) return null;
  try {
    const res = await fetch('/assets/images/manifest.json', { cache: 'no-cache' });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    const map = new Map();
    for (const entry of data) {
      if (typeof entry !== 'string') continue;
      const m = entry.match(/^(.+?)\.(jpg|jpeg|png|webp|svg)$/i);
      const id = m ? m[1] : entry;
      const url = `/assets/images/${entry}` + (m ? '' : '.jpg') + '?v=p29';
      map.set(id, url);
    }
    return map;
  } catch { return null; }
}
// Prefer WebP when the browser can decode it; fall back to the same-name .jpg
// (which the probe verifies exists). Keeps the DOM as .image-placeholder > img,
// so no layout/CSS changes are needed.
let mjWebp = false;
const mjWebpReady = new Promise(resolve => {
  const probe = new Image();
  probe.onload = () => { mjWebp = probe.width > 0; resolve(); };
  probe.onerror = () => resolve();
  probe.src = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
});
loadImageManifest().then(async manifest => {
  if (!manifest || manifest.size === 0) return;
  await mjWebpReady;
  document.querySelectorAll('.image-placeholder[data-prompt-id]').forEach(async el => {
    const id = el.dataset.promptId;
    const url = manifest.get(id);
    if (!url) return;
    const ok = await loadImageOnce(url);
    if (!ok) return;
    const img = new Image();
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    if (mjWebp) {
      // If the .webp is missing for any reason, fall back to the verified .jpg.
      img.onerror = () => { img.onerror = null; img.src = url; };
      img.src = url.replace(/\.jpg(\?|$)/, '.webp$1');
    } else {
      img.src = url;
    }
    el.classList.add('has-image');
    el.innerHTML = '';
    el.appendChild(img);
  });
});

/* ===== Embroidery editor: live preview + counter + gated swaps ===== */
const editorInput = document.getElementById('editor-name');
const editorScarf = document.querySelector('.scarf-mock');
const stitchText  = document.querySelector('[data-stitch-text]');
const stitchCounter = document.querySelector('[data-stitch-counter]');
const editorActions = document.querySelector('.editor-actions');

function fmtNum(n) {
  return String(n);
}

const EDITOR_DRAFT_KEY = 'khama_editor_draft';
const EDITOR_FONTS = ['display', 'sans']; // serif display ↔ rounded sans
const EDITOR_THREADS = ['gold', 'silver'];

function readEditorDraft() {
  try {
    const raw = localStorage.getItem(EDITOR_DRAFT_KEY);
    if (!raw) return {};
    const d = JSON.parse(raw);
    return (d && typeof d === 'object') ? d : {};
  } catch { return {}; }
}
function writeEditorDraft(draft) {
  try { localStorage.setItem(EDITOR_DRAFT_KEY, JSON.stringify(draft)); } catch {}
}

function getEditorState() {
  const draft = readEditorDraft();
  return {
    name: editorInput ? editorInput.value.trim() : (draft.name || ''),
    thread: editorScarf ? (editorScarf.dataset.thread || 'gold') : (draft.thread || 'gold'),
    font:   editorScarf ? (editorScarf.dataset.font   || 'display') : (draft.font || 'display'),
  };
}
function applyEditorState(state) {
  if (!editorScarf) return;
  if (state.thread && EDITOR_THREADS.includes(state.thread)) editorScarf.dataset.thread = state.thread;
  if (state.font   && EDITOR_FONTS.includes(state.font))     editorScarf.dataset.font   = state.font;
  if (state.name && editorInput && !editorInput.value) editorInput.value = state.name;
  updateStitchPreview();
  refreshEditorActionLabels();
}
function refreshEditorActionLabels() {
  if (!editorActions) return;
  const state = getEditorState();
  // Mark active thread/font so the user sees what's currently applied.
  editorActions.querySelectorAll('.editor-action').forEach(btn => {
    const gate = btn.dataset.gate || '';
    if (gate === 'thread-gold')   btn.classList.toggle('is-active', state.thread === 'gold');
    if (gate === 'thread-silver') btn.classList.toggle('is-active', state.thread === 'silver');
    if (gate === 'font')          btn.classList.toggle('is-active', state.font   === 'sans');
  });
}
function updateStitchPreview() {
  if (!editorInput) return;
  const v = editorInput.value.trim();
  if (stitchText)    stitchText.textContent = v || 'اسمك هنا';
  if (stitchCounter) stitchCounter.textContent = `${fmtNum(v.length)} / ${fmtNum(24)}`;
  // Persist live; the user keeps their draft across reloads even before signup.
  const cur = readEditorDraft();
  cur.name = v;
  writeEditorDraft(cur);
}
if (editorInput) {
  editorInput.addEventListener('input', updateStitchPreview);
  // Restore prior draft on first paint.
  const draft = readEditorDraft();
  if (draft.name && !editorInput.value) editorInput.value = draft.name;
  updateStitchPreview();
}
if (editorScarf) applyEditorState(readEditorDraft());

function showEditorToast(msg) {
  const card = document.querySelector('.editor-card');
  if (!card) return;
  let toast = card.querySelector('.editor-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'editor-toast';
    card.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.remove('is-visible');
  void toast.offsetWidth;
  toast.classList.add('is-visible');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('is-visible'), 2400);
}

function applyEditorGate(reason) {
  if (!reason || !editorScarf) return;
  const draft = readEditorDraft();

  switch (reason) {
    case 'thread-gold':
      editorScarf.dataset.thread = 'gold';
      draft.thread = 'gold';
      writeEditorDraft(draft);
      showEditorToast('خيط ذهبي');
      break;
    case 'thread-silver':
      editorScarf.dataset.thread = 'silver';
      draft.thread = 'silver';
      writeEditorDraft(draft);
      showEditorToast('خيط فضي');
      break;
    case 'font': {
      const next = (editorScarf.dataset.font === 'sans') ? 'display' : 'sans';
      editorScarf.dataset.font = next;
      draft.font = next;
      writeEditorDraft(draft);
      showEditorToast(next === 'sans' ? 'خط حديث' : 'خط كلاسيكي');
      break;
    }
    case 'save': {
      const state = getEditorState();
      if (!state.name) { showEditorToast('اكتب اسمك أولاً'); return; }
      const designs = (function () {
        try {
          const raw = localStorage.getItem('khama_designs');
          const arr = raw ? JSON.parse(raw) : [];
          return Array.isArray(arr) ? arr : [];
        } catch { return []; }
      })();
      const design = { id: `d_${Date.now().toString(36)}`, ...state, createdAt: new Date().toISOString() };
      designs.push(design);
      try { localStorage.setItem('khama_designs', JSON.stringify(designs)); } catch {}
      showEditorToast('تم الحفظ');
      mirrorDesignToFirestore(design);
      break;
    }
    case 'share': {
      const state = getEditorState();
      const url = new URL('/products/scarf', window.location.origin);
      if (state.name)   url.searchParams.set('name', state.name);
      if (state.thread) url.searchParams.set('thread', state.thread);
      if (state.font)   url.searchParams.set('font', state.font);
      const link = url.toString();
      if (navigator.share) {
        navigator.share({ title: 'تصميمي على وشاح إبرة وخيط', text: state.name ? `شوف تصميمي: ${state.name}` : 'شوف تصميمي', url: link })
          .catch(() => {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(link).then(() => showEditorToast('انسخ الرابط')).catch(() => showEditorToast(link));
      } else {
        showEditorToast(link);
      }
      break;
    }
    default:
      break;
  }
  refreshEditorActionLabels();
}

/* ===== Editor action buttons (open to everyone, no signup required) ===== */
if (editorActions) {
  editorActions.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-editor-action]');
    if (!btn) return;
    applyEditorGate(btn.dataset.editorAction);
  });
}

// Mirror saved designs to Firestore (users/{uid}.savedDesigns) when authed.
// localStorage stays as the source of truth for guests / cross-page reads.
async function mirrorDesignToFirestore(design) {
  try {
    if (!window.KhamaFirebase) return;
    const fb = await window.KhamaFirebase.ready;
    if (!fb) return;
    const uid = window.KhamaSignup && window.KhamaSignup.uid && window.KhamaSignup.uid();
    if (!uid) return;
    const ref = fb.doc(fb.db, 'users', uid);
    await fb.setDoc(ref, {
      savedDesigns: fb.arrayUnion(design),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (e) {
    console.warn('[Khama] design mirror failed', e);
  }
}

/* Cart drawer + count badge are owned by cart.js (KhamaCart). */

/* ===== Capability gates ===== */
const fineHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ===== WhatsApp pill visibility (mobile) ===== */
const waPill = document.querySelector('.wa-pill');
if (waPill) {
  let lastVisible = false;
  const updateWa = () => {
    const visible = window.scrollY > window.innerHeight * 0.55;
    if (visible !== lastVisible) {
      waPill.classList.toggle('is-visible', visible);
      lastVisible = visible;
    }
  };
  window.addEventListener('scroll', updateWa, { passive: true });
  updateWa();
}

/* ===== Hero content height sync =====
   .hero-content overlaps the hero image's lower band via
   margin-top: -(--hero-content-h + --hero-lift). Keep the CSS var in sync
   with the measured height (it shifts when Thmanyah loads / on resize). */
(function initHero() {
  const hero    = document.querySelector('[data-hero]');
  const content = hero && hero.querySelector('[data-hero-content]');
  if (!hero || !content) return;

  const docRoot = document.documentElement;
  const measure = () => {
    const ch = content.offsetHeight;
    if (ch > 0) docRoot.style.setProperty('--hero-content-h', ch + 'px');
  };

  measure();
  if (document.readyState !== 'complete') {
    window.addEventListener('load', measure, { once: true });
  }
  window.addEventListener('resize', measure, { passive: true });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(measure).catch(() => {});
  }
})();

/* ===== Hero gallery: horizontal 3D "box" slider =====
   The photos glide along the inside of a dark box: flat on the back wall,
   bending around the creases onto two side walls that flare toward the
   viewer (the horizontal version of the vertical expo-box reference).

   Scene model (world units live on the back-wall plane, which the
   perspective projects at scale k = P/(P+D)):
     - back wall: plane z=-D spanning x ∈ [-F, +F]   (the two creases)
     - side walls: planes x=±F hinged at the creases, z ∈ [-D → viewer]
   Every photo exists once per face; all three copies are positioned from a
   single shared path coordinate s (s ∈ [-F,F] = on the back wall, s > F =
   distance along the right wall, s < -F = along the left wall). Faces clip
   at the creases (overflow:hidden), so a photo straddling a crease renders
   bent: its flat part on the back wall, the rest folded onto the side wall.

   Per-frame work is exclusively translate3d on pre-composited <img> layers —
   no layout, no paint, no per-frame rotation — so it stays at device fps.
   Auto-drifts; drag/swipe scrubs with momentum; loops forever. */
(function initHeroGallery() {
  const wrap = document.querySelector('[data-hero-gallery]');
  const stage = wrap && wrap.querySelector('[data-hg-stage]');
  if (!wrap || !stage) return;
  const track = stage.querySelector('[data-hg-track]');
  const sources = track ? Array.from(track.querySelectorAll('img')) : [];
  if (sources.length < 3) return;

  // Reduced motion: keep the native scroll-snap strip (no imposed motion).
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const N = sources.length;
  const K = 0.7;               // back-plane projection scale = P/(P+D)
  const DRIFT_SECS = 3.6;      // auto-drift: one photo passes every ~3.6s

  // --- Build the scene -------------------------------------------------------
  const scene = document.createElement('div');
  scene.className = 'hg-scene';
  const faceBack  = document.createElement('div');
  const faceRight = document.createElement('div');
  const faceLeft  = document.createElement('div');
  faceBack.className  = 'hg-face hg-face--back';
  faceRight.className = 'hg-face hg-face--right';
  faceLeft.className  = 'hg-face hg-face--left';

  const mkCopy = (src, wall) => {
    const img = src.cloneNode(false);
    img.removeAttribute('loading');
    img.removeAttribute('id');
    img.draggable = false;
    img.style.visibility = 'hidden';
    if (wall) { img.setAttribute('aria-hidden', 'true'); img.alt = ''; }
    return img;
  };
  // copies[i] = { b, r, l } — one <img> per face, + cached shown flags.
  const copies = sources.map((src) => {
    const c = {
      b: mkCopy(src, false), r: mkCopy(src, true), l: mkCopy(src, true),
      bOn: false, rOn: false, lOn: false
    };
    faceBack.appendChild(c.b); faceRight.appendChild(c.r); faceLeft.appendChild(c.l);
    return c;
  });
  scene.appendChild(faceLeft);
  scene.appendChild(faceBack);
  scene.appendChild(faceRight);
  stage.appendChild(scene);
  track.remove();

  // Swipe affordance: a quiet "اسحب" pill with pulsing chevrons, dismissed
  // for good the first time the user drags or scrolls the gallery.
  const cue = document.createElement('div');
  cue.className = 'hg-cue';
  cue.setAttribute('aria-hidden', 'true');
  cue.innerHTML = '<span class="hg-cue__chev">&#8249;</span><span>اسحب</span><span class="hg-cue__chev hg-cue__chev--r">&#8250;</span>';
  stage.appendChild(cue);
  const dismissCue = () => cue.classList.add('is-done');

  // --- Geometry (recomputed on resize) ---------------------------------------
  let P = 0, D = 0, F = 0, W = 0, H = 0, S = 1, C = 1, wallLen = 0, hideS = 0;

  const measure = () => {
    const vw = stage.clientWidth || 1;
    const vh = stage.clientHeight || 1;
    // Short perspective distance = aggressive distortion: the folded side
    // panels kink hard at the crease and balloon as they near the viewer.
    P = Math.max(440, vw * 0.55);
    D = P * (1 - K) / K;

    // Screen-space targets → world units on the back plane (÷K).
    const imgScreenW = Math.min(0.8 * vw, 480);
    W = imgScreenW / K;
    H = W / 0.85;                                    // slightly squarer than the
                                                     // 4:5 sources (cover-cropped)
    // Side strips = 7% of the viewport each: the folded panels are thin,
    // hard-sheared slivers. The flat zone (86%) fits the center photo with
    // its neighbours peeking flat before they bend.
    F = (0.43 * vw) / K;
    const G = Math.max(10, vw * 0.02) / K;           // gap between photos
    const prevS = S;
    S = W + G;
    C = N * S;                                       // loop cycle length

    // Depth at which the side-wall plane's projection crosses the viewport
    // edge (a wall point at world x=F, depth z projects at F·P/(P−z); solve
    // F·P/(P−z) = vw/2). Past it + half a photo, a wall copy is off-screen.
    const zOff = P * (1 - (2 * F) / vw);
    hideS = F + W / 2 + D + zOff + 32;
    wallLen = D + Math.max(zOff, 0) + W;

    // Keep the loop position stable across resizes.
    offset = offset * (S / prevS);

    const cx = vw / 2, cy = vh / 2;
    scene.style.perspective = P.toFixed(1) + 'px';

    // Faces are taller than the photos so the soft drop shadows have room
    // to paint instead of being clipped at the face edge.
    const PAD = 90;
    const sizeFace = (el, left, width) => {
      el.style.left = left.toFixed(2) + 'px';
      el.style.top = (cy - H / 2 - PAD).toFixed(2) + 'px';
      el.style.width = width.toFixed(2) + 'px';
      el.style.height = (H + PAD * 2).toFixed(2) + 'px';
    };
    sizeFace(faceBack, cx - F, 2 * F);
    faceBack.style.transform = 'translateZ(' + (-D).toFixed(2) + 'px)';

    sizeFace(faceRight, cx + F, wallLen);
    faceRight.style.transformOrigin = 'left center';
    faceRight.style.transform = 'translateZ(' + (-D).toFixed(2) + 'px) rotateY(-90deg)';

    sizeFace(faceLeft, cx - F - wallLen, wallLen);
    faceLeft.style.transformOrigin = 'right center';
    faceLeft.style.transform = 'translateZ(' + (-D).toFixed(2) + 'px) rotateY(90deg)';

    copies.forEach((c) => {
      [c.b, c.r, c.l].forEach((img) => {
        img.style.width = W.toFixed(2) + 'px';
        img.style.height = H.toFixed(2) + 'px';
        img.style.top = PAD + 'px';
      });
    });
  };

  // --- Per-frame copy placement ----------------------------------------------
  // Each copy independently picks the path representative (s ≡ base mod C)
  // nearest its own face window, so a photo can wrap onto the far wall while
  // still sliding off the near one — the loop never pops.
  const wrapNear = (base, center) => base - Math.round((base - center) / C) * C;

  const place = (img, on, x, key, c) => {
    if (on) {
      img.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
      if (!c[key]) { img.style.visibility = 'visible'; c[key] = true; }
    } else if (c[key]) {
      img.style.visibility = 'hidden'; c[key] = false;
    }
  };

  let offset = 0;

  const layout = () => {
    for (let i = 0; i < N; i++) {
      const c = copies[i];
      const base = i * S + offset;

      // Back wall: window [-F − W/2, F + W/2]
      const sb = wrapNear(base, 0);
      place(c.b, sb > -F - W / 2 && sb < F + W / 2, F + sb - W / 2, 'bOn', c);

      // Right wall: enters at the crease (s = F − W/2), leaves past the
      // viewport edge (s = hideS).
      const sr = wrapNear(base, (F + hideS) / 2);
      place(c.r, sr > F - W / 2 && sr < hideS, sr - F - W / 2, 'rOn', c);

      // Left wall (mirror).
      const sl = wrapNear(base, -(F + hideS) / 2);
      place(c.l, sl < -F + W / 2 && sl > -hideS, sl + F + wallLen - W / 2, 'lOn', c);
    }
  };

  // --- Motion driver -----------------------------------------------------------
  let baseVel = 0;             // auto-drift, world px/s (photos travel left → right)
  let vel = 0;                 // current velocity (drift ⇄ momentum blend)
  let dragging = false;
  let raf = 0, lastT = 0, inView = false;

  const active = () => inView && !document.hidden;

  const tick = (t) => {
    raf = 0;
    const dt = Math.min(Math.max((t - lastT) / 1000, 0), 0.05);
    lastT = t;
    if (!dragging) {
      // Ease momentum back into the steady drift.
      vel += (baseVel - vel) * (1 - Math.exp(-dt * 2.4));
      offset += vel * dt;
    }
    layout();
    if (active()) raf = requestAnimationFrame(tick);
  };
  const start = () => {
    if (!raf && active()) { lastT = performance.now(); raf = requestAnimationFrame(tick); }
  };

  // --- Input: drag / swipe with momentum ---------------------------------------
  let lastX = 0, lastMoveT = 0, dragVel = 0;
  scene.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary) return;
    dismissCue();
    dragging = true;
    dragVel = 0; vel = 0;
    lastX = e.clientX; lastMoveT = performance.now();
    scene.classList.add('is-dragging');
    try { scene.setPointerCapture(e.pointerId); } catch {}
    start();
  });
  scene.addEventListener('pointermove', (e) => {
    if (!dragging || !e.isPrimary) return;
    const now = performance.now();
    const dx = (e.clientX - lastX) / K;     // finger px → world px on the back plane
    lastX = e.clientX;
    offset += dx;                            // photos follow the finger
    const dtm = Math.max((now - lastMoveT) / 1000, 0.001);
    lastMoveT = now;
    dragVel = dragVel * 0.6 + (dx / dtm) * 0.4;
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    scene.classList.remove('is-dragging');
    const cap = 3.5 * S;
    vel = Math.max(-cap, Math.min(cap, dragVel));   // fling momentum
  };
  scene.addEventListener('pointerup', endDrag);
  scene.addEventListener('pointercancel', endDrag);

  // Horizontal trackpad / shift-wheel scrubbing.
  scene.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    dismissCue();
    offset -= e.deltaX / K;
    vel = 0;
    start();
  }, { passive: true });

  // --- Lifecycle ----------------------------------------------------------------
  measure();
  baseVel = S / DRIFT_SECS;
  vel = baseVel;
  layout();

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting;
      if (inView) start();
    }).observe(wrap);
  } else {
    inView = true; start();
  }
  document.addEventListener('visibilitychange', start);

  window.addEventListener('resize', () => {
    measure();
    baseVel = S / DRIFT_SECS;
    layout();
  }, { passive: true });

  // Warm (fetch + decode) all gallery photos during idle so none decodes
  // mid-glide — a main-thread decode reads as a hitch in the motion.
  const warm = () => copies.forEach((c) => { if (c.b.decode) c.b.decode().catch(() => {}); });
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
  if (document.readyState === 'complete') idle(warm);
  else window.addEventListener('load', () => idle(warm), { once: true });
})();

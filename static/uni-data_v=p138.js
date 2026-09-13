/* Khama — uni-data.js
 *
 * Single source of truth for the university + college picker used by the signup
 * modal (and anywhere else a uni/college needs choosing).
 *
 * Two layers:
 *   1. A hardcoded SEED of the approved launch pairs. This renders instantly,
 *      works offline, and means the dropdown never needs an anonymous Firestore
 *      read on first paint.
 *   2. An async merge of every `status == 'approved'` doc from the Firestore
 *      `universities` / `colleges` collections — so anything the owner approves
 *      in /admin appears in the dropdown immediately, no redeploy. Falls back to
 *      the seed if Firestore is unavailable.
 *
 * Custom entries the visitor types ("لا ترى جامعتك/كليتك؟") are written as
 * `status:'pending'` docs via submitCustom(); they only enter the dropdown once
 * the owner approves them.
 *
 * Public API on window.KhamaUni:
 *   universityOptions()                 -> [{id, name}]
 *   collegesFor(universityId)           -> [{id, name, universityId}]
 *   nameOfUni(id) / nameOfCollege(id)   -> string
 *   uniIdFor(name) / collegeIdFor(uniId,name) -> deterministic id
 *   buildPickerInto(container, opts)    -> renders the dependent selects + custom inputs
 *   readSelection(container)            -> {universityId, university, collegeId, college, isCustom, empty}
 *   submitCustom(fb, {uniName, uniId, collegeName, uid}) -> async {universityId, collegeId}
 *   ready                               -> Promise resolved once the approved merge finished (or failed)
 */
(function () {
  'use strict';

  /* =========================== Identity (see taxonomy.js) =========================== */
  // Canonical id math lives in taxonomy.js (window.KhamaHash), loaded first. These
  // are thin delegates so uni/college ids stay byte-identical to every other page.
  const H = window.KhamaHash;
  const uniIdFor    = H.uniIdFor;
  const collegeIdFor = H.collegeIdFor;
  const normForUni   = H.normForUni;

  const CUSTOM = '__custom__';

  /* =========================== Seed (approved launch list) =========================== */
  const SEED = [
    { uni: 'جامعة كربلاء', colleges: ['كلية علوم الحاسوب وتكنولوجيا المعلومات', 'كلية الصيدلة', 'كلية الطب', 'كلية الهندسة', 'كلية العلوم'] },
    { uni: 'جامعة النهرين',   colleges: ['كلية الصيدلة', 'كلية الطب', 'كلية الحقوق'] },
    { uni: 'جامعة الفراهيدي', colleges: ['كلية الصيدلة'] },
  ];

  // id -> {id, name}
  const uniById = new Map();
  // id -> {id, name, universityId}
  const collegeById = new Map();

  function upsertUni(id, name) {
    if (!id || !name) return;
    uniById.set(id, { id, name: String(name) });
  }
  function upsertCollege(id, universityId, name) {
    if (!id || !name) return;
    collegeById.set(id, { id, name: String(name), universityId: String(universityId || '') });
  }

  SEED.forEach(row => {
    const uid = uniIdFor(row.uni);
    upsertUni(uid, row.uni);
    row.colleges.forEach(c => upsertCollege(collegeIdFor(uid, c), uid, c));
  });

  /* =========================== Directory + signup counts =========================== */
  // window.KhamaUniDirectory (uni-directory.js, loaded just before us) is a static
  // snapshot of every university + college students have actually signed up with,
  // plus per-entry student counts — baked from the CSV export because the private
  // `users` collection can't be read at signup time. It powers the searchable
  // picker's suggestions and the "X students from your university" hint. Firestore
  // `approved` docs still merge on top (see ready), so newly-approved schools show
  // up without regenerating the snapshot.
  const uniCountById = new Map();      // universityId -> signup count
  const collegeCountById = new Map();  // collegeId    -> signup count
  (function mergeDirectory() {
    const dir = window.KhamaUniDirectory;
    if (!dir || !Array.isArray(dir.unis)) return;
    dir.unis.forEach(u => {
      if (!u || !u.id || !u.name) return;
      upsertUni(u.id, u.name);
      if (typeof u.count === 'number') uniCountById.set(u.id, u.count);
      (u.colleges || []).forEach(c => {
        if (!c || !c.id || !c.name) return;
        upsertCollege(c.id, u.id, c.name);
        if (typeof c.count === 'number') collegeCountById.set(c.id, c.count);
      });
    });
  })();
  function studentCountForUni(id)     { return uniCountById.get(id) || 0; }
  function studentCountForCollege(id) { return collegeCountById.get(id) || 0; }

  /* =========================== Lookups =========================== */
  function universityOptions() {
    return Array.from(uniById.values());
  }
  function collegesFor(universityId) {
    return Array.from(collegeById.values()).filter(c => c.universityId === universityId);
  }
  function nameOfUni(id)     { const u = uniById.get(id);     return u ? u.name : ''; }
  function nameOfCollege(id) { const c = collegeById.get(id); return c ? c.name : ''; }
  function findUniByName(name) {
    const id = uniIdFor(name);
    return uniById.has(id) ? uniById.get(id) : null;
  }

  /* =========================== Async approved merge =========================== */
  const mounted = new Set(); // refill callbacks for already-rendered pickers
  function notifyMounted() { mounted.forEach(fn => { try { fn(); } catch {} }); }

  const ready = (async () => {
    const fb = window.KhamaFirebase ? await window.KhamaFirebase.ready : null;
    if (!fb) return; // keep seed
    try {
      const [uSnap, cSnap] = await Promise.all([
        fb.getDocs(fb.query(fb.collection(fb.db, 'universities'), fb.where('status', '==', 'approved'))),
        fb.getDocs(fb.query(fb.collection(fb.db, 'colleges'),     fb.where('status', '==', 'approved'))),
      ]);
      uSnap.forEach(d => upsertUni(d.id, (d.data() || {}).name));
      cSnap.forEach(d => { const x = d.data() || {}; upsertCollege(d.id, x.universityId, x.name); });
      notifyMounted();
    } catch (e) {
      console.warn('[Khama] uni-data approved merge failed, using seed only', e);
    }
  })();

  /* =========================== Picker UI =========================== */
  // A searchable university/college picker (same interaction as the /admin
  // الدفعات browser): the visitor types, a suggestion list appears (each row shows
  // how many students already signed up from it), and picking one reveals the
  // college search scoped to that university. "لا ترى جامعتك؟ أضِفها" drops to a
  // free-text mode that lands a pending suggestion for the owner (submitCustom).
  //
  // Selection state lives in container.dataset so readSelection() (called by
  // signup.js) can stay a pure DOM read:
  //   pickMode : ''  -> a listed university (or nothing yet)
  //              'customUni' -> brand-new university, both names free text
  //   uniId / uniName        -> the chosen listed university
  //   colCustom = '1'        -> new college under a listed university (free text)
  //   colId / colName        -> the chosen listed college
  function fmtCount(n) {
    try { return Number(n).toLocaleString('ar-EG'); } catch { return String(n); }
  }
  function comboItemsHTML(rows, kind) {
    return rows.map(r => {
      const count = kind === 'uni' ? studentCountForUni(r.id) : studentCountForCollege(r.id);
      const badge = count > 0 ? `<span class="uni-combo-count">${fmtCount(count)}</span>` : '';
      return `<li class="uni-combo-item" data-id="${escapeAttr(r.id)}" role="option">`
        + `<span class="uni-combo-name">${escapeHTML(r.name)}</span>${badge}</li>`;
    }).join('');
  }

  // opts.value (optional): { universityId, collegeId } to preselect (shared-link).
  function buildPickerInto(container, opts) {
    if (!container) return;
    const pre = (opts && opts.value) || {};
    container.classList.add('uni-pick');
    // Reset any prior selection state (buildPickerInto may be called again).
    ['pickMode', 'uniId', 'uniName', 'colCustom', 'colId', 'colName'].forEach(k => delete container.dataset[k]);
    container.innerHTML = `
      <div class="uni-pick-field uni-combo" data-uni-combo>
        <label class="uni-combo-lab">
          <span>الجامعة</span>
          <input type="text" class="uni-combo-input" data-uni-input autocomplete="off"
                 role="combobox" aria-expanded="false" aria-autocomplete="list"
                 placeholder="ابحث عن اسم جامعتك" />
          <ul class="uni-combo-list" data-uni-list hidden></ul>
        </label>
        <p class="uni-pick-count" data-uni-count hidden></p>
        <button type="button" class="uni-pick-add" data-uni-add>لا ترى جامعتك؟ أضِفها</button>
      </div>

      <label class="uni-pick-field" data-uni-custom-wrap hidden>
        <span>اسم جامعتك</span>
        <input type="text" data-uni-custom autocomplete="off" placeholder="اكتب اسم جامعتك" />
        <button type="button" class="uni-pick-back" data-uni-back>‹ رجوع لقائمة الجامعات</button>
      </label>

      <div class="uni-pick-field uni-combo" data-college-combo hidden>
        <label class="uni-combo-lab">
          <span>الكلية</span>
          <input type="text" class="uni-combo-input" data-college-input autocomplete="off"
                 role="combobox" aria-expanded="false" aria-autocomplete="list"
                 placeholder="ابحث عن اسم كليتك" />
          <ul class="uni-combo-list" data-college-list hidden></ul>
        </label>
        <button type="button" class="uni-pick-add" data-college-add>لا ترى كليتك؟ أضِفها</button>
      </div>

      <label class="uni-pick-field" data-college-custom-wrap hidden>
        <span>اسم كليتك</span>
        <input type="text" data-college-custom autocomplete="off" placeholder="اكتب اسم كليتك" />
        <button type="button" class="uni-pick-back" data-college-back hidden>‹ رجوع لقائمة الكليات</button>
      </label>
    `;

    const uniCombo    = container.querySelector('[data-uni-combo]');
    const uniInput    = container.querySelector('[data-uni-input]');
    const uniList     = container.querySelector('[data-uni-list]');
    const uniCount    = container.querySelector('[data-uni-count]');
    const uniAdd      = container.querySelector('[data-uni-add]');
    const uniCustomWrap = container.querySelector('[data-uni-custom-wrap]');
    const uniCustom   = container.querySelector('[data-uni-custom]');
    const uniBack     = container.querySelector('[data-uni-back]');
    const colCombo    = container.querySelector('[data-college-combo]');
    const colInput    = container.querySelector('[data-college-input]');
    const colList     = container.querySelector('[data-college-list]');
    const colAdd      = container.querySelector('[data-college-add]');
    const colCustomWrap = container.querySelector('[data-college-custom-wrap]');
    const colCustom   = container.querySelector('[data-college-custom]');
    const colBack     = container.querySelector('[data-college-back]');

    const emitChange = () => { try { container.dispatchEvent(new Event('change', { bubbles: true })); } catch {} };

    /* ---- university search ---- */
    function renderUniSuggestions() {
      const nq = normForUni(uniInput.value);
      let rows = universityOptions();
      if (nq) rows = rows.filter(u => normForUni(u.name).includes(nq));
      rows = rows.slice().sort((a, b) => studentCountForUni(b.id) - studentCountForUni(a.id)).slice(0, 60);
      uniList.innerHTML = comboItemsHTML(rows, 'uni');
      const open = rows.length > 0;
      uniList.hidden = !open;
      uniInput.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    function clearUniSelection() {
      delete container.dataset.uniId; delete container.dataset.uniName;
      uniCount.hidden = true; uniCount.textContent = '';
      colCombo.hidden = true; colInput.value = '';
      colList.hidden = true; colCustomWrap.hidden = true;
      delete container.dataset.colId; delete container.dataset.colName; delete container.dataset.colCustom;
    }
    function selectUni(id) {
      const name = nameOfUni(id) || id;
      container.dataset.pickMode = '';
      container.dataset.uniId = id;
      container.dataset.uniName = name;
      uniInput.value = name;
      uniList.hidden = true;
      uniInput.setAttribute('aria-expanded', 'false');
      const n = studentCountForUni(id);
      if (n > 0) {
        uniCount.textContent = `🎓 ${fmtCount(n)} طالب من جامعتك سجّلوا قبلك`;
        uniCount.hidden = false;
      } else { uniCount.hidden = true; }
      // Reveal the college search scoped to this university.
      delete container.dataset.colId; delete container.dataset.colName; delete container.dataset.colCustom;
      colInput.value = ''; colList.hidden = true; colCustomWrap.hidden = true;
      colBack.hidden = true;
      colCombo.hidden = false;
      emitChange();
    }

    uniInput.addEventListener('focus', renderUniSuggestions);
    uniInput.addEventListener('input', () => { clearUniSelection(); renderUniSuggestions(); emitChange(); });
    // mousedown (not click) so the pick registers before the input's blur hides the list.
    uniList.addEventListener('mousedown', (e) => {
      const li = e.target.closest('[data-id]');
      if (!li) return;
      e.preventDefault();
      selectUni(li.dataset.id);
    });
    uniInput.addEventListener('blur', () => setTimeout(() => {
      uniList.hidden = true; uniInput.setAttribute('aria-expanded', 'false');
    }, 150));

    /* ---- brand-new university (free text) ---- */
    uniAdd.addEventListener('click', () => {
      container.dataset.pickMode = 'customUni';
      clearUniSelection();
      uniInput.value = '';
      uniCombo.hidden = true;
      uniCustomWrap.hidden = false;
      colCustomWrap.hidden = false; // both names are free text
      colBack.hidden = true;
      try { uniCustom.focus(); } catch {}
      emitChange();
    });
    uniBack.addEventListener('click', () => {
      container.dataset.pickMode = '';
      uniCustom.value = ''; colCustom.value = '';
      uniCustomWrap.hidden = true; colCustomWrap.hidden = true;
      uniCombo.hidden = false;
      try { uniInput.focus(); } catch {}
      emitChange();
    });

    /* ---- college search (scoped to the chosen university) ---- */
    function renderColSuggestions() {
      const uniId = container.dataset.uniId || '';
      if (!uniId) { colList.hidden = true; return; }
      const nq = normForUni(colInput.value);
      let rows = collegesFor(uniId);
      if (nq) rows = rows.filter(c => normForUni(c.name).includes(nq));
      rows = rows.slice().sort((a, b) => studentCountForCollege(b.id) - studentCountForCollege(a.id)).slice(0, 60);
      colList.innerHTML = comboItemsHTML(rows, 'college');
      const open = rows.length > 0;
      colList.hidden = !open;
      colInput.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    function selectCol(id) {
      container.dataset.colId = id;
      container.dataset.colName = nameOfCollege(id) || id;
      delete container.dataset.colCustom;
      colInput.value = nameOfCollege(id) || id;
      colList.hidden = true;
      colInput.setAttribute('aria-expanded', 'false');
      colCustomWrap.hidden = true;
      emitChange();
    }
    colInput.addEventListener('focus', renderColSuggestions);
    colInput.addEventListener('input', () => {
      delete container.dataset.colId; delete container.dataset.colName;
      renderColSuggestions(); emitChange();
    });
    colList.addEventListener('mousedown', (e) => {
      const li = e.target.closest('[data-id]');
      if (!li) return;
      e.preventDefault();
      selectCol(li.dataset.id);
    });
    colInput.addEventListener('blur', () => setTimeout(() => {
      colList.hidden = true; colInput.setAttribute('aria-expanded', 'false');
    }, 150));

    /* ---- new college under a listed university (free text) ---- */
    colAdd.addEventListener('click', () => {
      container.dataset.colCustom = '1';
      delete container.dataset.colId; delete container.dataset.colName;
      colCombo.hidden = true;
      colCustomWrap.hidden = false;
      colBack.hidden = false;
      try { colCustom.focus(); } catch {}
      emitChange();
    });
    colBack.addEventListener('click', () => {
      delete container.dataset.colCustom;
      colCustom.value = '';
      colCustomWrap.hidden = true;
      colCombo.hidden = false;
      try { colInput.focus(); } catch {}
      emitChange();
    });

    // Preselect from a shared-link value (ids -> displayed names).
    if (pre.universityId && uniById.has(pre.universityId)) {
      selectUni(pre.universityId);
      if (pre.collegeId && collegeById.has(pre.collegeId)) selectCol(pre.collegeId);
    }
  }

  function readSelection(container) {
    if (!container) return { empty: true, isCustom: false, university: '', college: '', universityId: '', collegeId: '' };
    const d = container.dataset;
    const uniCustom = container.querySelector('[data-uni-custom]');
    const colCustom = container.querySelector('[data-college-custom]');

    // Brand-new university: both names are free text.
    if (d.pickMode === 'customUni') {
      const u = uniCustom ? uniCustom.value.trim() : '';
      const c = colCustom ? colCustom.value.trim() : '';
      return { universityId: '', university: u, collegeId: '', college: c, isCustom: true, customUni: true, empty: !(u && c) };
    }

    const uniId = d.uniId || '';
    if (!uniId) {
      return { universityId: '', university: '', collegeId: '', college: '', isCustom: false, empty: true };
    }
    const uniName = d.uniName || nameOfUni(uniId);

    // New college under a listed university (free text).
    if (d.colCustom === '1') {
      const c = colCustom ? colCustom.value.trim() : '';
      return { universityId: uniId, university: uniName, collegeId: '', college: c, isCustom: true, customCollege: true, empty: !c };
    }

    const colId = d.colId || '';
    if (!colId) {
      return { universityId: uniId, university: uniName, collegeId: '', college: '', isCustom: false, empty: true };
    }
    return { universityId: uniId, university: uniName, collegeId: colId, college: d.colName || nameOfCollege(colId), isCustom: false, empty: false };
  }

  /* =========================== Custom submission =========================== */
  // Writes pending docs for whatever the visitor typed. Must be called while
  // authed (Firestore rules require request.auth on create). Idempotent: two
  // students from the same new class produce the same deterministic ids.
  async function submitCustom(fb, info) {
    if (!fb) return { universityId: info.uniId || '', collegeId: '' };
    const now = new Date().toISOString();
    const uid = info.uid || (fb.auth.currentUser && fb.auth.currentUser.uid) || '';
    let universityId = info.uniId || '';
    let collegeId = '';

    try {
      if (info.uniName) {
        universityId = uniIdFor(info.uniName);
        await fb.setDoc(fb.doc(fb.db, 'universities', universityId), {
          name: info.uniName, status: 'pending', requestedBy: uid, createdAt: now,
        }, { merge: true });
        // also keep it locally so the picker can show it for this session
        upsertUni(universityId, info.uniName);
      }
      if (info.collegeName) {
        collegeId = collegeIdFor(universityId, info.collegeName);
        await fb.setDoc(fb.doc(fb.db, 'colleges', collegeId), {
          name: info.collegeName, universityId, status: 'pending', requestedBy: uid, createdAt: now,
        }, { merge: true });
        upsertCollege(collegeId, universityId, info.collegeName);
      }
    } catch (e) {
      console.warn('[Khama] submitCustom pending write failed', e);
    }
    return { universityId, collegeId };
  }

  /* =========================== Helpers =========================== */
  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function escapeAttr(s) { return escapeHTML(s); }

  /* =========================== Public API =========================== */
  window.KhamaUni = {
    CUSTOM,
    ready,
    universityOptions,
    collegesFor,
    nameOfUni,
    nameOfCollege,
    uniIdFor,
    collegeIdFor,
    findUniByName,
    studentCountForUni,
    studentCountForCollege,
    buildPickerInto,
    readSelection,
    submitCustom,
  };
})();

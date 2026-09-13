/* Khama — signup.js
 *
 * Auth boundary for the whole site. Two account types:
 *
 *   - Student (default): phone number + password. No SMS — the phone is the
 *     identity (one account per phone) and is stored as a synthetic Firebase
 *     email (`<digits>@phone.khama.app`) behind the scenes. Students can vote
 *     immediately once they join their class (no rep approval).
 *   - Class rep: Firebase Phone Auth (SMS OTP). The "أنا ممثل الدفعة" toggle in
 *     the signup modal switches to the OTP path. Only the rep verifies the number.
 *
 * University/College are chosen via the shared window.KhamaUni picker (approved
 * list + "لا ترى جامعتك/كليتك؟" custom entry that lands pending for the owner).
 *
 * Fallback mode (no Firebase config) keeps a localStorage-only flow for dev/CI.
 *
 * Public API on window.KhamaSignup (stable across modes):
 *   open(reason, {mode})  — show the modal ('signup' | 'signin')
 *   close()               — hide the modal
 *   user()                — sync: cached user object or null
 *   uid()                 — sync: Firebase uid or null
 *   setUser(u)            — manual merge (used by /class join-preview)
 *   clearUser()           — sign out
 *   startSignup(p,reason) — open the modal pre-filled (legacy helper)
 *   ready                 — Promise resolved once auth state is first known
 *   wireGates(root)       — wire [data-gate] buttons to open the modal
 *
 * Events dispatched on window (contract unchanged — class.js depends on it):
 *   khama:signin {detail:{user, reason}}  — fresh signup or first sign-in
 *   khama:user-change {detail:{user}}     — user object replaced (incl. sign-out)
 *   khama:gate {detail:{reason, target}}  — gated click while already signed-in
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'khama_user';

  /* ============== Phone normalization (Iraq) ============== */
  function normalizePhoneIQ(raw) {
    if (!raw) return '';
    const ARABIC = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
    let s = String(raw).split('').map(c => ARABIC[c] != null ? ARABIC[c] : c).join('');
    s = s.replace(/[\s\-()]/g, '');
    if (!s) return '';
    if (s.startsWith('+'))    return s;
    if (s.startsWith('00'))   return '+' + s.slice(2);
    if (s.startsWith('964'))  return '+' + s;
    if (s.startsWith('0'))    return '+964' + s.slice(1);
    if (s.startsWith('7'))    return '+964' + s;
    return '+' + s;
  }

  function isEmail(s) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || '').trim()); }

  /* ============== Class group hashing (see taxonomy.js) ============== */
  // The signup modal appears on pages that don't load class.js, so it still needs
  // groupIdFor — but the derivation now lives in one place (window.KhamaHash,
  // loaded first) instead of being copy-pasted. Same id, no drift.
  function groupIdFor(university, college, year) {
    return window.KhamaHash.groupIdFor(university, college, year);
  }

  // Students authenticate with phone + password. Firebase email/password needs an
  // email, so we derive a stable synthetic one from the normalized phone digits.
  // One phone → one account → one vote. The student never sees this address.
  const STUDENT_EMAIL_DOMAIN = 'phone.khama.app';
  function studentEmail(phoneRaw) {
    const digits = normalizePhoneIQ(phoneRaw).replace(/\D/g, '');
    return digits ? digits + '@' + STUDENT_EMAIL_DOMAIN : '';
  }
  // Resolve a sign-in identifier: a real email (e.g. the site owner/admin) is used
  // as-is; anything else is treated as a phone and mapped to the synthetic email.
  function loginIdFor(raw) {
    const s = String(raw || '').trim();
    return isEmail(s) ? s : studentEmail(s);
  }
  function isStudentEmail(s) { return /@(phone|class)\.khama\.app$/i.test(String(s || '')); }
  // Keep the synthetic student email out of the profile: real emails pass through,
  // synthetic ones resolve to '' (email) and to their phone digits (phone).
  function realEmailOf(s) { return isStudentEmail(s) ? '' : (s || ''); }
  function phoneFromStudentEmail(s) {
    if (!/@phone\.khama\.app$/i.test(String(s || ''))) return '';
    const digits = String(s).split('@')[0].replace(/\D/g, '');
    return digits ? '+' + digits : '';
  }

  /* ============== Local cache ============== */
  function readLocalUser() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const u = JSON.parse(raw);
      return (u && typeof u === 'object' && u.name) ? u : null;
    } catch { return null; }
  }
  function writeLocalUser(u) {
    try {
      if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
      else   localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  let currentUser = window.KhamaFirebase?.hasConfig ? null : readLocalUser();
  let fb = null;
  let authMutation = false;
  let authGeneration = 0;
  let inviteContext = null;
  let submitting = false;
  let confirmationResult = null;
  let recaptcha = null;

  function fireUserChange() {
    window.dispatchEvent(new CustomEvent('khama:user-change', { detail: { user: currentUser } }));
  }

  /* ============== Firebase boot ============== */
  async function processAuthUser(user) {
    if (authMutation) return;
    const generation = ++authGeneration;
    if (!user || user.isAnonymous) {
      currentUser = null;
      writeLocalUser(currentUser);
      fireUserChange();
      return;
    }
    // Never merge a previous person's cached profile into this Firebase UID.
    if (currentUser?.uid !== user.uid) currentUser = null;
    try {
      const snap = await fb.getDoc(fb.doc(fb.db, 'users', user.uid));
      if (generation !== authGeneration || authMutation || fb.auth.currentUser?.uid !== user.uid) return;
      if (snap.exists()) {
        const data = snap.data();
        currentUser = {
          uid:          user.uid,
          role:         data.role         || currentUser?.role || (user.phoneNumber ? 'rep' : 'student'),
          name:         data.name         || currentUser?.name       || '',
          university:   data.university   || currentUser?.university || '',
          college:      data.college      || currentUser?.college    || '',
          year:         data.year         || currentUser?.year       || '',
          universityId: data.universityId || currentUser?.universityId || '',
          collegeId:    data.collegeId    || currentUser?.collegeId    || '',
          email:        data.email        || realEmailOf(user.email) || currentUser?.email || '',
          phone:        data.phone        || user.phoneNumber || phoneFromStudentEmail(user.email) || '',
          pendingPlacement: data.pendingPlacement || false,
          measurements: data.measurements || null,
          savedDesigns: data.savedDesigns || [],
          groupId: data.groupId || '', loginClassId: data.loginClassId || '', loginMethod: data.loginMethod || '',
          createdAt:    data.createdAt    || new Date().toISOString(),
        };
      } else {
        currentUser = null;
      }
    } catch (e) {
      console.warn('[Khama] users doc fetch failed', e);
      if (generation !== authGeneration || authMutation) return;
      currentUser = null;
    }
    writeLocalUser(currentUser);
    fireUserChange();
  }

  const readyPromise = (async () => {
    if (window.KhamaFirebase) fb = await window.KhamaFirebase.ready;
    if (!fb) {
      if (window.KhamaFirebase?.hasConfig) { currentUser = null; writeLocalUser(null); }
      return;
    }

    if (typeof fb.auth.authStateReady === 'function') {
      try { await fb.auth.authStateReady(); } catch {}
    }
    await processAuthUser(fb.auth.currentUser);

    const unsub = fb.onAuthStateChanged(fb.auth, processAuthUser);
    window.addEventListener('beforeunload', () => { try { unsub(); } catch {} }, { once: true });
  })();

  /* ============== Modal markup ============== */
  const RECAPTCHA_ATTR = '<p class="signup-recaptcha-attr">محمي بـ reCAPTCHA · <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">الخصوصية</a> · <a href="https://policies.google.com/terms" target="_blank" rel="noopener">الشروط</a></p>';

  function buildModal() {
    if (document.querySelector('[data-signup-modal]')) return;

    const wrap = document.createElement('div');
    wrap.className = 'signup-modal';
    wrap.setAttribute('data-signup-modal', '');
    wrap.setAttribute('data-step', 'signup');
    wrap.hidden = true;
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = `
      <div class="signup-backdrop" data-signup-close></div>
      <div class="signup-card" role="dialog" aria-modal="true" aria-labelledby="signup-title-injected">
        <button class="signup-close" type="button" data-signup-close aria-label="إغلاق">×</button>

        <!-- Step: SIGN UP (student email | rep phone) -->
        <div class="signup-step" data-signup-step="signup">
          <h3 id="signup-title-injected">افتح حسابك</h3>
          <p class="signup-sub">حتى نحفظ تصميمك ومقاسك ونوصلك بدفعتك.</p>
          <form class="signup-form" data-signup-form-signup novalidate>
            <div data-signup-class-details hidden>
              <label><span>الجامعة</span><input data-invite-university readonly /></label>
              <label><span>الكلية</span><input data-invite-college readonly /></label>
            </div>
            <label class="signup-role">
              <span class="signup-role-text">
                <strong>أنا ممثل الدفعة</strong>
                <span>تنشئ صفحة دفعتك وتدير التصويت</span>
              </span>
              <input type="checkbox" name="claimRep" value="1" data-signup-role-toggle />
              <span class="signup-role-box" aria-hidden="true"></span>
            </label>

            <label>
              <span>الاسم</span>
              <input type="text" name="name" required autocomplete="name" maxlength="119" />
            </label>

            <div class="signup-uni" data-signup-uni-picker></div>

            <label>
              <span>سنة التخرج</span>
              <input type="number" name="year" required min="2025" max="2030" placeholder="2026" />
            </label>

            <label>
              <span>رقم الموبايل</span>
              <input type="tel" name="phone" required autocomplete="tel" placeholder="0770 123 4567" />
            </label>

            <!-- Student: password only (no SMS) -->
            <div data-role-fields="student">
              <label>
                <span>كلمة السر</span>
                <input type="password" name="password" autocomplete="new-password" minlength="6" placeholder="٦ أحرف على الأقل" />
              </label>
            </div>

            <!-- Rep: phone verification (SMS OTP) -->
            <div data-role-fields="rep" hidden>
              <div id="recaptcha-container" class="signup-recaptcha"></div>
              ${RECAPTCHA_ATTR}
            </div>

            <button type="submit" class="signup-submit" data-signup-submit-signup>افتح الحساب</button>
            <p class="signup-fineprint" data-signup-privacy>مقاساتك محفوظة بحسابك وتظهر لإدارة إبرة وخيط. اسمك يظهر لأعضاء دفعتك.</p>
            <p class="signup-fineprint" role="status" aria-live="polite" data-signup-save-msg></p>
          </form>
        </div>

        <!-- Step: SIGN IN (students — phone + password) -->
        <div class="signup-step" data-signup-step="email-signin" hidden>
          <h3>سجل دخول</h3>
          <p class="signup-sub" data-signin-help>ادخل رقم موبايلك وكلمة السر.</p>
          <form class="signup-form" data-signup-form-email-signin novalidate>
            <label>
              <span data-signin-identifier-label>رقم الموبايل</span>
              <input type="tel" name="phone" autocomplete="tel" required placeholder="0770 123 4567" />
            </label>
            <label>
              <span>كلمة السر</span>
              <input type="password" name="password" autocomplete="current-password" required />
            </label>
            <button type="submit" class="signup-submit" data-signup-submit-email-signin>دخول</button>
            <div class="signup-otp-actions">
              <button type="button" class="signup-otp-resend" data-signup-forgot>نسيت كلمة السر؟</button>
            </div>
            <p class="signup-fineprint signup-otp-fineprint" data-signup-email-signin-msg></p>
            <p class="signup-switch">
              ما عندك حساب؟
              <button type="button" class="signup-switch-btn" data-signup-go-signup>افتح حساب جديد</button>
            </p>
            <p class="signup-switch">
              ممثل دفعة؟
              <button type="button" class="signup-switch-btn" data-signup-go-phone-signin>سجل دخول برقمك بكود</button>
            </p>
          </form>
        </div>

        <!-- Step: PHONE SIGN IN (reps) -->
        <div class="signup-step" data-signup-step="phone-signin" hidden>
          <h3>دخول الممثل</h3>
          <p class="signup-sub">ممثل الدفعة يدخل برقم موبايله، يجيك كود.</p>
          <form class="signup-form" data-signup-form-signin novalidate>
            <label>
              <span>رقم الموبايل</span>
              <input type="tel" name="phone" required autocomplete="tel" placeholder="0770 123 4567" />
            </label>
            <button type="submit" class="signup-submit" data-signup-submit-signin>أرسل الكود</button>
            <p class="signup-fineprint">نرسلك كود من 6 أرقام عبر الرسالة.</p>
            <p class="signup-switch">
              طالب عادي؟
              <button type="button" class="signup-switch-btn" data-signup-go-email-signin>سجل دخول برقمك وكلمة السر</button>
            </p>
            <div id="recaptcha-container-signin" class="signup-recaptcha"></div>
            ${RECAPTCHA_ATTR}
          </form>
        </div>

        <!-- Step: OTP verification (rep path) -->
        <div class="signup-step" data-signup-step="otp" hidden>
          <h3>أدخل الكود</h3>
          <p class="signup-sub">أرسلنالك كود من 6 أرقام ع <strong data-signup-phone-echo></strong></p>
          <form class="signup-form" data-signup-form-otp novalidate>
            <label class="signup-otp-label">
              <span>كود التحقق</span>
              <input
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                maxlength="6"
                autocomplete="one-time-code"
                name="otp"
                required
                class="signup-otp-input"
                placeholder="000000"
              />
            </label>
            <button type="submit" class="signup-submit" data-signup-submit-otp>تأكيد الكود</button>
            <div class="signup-otp-actions">
              <button type="button" class="signup-otp-back" data-signup-otp-back>غير رقم الموبايل</button>
              <button type="button" class="signup-otp-resend" data-signup-otp-resend>أعد إرسال الكود</button>
            </div>
            <p class="signup-fineprint signup-otp-fineprint" data-signup-otp-msg></p>
            <div id="recaptcha-container-otp" class="signup-recaptcha"></div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
  }

  let modal = null;
  let lastFocused = null;
  let pendingProfile = null; // signup payload (role-aware)
  let pendingMode   = 'signup'; // 'signup' | 'signin'
  let pendingRole   = 'student'; // 'student' | 'rep'
  let pendingPhone  = '';
  // Shared-link context: when a visitor opens a class link, the uni/college/year
  // of the sharer's class are pre-filled into the signup form (see prefillSignup).
  let prefillPickerValue = null; // {universityId, collegeId}
  let prefillYear = '';

  function pickerEl() {
    return modal && modal.querySelector('[data-signup-uni-picker]');
  }

  // Pre-fill the signup uni/college/year from a shared class link so a newcomer
  // joins the sharer's class without retyping it. Names → deterministic ids via
  // KhamaUni; if the option isn't merged yet, re-apply once KhamaUni.ready lands.
  function prefillSignup(ctx) {
    inviteContext = ctx?.id ? window.KhamaAccount.invitation(ctx, ctx.id) : null;
    if (!ctx || (!ctx.university && !ctx.college && !ctx.year)) {
      prefillPickerValue = null; prefillYear = ''; return;
    }
    let uid = '', cid = '';
    if (window.KhamaUni && ctx.university) {
      uid = window.KhamaUni.uniIdFor(ctx.university);
      if (ctx.college) cid = window.KhamaUni.collegeIdFor(uid, ctx.college);
    }
    prefillPickerValue = (uid || cid) ? { universityId: uid, collegeId: cid } : null;
    prefillYear = ctx.year ? String(ctx.year) : '';
    applySignupPrefill();
  }

  function applySignupPrefill() {
    if (!modal) return;
    const form = modal.querySelector('[data-signup-form-signup]');
    const details = modal.querySelector('[data-signup-class-details]');
    details.hidden = !inviteContext;
    details.style.display = inviteContext ? '' : 'none';
    pickerEl().hidden = !!inviteContext;
    pickerEl().style.display = inviteContext ? 'none' : '';
    const phone = form.querySelector('[name="phone"]');
    phone.closest('label').style.display = '';
    phone.required = true;
    form.querySelector('[name="year"]').readOnly = !!inviteContext;
    if (inviteContext) {
      details.querySelector('[data-invite-university]').value = inviteContext.university;
      details.querySelector('[data-invite-college]').value = inviteContext.college;
      form.querySelector('[name="year"]').value = inviteContext.year;
      form.querySelector('[name="password"]').minLength = 8;
      form.querySelector('[name="password"]').placeholder = '٨ أحرف على الأقل';
      modal.querySelector('#signup-title-injected').textContent = 'افتح حساب وانضم لدفعتك';
      modal.querySelector('[data-signup-privacy]').textContent = 'احتفظ برابط الدفعة. تدخل منه باسمك وكلمة السر. اسمك يظهر للدفعة، ورقمك ومقاساتك تبقى بحسابك ولإدارة إبرة وخيط.';
    }
    modal.querySelector('[data-signin-help]').textContent = inviteContext
      ? 'ادخل اسمك الكامل وكلمة السر. إذا حسابك القديم برقم موبايل، اكتبه بدل الاسم.' : 'ادخل رقم موبايلك وكلمة السر.';
    modal.querySelector('[data-signin-identifier-label]').textContent = inviteContext ? 'الاسم الكامل أو رقم الموبايل' : 'رقم الموبايل';
    const loginInput = modal.querySelector('[data-signup-form-email-signin] [name="phone"]');
    loginInput.type = inviteContext ? 'text' : 'tel';
    loginInput.autocomplete = 'username';
    loginInput.placeholder = inviteContext ? 'نفس الاسم الذي سجلت به' : '0770 123 4567';
    const picker = pickerEl();
    if (!inviteContext && picker && window.KhamaUni && prefillPickerValue) {
      window.KhamaUni.buildPickerInto(picker, { value: prefillPickerValue });
      // Re-apply after the approved-merge lands (the sharer's uni may not be in
      // the seed list yet at first paint).
      if (window.KhamaUni.ready && window.KhamaUni.ready.then) {
        window.KhamaUni.ready.then(() => {
          if (modal && !modal.hidden && prefillPickerValue && pickerEl()) {
            window.KhamaUni.buildPickerInto(pickerEl(), { value: prefillPickerValue });
          }
          // The merge may have completed the (programmatic) selection — re-check.
          refreshRepAvailability();
        });
      }
    }
    if (prefillYear) {
      const yearInp = modal.querySelector('[data-signup-step="signup"] [name="year"]');
      if (yearInp) yearInp.value = prefillYear;
    }
    // A programmatic prefill fires no change event, so evaluate it explicitly.
    refreshRepAvailability();
  }

  function ensureModal() {
    buildModal();
    modal = document.querySelector('[data-signup-modal]');
    if (!modal) return null;
    if (modal.dataset.khamaWired === '1') return modal;
    modal.dataset.khamaWired = '1';

    // Build the shared university/college picker.
    const picker = pickerEl();
    if (picker && window.KhamaUni) window.KhamaUni.buildPickerInto(picker);

    modal.querySelectorAll('[data-signup-close]').forEach(el => el.addEventListener('click', close));

    const formSignup = modal.querySelector('[data-signup-form-signup]');
    if (formSignup) formSignup.addEventListener('submit', onSubmitSignupStep);

    const formEmailSignin = modal.querySelector('[data-signup-form-email-signin]');
    if (formEmailSignin) formEmailSignin.addEventListener('submit', onSubmitEmailSigninStep);

    const formSignin = modal.querySelector('[data-signup-form-signin]');
    if (formSignin) formSignin.addEventListener('submit', onSubmitSigninStep);

    const formOtp = modal.querySelector('[data-signup-form-otp]');
    if (formOtp) formOtp.addEventListener('submit', onSubmitOtpStep);

    const roleToggle = modal.querySelector('[data-signup-role-toggle]');
    if (roleToggle) roleToggle.addEventListener('change', () => applyRoleFields(roleToggle.checked));

    // One-rep-per-class: re-check rep availability whenever the class selection
    // changes. uni-data.js's buildPickerInto exposes no onChange/subscribe API
    // and dispatches no custom event — its uni/college <select> elements fire
    // native (bubbling) `change` events, so we delegate on the picker container.
    // The college <select> keeps its identity across uni changes (only innerHTML
    // is swapped), so a delegated listener survives the refill.
    if (picker) {
      picker.addEventListener('change', refreshRepAvailability);
      // Custom uni/college text inputs also influence the selection state.
      picker.addEventListener('input', refreshRepAvailability);
    }
    const yearInput = modal.querySelector('[data-signup-form-signup] [name="year"]');
    if (yearInput) {
      yearInput.addEventListener('input', refreshRepAvailability);
      yearInput.addEventListener('change', refreshRepAvailability);
    }

    const forgot = modal.querySelector('[data-signup-forgot]');
    if (forgot) forgot.addEventListener('click', onForgotPassword);

    const back = modal.querySelector('[data-signup-otp-back]');
    if (back) back.addEventListener('click', () => switchStep(pendingMode === 'signin' ? 'phone-signin' : 'signup'));

    const resend = modal.querySelector('[data-signup-otp-resend]');
    if (resend) resend.addEventListener('click', onResend);

    modal.querySelectorAll('[data-signup-go-signin]').forEach(b =>
      b.addEventListener('click', () => { pendingMode = 'signin'; switchStep('email-signin'); }));
    modal.querySelectorAll('[data-signup-go-signup]').forEach(b =>
      b.addEventListener('click', () => { pendingMode = 'signup'; switchStep('signup'); }));
    modal.querySelectorAll('[data-signup-go-phone-signin]').forEach(b =>
      b.addEventListener('click', () => { pendingMode = 'signin'; pendingRole = 'rep'; switchStep('phone-signin'); }));
    modal.querySelectorAll('[data-signup-go-email-signin]').forEach(b =>
      b.addEventListener('click', () => { pendingMode = 'signin'; switchStep('email-signin'); }));

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) close();
    });

    applyRoleFields(false);
    return modal;
  }

  // Toggle the student (email/password) vs rep (phone/recaptcha) contact blocks.
  function applyRoleFields(isRep) {
    if (!modal) return;
    pendingRole = isRep ? 'rep' : 'student';
    modal.querySelectorAll('[data-role-fields="student"]').forEach(el => el.hidden = isRep);
    modal.querySelectorAll('[data-role-fields="rep"]').forEach(el => el.hidden = !isRep);
  }

  /* ============== One rep per class — hide the rep checkbox if taken ============== */
  // A class is (university, college, graduation year). Only one rep is allowed,
  // so the "أنا ممثل الدفعة" checkbox is hidden whenever the chosen class already
  // has a rep. FAIL SAFE: any uncertainty (no Firebase, incomplete/custom
  // selection, lookup error, or out-of-order response) leaves the checkbox
  // VISIBLE so a real rep is never locked out by a transient glitch.
  let repCheckToken = 0;        // monotonically increasing — newest query wins
  let repCheckTimer = null;     // debounce handle

  function setRepOptionVisible(visible) {
    if (!modal) return;
    const label = modal.querySelector('.signup-role');
    if (!label) return;
    // .signup-form label sets display:flex (and .signup-role adds !important on
    // flex-direction), which beats the UA [hidden] rule — so we must force the
    // hide via inline style (highest specificity) rather than the attribute
    // alone. Keep the attribute too for semantics. We only own signup.js here,
    // so we can't add a CSS [hidden] rule like the rest of the form uses.
    label.hidden = !visible;
    label.style.display = visible ? '' : 'none';
    if (!visible) {
      const toggle = modal.querySelector('[data-signup-role-toggle]');
      if (toggle && toggle.checked) { toggle.checked = false; applyRoleFields(false); }
      else if (toggle) toggle.checked = false;
    }
  }

  // Read the current signup-step selection (uni/college + year). Returns null if
  // the selection is incomplete or custom (i.e. there is nothing to look up).
  function currentClassSelection() {
    if (!modal || !window.KhamaUni) return null;
    const sel = window.KhamaUni.readSelection(pickerEl());
    if (!sel || sel.empty || !sel.university || !sel.college || sel.isCustom) return null;
    const yearInp = modal.querySelector('[data-signup-form-signup] [name="year"]');
    const year = yearInp ? String(yearInp.value || '').trim() : '';
    if (!year) return null;
    return { university: sel.university, college: sel.college, year };
  }

  // Re-evaluate whether the chosen class already has a rep and show/hide the
  // checkbox accordingly. Debounced + token-guarded against async races.
  function refreshRepAvailability() {
    if (!modal) return;
    if (inviteContext) { repCheckToken++; setRepOptionVisible(false); return; }
    const cls = currentClassSelection();
    // Incomplete / custom selection, or no Firebase: keep the checkbox usable.
    if (!cls || !fb || typeof fb.getDoc !== 'function') {
      repCheckToken++;            // invalidate any in-flight query
      if (repCheckTimer) { clearTimeout(repCheckTimer); repCheckTimer = null; }
      setRepOptionVisible(true);
      return;
    }
    const token = ++repCheckToken;
    if (repCheckTimer) clearTimeout(repCheckTimer);
    repCheckTimer = setTimeout(async () => {
      repCheckTimer = null;
      try {
        const id = groupIdFor(cls.university, cls.college, cls.year);
        const snap = await fb.getDoc(fb.doc(fb.db, 'classInvites', id));
        if (token !== repCheckToken) return;   // a newer query superseded us
        const hasRep = snap.exists() && !!snap.data().hasRep;
        setRepOptionVisible(!hasRep);
      } catch (e) {
        // Lookup failed — fail safe, keep the checkbox visible.
        if (token !== repCheckToken) return;
        console.warn('[Khama] rep-availability check failed', e);
        setRepOptionVisible(true);
      }
    }, 250);
  }

  function switchStep(step) {
    if (!modal) return;
    modal.setAttribute('data-step', step);
    modal.querySelectorAll('[data-signup-step]').forEach(el => {
      el.hidden = el.dataset.signupStep !== step;
    });
    const inp = inviteContext && step === 'signup'
      ? modal.querySelector('[data-signup-form-signup] [name="name"]')
      : modal.querySelector(`[data-signup-step="${step}"] input, [data-signup-step="${step}"] select`);
    if (inp) setTimeout(() => { try { inp.focus(); } catch {} }, 60);
    modal.querySelectorAll('.is-error').forEach(el => el.classList.remove('is-error'));
    if (step === 'otp') setMsg('[data-signup-otp-msg]', '', false);
    if (step === 'email-signin') setMsg('[data-signup-email-signin-msg]', '', false);
    // Evaluate the rep checkbox against any pre-filled class selection on entry.
    if (step === 'signup') refreshRepAvailability();
  }

  function setMsg(sel, text, isErr) {
    const el = modal && modal.querySelector(sel);
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('is-error', !!isErr);
  }
  function setOtpMessage(text, isErr) { setMsg('[data-signup-otp-msg]', text, isErr); }

  /* ============== Sign-up submit (role-aware) ============== */
  async function onSubmitSignupStep(e) {
    e.preventDefault();
    if (submitting) return;
    submitting = true;
    try {
      await readyPromise;
      if (!fb && window.KhamaFirebase?.hasConfig) throw new Error('backend-unavailable');
      if (inviteContext) { await submitInvitedStudent(e.currentTarget); return; }
      authMutation = true; authGeneration++;
      await submitStandardSignup(e);
    } catch (error) {
      setMsg('[data-signup-save-msg]', 'تعذر حفظ الحساب. تأكد من الاتصال وحاول مرة ثانية.', true);
    } finally { submitting = false; authMutation = false; }
  }

  async function submitInvitedStudent(form) {
    const name = form.elements.name.value.trim();
    const phone = normalizePhoneIQ(form.elements.phone.value);
    const password = form.elements.password.value;
    form.querySelectorAll('.is-error').forEach(el => el.classList.remove('is-error'));
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      form.elements.phone.classList.add('is-error');
      form.elements.phone.focus();
      setMsg('[data-signup-save-msg]', 'اكتب رقم موبايل صحيح، مثل 0770 123 4567.', true); return;
    }
    if (name.length < 3 || name.length >= 120 || password.length < 8) {
      setMsg('[data-signup-save-msg]', 'اكتب اسمك الكامل وكلمة سر من ٨ أحرف على الأقل.', true); return;
    }
    const btn = form.querySelector('[data-signup-submit-signup]');
    btn.disabled = true;
    btn.textContent = 'جاري حفظ حسابك…';
    authMutation = true;
    authGeneration++;
    try {
      if (!fb) throw new Error('backend-unavailable');
      const ctxSnap = await fb.getDoc(fb.doc(fb.db, 'classInvites', inviteContext.id));
      const ctx = window.KhamaAccount.invitation(ctxSnap.exists() ? ctxSnap.data() : null, inviteContext.id);
      const email = await window.KhamaAccount.classEmail(ctx.id, name);
      let user = fb.auth.currentUser;
      // Retry an interrupted initial profile write without creating another Auth account.
      if (user?.email !== email || currentUser?.name) {
        user = (await fb.createUserWithEmailAndPassword(fb.auth, email, password)).user;
      }
      const profile = await window.KhamaAccount.saveInvitedProfile(fb, user, ctx, name, phone);
      finalizeSignin(user, profile, modal.dataset.reason || 'class-invite');
    } catch (error) {
      const message = error.code === 'auth/email-already-in-use'
        ? 'هذا الاسم مسجل بهالدفعة. إذا الحساب إلك سجل دخول؛ إذا الاسم متشابه، أضف اسم الجد أو اسم يميزك.'
        : 'ما اكتمل حفظ حسابك والانضمام. تأكد من الاتصال واضغط مرة ثانية. ما نعرض نجاح قبل الحفظ.';
      setMsg('[data-signup-save-msg]', message, true);
    } finally { btn.disabled = false; btn.textContent = 'افتح حساب وانضم'; }
  }

  async function submitStandardSignup(e) {
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    form.querySelectorAll('.is-error').forEach(el => el.classList.remove('is-error'));

    const isRep = !!data.claimRep;
    const name  = String(data.name || '').trim();
    const year  = String(data.year || '').trim();
    const sel = window.KhamaUni
      ? window.KhamaUni.readSelection(pickerEl())
      : { university: '', college: '', universityId: '', collegeId: '', isCustom: false, empty: true };

    let firstErr = null;
    const mark = (selector) => {
      const inp = form.querySelector(selector);
      if (inp) { inp.classList.add('is-error'); if (!firstErr) firstErr = inp; }
    };
    if (!name) mark('[name="name"]');
    if (!year) mark('[name="year"]');
    if (sel.empty || !sel.university || !sel.college) {
      const p = pickerEl();
      if (p) { p.classList.add('is-error'); if (!firstErr) firstErr = p; }
    }

    const customInfo = sel.isCustom
      ? { uniName: sel.customUni ? sel.university : '', uniId: sel.universityId, collegeName: sel.college }
      : null;

    if (isRep) {
      const phone = normalizePhoneIQ(data.phone);
      if (!/^\+\d{8,15}$/.test(phone)) mark('[name="phone"]');
      if (firstErr) { try { firstErr.focus(); } catch {}; return; }

      pendingProfile = {
        role: 'rep', name, university: sel.university, college: sel.college, year,
        universityId: sel.universityId, collegeId: sel.collegeId, phone, customInfo,
      };
      pendingMode = 'signup'; pendingRole = 'rep'; pendingPhone = phone;

      if (!fb) { finalizeLocalSignup(pendingProfile); return; }

      const btn = form.querySelector('[data-signup-submit-signup]');
      if (btn) { btn.disabled = true; btn.textContent = 'جاري الإرسال…'; }
      try {
        await sendOtp(phone, 'recaptcha-container');
        const echo = modal.querySelector('[data-signup-phone-echo]');
        if (echo) echo.textContent = phone;
        switchStep('otp');
      } catch (err) {
        console.warn('[Khama] OTP send failed', err);
        mark('[name="phone"]');
        alert(humanAuthError(err));
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'افتح الحساب'; }
      }
      return;
    }

    // Student (phone + password — no SMS). The phone becomes a synthetic email.
    const phone = normalizePhoneIQ(data.phone);
    const password = String(data.password || '');
    if (!/^\+\d{8,15}$/.test(phone)) mark('[name="phone"]');
    if (!password || password.length < 6) mark('[name="password"]');
    if (firstErr) { try { firstErr.focus(); } catch {}; return; }

    const email = studentEmail(phone);

    if (!fb) {
      finalizeLocalSignup({
        role: 'student', name, university: sel.university, college: sel.college, year,
        universityId: sel.universityId, collegeId: sel.collegeId, phone,
      });
      return;
    }

    const btn = form.querySelector('[data-signup-submit-signup]');
    if (btn) { btn.disabled = true; btn.textContent = 'جاري الفتح…'; }
    try {
      const cred = await fb.createUserWithEmailAndPassword(fb.auth, email, password);
      const user = cred.user;

      let uniId = sel.universityId, colId = sel.collegeId, pendingPlacement = false;
      if (customInfo && window.KhamaUni) {
        const res = await window.KhamaUni.submitCustom(fb, { ...customInfo, uid: user.uid });
        uniId = res.universityId || uniId;
        colId = res.collegeId || colId;
        pendingPlacement = true;
      }
      const nowISO = new Date().toISOString();
      const profile = {
        role: 'student', name, university: sel.university, college: sel.college, year,
        universityId: uniId, collegeId: colId, phone,
        createdAt: nowISO, updatedAt: nowISO,
      };
      if (pendingPlacement) profile.pendingPlacement = true;
      await fb.setDoc(fb.doc(fb.db, 'users', user.uid), profile, { merge: true });
      const reason = modal.dataset.reason || '';
      finalizeSignin(user, profile, reason);
    } catch (err) {
      console.warn('[Khama] student signup failed', err);
      if (err && err.code === 'auth/email-already-in-use') {
        mark('[name="phone"]');
        switchStep('email-signin');
        const se = modal.querySelector('[data-signup-form-email-signin] [name="phone"]');
        if (se) se.value = data.phone;
        setMsg('[data-signup-email-signin-msg]', 'هذا الرقم عنده حساب. سجل دخول بكلمة السر.', true);
      } else {
        alert(humanAuthError(err));
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'افتح الحساب'; }
    }
  }

  /* ============== Student sign-in submit (phone + password) ============== */
  async function onSubmitEmailSigninStep(e) {
    e.preventDefault();
    if (submitting) return;
    submitting = true;
    try {
      await readyPromise;
      if (!fb && window.KhamaFirebase?.hasConfig) throw new Error('backend-unavailable');
      await submitEmailSignin(e);
    } catch (error) { setMsg('[data-signup-email-signin-msg]', humanAuthError(error), true); }
    finally { submitting = false; authMutation = false; }
  }
  async function submitEmailSignin(e) {
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    form.querySelectorAll('.is-error').forEach(el => el.classList.remove('is-error'));
    const raw = String(data.phone || '').trim();
    const password = String(data.password || '');
    // A real email (site owner/admin) is accepted as-is; everything else is a phone.
    const looksEmail = isEmail(raw);
    const nameLogin = !!inviteContext && !looksEmail && !/^\+\d{8,15}$/.test(normalizePhoneIQ(raw));
    const validId = nameLogin ? raw.length >= 3 : looksEmail || /^\+\d{8,15}$/.test(normalizePhoneIQ(raw));
    const loginId = nameLogin && validId ? await window.KhamaAccount.classEmail(inviteContext.id, raw) : loginIdFor(raw);
    if (!validId || !password) {
      if (!validId)  { const i = form.querySelector('[name="phone"]'); if (i) i.classList.add('is-error'); }
      if (!password) { const i = form.querySelector('[name="password"]'); if (i) i.classList.add('is-error'); }
      return;
    }

    pendingMode = 'signin';

    if (!fb) {
      const local = readLocalUser();
      const localPhone = local && local.phone ? normalizePhoneIQ(local.phone) : '';
      if (local && ((localPhone && localPhone === normalizePhoneIQ(raw)) ||
                    (local.email && String(local.email).toLowerCase() === raw.toLowerCase()))) {
        currentUser = local; writeLocalUser(currentUser); fireUserChange();
        const reason = modal.dataset.reason || ''; close();
        window.dispatchEvent(new CustomEvent('khama:signin', { detail: { user: currentUser, reason } }));
      } else {
        setMsg('[data-signup-email-signin-msg]', 'ما لقينا حساب بهالرقم ع هالجهاز.', true);
      }
      return;
    }

    const btn = form.querySelector('[data-signup-submit-email-signin]');
    if (btn) { btn.disabled = true; btn.textContent = 'جاري الدخول…'; }
    try {
      authMutation = true;
      authGeneration++;
      const cred = await fb.signInWithEmailAndPassword(fb.auth, loginId, password);
      const user = cred.user;
      const snap = await fb.getDoc(fb.doc(fb.db, 'users', user.uid));
      const d = snap.exists() ? snap.data() : {};
      if (!d.name && nameLogin) {
        const profile = await window.KhamaAccount.saveInvitedProfile(fb, user, inviteContext, raw);
        finalizeSignin(user, profile, modal.dataset.reason || 'class-invite');
        return;
      }
      if (!d.name) throw new Error('profile-incomplete');
      const profile = {
        uid: user.uid,
        role: d.role || 'student',
        name: d.name || '', university: d.university || '', college: d.college || '', year: d.year || '',
        universityId: d.universityId || '', collegeId: d.collegeId || '',
        email: d.email || (looksEmail ? user.email : '') || '',
        phone: d.phone || ((nameLogin || looksEmail) ? '' : normalizePhoneIQ(raw)),
        pendingPlacement: d.pendingPlacement || false,
        measurements: d.measurements || null, savedDesigns: d.savedDesigns || [],
        groupId: d.groupId || '', loginClassId: d.loginClassId || '', loginMethod: d.loginMethod || '',
        createdAt: d.createdAt || new Date().toISOString(),
      };
      currentUser = profile; writeLocalUser(currentUser); fireUserChange();
      const reason = modal.dataset.reason || '';
      close();
      window.dispatchEvent(new CustomEvent('khama:signin', { detail: { user: currentUser, reason } }));
    } catch (err) {
      console.warn('[Khama] student signin failed', err);
      setMsg('[data-signup-email-signin-msg]', humanAuthError(err), true);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'دخول'; }
    }
  }

  async function onForgotPassword() {
    const inp = modal && modal.querySelector('[data-signup-form-email-signin] [name="phone"]');
    const raw = inp ? String(inp.value || '').trim() : '';
    // Student accounts use a synthetic email that can't receive mail — only a real
    // email (the site owner) can be reset by link. Students contact their rep.
    if (!isEmail(raw)) {
      setMsg('[data-signup-email-signin-msg]', 'إذا نسيت كلمة السر، تواصل وية دعم إبرة وخيط. حسابات الاسم والموبايل ما تستقبل رابط استرجاع بالإيميل.', true);
      return;
    }
    if (!fb) { setMsg('[data-signup-email-signin-msg]', 'غير متاح بدون اتصال', true); return; }
    try {
      await fb.sendPasswordResetEmail(fb.auth, raw);
      setMsg('[data-signup-email-signin-msg]', 'أرسلنالك رابط لتغيير كلمة السر ع إيميلك', false);
    } catch (err) {
      setMsg('[data-signup-email-signin-msg]', humanAuthError(err), true);
    }
  }

  /* ============== Phone sign-in submit (reps) ============== */
  async function onSubmitSigninStep(e) {
    e.preventDefault();
    await readyPromise;
    if (!fb && window.KhamaFirebase?.hasConfig) { alert('تعذر الاتصال. حاول مرة ثانية.'); return; }
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    form.querySelectorAll('.is-error').forEach(el => el.classList.remove('is-error'));

    const phoneE164 = normalizePhoneIQ(data.phone);
    if (!/^\+\d{8,15}$/.test(phoneE164)) {
      const inp = form.querySelector('[name="phone"]');
      if (inp) inp.classList.add('is-error');
      return;
    }

    pendingMode = 'signin'; pendingRole = 'rep'; pendingProfile = null; pendingPhone = phoneE164;

    if (!fb) {
      const local = readLocalUser();
      if (local && local.phone && normalizePhoneIQ(local.phone) === phoneE164) {
        currentUser = local; writeLocalUser(currentUser); fireUserChange();
        const reason = modal.dataset.reason || ''; close();
        window.dispatchEvent(new CustomEvent('khama:signin', { detail: { user: currentUser, reason } }));
      } else {
        const inp = form.querySelector('[name="phone"]');
        if (inp) inp.classList.add('is-error');
        alert('ما لقينا حساب بهالرقم ع هالجهاز.');
      }
      return;
    }

    const submitBtn = form.querySelector('[data-signup-submit-signin]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'جاري الإرسال…'; }
    try {
      await sendOtp(phoneE164, 'recaptcha-container-signin');
      const echo = modal.querySelector('[data-signup-phone-echo]');
      if (echo) echo.textContent = phoneE164;
      switchStep('otp');
    } catch (err) {
      console.warn('[Khama] OTP send failed (signin)', err);
      const inp = form.querySelector('[name="phone"]');
      if (inp) inp.classList.add('is-error');
      alert(humanAuthError(err));
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'أرسل الكود'; }
    }
  }

  async function sendOtp(phoneE164, containerId) {
    if (!fb) throw new Error('Firebase not initialized');
    if (recaptcha) { try { recaptcha.clear(); } catch {} recaptcha = null; }
    recaptcha = new fb.RecaptchaVerifier(fb.auth, containerId || 'recaptcha-container', { size: 'invisible' });
    confirmationResult = await fb.signInWithPhoneNumber(fb.auth, phoneE164, recaptcha);
  }

  /* ============== OTP submit (rep path) ============== */
  async function onSubmitOtpStep(e) {
    e.preventDefault();
    if (!fb || !confirmationResult) return;

    const form = e.currentTarget;
    const code = String(new FormData(form).get('otp') || '').replace(/\D/g, '');
    if (code.length < 6) { setOtpMessage('الكود يلزم 6 أرقام', true); return; }

    const submitBtn = form.querySelector('[data-signup-submit-otp]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'جاري التحقق…'; }

    try {
      authMutation = true; authGeneration++;
      const cred = await confirmationResult.confirm(code);
      const user = cred.user;
      const docRef = fb.doc(fb.db, 'users', user.uid);
      const existing = await fb.getDoc(docRef);

      if (pendingMode === 'signin') {
        if (!existing.exists()) {
          try { await fb.signOut(fb.auth); } catch {}
          setOtpMessage('ما لقينا حسابك. افتح حساب جديد بنفس الرقم.', true);
          switchStep('signup');
          const roleToggle = modal.querySelector('[data-signup-role-toggle]');
          if (roleToggle) { roleToggle.checked = true; applyRoleFields(true); }
          const phoneInp = modal.querySelector('[data-signup-form-signup] [name="phone"]');
          if (phoneInp) { phoneInp.value = pendingPhone; phoneInp.classList.add('is-error'); }
          pendingMode = 'signup';
          confirmationResult = null;
          if (recaptcha) { try { recaptcha.clear(); } catch {} recaptcha = null; }
          return;
        }
        const d = existing.data();
        const profile = {
          uid: user.uid,
          role: d.role || 'rep',
          name: d.name || '', university: d.university || '', college: d.college || '', year: d.year || '',
          universityId: d.universityId || '', collegeId: d.collegeId || '',
          email: d.email || '', phone: d.phone || user.phoneNumber || pendingPhone || '',
          pendingPlacement: d.pendingPlacement || false,
          measurements: d.measurements || null, savedDesigns: d.savedDesigns || [],
          createdAt: d.createdAt || new Date().toISOString(),
        };
        finalizeSignin(user, profile, modal.dataset.reason || '');
        return;
      }

      // Sign-up (rep): resolve any custom uni/college, then merge-write.
      let uniId = (pendingProfile && pendingProfile.universityId) || '';
      let colId = (pendingProfile && pendingProfile.collegeId) || '';
      let pendingPlacement = false;
      if (pendingProfile && pendingProfile.customInfo && window.KhamaUni) {
        const res = await window.KhamaUni.submitCustom(fb, { ...pendingProfile.customInfo, uid: user.uid });
        uniId = res.universityId || uniId;
        colId = res.collegeId || colId;
        pendingPlacement = true;
      }
      const nowISO = new Date().toISOString();
      const baseCreatedAt = existing.exists() ? (existing.data().createdAt || nowISO) : nowISO;
      const profile = {
        role: 'rep',
        name: pendingProfile.name, university: pendingProfile.university, college: pendingProfile.college, year: pendingProfile.year,
        universityId: uniId, collegeId: colId,
        phone: pendingProfile.phone || user.phoneNumber || pendingPhone || '',
        createdAt: baseCreatedAt, updatedAt: nowISO,
      };
      if (pendingPlacement) profile.pendingPlacement = true;
      await fb.setDoc(docRef, profile, { merge: true });
      finalizeSignin(user, profile, modal.dataset.reason || '');
    } catch (err) {
      console.warn('[Khama] OTP verify failed', err);
      setOtpMessage(humanAuthError(err), true);
    } finally {
      authMutation = false;
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'تأكيد الكود'; }
    }
  }

  // Shared finalize for any successful auth (sets cache, closes, dispatches).
  function finalizeSignin(user, profile, reason) {
    currentUser = { uid: user.uid, ...profile };
    writeLocalUser(currentUser);
    fireUserChange();
    pendingProfile = null;
    confirmationResult = null;
    if (recaptcha) { try { recaptcha.clear(); } catch {} recaptcha = null; }
    close();
    window.dispatchEvent(new CustomEvent('khama:signin', { detail: { user: currentUser, reason } }));
  }

  async function onResend() {
    if (!fb) return;
    const phone = pendingMode === 'signin' ? pendingPhone : (pendingProfile && pendingProfile.phone);
    if (!phone) return;
    setOtpMessage('جاري إعادة الإرسال…', false);
    try {
      await sendOtp(phone, 'recaptcha-container-otp');
      setOtpMessage('انرسل كود جديد', false);
    } catch (err) {
      setOtpMessage(humanAuthError(err), true);
    }
  }

  function humanAuthError(err) {
    const code = (err && err.code) || '';
    switch (code) {
      case 'auth/invalid-phone-number':       return 'رقم الموبايل غير صحيح';
      case 'auth/invalid-verification-code':  return 'الكود غير صحيح. حاول مرة ثانية';
      case 'auth/code-expired':               return 'انتهت صلاحية الكود. اضغط على إعادة الإرسال';
      case 'auth/too-many-requests':          return 'محاولات كثيرة. حاول بعد قليل';
      case 'auth/quota-exceeded':             return 'وصلنا للحد اليومي. حاول لاحقا';
      case 'auth/missing-verification-code':  return 'املأ الكود كامل';
      case 'auth/network-request-failed':     return 'ما فيه إنترنت. تأكد من الاتصال';
      case 'auth/email-already-in-use':       return 'هذا الإيميل مستخدم. سجل دخول بدله';
      case 'auth/invalid-email':              return 'الإيميل غير صحيح';
      case 'auth/weak-password':              return 'كلمة السر ضعيفة. 6 أحرف على الأقل';
      case 'auth/missing-password':           return 'اكتب كلمة السر';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':         return 'الإيميل أو كلمة السر غير صحيحة';
      case 'auth/user-disabled':              return 'هذا الحساب موقوف';
      default: return 'صار خطأ. حاول مرة ثانية';
    }
  }

  /* ============== Fallback signup (no Firebase) ============== */
  function finalizeLocalSignup(profile) {
    const user = { ...profile, createdAt: new Date().toISOString() };
    currentUser = user;
    writeLocalUser(user);
    fireUserChange();
    const reason = modal.dataset.reason || '';
    close();
    window.dispatchEvent(new CustomEvent('khama:signin', { detail: { user, reason } }));
  }

  /* ============== Open / close ============== */
  function open(reason, opts) {
    const m = ensureModal();
    if (!m) return;
    lastFocused = document.activeElement;
    if (reason) m.dataset.reason = String(reason);
    m.hidden = false;
    m.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    const mode = (opts && opts.mode === 'signin') ? 'signin' : 'signup';
    pendingMode = mode;
    if (mode === 'signup') {
      const roleToggle = m.querySelector('[data-signup-role-toggle]');
      if (roleToggle) { roleToggle.checked = false; applyRoleFields(false); }
    }
    prefillFromCurrentUser(m, mode);
    applySignupPrefill();
    switchStep(mode === 'signin' ? 'email-signin' : 'signup');
  }

  // Pre-fill simple scalar fields we already know (name/phone/year). The uni
  // picker manages its own state, so we don't try to drive its selects here.
  function prefillFromCurrentUser(m, mode) {
    if (!currentUser) return;
    const signupStep = m.querySelector('[data-signup-step="signup"]');
    if (signupStep && mode === 'signup') {
      ['name', 'year', 'phone'].forEach(k => {
        const inp = signupStep.querySelector(`[name="${k}"]`);
        if (inp && !inp.value && typeof currentUser[k] === 'string' && currentUser[k]) inp.value = currentUser[k];
      });
    }
    const phoneSignin = m.querySelector('[data-signup-form-email-signin] [name="phone"]');
    if (phoneSignin && !phoneSignin.value && currentUser.phone) phoneSignin.value = currentUser.phone;
  }

  // Legacy helper kept for callers that pre-collected a profile (e.g. the /class
  // join-preview). Opens the modal in signup mode, pre-filling what it can. The
  // caller's khama:signin listener still fires once the user completes.
  async function startSignup(profile, reason) {
    const m = ensureModal();
    if (!m) return false;
    open(reason, { mode: 'signup' });
    for (const [key, value] of Object.entries(sanitizeProfile(profile))) {
      const input = m.querySelector(`[data-signup-form-signup] [name="${key}"]`);
      if (input && !input.readOnly) input.value = value;
    }
    return false;
  }
  function sanitizeProfile(p) {
    const out = {};
    ['name', 'university', 'college', 'year', 'phone'].forEach(k => {
      if (p && typeof p[k] === 'string' && p[k]) out[k] = p[k];
    });
    return out;
  }

  function close() {
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    pendingProfile = null;
    pendingPhone   = '';
    pendingMode    = 'signup';
    confirmationResult = null;
    if (recaptcha) { try { recaptcha.clear(); } catch {} recaptcha = null; }
    if (lastFocused && typeof lastFocused.focus === 'function') {
      try { lastFocused.focus(); } catch {}
    }
  }

  /* ============== Gate wiring ============== */
  function wireGates(root) {
    (root || document).querySelectorAll('[data-gate]').forEach(btn => {
      if (btn.dataset.khamaGated === '1') return;
      btn.dataset.khamaGated = '1';
      btn.addEventListener('click', (e) => {
        const reason = btn.dataset.gate || '';
        if (!currentUser) {
          e.preventDefault();
          open(reason);
        } else {
          window.dispatchEvent(new CustomEvent('khama:gate', { detail: { reason, target: btn } }));
        }
      });
    });
  }

  /* ============== Manual setUser (used by class join-preview) ============== */
  let profileWrites = Promise.resolve();
  function setUser(u) {
    const payload = u ? { ...u } : u;
    const next = profileWrites.catch(() => {}).then(() => persistUserPatch(payload));
    profileWrites = next;
    return next;
  }
  async function persistUserPatch(u) {
    if (!u || typeof u !== 'object' || !u.name) return;
    await readyPromise;
    const uid = currentUser?.uid;
    if (u.uid && u.uid !== uid) throw new Error('account-changed');
    const patch = {};
    for (const key of ['name', 'university', 'college', 'year', 'universityId', 'collegeId', 'phone', 'pendingPlacement', 'savedDesigns']) {
      if (u[key] !== undefined && JSON.stringify(u[key]) !== JSON.stringify(currentUser?.[key])) patch[key] = u[key];
    }
    if (u.measurements !== undefined && JSON.stringify(u.measurements) !== JSON.stringify(currentUser?.measurements)) {
      patch.measurements = window.KhamaAccount.measurements(u.measurements);
    }
    if (!Object.keys(patch).length) return currentUser;
    patch.updatedAt = new Date().toISOString();
    if (fb) {
      if (!uid || fb.auth.currentUser?.uid !== uid) throw new Error('not-signed-in');
      await fb.runTransaction(fb.db, async tx => {
        const ref = fb.doc(fb.db, 'users', uid);
        const snapshot = await tx.get(ref);
        const latest = snapshot.data();
        if (patch.measurements && Date.parse(latest?.measurements?.savedAt) > Date.parse(patch.measurements.savedAt)) {
          patch.measurements = latest.measurements;
        }
        tx.update(ref, patch);
      });
    } else if (window.KhamaFirebase?.hasConfig) throw new Error('backend-unavailable');
    if (currentUser?.uid !== uid) return;
    currentUser = { ...currentUser, ...patch };
    writeLocalUser(currentUser);
    fireUserChange();
    return currentUser;
  }

  async function clearUser() {
    if (fb && fb.auth.currentUser) {
      await fb.signOut(fb.auth);
    }
    currentUser = null;
    authGeneration++;
    if (modal) modal.querySelectorAll('input:not([readonly])').forEach(input => { if (input.type !== 'checkbox') input.value = ''; });
    writeLocalUser(null);
    fireUserChange();
  }

  /* ============== Public API ============== */
  window.KhamaSignup = {
    open,
    close,
    startSignup,
    prefillSignup,
    user:        () => currentUser,
    uid:         () => currentUser ? currentUser.uid || null : null,
    setUser,
    clearUser,
    refreshUser:  async () => { await readyPromise; if (fb) await processAuthUser(fb.auth.currentUser); },
    wireGates,
    ready:       readyPromise,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => wireGates());
  } else {
    wireGates();
  }
})();

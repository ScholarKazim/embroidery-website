/* Khama — firebase-init.js
 *
 * Boots the Firebase modular SDK on demand. Exposes `window.KhamaFirebase`
 * with a single Promise (`ready`) and a boolean (`isLive`).
 *
 * The whole module is a no-op when the config is empty, which lets the site
 * run in localStorage-only mode during dev and CI. Once a valid config is
 * pasted into firebase-config.js, auth + firestore become available.
 *
 * Usage from any module:
 *   const fb = await window.KhamaFirebase.ready;
 *   if (!fb) return; // localStorage fallback path
 *   const { auth, db, signInWithPhoneNumber, RecaptchaVerifier, ... } = fb;
 *
 * SDK is loaded from gstatic CDN — no build step required.
 */
(function () {
  'use strict';

  const SDK_VERSION = '10.13.0';
  const SDK_BASE    = 'https://www.gstatic.com/firebasejs/' + SDK_VERSION;

  function hasValidConfig() {
    const c = window.KHAMA_FIREBASE_CONFIG;
    if (!c || typeof c !== 'object') return false;
    return !!(c.apiKey && c.authDomain && c.projectId && c.appId);
  }

  let readyPromise = null;
  let live = false;

  async function bootstrap() {
    if (!hasValidConfig()) return null;
    try {
      const [{ initializeApp }, authMod, fsMod] = await Promise.all([
        import(`${SDK_BASE}/firebase-app.js`),
        import(`${SDK_BASE}/firebase-auth.js`),
        import(`${SDK_BASE}/firebase-firestore.js`),
      ]);

      const app  = initializeApp(window.KHAMA_FIREBASE_CONFIG);
      const auth = authMod.getAuth(app);
      const db   = fsMod.getFirestore(app);

      // Explicit local emulator mode; never connect a production project to a test backend.
      const localHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
      if (localHost && window.KHAMA_USE_EMULATORS === true && window.KHAMA_FIREBASE_CONFIG.projectId === 'demo-khama') {
        authMod.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
        fsMod.connectFirestoreEmulator(db, '127.0.0.1', 8080);
      }

      auth.languageCode = 'ar';

      // Local-only: skip reCAPTCHA so Firebase-configured test phone numbers
      // (e.g. +9647700000001 / 123456) sign in instantly during dev. This flag
      // is a strict no-op in production — Firebase ignores it unless the phone
      // number is on the project's test-phone allowlist.
      const host = window.location && window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
        try { auth.settings.appVerificationDisabledForTesting = true; } catch {}
      }

      live = true;

      return {
        app, auth, db,
        // Auth helpers
        signInWithPhoneNumber: authMod.signInWithPhoneNumber,
        PhoneAuthProvider:     authMod.PhoneAuthProvider,
        linkWithCredential:    authMod.linkWithCredential,
        reauthenticateWithCredential: authMod.reauthenticateWithCredential,
        signInAnonymously:     authMod.signInAnonymously,
        RecaptchaVerifier:     authMod.RecaptchaVerifier,
        onAuthStateChanged:    authMod.onAuthStateChanged,
        signOut:               authMod.signOut,
        // Email/password auth (students). Phone OTP above stays for reps.
        createUserWithEmailAndPassword: authMod.createUserWithEmailAndPassword,
        signInWithEmailAndPassword:     authMod.signInWithEmailAndPassword,
        sendPasswordResetEmail:         authMod.sendPasswordResetEmail,
        sendEmailVerification:          authMod.sendEmailVerification,
        // Firestore helpers
        doc:               fsMod.doc,
        getDoc:            fsMod.getDoc,
        setDoc:            fsMod.setDoc,
        updateDoc:         fsMod.updateDoc,
        deleteDoc:         fsMod.deleteDoc,
        deleteField:       fsMod.deleteField,
        onSnapshot:        fsMod.onSnapshot,
        collection:        fsMod.collection,
        query:             fsMod.query,
        where:             fsMod.where,
        orderBy:           fsMod.orderBy,
        limit:             fsMod.limit,
        startAfter:        fsMod.startAfter,
        getDocs:           fsMod.getDocs,
        serverTimestamp:   fsMod.serverTimestamp,
        arrayUnion:        fsMod.arrayUnion,
        arrayRemove:       fsMod.arrayRemove,
        increment:         fsMod.increment,
        runTransaction:    fsMod.runTransaction,
        writeBatch:        fsMod.writeBatch,
        Timestamp:         fsMod.Timestamp,
      };
    } catch (err) {
      console.warn('[Khama] Firebase init failed; account writes are unavailable:', err);
      live = false;
      return null;
    }
  }

  if (!readyPromise) readyPromise = bootstrap();

  window.KhamaFirebase = {
    ready:        readyPromise,
    get isLive() { return live; },
    get hasConfig() { return hasValidConfig(); },
  };
})();

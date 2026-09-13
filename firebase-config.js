/* Ibra â€” Firebase client config
 *
 * Paste the firebaseConfig object you got from the Firebase console here.
 * These are PUBLIC keys â€” they're meant to be visible in client code, and
 * security is enforced via Firestore rules (firestore.rules) + Phone Auth.
 *
 * The site keeps working with localStorage-only mode while this remains
 * empty, so it's safe to ship with placeholder values during development.
 *
 * To get the config:
 *   1. console.firebase.google.com â†’ your project
 *   2. Project Settings (gear icon) â†’ General tab
 *   3. Scroll to "Your apps" â†’ Web app â†’ "SDK setup and configuration"
 *   4. Select "Config" and copy the firebaseConfig object
 *   5. Paste the values below
 *
 * In production on Vercel, prefer reading these from environment variables
 * via a small build step or window.Ibra_FIREBASE_CONFIG injection. For this
 * static no-build setup, putting them in this file is fine.
 */
window.Ibra_FIREBASE_CONFIG = {
  apiKey:            'AIzaSyAw4xIbJoHBxAeKmuavxJenXCJIte0hwTw',
  authDomain:        'nishan-14945.firebaseapp.com',
  projectId:         'nishan-14945',
  storageBucket:     'nishan-14945.firebasestorage.app',
  messagingSenderId: '714561974240',
  appId:             '1:714561974240:web:432309001c10f9cbdc4585',
  measurementId:     'G-S4MQP5JTYY',
};


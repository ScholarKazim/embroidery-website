/* Khama — analytics.js
 *
 * Lightweight, self-contained analytics for the static site. No build step,
 * no dependencies. Loaded with `defer` on every page.
 *
 *   1) Google Analytics 4 (gtag)  — page views + key-CTA click events.
 *      Uses the measurementId already in firebase-config.js (G-S4MQP5JTYY).
 *      View at: analytics.google.com → property → Reports / Realtime.
 *
 *   2) Vercel Web Analytics — privacy-friendly page views, top pages,
 *      referrers, countries, devices. Must be ENABLED in the Vercel
 *      dashboard (project → Analytics) for /_vercel/insights/script.js to
 *      be served; otherwise it 404s harmlessly. Custom events are Pro-only.
 *
 * Privacy: GA4 anonymises IPs by default. We send only event names and a
 * coarse page label — no names, phones, sizes, or other PII.
 */
(function () {
  'use strict';

  var GA_ID = (window.KHAMA_FIREBASE_CONFIG && window.KHAMA_FIREBASE_CONFIG.measurementId)
            || 'G-S4MQP5JTYY';

  /* ---------- Google Analytics 4 ---------- */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  gtag('js', new Date());
  gtag('config', GA_ID);

  var ga = document.createElement('script');
  ga.async = true;
  ga.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
  document.head.appendChild(ga);

  /* ---------- Vercel Web Analytics ---------- */
  // Queue shim — events fired before the script loads are replayed on arrival.
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  var vercel = document.createElement('script');
  vercel.defer = true;
  vercel.src = '/_vercel/insights/script.js';
  document.head.appendChild(vercel);

  /* ---------- Unified event helper ---------- */
  function track(name, params) {
    params = params || {};
    try { window.gtag('event', name, params); } catch (e) {}
    try { window.va('event', { name: name, data: params }); } catch (e) {}
  }
  // Exposed so other scripts can fire their own events: khamaTrack('x', {...}).
  window.khamaTrack = track;

  /* ---------- Which page are we on (coarse label) ---------- */
  function pageKind() {
    var p = decodeURIComponent(location.pathname);
    if (/قياس/.test(p))            return 'size_calc';
    if (/\/products\/scarf/.test(p)) return 'scarf';
    if (/\/products\/robe/.test(p))  return 'robe';
    if (/\/products\/cap/.test(p))   return 'cap';
    if (/\/products/.test(p))        return 'products';
    if (/\/class-voting/.test(p))    return 'class_voting';
    if (/\/class/.test(p))           return 'class';
    if (/\/checkout/.test(p))        return 'checkout';
    if (p === '/' || /\/index\.html$/.test(p)) return 'home';
    return 'other';
  }

  /* ---------- Key-CTA click tracking (delegated, no markup changes) ----------
   * Matching is done at click time with closest(), so it also covers UI that
   * is rendered dynamically (configurator steps, cart drawer, calc results,
   * class flow). Capture phase so it still fires if a handler stops the event.
   */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    var a = t.closest('a');
    var href = a ? (a.getAttribute('href') || '') : '';

    if (a && /wa\.me|whatsapp/i.test(href))
      return track('whatsapp_click', { page: pageKind() });

    if (a && /قياس|%D9%82%D9%8A%D8%A7%D8%B3/.test(href))
      return track('size_calc_open', { page: pageKind() });

    if (t.closest('[data-action="submit"]'))           // configurator add-to-cart
      return track('add_to_cart', { page: pageKind() });

    if (t.closest('[data-quickadd-main]'))             // calc quick add-to-cart
      return track('quick_add_to_cart', { page: pageKind() });

    if (t.closest('[data-sample-prompt]') || t.closest('.class-sample-btn'))
      return track('color_sample_request', { page: pageKind() });

    if (t.closest('[data-cart-trigger]'))              // open the cart drawer
      return track('cart_open', { page: pageKind() });
  }, true);

  /* ---------- Form submissions (signup + checkout) ---------- */
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || !f.closest) return;
    if (f.closest('[data-signup-form-signup]'))
      return track('signup_submit', { page: pageKind() });
    if (f.closest('[data-checkout-form]'))
      return track('checkout_submit', { page: pageKind() });
  }, true);
})();

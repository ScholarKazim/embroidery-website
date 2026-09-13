// ============================================================
// إبرة وخيط — mobile.js
// Mobile Drawer, Quick Actions & Interaction Helpers
// ============================================================

(function () {
  'use strict';

  function initMobile() {
    const burger = document.querySelector('[data-mobile-burger]');
    const drawer = document.getElementById('mobile-drawer');
    const backdrop = document.getElementById('mobile-drawer-backdrop');
    const closeBtn = document.querySelector('[data-drawer-close]');
    const drawerLinks = document.querySelectorAll('.mobile-drawer-link, .mobile-drawer-cta');

    function openDrawer() {
      if (!drawer || !backdrop) return;
      drawer.classList.add('is-open');
      backdrop.classList.add('is-open');
      if (burger) burger.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
      if (!drawer || !backdrop) return;
      drawer.classList.remove('is-open');
      backdrop.classList.remove('is-open');
      if (burger) burger.classList.remove('is-open');
      document.body.style.overflow = '';
    }

    if (burger) {
      burger.addEventListener('click', function (e) {
        e.stopPropagation();
        if (drawer && drawer.classList.contains('is-open')) {
          closeDrawer();
        } else {
          openDrawer();
        }
      });
    }

    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (backdrop) backdrop.addEventListener('click', closeDrawer);

    drawerLinks.forEach(link => {
      link.addEventListener('click', function () {
        closeDrawer();
      });
    });

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer && drawer.classList.contains('is-open')) {
        closeDrawer();
      }
    });

    // Sync bottom bar cart button with main cart trigger
    const bottomCartBtn = document.querySelector('[data-bottom-cart]');
    if (bottomCartBtn) {
      bottomCartBtn.addEventListener('click', function (e) {
        e.preventDefault();
        const mainCartTrigger = document.querySelector('.nav-cart');
        if (mainCartTrigger) mainCartTrigger.click();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobile);
  } else {
    initMobile();
  }
})();

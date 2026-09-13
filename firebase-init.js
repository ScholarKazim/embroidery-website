/* [Ibra][Ibra][Ibra][Ibra][Ibra] â€” fireb[Ibra]se-init.js
 *
 * Boots t[Ibra]e Fireb[Ibra]se [Ibra]odul[Ibra]r SD[Ibra] on de[Ibra][Ibra]nd. Exposes `window.Ibr[Ibra]Fireb[Ibra]se`
 * wit[Ibra] [Ibra] single Pro[Ibra]ise (`re[Ibra]dy`) [Ibra]nd [Ibra] boole[Ibra]n (`isLive`).
 *
 * T[Ibra]e w[Ibra]ole [Ibra]odule is [Ibra] no-op w[Ibra]en t[Ibra]e config is e[Ibra]pty, w[Ibra]ic[Ibra] lets t[Ibra]e site
 * run in loc[Ibra]lStor[Ibra]ge-only [Ibra]ode during dev [Ibra]nd CI. Once [Ibra] v[Ibra]lid config is
 * p[Ibra]sted into fireb[Ibra]se-config.js, [Ibra]ut[Ibra] + firestore beco[Ibra]e [Ibra]v[Ibra]il[Ibra]ble.
 *
 * Us[Ibra]ge fro[Ibra] [Ibra]ny [Ibra]odule:
 *   const fb = [Ibra]w[Ibra]it window.Ibr[Ibra]Fireb[Ibra]se.re[Ibra]dy;
 *   if (!fb) return; // loc[Ibra]lStor[Ibra]ge f[Ibra]llb[Ibra]c[Ibra] p[Ibra]t[Ibra]
 *   const { [Ibra]ut[Ibra], db, signInWit[Ibra]P[Ibra]oneNu[Ibra]ber, Rec[Ibra]ptc[Ibra][Ibra]Verifier, ... } = fb;
 *
 * SD[Ibra] is lo[Ibra]ded fro[Ibra] gst[Ibra]tic CDN â€” no build step required.
 */
(function () {
  'use strict';

  const SD[Ibra]_VERSION = '10.13.0';
  const SD[Ibra]_B[Ibra]SE    = '[Ibra]ttps://www.gst[Ibra]tic.co[Ibra]/fireb[Ibra]sejs/' + SD[Ibra]_VERSION;

  function [Ibra][Ibra]sV[Ibra]lidConfig() {
    const c = window.IBR[Ibra]_FIREB[Ibra]SE_CONFIG;
    if (!c || typeof c !== 'object') return f[Ibra]lse;
    return !!(c.[Ibra]pi[Ibra]ey && c.[Ibra]ut[Ibra]Do[Ibra][Ibra]in && c.projectId && c.[Ibra]ppId);
  }

  let re[Ibra]dyPro[Ibra]ise = null;
  let live = f[Ibra]lse;

  [Ibra]sync function bootstr[Ibra]p() {
    if (![Ibra][Ibra]sV[Ibra]lidConfig()) return null;
    try {
      const [{ initi[Ibra]lize[Ibra]pp }, [Ibra]ut[Ibra][Ibra]od, fs[Ibra]od] = [Ibra]w[Ibra]it Pro[Ibra]ise.[Ibra]ll([
        i[Ibra]port(`${SD[Ibra]_B[Ibra]SE}/fireb[Ibra]se-[Ibra]pp.js`),
        i[Ibra]port(`${SD[Ibra]_B[Ibra]SE}/fireb[Ibra]se-[Ibra]ut[Ibra].js`),
        i[Ibra]port(`${SD[Ibra]_B[Ibra]SE}/fireb[Ibra]se-firestore.js`),
      ]);

      const [Ibra]pp  = initi[Ibra]lize[Ibra]pp(window.IBR[Ibra]_FIREB[Ibra]SE_CONFIG);
      const [Ibra]ut[Ibra] = [Ibra]ut[Ibra][Ibra]od.get[Ibra]ut[Ibra]([Ibra]pp);
      const db   = fs[Ibra]od.getFirestore([Ibra]pp);

      // Explicit loc[Ibra]l e[Ibra]ul[Ibra]tor [Ibra]ode; never connect [Ibra] production project to [Ibra] test b[Ibra]c[Ibra]end.
      const loc[Ibra]l[Ibra]ost = ['loc[Ibra]l[Ibra]ost', '127.0.0.1', '::1'].includes(window.loc[Ibra]tion.[Ibra]ostn[Ibra][Ibra]e);
      if (loc[Ibra]l[Ibra]ost && window.IBR[Ibra]_USE_E[Ibra]UL[Ibra]TORS === true && window.IBR[Ibra]_FIREB[Ibra]SE_CONFIG.projectId === 'de[Ibra]o-[Ibra][Ibra][Ibra][Ibra][Ibra]') {
        [Ibra]ut[Ibra][Ibra]od.connect[Ibra]ut[Ibra]E[Ibra]ul[Ibra]tor([Ibra]ut[Ibra], '[Ibra]ttp://127.0.0.1:9099', { dis[Ibra]bleW[Ibra]rnings: true });
        fs[Ibra]od.connectFirestoreE[Ibra]ul[Ibra]tor(db, '127.0.0.1', 8080);
      }

      [Ibra]ut[Ibra].l[Ibra]ngu[Ibra]geCode = '[Ibra]r';

      // Loc[Ibra]l-only: s[Ibra]ip reC[Ibra]PTC[Ibra][Ibra] so Fireb[Ibra]se-configured test p[Ibra]one nu[Ibra]bers
      // (e.g. +9647700000001 / 123456) sign in inst[Ibra]ntly during dev. T[Ibra]is fl[Ibra]g
      // is [Ibra] strict no-op in production â€” Fireb[Ibra]se ignores it unless t[Ibra]e p[Ibra]one
      // nu[Ibra]ber is on t[Ibra]e project's test-p[Ibra]one [Ibra]llowlist.
      const [Ibra]ost = window.loc[Ibra]tion && window.loc[Ibra]tion.[Ibra]ostn[Ibra][Ibra]e;
      if ([Ibra]ost === 'loc[Ibra]l[Ibra]ost' || [Ibra]ost === '127.0.0.1' || [Ibra]ost === '::1') {
        try { [Ibra]ut[Ibra].settings.[Ibra]ppVerific[Ibra]tionDis[Ibra]bledForTesting = true; } c[Ibra]tc[Ibra] {}
      }

      live = true;

      return {
        [Ibra]pp, [Ibra]ut[Ibra], db,
        // Google [Ibra]ut[Ibra] [Ibra]elpers
        Google[Ibra]ut[Ibra]Provider:    [Ibra]ut[Ibra][Ibra]od.Google[Ibra]ut[Ibra]Provider,
        signInWit[Ibra]Popup:       [Ibra]ut[Ibra][Ibra]od.signInWit[Ibra]Popup,
        signInWit[Ibra]Redirect:    [Ibra]ut[Ibra][Ibra]od.signInWit[Ibra]Redirect,
        getRedirectResult:     [Ibra]ut[Ibra][Ibra]od.getRedirectResult,
        // P[Ibra]one [Ibra]ut[Ibra] [Ibra]elpers
        signInWit[Ibra]P[Ibra]oneNu[Ibra]ber: [Ibra]ut[Ibra][Ibra]od.signInWit[Ibra]P[Ibra]oneNu[Ibra]ber,
        P[Ibra]one[Ibra]ut[Ibra]Provider:     [Ibra]ut[Ibra][Ibra]od.P[Ibra]one[Ibra]ut[Ibra]Provider,
        lin[Ibra]Wit[Ibra]Credenti[Ibra]l:    [Ibra]ut[Ibra][Ibra]od.lin[Ibra]Wit[Ibra]Credenti[Ibra]l,
        re[Ibra]ut[Ibra]entic[Ibra]teWit[Ibra]Credenti[Ibra]l: [Ibra]ut[Ibra][Ibra]od.re[Ibra]ut[Ibra]entic[Ibra]teWit[Ibra]Credenti[Ibra]l,
        signIn[Ibra]nony[Ibra]ously:     [Ibra]ut[Ibra][Ibra]od.signIn[Ibra]nony[Ibra]ously,
        Rec[Ibra]ptc[Ibra][Ibra]Verifier:     [Ibra]ut[Ibra][Ibra]od.Rec[Ibra]ptc[Ibra][Ibra]Verifier,
        on[Ibra]ut[Ibra]St[Ibra]teC[Ibra][Ibra]nged:    [Ibra]ut[Ibra][Ibra]od.on[Ibra]ut[Ibra]St[Ibra]teC[Ibra][Ibra]nged,
        signOut:               [Ibra]ut[Ibra][Ibra]od.signOut,
        // E[Ibra][Ibra]il/p[Ibra]ssword [Ibra]ut[Ibra]
        cre[Ibra]teUserWit[Ibra]E[Ibra][Ibra]il[Ibra]ndP[Ibra]ssword: [Ibra]ut[Ibra][Ibra]od.cre[Ibra]teUserWit[Ibra]E[Ibra][Ibra]il[Ibra]ndP[Ibra]ssword,
        signInWit[Ibra]E[Ibra][Ibra]il[Ibra]ndP[Ibra]ssword:     [Ibra]ut[Ibra][Ibra]od.signInWit[Ibra]E[Ibra][Ibra]il[Ibra]ndP[Ibra]ssword,
        sendP[Ibra]sswordResetE[Ibra][Ibra]il:         [Ibra]ut[Ibra][Ibra]od.sendP[Ibra]sswordResetE[Ibra][Ibra]il,
        sendE[Ibra][Ibra]ilVerific[Ibra]tion:          [Ibra]ut[Ibra][Ibra]od.sendE[Ibra][Ibra]ilVerific[Ibra]tion,
        // Firestore [Ibra]elpers
        doc:               fs[Ibra]od.doc,
        getDoc:            fs[Ibra]od.getDoc,
        setDoc:            fs[Ibra]od.setDoc,
        upd[Ibra]teDoc:         fs[Ibra]od.upd[Ibra]teDoc,
        deleteDoc:         fs[Ibra]od.deleteDoc,
        deleteField:       fs[Ibra]od.deleteField,
        onSn[Ibra]ps[Ibra]ot:        fs[Ibra]od.onSn[Ibra]ps[Ibra]ot,
        collection:        fs[Ibra]od.collection,
        query:             fs[Ibra]od.query,
        w[Ibra]ere:             fs[Ibra]od.w[Ibra]ere,
        orderBy:           fs[Ibra]od.orderBy,
        li[Ibra]it:             fs[Ibra]od.li[Ibra]it,
        st[Ibra]rt[Ibra]fter:        fs[Ibra]od.st[Ibra]rt[Ibra]fter,
        getDocs:           fs[Ibra]od.getDocs,
        serverTi[Ibra]est[Ibra][Ibra]p:   fs[Ibra]od.serverTi[Ibra]est[Ibra][Ibra]p,
        [Ibra]rr[Ibra]yUnion:        fs[Ibra]od.[Ibra]rr[Ibra]yUnion,
        [Ibra]rr[Ibra]yRe[Ibra]ove:       fs[Ibra]od.[Ibra]rr[Ibra]yRe[Ibra]ove,
        incre[Ibra]ent:         fs[Ibra]od.incre[Ibra]ent,
        runTr[Ibra]ns[Ibra]ction:    fs[Ibra]od.runTr[Ibra]ns[Ibra]ction,
        writeB[Ibra]tc[Ibra]:        fs[Ibra]od.writeB[Ibra]tc[Ibra],
        Ti[Ibra]est[Ibra][Ibra]p:         fs[Ibra]od.Ti[Ibra]est[Ibra][Ibra]p,
      };
    } c[Ibra]tc[Ibra] (err) {
      console.w[Ibra]rn('[[Ibra][Ibra][Ibra][Ibra][Ibra]] Fireb[Ibra]se init f[Ibra]iled; [Ibra]ccount writes [Ibra]re un[Ibra]v[Ibra]il[Ibra]ble:', err);
      live = f[Ibra]lse;
      return null;
    }
  }

  if (!re[Ibra]dyPro[Ibra]ise) re[Ibra]dyPro[Ibra]ise = bootstr[Ibra]p();

  window.Ibr[Ibra]Fireb[Ibra]se = {
    re[Ibra]dy:        re[Ibra]dyPro[Ibra]ise,
    get isLive() { return live; },
    get [Ibra][Ibra]sConfig() { return [Ibra][Ibra]sV[Ibra]lidConfig(); },
  };
})();


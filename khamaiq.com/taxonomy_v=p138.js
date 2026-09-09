/* Khama — taxonomy.js
 *
 * Single source of truth for the identity math behind universities, colleges,
 * and class groups. Historically this logic was copy-pasted into uni-data.js,
 * signup.js, class.js and admin.js; four copies is four chances to drift. This
 * module is the one canonical home. It must load BEFORE those scripts on every
 * page (it exposes window.KhamaHash synchronously at parse time).
 *
 * ── Stable ids (do NOT change — live documents are keyed by them) ──
 *   uniIdFor(name)             -> 'u_<djb2>'   (catalog + users.universityId)
 *   collegeIdFor(uniId, name)  -> 'c_<djb2>'   (catalog + users.collegeId)
 *   groupIdFor(uni, col, year) -> 'g_<djb2>'   (classGroups doc id)
 *
 * Two historical normalizers are preserved byte-for-byte so no existing id ever
 * shifts. They differ only in a combining-mark range that never appears in the
 * plain Arabic school names students type, so in practice they agree — but the
 * uni/college ids and the group ids live in separate namespaces regardless, and
 * keeping each exact is what guarantees a zero-migration change:
 *   normForUni   — feeds uniIdFor / collegeIdFor
 *   normForGroup — feeds groupIdFor
 *
 * ── nameKey (NEW, for equality/dedup ONLY — never derives a stored id) ──
 *   nameKey(name)   -> aggressively folded key (ة/ه, alef-hamza, ى/ي, …)
 *   sameName(a, b)  -> a and b are the same school modulo spelling variants
 * Because nameKey backs no document id, it can be strengthened freely without
 * ever orphaning data — it only tightens in-memory matching (e.g. the admin
 * catalog "gap" view, so كليه التربيه and كلية التربية count as one).
 */
(function () {
  'use strict';

  function normForUni(s) {
    return String(s || '')
      .replace(/[ً-ْٰـ​-‏]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
  function normForGroup(s) {
    return String(s || '')
      .replace(/[ً-ٰٓـ​-‏]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
  function djb2(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  function uniIdFor(name)             { return 'u_' + djb2(normForUni(name)); }
  function collegeIdFor(uniId, name)  { return 'c_' + djb2(String(uniId || '') + '|' + normForUni(name)); }
  function groupIdFor(university, college, year) {
    const composite = [
      normForGroup(university),
      normForGroup(college),
      String(year || '').trim(),
    ].join('|');
    return 'g_' + djb2(composite);
  }

  // Aggressive canonical key for matching two typed names as the same school.
  // Folds tashkeel/tatweel/zero-width + the orthographic variants Iraqi students
  // routinely mix: alef-hamza/madda/wasla → bare alef, ة → ه, ى → ي, ؤ → و,
  // ئ → ي, and drops a stray hamza. Arabic-Indic digits are deliberately kept.
  function nameKey(s) {
    return String(s || '')
      .replace(/[ً-ْٰ]/g, '')          // harakat + superscript alef
      .replace(/[ـ​-‏]/g, '')          // tatweel + bidi/zero-width
      .replace(/[آأإٱ]/g, 'ا') // آ أ إ ٱ → ا
      .replace(/ى/g, 'ي')                   // ى → ي
      .replace(/ة/g, 'ه')                   // ة → ه
      .replace(/ؤ/g, 'و')                   // ؤ → و
      .replace(/ئ/g, 'ي')                   // ئ → ي
      .replace(/ء/g, '')                         // stray hamza ء
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
  function sameName(a, b) {
    const ka = nameKey(a);
    return ka !== '' && ka === nameKey(b);
  }

  window.KhamaHash = {
    normForUni, normForGroup, djb2,
    uniIdFor, collegeIdFor, groupIdFor,
    nameKey, sameName,
  };
})();

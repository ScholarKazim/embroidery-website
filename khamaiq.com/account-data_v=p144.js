/* Shared account persistence. Passwords belong only to Firebase Auth. */
(function () {
  'use strict';
  const text = value => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  const normalizedName = value => text(value).toLocaleLowerCase('ar').replace(/[\u0640\u064b-\u065f\u0670]/g, '');
  function invitation(data, id) {
    if (!/^g_[a-z0-9]+$/.test(id || '') || !data) throw new Error('invalid-invitation');
    const result = { id, university: text(data.university), college: text(data.college), year: String(data.year || '') };
    if (!result.university || result.university.length >= 120 || !result.college || result.college.length >= 120 ||
        !/^20\d{2}$/.test(result.year)) throw new Error('invalid-invitation');
    result.universityId = text(data.universityId);
    result.collegeId = text(data.collegeId);
    return result;
  }
  async function classEmail(id, name) {
    if (!/^g_[a-z0-9]+$/.test(id || '') || normalizedName(name).length < 3) throw new Error('invalid-name');
    const bytes = new TextEncoder().encode(id + '\n' + normalizedName(name));
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('') + '@class.khama.app';
  }
  const privateKey = key => {
    const uid = window.KhamaSignup?.uid();
    return uid ? key + ':' + uid : key + ':guest';
  };
  function read(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem(privateKey(key))) ?? fallback; } catch { return fallback; }
  }
  function write(key, value) { localStorage.setItem(privateKey(key), JSON.stringify(value)); }
  function remove(key) { localStorage.removeItem(privateKey(key)); }
  function measurements(value) {
    if (!value || typeof value !== 'object' || value.kind === 'cap') throw new Error('invalid-measurements');
    const out = { kind: 'robe', gender: value.gender || 'male', savedAt: value.savedAt };
    if (!['male', 'female'].includes(out.gender) || !Number.isFinite(Date.parse(out.savedAt))) throw new Error('invalid-measurements');
    const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    out.bodyLetter = value.bodyLetter || null;
    if (out.bodyLetter && !sizes.includes(out.bodyLetter)) throw new Error('invalid-measurements');
    for (const [key, min, max] of [['bodyNumber', 20, 80], ['shoulder', 20, 80], ['length', 60, 180], ['sleeve', 20, 100]]) {
      const n = value[key];
      if (n != null && (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max)) throw new Error('invalid-measurements');
      out[key] = n ?? null;
    }
    if (out.bodyLetter) {
      const expected = (out.gender === 'male' ? 44 : 34) + 2 * sizes.indexOf(out.bodyLetter);
      if (out.bodyNumber != null && out.bodyNumber !== expected) throw new Error('invalid-measurements');
      out.bodyNumber = expected;
    }
    if (out.bodyNumber == null && out.shoulder == null && out.length == null && out.sleeve == null) throw new Error('invalid-measurements');
    for (const key of ['refLetter', 'refName']) out[key] = text(value[key]).slice(0, 100);
    return out;
  }
  async function saveInvitedProfile(fb, user, ctx, name, phone) {
    // A submitted number is contact information; only SMS Auth verifies ownership.
    // Older name-only accounts can still recover an interrupted profile write.
    if (phone !== undefined && (typeof phone !== 'string' || !/^\+[1-9]\d{7,14}$/.test(phone))) throw new Error('invalid-phone');
    // This batch either stores BOTH the profile and membership, or neither.
    // A map merge preserves classmates, votes and unrelated profile fields.
    const ref = fb.doc(fb.db, 'users', user.uid);
    const existing = await fb.getDoc(ref);
    const old = existing.exists() ? existing.data() : {};
    const now = new Date().toISOString();
    const profile = {
      role: 'student', name: text(name), university: ctx.university, college: ctx.college, year: ctx.year,
      universityId: ctx.universityId || '', collegeId: ctx.collegeId || '',
      groupId: ctx.id, loginClassId: ctx.id, loginMethod: 'class-name', phone: phone ?? old.phone ?? '',
      createdAt: old.createdAt || now, updatedAt: now,
    };
    const batch = fb.writeBatch(fb.db);
    batch.set(ref, profile, { merge: true });
    batch.update(fb.doc(fb.db, 'classGroups', ctx.id), {
      ['members.' + user.uid]: { name: profile.name, joinedAt: now }, updatedAt: now,
    });
    await batch.commit();
    return { ...old, ...profile };
  }
  window.KhamaAccount = { invitation, classEmail, normalizedName, read, write, remove, measurements, saveInvitedProfile };
})();

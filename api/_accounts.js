/* Login accounts (ID + password) — the logic, kept apart from Vercel so it can be tested.
   Files starting with "_" in /api are not routes.

   The browser never sends the password: it sends `key` = PBKDF2(password, id).
   Here that key is hashed again with scrypt + a random salt, so the stored file
   can't be turned back into a password. A good login returns the space code
   (the same code /api/sync uses), so the rest of the app works as before.

   5 wrong passwords → that ID is locked for 15 minutes. */
import crypto from 'node:crypto';

export const ACCOUNTS_PATH = 'app-ideas/accounts.json';
export const spacePath = code => `app-ideas/${crypto.createHash('sha256').update(code).digest('hex')}.json`;

const ID_RX = /^[a-z0-9._-]{3,30}$/;
const HEX64 = /^[a-f0-9]{64}$/;
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const WRONG = 'ID ya password galat hai';

// A space is "real" if it holds the owner's list (ideas may be empty after moving them to Earning).
const isRealSpace = d => !!d && (d.space === 'K' || (Array.isArray(d.ideas) && d.ideas.length > 0));

const scrypt = (key, salt) => crypto.scryptSync(key, salt, 32).toString('hex');
const sameHex = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));

/* store = { read(path) → { data, etag } | null,  write(path, data, etag) → 'ok' | 'conflict' }
   Returns [httpStatus, json]. */
export async function accountAction(body, store, verifyGoogle) {
  const action = body && body.action;
  if (String(action || '').startsWith('google-')) return googleAction(body, store, verifyGoogle);
  const id = String((body && body.id) || '').trim().toLowerCase();
  const key = String((body && body.key) || '').toLowerCase();
  if (!ID_RX.test(id)) return [400, { error: 'ID 3-30 letters ka ho (a-z, 0-9, . _ -)' }];
  if (!HEX64.test(key)) return [400, { error: 'Bad key' }];

  for (let attempt = 0; attempt < 4; attempt++) {
    const cur = await store.read(ACCOUNTS_PATH);
    const db = cur && cur.data && typeof cur.data === 'object' ? cur.data : {};
    const users = db.users && typeof db.users === 'object' ? db.users : (db.users = {});
    const u = users[id];
    const now = Date.now();
    let result;

    if (action === 'create') {
      const space = String(body.space || '').toLowerCase();
      const name = ['K', 'S'].includes(body.name) ? body.name : null;
      if (!HEX64.test(space) || !name) return [400, { error: 'Bad data' }];
      if (u) return [409, { error: 'Ye ID pehle se bana hua hai — doosra ID chuno' }];
      // Only someone who already has the real shared list can make an account for it.
      const sp = await store.read(spacePath(space));
      if (!sp || !isRealSpace(sp.data)) return [403, { error: 'Pehle sahi code se login karo' }];
      const salt = crypto.randomBytes(16).toString('hex');
      users[id] = { salt, hash: scrypt(key, salt), space, name, fails: 0, lockUntil: 0, createdAt: now };
      result = [200, { ok: true, name }];
    } else if (action === 'login' || action === 'change') {
      if (!u) return [401, { error: WRONG }];
      if (u.lockUntil > now) return [429, { error: `Bahut baar galat password — ${Math.ceil((u.lockUntil - now) / 60000)} min baad try karo` }];
      if (!sameHex(scrypt(key, u.salt), u.hash)) {
        u.fails = (u.fails || 0) + 1;
        if (u.fails >= MAX_FAILS) { u.fails = 0; u.lockUntil = now + LOCK_MS; }
        result = [401, { error: WRONG }];
      } else if (action === 'change') {
        const newKey = String(body.newKey || '').toLowerCase();
        if (!HEX64.test(newKey)) return [400, { error: 'Bad key' }];
        u.salt = crypto.randomBytes(16).toString('hex');
        u.hash = scrypt(newKey, u.salt);
        u.fails = 0;
        result = [200, { ok: true }];
      } else {
        if (!u.fails) return [200, { space: u.space, name: u.name }]; // nothing to save
        u.fails = 0;
        result = [200, { space: u.space, name: u.name }];
      }
    } else {
      return [400, { error: 'Unknown action' }];
    }

    const saved = await store.write(ACCOUNTS_PATH, db, cur ? cur.etag : null);
    if (saved === 'conflict') continue; // someone else saved at the same moment → redo
    return result;
  }
  return [503, { error: 'Busy, phir try karo' }];
}

/* ----- 🔐 Google login -----
   db.google[sub] = { email, space, name, earn: { code, id } | null, linkedAt }
   google-link     { credential, space, earn? }  → link this Google account to the list (+ Earning)
   google-login    { credential }                → { space, name, earn, email }
   google-unlink   { credential }
   google-set-earn { space, earn }               → after Earning's ID/password changes (space code = proof) */
const cleanEarn = e => (e && HEX64.test(String(e.code || '').toLowerCase()) && ID_RX.test(String(e.id || ''))
  ? { code: String(e.code).toLowerCase(), id: String(e.id) } : null);

async function googleAction(body, store, verifyGoogle) {
  const action = body.action;
  let who = null;
  if (action !== 'google-set-earn') {
    if (!verifyGoogle) return [500, { error: 'Google login set nahi hai' }];
    who = await verifyGoogle(String(body.credential || ''));
    if (!who) return [401, { error: 'Google login check nahi hua — phir try karo' }];
  }
  const space = String(body.space || '').toLowerCase();
  const earn = cleanEarn(body.earn);
  if (action === 'google-link' || action === 'google-set-earn') {
    if (!HEX64.test(space)) return [400, { error: 'Bad data' }];
    const sp = await store.read(spacePath(space));
    if (!sp || !isRealSpace(sp.data)) return [403, { error: 'Pehle sahi code se login karo' }];
    if (earn) {
      const ep = await store.read(spacePath(earn.code));
      if (!ep || !ep.data || ep.data.kind !== 'earning' || ep.data.moved) return [400, { error: 'Earning data nahi mila' }];
    }
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    const cur = await store.read(ACCOUNTS_PATH);
    const db = cur && cur.data && typeof cur.data === 'object' ? cur.data : {};
    const g = db.google && typeof db.google === 'object' ? db.google : (db.google = {});
    let result;
    if (action === 'google-login') {
      const u = g[who.sub];
      if (!u) return [404, { error: `${who.email} abhi kisi list se juda nahi hai. Purane device pe Dashboard → "Google se jodo" karo.` }];
      return [200, { space: u.space, name: u.name, earn: u.earn || null, email: u.email }];
    } else if (action === 'google-link') {
      const old = g[who.sub];
      g[who.sub] = { email: who.email, space, name: 'K', earn: earn || (old && old.space === space ? old.earn : null) || null, linkedAt: Date.now() };
      result = [200, { ok: true, email: who.email, earn: !!g[who.sub].earn }];
    } else if (action === 'google-unlink') {
      if (!g[who.sub]) return [200, { ok: true }];
      delete g[who.sub];
      result = [200, { ok: true }];
    } else if (action === 'google-set-earn') {
      const mine = Object.values(g).filter(u => u.space === space);
      if (!mine.length) return [200, { ok: true, linked: 0 }];
      mine.forEach(u => { u.earn = earn; });
      result = [200, { ok: true, linked: mine.length }];
    } else {
      return [400, { error: 'Unknown action' }];
    }
    const saved = await store.write(ACCOUNTS_PATH, db, cur ? cur.etag : null);
    if (saved === 'conflict') continue;
    return result;
  }
  return [503, { error: 'Busy, phir try karo' }];
}

/* Checks a Google sign-in token with Google itself. Returns { sub, email } or null. */
export function makeGoogleVerifier(clientId, fetchFn = fetch) {
  return async credential => {
    if (!clientId || !credential || credential.length > 4096) return null;
    try {
      const r = await fetchFn('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
      if (!r.ok) return null;
      const t = await r.json();
      const okIss = t.iss === 'accounts.google.com' || t.iss === 'https://accounts.google.com';
      if (t.aud !== clientId || !okIss || String(t.email_verified) !== 'true' || Number(t.exp) * 1000 < Date.now() || !t.sub) return null;
      return { sub: String(t.sub), email: String(t.email || '') };
    } catch { return null; }
  };
}

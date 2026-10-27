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

const scrypt = (key, salt) => crypto.scryptSync(key, salt, 32).toString('hex');
const sameHex = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));

/* store = { read(path) → { data, etag } | null,  write(path, data, etag) → 'ok' | 'conflict' }
   Returns [httpStatus, json]. */
export async function accountAction(body, store) {
  const action = body && body.action;
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
      if (!sp || !sp.data || !Array.isArray(sp.data.ideas) || !sp.data.ideas.length) return [403, { error: 'Pehle sahi code se login karo' }];
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

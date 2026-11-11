/* Login API (runs on Vercel).
   POST /api/account  { action: 'create' | 'login' | 'change', id, key, ... }
   See _accounts.js for how passwords are protected. The accounts file is a
   PRIVATE Vercel Blob and can't be reached through /api/sync. */
import { kv } from './_kv.js';
import { accountAction, makeGoogleVerifier } from './_accounts.js';
import { GOOGLE_CLIENT_ID } from './_google.js';

const verifyGoogle = makeGoogleVerifier(process.env.GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID);

// The accounts list lives in Upstash Redis (the old Vercel Blob store hit the free plan's limits).
const store = {
  async read(pathname) {
    const found = await kv.get(pathname);
    return found ? { data: JSON.parse(found.text), etag: found.etag } : null;
  },
  async write(pathname, data, etag) {
    const saved = await kv.put(pathname, JSON.stringify(data), etag || '');
    return saved.ok ? 'ok' : 'conflict';
  },
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const [status, json] = await accountAction(body || {}, store, verifyGoogle);
    return res.status(status).json(json);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Login server error' });
  }
}

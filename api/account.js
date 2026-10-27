/* Login API (runs on Vercel).
   POST /api/account  { action: 'create' | 'login' | 'change', id, key, ... }
   See _accounts.js for how passwords are protected. The accounts file is a
   PRIVATE Vercel Blob and can't be reached through /api/sync. */
import { get, put } from '@vercel/blob';
import { accountAction } from './_accounts.js';

const strongEtag = tag => (tag ? String(tag).replace(/^W\//, '') : tag);

const store = {
  async read(pathname) {
    const found = await get(pathname, { access: 'private', useCache: false });
    if (!found) return null;
    const text = await new Response(found.stream).text();
    return { data: JSON.parse(text), etag: strongEtag(found.blob.etag) };
  },
  async write(pathname, data, etag) {
    const options = { access: 'private', contentType: 'application/json', addRandomSuffix: false, cacheControlMaxAge: 60 };
    if (etag) options.ifMatch = strongEtag(etag);
    else options.allowOverwrite = false;
    try {
      await put(pathname, JSON.stringify(data), options);
      return 'ok';
    } catch (err) {
      const msg = String(err && err.message);
      if (err?.name === 'BlobPreconditionFailedError' || /precondition|already exists/i.test(msg)) return 'conflict';
      throw err;
    }
  },
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const [status, json] = await accountAction(body || {}, store);
    return res.status(status).json(json);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Login server error' });
  }
}

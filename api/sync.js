/* Cloud sync API (runs on Vercel).
   GET  /api/sync  → returns { data, etag } for your sync code
   PUT  /api/sync  → saves { data, etag } (only if nobody saved in between → else 409)

   The app turns your password into a long code (PBKDF2) and sends only that code.
   Your data is stored in a PRIVATE Vercel Blob file whose name is a hash of the code,
   so only someone who knows the password can read or change it. */

import { get, put } from '@vercel/blob';
import crypto from 'node:crypto';

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB of ideas is a LOT

// Reads can return a "weak" tag like W/"abc"; saving needs the plain "abc" form.
const strongEtag = tag => (tag ? String(tag).replace(/^W\//, '') : tag);

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*'); // auth is the secret header, not cookies
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-sync-key');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Cache-Control', 'no-store');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  // The code made from your password (64 letters/numbers). It can't be guessed.
  const code = String(req.headers['x-sync-key'] || '').toLowerCase().replace(/[^a-f0-9]/g, '');
  if (code.length !== 64) return res.status(401).json({ error: 'Missing sync code' });
  const pathname = `app-ideas/${crypto.createHash('sha256').update(code).digest('hex')}.json`;

  try {
    if (req.method === 'GET') {
      const found = await get(pathname, { access: 'private', useCache: false });
      if (!found) return res.status(200).json({ data: null, etag: null });
      const text = await new Response(found.stream).text();
      return res.status(200).json({ data: JSON.parse(text), etag: strongEtag(found.blob.etag) });
    }

    if (req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || typeof body.data !== 'object' || !Array.isArray(body.data.ideas)) {
        return res.status(400).json({ error: 'Bad data' });
      }
      const json = JSON.stringify(body.data);
      if (Buffer.byteLength(json) > MAX_BYTES) return res.status(413).json({ error: 'Data too large' });

      const options = {
        access: 'private',
        contentType: 'application/json',
        addRandomSuffix: false,
        cacheControlMaxAge: 60,
      };
      // First save → must not exist yet. Later saves → only if unchanged since we read it.
      if (body.etag) options.ifMatch = strongEtag(body.etag);
      else options.allowOverwrite = false;

      try {
        const saved = await put(pathname, json, options);
        return res.status(200).json({ etag: strongEtag(saved.etag) });
      } catch (err) {
        const msg = String(err && err.message);
        if (err?.name === 'BlobPreconditionFailedError' || /precondition|already exists/i.test(msg)) {
          return res.status(409).json({ error: 'Changed on another device – pull and retry' });
        }
        throw err;
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Sync server error' });
  }
}

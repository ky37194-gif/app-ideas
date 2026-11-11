/* Shared cloud-sync endpoint (runs on Vercel), used by /api/sync (App Ideas) and /api/sm-sync (Content Planner).
   GET → { data, etag } for your sync code.  PUT { data, etag } → saves, only if nobody saved in between (else 409).
   The stored key is a hash of your code, so only someone who knows the code can read or change it. */
import crypto from 'node:crypto';
import { kv } from './_kv.js';

const MAX_BYTES = 4 * 1024 * 1024;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*'); // auth is the secret header, not cookies
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-sync-key');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Cache-Control', 'no-store');
}

/** @param {{ folder: string, cleanCode: (raw: string) => string | null }} opts */
export function makeSyncHandler({ folder, cleanCode }) {
  return async function handler(req, res) {
    cors(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    const code = cleanCode(String(req.headers['x-sync-key'] || ''));
    if (!code) return res.status(401).json({ error: 'Missing sync code' });
    const name = `${folder}/${crypto.createHash('sha256').update(code).digest('hex')}`;
    try {
      if (req.method === 'GET') {
        const found = await kv.get(name);
        if (!found) return res.status(200).json({ data: null, etag: null });
        return res.status(200).json({ data: JSON.parse(found.text), etag: found.etag });
      }
      if (req.method === 'PUT') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        if (!body || typeof body.data !== 'object' || !Array.isArray(body.data.ideas)) return res.status(400).json({ error: 'Bad data' });
        const json = JSON.stringify(body.data);
        if (Buffer.byteLength(json) > MAX_BYTES) return res.status(413).json({ error: 'Data too large' });
        const saved = await kv.put(name, json, body.etag || '');
        if (!saved.ok) return res.status(409).json({ error: 'Changed on another device – pull and retry' });
        return res.status(200).json({ etag: saved.etag });
      }
      return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Sync server error' });
    }
  };
}

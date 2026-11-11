/* Tiny key-value store on Upstash Redis (free plan, set up through Vercel → Storage).
   Replaces the old Vercel Blob files, which hit the free plan's limits.
   Every value has an etag: a save only works if nobody saved in between (else "conflict").
   Keys are prefixed with "appideas:" because the same Redis also holds another app's data. */
import crypto from 'node:crypto';

const PREFIX = 'appideas:';

// Vercel adds KV_REST_API_URL / KV_REST_API_TOKEN (maybe with a custom prefix) when the store is connected.
function creds() {
  const env = process.env;
  const url = env.KV_REST_API_URL || Object.entries(env).find(([k]) => k.endsWith('KV_REST_API_URL'))?.[1];
  const token = env.KV_REST_API_TOKEN || Object.entries(env).find(([k]) => k.endsWith('KV_REST_API_TOKEN') && !k.includes('READ_ONLY'))?.[1];
  if (!url || !token) throw new Error('Redis is not connected (KV_REST_API_URL / KV_REST_API_TOKEN missing)');
  return { url: url.replace(/\/$/, ''), token };
}

async function redis(command) {
  const { url, token } = creds();
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error('Redis error: ' + (json.error || res.status));
  return json.result;
}

// Save only if the stored etag still matches (empty expected = must not exist yet). Returns 1 = saved, 0 = conflict.
const SAVE_SCRIPT = `
local cur = redis.call('GET', KEYS[2])
if ARGV[2] == '' then
  if cur then return 0 end
elseif cur ~= ARGV[2] then
  return 0
end
redis.call('SET', KEYS[1], ARGV[1])
redis.call('SET', KEYS[2], ARGV[3])
return 1`;

export const kv = {
  /** @returns {Promise<{text: string, etag: string} | null>} */
  async get(name) {
    const [text, etag] = await redis(['MGET', PREFIX + name, PREFIX + name + ':etag']);
    return text == null ? null : { text, etag: etag || '' };
  },
  /** @returns {Promise<{ok: true, etag: string} | {ok: false}>} */
  async put(name, text, expectedEtag) {
    const etag = crypto.randomBytes(12).toString('hex');
    const saved = await redis(['EVAL', SAVE_SCRIPT, '2', PREFIX + name, PREFIX + name + ':etag', text, expectedEtag || '', etag]);
    return saved === 1 ? { ok: true, etag } : { ok: false };
  },
};

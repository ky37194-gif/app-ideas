/*
  Vercel serverless function: the shared "space" that you and your brother sync with.
  URL: https://app-ideas-beta.vercel.app/api/data

  Data is kept in a secret GitHub Gist. Secrets live in Vercel environment variables
  (never sent to phones/browsers):
    SPACE_KEY    - the invite code. Every request must send it in the "X-Space-Key" header.
    GITHUB_TOKEN - GitHub token that can read/write gists.
    GIST_ID      - id of the gist that stores the data.

  GET  -> returns { ideas, deleted }
  POST -> body { ideas, deleted } from a device; merged with the stored data,
          saved, and the merged result is returned (so the device gets others' changes).
*/
const crypto = require('crypto');

const FILE = 'app-ideas-space.json';
const DAY = 24 * 60 * 60 * 1000;

// Compare invite codes without leaking timing information.
function sameKey(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

async function github(path, options = {}) {
  const res = await fetch('https://api.github.com' + path, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + process.env.GITHUB_TOKEN,
      'User-Agent': 'app-ideas-tracker',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) throw new Error('GitHub ' + res.status);
  return res.json();
}

async function readData() {
  const gist = await github('/gists/' + process.env.GIST_ID);
  const file = gist.files[FILE];
  if (!file) return { ideas: [], deleted: {} };
  const text = file.truncated ? await (await fetch(file.raw_url)).text() : file.content;
  return clean(JSON.parse(text || '{}'));
}

async function writeData(data) {
  await github('/gists/' + process.env.GIST_ID, {
    method: 'PATCH',
    body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(data) } } }),
  });
}

// Keep only well-formed data.
function clean(body) {
  const ideas = Array.isArray(body && body.ideas)
    ? body.ideas.filter(i => i && typeof i.id === 'string' && typeof i.updatedAt === 'number')
    : [];
  const deleted = {};
  if (body && body.deleted && typeof body.deleted === 'object') {
    for (const [id, t] of Object.entries(body.deleted)) if (typeof t === 'number') deleted[id] = t;
  }
  return { ideas, deleted };
}

// Same rules as the app: newer idea wins; a delete wins if it is newer than the idea.
function mergeData(a, b) {
  const deleted = { ...a.deleted };
  Object.entries(b.deleted).forEach(([id, t]) => { deleted[id] = Math.max(deleted[id] || 0, t); });
  Object.keys(deleted).forEach(id => { if (Date.now() - deleted[id] > 90 * DAY) delete deleted[id]; });

  const byId = new Map();
  [...a.ideas, ...b.ideas].forEach(idea => {
    const current = byId.get(idea.id);
    if (!current || idea.updatedAt > current.updatedAt) byId.set(idea.id, idea);
  });
  const ideas = [...byId.values()].filter(i => !(deleted[i.id] && deleted[i.id] >= i.updatedAt));
  return { ideas, deleted };
}

function fingerprint(data) {
  const ideas = [...data.ideas].sort((x, y) => (x.id < y.id ? -1 : 1));
  const deleted = Object.keys(data.deleted).sort().map(k => [k, data.deleted[k]]);
  return JSON.stringify([ideas, deleted]);
}

module.exports = async function handler(req, res) {
  // Allow the Android app and the GitHub Pages site to call this too.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Space-Key');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!process.env.SPACE_KEY || !sameKey(req.headers['x-space-key'], process.env.SPACE_KEY)) {
    return res.status(401).json({ error: 'Wrong invite code' });
  }

  try {
    const stored = await readData();
    if (req.method === 'GET') return res.status(200).json(stored);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const merged = mergeData(stored, clean(body));
    if (fingerprint(merged) !== fingerprint(stored)) await writeData(merged);
    return res.status(200).json(merged);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error, try again' });
  }
};

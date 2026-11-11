/* 📣 Content Planner cloud sync (the planner inside App Ideas → #/sm). Same rules as the planner's own
   /api/sync: the code is letters/numbers, at least 16 long. Stored in Upstash Redis (see _kv.js). */
import { makeSyncHandler } from './_synchandler.js';

export default makeSyncHandler({
  folder: 'planner',
  cleanCode: raw => { const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, ''); return c.length >= 16 ? c : null; },
});

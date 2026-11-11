/* App Ideas cloud sync: GET / PUT your list. The app turns your password into a 64-letter code (PBKDF2)
   and sends only that code. Stored in Upstash Redis (see _kv.js). */
import { makeSyncHandler } from './_synchandler.js';

export default makeSyncHandler({
  folder: 'app-ideas',
  cleanCode: raw => { const c = raw.toLowerCase().replace(/[^a-f0-9]/g, ''); return c.length === 64 ? c : null; },
});

import context from '../functions/_lib/client-context.js';
import renewal from '../functions/_lib/lcp-dm-refresh.js';
export default async () => {
  try { await renewal.refreshPortraitToken(context.supabaseQuery); }
  catch { throw new Error('Little Companion Instagram connection renewal needs attention'); }
};
export const config = { schedule: '0 19 * * *' };

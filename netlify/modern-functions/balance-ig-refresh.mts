import context from '../functions/_lib/client-context.js';
import renewal from '../functions/_lib/balance-ig-refresh.js';
export default async () => {
  try { await renewal.refreshBalanceToken(context.supabaseQuery); }
  catch { throw new Error('Balance Instagram connection renewal needs attention'); }
};
export const config = { schedule: '15 19 * * *' };

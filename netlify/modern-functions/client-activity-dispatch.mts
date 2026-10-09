import { rpc, dispatch, response } from '../functions/_lib/client-activity-alerts.mjs';

// Netlify scheduled functions have no public HTTP endpoint. No webhook secret needed.
export default async function handler() {
  try {
    await rpc('balance_activity_materialize', {});
    const result = await dispatch({ limit: 3 });
    return response(200, result);
  } catch { return response(503, { error: 'activity_dispatch_unavailable' }); }
}
export const config = { schedule: '* * * * *' };

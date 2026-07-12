/** Scheduled weekly-goal processor. The database selects members at local Monday. */
const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = require('./_lib/client-context');

exports.handler = async () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Supabase service credentials are not configured');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/process_due_weekly_goal_rewards`, {
    method: 'POST',
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Weekly-goal reward processor failed: ${response.status} ${body}`);
  console.log('[award-weekly-goal-rewards]', body);
  return { statusCode: 200, body };
};

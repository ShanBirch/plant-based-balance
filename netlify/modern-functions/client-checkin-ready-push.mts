import type { Config } from '@netlify/functions';
import context from '../functions/_lib/client-context.js';
import push from '../functions/_lib/client-checkin-push.js';

export default async () => {
    // Atomic database claims enforce one reminder even for overlapping runs.
    const rows = await context.supabaseQuery('rpc/claim_client_checkin_pushes', { method: 'POST', body: {} });
    let sent = 0;
    for (let i = 0; i < rows.length; i += 20) {
        const results = await Promise.all(rows.slice(i, i + 20).map((row: any) =>
            push.deliver(row, context.supabaseQuery, async (payload: any) => {
                const response = await fetch(`${Netlify.env.get('URL') || 'https://plantbased-balance.org'}/.netlify/functions/send-dm-notification`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload), signal: AbortSignal.timeout(15000),
                });
                if (!response.ok) throw new Error('Push transport failed');
                return response.json();
            })
        ));
        sent += results.filter(Boolean).length;
    }
    return Response.json({ claimed: rows.length, sent });
};
// Brisbane 08:00-20:45. The database checks Wednesday/Friday-Sunday and
// excludes completed/previously claimed check-ins, including late registrations.
export const config: Config = { schedule: '*/15 0-10,22-23 * * *' };

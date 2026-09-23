const { createHash, timingSafeEqual } = require('node:crypto');

const uuid = value => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value || '');
const numeric = value => /^\d+$/.test(value || '');
const time = value => Date.parse(value || '');

function reply(status, body) {
    return new Response(JSON.stringify(body), { status, headers: {
        'Content-Type': 'application/json', 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    } });
}

// Each unguessable access code maps to ONE server-selected test conversation.
// Neither the browser nor the reviewer supplies a Page, recipient or thread ID.
function createReviewHandler({ query, send, now = Date.now }) {
    return async function review(request) {
        if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });
        if (request.headers.get('sec-fetch-site') === 'cross-site') return reply(403, { error: 'Cross-site request refused.' });
        const code = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/i)?.[1];
        if (!code) return reply(401, { error: 'Enter your review access code.' });
        try {
            const hash = createHash('sha256').update(code).digest('hex');
            const [secret] = await query(`app_private_secrets?select=value&key=eq.messenger_review_${hash}&limit=1`);
            let grant;
            try { grant = JSON.parse(secret?.value || 'null'); } catch { grant = null; }
            if (!grant || grant.enabled !== true || !uuid(grant.thread_id) || !numeric(grant.page_id)
                || !numeric(grant.psid) || !Number.isFinite(time(grant.since))
                || !Number.isFinite(time(grant.expires_at)) || time(grant.expires_at) <= now()
                || time(grant.since) > now()) return reply(403, { error: 'Review access is unavailable or expired.' });
            const raw = await request.text();
            if (raw.length > 6000) return reply(413, { error: 'Request too large.' });
            let body;
            try { body = JSON.parse(raw); } catch { return reply(400, { error: 'Invalid request.' }); }
            if (!body || !['read', 'send'].includes(body.action)
                || Object.keys(body).some(k => !['action', 'revision', 'text'].includes(k))) {
                return reply(400, { error: 'Unsupported request.' });
            }
            const [thread] = await query(`ig_threads?select=id,channel,subscriber_id,linked_user_id,custom_data,last_inbound_at&id=eq.${grant.thread_id}&limit=1`);
            const route = thread?.custom_data?.facebook_messenger;
            if (!thread || thread.linked_user_id || thread.channel !== 'messenger'
                || route?.page_id !== grant.page_id || route?.psid !== grant.psid
                || thread.subscriber_id !== `fb_graph:${grant.page_id}:${grant.psid}`) {
                return reply(403, { error: 'Test conversation identity does not match.' });
            }
            const since = encodeURIComponent(new Date(time(grant.since)).toISOString());
            const messages = await query(`ig_messages?select=id,direction,text,created_at&thread_id=eq.${grant.thread_id}&created_at=gte.${since}&order=created_at.desc&limit=60`);
            const alerts = await query(`coach_alerts?select=id,status,data,created_at,client_id,alert_type&data->>ig_thread_id=eq.${grant.thread_id}&status=eq.pending&created_at=gte.${since}&order=created_at.desc&limit=1`);
            const alert = alerts[0];
            const latest = messages[0];
            const draft = alert?.data?.draft_text;
            const windowOpen = Number.isFinite(time(thread.last_inbound_at)) && time(thread.last_inbound_at) <= now()
                && now() - time(thread.last_inbound_at) < 24 * 60 * 60 * 1000;
            const eligible = !!(alert && !alert.client_id && alert.alert_type === 'fb_incoming_dm'
                && alert.data?.ig_thread_id === grant.thread_id && latest?.direction === 'in'
                && alert.data?.channel === 'messenger'
                && time(alert.data.source_inbound_created_at || alert.data.drafted_at || alert.created_at) >= time(latest.created_at)
                && typeof draft === 'string' && draft.trim());
            // A digest prevents exposing the sender's alert capability to a reviewer.
            const revision = eligible ? createHash('sha256').update(JSON.stringify([alert.id, latest.id, draft])).digest('hex') : null;
            if (body.action === 'read') return reply(200, {
                page: 'Balance APP', label: 'Controlled Messenger test conversation',
                messages: [...messages].reverse().map(m => ({ direction: m.direction, text: String(m.text || ''), at: m.created_at })),
                draft: eligible ? draft : '', revision, canSend: eligible && windowOpen,
                status: !windowOpen ? 'Send a new message in Messenger to open the 24-hour reply window.'
                    : eligible ? 'Review the draft, then send it to the test conversation.'
                        : 'Waiting for a new incoming message and its draft.',
            });
            if (!eligible || !windowOpen || typeof body.revision !== 'string'
                || !/^[a-f0-9]{64}$/.test(body.revision)
                || !timingSafeEqual(Buffer.from(revision), Buffer.from(body.revision))) {
                return reply(409, { error: 'Conversation changed or reply window closed. Refresh before sending.' });
            }
            if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 1800) return reply(400, { error: 'Use a reply between 1 and 1800 characters.' });
            // Existing guarded sender retains its atomic claim, duplicate prevention,
            // Page-scoped delivery, media contract and canonical receipt handling.
            const result = await send({ httpMethod: 'POST', headers: {}, body: JSON.stringify({
                alertId: alert.id, replyText: body.text.trim(), draftText: draft,
                source: 'admin_dashboard_messenger_review', forceText: true,
                editReason: 'Manually reviewed in the restricted Messenger review inbox.',
            }) });
            let receipt;
            try { receipt = JSON.parse(result.body); } catch { receipt = null; }
            if (result.statusCode < 200 || result.statusCode >= 300 || receipt?.ok !== true
                || receipt.delivery_transport !== 'facebook_messenger'
                || !(receipt.chunks_sent > 0) || receipt.chunks_sent !== receipt.chunks_total) return reply(result.statusCode >= 500 ? 502 : 409,
                { error: 'The guarded sender did not confirm delivery. Refresh and check the test conversation before retrying.' });
            return reply(200, { sent: true, status: 'Reply sent. Verify it in Messenger.' });
        } catch {
            // Never return internal payloads, tokens, customer identifiers or provider errors.
            return reply(503, { error: 'Review inbox temporarily unavailable. Try refreshing.' });
        }
    };
}

module.exports = { createReviewHandler };

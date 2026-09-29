// Read-only canonical inbox packets and fail-closed local manager receipts.
// No transport credentials, sends, or policy overrides live in this helper.
const fs = require('node:fs');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 25;

function inboxSql(offset = 0, threadId = null) {
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid offset');
    if (threadId && !UUID.test(threadId)) throw new Error('Invalid thread ID');
    return `WITH candidates AS (
 SELECT t.id, t.ig_username, t.profile_name, t.linked_user_id,
        t.coach_instructions, t.custom_data, latest.id AS latest_inbound_id,
        latest.created_at AS latest_inbound_at, outgoing.created_at AS last_outbound_at
 FROM public.ig_threads t
 JOIN LATERAL (SELECT id, direction, created_at FROM public.ig_messages
   WHERE thread_id=t.id ORDER BY created_at DESC, id DESC LIMIT 1) latest ON latest.direction='in'
 LEFT JOIN LATERAL (SELECT created_at FROM public.ig_messages
   WHERE thread_id=t.id AND direction='out' ORDER BY created_at DESC, id DESC LIMIT 1) outgoing ON true
 WHERE ${threadId ? `t.id='${threadId}'::uuid` : `(latest.created_at > now()-interval '7 days' OR EXISTS (
   SELECT 1 FROM public.coach_alerts a WHERE a.data->>'ig_thread_id'=t.id::text
   AND a.status IN ('pending','scheduled')))`}
), page AS (SELECT * FROM candidates ORDER BY latest_inbound_at DESC, id LIMIT ${PAGE_SIZE} OFFSET ${offset}),
packets AS (
 SELECT jsonb_build_object(
  'thread_id',t.id,'ig_username',t.ig_username,'profile_name',t.profile_name,
  'linked_user_id',t.linked_user_id,'coach_instructions',t.coach_instructions,
  'latest_inbound_id',t.latest_inbound_id,'last_outbound_at',t.last_outbound_at,
  'policy',jsonb_build_object('manual_review_only',t.custom_data->'manual_review_only',
    'permanent_needs_you_draft_only',t.custom_data->'permanent_needs_you_draft_only',
    'operator_lock',t.custom_data->'operator_lock',
    'client_manager_auto_reply_enabled',t.custom_data->'client_manager_auto_reply_enabled'),
  'unanswered', (SELECT jsonb_agg(jsonb_build_object('id',m.id,'thread_id',m.thread_id,
    'text',m.text,'created_at',m.created_at) ORDER BY m.created_at,m.id)
    FROM public.ig_messages m WHERE m.thread_id=t.id AND m.direction='in'
    AND (t.last_outbound_at IS NULL OR m.created_at > t.last_outbound_at)),
  'alerts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,
    'thread_id',a.data->>'ig_thread_id','status',a.status,'suggested_message',a.suggested_message,
    'review',a.data->'draft_review','scheduled_for',a.scheduled_for,
    'operator_queue',a.data->>'operator_queue','needs_you_reason',a.data->>'needs_you_reason',
    'source_message_id',a.data->>'manychat_message_id') ORDER BY a.created_at DESC)
    FROM public.coach_alerts a WHERE a.data->>'ig_thread_id'=t.id::text
    AND a.status IN ('pending','scheduled')),'[]'::jsonb),
  'action',(SELECT jsonb_build_object('id',a.id,'thread_id',a.thread_id,'owner',a.owner,
    'status',a.status,'source_message_id',a.source_message_id,'claim_expires_at',a.claim_expires_at)
    FROM public.ig_next_actions a WHERE a.thread_id=t.id LIMIT 1)
 ) AS packet, t.latest_inbound_at,t.id FROM page t
)
SELECT jsonb_build_object('version',1,'captured_at',now(),'offset',${offset},
 'total',(SELECT count(*) FROM candidates),'page_size',${PAGE_SIZE},
 'packets',coalesce((SELECT jsonb_agg(packet ORDER BY latest_inbound_at DESC,id) FROM packets),'[]'::jsonb)) AS snapshot;`;
}

function requireSame(actual, expected, name) {
    if (actual !== expected) throw new Error(`Canonical ${name} mismatch`);
}

function validateReceipt(snapshot, receipts, { now = Date.now(), partial = false } = {}) {
    if (snapshot?.version !== 1 || !Array.isArray(snapshot.packets) || !Array.isArray(receipts)) {
        throw new Error('Expected canonical snapshot and receipt array');
    }
    const age = now - Date.parse(snapshot.captured_at);
    if (!Number.isFinite(age) || age < -60000 || age > 9 * 60000) throw new Error('Stale snapshot: reload live inbox');
    const packets = new Map();
    const messageIds = new Set();
    for (const p of snapshot.packets) {
        if (!UUID.test(p.thread_id) || packets.has(p.thread_id) || !p.unanswered?.length) throw new Error('Invalid packet');
        for (const m of p.unanswered) {
            requireSame(m.thread_id, p.thread_id, 'message thread');
            if (!UUID.test(m.id) || messageIds.has(m.id)) throw new Error('Duplicate/invalid source ID');
            messageIds.add(m.id);
        }
        requireSame(p.unanswered.at(-1).id, p.latest_inbound_id, 'latest inbound');
        for (const a of p.alerts || []) requireSame(a.thread_id, p.thread_id, 'alert thread');
        if (p.action) requireSame(p.action.thread_id, p.thread_id, 'controller thread');
        packets.set(p.thread_id, p);
    }
    const seen = new Set();
    for (const r of receipts) {
        const p = packets.get(r.thread_id);
        if (!p || seen.has(r.thread_id)) throw new Error('Unknown/duplicate receipt thread');
        seen.add(r.thread_id);
        // Identity and quoted source text travel together; never trust names from memory.
        for (const field of ['ig_username','profile_name','linked_user_id','latest_inbound_id']) {
            requireSame(r[field], p[field], field);
        }
        requireSame(JSON.stringify(r.unanswered), JSON.stringify(p.unanswered), 'unanswered batch');
        if (!['sent','scheduled','needs_you','waiting','no_reply','external_owner','failed'].includes(r.outcome)) {
            throw new Error('Explicit outcome required');
        }
        if (typeof r.reason !== 'string' || !r.reason.trim()) throw new Error('Outcome reason required');
        if (r.outcome === 'needs_you' && r.hold_kind === 'permanent_manual') {
            const linkedMatch = p.linked_user_id && r.manual_user_id === p.linked_user_id;
            const flagged = p.policy?.manual_review_only === true || p.policy?.permanent_needs_you_draft_only === true;
            if (!linkedMatch && !flagged) throw new Error('Permanent manual hold lacks exact identity evidence');
        }
        if (['sent','scheduled'].includes(r.outcome) && (!r.readback_verified || !r.evidence_id)) {
            throw new Error('Delivery/schedule requires canonical readback');
        }
    }
    const missing = [...packets.keys()].filter(id => !seen.has(id));
    const hasMore = snapshot.offset + snapshot.packets.length < snapshot.total;
    const failed = receipts.some(r => r.outcome === 'failed');
    const complete = missing.length === 0 && !hasMore && snapshot.offset === 0 && !failed;
    if (!partial && !complete) throw new Error(`Incomplete inbox pass: ${missing.length} unassessed, more_pages=${hasMore}, failed=${failed}`);
    return { identity_verified: true, action_pass_complete: complete, missing_thread_ids: missing,
        more_pages: hasMore, next_offset: hasMore ? snapshot.offset + snapshot.packets.length : null };
}

module.exports = { inboxSql, validateReceipt };
if (require.main === module) {
    try {
        const [command, a, b, flag] = process.argv.slice(2);
        if (command === 'sql') console.log(inboxSql(Number(a || 0), b || null));
        else if (command === 'validate') console.log(JSON.stringify(validateReceipt(
            JSON.parse(fs.readFileSync(a,'utf8')), JSON.parse(fs.readFileSync(b,'utf8')),
            { partial: flag === '--partial' })));
        else throw new Error('Use sql [offset] [threadId] or validate snapshot.json receipts.json [--partial]');
    } catch (e) { console.error(JSON.stringify({ error:e.message, action_pass_complete:false })); process.exitCode=1; }
}

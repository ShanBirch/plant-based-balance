// Read-only canonical inbox packets and fail-closed local manager receipts.
// No transport credentials, sends, or policy overrides live in this helper.
const fs = require('node:fs');
const path = require('node:path');
// The installed read-only helper keeps a byte-identical module beside it.
const contextModule = path.join(__dirname, '../netlify/functions/_lib/engagement-ai-context.js');
const { HISTORY_LIMIT, buildContext, promptBlock } = require(fs.existsSync(contextModule)
    ? contextModule : './engagement-ai-context.js');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 25;

function inboxSql(offset = 0, threadId = null, pageSize = DEFAULT_PAGE_SIZE) {
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid offset');
    if (threadId && !UUID.test(threadId)) throw new Error('Invalid thread ID');
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) throw new Error('Invalid page size');
    return `WITH candidates AS (
 SELECT t.id, t.ig_username, t.profile_name, t.linked_user_id, t.subscriber_id, t.channel,
        t.goals, t.personal_context, t.running_notes, t.communication_style, t.last_memory_extracted_at,
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
), page AS (SELECT * FROM candidates ORDER BY latest_inbound_at DESC, id LIMIT ${pageSize} OFFSET ${offset}),
packets AS (
 SELECT jsonb_build_object(
  'thread_id',t.id,'ig_username',t.ig_username,'profile_name',t.profile_name,
  'linked_user_id',t.linked_user_id,'coach_instructions',t.coach_instructions,
  'subscriber_id',t.subscriber_id,'channel',t.channel,
  'stored_memory',jsonb_build_object('goals',t.goals,'personal_context',t.personal_context,
    'running_notes',t.running_notes,'communication_style',t.communication_style,
    'last_memory_extracted_at',t.last_memory_extracted_at),
  'history_limit',${HISTORY_LIMIT},
  'history',coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.id,'thread_id',m.thread_id,
    'direction',m.direction,'text',m.text,'source',m.source,'created_at',m.created_at)
    ORDER BY m.created_at,m.id) FROM (SELECT id,thread_id,direction,text,source,created_at
    FROM public.ig_messages WHERE thread_id=t.id ORDER BY created_at DESC,id DESC
    LIMIT ${HISTORY_LIMIT + 1}) m),'[]'::jsonb),
  'latest_inbound_id',t.latest_inbound_id,'last_outbound_at',t.last_outbound_at,
  'policy',jsonb_build_object('manual_review_only',t.custom_data->'manual_review_only',
    'permanent_needs_you_draft_only',t.custom_data->'permanent_needs_you_draft_only',
    'operator_lock',t.custom_data->'operator_lock',
    'no_ai_send',t.custom_data->'no_ai_send',
    'no_ai_schedule',t.custom_data->'no_ai_schedule',
    'codex_ai_opt_out',t.custom_data->'codex_ai_opt_out',
    'customer_lifecycle',t.custom_data->'customer_lifecycle',
    'client_manager_auto_reply_enabled',t.custom_data->'client_manager_auto_reply_enabled'),
  'unanswered', (SELECT jsonb_agg(jsonb_build_object('id',m.id,'thread_id',m.thread_id,
    'text',m.text,'created_at',m.created_at) ORDER BY m.created_at,m.id)
    FROM public.ig_messages m WHERE m.thread_id=t.id AND m.direction='in'
    AND (t.last_outbound_at IS NULL OR m.created_at > t.last_outbound_at)),
  'stale_pending_alert_count',(SELECT count(*) FROM public.coach_alerts a
    WHERE a.data->>'ig_thread_id'=t.id::text AND a.status='pending'
    AND a.created_at < t.last_outbound_at),
  'alerts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,
    'thread_id',a.data->>'ig_thread_id','status',a.status,'suggested_message',a.suggested_message,
    'review',a.data->'draft_review','scheduled_for',a.scheduled_for,
    'operator_queue',a.data->>'operator_queue','needs_you_reason',a.data->>'needs_you_reason',
    'source_message_id',a.data->>'manychat_message_id') ORDER BY a.created_at DESC,a.id DESC)
    FROM public.coach_alerts a WHERE a.data->>'ig_thread_id'=t.id::text
    AND a.status IN ('pending','scheduled')
    AND (a.status='scheduled' OR t.last_outbound_at IS NULL OR a.created_at >= t.last_outbound_at)),'[]'::jsonb),
  'action',(SELECT jsonb_build_object('id',a.id,'thread_id',a.thread_id,'owner',a.owner,
    'status',a.status,'source_message_id',a.source_message_id,'claim_expires_at',a.claim_expires_at)
    FROM public.ig_next_actions a WHERE a.thread_id=t.id LIMIT 1)
 ) AS packet, t.latest_inbound_at,t.id FROM page t
)
SELECT jsonb_build_object('version',1,'scope','${threadId ? 'thread' : 'inbox'}','captured_at',now(),'offset',${offset},
 'total',(SELECT count(*) FROM candidates),'page_size',${pageSize},
 'packets',coalesce((SELECT jsonb_agg(packet ORDER BY latest_inbound_at DESC,id) FROM packets),'[]'::jsonb)) AS snapshot;`;
}

function requireSame(actual, expected, name) {
    if (actual !== expected) throw new Error(`Canonical ${name} mismatch`);
}

// Outbound-bound due follow-ups are context, never fabricated inbound work.
function conversationSql(threadId) {
    if (!UUID.test(threadId || '')) throw new Error('Invalid thread ID');
    return `SELECT jsonb_build_object('version',1,'scope','conversation_context','captured_at',now(),
 'thread_id',t.id,'subscriber_id',t.subscriber_id,'channel',t.channel,'linked_user_id',t.linked_user_id,
 'stored_memory',jsonb_build_object('goals',t.goals,'personal_context',t.personal_context,
   'running_notes',t.running_notes,'communication_style',t.communication_style,
   'last_memory_extracted_at',t.last_memory_extracted_at),
 'history_limit',${HISTORY_LIMIT},'history',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'id',m.id,'thread_id',m.thread_id,'direction',m.direction,'text',m.text,'source',m.source,
   'created_at',m.created_at) ORDER BY m.created_at,m.id) FROM
   (SELECT id,thread_id,direction,text,source,created_at FROM public.ig_messages WHERE thread_id=t.id
    ORDER BY created_at DESC,id DESC LIMIT ${HISTORY_LIMIT + 1}) m),'[]'::jsonb)) AS conversation
FROM public.ig_threads t WHERE t.id='${threadId}'::uuid;`;
}

function contextFromConversation(conversation, expectedThreadId, { now = Date.now() } = {}) {
    if (!UUID.test(expectedThreadId || '')) throw new Error('Invalid thread ID');
    if (conversation?.version !== 1 || conversation.scope !== 'conversation_context'
        || conversation.thread_id !== expectedThreadId || !Array.isArray(conversation.history)) {
        throw new Error('Exact canonical conversation context required');
    }
    const age = now - Date.parse(conversation.captured_at);
    if (!Number.isFinite(age) || age < -60000 || age > 9 * 60000) throw new Error('Stale conversation context');
    if (conversation.history.some(message => message.thread_id !== expectedThreadId)) throw new Error('Conversation source mismatch');
    return buildContext({ thread: { ...(conversation.stored_memory || {}), id: expectedThreadId,
        subscriber_id: conversation.subscriber_id, channel: conversation.channel,
        linked_user_id: conversation.linked_user_id },
        messages: conversation.history.slice(-HISTORY_LIMIT),
        complete: conversation.history_limit === HISTORY_LIMIT && conversation.history.length <= HISTORY_LIMIT });
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
    const assessed = missing.length === 0 && !hasMore && snapshot.offset === 0 && !failed;
    const complete = assessed && snapshot.scope !== 'thread';
    if (!partial && !assessed) throw new Error(`Incomplete inbox pass: ${missing.length} unassessed, more_pages=${hasMore}, failed=${failed}`);
    return { identity_verified: true, action_pass_complete: complete, thread_pass_complete: snapshot.scope === 'thread' && assessed, missing_thread_ids: missing,
        more_pages: hasMore, next_offset: hasMore ? snapshot.offset + snapshot.packets.length : null };
}

// Accept the actual connector result, never a snapshot retyped from prose.
// Its safety preamble mentions the envelope tag too, so require an opening
// tag on its own line and the exact matching closing envelope identifier.
function unwrapSnapshot(input) {
    if (typeof input === 'string') {
        const text = input.trim();
        try { return unwrapSnapshot(JSON.parse(text)); } catch (error) {
            if (!text.startsWith('Below is') && !text.includes('\n<untrusted-data-')) throw error;
        }
        const match = text.match(/(?:^|\n)<untrusted-data-([0-9a-f-]+)>\r?\n([\s\S]*?)\r?\n<\/untrusted-data-\1>(?:\r?\n|$)/i);
        if (!match) throw new Error('Incomplete connector envelope');
        return unwrapSnapshot(JSON.parse(match[2]));
    }
    if (input?.isError) throw new Error('Connector returned an error');
    if (input?.version === 1 && Array.isArray(input.packets)) {
        validateReceipt(input, [], { partial: true });
        return input;
    }
    if (Array.isArray(input) && input.length === 1 && input[0]?.snapshot) return unwrapSnapshot(input[0].snapshot);
    if (input?.snapshot) return unwrapSnapshot(input.snapshot);
    if (typeof input?.result === 'string') return unwrapSnapshot(input.result);
    if (input?.structuredContent) {
        try { return unwrapSnapshot(input.structuredContent); } catch { /* content may contain the canonical result */ }
    }
    const blocks = input?.content?.filter(block => block.type === 'text');
    if (blocks?.length === 1) return unwrapSnapshot(blocks[0].text);
    throw new Error('Canonical snapshot missing from connector result');
}

function enrichSnapshot(snapshot) {
    // Derive context only after validating the canonical packet/source pairing.
    validateReceipt(snapshot, [], { partial: true });
    return { ...snapshot, packets: snapshot.packets.map(packet => {
        const history = packet.history;
        const context = buildContext({ thread: { ...(packet.stored_memory || {}), id: packet.thread_id,
            subscriber_id: packet.subscriber_id, channel: packet.channel, linked_user_id: packet.linked_user_id },
            messages: Array.isArray(history) ? history.slice(-HISTORY_LIMIT) : [],
            complete: Array.isArray(history) && packet.history_limit === HISTORY_LIMIT && history.length <= HISTORY_LIMIT });
        return { ...packet, ai_context: context, ai_context_prompt: promptBlock(context) };
    }) };
}

function receiptFromSnapshot(snapshot, threadId, outcome, reason) {
    const packet = snapshot.packets.find(packet => packet.thread_id === threadId);
    if (!packet) throw new Error('Thread missing from snapshot');
    const receipt = Object.fromEntries(['thread_id','ig_username','profile_name','linked_user_id','latest_inbound_id','unanswered']
        .map(field => [field, packet[field]]));
    Object.assign(receipt, { outcome, reason });
    validateReceipt(snapshot, [receipt], { partial: true });
    return [receipt];
}

module.exports = { inboxSql, validateReceipt, unwrapSnapshot, receiptFromSnapshot, enrichSnapshot,
    conversationSql, contextFromConversation };
if (require.main === module) {
    try {
        const [command, a, b, flag, extra, last] = process.argv.slice(2);
        if (command === 'sql') console.log(inboxSql(Number(a || 0), b || null));
        else if (command === 'context-sql') console.log(conversationSql(a));
        else if (command === 'context') {
            const context = contextFromConversation(JSON.parse(fs.readFileSync(a, 'utf8')), b);
            console.log(promptBlock(context));
        }
        else if (command === 'capture') {
            const snapshot = enrichSnapshot(unwrapSnapshot(fs.readFileSync(a, 'utf8')));
            fs.writeFileSync(b, JSON.stringify(snapshot, null, 2), 'utf8');
            console.log(JSON.stringify({ captured_at: snapshot.captured_at, total: snapshot.total,
                packet_count: snapshot.packets.length, thread_ids: snapshot.packets.map(packet => packet.thread_id) }));
        } else if (command === 'receipt') {
            const snapshot = JSON.parse(fs.readFileSync(a, 'utf8'));
            const receipts = receiptFromSnapshot(snapshot, b, flag, extra);
            fs.writeFileSync(last, JSON.stringify(receipts, null, 2), 'utf8');
            console.log(JSON.stringify({ identity_verified: true, thread_id: b, outcome: flag }));
        }
        else if (command === 'validate') console.log(JSON.stringify(validateReceipt(
            JSON.parse(fs.readFileSync(a,'utf8')), JSON.parse(fs.readFileSync(b,'utf8')),
            { partial: flag === '--partial' })));
        else throw new Error('Use sql [offset] [threadId], context-sql threadId, context conversation.json threadId, capture tool-result.json snapshot.json, receipt snapshot.json threadId outcome reason receipts.json, or validate snapshot.json receipts.json [--partial]');
    } catch (e) { console.error(JSON.stringify({ error:e.message, action_pass_complete:false })); process.exitCode=1; }
}

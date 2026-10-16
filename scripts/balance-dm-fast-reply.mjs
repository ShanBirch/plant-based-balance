import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

function uuid(value) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '')) {
        throw new Error('Verified UUID required');
    }
    return `'${value}'::uuid`;
}

function literal(value) {
    if (typeof value !== 'string' || value.includes('\0')) throw new Error('Valid text required');
    return `'${value.replaceAll("'", "''")}'`;
}

export function fastReplyContext({ threadId, runId }) {
    return `select jsonb_build_object(
        'thread', (select to_jsonb(thread) from ig_threads thread where id=${uuid(threadId)}),
        'messages', (select jsonb_agg(to_jsonb(message) order by created_at,id) from ig_messages message where thread_id=${uuid(threadId)}),
        'actions', (select jsonb_agg(to_jsonb(action)) from ig_next_actions action where thread_id=${uuid(threadId)}),
        'personal_contact', exists(select 1 from ig_personal_contacts contact join ig_threads thread on lower(contact.ig_username)=lower(thread.ig_username) where thread.id=${uuid(threadId)}),
        'shift', (select jsonb_build_object('run_id',run_id,'status',status,'heartbeat_at',heartbeat_at,'lease_expires_at',lease_expires_at,'browser_surface',browser_surface,'binding',cursor_current->'browser_surface') from ig_browser_shift_runs where run_id=${literal(runId)})
    );`;
}

export function fastReplyClaim(input) {
    const { threadId, sourceMessageId, runId, tabId, username, nativeConversationId, finalText } = input;
    if (input.fullThreadReviewed !== true || input.nativeIdentityVerified !== true
        || input.independentHoldsChecked !== true || !input.leadState?.trim()
        || !finalText?.trim() || finalText.length > 4000) {
        throw new Error('Full current review and all independent gates required');
    }
    const reason = JSON.stringify({ policy: 'live_conversation_operator_v1', is_dm: true,
        final_text: finalText, full_thread_reviewed: true, native_identity_verified: true,
        independent_holds_checked: true, native_conversation_id: nativeConversationId,
        internal_test: input.internalTest === true });
    return `with staged as materialized (
        select upsert_ig_next_action(p_thread_id=>${uuid(threadId)},p_ig_username=>${literal(username)},
            p_lead_state=>${literal(input.leadState)},p_owner=>'dm_manager',p_action_type=>'reply_inbound',
            p_priority=>800,p_source_message_id=>${uuid(sourceMessageId)},
            p_reason=>${literal(reason)}::jsonb || jsonb_build_object('reviewed_at',now())) as action
        where (select id from ig_messages where thread_id=${uuid(threadId)} and direction='in' order by created_at desc,id desc limit 1)=${uuid(sourceMessageId)}
    ), claimed as materialized (
        select claim.* from staged cross join lateral claim_ig_next_actions(
            'dm_manager',1,300,${literal(runId)},ARRAY[(staged.action).thread_id]) claim
        where (staged.action).id is not null
    ) select claimed.id,claimed.action_version,claimed.claim_token,claimed.source_message_id,claimed.reason,
        ig_browser_action_owned(${literal(runId)},'meta_business_suite',${literal(tabId)},
            claimed.id,claimed.action_version,claimed.claim_token,claimed.source_message_id) as owned
        from claimed where claimed.source_message_id=${uuid(sourceMessageId)};`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const [operation, inputPath] = process.argv.slice(2);
    const input = JSON.parse(await fs.readFile(inputPath, 'utf8'));
    if (!['context', 'claim'].includes(operation)) throw new Error('Use context or claim with a private JSON input file');
    process.stdout.write(operation === 'context' ? fastReplyContext(input) : fastReplyClaim(input));
}

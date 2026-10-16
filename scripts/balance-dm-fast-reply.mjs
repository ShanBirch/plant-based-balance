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
    return `with target as (
        select thread.*,custom_data->'relationship_memory_compaction' as memory from ig_threads thread where id=${uuid(threadId)}
    ), proof as (
        select coalesce(memory->>'source'='full_ig_history' and length(memory->>'summary')>0
            and (memory->>'last_compacted_at')::timestamptz<=now()
            and (select count(*) from ig_messages where thread_id=target.id and created_at<=(memory->>'last_compacted_at')::timestamptz)=(memory->>'messages_compacted')::integer
            and exists(select 1 from ig_messages where thread_id=target.id
                and created_at=(memory->>'last_compacted_at')::timestamptz
                and 'ig:'||id::text=memory->>'last_compacted_event_key'),false) as valid,
            (memory->>'last_compacted_at')::timestamptz as boundary from target
    ) select jsonb_build_object(
        'thread', (select to_jsonb(target)-'memory' from target),
        'history_proof', (select jsonb_build_object('validated_compaction',valid,'boundary',boundary,
            'mode',case when valid then 'full_history_summary_and_complete_delta' else 'full_raw_history' end) from proof),
        'messages', (select jsonb_agg(jsonb_build_object('id',id,'direction',direction,'text',text,
            'created_at',created_at,'source',source,'author_type',author_type,'delivery_origin',delivery_origin) order by created_at,id)
            from ig_messages message where thread_id=${uuid(threadId)}
            and (not coalesce((select valid from proof),false) or created_at>(select boundary from proof))),
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
    ) select claimed.id,claimed.action_version,claimed.claim_token,claimed.source_message_id,claimed.reason
        from claimed where claimed.source_message_id=${uuid(sourceMessageId)};`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const [operation, inputPath] = process.argv.slice(2);
    const input = JSON.parse(await fs.readFile(inputPath, 'utf8'));
    if (!['context', 'claim'].includes(operation)) throw new Error('Use context or claim with a private JSON input file');
    process.stdout.write(operation === 'context' ? fastReplyContext(input) : fastReplyClaim(input));
}

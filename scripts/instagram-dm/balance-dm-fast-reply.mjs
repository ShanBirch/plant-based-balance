import fs from 'node:fs/promises';
import { continuityPolicy, validateConversationReview } from './conversation-continuity.mjs';
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
    ), history as (
        select m.id,m.direction::text,m.text,m.created_at,m.source::text,m.author_type::text,
            m.delivery_origin::text,'ig:'||m.id::text as event_key
        from ig_messages m join target t on m.thread_id=t.id
        union all
        select n.id,case when n.sender_id=t.linked_user_id then 'in' else 'out' end,
            n.message,n.created_at,'app',null::text,'app','app:'||n.id::text
        from nudges n join target t on t.memory->>'source'='full_ig_and_app_history'
            and t.linked_user_id is not null and t.coach_id is not null
            and ((n.sender_id=t.linked_user_id and n.receiver_id=t.coach_id)
                or (n.sender_id=t.coach_id and n.receiver_id=t.linked_user_id))
    ), proof as (
        select coalesce(memory->>'source' in ('full_ig_history','full_ig_and_app_history') and length(memory->>'summary')>0
            and (memory->>'source'<>'full_ig_and_app_history' or (linked_user_id is not null and coach_id is not null))
            and (memory->>'last_compacted_at')::timestamptz<=now()
            and (select count(*) from history where created_at<=(memory->>'last_compacted_at')::timestamptz)=(memory->>'messages_compacted')::integer
            and exists(select 1 from history where
                created_at=(memory->>'last_compacted_at')::timestamptz
                and event_key=memory->>'last_compacted_event_key'),false) as valid,
            (memory->>'last_compacted_at')::timestamptz as boundary from target
    ) select jsonb_build_object(
        'conversation_continuity_policy', ${literal(JSON.stringify(continuityPolicy))}::jsonb,
        'direct_challenge_experiment', public.balance_direct_challenge_context(${uuid(threadId)}),
        'challenge_timing_experiment', public.balance_challenge_timing_context(${uuid(threadId)}),
        'thread', (select to_jsonb(target)-'memory' from target),
        'history_proof', (select jsonb_build_object('validated_compaction',valid,'boundary',boundary,
            'mode',case when valid then 'full_history_summary_and_complete_delta' else 'full_raw_history' end) from proof),
        'messages', (select jsonb_agg(jsonb_build_object('id',id,'direction',direction,'text',text,
            'created_at',created_at,'source',source,'author_type',author_type,'delivery_origin',delivery_origin) order by created_at,id)
            from history message where (not coalesce((select valid from proof),false) or created_at>(select boundary from proof))),
        'actions', (select jsonb_agg(to_jsonb(action)) from ig_next_actions action where thread_id=${uuid(threadId)}),
        'personal_contact', exists(select 1 from ig_personal_contacts contact join ig_threads thread on lower(contact.ig_username)=lower(thread.ig_username) where thread.id=${uuid(threadId)}),
        'shift', (select jsonb_build_object('run_id',run_id,'status',status,'heartbeat_at',heartbeat_at,'lease_expires_at',lease_expires_at,'browser_surface',browser_surface,'binding',cursor_current->'browser_surface') from ig_browser_shift_runs where run_id=${literal(runId)})
    );`;
}

export function fastReplyClaim(input) {
    const { threadId, sourceMessageId, runId, tabId, username, nativeConversationId, finalText } = input;
    const conversationReview = validateConversationReview(input.conversationReview, sourceMessageId);
    if (input.fullThreadReviewed !== true || input.nativeIdentityVerified !== true
        || input.independentHoldsChecked !== true || !input.leadState?.trim()
        || !finalText?.trim() || finalText.length > 4000) {
        throw new Error('Full current review and all independent gates required');
    }
    const reason = JSON.stringify({ policy: 'live_conversation_operator_v1', is_dm: true,
        final_text: finalText, conversation_review: conversationReview,
        conversation_policy_version: continuityPolicy.version,
        full_thread_reviewed: true, native_identity_verified: true,
        independent_holds_checked: true, native_conversation_id: nativeConversationId,
        internal_test: input.internalTest === true });
    return `with staged as materialized (
        select upsert_ig_next_action(p_thread_id=>${uuid(threadId)},p_ig_username=>${literal(username)},
            p_lead_state=>${literal(input.leadState)},p_owner=>'dm_manager',p_action_type=>'reply_inbound',
            p_priority=>800,p_source_message_id=>${uuid(sourceMessageId)},
            p_reason=>${literal(reason)}::jsonb || jsonb_build_object('reviewed_at',now())) as action
        where (select id from ig_messages where thread_id=${uuid(threadId)} and direction='in' order by created_at desc,id desc limit 1)=${uuid(sourceMessageId)}
        and public.balance_direct_challenge_claim_allowed(${uuid(threadId)},${uuid(sourceMessageId)},${literal(JSON.stringify(conversationReview))}::jsonb)
        and (${conversationReview.trainingPivot === true || conversationReview.disposition === 'invite_challenge' ? 'true' : 'false'}=false
          or coalesce((public.balance_challenge_timing_context(${uuid(threadId)})->>'training_due')::boolean,true)
          or exists(select 1 from public.balance_challenge_timing_events v where v.assignment_id=
            (public.balance_challenge_timing_context(${uuid(threadId)})->'assignment'->>'id')::uuid and v.kind='timing_override'))
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

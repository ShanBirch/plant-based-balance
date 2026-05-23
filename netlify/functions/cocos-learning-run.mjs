function getEnv(name) {
    const netlifyValue = globalThis.Netlify?.env?.get?.(name);
    if (netlifyValue) return netlifyValue;
    return typeof process !== 'undefined' ? process.env?.[name] : undefined;
}

const SUPABASE_URL = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
const SUPABASE_SERVICE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_SERVICE_KEY');
const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';

const COCOS_BOT_ACCOUNT = 'cocos_pt_studio';
const COCOS_ALGORITHM_FORK = 'cocos_acquisition_v1';
const COCOS_OWNER_IDS = new Set(['17841435394720504', '26328183736859579']);
const COCOS_COHORT_TYPES = new Set(['plant_based_30', 'transform_30']);
const DM_ALERT_TYPES = ['unread_message', 'incoming_dm', 'ig_incoming_dm', 'fb_incoming_dm', 'follow_up_review'];
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_DAYS = 60;
const NO_REPLY_PENALTY_DAYS = 5;
const MAX_ALERTS = 700;
const MAX_STORED_EVENTS = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(statusCode, body) {
    return new Response(JSON.stringify(body), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' },
    });
}

function clampNumber(value, fallback, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
}

function normalizeText(value) {
    return String(value || '').trim();
}

function normalizeLower(value) {
    return normalizeText(value).toLowerCase();
}

function normalizeBotAccount(value) {
    return normalizeLower(value).replace(/^@+/, '');
}

function normalizeHandle(value) {
    return normalizeLower(value).replace(/^@+/, '');
}

function isObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function getData(row = {}) {
    return isObject(row.data) ? row.data : {};
}

function isCocosOwnerId(value) {
    return COCOS_OWNER_IDS.has(normalizeText(value));
}

function isCocosMetaPayload(data = {}) {
    const graph = isObject(data.instagram_graph) ? data.instagram_graph : {};
    const customData = isObject(data.custom_data) ? data.custom_data : {};
    const nestedGraph = isObject(customData.instagram_graph) ? customData.instagram_graph : {};
    const botAccount = normalizeBotAccount(data.bot_account || graph.bot_account || customData.bot_account || nestedGraph.bot_account);
    if (botAccount === COCOS_BOT_ACCOUNT) return true;
    return [
        data.owner_ig_user_id,
        data.ig_graph_account_id,
        data.ig_account_id,
        graph.owner_id,
        graph.account_id,
        graph.ig_account_id,
        nestedGraph.owner_id,
        nestedGraph.account_id,
        nestedGraph.ig_account_id,
    ].some(isCocosOwnerId);
}

function isCocosAlert(row) {
    return !!row && DM_ALERT_TYPES.includes(row.alert_type) && isCocosMetaPayload(getData(row));
}

function getThreadId(target = {}, thread = null) {
    const data = getData(target);
    return normalizeText(
        target.threadId
        || target.ig_thread_id
        || data.ig_thread_id
        || data.thread_id
        || data.instagram_graph?.thread_id
        || thread?.id
        || ''
    );
}

function getHandle(target = {}, thread = null) {
    const data = getData(target);
    return normalizeHandle(
        target.handle
        || target.ig_username
        || data.ig_username
        || data.manual_ig_handle
        || data.profile_name
        || thread?.ig_username
        || ''
    );
}

function getLinkedUserId(target = {}, thread = null) {
    const data = getData(target);
    return normalizeText(
        target.client_id
        || target.clientId
        || target.linkedUserId
        || target.linked_user_id
        || data.linked_user_id
        || thread?.linked_user_id
        || ''
    );
}

function getQualifier(target = {}, thread = null) {
    const data = getData(target);
    if (isObject(data.qualifier)) return data.qualifier;
    if (isObject(target.qualifier)) return target.qualifier;
    if (isObject(thread?.qualifier)) return thread.qualifier;
    return {};
}

function getLeadStage(target = {}, thread = null) {
    const data = getData(target);
    return normalizeLower(data.lead_stage || target.lead_stage || target.leadStage || thread?.lead_stage || '');
}

function getLifecycleStage(target = {}) {
    const lifecycle = getData(target).lifecycle;
    return normalizeLower(lifecycle?.stage || lifecycle?.status || '');
}

function isoMs(value) {
    const ms = Date.parse(value || '');
    return Number.isFinite(ms) ? ms : null;
}

function arrayUnique(values) {
    return Array.from(new Set((values || []).map(v => normalizeText(v)).filter(Boolean)));
}

function validUuid(value) {
    const text = normalizeText(value);
    return UUID_RE.test(text) ? text : '';
}

function sqlLiteral(value) {
    return `'${String(value || '').replace(/'/g, "''")}'`;
}

function sqlUuidList(ids) {
    return arrayUnique(ids).map(sqlLiteral).join(',');
}

function isMissingLearningTableError(err) {
    const text = `${err?.message || ''} ${err?.body || ''}`;
    return /cocos_(learning_events|algorithm_rules)|PGRST205|42P01|schema cache/i.test(text);
}

async function requireShannonAdmin(req) {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return { response: json(401, { error: 'Unauthorized' }) };

    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${token}`,
        },
    });
    if (!res.ok) return { response: json(401, { error: 'Unauthorized' }) };

    const user = await res.json();
    const email = normalizeLower(user?.email);
    if (email !== BALANCE_ADMIN_EMAIL) return { response: json(403, { error: 'Forbidden' }) };
    return { user };
}

async function supabase(path, options = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: options.prefer || 'return=representation',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!res.ok) {
        const text = await res.text();
        const err = new Error(`${options.method || 'GET'} ${path} -> ${res.status} ${text.slice(0, 500)}`);
        err.status = res.status;
        err.body = text;
        try {
            const parsed = JSON.parse(text);
            if (parsed?.code) err.sqlstate = parsed.code;
        } catch { /* ignore */ }
        throw err;
    }
    const text = await res.text();
    if (!text || !text.trim()) return [];
    try { return JSON.parse(text); } catch { return []; }
}

async function execSqlJson(sql) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql_json`, {
        method: 'POST',
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`exec_sql_json -> ${res.status} ${text.slice(0, 400)}`);
    }
    const body = await res.json();
    if (Array.isArray(body)) return body;
    if (body?.error) throw new Error(`${body.error} (${body.sqlstate || 'sql_error'})`);
    return [];
}

function participantRank(row) {
    const status = normalizeLower(row?.status);
    if (status === 'accepted') return 4;
    if (status === 'invited' || status === 'pending') return 3;
    return 1;
}

function buildOutcomeMeta(target = {}, context = {}) {
    const thread = context.thread || null;
    const qualifier = getQualifier(target, thread);
    const qualifierStage = normalizeLower(qualifier.stage || qualifier.current_stage || '');
    const leadStage = getLeadStage(target, thread);
    const lifecycleStage = getLifecycleStage(target);
    const participant = context.participant || null;
    const invitation = context.invitation || null;

    if (participant) {
        return {
            key: 'pre30',
            label: normalizeLower(participant.status) === 'accepted' ? 'Pre-30 channel' : 'Pre-30 queued',
            detail: participant.cohort_type || '30-day',
        };
    }
    if (['trial', 'trial_expiring', 'in_app', 'paying'].includes(lifecycleStage) || ['trial', 'trial_expiring', 'in_app', 'paying'].includes(leadStage)) {
        return { key: 'linked', label: 'App linked', detail: lifecycleStage || leadStage };
    }
    if (invitation) {
        return {
            key: 'invite',
            label: invitation.claimed_at ? 'Invite claimed' : 'Invite created',
            detail: invitation.cohort_type || '30-day',
        };
    }
    if (qualifierStage === 'won') return { key: 'accepted_dm', label: 'Accepted in DM', detail: 'needs handoff' };
    if (qualifierStage === 'pitched' || leadStage === 'invited') return { key: 'pitched', label: 'Challenge pitched', detail: 'watch handoff' };
    if (qualifierStage === 'lost' || leadStage === 'lost' || leadStage === 'churned') return { key: 'lost', label: 'Negative', detail: 'lost/churned' };
    if (target.status === 'scheduled') return { key: 'queued', label: 'Queued', detail: 'timing selected' };
    if (target.status === 'dismissed' || target.status === 'canceled') return { key: 'discarded', label: 'Discarded', detail: 'not sent' };
    if (target.status === 'sent') return { key: 'waiting', label: 'Waiting', detail: 'sent' };
    if (target.status === 'pending') return { key: 'held_or_inbound', label: 'Review/inbound', detail: 'not sent yet' };
    return { key: 'tracking', label: 'Tracking', detail: 'no outcome yet' };
}

function getReviewHold(alert = {}) {
    const data = getData(alert);
    if (data.auto_send_review_approved_at) return null;
    if (data.auto_send_review_hold?.code) return data.auto_send_review_hold;
    if (data.media_review?.required) return { code: 'media_review', label: data.media_review.label || 'Media review' };
    if (data.context_review?.required) return { code: 'context_review', label: data.context_review.label || 'Context review' };
    if (data.schedule_blocked_reason || data.schedule_blocked_at) {
        return { code: data.schedule_blocked_reason || 'schedule_blocked', label: 'Schedule blocked' };
    }
    const review = data.draft_review || data.draftReview;
    if (review && (review.verdict !== 'pass' || review.notification_required || review.context_loss_suspected)) {
        return { code: 'draft_review', label: review.summary || 'Draft review' };
    }
    return null;
}

function isMediaOrContextReview(alert = {}) {
    const hold = getReviewHold(alert);
    const data = getData(alert);
    const analysis = data.edit_analysis || {};
    return ['media_review', 'context_review'].includes(hold?.code)
        || data.media_review?.required
        || data.context_review?.required
        || analysis.media_review_required
        || analysis.context_review_required
        || analysis.voice_match_excluded_reason === 'media_review_required'
        || analysis.voice_match_excluded_reason === 'context_review_required';
}

function wasHardEdited(alert = {}) {
    const data = getData(alert);
    const analysis = data.edit_analysis || {};
    if (isMediaOrContextReview(alert)) return false;
    if (!data.was_edited && !analysis.was_edited) return false;
    const kept = Number(analysis.draft_kept_pct);
    const finalAi = Number(analysis.final_ai_generated_pct);
    const changeTypes = Array.isArray(analysis.change_types)
        ? analysis.change_types.map(normalizeLower)
        : [];
    return changeTypes.includes('complete_rewrite')
        || changeTypes.includes('complete_rewrite_without_reason')
        || (Number.isFinite(kept) && kept <= 35)
        || (Number.isFinite(finalAi) && finalAi <= 35);
}

function buildTextCorpus(alert = {}, thread = null) {
    const data = getData(alert);
    const parts = [
        alert.title,
        alert.description,
        alert.suggested_message,
        alert.scheduled_reply_text,
        alert.client_name,
        data.message,
        data.message_text,
        data.current_message,
        data.inbound_text,
        data.latest_inbound_text,
        data.story_context,
        data.story_caption,
        data.story_reply_context?.text,
        data.context_summary,
        data.draft_text,
        data.sent_message,
        thread?.profile_name,
        thread?.ig_username,
    ];
    return parts.map(v => normalizeText(v)).filter(Boolean).join('\n').toLowerCase();
}

function classifyContext(alert = {}, thread = null) {
    const data = getData(alert);
    const text = buildTextCorpus(alert, thread);
    if (data.draft_review?.notification_reason === 'challenge_offer' || /30[\s-]?day|challenge|pre[\s-]?30|join|invite|sign ?up|link/.test(text)) {
        return 'challenge_handoff';
    }
    if (/stuck|struggl|help|start|slack|off track|goal|lose weight|fat loss|fitness|training|workout|diet|meal|protein|calorie/.test(text)) {
        return 'fitness_help_signal';
    }
    if (/story|reel|shared|reshare|video|photo|voice note|media|\[photo|\[video|\[audio/.test(text) || data.media_review?.required) {
        return 'story_media';
    }
    if (/dog|cat|puppy|pet|rabbit|bunny|cute|animal/.test(text)) return 'pet_social';
    if (/coffee|wine|drink|night|out|selfie|look|vibe|beach|weather|cold|banga|fun/.test(text)) return 'simple_social';
    if (/haha|lol|lmao|banter|joke|funny/.test(text)) return 'rapport_banter';
    return 'unknown';
}

function classifyAction(alert = {}) {
    const data = getData(alert);
    const draft = normalizeLower(alert.scheduled_reply_text || alert.suggested_message || data.scheduled_reply_text || data.draft_text || data.sent_message);
    if (/30[\s-]?day|challenge|join|sign ?up|link|spot|keen to start|free/.test(draft)) return 'soft_challenge_bridge';
    if (/\?/.test(draft) || /\bwhat|how|when|where|who|which\b/.test(draft)) return 'curious_question';
    if (/cute|fun|love|banga|looks good|looking good|nice|solid|haha|lol/.test(draft)) return 'simple_reaction';
    if (/workout|training|protein|calorie|meal|steps|sleep|recovery|session|plan/.test(draft)) return 'specific_coaching';
    if (draft) return 'rapport_reply';
    return 'unknown';
}

function buildReward({ alert, thread, outcome }) {
    const reasons = [];
    let reward = 0;
    let label = 'neutral';
    const now = Date.now();
    const sentAt = getSentAt(alert);
    const lastInboundMs = isoMs(thread?.last_inbound_at);
    const status = normalizeLower(alert.status);
    const reviewHold = getReviewHold(alert);
    const mediaOrContextReview = isMediaOrContextReview(alert);

    if (outcome.key === 'pre30') {
        reward += 10;
        label = 'primary_reward';
        reasons.push('reached_pre30_channel');
    } else if (outcome.key === 'linked') {
        reward += 8;
        label = 'app_linked';
        reasons.push('lead_linked_to_app');
    } else if (outcome.key === 'invite') {
        reward += /claimed/i.test(outcome.label || '') ? 7 : 5;
        label = 'handoff';
        reasons.push(/claimed/i.test(outcome.label || '') ? 'invite_claimed' : 'invite_created');
    } else if (outcome.key === 'accepted_dm') {
        reward += 5;
        label = 'accepted_in_dm';
        reasons.push('accepted_before_app_handoff');
    } else if (outcome.key === 'pitched') {
        reward += 2;
        label = 'challenge_pitch';
        reasons.push('challenge_pitch_reached');
    } else if (outcome.key === 'lost') {
        reward -= 4;
        label = 'lost';
        reasons.push('lead_lost_or_churned');
    }

    if (status === 'sent' && sentAt && lastInboundMs && lastInboundMs > sentAt + 60 * 1000) {
        reward += 2;
        if (label === 'neutral') label = 'reply';
        reasons.push('person_replied_after_send');
    }

    if ((status === 'dismissed' || status === 'canceled') && reward <= 0) {
        reward -= mediaOrContextReview ? 1 : 3;
        label = mediaOrContextReview ? 'discarded_after_review' : 'discarded';
        reasons.push(mediaOrContextReview ? 'media_or_context_discarded_light_penalty' : 'draft_discarded');
    }

    if (getData(alert).draft_error || getData(alert).draftError) {
        reward -= 4;
        label = 'draft_error';
        reasons.push('draft_error');
    }

    if (wasHardEdited(alert)) {
        reward -= 2;
        label = reward < 0 ? 'hard_rewrite' : label;
        reasons.push('hard_manual_rewrite');
    }

    const noReplyReady = status === 'sent'
        && sentAt
        && now - sentAt > NO_REPLY_PENALTY_DAYS * DAY_MS
        && (!lastInboundMs || lastInboundMs <= sentAt + 60 * 1000)
        && outcome.key === 'waiting';
    if (noReplyReady) {
        reward -= 1;
        label = reward < 0 ? 'no_reply' : label;
        reasons.push(`no_reply_after_${NO_REPLY_PENALTY_DAYS}d`);
    }

    if (reviewHold && status !== 'dismissed' && status !== 'canceled' && reward === 0) {
        label = 'review_hold_neutral';
        reasons.push(`neutral_review_hold_${reviewHold.code || 'review'}`);
    }

    return {
        rewardScore: Number(reward.toFixed(2)),
        rewardLabel: label,
        rewardReasons: reasons,
        reviewHoldNeutral: !!(reviewHold && status !== 'dismissed' && status !== 'canceled' && reward === 0),
    };
}

function getSentAt(alert = {}) {
    const data = getData(alert);
    return isoMs(alert.actioned_at || data.sent_at || data.auto_sent_at || alert.scheduled_for || alert.created_at);
}

async function loadRecentCocosAlerts(windowDays) {
    const since = new Date(Date.now() - windowDays * DAY_MS).toISOString();
    const typeFilter = DM_ALERT_TYPES.join(',');
    const rows = await supabase(
        `coach_alerts?select=id,coach_id,client_id,client_name,alert_type,status,title,description,suggested_message,scheduled_reply_text,created_at,actioned_at,scheduled_for,data&alert_type=in.(${typeFilter})&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=${MAX_ALERTS}`
    );
    return (rows || []).filter(isCocosAlert);
}

async function loadThreadMap(alerts) {
    const ids = arrayUnique(alerts.map(alert => validUuid(getThreadId(alert)))).filter(Boolean);
    const byId = new Map();
    if (!ids.length) return byId;
    const chunks = [];
    for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
    for (const chunk of chunks) {
        const rows = await supabase(
            `ig_threads?select=id,ig_username,profile_name,lead_stage,linked_user_id,qualifier,last_inbound_at,last_outbound_at,custom_data&id=in.(${chunk.join(',')})&limit=200`
        );
        (rows || []).forEach(row => byId.set(row.id, row));
    }
    return byId;
}

async function loadParticipantMap(userIds) {
    const byUser = new Map();
    const ids = arrayUnique(userIds.map(validUuid)).filter(Boolean);
    if (!ids.length) return byUser;
    const rows = await execSqlJson(`
        SELECT
            cp.id,
            cp.user_id,
            cp.status,
            cp.challenge_id,
            cp.accepted_at,
            cp.created_at,
            c.cohort_type
        FROM public.challenge_participants cp
        LEFT JOIN public.challenges c ON c.id = cp.challenge_id
        WHERE cp.user_id IN (${sqlUuidList(ids)})
            AND cp.status IN ('accepted', 'invited', 'pending')
            AND c.cohort_type IN (${Array.from(COCOS_COHORT_TYPES).map(sqlLiteral).join(',')})
        ORDER BY cp.created_at DESC
        LIMIT 500
    `);
    (rows || []).forEach(row => {
        const existing = byUser.get(row.user_id);
        if (!existing || participantRank(row) > participantRank(existing)) byUser.set(row.user_id, row);
    });
    return byUser;
}

async function loadInvitationMap(handles) {
    const byHandle = new Map();
    const normalized = arrayUnique(handles.map(normalizeHandle)).filter(Boolean);
    if (!normalized.length) return byHandle;
    const variants = arrayUnique(normalized.flatMap(handle => [handle, `@${handle}`]));
    const rows = await execSqlJson(`
        SELECT id, email, name, ig_handle, cohort_type, claimed_at, claimed_by_user_id, created_at, source
        FROM public.cohort_invitations
        WHERE cohort_type IN (${Array.from(COCOS_COHORT_TYPES).map(sqlLiteral).join(',')})
            AND ig_handle IN (${variants.map(sqlLiteral).join(',')})
        ORDER BY created_at DESC
        LIMIT 500
    `);
    (rows || []).forEach(row => {
        const handle = normalizeHandle(row.ig_handle);
        if (handle && !byHandle.has(handle)) byHandle.set(handle, row);
    });
    return byHandle;
}

async function buildLearningEvents(alerts) {
    const threadById = await loadThreadMap(alerts);
    const contexts = alerts.map(alert => {
        const thread = threadById.get(getThreadId(alert)) || null;
        return {
            alert,
            thread,
            userId: getLinkedUserId(alert, thread),
            handle: getHandle(alert, thread),
        };
    });

    const [participants, invitations] = await Promise.all([
        loadParticipantMap(contexts.map(c => c.userId)),
        loadInvitationMap(contexts.map(c => c.handle)),
    ]);

    return contexts.map(ctx => {
        const participant = ctx.userId ? participants.get(ctx.userId) : null;
        const invitation = ctx.handle ? invitations.get(ctx.handle) : null;
        const outcome = buildOutcomeMeta(ctx.alert, { thread: ctx.thread, participant, invitation });
        const reward = buildReward({ alert: ctx.alert, thread: ctx.thread, outcome });
        const data = getData(ctx.alert);
        const threadId = validUuid(getThreadId(ctx.alert, ctx.thread));
        const linkedUserId = validUuid(ctx.userId);
        return {
            alert_id: ctx.alert.id,
            coach_id: validUuid(ctx.alert.coach_id) || null,
            client_id: validUuid(ctx.alert.client_id) || linkedUserId || null,
            ig_thread_id: threadId || null,
            algorithm_fork: COCOS_ALGORITHM_FORK,
            bot_account: COCOS_BOT_ACCOUNT,
            ig_handle: ctx.handle || null,
            context_bucket: classifyContext(ctx.alert, ctx.thread),
            action_bucket: classifyAction(ctx.alert),
            outcome_key: outcome.key,
            reward_score: reward.rewardScore,
            reward_label: reward.rewardLabel,
            reward_reasons: reward.rewardReasons,
            review_hold_neutral: reward.reviewHoldNeutral,
            source_status: ctx.alert.status || null,
            source_alert_type: ctx.alert.alert_type || null,
            source_created_at: ctx.alert.created_at || null,
            source_actioned_at: ctx.alert.actioned_at || data.sent_at || null,
            event_at: new Date().toISOString(),
            metadata: {
                outcome,
                review_hold: getReviewHold(ctx.alert),
                lead_stage: getLeadStage(ctx.alert, ctx.thread) || null,
                qualifier_stage: normalizeLower(getQualifier(ctx.alert, ctx.thread).stage || getQualifier(ctx.alert, ctx.thread).current_stage || '') || null,
                scheduled_for: ctx.alert.scheduled_for || null,
                last_inbound_at: ctx.thread?.last_inbound_at || null,
                last_outbound_at: ctx.thread?.last_outbound_at || null,
                was_edited: !!data.was_edited,
                hard_edited: wasHardEdited(ctx.alert),
            },
        };
    });
}

async function upsertEvents(events) {
    if (!events.length) return [];
    const chunks = [];
    for (let i = 0; i < events.length; i += 100) chunks.push(events.slice(i, i + 100));
    const saved = [];
    for (const chunk of chunks) {
        const rows = await supabase('cocos_learning_events?on_conflict=alert_id', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates,return=representation',
            body: chunk,
        });
        saved.push(...(rows || []));
    }
    return saved;
}

function ruleTextFor(contextBucket, actionBucket) {
    const key = `${contextBucket}|${actionBucket}`;
    const templates = {
        'fitness_help_signal|soft_challenge_bridge': 'When a lead gives a real help, start, stuck, fitness-frustration, or challenge-detail signal, bridge toward the free 30-day challenge in the next 1-2 replies instead of adding another broad discovery question.',
        'fitness_help_signal|curious_question': 'When a fitness-help signal appears but the person has not given enough context yet, ask one concrete question about the blocker or next step before offering the challenge.',
        'challenge_handoff|soft_challenge_bridge': 'When the 30-day challenge is already the live topic, keep the reply simple and useful: answer the concern, make the next action easy, and do not drift back into general rapport.',
        'story_media|simple_reaction': 'For story, reel, photo, video, or voice-note context, only react to what is visible or decoded. Keep uncertain media replies short and specific, and treat media/context review holds as neutral learning signal unless Shannon discards or rewrites after checking.',
        'story_media|curious_question': 'For low-context story media, a tiny curious question is better than a generic compliment when the object/person/activity is clear.',
        'pet_social|curious_question': 'For animal posts, keep it warm and easy. A simple cute reaction plus a tiny question like asking their name is enough.',
        'simple_social|simple_reaction': 'For selfies, nights out, coffee, weather, and simple social stories, keep the reply short and human. Light reaction beats forced coaching.',
        'simple_social|curious_question': 'For simple social posts with a clear hook, ask one relaxed question tied to that hook instead of using generic filler.',
        'rapport_banter|curious_question': 'In banter, mirror the bit first. Ask at most one specific curiosity question only if it keeps the conversation open.',
        'rapport_banter|simple_reaction': 'If the person is only bantering, a short reaction can be the whole reply. Do not force the challenge into empty friendliness.',
    };
    return templates[key] || `For ${contextBucket.replace(/_/g, ' ')} messages, ${actionBucket.replace(/_/g, ' ')} only when the current thread gives enough context. Keep it specific, casual, and scoped to this person.`;
}

function buildRuleCandidates(events) {
    const groups = new Map();
    (events || []).forEach(event => {
        const contextBucket = normalizeLower(event.context_bucket || 'unknown') || 'unknown';
        const actionBucket = normalizeLower(event.action_bucket || 'unknown') || 'unknown';
        if (contextBucket === 'unknown' && actionBucket === 'unknown') return;
        const key = `${contextBucket}|${actionBucket}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(event);
    });

    const nowIso = new Date().toISOString();
    return Array.from(groups.entries()).map(([key, rows]) => {
        const [contextBucket, actionBucket] = key.split('|');
        const rewardSum = rows.reduce((sum, row) => sum + Number(row.reward_score || 0), 0);
        const positiveCount = rows.filter(row => Number(row.reward_score || 0) > 0).length;
        const negativeCount = rows.filter(row => Number(row.reward_score || 0) < 0).length;
        const neutralCount = rows.length - positiveCount - negativeCount;
        const rewardAvg = rows.length ? rewardSum / rows.length : 0;
        const evidenceCount = rows.length;
        const active = evidenceCount >= 3
            && positiveCount >= 2
            && rewardAvg >= 1.25
            && negativeCount <= Math.max(1, Math.floor(positiveCount / 2));
        const ruleKey = `reward_${contextBucket}_${actionBucket}`.replace(/[^a-z0-9_]/g, '_');
        const sourceAlertIds = rows
            .slice()
            .sort((a, b) => Number(b.reward_score || 0) - Number(a.reward_score || 0))
            .map(row => row.alert_id)
            .filter(Boolean)
            .slice(0, 12);
        const lastReason = active
            ? `Active from ${positiveCount} positive, ${neutralCount} neutral, ${negativeCount} negative outcomes. Avg reward ${rewardAvg.toFixed(2)}.`
            : `Watching ${evidenceCount} outcome${evidenceCount === 1 ? '' : 's'}: ${positiveCount} positive, ${neutralCount} neutral, ${negativeCount} negative. Needs more reward signal before activation.`;
        return {
            algorithm_fork: COCOS_ALGORITHM_FORK,
            rule_key: ruleKey,
            rule_text: ruleTextFor(contextBucket, actionBucket),
            context_bucket: contextBucket,
            action_bucket: actionBucket,
            evidence_count: evidenceCount,
            positive_count: positiveCount,
            neutral_count: neutralCount,
            negative_count: negativeCount,
            reward_sum: Number(rewardSum.toFixed(2)),
            reward_avg: Number(rewardAvg.toFixed(2)),
            active,
            auto_activated_at: active ? nowIso : null,
            last_evaluated_at: nowIso,
            last_reason: lastReason,
            source_alert_ids: sourceAlertIds,
            metadata: {
                activation_threshold: {
                    evidence_count: 3,
                    positive_count: 2,
                    reward_avg: 1.25,
                },
            },
        };
    }).sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        if (b.reward_avg !== a.reward_avg) return b.reward_avg - a.reward_avg;
        return b.evidence_count - a.evidence_count;
    });
}

async function upsertRules(ruleCandidates) {
    if (!ruleCandidates.length) return [];
    return supabase('cocos_algorithm_rules?on_conflict=algorithm_fork,rule_key', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=representation',
        body: ruleCandidates,
    });
}

async function loadStoredLearning(windowDays) {
    const since = new Date(Date.now() - windowDays * DAY_MS).toISOString();
    const [events, rules] = await Promise.all([
        supabase(`cocos_learning_events?select=id,alert_id,ig_thread_id,ig_handle,context_bucket,action_bucket,outcome_key,reward_score,reward_label,reward_reasons,review_hold_neutral,source_status,source_created_at,source_actioned_at,event_at,metadata&algorithm_fork=eq.${COCOS_ALGORITHM_FORK}&event_at=gte.${encodeURIComponent(since)}&order=event_at.desc&limit=${MAX_STORED_EVENTS}`),
        supabase(`cocos_algorithm_rules?select=id,rule_key,rule_text,context_bucket,action_bucket,evidence_count,positive_count,neutral_count,negative_count,reward_sum,reward_avg,active,auto_activated_at,last_evaluated_at,last_reason,source_alert_ids,metadata&algorithm_fork=eq.${COCOS_ALGORITHM_FORK}&order=active.desc,reward_avg.desc,evidence_count.desc&limit=60`),
    ]);
    return { events: events || [], rules: rules || [] };
}

function summarizeLearning({ events, rules, generatedEvents = [], savedEvents = [] }) {
    const rows = events || [];
    const activeRules = (rules || []).filter(rule => rule.active);
    const proposedRules = (rules || []).filter(rule => !rule.active);
    const rewardSum = rows.reduce((sum, row) => sum + Number(row.reward_score || 0), 0);
    const positive = rows.filter(row => Number(row.reward_score || 0) > 0).length;
    const negative = rows.filter(row => Number(row.reward_score || 0) < 0).length;
    const neutral = rows.length - positive - negative;
    const primaryRewards = rows.filter(row => row.outcome_key === 'pre30').length;
    const reviewNeutral = rows.filter(row => row.review_hold_neutral).length;
    return {
        algorithmFork: COCOS_ALGORITHM_FORK,
        botAccount: COCOS_BOT_ACCOUNT,
        eventCount: rows.length,
        generatedEventCount: generatedEvents.length,
        savedEventCount: savedEvents.length,
        positiveCount: positive,
        neutralCount: neutral,
        negativeCount: negative,
        rewardSum: Number(rewardSum.toFixed(2)),
        rewardAvg: rows.length ? Number((rewardSum / rows.length).toFixed(2)) : 0,
        primaryRewardCount: primaryRewards,
        reviewHoldNeutralCount: reviewNeutral,
        activeRuleCount: activeRules.length,
        proposedRuleCount: proposedRules.length,
        lastEvaluatedAt: new Date().toISOString(),
    };
}

async function runLearner({ windowDays, persist }) {
    const alerts = persist ? await loadRecentCocosAlerts(windowDays) : [];
    let generatedEvents = [];
    let savedEvents = [];
    if (persist && alerts.length) {
        generatedEvents = await buildLearningEvents(alerts);
        savedEvents = await upsertEvents(generatedEvents);
    }

    let stored = await loadStoredLearning(windowDays);
    if (persist) {
        const candidates = buildRuleCandidates(stored.events);
        if (candidates.length) {
            await upsertRules(candidates);
            stored = await loadStoredLearning(windowDays);
        }
    }
    const summary = summarizeLearning({ events: stored.events, rules: stored.rules, generatedEvents, savedEvents });
    return {
        ok: true,
        mode: persist ? 'run' : 'summary',
        windowDays,
        summary,
        rules: stored.rules,
        activeRules: stored.rules.filter(rule => rule.active),
        proposedRules: stored.rules.filter(rule => !rule.active),
        recentEvents: stored.events.slice(0, 40),
        neutralPolicy: 'Needs-attention/media/photo/video/audio/context holds are neutral unless Shannon discards, hard rewrites, blocks, or the thread produces a real negative outcome.',
    };
}

export default async function(req) {
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json(500, { error: 'Server misconfigured' });

    let body = {};
    try {
        const text = await req.text();
        body = text ? JSON.parse(text) : {};
    } catch {
        return json(400, { error: 'Invalid JSON' });
    }

    const isScheduled = !!body.next_run;
    if (!isScheduled) {
        const admin = await requireShannonAdmin(req);
        if (admin.response) return admin.response;
    }

    const windowDays = clampNumber(body.windowDays, DEFAULT_WINDOW_DAYS, 7, 120);
    const mode = normalizeLower(body.mode || (isScheduled ? 'run' : 'summary'));
    const persist = mode === 'run' || isScheduled;

    try {
        return json(200, await runLearner({ windowDays, persist }));
    } catch (err) {
        console.error('[cocos-learning] failed:', err);
        if (isMissingLearningTableError(err)) {
            return json(200, {
                ok: false,
                migrationRequired: true,
                error: 'Coco\'s learning tables are not available yet. Apply the cocos_algorithm_learning migration, then run this again.',
            });
        }
        return json(500, { ok: false, error: err.message || 'Coco learning failed' });
    }
}

export const config = {
    method: ['POST'],
};

/**
 * Support Radar Scan
 *
 * Daily customer-support pass for high-signal human follow-ups:
 * - client said they felt down / overwhelmed recently, follow up the next day
 * - active client has not logged into the app for a week
 *
 * Inserts visible Needs You cards as weekly_checkin rows so they land in the
 * same approval lane as manual check-ins, without flooding Shannon with every
 * generic coaching idea.
 */

const {
    supabaseQuery,
    insertCoachAlert,
    truncate,
} = require('./_lib/client-context');

const SUPPORT_RADAR_SOURCE = 'balance-support-radar';
const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ALERTS_PER_RUN = Number(process.env.SUPPORT_RADAR_MAX_ALERTS || 6);
const LOW_MOOD_LOOKBACK_HOURS = 96;
const LOW_MOOD_MIN_FOLLOWUP_HOURS = 18;
const LOW_MOOD_MAX_FOLLOWUP_HOURS = 96;
const INACTIVE_DAYS = 7;
const SUPPORT_COOLDOWN_DAYS = 5;

function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function cleanName(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return 'there';
    return raw.split(/\s+/)[0].replace(/^@+/, '').toLowerCase();
}

function displayName(assignment = {}) {
    return assignment.client?.name
        || assignment.client?.email?.split('@')[0]
        || assignment.client_name
        || 'Client';
}

function hoursBetween(laterMs, earlierIso) {
    const earlierMs = Date.parse(earlierIso || '');
    if (!Number.isFinite(earlierMs)) return null;
    return (laterMs - earlierMs) / (60 * 60 * 1000);
}

function daysBetween(laterMs, earlierIso) {
    const hours = hoursBetween(laterMs, earlierIso);
    return hours === null ? null : Math.floor(hours / 24);
}

const LOW_MOOD_RE = /\b(?:feeling\s+(?:a\s+)?(?:(?:little\s+)?bit\s+)?(?:down|low|flat|sad|rough|off)|feel\s+(?:a\s+)?(?:(?:little\s+)?bit\s+)?(?:down|low|flat|sad|rough|off)|not\s+(?:feeling\s+)?(?:good|great|the\s+greatest|okay|ok)|overwhelmed|consumed|struggling|really\s+hard|rough\s+day|bad\s+day|personal\s+stuff|depressed|anxious|upset|crying|cried|spiral(?:ling|ing)?|burnt\s*out|burned\s*out)\b/i;

function isLowMoodText(text = '') {
    return LOW_MOOD_RE.test(String(text || '').toLowerCase());
}

function latestLowMoodInbound(messages = [], nowMs = Date.now()) {
    const sorted = [...messages]
        .filter(m => m && m.direction === 'in' && isLowMoodText(m.text))
        .sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''));
    const latest = sorted[0] || null;
    if (!latest) return null;
    const ageHours = hoursBetween(nowMs, latest.created_at);
    if (ageHours === null) return null;
    if (ageHours < LOW_MOOD_MIN_FOLLOWUP_HOURS || ageHours > LOW_MOOD_MAX_FOLLOWUP_HOURS) return null;
    return { ...latest, ageHours };
}

function hasLaterSupportFollowup(messages = [], lowMoodAt, nowMs = Date.now()) {
    const lowMoodMs = Date.parse(lowMoodAt || '');
    if (!Number.isFinite(lowMoodMs)) return false;
    const minFollowupMs = lowMoodMs + LOW_MOOD_MIN_FOLLOWUP_HOURS * 60 * 60 * 1000;
    return messages.some(m => {
        if (!m || m.direction !== 'out') return false;
        const sentMs = Date.parse(m.created_at || '');
        if (!Number.isFinite(sentMs)) return false;
        if (sentMs < minFollowupMs || sentMs > nowMs) return false;
        const text = String(m.text || '').toLowerCase();
        return /\b(how are you feeling|how you feeling|checking in|check in|doing okay|doing ok|been thinking|you feeling today)\b/i.test(text);
    });
}

function classifyLowMoodSupport({ assignment, messages, nowMs = Date.now() }) {
    const latest = latestLowMoodInbound(messages, nowMs);
    if (!latest) return null;
    if (hasLaterSupportFollowup(messages, latest.created_at, nowMs)) return null;
    const name = cleanName(displayName(assignment));
    return {
        signal: 'low_mood_followup',
        priority: 'high',
        title: `Check in with ${displayName(assignment)}`,
        description: `${displayName(assignment)} sounded down or overwhelmed ${Math.round(latest.ageHours)}h ago. Follow up without making them unpack everything.`,
        message: `hey ${name}, been thinking about you after the other day. how are you feeling today? no pressure to unpack everything, just wanted to check you're doing okay x`,
        evidence: {
            message_id: latest.id || null,
            source: latest.source || null,
            text: truncate(latest.text || '', 240),
            created_at: latest.created_at,
            age_hours: Math.round(latest.ageHours * 10) / 10,
        },
    };
}

function classifyInactiveSupport({ assignment, nowMs = Date.now() }) {
    const lastLogin = assignment.client?.last_login || assignment.last_login || null;
    const daysSinceLogin = lastLogin ? daysBetween(nowMs, lastLogin) : null;
    if (daysSinceLogin === null || daysSinceLogin < INACTIVE_DAYS || daysSinceLogin > 21) return null;
    const name = cleanName(displayName(assignment));
    return {
        signal: 'app_inactive_7d',
        priority: daysSinceLogin >= 10 ? 'high' : 'medium',
        title: `${displayName(assignment)} has not logged in for ${daysSinceLogin} days`,
        description: `Last app login was ${daysSinceLogin} days ago. Keep it human and simple, not guilt-trippy.`,
        message: `hey ${name}, noticed you haven't been in the app for a bit. everything alright on your end? if life has been hectic, we can make this week stupidly simple`,
        evidence: {
            last_login: lastLogin,
            days_since_login: daysSinceLogin,
        },
    };
}

function graphRecipientId(thread = {}) {
    const customData = safeObject(thread.custom_data);
    const graph = safeObject(customData.instagram_graph);
    return String(graph.ig_graph_user_id || graph.recipient_id || customData.ig_graph_user_id || '').trim();
}

function threadDeliveryData(thread = null, signal = {}) {
    if (!thread?.id) {
        return {
            channel: 'in_app',
            delivery_channel: 'in_app',
        };
    }
    const recipientId = graphRecipientId(thread);
    const lastInboundAt = thread.last_inbound_at || null;
    const hoursSinceInbound = lastInboundAt ? hoursBetween(Date.now(), lastInboundAt) : null;
    const graphCanSend = !!recipientId && hoursSinceInbound !== null && hoursSinceInbound <= 24;
    const deliveryChannel = graphCanSend ? 'instagram_graph' : 'manual_ig';
    const graph = safeObject(safeObject(thread.custom_data).instagram_graph);
    return {
        channel: graphCanSend ? 'instagram' : 'manual_ig',
        delivery_channel: deliveryChannel,
        manual_ig_required: deliveryChannel === 'manual_ig',
        manual_reason: deliveryChannel === 'manual_ig'
            ? 'Support Radar found this follow-up, but Instagram Graph cannot safely auto-send it from this window. Send manually in Instagram.'
            : undefined,
        ig_thread_id: thread.id,
        ig_username: thread.ig_username || thread.profile_name || null,
        profile_name: thread.profile_name || thread.ig_username || null,
        subscriber_id: thread.subscriber_id || null,
        ig_graph_recipient_id: recipientId || undefined,
        ig_graph_account_id: graph.ig_account_id || graph.account_id || undefined,
        instagram_graph: recipientId ? {
            ...graph,
            ig_graph_user_id: recipientId,
            send_ready: graphCanSend,
            last_inbound_at: lastInboundAt,
        } : graph,
        support_radar_signal: signal.signal,
    };
}

function buildNeedsYouAlert({ assignment, signal, thread = null, now = new Date() }) {
    const clientName = displayName(assignment);
    const delivery = threadDeliveryData(thread, signal);
    const data = {
        subtype: 'support_radar',
        support_radar: true,
        support_radar_source: SUPPORT_RADAR_SOURCE,
        support_radar_signal: signal.signal,
        support_radar_evidence: signal.evidence,
        drafted_at: now.toISOString(),
        draft_text: signal.message,
        draft_messages: [signal.message],
        operator_queue: 'needs_you',
        needs_you_required: true,
        needs_you_reason: signal.signal,
        needs_you_reasons: [signal.signal],
        client_manager_review_required: true,
        needs_shannon_approval: true,
        non_challenge_checkin: true,
        manual_checkin_roster: true,
        linked_client_name: clientName,
        ...delivery,
        codex_review: {
            source: SUPPORT_RADAR_SOURCE,
            decision: 'needs_you_support_radar',
            queue: 'needs_you',
            reason: signal.signal,
            needs_shannon_approval: true,
            reviewed_at: now.toISOString(),
            automation_id: SUPPORT_RADAR_SOURCE,
            evidence_ids: [
                assignment.client_id ? `users:${assignment.client_id}` : '',
                thread?.id ? `ig_threads:${thread.id}` : '',
                signal.evidence?.message_id ? `${signal.evidence.source || 'message'}:${signal.evidence.message_id}` : '',
            ].filter(Boolean),
        },
    };
    return {
        coach_id: assignment.coach_id,
        client_id: assignment.client_id,
        client_name: clientName,
        alert_type: 'weekly_checkin',
        priority: signal.priority || 'medium',
        title: signal.title,
        description: signal.description,
        suggested_message: signal.message,
        status: 'pending',
        data,
    };
}

function supportIdempotencyKey({ assignment, signal, now = new Date() }) {
    const dayKey = now.toISOString().slice(0, 10);
    const evidenceKey = signal.evidence?.created_at
        ? String(signal.evidence.created_at).slice(0, 10)
        : dayKey;
    return `support_radar:${assignment.coach_id}:${assignment.client_id}:${signal.signal}:${evidenceKey}`;
}

async function loadShannonCoachId() {
    const rows = await supabaseQuery(`users?select=id,email&email=eq.${encodeURIComponent(BALANCE_ADMIN_EMAIL)}&limit=1`);
    return rows[0]?.id || null;
}

async function loadActiveAssignments(coachId) {
    return supabaseQuery(
        `coach_clients?select=coach_id,client_id,assigned_at,client:users!coach_clients_client_id_fkey(id,name,email,last_login,is_test_account)&coach_id=eq.${coachId}&status=eq.active&limit=500`
    );
}

async function loadLatestThreads(clientIds = []) {
    if (!clientIds.length) return new Map();
    const out = new Map();
    const chunks = [];
    for (let i = 0; i < clientIds.length; i += 80) chunks.push(clientIds.slice(i, i + 80));
    for (const chunk of chunks) {
        const inList = chunk.map(id => `"${id}"`).join(',');
        const rows = await supabaseQuery(
            `ig_threads?select=id,subscriber_id,channel,ig_username,profile_name,linked_user_id,last_inbound_at,last_outbound_at,custom_data&linked_user_id=in.(${inList})&order=last_inbound_at.desc.nullslast&limit=300`
        ).catch(() => []);
        for (const row of rows) {
            if (!out.has(row.linked_user_id)) out.set(row.linked_user_id, row);
        }
    }
    return out;
}

async function loadConversationMessages({ assignment, thread, sinceIso }) {
    const messages = [];
    if (thread?.id) {
        const igRows = await supabaseQuery(
            `ig_messages?select=id,direction,text,source,created_at&thread_id=eq.${thread.id}&created_at=gte.${sinceIso}&order=created_at.desc&limit=80`
        ).catch(() => []);
        messages.push(...igRows.map(r => ({ ...r, source: r.source || 'instagram' })));
    }
    const nudgeRows = await supabaseQuery(
        `nudges?select=id,sender_id,receiver_id,message,created_at,nudge_type&or=(and(sender_id.eq.${assignment.client_id},receiver_id.eq.${assignment.coach_id}),and(sender_id.eq.${assignment.coach_id},receiver_id.eq.${assignment.client_id}))&created_at=gte.${sinceIso}&order=created_at.desc&limit=80`
    ).catch(() => []);
    for (const row of nudgeRows) {
        if (String(row.nudge_type || '').toLowerCase() === 'game_invite') continue;
        messages.push({
            id: row.id,
            direction: row.sender_id === assignment.client_id ? 'in' : 'out',
            text: row.message || '',
            source: 'in_app',
            created_at: row.created_at,
        });
    }
    return messages.sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''));
}

async function hasPendingSupportWork({ coachId, clientId }) {
    const rows = await supabaseQuery(
        `coach_alerts?select=id,alert_type,data&coach_id=eq.${coachId}&client_id=eq.${clientId}&status=eq.pending&limit=20`
    ).catch(() => []);
    return rows.some(row => {
        const data = safeObject(row.data);
        return data.needs_you_required === true
            || String(data.needs_you_required || '').toLowerCase() === 'true'
            || data.support_radar === true
            || String(data.support_radar || '').toLowerCase() === 'true';
    });
}

async function hasRecentSupportRadar({ coachId, clientId, signal, now = new Date() }) {
    const cutoff = new Date(now.getTime() - SUPPORT_COOLDOWN_DAYS * DAY_MS).toISOString();
    const rows = await supabaseQuery(
        `coach_alerts?select=id&coach_id=eq.${coachId}&client_id=eq.${clientId}&created_at=gte.${cutoff}&data->>support_radar_signal=eq.${encodeURIComponent(signal)}&limit=1`
    ).catch(() => []);
    return rows.length > 0;
}

async function hasRecentOutbound({ assignment, thread, now = new Date(), hours = 72 }) {
    const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
    const checks = [];
    checks.push(supabaseQuery(
        `nudges?select=id&sender_id=eq.${assignment.coach_id}&receiver_id=eq.${assignment.client_id}&created_at=gte.${cutoff}&limit=1`
    ).catch(() => []));
    if (thread?.id) {
        checks.push(supabaseQuery(
            `ig_messages?select=id&thread_id=eq.${thread.id}&direction=eq.out&created_at=gte.${cutoff}&limit=1`
        ).catch(() => []));
    }
    const results = await Promise.all(checks);
    return results.some(rows => rows.length > 0);
}

async function runSupportRadar({ maxAlerts = MAX_ALERTS_PER_RUN, now = new Date() } = {}) {
    const coachId = await loadShannonCoachId();
    if (!coachId) return { scanned: 0, inserted: 0, skipped: { no_coach: 1 } };

    const assignmentsRaw = await loadActiveAssignments(coachId);
    const assignments = assignmentsRaw.filter(a => !a.client?.is_test_account);
    const threadsByClient = await loadLatestThreads(assignments.map(a => a.client_id));
    const sinceIso = new Date(now.getTime() - LOW_MOOD_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
    const candidates = [];
    const skipped = {
        pending_exists: 0,
        cooldown: 0,
        recent_outbound: 0,
        no_signal: 0,
        cap: 0,
    };

    for (const assignment of assignments) {
        if (await hasPendingSupportWork({ coachId: assignment.coach_id, clientId: assignment.client_id })) {
            skipped.pending_exists++;
            continue;
        }

        const thread = threadsByClient.get(assignment.client_id) || null;
        const messages = await loadConversationMessages({ assignment, thread, sinceIso });
        const lowMood = classifyLowMoodSupport({ assignment, messages, nowMs: now.getTime() });
        if (lowMood) {
            if (await hasRecentSupportRadar({ coachId: assignment.coach_id, clientId: assignment.client_id, signal: lowMood.signal, now })) {
                skipped.cooldown++;
                continue;
            }
            candidates.push({ assignment, thread, signal: lowMood });
            continue;
        }

        const inactive = classifyInactiveSupport({ assignment, nowMs: now.getTime() });
        if (inactive) {
            if (await hasRecentSupportRadar({ coachId: assignment.coach_id, clientId: assignment.client_id, signal: inactive.signal, now })) {
                skipped.cooldown++;
                continue;
            }
            if (await hasRecentOutbound({ assignment, thread, now, hours: 72 })) {
                skipped.recent_outbound++;
                continue;
            }
            candidates.push({ assignment, thread, signal: inactive });
            continue;
        }

        skipped.no_signal++;
    }

    const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };
    candidates.sort((a, b) => (priorityWeight[b.signal.priority] || 0) - (priorityWeight[a.signal.priority] || 0));
    const selected = candidates.slice(0, Math.max(0, maxAlerts));
    skipped.cap = Math.max(0, candidates.length - selected.length);

    const inserted = [];
    for (const item of selected) {
        const alertRow = buildNeedsYouAlert({ ...item, now });
        const key = supportIdempotencyKey({ assignment: item.assignment, signal: item.signal, now });
        const result = await insertCoachAlert(alertRow, key);
        if (result.alertId && !result.deduped) {
            inserted.push({
                alertId: result.alertId,
                clientId: item.assignment.client_id,
                clientName: displayName(item.assignment),
                signal: item.signal.signal,
            });
        }
    }

    return {
        scanned: assignments.length,
        candidates: candidates.length,
        inserted: inserted.length,
        inserted_alerts: inserted,
        skipped,
    };
}

exports.handler = async () => {
    try {
        const result = await runSupportRadar();
        return {
            statusCode: 200,
            body: JSON.stringify({ ok: true, ...result }),
        };
    } catch (error) {
        console.error('[support-radar] failed:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ ok: false, error: error.message || String(error) }),
        };
    }
};

exports._test = {
    LOW_MOOD_RE,
    isLowMoodText,
    latestLowMoodInbound,
    hasLaterSupportFollowup,
    classifyLowMoodSupport,
    classifyInactiveSupport,
    buildNeedsYouAlert,
    supportIdempotencyKey,
    threadDeliveryData,
};

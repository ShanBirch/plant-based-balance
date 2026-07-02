/**
 * scheduled-coach-reply-worker — Netlify scheduled function.
 *
 * Runs every minute. Finds coach_alerts where:
 *   status = 'scheduled' AND scheduled_for <= now()
 * and fires each one through the same send-coach-reply path Shannon's manual
 * tap-Send uses. send-coach-reply branches on data.channel internally so
 * Instagram + Messenger drafts route through send-ig-reply automatically.
 *
 * Concurrency-safety: each alert is claimed via an atomic UPDATE that flips
 * status from 'scheduled' -> 'pending' (gated on the alert STILL being
 * scheduled and STILL due), so a slow run + a fast run can't double-fire the
 * same alert. After the claim, send-coach-reply does its own status check
 * and flips to 'sent', which is the terminal state.
 *
 * Schedule (registered in netlify.toml):
 *   [functions."scheduled-coach-reply-worker"]
 *     schedule = "* * * * *"
 *
 * Concurrency cap: each invocation processes up to MAX_PER_RUN alerts so a
 * pathological backlog doesn't blow Netlify's 10s function budget. Anything
 * not picked up this run gets caught by the next minute's run.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const {
    buildContextReviewInfo,
    buildMediaReviewInfo,
    normalizeCoachDraftText,
    isAlwaysNeedsYouPerson,
    shouldBypassKayNeedsYouForAlert,
} = require('./_lib/client-context');
const {
    coachDmManagerWindowLabel,
    isCoachDmManagerWorkingTime,
} = require('./_lib/coach-dm-working-hours');

// Hard cap per run. Realistic backlog should be 0-3. If we ever see this
// kicking in, it's either a worker outage or someone schedule-bombed the API.
const MAX_PER_RUN = 25;
const COCOS_BOT_ACCOUNT = 'cocos_pt_studio';
const DEFAULT_COACHING_URL = 'https://future-balance.netlify.app/coaching.html';
const AUTOMATED_PERMANENT_NEEDS_YOU_SCHEDULE_SOURCES = new Set([
    'auto_send',
    'balance_lead_client_manager_cron',
]);

async function supabase(path, options = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': options.prefer || 'return=representation',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase ${options.method || 'GET'} ${path} -> ${res.status} ${text}`);
    }
    const text = await res.text();
    if (!text || !text.trim()) return [];
    try { return JSON.parse(text); } catch { return []; }
}

/**
 * Atomically claim a single due alert by flipping it from 'scheduled' back
 * to 'pending'. The PostgREST PATCH with eq filters on BOTH status and
 * scheduled_for is the claim primitive — only one concurrent worker can win
 * the row, the other gets an empty array back.
 *
 * Returns the claimed alert row, or null if someone else won the race.
 */
async function claimAlert(alertId) {
    const claimed = await supabase(
        `coach_alerts?id=eq.${alertId}&status=eq.scheduled`,
        {
            method: 'PATCH',
            body: { status: 'pending' },
            prefer: 'return=representation',
        }
    );
    return claimed[0] || null;
}

function buildAutoSendReviewHold(alert) {
    const data = alert?.data || {};
    const isAutoSend = data.scheduled_via === 'auto_send'
        || data.reply_timing_choice?.source === 'auto_send'
        || data.reply_timing_suggestion?.source === 'auto_send';
    if (!isAutoSend) return null;
    const isManyChatDm = data.channel === 'instagram'
        || data.channel === 'messenger'
        || alert?.alert_type === 'ig_incoming_dm'
        || alert?.alert_type === 'fb_incoming_dm';
    if (!isManyChatDm) return null;
    const softContextBypass = hasAutoContextBypass(data);
    if (data.auto_send_review_approved_at) return null;
    const existingHold = data.auto_send_review_hold;
    const mediaReview = buildMediaReviewInfo(alert);
    const contextReview = buildContextReviewInfo(alert);
    if (existingHold?.code && !['media_review', 'context_review'].includes(existingHold.code)) return existingHold;
    if (mediaReview.required) {
        return {
            code: 'media_review',
            label: `${mediaReview.label || 'Media'} needs Shannon review`,
        };
    }
    if (contextReview.required && !softContextBypass) {
        return {
            code: 'context_review',
            label: contextReview.label || 'tracked DM context may be incomplete',
        };
    }
    const review = data.draft_review;
    if (!review) {
        return {
            code: 'draft_review_pending',
            label: 'AI draft review has not completed',
        };
    }
    if (String(review.verdict || '').toLowerCase() === 'block') {
        return {
            code: 'draft_review',
            label: review.summary || 'AI draft needs Shannon review',
        };
    }
    if (!softContextBypass && (review.verdict !== 'pass' || review.notification_required || review.context_loss_suspected)) {
        return {
            code: 'draft_review',
            label: review.summary || 'AI draft needs Shannon review',
        };
    }
    return null;
}

function isAutomatedPermanentNeedsYouScheduledAlert(alert = {}) {
    const data = alert?.data || {};
    const scheduledVia = String(data.scheduled_via || '').trim().toLowerCase();
    const timingChoiceSource = String(data.reply_timing_choice?.source || '').trim().toLowerCase();
    const timingSuggestionSource = String(data.reply_timing_suggestion?.source || '').trim().toLowerCase();
    return AUTOMATED_PERMANENT_NEEDS_YOU_SCHEDULE_SOURCES.has(scheduledVia)
        || timingChoiceSource === 'auto_send'
        || timingSuggestionSource === 'auto_send';
}

function buildPermanentNeedsYouHold(alert) {
    if (!isAutomatedPermanentNeedsYouScheduledAlert(alert)) return null;
    if (shouldBypassKayNeedsYouForAlert({ alert })) return null;
    const data = alert?.data || {};
    const graph = data.instagram_graph || {};
    const customData = data.custom_data || {};
    const needsYouReasons = Array.isArray(data.needs_you_reasons) ? data.needs_you_reasons : [];
    if (data.permanent_needs_you_draft_only === true
        || data.needs_you_reason === 'always_needs_you_person'
        || needsYouReasons.includes('always_needs_you_person')
        || isAlwaysNeedsYouPerson({
            name: alert?.client_name || data.client_name || data.profile_name || data.ig_profile_name,
            client_name: alert?.client_name || data.client_name,
            profile_name: data.profile_name || data.ig_profile_name || graph.profile_name || customData.profile_name,
            ig_username: data.ig_username || graph.ig_username || graph.username || customData.ig_username,
            username: data.username || graph.username || customData.username,
            handle: data.handle || customData.handle,
            custom_data: {
                ...customData,
                instagram_graph: {
                    ...(customData.instagram_graph || {}),
                    ...graph,
                },
            },
        })) {
        return {
            code: 'always_needs_you_person',
            label: 'permanent Needs You client',
        };
    }
    return null;
}

function hasCocosAutoContextBypass(data = {}) {
    const botAccount = String(data.bot_account || data.instagram_graph?.bot_account || '').replace(/^@+/, '').toLowerCase();
    const fork = String(data.algorithm_fork || '').toLowerCase();
    const isCocos = botAccount === COCOS_BOT_ACCOUNT || fork === 'cocos_acquisition_v1' || data.auto_send_default_reason === 'cocos_auto_lane';
    const bypass = data.auto_send_context_bypass || {};
    const allowedReason = bypass.reason === 'soft_first_text_reply' || bypass.reason === 'soft_tracked_small_talk';
    if (!isCocos || bypass.allowed !== true || !allowedReason) return false;
    const review = data.draft_review || {};
    if (String(review.verdict || '').toLowerCase() === 'block' || review.context_loss_suspected) return false;
    const issues = Array.isArray(review.issues) ? review.issues.map(v => String(v || '').toLowerCase()) : [];
    const reason = String(review.notification_reason || '').toLowerCase();
    const summary = String(review.summary || '').toLowerCase();
    return reason === 'review_timeout'
        || issues.includes('review_timeout')
        || /review did not finish|review timeout|timed out/.test(summary);
}

function hasAutoContextBypass(data = {}) {
    if (hasCocosAutoContextBypass(data)) return true;
    const bypass = data.auto_send_context_bypass || {};
    const reason = String(bypass.reason || '').toLowerCase();
    if (bypass.allowed !== true || !reason.startsWith('soft_review_timeout')) return false;
    const review = data.draft_review || {};
    if (String(review.verdict || '').toLowerCase() === 'block' || review.context_loss_suspected) return false;
    const issues = Array.isArray(review.issues) ? review.issues.map(v => String(v || '').toLowerCase()) : [];
    const notificationReason = String(review.notification_reason || '').toLowerCase();
    const summary = String(review.summary || '').toLowerCase();
    return notificationReason === 'review_timeout'
        || issues.includes('review_timeout')
        || /review did not finish|review timeout|timed out/.test(summary);
}

function truncate(value, max = 220) {
    const text = String(value || '').trim();
    if (text.length <= max) return text;
    return `${text.slice(0, Math.max(0, max - 1))}...`;
}

function hasVisibleUrl(text) {
    return /https?:\/\/\S+/i.test(String(text || ''));
}

function promisesLinkWithoutUrl(text) {
    const s = String(text || '');
    if (!s || hasVisibleUrl(s)) return false;
    return /\b(?:here'?s|heres|here is)\s+(?:the\s+)?link\b/i.test(s)
        || /\b(?:link|url)\s+(?:is|below|here)\b/i.test(s)
        || /\b(?:check it out|grab the app|download the app)\b/i.test(s);
}

function resolveSignupHandoffUrl(alert) {
    const data = alert?.data || {};
    const url = String(data.signup_link_handoff_url || data.signupLinkHandoffUrl || '').trim();
    if (/^https?:\/\//i.test(url)) return url;
    if (data.approved_link_auto_sendable === true || data.signup_link_manual_only === true || data.client_manager_review_required === true) {
        return DEFAULT_COACHING_URL;
    }
    return '';
}

function repairMissingScheduledLinkHandoff(alert, replyText) {
    const text = normalizeCoachDraftText(replyText || '');
    const url = resolveSignupHandoffUrl(alert);
    if (!text || !url || !promisesLinkWithoutUrl(text)) return { text, repaired: false, url: '' };
    return {
        text: `${text}\n${url}`,
        repaired: true,
        url,
    };
}

async function sendAutoSendHoldNotification(alert, autoHold) {
    const data = alert?.data || {};
    const coachId = alert?.coach_id;
    if (!coachId || !alert?.id) return;
    const clientName = alert.client_name || data.profile_name || data.ig_username || 'DM';
    const clientId = alert.client_id
        || data.linked_user_id
        || data.subscriber_id
        || data.ig_thread_id
        || alert.id;
    const channel = data.channel || 'instagram';
    const channelLabel = channel === 'messenger' ? 'Balance FB' : 'Balance IG';
    const openUrl = channel === 'messenger'
        ? 'https://www.messenger.com/'
        : 'https://www.instagram.com/direct/inbox/';
    const draftText = normalizeCoachDraftText(alert.scheduled_reply_text || alert.suggested_message || data.draft_text || '');
    const clientMessage = data.message_preview || alert.description || '';
    try {
        await fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientId: coachId,
                senderId: clientId,
                senderName: `AI stopped - ${clientName}`,
                messageText: truncate(`Auto-send needs review: ${autoHold.label || autoHold.code || 'review required'}`),
                type: 'coach_draft_ready',
                alertId: alert.id,
                clientId,
                clientName,
                clientMessage,
                draftText,
                isSimpleReply: false,
                sourceChannel: channel,
                channelLabel,
                openUrl,
                actionRequired: true,
                actionType: `auto_send_${autoHold.code || 'review_hold'}`,
                actionLabel: 'AI stopped',
                actionReason: autoHold.label || 'needs review before sending',
            }),
        }).catch(e => console.warn(`[scheduled-worker] auto-review hold push failed for ${alert.id}:`, e.message));
    } catch (e) {
        console.warn(`[scheduled-worker] auto-review hold push errored for ${alert.id}:`, e.message);
    }
}

/**
 * Hand the (now pending again) alert to send-coach-reply, which already knows
 * how to route to the in-app or ManyChat path based on data.channel and how
 * to flip to 'sent' once delivered.
 */
async function fireAlert(alert) {
    const repairedLink = repairMissingScheduledLinkHandoff(alert, alert.scheduled_reply_text || alert.suggested_message || '');
    const replyText = repairedLink.text;
    const draftText = normalizeCoachDraftText(alert.suggested_message || '');
    if (!replyText) {
        // Defensive: a scheduled alert with no text shouldn't exist. Mark it
        // canceled so we don't keep retrying.
        try {
            await supabase(`coach_alerts?id=eq.${alert.id}`, {
                method: 'PATCH',
                body: {
                    status: 'canceled',
                    data: { ...(alert.data || {}), cancel_reason: 'empty_scheduled_text' },
                },
                prefer: 'return=minimal',
            });
        } catch { /* non-fatal */ }
        return { ok: false, error: 'empty_scheduled_text' };
    }

    const autoHold = buildPermanentNeedsYouHold(alert) || buildAutoSendReviewHold(alert);
    if (autoHold) {
        const heldAt = new Date().toISOString();
        const isPermanentNeedsYouHold = autoHold.code === 'always_needs_you_person';
        try {
            await supabase(`coach_alerts?id=eq.${alert.id}`, {
                method: 'PATCH',
                body: {
                    data: {
                        ...(alert.data || {}),
                        ...(isPermanentNeedsYouHold ? {
                            client_manager_review_required: true,
                            needs_you_required: true,
                            operator_queue: 'needs_you',
                            needs_you_reason: 'always_needs_you_person',
                            needs_you_reasons: [
                                ...new Set([
                                    ...(Array.isArray(alert.data?.needs_you_reasons) ? alert.data.needs_you_reasons : []),
                                    'always_needs_you_person',
                                ]),
                            ],
                            permanent_needs_you_draft_only: true,
                        } : {}),
                        auto_send_review_hold: {
                            ...autoHold,
                            held_at: autoHold.held_at || heldAt,
                            held_by: autoHold.held_by || 'scheduled_worker',
                        },
                        schedule_blocked_at: heldAt,
                        schedule_blocked_reason: autoHold.code,
                    },
                },
                prefer: 'return=minimal',
            });
        } catch (e) {
            console.warn(`[scheduled-worker] failed to stamp auto-review hold for ${alert.id}:`, e.message);
        }
        await sendAutoSendHoldNotification(alert, autoHold);
        return { ok: false, error: `auto_review_hold_${autoHold.code}` };
    }

    if (repairedLink.repaired) {
        try {
            await supabase(`coach_alerts?id=eq.${alert.id}`, {
                method: 'PATCH',
                body: {
                    scheduled_reply_text: replyText,
                    data: {
                        ...(alert.data || {}),
                        scheduled_link_repaired_at: new Date().toISOString(),
                        scheduled_link_repaired_by: 'scheduled_worker',
                        scheduled_link_repaired_url: repairedLink.url,
                    },
                },
                prefer: 'return=minimal',
            });
        } catch (e) {
            console.warn(`[scheduled-worker] failed to persist repaired link for ${alert.id}:`, e.message);
        }
    }

    const res = await fetch(`${SITE_URL}/.netlify/functions/send-coach-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            alertId: alert.id,
            replyText,
            draftText,
            source: 'scheduled_worker',
        }),
    });
    const text = await res.text();
    if (!res.ok) {
        console.error(`[scheduled-worker] send-coach-reply ${res.status} for alert ${alert.id}: ${text.slice(0, 240)}`);
        // If send failed for a transient reason, leave it pending — the next
        // worker tick won't pick it up (status is no longer 'scheduled'), so
        // the alert lands in Shannon's regular inbox flow as a still-pending
        // item he can re-action manually. This is safer than retrying blindly
        // and double-sending after eventual recovery.
        return { ok: false, error: `send_failed_${res.status}` };
    }
    return { ok: true };
}

exports.handler = async () => {
    const startedAt = Date.now();
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured' }) };
    }

    const nowIso = new Date().toISOString();
    if (!isCoachDmManagerWorkingTime(new Date(nowIso))) {
        console.info('[scheduled-worker] paused outside working window', JSON.stringify({
            at: nowIso,
            working_window: coachDmManagerWindowLabel(),
        }));
        return {
            statusCode: 200,
            body: JSON.stringify({
                checked_at: nowIso,
                paused: true,
                working_window: coachDmManagerWindowLabel(),
                due: 0,
                fired: 0,
            }),
        };
    }

    let due = [];
    try {
        due = await supabase(
            `coach_alerts?select=id,coach_id,client_id,client_name,scheduled_for,scheduled_reply_text,suggested_message,data,alert_type&status=eq.scheduled&scheduled_for=lte.${nowIso}&order=scheduled_for.asc&limit=${MAX_PER_RUN}`
        );
    } catch (e) {
        console.error('[scheduled-worker] due-query failed:', e.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'due_query_failed', details: e.message }) };
    }

    if (due.length === 0) {
        return {
            statusCode: 200,
            body: JSON.stringify({ checked_at: nowIso, due: 0, fired: 0 }),
        };
    }

    console.log(`[scheduled-worker] ${due.length} alert(s) due at ${nowIso}`);

    let fired = 0;
    let lostRace = 0;
    let failed = 0;

    for (const alert of due) {
        // Claim — wins exactly once across concurrent workers.
        const claimed = await claimAlert(alert.id);
        if (!claimed) {
            lostRace++;
            continue;
        }
        // Use the freshly-claimed row (newer than the initial query result)
        // so we have the latest data/scheduled_reply_text fields.
        const result = await fireAlert(claimed);
        if (result.ok) fired++;
        else failed++;
    }

    const elapsedMs = Date.now() - startedAt;
    return {
        statusCode: 200,
        body: JSON.stringify({
            checked_at: nowIso,
            due: due.length,
            fired,
            lost_race: lostRace,
            failed,
            elapsed_ms: elapsedMs,
        }),
    };
};

exports._test = {
    buildAutoSendReviewHold,
    isAutomatedPermanentNeedsYouScheduledAlert,
    buildPermanentNeedsYouHold,
    hasCocosAutoContextBypass,
    hasAutoContextBypass,
    repairMissingScheduledLinkHandoff,
    isCoachDmManagerWorkingTime,
};

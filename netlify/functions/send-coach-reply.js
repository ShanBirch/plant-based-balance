/**
 * send-coach-reply — handler for the Android inline-reply action on a
 * "coach_draft_ready" notification.
 *
 * Called by the native CoachReplyReceiver (android/.../CoachReplyReceiver.java)
 * when Shannon hits "Send" on the notification shade / lockscreen. Takes the
 * drafted (possibly edited) reply text and:
 *   1. Looks up the coach_alert by id — verifies status is still 'pending'
 *      (rejects if already sent, prevents replay / double-send)
 *   2. Inserts the reply as a nudge (sender = coach, receiver = client)
 *   3. Marks the coach_alert as sent + records sent_message + was_edited
 *
 * Authorization model: the coach_alert UUID itself is the capability token.
 * It's:
 *   - Unguessable (v4 UUID)
 *   - One-use (we flip status to 'sent', so a replay gets rejected)
 *   - Only delivered to the admin's device via FCM (which requires the app's
 *     device-specific FCM token, obtained only after authenticated install)
 * This is the same security model PR #1243 uses for the batch ai-client-monitor
 * "quick send" flow — no JWT on the device, server validates via alert status.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const SEND_CLAIM_STALE_MS = 10 * 60 * 1000;
const {
    normalizeGeneratedCoachDraftText,
    sanitizeVisibleOutboundDmText,
    fireCoachEditAnalysis,
    isAlwaysNeedsYouPerson,
    shouldBypassKayNeedsYouForAlert,
} = require('./_lib/client-context');
const { resolveUtf8TransportText } = require('./_lib/outbound-text-integrity');

async function supabase(path, options = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${path}`;
    const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': options.prefer || 'return=representation',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Supabase ${options.method || 'GET'} ${path} failed: ${response.status} ${text}`);
    }
    const text = await response.text();
    if (!text || text.trim() === '') return [];
    try { return JSON.parse(text); } catch { return []; }
}

function createSendClaim(source) {
    const suffix = Math.random().toString(36).slice(2, 10);
    return {
        id: `${Date.now()}-${suffix}`,
        at: new Date().toISOString(),
        source: source || 'unknown',
    };
}

function withSendClaim(data = {}, claim) {
    return {
        ...(data || {}),
        send_claim_id: claim.id,
        send_claimed_at: claim.at,
        send_claimed_via: claim.source,
    };
}

function withoutSendClaim(data = {}) {
    const clean = { ...(data || {}) };
    delete clean.send_claim_id;
    delete clean.send_claimed_at;
    delete clean.send_claimed_via;
    return clean;
}

function getSendClaimId(data = {}) {
    return String(data?.send_claim_id || '').trim();
}

function isSendClaimStale(data = {}, nowMs = Date.now()) {
    const claimId = getSendClaimId(data);
    if (!claimId) return false;
    const claimedAtMs = Date.parse(data?.send_claimed_at || '');
    return !Number.isFinite(claimedAtMs) || (nowMs - claimedAtMs) > SEND_CLAIM_STALE_MS;
}

async function claimPendingAlertForSend(alert, source) {
    const claim = createSendClaim(source);
    let claimedRows = await supabase(
        `coach_alerts?id=eq.${encodeURIComponent(alert.id)}&status=eq.pending&data->>send_claim_id=is.null`,
        {
            method: 'PATCH',
            body: { data: withSendClaim(alert.data || {}, claim) },
            prefer: 'return=representation',
        }
    );
    const claimed = claimedRows[0] || null;
    if (claimed) return { ...claimed, sendClaim: claim };

    const current = await loadAlertSendState(alert.id);
    const staleClaimId = current?.status === 'pending' && isSendClaimStale(current?.data)
        ? getSendClaimId(current.data)
        : '';
    if (!staleClaimId) return null;

    claimedRows = await supabase(
        `coach_alerts?id=eq.${encodeURIComponent(alert.id)}&status=eq.pending&data->>send_claim_id=eq.${encodeURIComponent(staleClaimId)}`,
        {
            method: 'PATCH',
            body: { data: withSendClaim(current.data || alert.data || {}, claim) },
            prefer: 'return=representation',
        }
    );
    const reclaimed = claimedRows[0] || null;
    return reclaimed ? { ...reclaimed, sendClaim: claim } : null;
}

async function loadAlertSendState(alertId) {
    try {
        const rows = await supabase(
            `coach_alerts?select=id,status,data&id=eq.${encodeURIComponent(alertId)}&limit=1`
        );
        return rows[0] || null;
    } catch (err) {
        console.warn('[send-coach-reply] send-state lookup failed:', err.message);
        return null;
    }
}

async function duplicateSendResponse(alertId) {
    const current = await loadAlertSendState(alertId);
    const status = current?.status || null;
    const inProgress = status === 'pending' && current?.data?.send_claim_id;
    return {
        statusCode: 409,
        body: JSON.stringify({
            error: inProgress ? 'Alert is already sending' : 'Alert already actioned',
            status,
            code: inProgress ? 'alert_send_in_progress' : 'alert_send_already_actioned',
        }),
    };
}

async function releaseSendClaim(alertId, claimId, alertData, errorMessage, errorCode) {
    const data = withoutSendClaim(alertData || {});
    const now = new Date().toISOString();
    data.last_send_error = String(errorMessage || 'Send failed').slice(0, 500);
    data.last_send_error_code = errorCode || 'send_failed';
    data.last_send_error_at = now;

    try {
        await supabase(`coach_alerts?id=eq.${encodeURIComponent(alertId)}&status=eq.pending&data->>send_claim_id=eq.${encodeURIComponent(claimId || '')}`, {
            method: 'PATCH',
            body: { data },
            prefer: 'return=minimal',
        });
    } catch (err) {
        console.warn('[send-coach-reply] send-claim release failed:', err.message);
    }
}

function normalizeTimingSuggestion(value) {
    if (!value || typeof value !== 'object') return null;
    const delay = Number(value.delay_ms);
    return {
        action: value.action === 'send_now' ? 'send_now' : 'schedule',
        delay_ms: Number.isFinite(delay) && delay >= 0 ? delay : null,
        label: String(value.label || '').slice(0, 40),
        reason: String(value.reason || '').slice(0, 240),
        confidence: Number.isFinite(Number(value.confidence)) ? Number(value.confidence) : null,
        signals: value.signals && typeof value.signals === 'object' ? value.signals : {},
    };
}

const IN_APP_DM_ALERT_TYPES = ['incoming_dm', 'unread_message'];
const PERMANENT_NEEDS_YOU_AUTOMATED_SEND_MESSAGE = 'Permanent Needs You contacts require Shannon approval before sending.';
const CURRENT_CLIENT_AUTOMATED_SEND_MESSAGE = 'Current clients require Shannon approval from Needs You before sending.';
const AUTOMATED_PERMANENT_NEEDS_YOU_SEND_SOURCES = new Set([
    'auto_send',
    'balance_lead_client_manager_cron',
]);

function isHumanApprovedPermanentNeedsYouSendSource(source) {
    const normalized = String(source || '').trim().toLowerCase();
    return normalized.startsWith('admin_dashboard')
        || normalized === 'android_inline_reply_worker'
        || normalized === 'manual_instagram';
}

function isAutomatedPermanentNeedsYouSendSource(source, data = {}) {
    const normalized = String(source || '').trim().toLowerCase();
    const scheduledVia = String(data.scheduled_via || '').trim().toLowerCase();
    const timingChoiceSource = String(data.reply_timing_choice?.source || '').trim().toLowerCase();
    const timingSuggestionSource = String(data.reply_timing_suggestion?.source || '').trim().toLowerCase();
    const hasAutoSendMetadata = scheduledVia === 'auto_send'
        || timingChoiceSource === 'auto_send'
        || timingSuggestionSource === 'auto_send';
    if (isHumanApprovedPermanentNeedsYouSendSource(normalized) && !hasAutoSendMetadata) {
        return false;
    }
    if (normalized === 'scheduled_worker') {
        return hasAutoSendMetadata;
    }
    return AUTOMATED_PERMANENT_NEEDS_YOU_SEND_SOURCES.has(normalized)
        || hasAutoSendMetadata;
}

function isAppSupportFastFixException(data = {}) {
    const supportException = data.support_exception === true || data.support_exception === 'true';
    const reason = String(data.support_exception_reason || '').trim();
    return supportException && reason === 'app_support_fast_fix';
}

function isPermanentNeedsYouAlert(alert = {}) {
    const data = alert.data || {};
    const needsYouReasons = Array.isArray(data.needs_you_reasons) ? data.needs_you_reasons : [];
    if (data.permanent_needs_you_draft_only === true) return true;
    if (data.needs_you_reason === 'always_needs_you_person') return true;
    if (needsYouReasons.includes('always_needs_you_person')) return true;
    return isAlwaysNeedsYouPerson({
        name: alert.client_name || data.client_name,
        client_name: alert.client_name || data.client_name,
        profile_name: data.profile_name || data.ig_profile_name,
        ig_username: data.ig_username,
        username: data.username,
        handle: data.handle,
        custom_data: data.custom_data || data.instagram_graph || {},
    });
}

function shouldBlockPermanentNeedsYouAutomatedSend(alert = {}, source = '') {
    const data = alert.data || {};
    return isAutomatedPermanentNeedsYouSendSource(source, data)
        && !isAppSupportFastFixException(data)
        && !shouldBypassKayNeedsYouForAlert({ alert })
        && isPermanentNeedsYouAlert(alert);
}

function isCurrentClientAlert(alert = {}, liveThread = null) {
    const data = alert.data || {};
    return !!(
        liveThread?.linked_user_id
        || alert.client_id
        || data.linked_user_id
        || data.linked_client_manual_review === true
        || data.needs_you_reason === 'linked_client_requires_shannon_approval'
    );
}

function shouldBlockCurrentClientAutomatedSend(alert = {}, source = '', liveThread = null) {
    return isAutomatedPermanentNeedsYouSendSource(source, alert.data || {})
        && isCurrentClientAlert(alert, liveThread);
}

async function loadLiveIgThreadClientState(alert = {}) {
    const threadId = alert.data?.ig_thread_id;
    if (!threadId) return null;
    const rows = await supabase(
        `ig_threads?select=id,linked_user_id&id=eq.${encodeURIComponent(threadId)}&limit=1`
    );
    return rows?.[0] || null;
}

async function stampCurrentClientAutomatedSendBlock(alert = {}, liveThread = null) {
    if (!alert.id) return;
    const blockedAt = new Date().toISOString();
    const sourceData = alert.data || {};
    const reason = 'linked_client_requires_shannon_approval';
    const data = {
        ...sourceData,
        linked_user_id: liveThread?.linked_user_id || alert.client_id || sourceData.linked_user_id || undefined,
        client_manager_review_required: true,
        needs_you_required: true,
        needs_shannon_approval: true,
        linked_client_manual_review: true,
        permanent_needs_you_draft_only: true,
        operator_queue: 'needs_you',
        needs_you_reason: reason,
        needs_you_reasons: [...new Set([
            ...(Array.isArray(sourceData.needs_you_reasons) ? sourceData.needs_you_reasons : []),
            reason,
        ])],
        last_send_error: CURRENT_CLIENT_AUTOMATED_SEND_MESSAGE,
        last_send_error_code: 'current_client_automated_send_blocked',
        last_send_error_at: blockedAt,
        outbound_attempted: false,
    };
    await supabase(`coach_alerts?id=eq.${encodeURIComponent(alert.id)}`, {
        method: 'PATCH',
        body: { data },
        prefer: 'return=minimal',
    });
}

async function stampPermanentNeedsYouAutomatedSendBlock(alert = {}) {
    if (!alert.id) return;
    const blockedAt = new Date().toISOString();
    const data = {
        ...(alert.data || {}),
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
        last_send_error: PERMANENT_NEEDS_YOU_AUTOMATED_SEND_MESSAGE,
        last_send_error_code: 'permanent_needs_you_automated_send_blocked',
        last_send_error_at: blockedAt,
    };
    try {
        await supabase(`coach_alerts?id=eq.${encodeURIComponent(alert.id)}`, {
            method: 'PATCH',
            body: { data },
            prefer: 'return=minimal',
        });
    } catch (err) {
        console.warn('[send-coach-reply] permanent Needs You block stamp failed:', err.message);
    }
}

async function clearInAppHomeNotifications({ alertId, coachId, clientId, sentAt, source }) {
    if (!coachId || !clientId) return { nudgesRead: 0, siblingAlertsCleared: 0 };
    const coach = encodeURIComponent(coachId);
    const client = encodeURIComponent(clientId);
    let nudgesRead = 0;
    let siblingAlertsCleared = 0;

    try {
        const readRows = await supabase(
            `nudges?sender_id=eq.${client}&receiver_id=eq.${coach}&created_at=lte.${encodeURIComponent(sentAt)}&read_at=is.null`,
            {
                method: 'PATCH',
                body: { read_at: sentAt },
                prefer: 'return=representation',
            }
        );
        nudgesRead = Array.isArray(readRows) ? readRows.length : 0;
    } catch (e) {
        console.warn('[send-coach-reply] inbound nudge read cleanup failed:', e.message);
    }

    try {
        const siblingRows = await supabase(
            `coach_alerts?select=id,data&coach_id=eq.${coach}&client_id=eq.${client}&status=eq.pending&id=neq.${encodeURIComponent(alertId)}&alert_type=in.(${IN_APP_DM_ALERT_TYPES.join(',')})&created_at=lte.${encodeURIComponent(sentAt)}&limit=25`
        );
        for (const sibling of siblingRows) {
            const mergedData = {
                ...(sibling.data || {}),
                cancel_reason: 'cleared_by_outbound_reply',
                cleared_by_outbound_reply_at: sentAt,
                cleared_by_outbound_reply_source: source,
                cleared_by_primary_alert_id: alertId,
            };
            await supabase(`coach_alerts?id=eq.${encodeURIComponent(sibling.id)}`, {
                method: 'PATCH',
                body: {
                    status: 'canceled',
                    actioned_at: sentAt,
                    data: mergedData,
                },
                prefer: 'return=minimal',
            });
            siblingAlertsCleared++;
        }
    } catch (e) {
        console.warn('[send-coach-reply] sibling alert cleanup failed:', e.message);
    }

    return { nudgesRead, siblingAlertsCleared };
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured' }) };
    }

    let body;
    try { body = JSON.parse(event.body); }
    catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    const alertId = body.alertId;
    let replyTextInput;
    let draftTextInput;
    try {
        replyTextInput = normalizeGeneratedCoachDraftText(resolveUtf8TransportText({
            text: body.replyText,
            textUtf8Base64: body.replyTextUtf8Base64 || body.reply_text_utf8_base64,
            fieldName: 'replyText',
        })).trim();
        draftTextInput = normalizeGeneratedCoachDraftText(resolveUtf8TransportText({
            text: body.draftText,
            textUtf8Base64: body.draftTextUtf8Base64 || body.draft_text_utf8_base64,
            fieldName: 'draftText',
        })).trim();
    } catch (err) {
        return { statusCode: 400, body: JSON.stringify({ error: err.message, code: err.code || 'invalid_utf8_base64' }) };
    }
    const source = body.source || 'unknown';
    // Optional one-line note from Shannon explaining WHY he edited the
    // draft. Stamped into data.edit_reason when the reply differs from
    // the original draft. Feeds the voice-match learning corpus.
    const editReason = (body.editReason || body.edit_reason || '').trim().slice(0, 240);
    const timingSuggestion = normalizeTimingSuggestion(body.timingSuggestion || body.reply_timing_suggestion);

    if (!alertId || !replyTextInput) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing alertId or replyText' }) };
    }

    // 1. Load the alert — we need coach_id, client_id, and current status
    let alert;
    try {
        const rows = await supabase(
            `coach_alerts?select=id,client_id,client_name,coach_id,status,data,alert_type&id=eq.${alertId}&limit=1`
        );
        alert = rows[0];
    } catch (e) {
        console.error('[send-coach-reply] alert lookup failed:', e.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Alert lookup failed' }) };
    }

    if (!alert) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Alert not found' }) };
    }
    if (alert.status && alert.status !== 'pending') {
        // Already actioned — don't double-send. The receiver treats 4xx as a
        // hard error, so the user gets a "Send failed" notification. That's
        // appropriate: the reply already went through via another path.
        return { statusCode: 409, body: JSON.stringify({
            error: 'Alert already actioned',
            status: alert.status,
        }) };
    }
    let liveThread = null;
    if (isAutomatedPermanentNeedsYouSendSource(source, alert.data || {}) && alert.data?.ig_thread_id) {
        try {
            liveThread = await loadLiveIgThreadClientState(alert);
        } catch (error) {
            console.warn('[send-coach-reply] linked-client status lookup failed:', error.message);
            if (isCurrentClientAlert(alert)) {
                await stampCurrentClientAutomatedSendBlock(alert);
                return { statusCode: 409, body: JSON.stringify({
                    error: CURRENT_CLIENT_AUTOMATED_SEND_MESSAGE,
                    code: 'current_client_automated_send_blocked',
                    source,
                }) };
            }
            return { statusCode: 503, body: JSON.stringify({
                error: 'Client status could not be verified, so the automated send was stopped.',
                code: 'current_client_status_unverified',
            }) };
        }
        if (!liveThread && !isCurrentClientAlert(alert)) {
            return { statusCode: 409, body: JSON.stringify({
                error: 'Instagram thread could not be verified, so the automated send was stopped.',
                code: 'current_client_status_unverified',
            }) };
        }
    }
    if (shouldBlockCurrentClientAutomatedSend(alert, source, liveThread)) {
        await stampCurrentClientAutomatedSendBlock(alert, liveThread);
        return { statusCode: 409, body: JSON.stringify({
            error: CURRENT_CLIENT_AUTOMATED_SEND_MESSAGE,
            code: 'current_client_automated_send_blocked',
            source,
        }) };
    }
    if (shouldBlockPermanentNeedsYouAutomatedSend(alert, source)) {
        await stampPermanentNeedsYouAutomatedSendBlock(alert);
        return { statusCode: 409, body: JSON.stringify({
            error: PERMANENT_NEEDS_YOU_AUTOMATED_SEND_MESSAGE,
            code: 'permanent_needs_you_automated_send_blocked',
            source,
        }) };
    }

    // Channel routing: WhatsApp alerts go through the Cloud API sender. IG/FB
    // alert rows go through send-ig-reply instead of
    // inserting a nudges row. That function chooses Instagram Graph first for
    // IG and keeps ManyChat only as the Messenger / legacy fallback.
    const alertData = alert.data || {};
    const shouldSanitizeVisibleLeadCopy = !alert.client_id;
    const replyText = shouldSanitizeVisibleLeadCopy
        ? sanitizeVisibleOutboundDmText(replyTextInput)
        : replyTextInput;
    const draftText = shouldSanitizeVisibleLeadCopy
        ? sanitizeVisibleOutboundDmText(draftTextInput)
        : draftTextInput;
    if (!replyText) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Reply text became empty after visible-copy cleanup' }) };
    }
    if (alertData.channel === 'whatsapp' || alertData.delivery_channel === 'whatsapp_cloud' || alert.alert_type === 'whatsapp_incoming_message') {
        try {
            const res = await fetch(`${SITE_URL}/.netlify/functions/send-whatsapp-reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alertId, replyText, draftText, source, editReason, timingSuggestion }),
            });
            const text = await res.text();
            return { statusCode: res.status, body: text || JSON.stringify({ ok: res.ok }) };
        } catch (err) {
            console.error('[send-coach-reply] WhatsApp forward failed:', err.message);
            return { statusCode: 502, body: JSON.stringify({ error: 'WhatsApp forward failed', details: err.message }) };
        }
    }
    const hasExternalThread = !!alertData.ig_thread_id;
    const isInstagramOrMessenger = alertData.channel === 'instagram'
        || alertData.channel === 'messenger'
        || (
            hasExternalThread
            && (
                alertData.channel === 'manual_ig'
                || alertData.delivery_channel === 'manual_ig'
                || alertData.delivery_channel === 'instagram_graph'
                || alertData.manual_ig_required === true
                || alert.alert_type === 'ig_incoming_dm'
                || alert.alert_type === 'fb_incoming_dm'
            )
        );
    if (isInstagramOrMessenger) {
        try {
            const res = await fetch(`${SITE_URL}/.netlify/functions/send-ig-reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alertId, replyText, draftText, source, editReason, timingSuggestion }),
            });
            const text = await res.text();
            return { statusCode: res.status, body: text || JSON.stringify({ ok: res.ok }) };
        } catch (err) {
            console.error('[send-coach-reply] IG forward failed:', err.message);
            return { statusCode: 502, body: JSON.stringify({ error: 'IG forward failed', details: err.message }) };
        }
    }

    if (!alert.coach_id || !alert.client_id) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Alert missing coach/client ids' }) };
    }

    let claimedAlert;
    let sendClaimId = '';
    try {
        claimedAlert = await claimPendingAlertForSend(alert, source);
    } catch (err) {
        console.error('[send-coach-reply] alert send claim failed:', err.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Could not claim alert for sending' }) };
    }
    if (!claimedAlert) {
        return duplicateSendResponse(alertId);
    }
    alert = {
        ...alert,
        data: claimedAlert.data || alert.data || {},
    };
    sendClaimId = claimedAlert.sendClaim?.id || '';

    // 2. Insert the reply as a nudge (client-to-client DM row in the nudges table).
    //    The DB trigger `notify_nudge_recipient` fires here — since the receiver
    //    is the client (not admin), it routes a normal DM push to the client.
    try {
        await supabase('nudges', {
            method: 'POST',
            body: [{
                sender_id: alert.coach_id,
                receiver_id: alert.client_id,
                message: replyText,
            }],
            prefer: 'return=minimal',
        });
    } catch (e) {
        console.error('[send-coach-reply] nudge insert failed:', e.message);
        await releaseSendClaim(alertId, sendClaimId, alert.data, e.message, 'nudge_insert_failed');
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send message' }) };
    }

    // 3. Mark the alert as sent so the admin dashboard clears it + the AI
    //    "learn from past edits" logic (see instant-coach-draft.js) has a
    //    labelled example to train on.
    const wasEdited = !!draftText && replyText !== draftText;
    const sentAt = new Date().toISOString();
    const mergedData = {
        ...withoutSendClaim(alert.data || {}),
        sent_message: replyText,
        was_edited: wasEdited,
        sent_at: sentAt,
        sent_via: source,
    };
    if (wasEdited && editReason) {
        mergedData.edit_reason = editReason;
    }
    if (timingSuggestion) {
        mergedData.reply_timing_suggestion = timingSuggestion;
        mergedData.reply_timing_choice = {
            action: 'send_now',
            chosen_delay_ms: 0,
            chosen_at: sentAt,
            source,
        };
    }
    let alertMarkedSent = false;
    try {
        const markedRows = await supabase(`coach_alerts?id=eq.${encodeURIComponent(alertId)}&status=eq.pending&data->>send_claim_id=eq.${encodeURIComponent(sendClaimId)}`, {
            method: 'PATCH',
            body: {
                status: 'sent',
                actioned_at: sentAt,
                data: mergedData,
            },
            prefer: 'return=representation',
        });
        alertMarkedSent = markedRows.length > 0;
        if (!alertMarkedSent) {
            console.warn(`[send-coach-reply] alert ${alertId} was delivered but its send claim was lost before mark-sent`);
        }
    } catch (e) {
        console.warn('[send-coach-reply] alert update failed (non-fatal):', e.message);
        // Reply is already delivered — don't 500 just because bookkeeping failed.
    }

    const cleanup = await clearInAppHomeNotifications({
        alertId,
        coachId: alert.coach_id,
        clientId: alert.client_id,
        sentAt,
        source,
    });

    if (alertMarkedSent) {
        await fireCoachEditAnalysis({
            alertId,
            draftText,
            sentMessage: replyText,
            source,
        });
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            ok: true,
            alertId,
            wasEdited,
            ...cleanup,
        }),
    };
};

exports._test = {
    isHumanApprovedPermanentNeedsYouSendSource,
    isAutomatedPermanentNeedsYouSendSource,
    isAppSupportFastFixException,
    isPermanentNeedsYouAlert,
    shouldBlockPermanentNeedsYouAutomatedSend,
    isCurrentClientAlert,
    shouldBlockCurrentClientAutomatedSend,
};

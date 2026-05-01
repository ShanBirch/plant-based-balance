/**
 * manychat-inbound — webhook receiver for Instagram DMs piped through ManyChat.
 *
 * ManyChat's "External Request" action POSTs here whenever a lead sends Shannon
 * a DM on Instagram. Configure the External Request body on the ManyChat side
 * with these fields (defaults shown — anything missing is treated as null):
 *
 *   {
 *     "subscriber_id":   "{{subscriber_id}}",
 *     "ig_username":     "{{ig_username}}"        (optional),
 *     "first_name":      "{{first_name}}"         (optional),
 *     "last_name":       "{{last_name}}"          (optional),
 *     "profile_pic_url": "{{profile_pic}}"        (optional),
 *     "message":         "{{last_input_text}}",
 *     "message_id":      "{{message_id}}"         (optional but recommended — dedup),
 *     "custom_data":     { ... ManyChat tags / custom fields ... }  (optional)
 *   }
 *
 * Optional shared-secret guard: set MANYCHAT_WEBHOOK_SECRET in Netlify env and
 * configure ManyChat to send `x-manychat-secret: <same>` as a header. If the
 * env var is unset, the check is skipped (so the webhook works while you're
 * still wiring it up — flip the secret on once everything's flowing).
 *
 * Flow:
 *   1. Optional shared-secret check
 *   2. Upsert ig_threads row keyed on subscriber_id
 *   3. Insert ig_messages (direction='in') — manychat_message_id dedups retries
 *   4. Fire ig-instant-draft asynchronously (best-effort kick) so Shannon's
 *      phone gets a "draft ready" push with the suggested reply
 *   5. Return 200 quickly so ManyChat doesn't retry the webhook
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const MANYCHAT_WEBHOOK_SECRET = process.env.MANYCHAT_WEBHOOK_SECRET;
const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const IG_LINK_ADMIN_EMAILS = new Set([
    'shannonbirch@cocospersonaltraining.com',
    'shannon@plantbased-balance.org',
    'shannon@plantbasedbalance.com',
    'shannon.birch@cocospersonaltraining.com',
]);

function isResolvedValue(v) {
    return !!v && !/\{\{[^}]+\}\}/.test(String(v));
}

function cleanIgUsername(v) {
    if (!isResolvedValue(v)) return null;
    const cleaned = String(v).replace(/^@+/, '').trim();
    return cleaned || null;
}

function sameHandle(a, b) {
    const left = cleanIgUsername(a);
    const right = cleanIgUsername(b);
    return !!left && !!right && left.toLowerCase() === right.toLowerCase();
}

async function supabase(path, options = {}) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY not configured');
    }
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
        const err = new Error(`Supabase ${options.method || 'GET'} ${path} -> ${res.status} ${text}`);
        err.status = res.status;
        try {
            const parsed = JSON.parse(text);
            if (parsed && parsed.code) err.sqlstate = parsed.code;
        } catch { /* not JSON, ignore */ }
        throw err;
    }
    const text = await res.text();
    if (!text || !text.trim()) return [];
    try { return JSON.parse(text); } catch { return []; }
}

// Pick the first admin as the default owner of an IG conversation. The app
// is single-coach today (Shannon) — when multi-coach lands, ManyChat can
// pass a coach hint in custom_data and we override here.
async function findDefaultCoachId() {
    try {
        const rows = await supabase('admin_users?select=user_id&order=created_at.asc&limit=1');
        return rows[0]?.user_id || null;
    } catch (e) {
        console.warn('[manychat-inbound] admin lookup failed:', e.message);
        return null;
    }
}

async function findLinkedUserByIgHandle(igUsername) {
    const handle = cleanIgUsername(igUsername);
    if (!handle) return null;
    try {
        const rows = await supabase(
            `users?select=id,email,subscription_status,ig_handle,created_at&ig_handle=ilike.${encodeURIComponent(handle)}&order=created_at.desc&limit=10`
        );
        return rows.find(u =>
            sameHandle(u.ig_handle, handle)
            && !IG_LINK_ADMIN_EMAILS.has(String(u.email || '').toLowerCase())
        ) || null;
    } catch (e) {
        console.warn('[manychat-inbound] ig_handle user lookup failed:', e.message);
        return null;
    }
}

function leadStageForLinkedUser(currentStage, linkedUser) {
    const raw = currentStage || 'new';
    if (!linkedUser) return raw;
    if (linkedUser.subscription_status === 'active') return 'paying';
    if (raw === 'new' || raw === 'qualifying' || raw === 'invited') return 'in_app';
    return raw;
}

async function upsertThread({ subscriberId, defaultCoachId, channel, igUsername, profileName, profilePicUrl, customData, nowIso }) {
    // Look up by (subscriber_id, channel). The same ManyChat Contact ID can
    // appear on both IG and Messenger -- they're separate conversations
    // with separate 24h windows, so we keep one ig_threads row per channel.
    const selectColumns = 'id,subscriber_id,coach_id,channel,ig_username,lead_stage,linked_user_id';
    let existing = await supabase(
        `ig_threads?select=${selectColumns}&subscriber_id=eq.${encodeURIComponent(subscriberId)}&channel=eq.${encodeURIComponent(channel)}&limit=1`
    );
    const handle = cleanIgUsername(igUsername);
    if (!existing[0] && handle) {
        // ManyChat subscriber IDs can change across channel reconnects/tests.
        // The IG handle is the stable human identity, so reuse that thread
        // rather than creating a second "cold" conversation.
        const handleMatches = await supabase(
            `ig_threads?select=${selectColumns}&channel=eq.${encodeURIComponent(channel)}&ig_username=ilike.${encodeURIComponent(handle)}&order=last_inbound_at.desc.nullslast&limit=10`
        );
        existing = handleMatches.filter(t => sameHandle(t.ig_username, handle));
    }
    const linkedUser = await findLinkedUserByIgHandle(handle);
    if (existing[0]) {
        const patch = { last_inbound_at: nowIso };
        if (existing[0].subscriber_id !== subscriberId) patch.subscriber_id = subscriberId;
        if (igUsername) patch.ig_username = igUsername;
        if (profileName) patch.profile_name = profileName;
        if (profilePicUrl) patch.profile_pic_url = profilePicUrl;
        if (customData && Object.keys(customData).length > 0) patch.custom_data = customData;
        if (!existing[0].coach_id && defaultCoachId) patch.coach_id = defaultCoachId;
        if (!existing[0].linked_user_id && linkedUser) {
            patch.linked_user_id = linkedUser.id;
            patch.lead_stage = leadStageForLinkedUser(existing[0].lead_stage, linkedUser);
        }
        await supabase(`ig_threads?id=eq.${existing[0].id}`, {
            method: 'PATCH',
            body: patch,
            prefer: 'return=minimal',
        });
        return {
            ...existing[0],
            ...patch,
            coach_id: existing[0].coach_id || defaultCoachId,
        };
    }
    const initialStage = leadStageForLinkedUser('new', linkedUser);
    const inserted = await supabase('ig_threads', {
        method: 'POST',
        body: [{
            subscriber_id: subscriberId,
            coach_id: defaultCoachId || null,
            channel: channel || 'instagram',
            ig_username: igUsername || null,
            profile_name: profileName || null,
            profile_pic_url: profilePicUrl || null,
            custom_data: (customData && Object.keys(customData).length > 0) ? customData : {},
            last_inbound_at: nowIso,
            lead_stage: initialStage,
            linked_user_id: linkedUser?.id || null,
        }],
        prefer: 'return=representation',
    });
    return inserted[0];
}

async function insertInboundMessage({ threadId, text, manychatMessageId }) {
    try {
        await supabase('ig_messages', {
            method: 'POST',
            body: [{
                thread_id: threadId,
                direction: 'in',
                text,
                manychat_message_id: manychatMessageId || null,
                source: 'manychat',
            }],
            prefer: 'return=minimal',
        });
        return { inserted: true, deduped: false };
    } catch (err) {
        const isDuplicate = err.sqlstate === '23505'
            || /23505|duplicate key/.test(err.message || '');
        if (isDuplicate) return { inserted: false, deduped: true };
        throw err;
    }
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    if (MANYCHAT_WEBHOOK_SECRET) {
        const headers = event.headers || {};
        const provided = String(
            headers['x-manychat-secret']
            || headers['X-ManyChat-Secret']
            || headers['x-manychat-secret'.toLowerCase()]
            || ''
        ).trim();
        if (provided !== MANYCHAT_WEBHOOK_SECRET) {
            console.warn('[manychat-inbound] unauthorized: secret mismatch');
            return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
        }
    }

    let payload;
    try { payload = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    const subscriberId = String(payload.subscriber_id || '').trim();
    const messageTextRaw = String(payload.message || payload.last_input_text || '').trim();
    const manychatMessageId = payload.message_id ? String(payload.message_id).trim() : null;

    if (!subscriberId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing subscriber_id' }) };
    }

    // Attachment detection. ManyChat doesn't expose a clean "Last Image URL"
    // system field — when a lead sends a photo on IG, ManyChat dumps the
    // image's CDN URL (typically https://lookaside.fbsbx.com/ig_messaging_cdn/...)
    // straight into the `Last Text Input` field as if it were text. We
    // detect that URL pattern here and convert it to the [PHOTO:url] marker
    // the in-app chat-photo pipeline already understands, so Gemini Vision
    // inlines the image into the draft prompt.
    //
    // Two routes are accepted:
    //   1. Explicit `attachment_url` field if the ManyChat account exposes
    //      one (some Pro plans add custom fields for this) — and an
    //      optional `attachment_type` hint
    //   2. URL detection on the message text (the common case)
    function detectAttachmentFromText(text) {
        const trimmed = String(text || '').trim();
        const urlMatch = trimmed.match(/^(https?:\/\/\S+)$/);
        if (!urlMatch) return null;
        const url = urlMatch[1];
        const isImage = /lookaside\.fbsbx\.com.*ig_messaging_cdn/i.test(url)
            || /\.(jpg|jpeg|png|webp|gif|heic|heif)(\?|$)/i.test(url)
            || /scontent[\w.-]*\.fbcdn\.net/i.test(url)
            || /cdn\.fbsbx\.com/i.test(url);
        if (isImage) return { url, type: 'image' };
        if (/\.(mp4|mov|webm|m4v)(\?|$)/i.test(url)) return { url, type: 'video' };
        return null;
    }

    const isAttachmentFieldResolved = (v) => v && !/\{\{[^}]+\}\}/.test(String(v));
    let attachment = null;
    if (isAttachmentFieldResolved(payload.attachment_url)) {
        const url = String(payload.attachment_url).trim();
        let type = isAttachmentFieldResolved(payload.attachment_type)
            ? String(payload.attachment_type).toLowerCase().trim()
            : null;
        if (!type) {
            const sniff = detectAttachmentFromText(url);
            type = sniff ? sniff.type : null;
        }
        if (type) attachment = { url, type };
    }
    if (!attachment) {
        attachment = detectAttachmentFromText(messageTextRaw);
    }

    let messageText = messageTextRaw;
    if (attachment) {
        // If the message text IS the URL, replace it entirely with the
        // marker. If there's separate caption text alongside, keep the text
        // and append the marker.
        const isOnlyTheUrl = messageTextRaw === attachment.url;
        const prefix = isOnlyTheUrl ? '' : (messageTextRaw ? messageTextRaw + ' ' : '');
        if (attachment.type === 'image') {
            messageText = prefix + `[PHOTO:${attachment.url}]`;
        } else if (attachment.type === 'video') {
            // Video URLs don't get inlined yet (Gemini Files API needed for
            // proper video analysis). Stored as a marker so the AI knows a
            // video came in even if it can't see the frames.
            messageText = prefix + `[video: ${attachment.url}]`;
        }
    }

    if (!messageText) {
        // No text and no attachment we recognise. Probably a sticker / reaction
        // only. Acknowledge so ManyChat doesn't retry.
        return { statusCode: 200, body: JSON.stringify({ skipped: 'empty_message' }) };
    }

    // Filter unresolved ManyChat templates. When a contact doesn't have a
    // first_name / last_name set, ManyChat sends the literal `{{first_name}}`
    // string instead of substituting -- happens often for IG-only contacts
    // who only have a username. Treat those as missing so we don't store
    // junk and the push falls back to ig_username.
    const igUsername = cleanIgUsername(payload.ig_username);
    const firstName = isResolvedValue(payload.first_name) ? String(payload.first_name).trim() : '';
    const lastName = isResolvedValue(payload.last_name) ? String(payload.last_name).trim() : '';
    const profileNameFromPayload = isResolvedValue(payload.profile_name) ? String(payload.profile_name).trim() : '';
    const profileName = profileNameFromPayload
        || (firstName + (lastName ? ' ' + lastName : '')).trim()
        || null;
    const profilePicUrl = isResolvedValue(payload.profile_pic_url) ? String(payload.profile_pic_url).trim() : null;
    const customData = (payload.custom_data && typeof payload.custom_data === 'object' && !Array.isArray(payload.custom_data))
        ? payload.custom_data
        : {};

    // Channel routing — defaults to 'instagram' so the existing IG flow
    // doesn't need to add the field. ManyChat's FB Messenger automation
    // should pass `"channel": "messenger"` in the External Request body.
    let channel = String(payload.channel || 'instagram').trim().toLowerCase();
    if (channel !== 'instagram' && channel !== 'messenger') {
        console.warn(`[manychat-inbound] unknown channel '${channel}', defaulting to instagram`);
        channel = 'instagram';
    }

    const defaultCoachId = await findDefaultCoachId();
    const nowIso = new Date().toISOString();

    let thread;
    try {
        thread = await upsertThread({
            subscriberId,
            defaultCoachId,
            channel,
            igUsername,
            profileName,
            profilePicUrl,
            customData,
            nowIso,
        });
    } catch (err) {
        console.error('[manychat-inbound] thread upsert failed:', err.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Thread upsert failed' }) };
    }

    let messageResult;
    try {
        messageResult = await insertInboundMessage({
            threadId: thread.id,
            text: messageText,
            manychatMessageId,
        });
    } catch (err) {
        console.error('[manychat-inbound] message insert failed:', err.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Message insert failed' }) };
    }

    if (messageResult.deduped) {
        // ManyChat retried delivery — the alert was already drafted on the
        // original hit. Skip the dispatch so we don't race the alert
        // idempotency check.
        return { statusCode: 200, body: JSON.stringify({ skipped: 'duplicate_message' }) };
    }

    // Best-effort kick of the draft producer. Netlify functions don't stay
    // alive past the response, so we await *just long enough* for the
    // request to leave the container — not the full draft completion.
    try {
        const draftUrl = `${SITE_URL}/.netlify/functions/ig-instant-draft`;
        const dispatch = fetch(draftUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                threadId: thread.id,
                subscriberId,
                channel,
                messageText,
                manychatMessageId,
                igUsername,
                profileName,
                customData,
            }),
        }).catch(e => {
            console.warn('[manychat-inbound] draft dispatch error:', e.message);
            return null;
        });
        await Promise.race([
            dispatch,
            new Promise(r => setTimeout(r, 150)),
        ]);
    } catch (e) {
        console.warn('[manychat-inbound] draft dispatch wrapper failed:', e.message);
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            ok: true,
            thread_id: thread.id,
            lead_stage: thread.lead_stage || 'new',
        }),
    };
};

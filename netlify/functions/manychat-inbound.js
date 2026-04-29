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

async function upsertThread({ subscriberId, defaultCoachId, channel, igUsername, profileName, profilePicUrl, customData, nowIso }) {
    // Look up by (subscriber_id, channel). The same ManyChat Contact ID can
    // appear on both IG and Messenger -- they're separate conversations
    // with separate 24h windows, so we keep one ig_threads row per channel.
    const existing = await supabase(
        `ig_threads?select=id,coach_id,channel,lead_stage,linked_user_id&subscriber_id=eq.${encodeURIComponent(subscriberId)}&channel=eq.${encodeURIComponent(channel)}&limit=1`
    );
    if (existing[0]) {
        const patch = { last_inbound_at: nowIso };
        if (igUsername) patch.ig_username = igUsername;
        if (profileName) patch.profile_name = profileName;
        if (profilePicUrl) patch.profile_pic_url = profilePicUrl;
        if (customData && Object.keys(customData).length > 0) patch.custom_data = customData;
        if (!existing[0].coach_id && defaultCoachId) patch.coach_id = defaultCoachId;
        await supabase(`ig_threads?id=eq.${existing[0].id}`, {
            method: 'PATCH',
            body: patch,
            prefer: 'return=minimal',
        });
        return { ...existing[0], coach_id: existing[0].coach_id || defaultCoachId };
    }
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
            lead_stage: 'new',
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

    // Attachment fields (optional) — when the lead sent a photo or video,
    // ManyChat populates `Last Image URL` (system field) and we accept that
    // here as `attachment_url`. We also accept an explicit `attachment_type`
    // ("image" / "video" / etc) but fall back to URL-extension sniffing.
    const isAttachmentResolved = (v) => v && !/\{\{[^}]+\}\}/.test(String(v));
    const attachmentUrlRaw = isAttachmentResolved(payload.attachment_url)
        ? String(payload.attachment_url).trim()
        : '';
    const attachmentTypeRaw = isAttachmentResolved(payload.attachment_type)
        ? String(payload.attachment_type).toLowerCase().trim()
        : '';
    const isImageAttachment = attachmentUrlRaw && (
        attachmentTypeRaw === 'image'
        || /\.(jpg|jpeg|png|webp|gif|heic|heif)(\?|$)/i.test(attachmentUrlRaw)
    );
    const isVideoAttachment = attachmentUrlRaw && (
        attachmentTypeRaw === 'video'
        || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(attachmentUrlRaw)
    );

    // Build the stored message text. Photos use the [PHOTO:url] marker
    // format so the existing buildMessageImageParts helper can inline them
    // into the Gemini prompt (same path as in-app chat photos). Videos are
    // referenced as plain text for now -- the AI will know one was sent
    // but won't analyse the frames yet.
    let messageText = messageTextRaw;
    if (isImageAttachment) {
        messageText = (messageText ? messageText + ' ' : '') + `[PHOTO:${attachmentUrlRaw}]`;
    } else if (isVideoAttachment) {
        messageText = (messageText ? messageText + ' ' : '') + `[video: ${attachmentUrlRaw}]`;
    } else if (attachmentUrlRaw) {
        messageText = (messageText ? messageText + ' ' : '') + `[attachment: ${attachmentUrlRaw}]`;
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
    const isResolved = (v) => v && !/\{\{[^}]+\}\}/.test(String(v));

    const igUsername = isResolved(payload.ig_username) ? String(payload.ig_username).trim() : null;
    const firstName = isResolved(payload.first_name) ? String(payload.first_name).trim() : '';
    const lastName = isResolved(payload.last_name) ? String(payload.last_name).trim() : '';
    const profileNameFromPayload = isResolved(payload.profile_name) ? String(payload.profile_name).trim() : '';
    const profileName = profileNameFromPayload
        || (firstName + (lastName ? ' ' + lastName : '')).trim()
        || null;
    const profilePicUrl = isResolved(payload.profile_pic_url) ? String(payload.profile_pic_url).trim() : null;
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

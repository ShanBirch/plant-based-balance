/**
 * add-ig-screenshot-context
 *
 * Lets Shannon patch missing ManyChat context by uploading an Instagram DM
 * screenshot from the admin DMs card. The function extracts the visible DM
 * bubbles, writes them into ig_messages, then asks the IG draft producer to
 * refresh the existing pending alert against the repaired history.
 */

const crypto = require('crypto');
const {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    supabaseQuery,
    callVertexGeminiMultimodal,
    callGeminiFallback,
    normalizeCoachDraftText,
    truncate,
} = require('./_lib/client-context');

const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const MANYCHAT_DM_ALERT_TYPES = ['ig_incoming_dm', 'fb_incoming_dm'];
const MAX_IMAGE_BYTES = 4.5 * 1024 * 1024;
const MAX_MESSAGES = 24;

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

async function verifyAdminToken(event) {
    const auth = event?.headers?.authorization || event?.headers?.Authorization || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!token) return { ok: false, error: 'missing_admin_token' };
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return { ok: false, error: 'supabase_not_configured' };

    try {
        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: {
                apikey: SUPABASE_SERVICE_KEY,
                Authorization: `Bearer ${token}`,
            },
        });
        if (!userRes.ok) return { ok: false, error: 'invalid_admin_token' };
        const user = await userRes.json();
        if (!user?.id) return { ok: false, error: 'invalid_admin_user' };

        const rows = await supabaseQuery(`admin_users?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`);
        if (!rows.length) return { ok: false, error: 'not_admin' };
        return { ok: true, userId: user.id };
    } catch (err) {
        return { ok: false, error: err.message || 'admin_check_failed' };
    }
}

function stripMarkdownFence(text) {
    const out = String(text || '').trim();
    const fenced = out.match(/^```(?:json|javascript|js|txt|text)?\s*([\s\S]*?)\s*```$/i);
    if (fenced) return fenced[1].trim();
    return out
        .replace(/^```(?:json|javascript|js|txt|text)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
}

function parseModelJson(raw) {
    const stripped = stripMarkdownFence(raw);
    try {
        return JSON.parse(stripped);
    } catch {
        const start = stripped.indexOf('{');
        const end = stripped.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return JSON.parse(stripped.slice(start, end + 1));
        }
        throw new Error('Screenshot reader returned non-JSON text');
    }
}

function hash(value) {
    return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 18);
}

function normalizeComparableText(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .trim()
        .toLowerCase();
}

function cleanMessageText(value) {
    return normalizeCoachDraftText(value || '')
        .replace(/\s+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function normalizeDirection(value, sender) {
    const raw = `${value || ''} ${sender || ''}`.toLowerCase();
    if (/\b(out|outbound|outgoing|sent|shannon|coach|me|business|balance|owner|right)\b/.test(raw)) return 'out';
    if (/\b(in|inbound|incoming|received|lead|client|customer|prospect|them|left)\b/.test(raw)) return 'in';
    return 'in';
}

function normalizeExtractedMessages(parsed) {
    const input = Array.isArray(parsed?.messages) ? parsed.messages : [];
    const out = [];
    for (const item of input) {
        if (!item || typeof item !== 'object') continue;
        const text = cleanMessageText(item.text || item.message || item.body || '');
        if (!text || text.length < 1) continue;
        if (/^(instagram|meta|message|search|send message|active now)$/i.test(text)) continue;
        out.push({
            direction: normalizeDirection(item.direction, item.sender),
            text: truncate(text, 1600),
            sender: String(item.sender || '').slice(0, 80),
            time_label: String(item.time_label || item.time || '').slice(0, 80),
        });
        if (out.length >= MAX_MESSAGES) break;
    }
    return out;
}

function isManyChatDmAlert(alert) {
    const data = alert?.data || {};
    return MANYCHAT_DM_ALERT_TYPES.includes(alert?.alert_type)
        || data.channel === 'instagram'
        || data.channel === 'messenger';
}

async function extractScreenshotMessages({ imageBase64, mimeType, leadName, channelLabel }) {
    const prompt = `Read this Instagram or Messenger DM screenshot for Shannon's Balance admin backfill tool.

Return ONLY strict JSON with this shape:
{
  "messages": [
    { "direction": "in", "sender": "lead", "text": "exact visible message bubble text", "time_label": "optional visible time" }
  ],
  "summary": "one short note about what context was visible",
  "confidence": 0.0
}

Rules:
- Extract visible chat bubbles in chronological order, older to newer.
- Preserve the wording of each bubble. Do not rewrite, coach, summarize, or infer missing words.
- Use direction "out" for Shannon, Balance, the business account, right-side outgoing bubbles, or messages from "me".
- Use direction "in" for ${leadName || 'the lead'}, customer, client, prospect, or left-side incoming bubbles.
- Ignore Instagram navigation, usernames, dates, reactions, read receipts, input boxes, ads, and button labels unless they are part of a message bubble.
- If a bubble is only media with no readable text, use "[photo in Instagram screenshot]" or "[video in Instagram screenshot]" as the text.`;

    const contents = [{
        role: 'user',
        parts: [
            { text: prompt },
            { inlineData: { mimeType, data: imageBase64 } },
        ],
    }];
    const generationConfig = {
        maxOutputTokens: 4096,
        temperature: 0.1,
        responseMimeType: 'application/json',
    };

    let raw = '';
    let model = 'vertex-gemini-screenshot-context';
    try {
        raw = await callVertexGeminiMultimodal(contents, generationConfig);
    } catch (err) {
        console.warn('[add-ig-context] Vertex Gemini failed, trying public Gemini:', err.message);
        raw = await callGeminiFallback(contents, generationConfig);
        model = 'gemini-screenshot-context';
    }
    const parsed = parseModelJson(raw);
    const messages = normalizeExtractedMessages(parsed);
    return {
        model,
        messages,
        summary: String(parsed?.summary || `${messages.length} ${channelLabel || 'DM'} messages visible`).slice(0, 500),
        confidence: Number.isFinite(Number(parsed?.confidence)) ? Number(parsed.confidence) : null,
    };
}

function createdAtForIndex(anchorIso, index, total) {
    const anchor = new Date(anchorIso || Date.now());
    const anchorMs = Number.isFinite(anchor.getTime()) ? anchor.getTime() : Date.now();
    const startMs = anchorMs - Math.max(60, total * 45) * 1000;
    return new Date(startMs + index * 45 * 1000).toISOString();
}

function existingMessageSet(rows) {
    const set = new Set();
    for (const row of rows || []) {
        set.add(`${row.direction || ''}:${normalizeComparableText(row.text || '')}`);
    }
    return set;
}

async function insertExtractedMessages({ alert, threadId, messages }) {
    const existingRows = await supabaseQuery(
        `ig_messages?select=id,direction,text,created_at,source&thread_id=eq.${encodeURIComponent(threadId)}&order=created_at.desc&limit=120`
    );
    const seen = existingMessageSet(existingRows);
    const rows = [];
    const skipped = [];
    const anchorIso = alert.created_at || new Date().toISOString();

    messages.forEach((message, index) => {
        const key = `${message.direction}:${normalizeComparableText(message.text)}`;
        if (!message.text || seen.has(key)) {
            skipped.push(message);
            return;
        }
        seen.add(key);
        rows.push({
            thread_id: threadId,
            direction: message.direction,
            text: message.text,
            source: 'manual_screenshot_backfill',
            created_at: createdAtForIndex(anchorIso, index, messages.length),
            manychat_message_id: message.direction === 'in'
                ? `manual_screenshot:${alert.id}:${hash(`${message.direction}:${message.text}`)}`
                : null,
        });
    });

    if (!rows.length) return { inserted: [], skipped };
    const inserted = await supabaseQuery('ig_messages', {
        method: 'POST',
        body: rows,
    });
    return { inserted, skipped };
}

async function patchAlertContextAudit({ alert, adminUserId, extraction, insertedCount, skippedCount, fileName }) {
    const data = alert.data || {};
    const now = new Date().toISOString();
    const audit = {
        source: 'admin_screenshot_context',
        added_at: now,
        added_by: adminUserId,
        model: extraction.model,
        confidence: extraction.confidence,
        extracted_count: extraction.messages.length,
        inserted_count: insertedCount,
        skipped_duplicate_count: skippedCount,
        summary: extraction.summary,
        file_name: String(fileName || '').slice(0, 160),
    };
    const history = Array.isArray(data.manual_context_backfills)
        ? data.manual_context_backfills
        : [];
    const mergedData = {
        ...data,
        manual_context_backfills: [...history, audit].slice(-8),
        manual_context_last_added_at: now,
        context_review: data.context_review
            ? { ...data.context_review, manual_context_added_at: now, manual_context_source: 'admin_screenshot' }
            : data.context_review,
    };
    await supabaseQuery(`coach_alerts?id=eq.${encodeURIComponent(alert.id)}`, {
        method: 'PATCH',
        body: { data: mergedData },
        prefer: 'return=minimal',
    });
    return mergedData;
}

async function refreshDraft({ threadId, alert, extraction }) {
    const data = alert.data || {};
    const latestInbound = [...extraction.messages].reverse().find(message => message.direction === 'in' && message.text);
    const seedText = latestInbound?.text
        || data.message_preview
        || data.draft_evidence?.current_message
        || alert.description
        || '';
    const cleanedSeed = cleanMessageText(String(seedText).replace(/^["']|["']$/g, ''));
    if (!cleanedSeed) return { ok: false, reason: 'missing_seed_text' };

    const response = await fetch(`${SITE_URL}/.netlify/functions/ig-instant-draft-background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            threadId,
            messageText: cleanedSeed,
            manychatMessageId: `manual_screenshot_context:${alert.id}:${hash(`${cleanedSeed}:${extraction.summary}`)}`,
        }),
    });
    const text = await response.text();
    if (!response.ok) {
        return { ok: false, reason: `draft_refresh_failed_${response.status}`, details: text.slice(0, 300) };
    }
    return { ok: true, body: text.slice(0, 500) };
}

async function loadAlert(alertId) {
    const rows = await supabaseQuery(
        `coach_alerts?select=id,client_id,client_name,coach_id,alert_type,status,created_at,description,suggested_message,scheduled_reply_text,data&id=eq.${encodeURIComponent(alertId)}&limit=1`
    );
    return rows[0] || null;
}

exports.handler = async (event = {}) => {
    if (event.httpMethod === 'OPTIONS') return json(204, {});
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const admin = await verifyAdminToken(event);
    if (!admin.ok) return json(403, { error: admin.error });

    let body = {};
    try {
        body = event.body ? JSON.parse(event.body) : {};
    } catch {
        return json(400, { error: 'Invalid JSON' });
    }

    const alertId = String(body.alertId || '').trim();
    const imageBase64 = String(body.imageBase64 || '').replace(/^data:[^;]+;base64,/, '').trim();
    const mimeType = String(body.mimeType || 'image/jpeg').split(';')[0].trim().toLowerCase();
    const fileName = String(body.fileName || '').trim();

    if (!alertId) return json(400, { error: 'Missing alertId' });
    if (!imageBase64) return json(400, { error: 'Missing image' });
    if (!/^image\/(png|jpe?g|webp|heic|heif)$/i.test(mimeType)) return json(400, { error: 'Unsupported image type' });

    let imageBytes = 0;
    try {
        imageBytes = Buffer.byteLength(imageBase64, 'base64');
    } catch {
        return json(400, { error: 'Invalid image encoding' });
    }
    if (imageBytes > MAX_IMAGE_BYTES) {
        return json(413, { error: 'Image too large after compression. Try cropping the screenshot.' });
    }

    const alert = await loadAlert(alertId);
    if (!alert) return json(404, { error: 'Alert not found' });
    if (!['pending', 'dismissed', 'canceled'].includes(alert.status)) {
        return json(409, { error: `Alert is already ${alert.status}` });
    }
    if (!isManyChatDmAlert(alert)) return json(400, { error: 'Alert is not an IG/FB DM alert' });

    const data = alert.data || {};
    const threadId = data.ig_thread_id || null;
    if (!threadId) return json(400, { error: 'Alert missing ig_thread_id, cannot write IG conversation history' });

    const channelLabel = data.channel === 'messenger' || alert.alert_type === 'fb_incoming_dm'
        ? 'Messenger'
        : 'Instagram';
    let extraction;
    try {
        extraction = await extractScreenshotMessages({
            imageBase64,
            mimeType,
            leadName: alert.client_name || data.ig_username || 'the lead',
            channelLabel,
        });
    } catch (err) {
        console.error('[add-ig-context] screenshot extraction failed:', err);
        return json(502, { error: 'Could not read that screenshot', details: err.message || String(err) });
    }

    if (!extraction.messages.length) {
        return json(422, { error: 'No readable DM bubbles found in the screenshot' });
    }

    let insertResult;
    try {
        insertResult = await insertExtractedMessages({
            alert,
            threadId,
            messages: extraction.messages,
        });
    } catch (err) {
        console.error('[add-ig-context] ig_messages insert failed:', err);
        return json(502, { error: 'Could not add screenshot context to IG history', details: err.message || String(err) });
    }

    try {
        await patchAlertContextAudit({
            alert,
            adminUserId: admin.userId,
            extraction,
            insertedCount: insertResult.inserted.length,
            skippedCount: insertResult.skipped.length,
            fileName,
        });
    } catch (err) {
        console.warn('[add-ig-context] alert audit patch failed:', err.message || err);
    }

    let draftRefresh = { ok: false, reason: 'not_attempted' };
    try {
        draftRefresh = await refreshDraft({ threadId, alert, extraction });
    } catch (err) {
        draftRefresh = { ok: false, reason: 'draft_refresh_exception', details: err.message || String(err) };
        console.warn('[add-ig-context] draft refresh failed:', err.message || err);
    }

    let refreshedAlert = null;
    try {
        refreshedAlert = await loadAlert(alertId);
    } catch (err) {
        console.warn('[add-ig-context] refreshed alert lookup failed:', err.message || err);
    }

    return json(200, {
        ok: true,
        alertId,
        thread_id: threadId,
        model: extraction.model,
        confidence: extraction.confidence,
        summary: extraction.summary,
        extracted_count: extraction.messages.length,
        inserted_count: insertResult.inserted.length,
        skipped_duplicate_count: insertResult.skipped.length,
        draft_refreshed: !!draftRefresh.ok,
        draft_refresh: draftRefresh,
        alert: refreshedAlert ? {
            id: refreshedAlert.id,
            status: refreshedAlert.status,
            suggested_message: refreshedAlert.suggested_message,
            description: refreshedAlert.description,
            data: refreshedAlert.data,
        } : null,
    });
};

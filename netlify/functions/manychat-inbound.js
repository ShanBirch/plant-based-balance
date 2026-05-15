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
 *   4. Hand ig-instant-draft to a background function so Shannon's phone gets
 *      a "draft ready" push with the suggested reply
 *   5. Return 200 quickly so ManyChat doesn't retry the webhook
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const MANYCHAT_WEBHOOK_SECRET = process.env.MANYCHAT_WEBHOOK_SECRET;
const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const DRAFT_DISPATCH_TIMEOUT_MS = 1200;
const GRAPH_SUBSCRIBER_PREFIX = 'ig_graph:';
const RECENT_GRAPH_DUPLICATE_MATCH_MS = 12 * 60 * 1000;
const RECENT_SAME_THREAD_DUPLICATE_MS = 3 * 60 * 1000;
const GRAPH_DUPLICATE_RETRY_DELAY_MS = 1800;
const IG_LINK_ADMIN_EMAILS = new Set([
    'shannonbirch@cocospersonaltraining.com',
    'shannon@plantbased-balance.org',
    'shannon@plantbasedbalance.com',
    'shannon.birch@cocospersonaltraining.com',
]);
const SAFE_AUDIT_HEADERS = [
    'content-type',
    'user-agent',
    'x-forwarded-for',
    'x-nf-client-connection-ip',
];

function isResolvedValue(v) {
    return !!v && !/\{\{[^}]+\}\}/.test(String(v));
}

function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeComparableText(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
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

function escapeControlCharsInsideJsonStrings(raw) {
    let out = '';
    let inString = false;
    let escaped = false;

    for (const ch of String(raw || '')) {
        if (escaped) {
            out += ch;
            escaped = false;
            continue;
        }
        if (inString && ch === '\\') {
            out += ch;
            escaped = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            out += ch;
            continue;
        }
        if (inString) {
            if (ch === '\n') {
                out += '\\n';
                continue;
            }
            if (ch === '\r') {
                out += '\\r';
                continue;
            }
            if (ch === '\t') {
                out += '\\t';
                continue;
            }
            const code = ch.charCodeAt(0);
            if (code >= 0 && code < 32) {
                out += `\\u${code.toString(16).padStart(4, '0')}`;
                continue;
            }
        }
        out += ch;
    }

    return out;
}

function parseMaybeJsonValue(value) {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed || !/^[{[]/.test(trimmed)) return value;
    try {
        return JSON.parse(trimmed);
    } catch {
        return value;
    }
}

function parseFormEncodedPayload(raw) {
    if (!raw || !String(raw).includes('=')) return null;
    const params = new URLSearchParams(String(raw));
    const entries = Array.from(params.entries());
    if (!entries.length) return null;
    const payload = {};
    entries.forEach(([key, value]) => {
        payload[key] = parseMaybeJsonValue(value);
    });
    return payload;
}

function parseManyChatPayload(rawBody) {
    const raw = rawBody || '{}';
    try {
        return JSON.parse(raw);
    } catch (firstError) {
        const escaped = escapeControlCharsInsideJsonStrings(raw);
        if (escaped !== raw) {
            try {
                const payload = JSON.parse(escaped);
                console.warn('[manychat-inbound] recovered payload with raw control characters inside JSON strings');
                return payload;
            } catch {
                // Fall through to the form parser and then the original error.
            }
        }

        const formPayload = parseFormEncodedPayload(raw);
        if (formPayload) {
            console.warn('[manychat-inbound] parsed non-JSON form payload');
            return formPayload;
        }

        throw firstError;
    }
}

function safeAuditHeaders(headers = {}) {
    const out = {};
    SAFE_AUDIT_HEADERS.forEach(name => {
        const value = headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];
        if (value) out[name] = String(value).slice(0, 500);
    });
    return out;
}

function hashText(text) {
    const crypto = require('crypto');
    const s = String(text || '');
    return s ? crypto.createHash('sha256').update(s).digest('hex') : null;
}

function auditSafePayload(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    try {
        return JSON.parse(JSON.stringify(payload));
    } catch {
        return null;
    }
}

async function createWebhookAudit(event) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
    try {
        const rows = await supabase('manychat_webhook_events', {
            method: 'POST',
            body: [{
                http_method: event.httpMethod || null,
                raw_body: event.body || '',
                safe_headers: safeAuditHeaders(event.headers || {}),
                status: 'received',
            }],
            prefer: 'return=representation',
        });
        return rows[0]?.id || null;
    } catch (err) {
        console.warn('[manychat-inbound] webhook audit create failed:', err.message);
        return null;
    }
}

async function patchWebhookAudit(auditId, patch) {
    if (!auditId || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
    try {
        await supabase(`manychat_webhook_events?id=eq.${auditId}`, {
            method: 'PATCH',
            body: patch,
            prefer: 'return=minimal',
        });
    } catch (err) {
        console.warn('[manychat-inbound] webhook audit patch failed:', err.message);
    }
}

function cleanInboundTextValue(v) {
    if (Array.isArray(v)) {
        return v.map(cleanInboundTextValue).filter(Boolean).join('\n\n');
    }
    if (v && typeof v === 'object') {
        return [
            v.message,
            v.text,
            v.body,
            v.message_text,
            v.input_text,
            v.caption,
            v.value,
        ].map(cleanInboundTextValue).filter(Boolean).join('\n\n');
    }
    if (!isResolvedValue(v)) return '';
    const s = String(v).trim();
    if (!s || s === 'null' || s === 'undefined') return '';
    return s;
}

function collectInboundTextCandidates(payload, customData = {}) {
    const raw = [
        payload.message,
        payload.last_input_text,
        payload.last_text_input,
        payload.last_input,
        payload.text,
        payload.message_text,
        payload.message_body,
        payload.body,
        payload.input_text,
        payload.user_input,
        payload.quick_reply,
        payload.caption,
        customData.message,
        customData.last_input_text,
        customData.last_text_input,
        customData.last_input,
        customData.text,
        customData.message_text,
        customData.message_body,
        customData.body,
        customData.input_text,
        customData.user_input,
        customData.quick_reply,
        customData.caption,
    ];
    const seen = new Set();
    const out = [];
    raw.forEach(v => {
        const s = cleanInboundTextValue(v);
        if (!s) return;
        const key = s.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push(s);
    });
    return out;
}

function withoutAttachmentUrl(text, attachmentUrl) {
    const s = String(text || '').trim();
    if (!s || !attachmentUrl) return s;
    return s.replace(attachmentUrl, '').replace(/\s+/g, ' ').trim();
}

function cleanAttachmentUrl(rawUrl) {
    const url = String(rawUrl || '').trim().replace(/[)\].,!?]+$/g, '');
    return /^https?:\/\//i.test(url) ? url : '';
}

function looksLikeAudioAttachmentName(value) {
    return /(audio|audioclip|voice[-_ ]?note|voicenote|voice_note|voice|sound|recording|spoken)/i
        .test(String(value || ''));
}

function isMetaMessagingCdnUrl(url) {
    return /lookaside\.fbsbx\.com.*ig_messaging_cdn/i.test(url)
        || /scontent[\w.-]*\.fbcdn\.net/i.test(url)
        || /cdn\.fbsbx\.com/i.test(url);
}

function inferAttachmentTypeFromHint(hint) {
    const h = String(hint || '').toLowerCase();
    if (/(audio|voice|voicenote|voice_note|sound|recording|spoken)/i.test(h)) return 'audio';
    if (/(image|photo|picture|pic)/i.test(h)) return 'image';
    if (/(video|clip|reel)/i.test(h)) return 'video';
    return null;
}

function inferAttachmentTypeFromUrl(url) {
    const lower = String(url || '').toLowerCase();
    if (looksLikeAudioAttachmentName(lower)) {
        return { type: 'audio', source: 'url-keyword' };
    }
    if (/\.(jpg|jpeg|png|webp|gif|heic|heif)(\?|#|$)/i.test(lower)) {
        return { type: 'image', source: 'extension' };
    }
    if (/\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|amr|3ga)(\?|#|$)/i.test(lower)) {
        return { type: 'audio', source: 'extension' };
    }
    if (/\.(mp4|mov|webm|m4v|3gp|3gpp)(\?|#|$)/i.test(lower)) {
        return { type: 'video', source: 'extension' };
    }
    if (isMetaMessagingCdnUrl(url)) {
        return { type: 'image', source: 'meta-cdn' };
    }
    return { type: null, source: null };
}

function detectAttachmentFromUrl(rawUrl, hint = '') {
    const url = cleanAttachmentUrl(rawUrl);
    if (!url) return null;
    const hintType = inferAttachmentTypeFromHint(hint);
    const inferred = inferAttachmentTypeFromUrl(url);
    const type = hintType || inferred.type;
    if (!type) return null;
    return {
        url,
        type,
        typeSource: hintType ? 'hint' : inferred.source,
    };
}

function detectAttachmentFromText(text, hint = '') {
    const matches = String(text || '').match(/https?:\/\/\S+/gi) || [];
    for (const rawUrl of matches) {
        const attachment = detectAttachmentFromUrl(rawUrl, hint);
        if (attachment) return attachment;
    }
    return null;
}

function collectExplicitAttachmentCandidates(payload, customData = {}) {
    const candidates = [];
    const add = (value, hint) => {
        if (!isResolvedValue(value)) return;
        const attachment = detectAttachmentFromUrl(value, hint);
        if (attachment) candidates.push(attachment);
    };
    const pairs = [
        ['attachment_url', 'attachment'],
        ['media_url', 'media'],
        ['image_url', 'image'],
        ['photo_url', 'photo'],
        ['audio_url', 'audio'],
        ['voice_url', 'voice'],
        ['voice_note_url', 'voice_note'],
        ['video_url', 'video'],
        ['file_url', 'file'],
        ['last_input_attachment_url', 'attachment'],
        ['last_input_media_url', 'media'],
        ['last_input_image_url', 'image'],
        ['last_input_photo_url', 'photo'],
        ['last_input_audio_url', 'audio'],
        ['last_input_voice_url', 'voice'],
        ['last_input_video_url', 'video'],
    ];
    for (const [key, fallbackHint] of pairs) {
        add(payload[key], payload.attachment_type || payload.media_type || payload.file_type || fallbackHint);
        add(customData[key], customData.attachment_type || customData.media_type || customData.file_type || fallbackHint);
    }
    return candidates;
}

function inferAttachmentTypeFromHeaders({ url, contentType, contentDisposition }) {
    const disposition = String(contentDisposition || '');
    const filename = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i)?.[1] || '';
    const headerName = `${disposition} ${filename}`.trim();
    if (looksLikeAudioAttachmentName(headerName) || looksLikeAudioAttachmentName(url)) {
        return 'audio';
    }

    const lowerName = headerName.toLowerCase();
    if (/\.(jpg|jpeg|png|webp|gif|heic|heif)(\?|#|$|")/i.test(lowerName)) return 'image';
    if (/\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|amr|3ga)(\?|#|$|")/i.test(lowerName)) return 'audio';
    if (/\.(mp4|mov|webm|m4v|3gp|3gpp)(\?|#|$|")/i.test(lowerName)) return 'video';

    const ct = String(contentType || '').split(';')[0].trim().toLowerCase();
    if (ct.startsWith('audio/')) return 'audio';
    if (ct.startsWith('image/')) return 'image';
    if (ct.startsWith('video/')) return 'video';
    return null;
}

function shouldSniffAttachmentType(attachment) {
    if (!attachment?.url) return false;
    if (attachment.typeSource === 'meta-cdn') return true;
    if (isMetaMessagingCdnUrl(attachment.url)) return true;
    return attachment.type === 'audio' || attachment.type === 'video';
}

async function sniffAttachmentTypeFromUrl(url) {
    const sniffOnce = async (method) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        try {
            const res = await fetch(url, {
                method,
                signal: controller.signal,
                redirect: 'follow',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
                    'Accept': 'image/*,audio/*,video/*,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    ...(method === 'GET' ? { Range: 'bytes=0-0' } : {}),
                },
            });
            if (res.body && typeof res.body.cancel === 'function') {
                res.body.cancel().catch(() => {});
            }
            if (!res.ok && res.status !== 206) return null;
            const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
            const contentDisposition = res.headers.get('content-disposition') || '';
            return inferAttachmentTypeFromHeaders({
                url: res.url || url,
                contentType,
                contentDisposition,
            });
        } catch {
            return null;
        } finally {
            clearTimeout(timeout);
        }
    };
    return (await sniffOnce('HEAD')) || (await sniffOnce('GET'));
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

function graphIdentityFromThread(thread) {
    const data = safeObject(thread?.custom_data);
    const graph = safeObject(data.instagram_graph);
    const subscriberId = String(thread?.subscriber_id || '');
    const graphUserId = graph.ig_graph_user_id
        || graph.recipient_id
        || (subscriberId.startsWith(GRAPH_SUBSCRIBER_PREFIX) ? subscriberId.slice(GRAPH_SUBSCRIBER_PREFIX.length) : '');
    if (!graphUserId) return null;
    const cleaned = {
        ...graph,
        source: 'instagram_graph',
        ig_graph_user_id: String(graphUserId),
        ig_account_id: graph.ig_account_id || graph.account_id || null,
        linked_from_thread_id: thread?.id || null,
    };
    delete cleaned.manual_ig_required;
    return cleaned;
}

function mergeCustomDataWithGraph(existingCustomData, incomingCustomData, graphThread, nowIso) {
    const merged = {
        ...safeObject(existingCustomData),
        ...safeObject(incomingCustomData),
    };
    delete merged.manual_ig_required;
    const graph = graphIdentityFromThread(graphThread);
    if (graph) {
        merged.instagram_graph = {
            ...safeObject(safeObject(existingCustomData).instagram_graph),
            ...safeObject(safeObject(incomingCustomData).instagram_graph),
            ...graph,
            send_ready: true,
            linked_by: 'manychat_recent_duplicate_match',
            linked_at: safeObject(existingCustomData).instagram_graph?.linked_at || nowIso,
        };
    }
    return merged;
}

async function findRecentGraphDuplicate({ messageText, nowIso }) {
    const needle = normalizeComparableText(messageText);
    if (!needle) return null;
    const cutoffIso = new Date(new Date(nowIso).getTime() - RECENT_GRAPH_DUPLICATE_MATCH_MS).toISOString();
    let rows = [];
    try {
        rows = await supabase(
            `ig_messages?select=id,thread_id,direction,text,source,created_at,manychat_message_id&direction=eq.in&created_at=gte.${encodeURIComponent(cutoffIso)}&order=created_at.desc&limit=80`
        );
    } catch (err) {
        console.warn('[manychat-inbound] graph duplicate lookup failed:', err.message);
        return null;
    }
    const match = rows.find(row => String(row.source || '') === 'instagram_graph'
        && normalizeComparableText(row.text) === needle);
    if (!match?.thread_id) return null;
    try {
        const threads = await supabase(
            `ig_threads?select=id,subscriber_id,coach_id,channel,ig_username,profile_name,lead_stage,linked_user_id,custom_data,auto_send_enabled&id=eq.${encodeURIComponent(match.thread_id)}&limit=1`
        );
        return {
            message: match,
            thread: threads[0] || null,
        };
    } catch (err) {
        console.warn('[manychat-inbound] graph duplicate thread lookup failed:', err.message);
        return { message: match, thread: null };
    }
}

async function relabelOrCancelGraphDuplicateAlerts({ graphThreadId, targetThread, leadName, messageText, manychatMessageId, nowIso }) {
    if (!graphThreadId || !targetThread?.id) return 0;
    let rows = [];
    try {
        rows = await supabase(
            `coach_alerts?select=id,data&data->>ig_thread_id=eq.${encodeURIComponent(graphThreadId)}&status=eq.pending&alert_type=in.(ig_incoming_dm,fb_incoming_dm)&created_at=lte.${encodeURIComponent(nowIso)}&limit=25`
        );
    } catch (err) {
        console.warn('[manychat-inbound] duplicate graph alert lookup failed:', err.message);
        return 0;
    }
    let updated = 0;
    const sameThread = graphThreadId === targetThread.id;
    const title = `${leadName || targetThread.profile_name || targetThread.ig_username || 'Instagram lead'} just DM'd on Instagram`;
    const graph = safeObject(safeObject(targetThread.custom_data).instagram_graph);
    for (const row of rows) {
        const data = {
            ...(row.data || {}),
            subscriber_id: targetThread.subscriber_id,
            ig_thread_id: targetThread.id,
            ig_username: targetThread.ig_username || row.data?.ig_username || null,
            delivery_channel: 'instagram_graph',
            ig_graph_recipient_id: graph.ig_graph_user_id || row.data?.ig_graph_recipient_id || undefined,
            ig_graph_account_id: graph.ig_account_id || row.data?.ig_graph_account_id || undefined,
            instagram_graph: Object.keys(graph).length ? graph : row.data?.instagram_graph,
            manual_ig_required: undefined,
            manual_reason: undefined,
            manual_ig_handle: undefined,
            manychat_message_id: manychatMessageId || row.data?.manychat_message_id || null,
            message_preview: String(messageText || row.data?.message_preview || '').slice(0, 400),
            graph_manychat_joined_at: nowIso,
            graph_manychat_joined_from_thread_id: graphThreadId,
        };
        const patch = sameThread
            ? {
                client_name: leadName || targetThread.profile_name || null,
                title,
                data,
            }
            : {
                status: 'canceled',
                actioned_at: nowIso,
                data: {
                    ...data,
                    cancel_reason: 'merged_with_manychat_thread',
                    merged_into_ig_thread_id: targetThread.id,
                },
            };
        try {
            await supabase(`coach_alerts?id=eq.${encodeURIComponent(row.id)}`, {
                method: 'PATCH',
                body: patch,
                prefer: 'return=minimal',
            });
            updated++;
        } catch (err) {
            console.warn('[manychat-inbound] duplicate graph alert patch failed:', err.message);
        }
    }
    return updated;
}

async function attachGraphDuplicateToThread({ thread, graphDuplicate, customData, leadName, messageText, manychatMessageId, nowIso }) {
    if (!thread?.id || !graphDuplicate?.thread?.id || graphDuplicate.thread.id === thread.id) {
        return { thread, updated: false };
    }

    const mergedCustomData = mergeCustomDataWithGraph(thread.custom_data, customData, graphDuplicate.thread, nowIso);
    const graphThreadCustomData = {
        ...safeObject(graphDuplicate.thread.custom_data),
        merged_into_thread_id: thread.id,
        merged_at: nowIso,
        merge_reason: 'manychat_delayed_graph_duplicate_match',
    };

    try {
        await supabase(`ig_threads?id=eq.${encodeURIComponent(thread.id)}`, {
            method: 'PATCH',
            body: { custom_data: mergedCustomData },
            prefer: 'return=minimal',
        });
    } catch (err) {
        console.warn('[manychat-inbound] delayed graph identity attach failed:', err.message);
        return { thread, updated: false };
    }

    try {
        await supabase(`ig_threads?id=eq.${encodeURIComponent(graphDuplicate.thread.id)}`, {
            method: 'PATCH',
            body: { custom_data: graphThreadCustomData },
            prefer: 'return=minimal',
        });
    } catch (err) {
        console.warn('[manychat-inbound] graph duplicate merge marker failed:', err.message);
    }

    await relabelOrCancelGraphDuplicateAlerts({
        graphThreadId: graphDuplicate.thread.id,
        targetThread: { ...thread, custom_data: mergedCustomData },
        leadName,
        messageText,
        manychatMessageId,
        nowIso,
    });

    return {
        thread: { ...thread, custom_data: mergedCustomData },
        updated: true,
    };
}

async function upsertThread({ subscriberId, defaultCoachId, channel, igUsername, profileName, profilePicUrl, customData, nowIso, graphDuplicate }) {
    // Look up by (subscriber_id, channel). The same ManyChat Contact ID can
    // appear on both IG and Messenger -- they're separate conversations
    // with separate 24h windows, so we keep one ig_threads row per channel.
    const selectColumns = 'id,subscriber_id,coach_id,channel,ig_username,profile_name,lead_stage,linked_user_id,custom_data,auto_send_enabled';
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
    if (!existing[0] && channel === 'instagram' && graphDuplicate?.thread?.id) {
        existing = [graphDuplicate.thread];
    }
    const linkedUser = await findLinkedUserByIgHandle(handle);
    if (existing[0]) {
        const patch = { last_inbound_at: nowIso };
        if (existing[0].subscriber_id !== subscriberId) patch.subscriber_id = subscriberId;
        if (igUsername) patch.ig_username = igUsername;
        if (profileName) patch.profile_name = profileName;
        if (profilePicUrl) patch.profile_pic_url = profilePicUrl;
        const mergedCustomData = mergeCustomDataWithGraph(existing[0].custom_data, customData, graphDuplicate?.thread, nowIso);
        if (Object.keys(mergedCustomData).length > 0) patch.custom_data = mergedCustomData;
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
    const initialCustomData = mergeCustomDataWithGraph({}, customData, graphDuplicate?.thread, nowIso);
    const inserted = await supabase('ig_threads', {
        method: 'POST',
        body: [{
            subscriber_id: subscriberId,
            coach_id: defaultCoachId || null,
            channel: channel || 'instagram',
            ig_username: igUsername || null,
            profile_name: profileName || null,
            profile_pic_url: profilePicUrl || null,
            custom_data: Object.keys(initialCustomData).length > 0 ? initialCustomData : {},
            last_inbound_at: nowIso,
            lead_stage: initialStage,
            linked_user_id: linkedUser?.id || null,
        }],
        prefer: 'return=representation',
    });
    return inserted[0];
}

async function findRecentSameThreadMessage({ threadId, text, nowIso, windowMs = RECENT_SAME_THREAD_DUPLICATE_MS, excludeMessageId = null, source = null }) {
    if (!threadId || !text) return null;
    const cutoffIso = new Date(new Date(nowIso).getTime() - windowMs).toISOString();
    try {
        const rows = await supabase(
            `ig_messages?select=id,thread_id,direction,text,source,created_at,manychat_message_id&thread_id=eq.${encodeURIComponent(threadId)}&direction=eq.in&created_at=gte.${encodeURIComponent(cutoffIso)}&order=created_at.desc&limit=20`
        );
        const needle = normalizeComparableText(text);
        return rows.find(row => {
            if (excludeMessageId && row.id === excludeMessageId) return false;
            if (source && String(row.source || '') !== source) return false;
            return normalizeComparableText(row.text) === needle;
        }) || null;
    } catch (err) {
        console.warn('[manychat-inbound] same-thread duplicate lookup failed:', err.message);
        return null;
    }
}

async function deleteJustInsertedDuplicateMessage(messageId) {
    if (!messageId) return false;
    try {
        await supabase(`ig_messages?id=eq.${encodeURIComponent(messageId)}`, {
            method: 'DELETE',
            prefer: 'return=minimal',
        });
        return true;
    } catch (err) {
        console.warn('[manychat-inbound] duplicate message cleanup failed:', err.message);
        return false;
    }
}

async function insertInboundMessage({ threadId, text, manychatMessageId, nowIso, allowRecentTextDedupe = false, recentDedupeWindowMs = RECENT_SAME_THREAD_DUPLICATE_MS }) {
    if (allowRecentTextDedupe) {
        const recentDuplicate = await findRecentSameThreadMessage({ threadId, text, nowIso, windowMs: recentDedupeWindowMs });
        if (recentDuplicate) {
            return {
                inserted: false,
                deduped: true,
                messageId: recentDuplicate.id || null,
                duplicateReason: 'recent_same_text',
            };
        }
    }
    try {
        const rows = await supabase('ig_messages', {
            method: 'POST',
            body: [{
                thread_id: threadId,
                direction: 'in',
                text,
                manychat_message_id: manychatMessageId || null,
                source: 'manychat',
            }],
            prefer: 'return=representation',
        });
        return { inserted: true, deduped: false, messageId: rows[0]?.id || null };
    } catch (err) {
        const isDuplicate = err.sqlstate === '23505'
            || /23505|duplicate key/.test(err.message || '');
        if (isDuplicate) return { inserted: false, deduped: true };
        throw err;
    }
}

exports.handler = async (event) => {
    const auditId = await createWebhookAudit(event);

    if (event.httpMethod !== 'POST') {
        await patchWebhookAudit(auditId, {
            status: 'skipped',
            error_stage: 'method',
            error_message: 'Method not allowed',
            processed_at: new Date().toISOString(),
        });
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
            await patchWebhookAudit(auditId, {
                status: 'error',
                error_stage: 'auth',
                error_message: 'Unauthorized',
                processed_at: new Date().toISOString(),
            });
            return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
        }
    }

    let payload;
    try { payload = parseManyChatPayload(event.body || '{}'); }
    catch {
        await patchWebhookAudit(auditId, {
            status: 'error',
            error_stage: 'parse',
            error_message: 'Invalid JSON',
            processed_at: new Date().toISOString(),
        });
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const subscriberId = String(payload.subscriber_id || '').trim();
    const manychatMessageId = payload.message_id ? String(payload.message_id).trim() : null;

    if (!subscriberId) {
        await patchWebhookAudit(auditId, {
            status: 'error',
            error_stage: 'validation',
            error_message: 'Missing subscriber_id',
            raw_payload: auditSafePayload(payload),
            manychat_message_id: manychatMessageId,
            processed_at: new Date().toISOString(),
        });
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing subscriber_id' }) };
    }

    const customData = (payload.custom_data && typeof payload.custom_data === 'object' && !Array.isArray(payload.custom_data))
        ? payload.custom_data
        : {};
    const textCandidates = collectInboundTextCandidates(payload, customData);

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
    //   2. URL detection across all text-like fields. This matters when
    //      ManyChat sends `message` as the photo URL but keeps the user's
    //      actual words in `last_input_text` or a custom field.
    let attachment = collectExplicitAttachmentCandidates(payload, customData)[0] || null;
    if (!attachment) {
        attachment = textCandidates.map(detectAttachmentFromText).find(Boolean) || null;
    }
    if (shouldSniffAttachmentType(attachment)) {
        const sniffedType = await sniffAttachmentTypeFromUrl(attachment.url);
        if (sniffedType) attachment = { ...attachment, type: sniffedType, typeSource: 'content-type' };
    }

    const textWithoutAttachment = textCandidates
        .map(text => withoutAttachmentUrl(text, attachment?.url || detectAttachmentFromText(text)?.url))
        .map(text => text.trim())
        .filter(Boolean);
    const messageTextRaw = textWithoutAttachment.join('\n\n');
    let messageText = messageTextRaw;
    if (attachment) {
        // If the message text IS the URL, replace it entirely with the
        // marker. If there's separate caption text alongside, keep the text
        // and append the marker.
        const isOnlyTheUrl = messageTextRaw === attachment.url;
        const prefix = isOnlyTheUrl ? '' : (messageTextRaw ? messageTextRaw + ' ' : '');
        if (attachment.type === 'image') {
            messageText = prefix + `[PHOTO:${attachment.url}]`;
        } else if (attachment.type === 'audio') {
            messageText = prefix + `[AUDIO:${attachment.url}]`;
        } else if (attachment.type === 'video') {
            // ig-instant-draft fetches short videos into Gemini inlineData.
            // If the clip cannot be fetched/decoded, the draft prompt flags
            // that failure so the AI asks for a resend or gist.
            messageText = prefix + `[VIDEO:${attachment.url}]`;
        }
    }

    if (!messageText) {
        // No text and no attachment we recognise. Probably a sticker / reaction
        // only. Acknowledge so ManyChat doesn't retry.
        await patchWebhookAudit(auditId, {
            status: 'skipped',
            error_stage: 'message',
            error_message: 'empty_message',
            subscriber_id: subscriberId,
            manychat_message_id: manychatMessageId,
            raw_payload: auditSafePayload(payload),
            custom_data: customData,
            processed_at: new Date().toISOString(),
        });
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
    // Channel routing — defaults to 'instagram' so the existing IG flow
    // doesn't need to add the field. ManyChat's FB Messenger automation
    // should pass `"channel": "messenger"` in the External Request body.
    let channel = String(payload.channel || 'instagram').trim().toLowerCase();
    if (channel !== 'instagram' && channel !== 'messenger') {
        console.warn(`[manychat-inbound] unknown channel '${channel}', defaulting to instagram`);
        channel = 'instagram';
    }

    await patchWebhookAudit(auditId, {
        status: 'parsed',
        subscriber_id: subscriberId,
        channel,
        ig_username: igUsername,
        profile_name: profileName,
        manychat_message_id: manychatMessageId,
        message_text: messageText,
        message_text_hash: hashText(messageText),
        raw_payload: auditSafePayload(payload),
        custom_data: customData,
    });

    const defaultCoachId = await findDefaultCoachId();
    const nowIso = new Date().toISOString();
    let graphDuplicate = channel === 'instagram'
        ? await findRecentGraphDuplicate({ messageText, nowIso })
        : null;

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
            graphDuplicate,
        });
    } catch (err) {
        console.error('[manychat-inbound] thread upsert failed:', err.message);
        await patchWebhookAudit(auditId, {
            status: 'error',
            error_stage: 'thread_upsert',
            error_message: err.message,
            processed_at: new Date().toISOString(),
        });
        return { statusCode: 500, body: JSON.stringify({ error: 'Thread upsert failed' }) };
    }

    if (graphDuplicate?.thread?.id) {
        const leadName = profileName || igUsername || thread.profile_name || thread.ig_username || 'Instagram lead';
        await relabelOrCancelGraphDuplicateAlerts({
            graphThreadId: graphDuplicate.thread.id,
            targetThread: thread,
            leadName,
            messageText,
            manychatMessageId,
            nowIso,
        });
    }

    let messageResult;
    try {
        messageResult = await insertInboundMessage({
            threadId: thread.id,
            text: messageText,
            manychatMessageId,
            nowIso,
            allowRecentTextDedupe: graphDuplicate?.thread?.id === thread.id,
            recentDedupeWindowMs: graphDuplicate?.thread?.id ? RECENT_GRAPH_DUPLICATE_MATCH_MS : RECENT_SAME_THREAD_DUPLICATE_MS,
        });
    } catch (err) {
        console.error('[manychat-inbound] message insert failed:', err.message);
        await patchWebhookAudit(auditId, {
            status: 'error',
            error_stage: 'message_insert',
            error_message: err.message,
            thread_id: thread.id,
            processed_at: new Date().toISOString(),
        });
        return { statusCode: 500, body: JSON.stringify({ error: 'Message insert failed' }) };
    }

    if (messageResult.deduped) {
        // ManyChat retried delivery — the alert was already drafted on the
        // original hit. Skip the dispatch so we don't race the alert
        // idempotency check.
        await patchWebhookAudit(auditId, {
            status: 'skipped',
            error_stage: 'dedupe',
            error_message: 'duplicate_message',
            thread_id: thread.id,
            processed_at: new Date().toISOString(),
        });
        return { statusCode: 200, body: JSON.stringify({ skipped: 'duplicate_message' }) };
    }

    if (!graphDuplicate?.thread?.id && channel === 'instagram') {
        await sleep(GRAPH_DUPLICATE_RETRY_DELAY_MS);
        const retryNowIso = new Date().toISOString();
        graphDuplicate = await findRecentGraphDuplicate({ messageText, nowIso: retryNowIso });
        if (graphDuplicate?.thread?.id && graphDuplicate.thread.id !== thread.id) {
            const leadName = profileName || igUsername || thread.profile_name || thread.ig_username || 'Instagram lead';
            const attached = await attachGraphDuplicateToThread({
                thread,
                graphDuplicate,
                customData,
                leadName,
                messageText,
                manychatMessageId,
                nowIso: retryNowIso,
            });
            thread = attached.thread || thread;
        }
        if (graphDuplicate?.thread?.id === thread.id && messageResult.inserted && messageResult.messageId) {
            const duplicate = await findRecentSameThreadMessage({
                threadId: thread.id,
                text: messageText,
                nowIso: retryNowIso,
                windowMs: RECENT_GRAPH_DUPLICATE_MATCH_MS,
                excludeMessageId: messageResult.messageId,
                source: 'instagram_graph',
            });
            if (duplicate) {
                await deleteJustInsertedDuplicateMessage(messageResult.messageId);
                await patchWebhookAudit(auditId, {
                    status: 'skipped',
                    error_stage: 'dedupe',
                    error_message: 'delayed_graph_duplicate_message',
                    thread_id: thread.id,
                    ig_message_id: duplicate.id || null,
                    processed_at: retryNowIso,
                });
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        skipped: 'duplicate_message',
                        duplicate_reason: 'delayed_graph_duplicate',
                    }),
                };
            }
        }
    }

    // Hand the slower draft producer to a background function. The background
    // endpoint acknowledges quickly, then keeps running after this webhook
    // returns to ManyChat.
    try {
        const draftUrl = `${SITE_URL}/.netlify/functions/ig-instant-draft-background`;
        const dispatch = fetch(draftUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                threadId: thread.id,
                subscriberId,
                channel,
                messageText,
                manychatMessageId,
                igUsername: thread.ig_username || igUsername,
                profileName: thread.profile_name || profileName,
                customData: thread.custom_data || customData,
            }),
        });
        const result = await Promise.race([
            dispatch,
            new Promise(resolve => setTimeout(() => resolve(null), DRAFT_DISPATCH_TIMEOUT_MS)),
        ]);
        if (result && !result.ok) {
            const text = await result.text().catch(() => '');
            console.warn('[manychat-inbound] draft background handoff failed:', result.status, text.slice(0, 240));
            await patchWebhookAudit(auditId, {
                status: 'processed',
                error_stage: 'draft_dispatch',
                error_message: `draft handoff ${result.status}: ${text.slice(0, 240)}`,
                thread_id: thread.id,
                ig_message_id: messageResult.messageId,
                processed_at: new Date().toISOString(),
            });
        }
    } catch (e) {
        console.warn('[manychat-inbound] draft dispatch wrapper failed:', e.message);
        await patchWebhookAudit(auditId, {
            status: 'processed',
            error_stage: 'draft_dispatch',
            error_message: e.message,
            thread_id: thread.id,
            ig_message_id: messageResult.messageId,
            processed_at: new Date().toISOString(),
        });
    }

    await patchWebhookAudit(auditId, {
        status: 'processed',
        thread_id: thread.id,
        ig_message_id: messageResult.messageId,
        processed_at: new Date().toISOString(),
    });

    return {
        statusCode: 200,
        body: JSON.stringify({
            ok: true,
            thread_id: thread.id,
            lead_stage: thread.lead_stage || 'new',
        }),
    };
};

exports._test = {
    escapeControlCharsInsideJsonStrings,
    parseManyChatPayload,
    safeAuditHeaders,
};

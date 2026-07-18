const crypto = require('crypto');
const {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    supabaseQuery,
    insertCoachAlert,
    transcribeAudioInlineData,
    verifyAudioTranscriptInlineData,
} = require('./client-context');

const BUCKET = 'ig-message-media';
const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15000;
const MAX_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [10000, 60000, 5 * 60000, 20 * 60000, 60 * 60000];
const MEDIA_RE = /\[(PHOTO|AUDIO|VIDEO):\s*(https?:\/\/[^\s\]]+)\]/gi;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function extensionFor(kind, mimeType = '') {
    const clean = String(mimeType || '').split(';')[0].trim().toLowerCase();
    if (kind === 'audio') {
        if (clean.includes('mpeg')) return 'mp3';
        if (clean.includes('ogg')) return 'ogg';
        if (clean.includes('wav')) return 'wav';
        if (clean.includes('webm')) return 'webm';
        if (clean.includes('amr')) return 'amr';
        return 'm4a';
    }
    if (kind === 'photo') {
        if (clean.includes('png')) return 'png';
        if (clean.includes('webp')) return 'webp';
        if (clean.includes('gif')) return 'gif';
        return 'jpg';
    }
    if (clean.includes('webm')) return 'webm';
    if (clean.includes('quicktime')) return 'mov';
    return 'mp4';
}

function normalizedMimeType(kind, contentType = '') {
    const clean = String(contentType || '').split(';')[0].trim().toLowerCase();
    if (kind === 'audio') {
        if (clean === 'application/ogg') return 'audio/ogg';
        if (clean === 'video/mp4') return 'audio/mp4';
        if (clean === 'video/webm') return 'audio/webm';
        return clean.startsWith('audio/') ? clean : 'audio/mp4';
    }
    if (kind === 'photo') return clean.startsWith('image/') ? clean : 'image/jpeg';
    return clean.startsWith('video/') ? clean : 'video/mp4';
}

function extractMediaReferences(messageText = '') {
    const refs = [];
    const re = new RegExp(MEDIA_RE.source, MEDIA_RE.flags);
    let match;
    while ((match = re.exec(String(messageText || ''))) !== null) {
        refs.push({
            ordinal: refs.length + 1,
            kind: String(match[1] || '').toLowerCase() === 'photo' ? 'photo' : String(match[1] || '').toLowerCase(),
            sourceUrl: match[2],
        });
    }
    return refs;
}

async function registerInboundMedia({ igMessageId, threadId, graphMessageId = null, messageText = '' }) {
    const refs = extractMediaReferences(messageText);
    if (!igMessageId || !threadId || refs.length === 0) return [];
    const rows = refs.map(ref => ({
        ig_message_id: igMessageId,
        ig_thread_id: threadId,
        graph_message_id: graphMessageId || null,
        ordinal: ref.ordinal,
        media_kind: ref.kind,
        source_url: ref.sourceUrl,
        status: 'received',
        next_attempt_at: new Date().toISOString(),
    }));
    return supabaseQuery('ig_message_media?on_conflict=ig_message_id,ordinal', {
        method: 'POST',
        body: rows,
        prefer: 'resolution=ignore-duplicates,return=representation',
    });
}

async function fetchMediaBytes(url, kind) {
    let lastError = '';
    for (let attempt = 0; attempt < 3; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
            const response = await fetch(url, {
                signal: controller.signal,
                redirect: 'follow',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36',
                    'Accept': '*/*',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
            });
            if (!response.ok) throw new Error(`media download HTTP ${response.status}`);
            const bytes = Buffer.from(await response.arrayBuffer());
            if (!bytes.length) throw new Error('media download was empty');
            if (bytes.length > MAX_MEDIA_BYTES) throw new Error(`media exceeds ${MAX_MEDIA_BYTES} bytes`);
            return {
                bytes,
                mimeType: normalizedMimeType(kind, response.headers.get('content-type') || ''),
            };
        } catch (error) {
            lastError = String(error.message || error);
            if (attempt < 2) await sleep([500, 1500][attempt]);
        } finally {
            clearTimeout(timeout);
        }
    }
    throw new Error(lastError || 'media download failed');
}

async function uploadPrivateObject(path, bytes, mimeType) {
    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
        method: 'POST',
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': mimeType,
            'x-upsert': 'true',
        },
        body: bytes,
    });
    if (!response.ok) {
        throw new Error(`private media upload HTTP ${response.status}: ${(await response.text()).slice(0, 240)}`);
    }
}

async function downloadPrivateObject(row) {
    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/${row.storage_bucket}/${row.storage_path}`, {
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
    });
    if (!response.ok) throw new Error(`private media read HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
}

async function createSignedObjectUrl(row, expiresIn = 3600) {
    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${row.storage_bucket}/${row.storage_path}`, {
        method: 'POST',
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.signedURL) throw new Error(`private media signing HTTP ${response.status}`);
    return body.signedURL.startsWith('http') ? body.signedURL : `${SUPABASE_URL}/storage/v1${body.signedURL}`;
}

function transcriptLooksUsable(text = '') {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean || clean.length > 4000) return false;
    if (/^(?:audio|music|silence|inaudible|unintelligible|no speech)(?: detected)?[.!]?$/i.test(clean)) return false;
    if (/\b(?:cannot|can't|unable to) transcribe\b/i.test(clean)) return false;
    const repeated = clean.match(/\b(\w{2,})\b(?:\s+\1\b){5,}/i);
    return !repeated;
}

async function claimMediaRow(row) {
    const token = crypto.randomUUID();
    const claimed = await supabaseQuery(
        `ig_message_media?id=eq.${encodeURIComponent(row.id)}&status=eq.${encodeURIComponent(row.status)}`,
        {
            method: 'PATCH',
            body: {
                status: 'processing',
                processing_token: token,
                processing_started_at: new Date().toISOString(),
                attempt_count: Number(row.attempt_count || 0) + 1,
                last_error: null,
            },
        }
    );
    return claimed[0] || null;
}

async function markRetry(row, error) {
    const attempts = Number(row.attempt_count || 0);
    const exhausted = attempts >= MAX_ATTEMPTS;
    const delay = RETRY_DELAYS_MS[Math.min(Math.max(0, attempts - 1), RETRY_DELAYS_MS.length - 1)];
    await supabaseQuery(`ig_message_media?id=eq.${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        body: {
            status: exhausted ? 'manual_review' : 'retry_wait',
            next_attempt_at: new Date(Date.now() + delay).toISOString(),
            processing_token: null,
            last_error: String(error?.message || error || 'media processing failed').slice(0, 800),
        },
    });
    if (exhausted) await ensureManualReviewAlert(row, error);
}

async function ensureManualReviewAlert(row, error) {
    const [threads, messages] = await Promise.all([
        supabaseQuery(`ig_threads?select=id,coach_id,linked_user_id,ig_username,profile_name&id=eq.${encodeURIComponent(row.ig_thread_id)}&limit=1`),
        supabaseQuery(`ig_messages?select=id,text&id=eq.${encodeURIComponent(row.ig_message_id)}&limit=1`),
    ]);
    const thread = threads[0] || {};
    const message = messages[0] || {};
    const leadName = thread.profile_name || thread.ig_username || 'Instagram lead';
    const result = await insertCoachAlert({
        client_id: thread.linked_user_id || null,
        client_name: leadName,
        coach_id: thread.coach_id || null,
        alert_type: 'ig_media_review_needed',
        priority: 'high',
        title: `${leadName}'s ${row.media_kind} needs manual review`,
        description: 'The original media was preserved when possible, but automated analysis did not verify after five attempts.',
        suggested_message: null,
        status: 'pending',
        data: {
            channel: 'instagram',
            ig_thread_id: row.ig_thread_id,
            ig_message_id: row.ig_message_id,
            ig_message_media_id: row.id,
            media_kind: row.media_kind,
            media_processing_status: 'manual_review',
            media_attempt_count: Number(row.attempt_count || 0),
            media_last_error: String(error?.message || error || '').slice(0, 800),
            media_source_preview: String(message.text || '').slice(0, 400),
            operator_queue: 'needs_you',
            needs_you_required: true,
            client_manager_review_required: true,
            needs_you_reason: 'media_analysis_retries_exhausted',
            public_reply_blocked: true,
        },
    }, `ig_media_review:${row.id}`);
    if (result.alertId) {
        await supabaseQuery(`ig_message_media?id=eq.${encodeURIComponent(row.id)}`, {
            method: 'PATCH',
            body: {
                analysis: {
                    ...(row.analysis || {}),
                    manual_review_alert_id: result.alertId,
                    manual_review_alerted_at: new Date().toISOString(),
                },
            },
        });
    }
}

async function processClaimedMedia(row) {
    try {
        let bytes;
        let mimeType = row.source_mime_type || '';
        let storagePath = row.storage_path || '';
        if (storagePath) {
            bytes = await downloadPrivateObject(row);
        } else {
            const fetched = await fetchMediaBytes(row.source_url, row.media_kind);
            bytes = fetched.bytes;
            mimeType = fetched.mimeType;
            storagePath = `${row.ig_thread_id}/${row.ig_message_id}/${row.ordinal}.${extensionFor(row.media_kind, mimeType)}`;
            await uploadPrivateObject(storagePath, bytes, mimeType);
        }

        const patch = {
            storage_bucket: BUCKET,
            storage_path: storagePath,
            source_mime_type: mimeType || normalizedMimeType(row.media_kind),
            byte_size: bytes.length,
            sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
            status: 'preserved',
            processing_token: null,
            last_error: null,
            analysis: {
                ...(row.analysis || {}),
                preserved_at: new Date().toISOString(),
            },
        };

        if (row.media_kind === 'audio') {
            const transcript = await transcribeAudioInlineData({
                mimeType: patch.source_mime_type,
                data: bytes.toString('base64'),
            }, Math.max(0, Number(row.ordinal || 1) - 1));
            if (!transcriptLooksUsable(transcript.text)) {
                throw new Error(transcript.error || 'voice-note transcript failed verification');
            }
            const verification = await verifyAudioTranscriptInlineData({
                mimeType: patch.source_mime_type,
                data: bytes.toString('base64'),
            }, transcript.text);
            const verifiedText = transcriptLooksUsable(verification.text)
                ? verification.text
                : transcript.text;
            patch.status = 'verified';
            patch.transcript = verifiedText;
            patch.transcript_model = verification.verified
                ? `${transcript.model || 'primary'}+${verification.model || 'verifier'}`
                : (transcript.model || null);
            patch.transcript_verified = true;
            patch.analysis.transcript_verified_at = new Date().toISOString();
            patch.analysis.transcript_verification = {
                independent_check_completed: verification.verified === true,
                verifier_model: verification.model || null,
                verifier_error: verification.error || null,
                candidate_changed: verifiedText !== transcript.text,
            };
        }

        const updated = await supabaseQuery(`ig_message_media?id=eq.${encodeURIComponent(row.id)}`, {
            method: 'PATCH',
            body: patch,
        });
        return updated[0] || { ...row, ...patch };
    } catch (error) {
        await markRetry(row, error);
        return null;
    }
}

async function loadMediaForMessage(igMessageId) {
    return supabaseQuery(
        `ig_message_media?select=*&ig_message_id=eq.${encodeURIComponent(igMessageId)}&order=ordinal.asc`
    );
}

async function buildDurableDraftPayload(igMessageId) {
    const messages = await supabaseQuery(
        `ig_messages?select=id,thread_id,text,manychat_message_id&id=eq.${encodeURIComponent(igMessageId)}&limit=1`
    );
    const message = messages[0];
    if (!message) throw new Error('IG message no longer exists');
    const media = await loadMediaForMessage(igMessageId);
    if (!media.length) return null;
    if (media.some(row => !row.storage_path || !['preserved', 'verified'].includes(row.status))) return null;

    let text = String(message.text || '');
    const transcriptOverrides = [];
    for (const row of media) {
        const signedUrl = await createSignedObjectUrl(row);
        text = text.replace(row.source_url, signedUrl);
        if (row.media_kind === 'audio') transcriptOverrides.push({
            text: row.transcript || '',
            model: row.transcript_model || 'durable-media-transcript',
            verified: row.transcript_verified === true,
        });
    }
    return {
        threadId: message.thread_id,
        messageText: text,
        manychatMessageId: message.manychat_message_id,
        durableMediaIds: media.map(row => row.id),
        audioTranscriptOverrides: transcriptOverrides,
    };
}

async function markDraftDispatchStarted(mediaIds = []) {
    const token = crypto.randomUUID();
    for (const id of mediaIds) {
        const rows = await supabaseQuery(`ig_message_media?select=analysis&id=eq.${encodeURIComponent(id)}&limit=1`);
        await supabaseQuery(`ig_message_media?id=eq.${encodeURIComponent(id)}&status=in.(preserved,verified)`, {
            method: 'PATCH',
            body: {
                status: 'processing',
                processing_token: token,
                processing_started_at: new Date().toISOString(),
                analysis: {
                    ...(rows[0]?.analysis || {}),
                    draft_dispatch_started_at: new Date().toISOString(),
                },
            },
        });
    }
    return token;
}

async function markDraftDispatchFailed(mediaIds = [], error = '') {
    for (const id of mediaIds) {
        const rows = await supabaseQuery(`ig_message_media?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
        if (rows[0]) await markRetry(rows[0], error || 'durable draft dispatch failed');
    }
}

async function markDraftAnalysis(mediaIds = [], mediaDecode = {}, error = '') {
    const ids = (Array.isArray(mediaIds) ? mediaIds : []).filter(Boolean);
    if (!ids.length) return;
    const analyzedKinds = new Set((mediaDecode.analyzed_kinds || []).map(value => String(value).toLowerCase()));
    for (const id of ids) {
        const rows = await supabaseQuery(`ig_message_media?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
        const row = rows[0];
        if (!row) continue;
        const analyzed = row.media_kind === 'audio'
            ? row.transcript_verified === true && analyzedKinds.has('audio')
            : analyzedKinds.has(row.media_kind);
        if (analyzed) {
            await supabaseQuery(`ig_message_media?id=eq.${encodeURIComponent(id)}`, {
                method: 'PATCH',
                body: {
                    status: 'verified',
                    next_attempt_at: new Date().toISOString(),
                    last_error: null,
                    analysis: {
                        ...(row.analysis || {}),
                        draft_analysis_verified_at: new Date().toISOString(),
                        analysis_model: mediaDecode.analysis_model || null,
                        media_summary: mediaDecode.media_summary || null,
                    },
                },
            });
        } else {
            await markRetry(row, error || 'draft media analysis did not verify this attachment');
        }
    }
}

module.exports = {
    BUCKET,
    MAX_ATTEMPTS,
    extractMediaReferences,
    transcriptLooksUsable,
    registerInboundMedia,
    claimMediaRow,
    processClaimedMedia,
    loadMediaForMessage,
    buildDurableDraftPayload,
    markDraftDispatchStarted,
    markDraftDispatchFailed,
    markDraftAnalysis,
};

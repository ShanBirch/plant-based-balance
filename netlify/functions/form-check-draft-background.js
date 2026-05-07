/**
 * Long-running form-check critique draft.
 *
 * The instant DM path creates the card immediately, then queues this background
 * function because phone videos can take close to a minute to upload/process
 * through Gemini's File API.
 */

const {
    supabaseQuery,
    callGeminiFallback,
    stripLeadingGreeting,
    truncate,
    fetchVideoAsGeminiFileData,
    buildMediaReviewInfo,
} = require('./_lib/client-context');

function extractVideoUrl(text) {
    const match = String(text || '').match(/\[(?:VIDEO|video):\s*(https?:\/\/[^\s\]"']+)\]/i);
    return match ? match[1] : '';
}

function stripMediaMarkers(text) {
    return String(text || '')
        .replace(/\[PHOTO:https?:\/\/[^\]]+\]/gi, 'photo')
        .replace(/\[AUDIO:https?:\/\/[^\]]+\]/gi, 'voice note')
        .replace(/\[(?:VIDEO|video):\s*https?:\/\/[^\]]+\]/gi, 'video')
        .trim();
}

function response(statusCode, body) {
    return { statusCode, body: JSON.stringify(body || {}) };
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return response(405, { error: 'Method not allowed' });
    }

    let payload;
    try { payload = JSON.parse(event.body || '{}'); }
    catch { return response(400, { error: 'Invalid JSON' }); }

    const alertId = String(payload.alertId || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(alertId)) {
        return response(400, { error: 'Missing or invalid alertId' });
    }

    const rows = await supabaseQuery(
        `coach_alerts?select=id,client_id,client_name,status,suggested_message,data&` +
        `id=eq.${encodeURIComponent(alertId)}&limit=1`
    );
    const alert = rows[0];
    if (!alert) return response(404, { error: 'Alert not found' });

    const data = alert.data || {};
    if (data.is_form_check !== true && data.is_form_check !== 'true') {
        return response(200, { skipped: 'not_form_check' });
    }
    if (String(alert.status || '') !== 'pending') {
        return response(200, { skipped: 'already_actioned', status: alert.status });
    }

    const message = data.message_preview || '';
    const videoUrl = extractVideoUrl(message);
    const clientName = alert.client_name || 'this client';
    const cleanMessage = stripMediaMarkers(message);

    let mediaPart = null;
    let model = 'gemini-form-check-media-missing';
    let mediaDecode = {
        photo_url_count: 0,
        audio_url_count: 0,
        video_url_count: videoUrl ? 1 : 0,
        photo_loaded_count: 0,
        audio_loaded_count: 0,
        video_loaded_count: 0,
        photo_failed: false,
        audio_failed: false,
        video_failed: !!videoUrl,
    };

    if (videoUrl) {
        const uploaded = await fetchVideoAsGeminiFileData(videoUrl, `form-check-${alert.client_id || alert.id}`);
        if (uploaded?.fileData) {
            mediaPart = { fileData: uploaded.fileData };
            model = 'gemini-form-check-video';
            mediaDecode = {
                ...mediaDecode,
                video_loaded_count: 1,
                video_failed: false,
            };
        }
    }

    const prompt = `Draft Shannon's editable reply to ${clientName} after this form-check request.

CLIENT MESSAGE:
${cleanMessage || '(no text, video only)'}

Rules:
- Write as Shannon, casual Australian coach voice, no greeting, no AI mention.
- ${mediaPart ? 'Watch the attached video and critique what is visible.' : 'The video could not be loaded by the draft system. Do not pretend you saw it.'}
- Give one quick positive, then 1-3 clear form cues/fixes, then one simple next step.
- Only mention technique details visible in the clip. If the angle is unclear, say what angle would help.
- No medical diagnosis, no fear language.
- Keep it as a message ${clientName} can receive, 3-6 short sentences max.

Reply with just the message text.`;

    let draftText = '';
    try {
        const parts = mediaPart ? [{ text: prompt }, mediaPart] : [{ text: prompt }];
        const reply = await callGeminiFallback([{ role: 'user', parts }], {
            maxOutputTokens: 2048,
            temperature: 0.55,
        });
        draftText = stripLeadingGreeting(reply);
    } catch (e) {
        console.error('[form-check-draft] Gemini failed:', e.message);
        draftText = videoUrl
            ? 'I can see the form-check video is attached, but the draft system could not inspect it properly. I will have a look myself and send you proper feedback.'
            : 'I cannot see the video on my end. Can you resend it from the form check button, ideally side-on or 45 degrees with your whole body in frame?';
        model = 'form-check-draft-fallback';
    }

    if (!draftText.trim()) {
        return response(200, { skipped: 'empty_draft' });
    }

    const nextData = {
        ...data,
        draft_model: model,
        drafted_at: new Date().toISOString(),
        media_decode: mediaDecode,
        media_review: data.media_review || buildMediaReviewInfo({
            message_preview: message,
        }),
        draft_evidence: {
            ...(data.draft_evidence || {}),
            source_mode: 'saved_at_form_check_background',
            current_message: truncate(message, 600),
            media: mediaPart ? 'Gemini File API video loaded for form-check critique' : 'Video media was present but could not be loaded for critique',
        },
    };

    await supabaseQuery(`coach_alerts?id=eq.${encodeURIComponent(alertId)}`, {
        method: 'PATCH',
        body: {
            suggested_message: draftText,
            data: nextData,
        },
    });

    return response(200, { ok: true, alertId, model });
};

const { createHash, randomUUID } = require('crypto');

const DEFAULT_SHANNON_PROFESSIONAL_VOICE_ID = 'qndkzv7PLOlM7dM2zfZQ';
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2';
const DEFAULT_OUTPUT_FORMAT = 'mp3_44100_128';
const MAX_TTS_CHARS = 3500;

function cleanString(value, max = 500) {
    return String(value || '').trim().slice(0, max);
}

function parseBoolean(value, fallback = false) {
    if (value == null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    const raw = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(raw)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(raw)) return false;
    return fallback;
}

function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeAccountKey(value) {
    return String(value || '').trim().replace(/^@+/, '').toLowerCase();
}

function resolveVoiceId(alertData = {}) {
    return cleanString(
        alertData.elevenlabs_voice_id
        || alertData.elevenLabsVoiceId
        || process.env.ELEVENLABS_SHANNON_PROFESSIONAL_VOICE_ID
        || process.env.ELEVENLABS_VOICE_ID
        || DEFAULT_SHANNON_PROFESSIONAL_VOICE_ID,
        120
    );
}

function resolveModelId(alertData = {}) {
    return cleanString(
        alertData.elevenlabs_model_id
        || alertData.elevenLabsModelId
        || process.env.ELEVENLABS_TTS_MODEL_ID
        || DEFAULT_MODEL_ID,
        120
    );
}

function resolveOutputFormat(alertData = {}) {
    return cleanString(
        alertData.elevenlabs_output_format
        || process.env.ELEVENLABS_TTS_OUTPUT_FORMAT
        || DEFAULT_OUTPUT_FORMAT,
        80
    );
}

function isVoiceMessageRequested(alertData = {}) {
    return parseBoolean(
        alertData.outbound_voice_message
        ?? alertData.outboundVoiceMessage
        ?? alertData.voice_reply_enabled
        ?? alertData.voiceReplyEnabled,
        false
    );
}

function resolveOutboundVoiceMessageConfig(alertData = {}, { shouldUseGraph = false, channel = '' } = {}) {
    const enabled = isVoiceMessageRequested(alertData);
    if (!enabled) return { enabled: false };
    if (channel !== 'instagram' || !shouldUseGraph) {
        return {
            enabled: true,
            available: false,
            blockedReason: 'voice_messages_require_instagram_graph',
        };
    }
    return {
        enabled: true,
        available: true,
        voiceId: resolveVoiceId(alertData),
        modelId: resolveModelId(alertData),
        outputFormat: resolveOutputFormat(alertData),
        reason: cleanString(alertData.outbound_voice_message_reason || alertData.voice_reply_reason || '', 160),
    };
}

function buildTtsText(messages = []) {
    const text = (Array.isArray(messages) ? messages : [messages])
        .map(value => String(value || '').trim())
        .filter(Boolean)
        .join('\n\n')
        .replace(/[^\S\n]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return text.slice(0, MAX_TTS_CHARS);
}

async function secretValueForKey(key, supabaseQuery) {
    const cleanKey = cleanString(key, 180);
    if (!cleanKey || typeof supabaseQuery !== 'function') return '';
    try {
        const rows = await supabaseQuery(`app_private_secrets?select=value&key=eq.${encodeURIComponent(cleanKey)}&limit=1`);
        return cleanString(rows?.[0]?.value || '', 5000);
    } catch (err) {
        console.warn(`[elevenlabs-voice] secret lookup failed for ${cleanKey}:`, err.message || err);
        return '';
    }
}

async function resolveElevenLabsApiKey(supabaseQuery) {
    const envKey = cleanString(process.env.ELEVENLABS_API_KEY || process.env.XI_API_KEY || '', 5000);
    if (envKey) return envKey;
    return await secretValueForKey('elevenlabs_api_key', supabaseQuery)
        || await secretValueForKey('ELEVENLABS_API_KEY', supabaseQuery);
}

async function generateElevenLabsSpeech({ text, voiceId, modelId, outputFormat, supabaseQuery, alertData = {} }) {
    const apiKey = await resolveElevenLabsApiKey(supabaseQuery);
    if (!apiKey) throw new Error('ELEVENLABS_API_KEY not configured');
    if (!voiceId) throw new Error('ElevenLabs voice id missing');
    if (!text) throw new Error('Voice message text is empty');

    const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat || DEFAULT_OUTPUT_FORMAT)}`,
        {
            method: 'POST',
            headers: {
                'xi-api-key': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text,
                model_id: modelId || DEFAULT_MODEL_ID,
                voice_settings: {
                    stability: Number.isFinite(Number(alertData.elevenlabs_stability)) ? Number(alertData.elevenlabs_stability) : 0.5,
                    similarity_boost: Number.isFinite(Number(alertData.elevenlabs_similarity_boost)) ? Number(alertData.elevenlabs_similarity_boost) : 0.75,
                    style: Number.isFinite(Number(alertData.elevenlabs_style)) ? Number(alertData.elevenlabs_style) : 0,
                    use_speaker_boost: alertData.elevenlabs_speaker_boost == null
                        ? true
                        : parseBoolean(alertData.elevenlabs_speaker_boost, true),
                },
            }),
        }
    );
    const contentType = res.headers.get('content-type') || 'audio/mpeg';
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!res.ok) {
        const detail = buffer.toString('utf8').slice(0, 400);
        throw new Error(`ElevenLabs ${res.status}: ${detail}`);
    }
    if (!buffer.length) throw new Error('ElevenLabs returned empty audio');
    return { buffer, contentType };
}

async function uploadVoiceNoteToB2({ buffer, contentType = 'audio/mpeg', alertId = '' }) {
    const keyId = cleanString(process.env.B2_KEY_ID || '', 5000);
    const appKey = cleanString(process.env.B2_APPLICATION_KEY || '', 5000);
    const bucketId = cleanString(process.env.B2_BUCKET_ID || '', 500);
    const bucketName = cleanString(process.env.B2_BUCKET_NAME || '', 500);
    if (!keyId || !appKey || !bucketId || !bucketName) {
        throw new Error('B2 storage configuration missing');
    }

    const authRes = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
        headers: {
            Authorization: `Basic ${Buffer.from(`${keyId}:${appKey}`).toString('base64')}`,
        },
    });
    const authText = await authRes.text();
    if (!authRes.ok) throw new Error(`B2 authorize ${authRes.status}: ${authText.slice(0, 240)}`);
    const auth = JSON.parse(authText || '{}');

    const uploadUrlRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
        method: 'POST',
        headers: {
            Authorization: auth.authorizationToken,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bucketId }),
    });
    const uploadUrlText = await uploadUrlRes.text();
    if (!uploadUrlRes.ok) throw new Error(`B2 upload-url ${uploadUrlRes.status}: ${uploadUrlText.slice(0, 240)}`);
    const upload = JSON.parse(uploadUrlText || '{}');

    const dateKey = new Date().toISOString().slice(0, 10);
    const cleanAlertId = cleanString(alertId, 80).replace(/[^a-zA-Z0-9_-]+/g, '-');
    const fileName = `ai-voice-notes/${dateKey}/${Date.now()}-${cleanAlertId || 'alert'}-${randomUUID()}.mp3`;
    const sha1 = createHash('sha1').update(buffer).digest('hex');

    const uploadRes = await fetch(upload.uploadUrl, {
        method: 'POST',
        headers: {
            Authorization: upload.authorizationToken,
            'X-Bz-File-Name': encodeURIComponent(fileName),
            'Content-Type': contentType || 'audio/mpeg',
            'Content-Length': String(buffer.length),
            'X-Bz-Content-Sha1': sha1,
            'X-Bz-Info-upload-type': 'ai-coach-voice-note',
        },
        body: buffer,
    });
    const uploadedText = await uploadRes.text();
    if (!uploadRes.ok) throw new Error(`B2 upload ${uploadRes.status}: ${uploadedText.slice(0, 240)}`);
    const uploaded = JSON.parse(uploadedText || '{}');

    return {
        url: `${auth.downloadUrl}/file/${bucketName}/${fileName}`,
        fileName,
        fileId: uploaded.fileId || null,
        sizeBytes: buffer.length,
        contentType,
    };
}

async function createVoiceMessageAudio({ messages, alertId, alertData = {}, supabaseQuery }) {
    const text = buildTtsText(messages);
    const config = {
        voiceId: resolveVoiceId(alertData),
        modelId: resolveModelId(alertData),
        outputFormat: resolveOutputFormat(alertData),
    };
    const speech = await generateElevenLabsSpeech({
        text,
        ...config,
        supabaseQuery,
        alertData,
    });
    const uploaded = await uploadVoiceNoteToB2({
        buffer: speech.buffer,
        contentType: speech.contentType || 'audio/mpeg',
        alertId,
    });
    return {
        ...uploaded,
        text,
        voiceId: config.voiceId,
        modelId: config.modelId,
        outputFormat: config.outputFormat,
    };
}

function isCocosToShanSunnyVoiceTest({ botAccount, igUsername, customData = {} } = {}) {
    const graph = safeObject(customData.instagram_graph);
    const bot = normalizeAccountKey(botAccount || customData.bot_account || graph.bot_account);
    const lead = normalizeAccountKey(igUsername || customData.ig_username || graph.ig_username || graph.username);
    return bot === 'shan_n_sunny' && lead === 'cocos_pt_studio';
}

module.exports = {
    DEFAULT_SHANNON_PROFESSIONAL_VOICE_ID,
    buildTtsText,
    createVoiceMessageAudio,
    isCocosToShanSunnyVoiceTest,
    parseBoolean,
    resolveOutboundVoiceMessageConfig,
    _test: {
        isVoiceMessageRequested,
        normalizeAccountKey,
        resolveModelId,
        resolveOutputFormat,
        resolveVoiceId,
    },
};

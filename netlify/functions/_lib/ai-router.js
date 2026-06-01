/**
 * Tiny model-chain helper for AI API calls.
 *
 * Profiles can be overridden without code changes via:
 *   GEMINI_MODEL_CHAIN=gemini-2.5-flash,gemini-2.5-flash-lite
 *   GEMINI_MODEL_CHAIN_COACH_FALLBACK=gemini-2.5-flash
 *   OPENAI_MODEL_CHAIN=gpt-5.4-mini
 *   OPENAI_MODEL_CHAIN_COACH_FALLBACK=gpt-5.4-mini
 */

const DEFAULT_GEMINI_MODEL_CHAINS = {
    coach_fallback: ['gemini-2.5-flash'],
    default: ['gemini-2.5-flash'],
};

const DEFAULT_OPENAI_MODEL_CHAINS = {
    coach_fallback: ['gpt-5.4-mini'],
    coach_shadow: ['gpt-5.4-mini'],
    default: ['gpt-5.4-mini'],
};

function parseModelChain(value) {
    return String(value || '')
        .split(',')
        .map(model => model.trim())
        .filter(Boolean);
}

function envKeyForProfile(prefix, profile) {
    return `${prefix}_MODEL_CHAIN_${String(profile || 'default').toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
}

function resolveGeminiModelChain({ profile, models } = {}) {
    if (Array.isArray(models) && models.length > 0) {
        return models.map(model => String(model || '').trim()).filter(Boolean);
    }
    const profileEnv = parseModelChain(process.env[envKeyForProfile('GEMINI', profile)]);
    if (profileEnv.length) return profileEnv;
    const globalEnv = parseModelChain(process.env.GEMINI_MODEL_CHAIN);
    if (globalEnv.length) return globalEnv;
    return DEFAULT_GEMINI_MODEL_CHAINS[profile] || DEFAULT_GEMINI_MODEL_CHAINS.default;
}

function resolveOpenAIModelChain({ profile, models } = {}) {
    if (Array.isArray(models) && models.length > 0) {
        return models.map(model => String(model || '').trim()).filter(Boolean);
    }
    const profileEnv = parseModelChain(process.env[envKeyForProfile('OPENAI', profile)]);
    if (profileEnv.length) return profileEnv;
    const globalEnv = parseModelChain(process.env.OPENAI_MODEL_CHAIN);
    if (globalEnv.length) return globalEnv;
    return DEFAULT_OPENAI_MODEL_CHAINS[profile] || DEFAULT_OPENAI_MODEL_CHAINS.default;
}

async function callGeminiModel({ apiKey, model, payload, label }) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
    });
    if (!response.ok) {
        const text = await response.text();
        const err = new Error(`${label || 'gemini'} ${model} failed: ${response.status} ${text.slice(0, 500)}`);
        err.status = response.status;
        err.model = model;
        throw err;
    }
    return response.json();
}

async function callGeminiModelChain({ apiKey, profile = 'default', label = 'gemini-chain', payload, models } = {}) {
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
    const chain = resolveGeminiModelChain({ profile, models });
    let lastError = null;
    for (const model of chain) {
        try {
            const data = await callGeminiModel({ apiKey, model, payload, label });
            return { data, model };
        } catch (err) {
            lastError = err;
            console.warn(`[${label}] ${model} failed, trying next model if available: ${err.message}`);
        }
    }
    throw lastError || new Error(`[${label}] no Gemini models configured`);
}

function geminiRoleToOpenAIRole(role) {
    return role === 'model' || role === 'assistant' ? 'assistant' : 'user';
}

function openAIContentPartFromGeminiPart(part) {
    if (!part || typeof part !== 'object') return null;
    if (typeof part.text === 'string' && part.text) {
        return { type: 'input_text', text: part.text };
    }
    const inline = part.inline_data || part.inlineData;
    if (inline?.data) {
        const mimeType = inline.mime_type || inline.mimeType || 'image/jpeg';
        if (String(mimeType).startsWith('image/')) {
            return {
                type: 'input_image',
                image_url: `data:${mimeType};base64,${inline.data}`,
            };
        }
        return {
            type: 'input_text',
            text: `[${mimeType || 'media'} attachment included; if you cannot inspect it, say Shannon needs to check it manually.]`,
        };
    }
    const fileData = part.file_data || part.fileData;
    if (fileData?.file_uri || fileData?.fileUri) {
        return {
            type: 'input_text',
            text: `[media attachment included at ${fileData.file_uri || fileData.fileUri}; if you cannot inspect it, say Shannon needs to check it manually.]`,
        };
    }
    return null;
}

function convertGeminiContentsToOpenAIInput(contents) {
    return (Array.isArray(contents) ? contents : [])
        .map(item => {
            const content = (Array.isArray(item?.parts) ? item.parts : [])
                .map(openAIContentPartFromGeminiPart)
                .filter(Boolean);
            if (!content.length) return null;
            return {
                role: geminiRoleToOpenAIRole(item.role),
                content,
            };
        })
        .filter(Boolean);
}

function extractOpenAIResponseText(data) {
    if (typeof data?.output_text === 'string' && data.output_text.trim()) {
        return data.output_text;
    }
    const chunks = [];
    for (const item of data?.output || []) {
        for (const part of item?.content || []) {
            if (typeof part?.text === 'string') chunks.push(part.text);
            if (typeof part?.output_text === 'string') chunks.push(part.output_text);
        }
    }
    const text = chunks.join('');
    if (text.trim()) return text;
    return '';
}

function toOpenAIMaxOutputTokens(generationConfig = {}) {
    const raw = generationConfig.maxOutputTokens || generationConfig.max_output_tokens;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

async function callOpenAIModel({ apiKey, model, payload, label }) {
    const generationConfig = payload?.generationConfig || {};
    const input = payload?.input || convertGeminiContentsToOpenAIInput(payload?.contents);
    if (!Array.isArray(input) || input.length === 0) {
        throw new Error(`${label || 'openai'} ${model} failed: empty input`);
    }
    const body = {
        model,
        input,
    };
    const maxOutputTokens = toOpenAIMaxOutputTokens(generationConfig);
    if (maxOutputTokens) body.max_output_tokens = maxOutputTokens;
    if (generationConfig.temperature != null) body.temperature = generationConfig.temperature;
    if (payload?.text) body.text = payload.text;

    let response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    let data = await response.json().catch(async () => ({ error: { message: await response.text() } }));
    const message = data?.error?.message || '';
    if (!response.ok && body.temperature != null && /temperature|unsupported parameter|unknown parameter/i.test(message)) {
        const retryBody = { ...body };
        delete retryBody.temperature;
        response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(retryBody),
        });
        data = await response.json().catch(async () => ({ error: { message: await response.text() } }));
    }
    if (!response.ok) {
        const errorMessage = data?.error?.message || JSON.stringify(data).slice(0, 500);
        const err = new Error(`${label || 'openai'} ${model} failed: ${response.status} ${errorMessage}`);
        err.status = response.status;
        err.model = model;
        throw err;
    }
    return {
        candidates: [{
            content: { parts: [{ text: extractOpenAIResponseText(data) }] },
            finishReason: 'STOP',
        }],
        usageMetadata: {
            promptTokenCount: data?.usage?.input_tokens || null,
            candidatesTokenCount: data?.usage?.output_tokens || null,
            totalTokenCount: data?.usage?.total_tokens || null,
        },
        raw: data,
    };
}

async function callOpenAIModelChain({ apiKey, profile = 'default', label = 'openai-chain', payload, models } = {}) {
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
    const chain = resolveOpenAIModelChain({ profile, models });
    let lastError = null;
    for (const model of chain) {
        try {
            const data = await callOpenAIModel({ apiKey, model, payload, label });
            return { data, model };
        } catch (err) {
            lastError = err;
            console.warn(`[${label}] ${model} failed, trying next model if available: ${err.message}`);
        }
    }
    throw lastError || new Error(`[${label}] no OpenAI models configured`);
}

module.exports = {
    callGeminiModelChain,
    callOpenAIModelChain,
    convertGeminiContentsToOpenAIInput,
    resolveGeminiModelChain,
    resolveOpenAIModelChain,
    resolveModelChain: resolveGeminiModelChain,
};

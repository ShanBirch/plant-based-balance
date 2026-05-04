/**
 * Shared Gemini/Gemma model routing for Netlify Functions.
 *
 * Defaults optimize for near-zero spend:
 * - Try hosted Gemma 4 first where it is suitable.
 * - Fall back to Flash-Lite / Flash for reliability.
 * - Pro models are opt-in only via BALANCE_AI_ALLOW_PRO=true or an explicit
 *   profile override env var.
 */

const DEFAULT_CHAINS = {
    admin: ['gemma-4-26b-a4b-it', 'gemma-4-31b-it', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'],
    admin_pro: ['gemini-3.1-pro-preview', 'gemini-2.5-pro', 'gemini-2.5-flash'],
    coach_fallback: ['gemma-4-26b-a4b-it', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'],
    memory: ['gemma-4-26b-a4b-it', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'],
    draft_reasoning: ['gemma-4-26b-a4b-it', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'],
    general_chat: ['gemma-4-26b-a4b-it', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'],
};

const PROFILE_ENV = {
    admin: 'BALANCE_AI_ADMIN_MODELS',
    admin_pro: 'BALANCE_AI_ADMIN_PRO_MODELS',
    coach_fallback: 'BALANCE_AI_COACH_FALLBACK_MODELS',
    memory: 'BALANCE_AI_MEMORY_MODELS',
    draft_reasoning: 'BALANCE_AI_DRAFT_REASONING_MODELS',
    general_chat: 'BALANCE_AI_GENERAL_CHAT_MODELS',
};

function splitModels(value) {
    return String(value || '')
        .split(',')
        .map(model => model.trim())
        .filter(Boolean);
}

function envFlag(name, fallback = false) {
    const raw = process.env[name];
    if (raw == null || raw === '') return fallback;
    return /^(1|true|yes|on)$/i.test(String(raw).trim());
}

function allowProModels() {
    return envFlag('BALANCE_AI_ALLOW_PRO', false);
}

function getGeminiModelChain(profile = 'general_chat') {
    const override = splitModels(process.env[PROFILE_ENV[profile] || '']);
    const base = override.length ? override : (DEFAULT_CHAINS[profile] || DEFAULT_CHAINS.general_chat);
    if (allowProModels() || profile === 'admin_pro') return base;
    return base.filter(model => !/\bpro\b/i.test(model));
}

function shouldTryFallback(status, model, bodyText = '') {
    if (status === 429 || status >= 500 || status === 404) return true;
    if (String(model || '').startsWith('gemma-') && (status === 400 || status === 403)) return true;
    return /RESOURCE_EXHAUSTED|not found|not supported|not available|quota|rate limit/i.test(bodyText);
}

async function callGeminiModel({ apiKey, model, payload, timeoutMs = 25_000 }) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        const text = await response.text();
        let data = null;
        try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
        if (!response.ok) {
            const err = new Error(data?.error?.message || `Gemini ${response.status}`);
            err.status = response.status;
            err.body = text;
            err.model = model;
            throw err;
        }
        return { data, model };
    } finally {
        clearTimeout(timeout);
    }
}

async function callGeminiModelChain({
    apiKey,
    profile = 'general_chat',
    models = null,
    payload,
    timeoutMs = 25_000,
    label = profile,
}) {
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
    const chain = Array.isArray(models) && models.length ? models : getGeminiModelChain(profile);
    let lastErr = null;
    for (const model of chain) {
        try {
            const result = await callGeminiModel({ apiKey, model, payload, timeoutMs });
            console.log(`[ai-router:${label}] used ${model}`);
            return result;
        } catch (err) {
            lastErr = err;
            const status = err.status || 0;
            const body = err.body || err.message || '';
            console.warn(`[ai-router:${label}] ${model} failed (${status || err.name || 'error'}): ${String(body).slice(0, 240)}`);
            if (!shouldTryFallback(status, model, body)) throw err;
        }
    }
    throw lastErr || new Error(`No models configured for ${profile}`);
}

module.exports = {
    getGeminiModelChain,
    callGeminiModel,
    callGeminiModelChain,
};

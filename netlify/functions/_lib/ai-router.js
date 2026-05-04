/**
 * Tiny model-chain helper for Gemini API calls.
 *
 * Profiles can be overridden without code changes via:
 *   GEMINI_MODEL_CHAIN=gemini-2.5-flash,gemini-2.5-flash-lite
 *   GEMINI_MODEL_CHAIN_COACH_FALLBACK=gemini-2.5-flash
 */

const DEFAULT_MODEL_CHAINS = {
    coach_fallback: ['gemini-2.5-flash'],
    default: ['gemini-2.5-flash'],
};

function parseModelChain(value) {
    return String(value || '')
        .split(',')
        .map(model => model.trim())
        .filter(Boolean);
}

function envKeyForProfile(profile) {
    return `GEMINI_MODEL_CHAIN_${String(profile || 'default').toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
}

function resolveModelChain({ profile, models } = {}) {
    if (Array.isArray(models) && models.length > 0) {
        return models.map(model => String(model || '').trim()).filter(Boolean);
    }
    const profileEnv = parseModelChain(process.env[envKeyForProfile(profile)]);
    if (profileEnv.length) return profileEnv;
    const globalEnv = parseModelChain(process.env.GEMINI_MODEL_CHAIN);
    if (globalEnv.length) return globalEnv;
    return DEFAULT_MODEL_CHAINS[profile] || DEFAULT_MODEL_CHAINS.default;
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
    const chain = resolveModelChain({ profile, models });
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

module.exports = {
    callGeminiModelChain,
    resolveModelChain,
};

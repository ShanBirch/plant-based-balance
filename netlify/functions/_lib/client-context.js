/**
 * Shared client-context utilities for coach draft functions.
 *
 * Consumed by:
 *   - netlify/functions/instant-coach-draft.js     (client → admin DM)
 *   - netlify/functions/pb-celebration-draft.js    (client hits a PB)
 *   - netlify/functions/onboarding-welcome-draft.js (day 0 welcome)
 *   - netlify/functions/onboarding-scheduled-scan.js (days 3/7/14/30)
 *
 * Provides:
 *   - supabaseQuery: thin PostgREST wrapper
 *   - loadClientMemory / buildMemoryBlock: relationship memory for prompts
 *   - loadEditExamples: learn-from-edits corpus for the prompt
 *   - callVertexAIModel: fine-tuned Shannon voice (v7)
 *   - callGeminiFallback: Gemini 2.0 Flash for graceful degradation
 *   - stripLeadingGreeting: kills "hey Hannah," style openings (no greets)
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Fine-tuned Shannon voice model on Vertex AI (v7 — trained on 402 curated client conversations)
const VERTEX_PROJECT_ID = '103426154831';
const VERTEX_ENDPOINT_ID = '3547200982821634048';
const VERTEX_LOCATION = 'us-central1';

let _vertexAccessTokenCache = { token: null, expiresAt: 0 };

// ============================================================
// Supabase REST
// ============================================================

async function supabaseQuery(path, options = {}) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY not configured');
    }
    const url = `${SUPABASE_URL}/rest/v1/${path}`;
    const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': options.prefer || 'return=representation',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Supabase ${options.method || 'GET'} ${path} failed: ${response.status} ${text}`);
    }
    const text = await response.text();
    if (!text || text.trim() === '') return [];
    try { return JSON.parse(text); } catch { return []; }
}

// ============================================================
// Client memory (per-coach per-client relationship notes)
// See database/client_memory_migration.sql
// ============================================================

async function loadClientMemory(coachId, clientId) {
    try {
        const rows = await supabaseQuery(
            `client_memory?select=goals,communication_style,running_notes,injuries_limits,personal_context&coach_id=eq.${coachId}&client_id=eq.${clientId}&limit=1`
        );
        return rows[0] || null;
    } catch (e) {
        return null;
    }
}

/**
 * Render client_memory as a CLIENT MEMORY block that slots into Vertex prompts
 * immediately after the CLIENT: <name> line. Skips any empty fields; if the
 * whole row is empty, returns '' so callers can inject `${memoryBlock || ''}`
 * with zero regression.
 */
function buildMemoryBlock(memory) {
    if (!memory) return '';
    const parts = [];
    if (memory.goals) parts.push(`Goals: ${memory.goals}`);
    if (memory.communication_style) parts.push(`How they chat: ${memory.communication_style}`);
    if (memory.injuries_limits) parts.push(`Injuries/limits: ${memory.injuries_limits}`);
    if (memory.personal_context) parts.push(`Personal context: ${memory.personal_context}`);
    if (memory.running_notes) {
        const lines = String(memory.running_notes).split('\n').filter(l => l.trim());
        const tail = lines.slice(-10).join('\n');
        if (tail) parts.push(`Recent notes:\n${tail}`);
    }
    if (parts.length === 0) return '';
    return `\n\nCLIENT MEMORY (what you know about this client):\n${parts.join('\n')}`;
}

// ============================================================
// Learn-from-edits — pull sent messages where Shannon edited the AI draft
// ============================================================

/**
 * Returns a formatted "LEARN FROM PAST EDITS" block for inclusion in prompts.
 * Queries coach_alerts for sent, edited messages. Falls back to '' on error
 * (non-critical — the pipeline still produces usable drafts without examples).
 *
 * @param {object} opts
 * @param {string=} opts.alertType      filter e.g. 'win_to_celebrate' — omit for any type
 * @param {number=} opts.lookback       rows to fetch (default 15)
 * @param {number=} opts.max            examples to include in block (default 6)
 * @param {string=} opts.label          block header — defaults to generic wording
 */
async function loadEditExamples({ alertType = null, lookback = 15, max = 6, label = null } = {}) {
    try {
        const filter = alertType ? `&alert_type=eq.${alertType}` : '';
        const recent = await supabaseQuery(
            `coach_alerts?select=alert_type,suggested_message,data&status=eq.sent&data->>sent_message=not.is.null${filter}&order=actioned_at.desc&limit=${lookback}`
        );
        const good = recent
            .filter(e => e.data?.sent_message && e.data.sent_message !== e.suggested_message)
            .slice(0, max);
        if (good.length === 0) return '';
        const header = label || 'LEARN FROM PAST EDITS — Shannon rewrote these AI drafts into how he actually talks. Mimic the SECOND version:';
        return '\n\n' + header + '\n\n' + good.map((e, i) =>
            `Example ${i + 1}:\nAI draft: ${e.suggested_message}\nShannon rewrote it to: ${e.data.sent_message}`
        ).join('\n\n');
    } catch (e) {
        return '';
    }
}

// ============================================================
// Vertex AI (fine-tuned Shannon voice)
// ============================================================

function getGCPServiceAccount() {
    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        }
        if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PROJECT_ID) {
            return {
                client_email: process.env.FIREBASE_CLIENT_EMAIL,
                private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                project_id: process.env.FIREBASE_PROJECT_ID,
            };
        }
    } catch (e) { console.error('GCP service account parse error:', e.message); }
    return null;
}

async function getVertexAIAccessToken() {
    const now = Math.floor(Date.now() / 1000);
    if (_vertexAccessTokenCache.token && _vertexAccessTokenCache.expiresAt > now + 60) {
        return _vertexAccessTokenCache.token;
    }

    const serviceAccount = getGCPServiceAccount();
    if (!serviceAccount) throw new Error('No GCP service account configured');

    const crypto = require('crypto');
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/cloud-platform',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
    })).toString('base64url');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(serviceAccount.private_key, 'base64url');
    const jwt = `${header}.${payload}.${signature}`;

    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    });
    const tokenData = await tokenResp.json();
    if (!tokenData.access_token) throw new Error(`Vertex token exchange failed: ${JSON.stringify(tokenData)}`);

    _vertexAccessTokenCache = { token: tokenData.access_token, expiresAt: now + (tokenData.expires_in || 3600) };
    return tokenData.access_token;
}

async function callVertexAIModel(contents, generationConfig = {}) {
    const accessToken = await getVertexAIAccessToken();
    const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT_ID}/locations/${VERTEX_LOCATION}/endpoints/${VERTEX_ENDPOINT_ID}:generateContent`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents,
            generationConfig: { maxOutputTokens: 512, temperature: 0.8, ...generationConfig },
        }),
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Vertex AI call failed: ${response.status} ${errText.slice(0, 500)}`);
    }
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callGeminiFallback(contents, generationConfig = {}) {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents,
            generationConfig: { maxOutputTokens: 512, temperature: 0.8, ...generationConfig },
        }),
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini call failed: ${response.status} ${errText.slice(0, 500)}`);
    }
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ============================================================
// Text utilities
// ============================================================

/**
 * Strips robotic "hey Hannah," / "hi there" / "yo" openers. All coach
 * drafts are replies in an ongoing relationship — real greetings are
 * almost never what Shannon actually sends.
 */
function stripLeadingGreeting(text) {
    if (!text) return text;
    let out = String(text).trim();
    for (let i = 0; i < 3; i++) {
        const before = out;
        out = out.replace(/^(hey|hi|hello|yo|heya|howdy|g'day|gday|oi)\b[^\n.!?]*?[,!\-—:]\s*/i, '');
        out = out.replace(/^(hey|hi|hello|yo)\s+(?=[a-z])/i, '');
        if (out === before) break;
    }
    out = out.trim();
    if (out && /^[A-Z][a-z]/.test(out) && /[a-z]/.test(text)) {
        out = out[0].toLowerCase() + out.slice(1);
    }
    return out || text;
}

function truncate(s, n) {
    if (!s) return '';
    return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

module.exports = {
    // constants (exposed for tests / scripts)
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    GEMINI_API_KEY,
    VERTEX_PROJECT_ID,
    VERTEX_ENDPOINT_ID,
    VERTEX_LOCATION,
    // utilities
    supabaseQuery,
    loadClientMemory,
    buildMemoryBlock,
    loadEditExamples,
    callVertexAIModel,
    callGeminiFallback,
    stripLeadingGreeting,
    truncate,
};

/**
 * Extract Client Memory — Event-Driven Function
 *
 * Fires each time a coach_alerts row flips from status='pending' to 'sent'
 * with a captured sent_message (see database/client_memory_extraction_trigger.sql).
 *
 * Given the conversation turn (client message + coach reply) and the coach's
 * existing memory of the client, ask Gemini 2.0 Flash to return any NEW facts
 * worth remembering. Merge them into `client_memory`:
 *   - new_notes get prefixed with [YYYY-MM-DD] and appended to running_notes
 *     (capped at 50 lines — oldest dropped)
 *   - goal_updates / style_updates / injury_updates / personal_context_updates
 *     REPLACE the existing field when non-null (because the extractor is told
 *     to return the full new value, not a delta).
 *
 * Uses Gemini 2.0 Flash rather than the fine-tuned Shannon-voice Vertex v7 —
 * this is extraction, not composition. Cheap, deterministic (temp 0.2), and
 * returns structured JSON.
 *
 * Fire-and-forget — the coach_alert is already marked sent by the time this
 * runs, so any failure here is non-critical (memory simply doesn't update).
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const GEMINI_MODEL = 'gemini-2.0-flash';
const RUNNING_NOTES_CAP = 50;          // max lines kept in running_notes

async function supabaseQuery(path, options = {}) {
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
// Gemini — structured JSON extraction
// ============================================================

async function callGeminiJSON(prompt) {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                maxOutputTokens: 512,
                temperature: 0.2,
                responseMimeType: 'application/json',
            },
        }),
    });
    if (!response.ok) {
        const t = await response.text();
        throw new Error(`Gemini call failed: ${response.status} ${t.slice(0, 500)}`);
    }
    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!raw) return {};
    try { return JSON.parse(raw); }
    catch (e) {
        // Sometimes the model wraps in markdown despite responseMimeType. Strip and retry.
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
        try { return JSON.parse(cleaned); } catch { return {}; }
    }
}

// ============================================================
// Building extractor prompt
// ============================================================

function tailLines(text, n) {
    if (!text) return '';
    const lines = String(text).split('\n').filter(l => l.trim());
    return lines.slice(-n).join('\n');
}

function buildExtractorPrompt({ clientName, existing, clientMessage, sentMessage, recentHistory }) {
    const lastNotes = tailLines(existing.running_notes, 10) || '(none)';
    const history = recentHistory && recentHistory.length
        ? recentHistory.map(m => `${m.isClient ? clientName : 'Coach'}: ${m.message}`).join('\n')
        : '(no prior messages)';

    return `You are a memory extractor for a fitness coach. Your job is to pull out NEW facts worth remembering about a client based on the latest conversation turn. Don't re-record things already in existing memory. Don't be chatty — be factual and terse, like a coach's own shorthand.

EXISTING MEMORY FOR ${clientName}:
Goals: ${existing.goals || '(none)'}
Communication style: ${existing.communication_style || '(none)'}
Injuries / limits: ${existing.injuries_limits || '(none)'}
Personal context: ${existing.personal_context || '(none)'}
Recent notes (last 10 lines):
${lastNotes}

RECENT CONVERSATION (newest last):
${history}

LATEST TURN:
${clientName}: "${clientMessage || '(no incoming message — this was a proactive coach reach-out)'}"
Coach replied: "${sentMessage}"

Return ONLY valid JSON with this exact shape. Omit any field you have nothing to add for — only include fields that have new info. Use null (not "") when a string field is intentionally empty.

{
  "new_notes": ["terse observation in coach shorthand, no full sentences needed"],
  "goal_updates": "the COMPLETE updated goals string if goals changed, otherwise omit",
  "style_updates": "the COMPLETE updated communication_style if any new signal, otherwise omit",
  "injury_updates": "the COMPLETE updated injuries_limits if mentioned, otherwise omit",
  "personal_context_updates": "the COMPLETE updated personal_context if mentioned, otherwise omit"
}

Rules:
- new_notes entries should be short fragments like "ran 5k sat morning", "interview tuesday, stressed", "moved to Sydney"
- Empty result = {} (no new facts worth capturing)
- Do NOT include facts already in existing memory above
- Goal/style/injury/personal_context fields REPLACE the whole field when provided — return the full merged text including prior info, not just the delta
- Never fabricate. Only extract what's explicitly in the conversation.`;
}

// ============================================================
// Merge extracted facts into existing memory row
// ============================================================

function mergeMemory(existing, extracted) {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const next = {
        goals: existing.goals || null,
        communication_style: existing.communication_style || null,
        running_notes: existing.running_notes || null,
        injuries_limits: existing.injuries_limits || null,
        personal_context: existing.personal_context || null,
    };
    let changed = false;

    if (Array.isArray(extracted.new_notes) && extracted.new_notes.length > 0) {
        const newLines = extracted.new_notes
            .map(n => String(n).trim())
            .filter(Boolean)
            .map(n => `[${dateStr}] ${n}`);
        if (newLines.length > 0) {
            const existingLines = (next.running_notes ? next.running_notes.split('\n') : [])
                .map(l => l.trim())
                .filter(Boolean);
            const merged = existingLines.concat(newLines);
            const capped = merged.slice(Math.max(0, merged.length - RUNNING_NOTES_CAP));
            next.running_notes = capped.join('\n');
            changed = true;
        }
    }

    const fieldMap = {
        goal_updates: 'goals',
        style_updates: 'communication_style',
        injury_updates: 'injuries_limits',
        personal_context_updates: 'personal_context',
    };
    for (const [fromKey, toKey] of Object.entries(fieldMap)) {
        const val = extracted[fromKey];
        if (typeof val === 'string' && val.trim() && val !== next[toKey]) {
            next[toKey] = val.trim();
            changed = true;
        }
    }

    return { next, changed };
}

// ============================================================
// Main handler
// ============================================================

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured' }) };
    }
    if (!GEMINI_API_KEY) {
        console.warn('[extract-memory] GEMINI_API_KEY missing — skipping');
        return { statusCode: 200, body: JSON.stringify({ skipped: 'no_gemini_key' }) };
    }

    let payload;
    try { payload = JSON.parse(event.body); }
    catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    const { alertId } = payload;
    if (!alertId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing alertId' }) };
    }

    // 1. Load the alert
    const alerts = await supabaseQuery(
        `coach_alerts?select=id,client_id,client_name,coach_id,alert_type,suggested_message,data&id=eq.${alertId}&limit=1`
    );
    const alert = alerts[0];
    if (!alert) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Alert not found' }) };
    }
    if (!alert.coach_id || !alert.client_id) {
        return { statusCode: 200, body: JSON.stringify({ skipped: 'missing_ids' }) };
    }

    const sentMessage = alert.data?.sent_message;
    if (!sentMessage) {
        return { statusCode: 200, body: JSON.stringify({ skipped: 'no_sent_message' }) };
    }

    const clientMessage = alert.data?.message_preview || '';

    // 2. Load recent nudges between client & coach for conversational context
    let recentHistory = [];
    try {
        const history = await supabaseQuery(
            `nudges?select=sender_id,message,created_at&or=(and(sender_id.eq.${alert.client_id},receiver_id.eq.${alert.coach_id}),and(sender_id.eq.${alert.coach_id},receiver_id.eq.${alert.client_id}))&order=created_at.desc&limit=8`
        );
        recentHistory = history.reverse().map(m => ({
            isClient: m.sender_id === alert.client_id,
            message: m.message,
        }));
    } catch (e) { /* non-critical */ }

    // 3. Load existing client_memory row (or treat as empty)
    let existing = {
        goals: null,
        communication_style: null,
        running_notes: null,
        injuries_limits: null,
        personal_context: null,
    };
    try {
        const rows = await supabaseQuery(
            `client_memory?select=*&coach_id=eq.${alert.coach_id}&client_id=eq.${alert.client_id}&limit=1`
        );
        if (rows[0]) {
            existing = {
                goals: rows[0].goals || null,
                communication_style: rows[0].communication_style || null,
                running_notes: rows[0].running_notes || null,
                injuries_limits: rows[0].injuries_limits || null,
                personal_context: rows[0].personal_context || null,
            };
        }
    } catch (e) { /* treat as empty */ }

    // 4. Call Gemini for extraction
    const clientName = alert.client_name || 'client';
    let extracted = {};
    try {
        const prompt = buildExtractorPrompt({
            clientName,
            existing,
            clientMessage,
            sentMessage,
            recentHistory,
        });
        extracted = await callGeminiJSON(prompt);
    } catch (err) {
        console.error('[extract-memory] Gemini failed:', err.message);
        return { statusCode: 200, body: JSON.stringify({ skipped: 'gemini_failed' }) };
    }

    // 5. Merge
    const { next, changed } = mergeMemory(existing, extracted);
    if (!changed) {
        console.log(`[extract-memory] nothing to update for alert ${alertId}`);
        return { statusCode: 200, body: JSON.stringify({ skipped: 'no_new_facts' }) };
    }

    // 6. Upsert client_memory
    try {
        await supabaseQuery('client_memory?on_conflict=coach_id,client_id', {
            method: 'POST',
            prefer: 'return=minimal,resolution=merge-duplicates',
            body: [{
                coach_id: alert.coach_id,
                client_id: alert.client_id,
                goals: next.goals,
                communication_style: next.communication_style,
                running_notes: next.running_notes,
                injuries_limits: next.injuries_limits,
                personal_context: next.personal_context,
            }],
        });
        console.log(`[extract-memory] updated memory for coach=${alert.coach_id} client=${alert.client_id}`);
    } catch (err) {
        console.error('[extract-memory] upsert failed:', err.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Upsert failed', details: err.message }) };
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            updated: true,
            fields_changed: Object.entries(next).filter(([k, v]) => v !== existing[k]).map(([k]) => k),
        }),
    };
};

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

// gemini-2.5-flash — current GA model. 2.0-flash is now deprecated for paid
// keys (returns 429 RESOURCE_EXHAUSTED disguised as a rate limit).
const GEMINI_MODEL = 'gemini-2.5-flash';
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
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const raw = parts.map(p => p?.text || '').join('');
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
        console.warn(`[extract-memory] finishReason=${candidate.finishReason} partCount=${parts.length} textLen=${raw.length}`);
    }
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

    // Unified conversation view — full history with the latest turn appended,
    // so the extractor sees corrections/confirmations in their proper order.
    // The extractor needs BOTH sides to understand context, but must be
    // disciplined about WHICH statements become facts about the client.
    // When the history mixes in-app DMs with linked IG/Messenger messages,
    // we tag each line with [App] or [IG] so the model treats them as one
    // continuous relationship rather than two separate threads.
    const hasMixedSources = (recentHistory || []).some(m => m.source === 'ig')
        && (recentHistory || []).some(m => m.source === 'app');
    const priorLines = (recentHistory && recentHistory.length)
        ? recentHistory.map(m => {
            const speaker = m.isClient ? clientName : 'Coach';
            const channelTag = hasMixedSources && m.source
                ? (m.source === 'ig' ? ' [IG]' : ' [App]')
                : '';
            return `${speaker}${channelTag}: ${m.message}`;
        })
        : [];
    const turnLines = [];
    if (clientMessage) turnLines.push(`${clientName}: ${clientMessage}`);
    if (sentMessage)   turnLines.push(`Coach: ${sentMessage}`);
    const conversation = [...priorLines, ...turnLines].join('\n') || '(no messages)';

    return `You extract durable facts about a fitness coaching client from chat transcripts. Read the WHOLE conversation (both sides) to understand context — but apply strict rules for what actually becomes a stored fact.

CLIENT NAME: ${clientName}

EXISTING MEMORY (do NOT duplicate anything already captured here):
Goals: ${existing.goals || '(none)'}
Communication style: ${existing.communication_style || '(none)'}
Injuries / limits: ${existing.injuries_limits || '(none)'}
Personal context: ${existing.personal_context || '(none)'}
Recent notes (last 10 lines):
${lastNotes}

CONVERSATION (oldest → newest, full history. "Coach" is Shannon; the other speaker is ${clientName}):
${conversation}

══════════════════════════════════════════════════════════════
FACT RULES — what becomes a stored fact vs. what does NOT:

✓ FACT: Something ${clientName} explicitly SAID about themselves
    e.g. "I've lost weight", "my knee hurts", "I'm vegan"
✓ FACT: Something ${clientName} explicitly CONFIRMED when Shannon asked
    e.g. Shannon: "Vegan hey?" → Client: "Yep vegan" → "vegan" IS a fact
✓ FACT: Strong pattern of communication style visible across multiple messages
    (emoji use, message length, tone, humor style)
✓ FACT: Concrete practical context the client explicitly shared that would prevent Shannon from re-asking later
    e.g. pets and pet toys, gym/home equipment, app/device setup, food/cooking setup, routines, access, preferences, plans, named people, places

✗ NOT A FACT: Anything Shannon ASSUMED, ASKED, or GUESSED that the client did NOT confirm
    e.g. Shannon: "Vegan hey?" → Client: "no not vegan, I eat everything" → "vegan" is NOT a fact. The correction IS. Record "omnivore" / "eats everything", not "vegan"
✗ NOT A FACT: Shannon's advice / suggestions / coaching prompts
    e.g. Shannon: "try upper body tomorrow" — that's coaching, not a fact about the client
✗ NOT A FACT: Things Shannon said about himself or unrelated to the client
✗ NOT A FACT: Speculation ("sounds like she's stressed" — unless client said they're stressed)

CORRECTIONS WIN: If the client later corrects or contradicts something earlier in the conversation (from either side), always follow the correction. The newest client statement on a topic is the truth.

══════════════════════════════════════════════════════════════

Return ONLY valid JSON. Omit any field with nothing new to say — only include fields that changed. Never fabricate.

MEMORY QUALITY PRIORITY: Shannon wants memory that prevents dumb repeat questions. Capture small but useful details the client explicitly shares: available equipment, tools/toys/pet details, app/device state, food/cooking setup, household setup, routines, upcoming plans, preferences, things already tried, and what worked or did not work. If a future reply should treat it as known, store it.

PERSONAL CONTEXT PRIORITY: Shannon wants durable human details, not just fitness facts. Capture work/study, shift rhythm, partner/kids/family members and names, dogs/pets and names, household setup, location, cooking/food setup, support network, what they genuinely love, what ticks them off or stresses them, hobbies, sport/training background, and real-life routine when the client explicitly shares them. These belong in personal_context_updates and concise dated new_notes. Never invent names, relationships, loves, or frustrations from Shannon's questions.

{
  "new_notes": ["terse coach-shorthand observation, no full sentences"],
  "goal_updates": "COMPLETE updated goals string (if client newly stated/confirmed a goal), otherwise omit",
  "style_updates": "COMPLETE updated communication_style string (only after you've seen ≥3 client messages showing the pattern), otherwise omit",
  "injury_updates": "COMPLETE updated injuries_limits string (only if client mentioned), otherwise omit",
  "personal_context_updates": "COMPLETE updated personal_context string with human-life details like work, family, dogs/pets, household, location, food setup, support, routine, what they love, what ticks them off/stresses them (only if client mentioned), otherwise omit"
}

Examples of good new_notes:
  "ran 5k sat morning, felt strong"
  "job interview tuesday, stressed"
  "moved to Sydney"
  "dog is Milo, morning walks most days"
  "puppy Teddy likes bouncy balls; use as known toy context"
  "has adjustable dumbbells and bench at home"
  "old iPhone blocks banking access"
  "partner Jess works nights, dinners are usually solo"
  "loves weekend hikes and cooking for her kids"
  "gets annoyed by diet culture and boring meal prep"
  "corrected quiz: omnivore, NOT vegan"

Examples of BAD extraction to avoid:
  ✗ "vegan" (when Shannon asked "vegan hey?" but client corrected)
  ✗ "needs upper body tomorrow" (that's Shannon's suggestion, not a fact about client)
  ✗ "stressed" (if Shannon inferred it but client didn't confirm)

Empty result {} is the correct output if nothing new worth storing.`;
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

    // 2. Load recent nudges between client & coach for conversational context.
    //    If the client has a linked IG/FB thread, also pull recent IG messages
    //    so the extractor sees one continuous timeline across channels —
    //    keeps memory in sync no matter which surface the conversation
    //    happened on.
    let recentHistory = [];
    try {
        const HISTORY_LIMIT = 8;
        const [appHistory, igThreads] = await Promise.all([
            supabaseQuery(
                `nudges?select=sender_id,message,created_at&or=(and(sender_id.eq.${alert.client_id},receiver_id.eq.${alert.coach_id}),and(sender_id.eq.${alert.coach_id},receiver_id.eq.${alert.client_id}))&order=created_at.desc&limit=${HISTORY_LIMIT}`
            ),
            supabaseQuery(
                `ig_threads?select=id&linked_user_id=eq.${alert.client_id}&coach_id=eq.${alert.coach_id}&limit=3`
            ).catch(() => []),
        ]);
        const appMessages = appHistory.map(m => ({
            isClient: m.sender_id === alert.client_id,
            message: m.message,
            created_at: m.created_at,
            source: 'app',
        }));
        let igMessages = [];
        const threadIds = (igThreads || []).map(t => t.id).filter(Boolean);
        if (threadIds.length > 0) {
            const idFilter = threadIds.map(id => `"${id}"`).join(',');
            try {
                const igRows = await supabaseQuery(
                    `ig_messages?select=thread_id,direction,text,created_at&thread_id=in.(${idFilter})&order=created_at.desc&limit=${HISTORY_LIMIT}`
                );
                igMessages = igRows.map(m => ({
                    isClient: m.direction === 'in',
                    message: String(m.text || '')
                        .replace(/\[PHOTO:https?:\/\/[^\s\]]+\]/gi, '[photo]')
                        .replace(/\[AUDIO:https?:\/\/[^\s\]]+\]/gi, '[voice note]')
                        .replace(/\[(?:VIDEO|video):\s*https?:\/\/[^\]]+\]/gi, '[video]'),
                    created_at: m.created_at,
                    source: 'ig',
                }));
            } catch (e) { /* non-critical */ }
        }
        recentHistory = appMessages.concat(igMessages)
            .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
            .slice(-HISTORY_LIMIT);
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

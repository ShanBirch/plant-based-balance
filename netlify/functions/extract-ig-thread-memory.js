/**
 * Extract IG Thread Memory — Cron-Scheduled Function
 *
 * Mirror of extract-client-memory.js but scoped to ig_threads (cold IG/FB
 * leads who haven't signed up to the app yet). Runs every 4 hours; for each
 * thread with new inbound activity since its last extraction, asks Gemini to
 * pull durable facts out of the recent conversation and updates the thread's
 * memory columns.
 *
 * Storage: same column shape as client_memory so buildMemoryBlock works
 * unchanged on either source. The IG-draft prompt prefers client_memory
 * (when the lead has linked_user_id) and falls back to these thread-level
 * fields for cold leads.
 *
 * Schedule: see netlify.toml [functions."extract-ig-thread-memory"].
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// gemini-2.5-flash — current GA model. 2.0-flash is now deprecated for paid
// keys (returns 429 RESOURCE_EXHAUSTED disguised as a rate limit).
const GEMINI_MODEL = 'gemini-2.5-flash';
const RUNNING_NOTES_CAP = 50;          // max lines kept in running_notes
const HISTORY_LOOKBACK = 30;           // recent ig_messages to feed into the prompt
const EXTRACT_AFTER_HOURS = 0;         // 0 = always run for any thread with new inbound; bump if too aggressive
const MAX_THREADS_PER_RUN = 30;        // cap so a single cron firing doesn't burn quota

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
    if (!text || !text.trim()) return [];
    try { return JSON.parse(text); } catch { return []; }
}

async function callGeminiJSON(prompt) {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                maxOutputTokens: 1024,
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
    const raw = parts.filter(p => p && p.thought !== true).map(p => p?.text || '').join('');
    if (!raw) return {};
    try { return JSON.parse(raw); }
    catch {
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
        try { return JSON.parse(cleaned); } catch { return {}; }
    }
}

function tailLines(text, n) {
    if (!text) return '';
    const lines = String(text).split('\n').filter(l => l.trim());
    return lines.slice(-n).join('\n');
}

function stripPhotoMarkers(text) {
    if (!text) return text;
    return String(text).replace(/\[PHOTO:https?:\/\/[^\s\]]+\]/gi, '[photo]');
}

function buildExtractorPrompt({ leadName, channel, leadStage, existing, conversation }) {
    const lastNotes = tailLines(existing.running_notes, 15) || '(none)';
    const channelLabel = channel === 'messenger' ? 'Facebook Messenger' : 'Instagram';
    return `You extract durable facts about an inbound coaching lead from their ${channelLabel} DM transcripts. Read the full conversation (both sides) for context — but apply strict rules for what becomes a stored fact.

LEAD: ${leadName}
CHANNEL: ${channelLabel}
FUNNEL STAGE: ${leadStage || 'new'}

EXISTING MEMORY (do NOT duplicate anything already captured here):
Goals: ${existing.goals || '(none)'}
Communication style: ${existing.communication_style || '(none)'}
Injuries / limits: ${existing.injuries_limits || '(none)'}
Personal context: ${existing.personal_context || '(none)'}
Recent notes (last 15 lines):
${lastNotes}

CONVERSATION (oldest → newest. "Coach" is Shannon; the other speaker is ${leadName}):
${conversation}

══════════════════════════════════════════════════════════════
FACT RULES — what becomes a stored fact vs. what does NOT:

✓ FACT: Something ${leadName} explicitly SAID about themselves
    e.g. "I run 5k three times a week", "I'm vegan", "I work in finance"
✓ FACT: Something ${leadName} explicitly CONFIRMED when Shannon asked
    e.g. Shannon: "Vegan hey?" → Lead: "Yep vegan" → "vegan" IS a fact
✓ FACT: Strong pattern of communication style (emoji use, message length,
    tone) visible across multiple of THEIR messages
✓ FACT: Funnel signal — they said they're keen on the challenge / asked about
    pricing / hesitating because of X / etc. Treat as personal_context.

✗ NOT A FACT: Anything Shannon ASSUMED, ASKED, or GUESSED that the lead did NOT confirm
    e.g. Shannon: "Vegan hey?" → Lead: "no I eat everything" → "vegan" is NOT a fact. The correction IS — record "omnivore"
✗ NOT A FACT: Shannon's pitches / suggestions / coaching prompts
✗ NOT A FACT: Things Shannon said about himself or unrelated to the lead
✗ NOT A FACT: Speculation / interpretation Shannon made about the lead

CORRECTIONS WIN: If the lead later corrects or contradicts something earlier in the conversation, always follow the correction. Newest statement on a topic is the truth.

══════════════════════════════════════════════════════════════

Return ONLY valid JSON. Omit any field with nothing new to say. Never fabricate.

{
  "new_notes": ["terse coach-shorthand observation, no full sentences"],
  "goal_updates": "COMPLETE updated goals string (only if lead newly stated/confirmed a goal), otherwise omit",
  "style_updates": "COMPLETE updated communication_style string (only after ≥3 lead messages show the pattern), otherwise omit",
  "injury_updates": "COMPLETE updated injuries_limits string (only if lead mentioned), otherwise omit",
  "personal_context_updates": "COMPLETE updated personal_context string (lifestyle/job/family/funnel signals only if lead mentioned), otherwise omit"
}

Examples of good new_notes:
  "asked about plant-based meal plan tue"
  "lives in Colorado, works estate planning"
  "interested in vegan challenge, hasn't committed yet"
  "corrects: started lifting 4 months ago, not 2"

Empty {} is the correct output if nothing new worth storing.`;
}

function mergeMemory(existing, extracted) {
    const dateStr = new Date().toISOString().slice(0, 10);
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
                .map(l => l.trim()).filter(Boolean);
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

async function processThread(thread) {
    const messages = await supabaseQuery(
        `ig_messages?select=direction,text,created_at&thread_id=eq.${thread.id}&order=created_at.asc&limit=${HISTORY_LOOKBACK}`
    );
    if (messages.length === 0) return { skipped: 'no_messages' };

    const leadName = thread.profile_name && !/\{\{[^}]+\}\}/.test(thread.profile_name)
        ? thread.profile_name
        : (thread.ig_username || 'Lead');

    const conversation = messages.map(m => {
        const speaker = m.direction === 'in' ? leadName : 'Coach';
        return `${speaker}: ${stripPhotoMarkers(m.text)}`;
    }).join('\n');

    const prompt = buildExtractorPrompt({
        leadName,
        channel: thread.channel,
        leadStage: thread.lead_stage,
        existing: thread,
        conversation,
    });

    let extracted;
    try {
        extracted = await callGeminiJSON(prompt);
    } catch (err) {
        console.warn(`[ig-memory] thread ${thread.id} extraction failed: ${err.message}`);
        return { error: err.message };
    }

    const { next, changed } = mergeMemory(thread, extracted);

    // Always update last_memory_extracted_at so we don't re-process unchanged
    // threads on the next cron firing -- only the AI summarised them, even
    // if nothing new came out of it.
    const patch = {
        last_memory_extracted_at: new Date().toISOString(),
    };
    if (changed) {
        patch.goals = next.goals;
        patch.communication_style = next.communication_style;
        patch.running_notes = next.running_notes;
        patch.injuries_limits = next.injuries_limits;
        patch.personal_context = next.personal_context;
    }

    try {
        await supabaseQuery(`ig_threads?id=eq.${thread.id}`, {
            method: 'PATCH',
            body: patch,
            prefer: 'return=minimal',
        });
    } catch (err) {
        console.warn(`[ig-memory] thread ${thread.id} update failed: ${err.message}`);
        return { error: err.message };
    }

    return { changed, fields: Object.keys(extracted) };
}

exports.handler = async (event) => {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured' }) };
    }
    if (!GEMINI_API_KEY) {
        console.warn('[ig-memory] GEMINI_API_KEY missing — skipping');
        return { statusCode: 200, body: JSON.stringify({ skipped: 'no_gemini_key' }) };
    }

    // Find threads with inbound activity since their last extraction. Anything
    // never extracted has last_memory_extracted_at = NULL and matches the
    // is.null condition. The PostgREST `or=` lets us combine "never extracted"
    // OR "extracted but new inbound since" in one query.
    const cutoff = EXTRACT_AFTER_HOURS > 0
        ? new Date(Date.now() - EXTRACT_AFTER_HOURS * 60 * 60 * 1000).toISOString()
        : null;

    let threadsQuery =
        `ig_threads?select=id,channel,profile_name,ig_username,lead_stage,goals,communication_style,running_notes,injuries_limits,personal_context,last_memory_extracted_at,last_inbound_at` +
        `&last_inbound_at=not.is.null` +
        `&or=(last_memory_extracted_at.is.null,last_inbound_at.gt.last_memory_extracted_at)` +
        `&order=last_inbound_at.desc` +
        `&limit=${MAX_THREADS_PER_RUN}`;
    if (cutoff) {
        threadsQuery += `&last_inbound_at=gte.${cutoff}`;
    }

    let threads;
    try {
        threads = await supabaseQuery(threadsQuery);
    } catch (err) {
        console.error('[ig-memory] thread query failed:', err.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Thread query failed' }) };
    }

    console.log(`[ig-memory] processing ${threads.length} threads`);
    let processed = 0, changed = 0, errors = 0;
    for (const thread of threads) {
        const result = await processThread(thread);
        processed++;
        if (result.error) errors++;
        if (result.changed) changed++;
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ processed, changed, errors, total_candidates: threads.length }),
    };
};

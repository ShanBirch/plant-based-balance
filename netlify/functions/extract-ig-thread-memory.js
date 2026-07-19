/**
 * Extract IG Thread Memory — Cron-Scheduled Function
 *
 * Mirror of extract-client-memory.js but scoped to ig_threads (cold IG/FB
 * leads who haven't signed up to the app yet). Runs every 4 hours; for each
 * thread with new inbound activity since its last extraction, asks Gemini to
 * compress the complete canonical conversation history into durable facts and
 * a relationship summary, then incrementally fold in later messages.
 *
 * Storage: same column shape as client_memory so buildMemoryBlock works
 * unchanged on either source. The IG-draft prompt prefers client_memory
 * (when the lead has linked_user_id) and falls back to these thread-level
 * fields for cold leads.
 *
 * The scheduled dispatcher invokes extract-ig-thread-memory-background so a
 * full-history bootstrap has Netlify's background-function execution window.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const { callOpenAIModelChain } = require('./_lib/ai-router');

// gemini-2.5-flash — current GA model. 2.0-flash is now deprecated for paid
// keys (returns 429 RESOURCE_EXHAUSTED disguised as a rate limit).
const GEMINI_MODEL = 'gemini-2.5-flash';
const RUNNING_NOTES_CAP = 50;          // max lines kept in running_notes
const HISTORY_PAGE_SIZE = 500;         // paginate until the canonical history is exhausted
const MEMORY_BATCH_SIZE = 80;          // bounded model input, carried forward as a rolling summary
const RELATIONSHIP_MEMORY_VERSION = 2;
const THREAD_SCAN_PAGE_SIZE = 200;
const EXTRACT_AFTER_HOURS = 0;         // 0 = always run for any thread with new inbound; bump if too aggressive
const MAX_THREADS_PER_RUN = 30;        // cap so a single cron firing doesn't burn quota

function envFlagEnabled(value) {
    return ['1', 'true', 'yes', 'on', 'enabled'].includes(String(value || '').trim().toLowerCase());
}

function shouldUseOpenAIPrimary() {
    const provider = String(process.env.AI_PROVIDER || process.env.MODEL_PROVIDER || '').trim().toLowerCase();
    return provider === 'openai'
        || envFlagEnabled(process.env.GEMINI_DISABLED)
        || envFlagEnabled(process.env.GOOGLE_AI_DISABLED);
}

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

function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

async function loadEveryPage(basePath, pageSize = HISTORY_PAGE_SIZE) {
    const rows = [];
    for (let offset = 0; ; offset += pageSize) {
        const page = await supabaseQuery(`${basePath}&limit=${pageSize}&offset=${offset}`);
        rows.push(...page);
        if (page.length < pageSize) break;
    }
    return rows;
}

function needsMemoryExtraction(thread) {
    if (!thread?.last_inbound_at) return false;
    const compaction = safeObject(safeObject(thread.custom_data).relationship_memory_compaction);
    if (Number(compaction.version || 0) < RELATIONSHIP_MEMORY_VERSION) return true;
    if (!thread.last_memory_extracted_at) return true;
    const inboundAt = Date.parse(thread.last_inbound_at);
    const extractedAt = Date.parse(thread.last_memory_extracted_at);
    return Number.isFinite(inboundAt)
        && (!Number.isFinite(extractedAt) || inboundAt > extractedAt);
}

async function loadCandidateThreads(cutoff = null) {
    const candidates = [];
    const select = 'id,channel,profile_name,ig_username,lead_stage,goals,communication_style,running_notes,injuries_limits,personal_context,last_memory_extracted_at,last_inbound_at,linked_user_id,coach_id,custom_data';
    const cutoffFilter = cutoff ? `&last_inbound_at=gte.${encodeURIComponent(cutoff)}` : '';
    for (let offset = 0; candidates.length < MAX_THREADS_PER_RUN; offset += THREAD_SCAN_PAGE_SIZE) {
        const page = await supabaseQuery(
            `ig_threads?select=${select}&last_inbound_at=not.is.null${cutoffFilter}&order=last_inbound_at.desc,id.asc&limit=${THREAD_SCAN_PAGE_SIZE}&offset=${offset}`
        );
        candidates.push(...page.filter(needsMemoryExtraction));
        if (page.length < THREAD_SCAN_PAGE_SIZE) break;
    }
    return candidates.slice(0, MAX_THREADS_PER_RUN);
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
                maxOutputTokens: 1536,
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

function buildMemoryPayload(prompt) {
    return {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            maxOutputTokens: 1536,
            temperature: 0.2,
            responseMimeType: 'application/json',
        },
    };
}

function parseMemoryJson(raw) {
    if (!raw) return {};
    try { return JSON.parse(raw); }
    catch {
        const cleaned = String(raw).replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
        try { return JSON.parse(cleaned); } catch { return {}; }
    }
}

function extractCandidateText(data) {
    const candidate = data?.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    return parts.filter(p => p && p.thought !== true).map(p => p?.text || '').join('');
}

async function callOpenAIJSON(prompt) {
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');
    const { data } = await callOpenAIModelChain({
        apiKey: OPENAI_API_KEY,
        profile: 'default',
        label: 'extract-ig-thread-memory-openai',
        payload: buildMemoryPayload(prompt),
    });
    return parseMemoryJson(extractCandidateText(data));
}

async function callMemoryJSON(prompt) {
    let geminiError = null;
    if (GEMINI_API_KEY && !shouldUseOpenAIPrimary()) {
        try {
            return await callGeminiJSON(prompt);
        } catch (err) {
            geminiError = err;
            if (!OPENAI_API_KEY) throw err;
            console.warn(`[ig-memory] Gemini failed, falling back to OpenAI: ${err.message}`);
        }
    }
    if (OPENAI_API_KEY) return callOpenAIJSON(prompt);
    throw geminiError || new Error('No AI key configured for IG memory extraction');
}

function tailLines(text, n) {
    if (!text) return '';
    const lines = String(text).split('\n').filter(l => l.trim());
    return lines.slice(-n).join('\n');
}

function stripPhotoMarkers(text) {
    if (!text) return text;
    return String(text)
        .replace(/\[PHOTO:https?:\/\/[^\s\]]+\]/gi, '[photo]')
        .replace(/\[AUDIO:https?:\/\/[^\s\]]+\]/gi, '[voice note]')
        .replace(/\[(?:VIDEO|video):\s*https?:\/\/[^\]]+\]/gi, '[video]');
}

function buildExtractorPrompt({ leadName, channel, leadStage, existing, existingRelationshipSummary = '', conversation }) {
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

COMPRESSED UNDERSTANDING OF EARLIER CONVERSATIONS:
${existingRelationshipSummary || '(none yet, this may be the full-history bootstrap)'}

CONVERSATION BATCH (oldest → newest. "Coach" is Shannon; the other speaker is ${leadName}):
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
✓ FACT: Concrete practical context the lead explicitly shared that would prevent Shannon from re-asking later
    e.g. pets and pet toys, gym/home equipment, app/device setup, food/cooking setup, routines, access, preferences, plans, named people, places

✗ NOT A FACT: Anything Shannon ASSUMED, ASKED, or GUESSED that the lead did NOT confirm
    e.g. Shannon: "Vegan hey?" → Lead: "no I eat everything" → "vegan" is NOT a fact. The correction IS — record "omnivore"
✗ NOT A FACT: Shannon's pitches / suggestions / coaching prompts
✗ NOT A FACT: Things Shannon said about himself or unrelated to the lead
✗ NOT A FACT: Speculation / interpretation Shannon made about the lead

CORRECTIONS WIN: If the lead later corrects or contradicts something earlier in the conversation, always follow the correction. Newest statement on a topic is the truth.

══════════════════════════════════════════════════════════════

Return ONLY valid JSON. Omit any field with nothing new to say. Never fabricate.

RELATIONSHIP SUMMARY PRIORITY: Return one COMPLETE replacement summary that combines the earlier compressed understanding with this batch. It should help Shannon remember who this person is and what their previous conversations were about without treating old topics as an active agenda. Preserve meaningful conversation themes, decisions, corrections, promises, boundaries, what was offered or declined, support issues and outcomes, and genuine open loops. Attribute facts correctly. Keep it concise, specific, and under 1,800 characters.

MEMORY QUALITY PRIORITY: Shannon wants memory that prevents dumb repeat questions. Capture small but useful details the lead explicitly shares: available equipment, tools/toys/pet details, app/device state, food/cooking setup, household setup, routines, upcoming plans, preferences, things already tried, and what worked or did not work. If a future reply should treat it as known, store it.

PERSONAL CONTEXT PRIORITY: Shannon wants durable human details, not just funnel facts. Capture work/study, shift rhythm, partner/kids/family members and names, dogs/pets and names, household setup, location, cooking/food setup, support network, what they genuinely love, what ticks them off or stresses them, hobbies, sport/training background, real-life routine, and challenge hesitation when the lead explicitly shares them. These belong in personal_context_updates and concise dated new_notes. Never invent names, relationships, loves, or frustrations from Shannon's questions.

{
  "new_notes": ["terse coach-shorthand observation, no full sentences"],
  "goal_updates": "COMPLETE updated goals string (only if lead newly stated/confirmed a goal), otherwise omit",
  "style_updates": "COMPLETE updated communication_style string (only after ≥3 lead messages show the pattern), otherwise omit",
  "injury_updates": "COMPLETE updated injuries_limits string (only if lead mentioned), otherwise omit",
  "personal_context_updates": "COMPLETE updated personal_context string (lifestyle/job/family/loves/stressors/funnel signals only if lead mentioned), otherwise omit",
  "conversation_summary_updates": "COMPLETE compressed understanding of the person and important previous conversations, including outcomes and genuine open loops"
}

Examples of good new_notes:
  "asked about plant-based meal plan tue"
  "lives in Colorado, works estate planning"
  "loves dogs and beach walks"
  "puppy likes bouncy balls; use as known toy context"
  "has adjustable dumbbells and bench at home"
  "old iPhone blocks banking access"
  "gets frustrated by boring meal prep"
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

function mergeRelationshipSummary(existingSummary, extracted) {
    const next = typeof extracted?.conversation_summary_updates === 'string'
        ? extracted.conversation_summary_updates.replace(/\s+/g, ' ').trim()
        : '';
    return (next || String(existingSummary || '').trim()).slice(0, 3000);
}

function fallbackRelationshipSummary(memory) {
    const parts = [];
    if (memory?.goals) parts.push(`Goals: ${memory.goals}`);
    if (memory?.personal_context) parts.push(`Person/context: ${memory.personal_context}`);
    if (memory?.injuries_limits) parts.push(`Injuries/limits: ${memory.injuries_limits}`);
    const notes = tailLines(memory?.running_notes, 12);
    if (notes) parts.push(`Previous conversation notes: ${notes.replace(/\n+/g, '; ')}`);
    return parts.join(' ').slice(0, 3000);
}

function buildRelationshipMemoryBlock(threadOrMemory) {
    const source = safeObject(threadOrMemory);
    const customData = safeObject(source.custom_data || source.customData);
    const compaction = safeObject(
        source.relationship_memory_compaction
        || customData.relationship_memory_compaction
    );
    const summary = String(compaction.summary || '').trim();
    if (!summary) return '';
    return `\nFULL RELATIONSHIP MEMORY (compressed from ${Number(compaction.messages_compacted || 0) || 'all known'} canonical messages across ${Number(compaction.conversation_episodes || 0) || 'multiple'} conversation episodes):
${summary}
Use this for recognition and continuity. It is older relationship knowledge, not permission to continue a stale topic, question sequence, support loop, or offer. The current conversation episode still controls the reply.`;
}

function countConversationEpisodes(messages, previousLastMessageAt = null) {
    const gapMs = 72 * 60 * 60 * 1000;
    let count = 0;
    let previous = previousLastMessageAt ? Date.parse(previousLastMessageAt) : null;
    for (const message of messages || []) {
        const current = Date.parse(message?.created_at || '');
        if (!Number.isFinite(current)) continue;
        if (previous == null || current - previous >= gapMs) count += 1;
        previous = current;
    }
    return count;
}

async function extractConversationBatches({
    messages,
    leadName,
    channel,
    leadStage,
    existingMemory,
    existingRelationshipSummary = '',
    isLinked = false,
}) {
    let memory = existingMemory;
    let relationshipSummary = String(existingRelationshipSummary || '');
    const fields = new Set();
    for (let start = 0; start < messages.length; start += MEMORY_BATCH_SIZE) {
        const batch = messages.slice(start, start + MEMORY_BATCH_SIZE);
        const conversation = batch.map(message => {
            const speaker = message.direction === 'in' ? leadName : 'Coach';
            const channelTag = isLinked ? (message.source === 'ig' ? ' [IG]' : ' [App]') : '';
            return `${speaker}${channelTag}: ${stripPhotoMarkers(message.text)}`;
        }).join('\n');
        const prompt = buildExtractorPrompt({
            leadName,
            channel,
            leadStage,
            existing: memory,
            existingRelationshipSummary: relationshipSummary,
            conversation,
        });
        const extracted = await callMemoryJSON(prompt);
        Object.keys(extracted || {}).forEach(field => fields.add(field));
        memory = mergeMemory(memory, extracted).next;
        relationshipSummary = mergeRelationshipSummary(relationshipSummary, extracted)
            || fallbackRelationshipSummary(memory);
    }
    return { memory, relationshipSummary, fields: [...fields] };
}

// Pull recent in-app DMs between the linked client and their coach so the
// IG-side extractor sees the full cross-channel conversation. Returns a list
// shaped like ig_messages (direction, text, created_at) so it can be merged
// into a single timeline. Empty array on missing args or any failure.
async function loadInAppDms(clientId, coachId, since = null) {
    if (!clientId || !coachId) return [];
    try {
        const sinceFilter = since ? `&created_at=gte.${encodeURIComponent(since)}` : '';
        const rows = await loadEveryPage(
            `nudges?select=id,sender_id,message,created_at&or=(and(sender_id.eq.${clientId},receiver_id.eq.${coachId}),and(sender_id.eq.${coachId},receiver_id.eq.${clientId}))${sinceFilter}&order=created_at.asc,id.asc`
        );
        return rows.map(m => ({
            id: m.id,
            direction: m.sender_id === clientId ? 'in' : 'out',
            text: m.message,
            created_at: m.created_at,
            source: 'app',
        }));
    } catch (e) {
        console.warn('[ig-memory] loadInAppDms failed:', e.message);
        return [];
    }
}

async function loadIgDms(threadId, since = null) {
    const sinceFilter = since ? `&created_at=gte.${encodeURIComponent(since)}` : '';
    const rows = await loadEveryPage(
        `ig_messages?select=id,direction,text,created_at&thread_id=eq.${encodeURIComponent(threadId)}${sinceFilter}&order=created_at.asc,id.asc`
    );
    return rows.map(message => ({ ...message, source: 'ig' }));
}

// Read the existing client_memory row for a linked client. Shape matches the
// `existing` argument used by buildExtractorPrompt / mergeMemory.
async function loadClientMemoryRow(coachId, clientId) {
    const empty = {
        goals: null,
        communication_style: null,
        running_notes: null,
        injuries_limits: null,
        personal_context: null,
    };
    if (!coachId || !clientId) return empty;
    try {
        const rows = await supabaseQuery(
            `client_memory?select=goals,communication_style,running_notes,injuries_limits,personal_context&coach_id=eq.${coachId}&client_id=eq.${clientId}&limit=1`
        );
        if (rows[0]) return { ...empty, ...rows[0] };
    } catch (e) { /* treat as empty */ }
    return empty;
}

async function processThread(thread) {
    const isLinked = !!thread.linked_user_id;
    const speakerName = thread.profile_name && !/\{\{[^}]+\}\}/.test(thread.profile_name)
        ? thread.profile_name
        : (thread.ig_username || (isLinked ? 'Client' : 'Lead'));

    const customData = safeObject(thread.custom_data);
    const priorCompaction = safeObject(customData.relationship_memory_compaction);
    const hasCurrentCompaction = Number(priorCompaction.version || 0) >= RELATIONSHIP_MEMORY_VERSION;
    const since = hasCurrentCompaction ? priorCompaction.last_compacted_at || null : null;
    const [igMessages, appMessages] = await Promise.all([
        loadIgDms(thread.id, since),
        isLinked ? loadInAppDms(thread.linked_user_id, thread.coach_id, since) : Promise.resolve([]),
    ]);
    let combined = igMessages.concat(appMessages).sort((a, b) => {
        const timeCompare = String(a.created_at || '').localeCompare(String(b.created_at || ''));
        if (timeCompare !== 0) return timeCompare;
        return `${a.source}:${a.id || ''}`.localeCompare(`${b.source}:${b.id || ''}`);
    });
    if (hasCurrentCompaction) {
        const checkpointKey = String(priorCompaction.last_compacted_event_key || '');
        const checkpointIndex = checkpointKey
            ? combined.findIndex(message => `${message.source}:${message.id || message.created_at}` === checkpointKey)
            : -1;
        if (checkpointIndex >= 0) {
            combined = combined.slice(checkpointIndex + 1);
        } else if (priorCompaction.last_compacted_at) {
            const checkpointMs = Date.parse(priorCompaction.last_compacted_at);
            combined = combined.filter(message => Date.parse(message.created_at || '') > checkpointMs);
        }
    }
    if (combined.length === 0) {
        // No messages to extract from. Still bump last_memory_extracted_at so
        // the cron filter doesn't keep re-checking this thread.
        try {
            await supabaseQuery(`ig_threads?id=eq.${thread.id}`, {
                method: 'PATCH',
                body: { last_memory_extracted_at: new Date().toISOString() },
                prefer: 'return=minimal',
            });
        } catch (e) { /* best-effort */ }
        return { skipped: 'no_messages' };
    }

    // For linked clients, base the prompt on the unified client_memory row —
    // that's the single source of truth from this point on. For cold leads,
    // keep using the ig_threads memory columns.
    const existing = isLinked
        ? await loadClientMemoryRow(thread.coach_id, thread.linked_user_id)
        : thread;

    let compacted;
    try {
        compacted = await extractConversationBatches({
            messages: combined,
            leadName: speakerName,
            channel: thread.channel,
            leadStage: thread.lead_stage,
            existingMemory: existing,
            existingRelationshipSummary: hasCurrentCompaction ? priorCompaction.summary : '',
            isLinked,
        });
    } catch (err) {
        console.warn(`[ig-memory] thread ${thread.id} extraction failed: ${err.message}`);
        return { error: err.message };
    }

    const next = compacted.memory;
    const memoryFields = [
        'goals',
        'communication_style',
        'running_notes',
        'injuries_limits',
        'personal_context',
    ];
    const changed = memoryFields.some(key => next[key] !== existing[key]);
    const relationshipSummary = compacted.relationshipSummary;
    const newest = combined[combined.length - 1];
    const compaction = {
        version: RELATIONSHIP_MEMORY_VERSION,
        summary: relationshipSummary,
        messages_compacted: (hasCurrentCompaction ? Number(priorCompaction.messages_compacted || 0) : 0) + combined.length,
        conversation_episodes: (hasCurrentCompaction ? Number(priorCompaction.conversation_episodes || 0) : 0)
            + countConversationEpisodes(combined, hasCurrentCompaction ? priorCompaction.last_compacted_at : null),
        last_compacted_at: newest?.created_at || new Date().toISOString(),
        last_compacted_event_key: newest ? `${newest.source}:${newest.id || newest.created_at}` : null,
        updated_at: new Date().toISOString(),
        source: isLinked ? 'full_ig_and_app_history' : 'full_ig_history',
    };
    let latestCustomData = customData;
    try {
        const latestRows = await supabaseQuery(
            `ig_threads?select=custom_data&id=eq.${encodeURIComponent(thread.id)}&limit=1`
        );
        latestCustomData = safeObject(latestRows[0]?.custom_data);
    } catch (error) { /* best-effort; retain the input snapshot */ }
    const threadPatch = {
        last_memory_extracted_at: new Date().toISOString(),
        custom_data: {
            ...latestCustomData,
            relationship_memory_compaction: compaction,
        },
    };

    if (isLinked) {
        // Linked client → unified write into client_memory. Always bump
        // ig_threads.last_memory_extracted_at so the cron skips this thread
        // until new inbound arrives.
        if (changed) {
            try {
                await supabaseQuery('client_memory?on_conflict=coach_id,client_id', {
                    method: 'POST',
                    prefer: 'return=minimal,resolution=merge-duplicates',
                    body: [{
                        coach_id: thread.coach_id,
                        client_id: thread.linked_user_id,
                        goals: next.goals,
                        communication_style: next.communication_style,
                        running_notes: next.running_notes,
                        injuries_limits: next.injuries_limits,
                        personal_context: next.personal_context,
                    }],
                });
            } catch (err) {
                console.warn(`[ig-memory] linked client_memory upsert failed for thread ${thread.id}: ${err.message}`);
                return { error: err.message };
            }
        }
        try {
            await supabaseQuery(`ig_threads?id=eq.${thread.id}`, {
                method: 'PATCH',
                body: threadPatch,
                prefer: 'return=minimal',
            });
        } catch (err) {
            console.warn(`[ig-memory] linked thread timestamp update failed for ${thread.id}: ${err.message}`);
        }
        return { changed, fields: compacted.fields, target: 'client_memory', relationshipMemory: compaction };
    }

    // Cold lead → keep writing to ig_threads memory columns.
    const patch = { ...threadPatch };
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
    return { changed, fields: compacted.fields, target: 'ig_threads', relationshipMemory: compaction };
}

exports.handler = async (event) => {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured' }) };
    }
    if (!GEMINI_API_KEY && !OPENAI_API_KEY) {
        console.warn('[ig-memory] no AI key configured — skipping');
        return { statusCode: 200, body: JSON.stringify({ skipped: 'no_ai_key' }) };
    }

    // Find threads with inbound activity since their last extraction. The
    // timestamp comparison is deliberately done in JS: PostgREST filter
    // values are literals, so `last_inbound_at.gt.last_memory_extracted_at`
    // attempts to parse the column name as a timestamp and fails.
    const cutoff = EXTRACT_AFTER_HOURS > 0
        ? new Date(Date.now() - EXTRACT_AFTER_HOURS * 60 * 60 * 1000).toISOString()
        : null;

    let threads;
    try {
        threads = await loadCandidateThreads(cutoff);
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
        body: JSON.stringify({
            relationship_memory_version: RELATIONSHIP_MEMORY_VERSION,
            processed,
            changed,
            errors,
            total_candidates: threads.length,
        }),
    };
};

exports._test = {
    buildExtractorPrompt,
    mergeMemory,
    mergeRelationshipSummary,
    fallbackRelationshipSummary,
    buildRelationshipMemoryBlock,
    countConversationEpisodes,
    needsMemoryExtraction,
};
exports.buildRelationshipMemoryBlock = buildRelationshipMemoryBlock;

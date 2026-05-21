/**
 * ig-operator-command
 *
 * Admin-only operator layer for Instagram/Messenger growth work.
 * It returns structured cards for one command box in the admin dashboard.
 *
 * V1 is deliberately approval-first:
 * - read/rank/draft/content planning are allowed
 * - Graph sender actions are returned as preview cards for Shannon to click
 * - no publishing, broadcast, or Human Agent auto-send happens here
 */

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    supabaseQuery,
    callGeminiFallback,
    truncate,
    buildCoachBioBlock,
    buildShannonDmTuningBlock,
} = require('./_lib/client-context');

const ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';
const MAX_HISTORY_MESSAGES = 26;

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

function getHeader(headers = {}, name) {
    const lower = name.toLowerCase();
    const key = Object.keys(headers || {}).find(k => k.toLowerCase() === lower);
    return key ? headers[key] : '';
}

function parseBody(event) {
    try {
        return event.body ? JSON.parse(event.body) : {};
    } catch {
        return {};
    }
}

function sqlText(value) {
    return String(value || '').replace(/'/g, "''");
}

function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeHandle(value) {
    return String(value || '').replace(/^@+/, '').trim().toLowerCase();
}

function cleanText(value, max = 900) {
    return truncate(String(value || '').replace(/\s+/g, ' ').trim(), max);
}

function firstNonEmpty(values = []) {
    return values.map(v => String(v || '').trim()).find(Boolean) || '';
}

function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function hoursSince(value) {
    const ts = Date.parse(value || '');
    if (!Number.isFinite(ts)) return null;
    return Math.max(0, (Date.now() - ts) / (60 * 60 * 1000));
}

function relativeAge(value) {
    const hours = hoursSince(value);
    if (hours == null) return '';
    if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m ago`;
    if (hours < 48) return `${Math.round(hours)}h ago`;
    return `${Math.round(hours / 24)}d ago`;
}

function dateLabel(value) {
    const ts = Date.parse(value || '');
    if (!Number.isFinite(ts)) return '';
    return new Date(ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function displayName(thread = {}) {
    const name = firstNonEmpty([thread.profile_name, thread.ig_username, 'Lead']);
    return name.replace(/\{\{[^}]+\}\}/g, '').trim() || thread.ig_username || 'Lead';
}

function leadHandle(thread = {}) {
    const handle = normalizeHandle(thread.ig_username);
    return handle ? `@${handle}` : '';
}

async function execSqlJson(sql) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql_json`, {
        method: 'POST',
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql: sql.trim() }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`exec_sql_json -> ${res.status} ${text.slice(0, 300)}`);
    try {
        const parsed = text ? JSON.parse(text) : [];
        if (Array.isArray(parsed)) return parsed;
        if (parsed?.error) throw new Error(parsed.error);
        return [];
    } catch (err) {
        throw new Error(`Could not parse exec_sql_json response: ${err.message}`);
    }
}

async function requireAdmin(event) {
    const authHeader = getHeader(event.headers, 'authorization');
    const token = String(authHeader || '').match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return { response: json(401, { error: 'Unauthorized' }) };
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return { response: json(500, { error: 'Supabase env missing' }) };
    }

    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${token}`,
        },
    });
    if (!res.ok) return { response: json(401, { error: 'Unauthorized' }) };

    const user = await res.json();
    const email = String(user?.email || '').trim().toLowerCase();
    if (email !== ADMIN_EMAIL) return { response: json(403, { error: 'Forbidden' }) };
    return { user: { id: user.id, email } };
}

function classifyIntent(command) {
    const q = String(command || '').toLowerCase();
    if (/\b(mark|send|set)\b.*\b(seen|read)\b|\bseen\b|\bread receipt\b/.test(q)) return 'mark_seen';
    if (/\b(like|love|heart|react)\b/.test(q) && /\b(message|dm|reply|last|latest)\b/.test(q)) return 'react_message';
    if (/\b(reply|respond|draft|message|dm|text)\b/.test(q) && (/@[\w.]+/.test(q) || /\b(to|for)\b/.test(q))) return 'draft_reply';
    if (
        /\b(highest|top|best|most|worst|rank|ranking|winner|winning|perform|performance|analytics|insights|metrics|liked|likes|comments|commented|saved|shares|shared|reach|views|viewed|plays|replies)\b/.test(q)
        && (/\b(post|posts|psot|psots|reel|reels|story|stories|content|media|ig|instagram)\b/.test(q) || !/\b(message|dm|reply|thread|lead)\b/.test(q))
    ) return 'content_performance';
    if (/\b(post|reel|story|caption|hook|content|calendar|a\/b|ab test|test angle|publish)\b/.test(q)) return 'content_plan';
    if (/\b(warm|warmest|hot|hottest|lead|leads|rank|pipeline|follow.?up|who should|worth replying|waiting)\b/.test(q)) return 'rank_leads';
    return 'overview';
}

function extractTarget(command) {
    const raw = String(command || '');
    const handle = raw.match(/@([\w.]+)/)?.[1];
    if (handle) return handle;
    const afterTo = raw.match(/\b(?:to|for|with)\s+([a-z0-9_. -]{2,40})/i)?.[1];
    if (!afterTo) return '';
    return afterTo
        .replace(/\b(and|but|keep|make|draft|reply|message|dm|text|warm|short|casual|pitch|yet)\b.*$/i, '')
        .trim();
}

function leadStageScore(stage) {
    return {
        new: 10,
        qualifying: 28,
        invited: 36,
        in_app: 24,
        paying: 8,
        churned: -50,
    }[String(stage || 'new')] ?? 10;
}

function keywordScore(text) {
    const q = String(text || '').toLowerCase();
    let score = 0;
    if (/\b(start|join|link|challenge|interested|keen|yes|ready|how much|cost|price)\b/.test(q)) score += 18;
    if (/\b(help|struggle|stuck|lost|overwhelmed|need|accountability)\b/.test(q)) score += 12;
    if (/\b(vegan|plant.?based|vegetarian|protein|weight|fat loss|gym|training)\b/.test(q)) score += 8;
    return score;
}

function heatScore(row = {}) {
    const qualifier = safeObject(row.qualifier);
    const qualifierScore = Number(qualifier.warmth_score || qualifier.score || 0);
    let score = Number.isFinite(qualifierScore) ? Math.min(40, qualifierScore) : 0;
    score += leadStageScore(row.lead_stage);

    const inboundHours = hoursSince(row.last_inbound_at);
    const outboundHours = hoursSince(row.last_outbound_at);
    if (inboundHours != null) {
        if (inboundHours <= 24) score += 24;
        else if (inboundHours <= 72) score += 17;
        else if (inboundHours <= 168) score += 10;
    }
    if (row.latest_direction === 'in') score += 16;
    if (outboundHours != null && outboundHours > 48 && row.latest_direction === 'out') score += 8;
    score += Math.min(18, Number(row.message_count || 0) * 2);
    score += keywordScore(row.latest_text);
    if (row.goals || row.personal_context || row.running_notes) score += 6;
    if (row.linked_user_id) score += 4;
    if (row.lead_stage === 'churned') score = 0;
    return Math.max(0, Math.min(100, Math.round(score)));
}

function leadAction(row = {}) {
    if (row.latest_direction === 'in') {
        return {
            label: 'reply now',
            tone: 'hot',
            detail: 'They sent the latest message. Keep it conversational and move one step.',
        };
    }
    const outHours = hoursSince(row.last_outbound_at);
    if (outHours != null && outHours >= 48) {
        return {
            label: 'follow up',
            tone: 'warm',
            detail: `Last outbound was ${relativeAge(row.last_outbound_at)}. Worth a light bump if the thread had a real hook.`,
        };
    }
    return {
        label: 'give time',
        tone: 'cool',
        detail: 'Recent enough that a forced bump may feel pushy.',
    };
}

function humanAgentWindow(row = {}) {
    const inboundHours = hoursSince(row.last_inbound_at);
    if (inboundHours == null) return null;
    if (inboundHours > 24 && inboundHours <= 168) {
        return {
            active: true,
            label: '7-day manual window',
            detail: 'Human Agent territory: manual review only, no auto-send or Send Later.',
        };
    }
    return { active: false };
}

async function loadLeadRows(limit = 60) {
    const rows = await execSqlJson(`
        SELECT
            t.id,
            t.channel,
            t.ig_username,
            t.profile_name,
            t.lead_stage,
            t.linked_user_id,
            t.last_inbound_at,
            t.last_outbound_at,
            t.qualifier,
            t.goals,
            t.personal_context,
            t.running_notes,
            t.auto_send_enabled,
            (
                SELECT COUNT(*)::INT
                FROM public.ig_messages m
                WHERE m.thread_id = t.id
            ) AS message_count,
            (
                SELECT m.text
                FROM public.ig_messages m
                WHERE m.thread_id = t.id
                ORDER BY m.created_at DESC
                LIMIT 1
            ) AS latest_text,
            (
                SELECT m.direction
                FROM public.ig_messages m
                WHERE m.thread_id = t.id
                ORDER BY m.created_at DESC
                LIMIT 1
            ) AS latest_direction,
            (
                SELECT m.id
                FROM public.ig_messages m
                WHERE m.thread_id = t.id AND m.direction = 'in'
                ORDER BY m.created_at DESC
                LIMIT 1
            ) AS latest_inbound_message_id,
            (
                SELECT m.manychat_message_id
                FROM public.ig_messages m
                WHERE m.thread_id = t.id AND m.direction = 'in'
                ORDER BY m.created_at DESC
                LIMIT 1
            ) AS latest_inbound_manychat_message_id
        FROM public.ig_threads t
        WHERE COALESCE(t.lead_stage, 'new') <> 'churned'
            AND (t.custom_data->>'merged_into_thread_id') IS NULL
            AND (t.custom_data->>'merged_into_ig_thread_id') IS NULL
        ORDER BY t.last_inbound_at DESC NULLS LAST
        LIMIT ${Math.max(10, Math.min(120, Number(limit) || 60))}
    `);

    return rows.map(row => {
        const score = heatScore(row);
        const action = leadAction(row);
        return {
            ...row,
            display_name: displayName(row),
            handle: leadHandle(row),
            heat_score: score,
            action_label: action.label,
            action_tone: action.tone,
            action_detail: action.detail,
            human_agent: humanAgentWindow(row),
        };
    }).sort((a, b) => b.heat_score - a.heat_score);
}

function leadCardFromRows(rows, command) {
    const items = rows.slice(0, 8).map((row, index) => ({
        rank: index + 1,
        threadId: row.id,
        displayName: row.display_name,
        handle: row.handle,
        channel: row.channel || 'instagram',
        stage: row.lead_stage || 'new',
        score: row.heat_score,
        actionLabel: row.action_label,
        actionTone: row.action_tone,
        actionDetail: row.action_detail,
        lastInbound: relativeAge(row.last_inbound_at),
        lastOutbound: relativeAge(row.last_outbound_at),
        latestDirection: row.latest_direction || '',
        latestText: cleanText(row.latest_text, 260),
        messageCount: Number(row.message_count || 0),
        manualOnly: !!row.human_agent?.active,
    }));

    return {
        type: 'lead_rank',
        title: 'Warmest IG/FB leads right now',
        summary: 'Ranked from live IG threads using recency, latest direction, message depth, stage, and buying-intent words.',
        command,
        items,
    };
}

async function findThreadByTarget(target) {
    const clean = normalizeHandle(target);
    if (!clean) return null;
    const pattern = `%${sqlText(clean)}%`;
    const rows = await execSqlJson(`
        SELECT
            t.id,
            t.channel,
            t.ig_username,
            t.profile_name,
            t.lead_stage,
            t.linked_user_id,
            t.last_inbound_at,
            t.last_outbound_at,
            t.qualifier,
            t.goals,
            t.personal_context,
            t.running_notes,
            t.auto_send_enabled,
            (
                SELECT COUNT(*)::INT
                FROM public.ig_messages m
                WHERE m.thread_id = t.id
            ) AS message_count,
            (
                SELECT m.direction
                FROM public.ig_messages m
                WHERE m.thread_id = t.id
                ORDER BY m.created_at DESC
                LIMIT 1
            ) AS latest_direction,
            (
                SELECT m.text
                FROM public.ig_messages m
                WHERE m.thread_id = t.id
                ORDER BY m.created_at DESC
                LIMIT 1
            ) AS latest_text,
            (
                SELECT m.id
                FROM public.ig_messages m
                WHERE m.thread_id = t.id AND m.direction = 'in'
                ORDER BY m.created_at DESC
                LIMIT 1
            ) AS latest_inbound_message_id,
            (
                SELECT m.manychat_message_id
                FROM public.ig_messages m
                WHERE m.thread_id = t.id AND m.direction = 'in'
                ORDER BY m.created_at DESC
                LIMIT 1
            ) AS latest_inbound_manychat_message_id
        FROM public.ig_threads t
        WHERE COALESCE(t.lead_stage, 'new') <> 'churned'
            AND (t.custom_data->>'merged_into_thread_id') IS NULL
            AND (t.custom_data->>'merged_into_ig_thread_id') IS NULL
            AND (
                LOWER(REGEXP_REPLACE(COALESCE(t.ig_username, ''), '^@', '')) ILIKE '${pattern}'
                OR LOWER(COALESCE(t.profile_name, '')) ILIKE '${pattern}'
            )
        ORDER BY t.last_inbound_at DESC NULLS LAST, t.updated_at DESC NULLS LAST
        LIMIT 1
    `);
    if (!rows[0]) return null;
    const row = rows[0];
    return {
        ...row,
        display_name: displayName(row),
        handle: leadHandle(row),
        heat_score: heatScore(row),
        human_agent: humanAgentWindow(row),
    };
}

async function loadThreadHistory(threadId) {
    if (!threadId) return [];
    const rows = await supabaseQuery(
        `ig_messages?select=id,direction,text,created_at,manychat_message_id&thread_id=eq.${encodeURIComponent(threadId)}&order=created_at.desc&limit=${MAX_HISTORY_MESSAGES}`
    );
    return (rows || []).reverse();
}

function formatHistoryForPrompt(thread, history) {
    if (!history.length) return 'No stored messages found.';
    return history.map(m => {
        const speaker = m.direction === 'in' ? (thread.display_name || thread.handle || 'Lead') : 'Shannon';
        return `${speaker} (${relativeAge(m.created_at) || m.created_at || 'unknown'}): ${cleanText(m.text, 600)}`;
    }).join('\n');
}

function fallbackReply(thread, history) {
    const latest = [...history].reverse().find(m => m.direction === 'in');
    const text = String(latest?.text || '').toLowerCase();
    if (/link|join|start|challenge|interested|keen|yes/.test(text)) {
        return 'yeah absolutely, i can send it through. what made you keen to give it a go now?';
    }
    if (/protein|food|meal|vegan|plant/.test(text)) {
        return 'yeah that makes sense, food is usually the bit that makes or breaks it. what are you finding hardest with it at the moment?';
    }
    return 'yeah i get you. what has been the main thing you have been trying to sort out with it?';
}

async function generateReplyDraft(thread, history, command) {
    const prompt = `
You are drafting Instagram/Messenger replies for Shannon inside Balance.
Write as Shannon, not as an AI. This is a private admin draft.

Rules:
- Output only the reply text.
- Use 1 to 3 short DM bubbles. Separate bubbles with |||.
- Keep it warm, casual, Australian, and direct.
- Do not mention AI, automation, dashboards, APIs, or Meta review.
- Do not pitch the challenge unless the recent thread clearly supports it.
- Do not use em dashes.
- Do not invent story/photo context that is not in the history.
- Ask at most one question unless the thread clearly needs a direct next step.

${buildCoachBioBlock()}

${buildShannonDmTuningBlock ? buildShannonDmTuningBlock() : ''}

Thread:
- Name: ${thread.display_name || 'Lead'}
- Handle: ${thread.handle || 'unknown'}
- Channel: ${thread.channel || 'instagram'}
- Stage: ${thread.lead_stage || 'new'}
- Goals/memory: ${cleanText([thread.goals, thread.personal_context, thread.running_notes].filter(Boolean).join(' | '), 1000) || 'none saved'}

Recent messages:
${formatHistoryForPrompt(thread, history)}

Shannon command:
${command}
`;

    try {
        const reply = await callGeminiFallback([{ role: 'user', parts: [{ text: prompt }] }], {
            maxOutputTokens: 700,
            temperature: 0.45,
        });
        return cleanText(reply, 1800) || fallbackReply(thread, history);
    } catch (err) {
        console.warn('[ig-operator-command] reply draft fallback:', err.message);
        return fallbackReply(thread, history);
    }
}

function splitDraftBubbles(text) {
    return String(text || '')
        .split(/\|\|\|/)
        .map(p => p.trim())
        .filter(Boolean)
        .slice(0, 4);
}

async function buildDraftReply(command) {
    const target = extractTarget(command);
    if (!target) {
        const rows = await loadLeadRows(20);
        return {
            reply: 'Who should I draft for? I pulled the warmest leads below so you can pick one.',
            cards: [leadCardFromRows(rows, command)],
        };
    }
    const thread = await findThreadByTarget(target);
    if (!thread) {
        return {
            reply: `I could not match "${target}" to an IG/FB thread. Try the @handle or open IG Leads.`,
            cards: [],
        };
    }
    const history = await loadThreadHistory(thread.id);
    const draft = await generateReplyDraft(thread, history, command);
    const manual = humanAgentWindow(thread);
    return {
        reply: `Drafted a reply for ${thread.display_name}${thread.handle ? ` (${thread.handle})` : ''}.`,
        cards: [{
            type: 'draft_reply',
            title: `Reply draft for ${thread.display_name}`,
            target: {
                threadId: thread.id,
                displayName: thread.display_name,
                handle: thread.handle,
                channel: thread.channel || 'instagram',
                stage: thread.lead_stage || 'new',
            },
            manualOnly: !!manual?.active,
            manualNote: manual?.active ? manual.detail : '',
            heatScore: heatScore(thread),
            latestInbound: relativeAge(thread.last_inbound_at),
            latestOutbound: relativeAge(thread.last_outbound_at),
            messages: splitDraftBubbles(draft),
            recentContext: history.slice(-5).map(m => ({
                direction: m.direction,
                text: cleanText(m.text, 240),
                createdAt: m.created_at,
                age: relativeAge(m.created_at),
            })),
        }],
    };
}

async function buildActionPreview(command, action) {
    const target = extractTarget(command);
    if (!target) {
        return {
            reply: `Tell me which thread to ${action === 'mark_seen' ? 'mark seen' : 'react to'}, ideally with the @handle.`,
            cards: [leadCardFromRows(await loadLeadRows(20), command)],
        };
    }
    const thread = await findThreadByTarget(target);
    if (!thread) {
        return {
            reply: `I could not match "${target}" to an IG/FB thread.`,
            cards: [],
        };
    }

    const payload = action === 'mark_seen'
        ? { action: 'mark_seen', threadId: thread.id }
        : { action: 'react', threadId: thread.id, messageId: thread.latest_inbound_message_id, reaction: 'love' };

    const canRun = action === 'mark_seen'
        ? thread.channel === 'instagram'
        : thread.channel === 'instagram' && !!thread.latest_inbound_message_id && String(thread.latest_inbound_manychat_message_id || '').startsWith('ig_graph:');

    return {
        reply: canRun
            ? `Ready to ${action === 'mark_seen' ? 'mark seen' : 'like the latest inbound message'} for ${thread.display_name}.`
            : `I found ${thread.display_name}, but this action may not be available for that thread yet.`,
        cards: [{
            type: 'action_preview',
            title: action === 'mark_seen' ? 'Send seen receipt' : 'Like latest inbound message',
            summary: canRun
                ? 'This will call the existing Instagram Graph action endpoint only after you click the button.'
                : 'The thread needs to be an Instagram Graph-linked thread with the right native message id stored.',
            action,
            canRun,
            payload,
            target: {
                threadId: thread.id,
                displayName: thread.display_name,
                handle: thread.handle,
                channel: thread.channel || 'instagram',
            },
        }],
    };
}

function performanceMetricForCommand(command) {
    const q = String(command || '').toLowerCase();
    if (/\b(liked|likes|like count|most liked|highest liked)\b/.test(q)) return { key: 'likes', label: 'likes' };
    if (/\b(comments|commented|comment count)\b/.test(q)) return { key: 'comments', label: 'comments' };
    if (/\b(saved|saves|save count)\b/.test(q)) return { key: 'saved', label: 'saves' };
    if (/\b(shares|shared|share count)\b/.test(q)) return { key: 'shares', label: 'shares' };
    if (/\b(reach|reached)\b/.test(q)) return { key: 'reach', label: 'reach' };
    if (/\b(views|viewed|plays|played|watch)\b/.test(q)) return { key: 'views', label: 'views/plays' };
    if (/\b(replies|reply count|story replies)\b/.test(q)) return { key: 'replies', label: 'replies' };
    return { key: 'score', label: 'overall signal' };
}

function numericSql(alias) {
    return `CASE WHEN ${alias} ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN ${alias}::NUMERIC ELSE 0 END`;
}

async function loadContentPerformanceRows() {
    const rows = await execSqlJson(`
        WITH interaction_counts AS (
            SELECT
                ci.content_item_id,
                COUNT(*)::INT AS webhook_interactions,
                COUNT(*) FILTER (WHERE ci.event_type = 'comment')::INT AS webhook_comments,
                COUNT(*) FILTER (WHERE ci.event_type = 'story_reply')::INT AS webhook_story_replies,
                MAX(ci.received_at) AS latest_interaction_at
            FROM public.ig_content_interactions ci
            GROUP BY ci.content_item_id
        ),
        raw AS (
            SELECT
                item.id,
                item.source_key,
                item.ig_media_id,
                item.ig_story_id,
                item.content_type,
                item.media_product_type,
                item.media_type,
                item.caption,
                item.permalink,
                item.thumbnail_url,
                item.media_url,
                item.posted_at,
                item.created_at,
                item.analysis_summary,
                item.analysis_reply_context,
                COALESCE(ic.webhook_interactions, 0)::NUMERIC AS webhook_interactions,
                COALESCE(ic.webhook_comments, 0)::NUMERIC AS webhook_comments,
                COALESCE(ic.webhook_story_replies, 0)::NUMERIC AS webhook_story_replies,
                COALESCE(
                    item.raw_payload #>> '{latest_counts,like_count}',
                    item.raw_payload #>> '{latest_media,like_count}',
                    item.raw_payload #>> '{latest_insights,likes}',
                    item.raw_payload #>> '{insights,likes}',
                    '0'
                ) AS likes_raw,
                COALESCE(
                    item.raw_payload #>> '{latest_counts,comments_count}',
                    item.raw_payload #>> '{latest_media,comments_count}',
                    item.raw_payload #>> '{latest_insights,comments}',
                    item.raw_payload #>> '{insights,comments}',
                    '0'
                ) AS comments_raw,
                COALESCE(
                    item.raw_payload #>> '{latest_insights,saved}',
                    item.raw_payload #>> '{latest_insights,saves}',
                    item.raw_payload #>> '{insights,saved}',
                    '0'
                ) AS saved_raw,
                COALESCE(
                    item.raw_payload #>> '{latest_insights,shares}',
                    item.raw_payload #>> '{insights,shares}',
                    '0'
                ) AS shares_raw,
                COALESCE(
                    item.raw_payload #>> '{latest_insights,reach}',
                    item.raw_payload #>> '{latest_insights,impressions}',
                    item.raw_payload #>> '{insights,reach}',
                    item.raw_payload #>> '{insights,impressions}',
                    '0'
                ) AS reach_raw,
                COALESCE(
                    item.raw_payload #>> '{latest_insights,views}',
                    item.raw_payload #>> '{latest_insights,plays}',
                    item.raw_payload #>> '{latest_insights,video_views}',
                    item.raw_payload #>> '{latest_insights,ig_reels_aggregated_all_plays_count}',
                    item.raw_payload #>> '{insights,views}',
                    item.raw_payload #>> '{insights,plays}',
                    item.raw_payload #>> '{insights,video_views}',
                    '0'
                ) AS views_raw,
                COALESCE(
                    item.raw_payload #>> '{latest_insights,plays}',
                    item.raw_payload #>> '{latest_insights,video_views}',
                    item.raw_payload #>> '{latest_insights,ig_reels_aggregated_all_plays_count}',
                    item.raw_payload #>> '{insights,plays}',
                    item.raw_payload #>> '{insights,video_views}',
                    '0'
                ) AS plays_raw,
                COALESCE(
                    item.raw_payload #>> '{latest_insights,replies}',
                    item.raw_payload #>> '{insights,replies}',
                    '0'
                ) AS replies_raw,
                COALESCE(
                    item.raw_payload #>> '{latest_insights,total_interactions}',
                    item.raw_payload #>> '{latest_insights,engagement}',
                    item.raw_payload #>> '{insights,total_interactions}',
                    item.raw_payload #>> '{insights,engagement}',
                    '0'
                ) AS total_interactions_raw,
                COALESCE(item.raw_payload #>> '{latest_graph_synced_at}', item.raw_payload #>> '{latest_insights_synced_at}', '') AS graph_synced_at
            FROM public.ig_content_items item
            LEFT JOIN interaction_counts ic ON ic.content_item_id = item.id
            WHERE COALESCE(item.content_type, 'unknown') IN ('post', 'reel', 'carousel', 'story', 'unknown')
            ORDER BY COALESCE(item.posted_at, item.created_at) DESC NULLS LAST
            LIMIT 160
        )
        SELECT
            *,
            ${numericSql('likes_raw')} AS likes,
            ${numericSql('comments_raw')} AS comments,
            ${numericSql('saved_raw')} AS saved,
            ${numericSql('shares_raw')} AS shares,
            ${numericSql('reach_raw')} AS reach,
            ${numericSql('views_raw')} AS views,
            ${numericSql('plays_raw')} AS plays,
            ${numericSql('replies_raw')} AS replies,
            ${numericSql('total_interactions_raw')} AS total_interactions
        FROM raw
    `).catch(err => {
        console.warn('[ig-operator-command] content performance query failed:', err.message);
        return [];
    });

    return rows.map(row => {
        const metrics = {
            likes: toNumber(row.likes),
            comments: Math.max(toNumber(row.comments), toNumber(row.webhook_comments)),
            saved: toNumber(row.saved),
            shares: toNumber(row.shares),
            reach: toNumber(row.reach),
            views: Math.max(toNumber(row.views), toNumber(row.plays)),
            plays: toNumber(row.plays),
            replies: Math.max(toNumber(row.replies), toNumber(row.webhook_story_replies)),
            totalInteractions: toNumber(row.total_interactions),
            webhookInteractions: toNumber(row.webhook_interactions),
        };
        const score = Math.max(
            metrics.totalInteractions,
            metrics.likes + metrics.comments + metrics.saved + metrics.shares + metrics.replies,
        ) + metrics.webhookInteractions;
        return {
            id: row.id,
            sourceKey: row.source_key,
            type: row.content_type || 'post',
            mediaProductType: row.media_product_type || '',
            mediaType: row.media_type || '',
            caption: cleanText(row.caption, 320),
            summary: cleanText(row.analysis_reply_context || row.analysis_summary, 260),
            permalink: row.permalink || '',
            thumbnailUrl: row.thumbnail_url || row.media_url || '',
            postedAt: row.posted_at || row.created_at,
            postedLabel: dateLabel(row.posted_at || row.created_at),
            graphSyncedAt: row.graph_synced_at || '',
            graphSyncedLabel: relativeAge(row.graph_synced_at),
            metrics,
            score,
        };
    });
}

async function buildContentPerformance(command) {
    const focus = performanceMetricForCommand(command);
    const rows = await loadContentPerformanceRows();
    if (!rows.length) {
        return {
            reply: 'I do not have synced IG content performance yet. Use the refresh button to pull the latest media and Graph metrics, then ask again.',
            cards: [{
                type: 'content_performance',
                title: 'IG content performance',
                summary: 'No stored posts/reels/stories were found in Balance yet.',
                metricKey: focus.key,
                metricLabel: focus.label,
                items: [],
                canRefresh: true,
            }],
        };
    }

    const metricValue = item => focus.key === 'score' ? item.score : toNumber(item.metrics[focus.key]);
    const sorted = [...rows]
        .sort((a, b) => metricValue(b) - metricValue(a) || Date.parse(b.postedAt || 0) - Date.parse(a.postedAt || 0));
    const top = sorted[0];
    const topValue = metricValue(top);
    const hasMetricData = sorted.some(item => metricValue(item) > 0);
    const allRowsHaveNoGraphSync = rows.every(item => !item.graphSyncedAt);

    return {
        reply: hasMetricData
            ? `Your top IG ${top?.type || 'post'} by ${focus.label} is ${topValue.toLocaleString('en-AU')} ${focus.label}${top?.postedLabel ? ` from ${top.postedLabel}` : ''}.`
            : 'I found your IG content, but the stored Graph metric values are empty so far. Refresh metrics, then ask again.',
        cards: [{
            type: 'content_performance',
            title: `Top IG content by ${focus.label}`,
            summary: allRowsHaveNoGraphSync
                ? 'Stored content exists, but Graph performance metrics have not been synced yet.'
                : 'Ranked from stored Instagram Graph metrics plus comment/story-reply interaction counts.',
            metricKey: focus.key,
            metricLabel: focus.label,
            items: sorted.slice(0, 8).map((item, index) => ({
                ...item,
                rank: index + 1,
                metricValue: metricValue(item),
            })),
            canRefresh: true,
        }],
    };
}

async function buildContentPlan(command) {
    const radarRows = await execSqlJson(`
        SELECT
            i.id,
            i.idea_type,
            i.title,
            i.hook,
            i.angle,
            i.script,
            i.caption,
            i.cta,
            i.priority,
            i.status,
            i.evidence,
            r.created_at AS run_created_at
        FROM public.content_radar_items i
        JOIN public.content_radar_runs r ON r.id = i.run_id
        WHERE COALESCE(i.status, 'idea') NOT IN ('dismissed', 'used')
        ORDER BY r.created_at DESC, i.rank ASC NULLS LAST, i.created_at ASC
        LIMIT 8
    `).catch(err => {
        console.warn('[ig-operator-command] content radar query failed:', err.message);
        return [];
    });

    if (radarRows.length) {
        return {
            reply: 'I pulled the strongest unused Content Radar ideas. Pick one, or ask me to turn one into a tighter reel/script.',
            cards: [{
                type: 'content_plan',
                title: 'Post from recent DM signals',
                summary: `Based on the latest Content Radar run (${relativeAge(radarRows[0].run_created_at) || 'recently'}).`,
                source: 'content_radar',
                ideas: radarRows.slice(0, 5).map(row => ({
                    id: row.id,
                    type: row.idea_type || 'idea',
                    priority: row.priority || 'medium',
                    title: row.title || row.hook || 'Content idea',
                    hook: row.hook || '',
                    angle: row.angle || '',
                    script: row.script || '',
                    caption: row.caption || '',
                    cta: row.cta || '',
                })),
            }],
        };
    }

    const rows = await loadLeadRows(40);
    const signals = rows.slice(0, 12).map(row => [
        row.display_name,
        row.handle,
        row.lead_stage,
        cleanText(row.latest_text, 180),
    ].filter(Boolean).join(' | ')).join('\n');

    const prompt = `
You are Shannon's internal Instagram operator for Balance.
Make a tight posting plan from recent IG/FB lead signals.

Rules:
- Output JSON only.
- 3 ideas max.
- Each idea has: type, title, hook, angle, script, caption, cta.
- Make it practical enough to film or post today.
- No client names or identifying details.
- Do not mention AI.

Command: ${command}

Recent lead signals:
${signals || 'No recent lead signals available.'}
`;

    let ideas = [];
    try {
        const raw = await callGeminiFallback([{ role: 'user', parts: [{ text: prompt }] }], {
            maxOutputTokens: 1200,
            temperature: 0.5,
        });
        const match = raw.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
        const parsed = match ? JSON.parse(match[0]) : [];
        ideas = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.ideas) ? parsed.ideas : []);
    } catch (err) {
        console.warn('[ig-operator-command] content plan fallback:', err.message);
    }

    if (!ideas.length) {
        ideas = [
            {
                type: 'reel',
                title: 'The thing making plant-based fat loss harder',
                hook: 'If you are eating plant-based but still stuck, check this first.',
                angle: 'Use repeated DM pain points around protein, consistency and overwhelm.',
                script: 'Name the common mistake, give one simple fix, then invite replies with the hardest part.',
                caption: 'Plant-based fat loss usually gets easier when the basics are visible instead of guessed.',
                cta: 'Reply "balance" and I will send the free challenge.',
            },
            {
                type: 'story',
                title: 'Where are you stuck?',
                hook: 'quick plant-based check-in',
                angle: 'Story poll that creates DM replies for Shannon to continue.',
                script: 'Slide 1: biggest struggle? Slide 2: protein / workouts / calories / consistency. Slide 3: reply and I will point you in the right direction.',
                caption: '',
                cta: 'Reply with the bit you want help with.',
            },
        ];
    }

    return {
        reply: 'I made a fresh content plan from the recent lead signal. This stays draft-only until we build the publishing approval lane.',
        cards: [{
            type: 'content_plan',
            title: 'Fresh content plan',
            summary: 'Generated from recent IG/FB lead messages. Privacy-safe and ready to refine.',
            source: 'live_leads',
            ideas: ideas.slice(0, 4),
        }],
    };
}

async function buildOverview(command) {
    const leads = await loadLeadRows(40);
    const hot = leads.filter(l => l.heat_score >= 70).length;
    const waiting = leads.filter(l => l.latest_direction === 'in').length;
    const manual = leads.filter(l => l.human_agent?.active).length;
    const stats = {
        scanned: leads.length,
        hot,
        waiting,
        manual,
    };
    return {
        reply: `IG Operator is in preview mode. I scanned ${leads.length} live lead threads: ${hot} hot, ${waiting} waiting on you, ${manual} in the 7-day manual window.`,
        cards: [
            {
                type: 'operator_status',
                title: 'Operator mode',
                summary: 'One command box. Read, rank, draft, plan, and preview approved actions. Sends and publishing stay behind Shannon clicks.',
                stats,
            },
            leadCardFromRows(leads, command),
        ],
    };
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const auth = await requireAdmin(event);
    if (auth.response) return auth.response;

    const body = parseBody(event);
    const command = String(body.command || body.query || '').trim();
    if (!command) return json(400, { error: 'Command is required' });

    const intent = classifyIntent(command);
    try {
        let result;
        if (intent === 'rank_leads') result = { reply: 'Here are the warmest IG/FB leads right now.', cards: [leadCardFromRows(await loadLeadRows(60), command)] };
        else if (intent === 'draft_reply') result = await buildDraftReply(command);
        else if (intent === 'content_performance') result = await buildContentPerformance(command);
        else if (intent === 'content_plan') result = await buildContentPlan(command);
        else if (intent === 'mark_seen') result = await buildActionPreview(command, 'mark_seen');
        else if (intent === 'react_message') result = await buildActionPreview(command, 'react');
        else result = await buildOverview(command);

        return json(200, {
            ok: true,
            intent,
            command,
            reply: result.reply || '',
            cards: Array.isArray(result.cards) ? result.cards : [],
            mode: 'preview_first',
            executed: false,
        });
    } catch (err) {
        console.error('[ig-operator-command] failed:', err);
        return json(500, {
            error: 'IG Operator failed',
            details: err.message || String(err),
        });
    }
};

exports._test = {
    classifyIntent,
    extractTarget,
    heatScore,
    humanAgentWindow,
    performanceMetricForCommand,
};

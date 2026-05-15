/**
 * Content Radar
 *
 * Mines recent IG/FB DMs, client DMs, client memory, and IG content feedback
 * into privacy-safe content ideas for Shannon's admin dashboard.
 */

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    supabaseQuery,
    callGeminiFallback,
    truncate,
} = require('./_lib/client-context');
const {
    clampWindowDays,
    parseJsonMaybe,
    normalizeModelResult,
    buildFallbackResult,
    buildContentRadarPrompt,
    cleanText,
} = require('./_lib/content-radar');

const BALANCE_ADMIN_EMAILS = new Set([
    'shannonbirch@cocospersonaltraining.com',
    'shannon@plantbased-balance.org',
    'shannon@plantbasedbalance.com',
    'shannon.birch@cocospersonaltraining.com',
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function sqlUuid(value, label = 'id') {
    const id = String(value || '').trim();
    if (!UUID_RE.test(id)) throw new Error(`Invalid ${label}`);
    return id;
}

function sqlText(value) {
    return String(value || '').replace(/'/g, "''");
}

function safeCount(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

async function execSqlJson(sql) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql_json`, {
        method: 'POST',
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`exec_sql_json -> ${res.status} ${text.slice(0, 240)}`);
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
    if (Array.isArray(parsed)) return parsed;
    if (parsed && parsed.error) throw new Error(parsed.error);
    return [];
}

async function requireAdmin(event) {
    const authHeader = getHeader(event.headers, 'authorization');
    const token = String(authHeader || '').match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return { response: json(401, { error: 'Unauthorized' }) };

    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${token}`,
        },
    });
    if (!res.ok) return { response: json(401, { error: 'Unauthorized' }) };

    const user = await res.json();
    const email = String(user?.email || '').trim().toLowerCase();
    if (!BALANCE_ADMIN_EMAILS.has(email)) return { response: json(403, { error: 'Forbidden' }) };
    return { user };
}

function isScheduledInvocation(event, body) {
    const scheduleHeader = getHeader(event.headers, 'x-nf-event').toLowerCase();
    return !!body?.next_run || scheduleHeader === 'schedule';
}

async function findScheduledCoach() {
    const rows = await execSqlJson(`
        SELECT au.user_id AS id, u.email
        FROM public.admin_users au
        LEFT JOIN public.users u ON u.id = au.user_id
        WHERE LOWER(COALESCE(u.email, '')) IN (
            'shannonbirch@cocospersonaltraining.com',
            'shannon@plantbased-balance.org',
            'shannon@plantbasedbalance.com',
            'shannon.birch@cocospersonaltraining.com'
        )
        ORDER BY au.created_at ASC NULLS LAST
        LIMIT 1
    `);
    const user = rows[0] || null;
    if (!user?.id) throw new Error('No admin coach found for scheduled Content Radar');
    return { id: user.id, email: user.email || '' };
}

async function resolveCaller(event, body) {
    if (isScheduledInvocation(event, body)) {
        const user = await findScheduledCoach();
        return { user, generatedBy: 'scheduled' };
    }
    const auth = await requireAdmin(event);
    if (auth.response) return auth;
    return { user: auth.user, generatedBy: 'manual' };
}

async function collectSources(coachId, windowDays) {
    const safeCoachId = sqlUuid(coachId, 'coachId');
    const days = clampWindowDays(windowDays);
    const memoryDays = Math.max(days, 90);

    const igMessagesSql = `
        SELECT
            m.id,
            m.thread_id,
            m.created_at,
            LEFT(m.text, 1200) AS text,
            t.channel,
            t.lead_stage,
            t.profile_name,
            t.ig_username
        FROM public.ig_messages m
        JOIN public.ig_threads t ON t.id = m.thread_id
        WHERE m.direction = 'in'
            AND m.created_at >= NOW() - (INTERVAL '1 day' * ${days})
            AND (t.coach_id = '${safeCoachId}' OR t.coach_id IS NULL)
            AND LENGTH(TRIM(COALESCE(m.text, ''))) > 1
        ORDER BY m.created_at DESC
        LIMIT 160
    `;

    const clientMessagesSql = `
        SELECT
            n.id,
            n.created_at,
            LEFT(n.message, 1200) AS text,
            u.name AS client_name
        FROM public.nudges n
        LEFT JOIN public.users u ON u.id = n.sender_id
        WHERE n.receiver_id = '${safeCoachId}'
            AND n.sender_id <> '${safeCoachId}'
            AND n.created_at >= NOW() - (INTERVAL '1 day' * ${days})
            AND LENGTH(TRIM(COALESCE(n.message, ''))) > 1
        ORDER BY n.created_at DESC
        LIMIT 140
    `;

    const clientMemorySql = `
        SELECT
            cm.client_id,
            cm.updated_at,
            u.name AS client_name,
            LEFT(CONCAT_WS(' | ',
                NULLIF(cm.goals, ''),
                NULLIF(cm.running_notes, ''),
                NULLIF(cm.personal_context, ''),
                NULLIF(cm.communication_style, ''),
                NULLIF(cm.injuries_limits, '')
            ), 1400) AS text
        FROM public.client_memory cm
        LEFT JOIN public.users u ON u.id = cm.client_id
        WHERE cm.coach_id = '${safeCoachId}'
            AND cm.updated_at >= NOW() - (INTERVAL '1 day' * ${memoryDays})
            AND LENGTH(TRIM(CONCAT_WS('', cm.goals, cm.running_notes, cm.personal_context, cm.communication_style, cm.injuries_limits))) > 1
        ORDER BY cm.updated_at DESC
        LIMIT 80
    `;

    const igContentInteractionsSql = `
        SELECT
            ci.id,
            ci.event_type,
            ci.received_at,
            LEFT(ci.text, 500) AS text,
            item.content_type,
            LEFT(COALESCE(item.analysis_reply_context, item.analysis_summary, item.caption, ''), 900) AS summary
        FROM public.ig_content_interactions ci
        LEFT JOIN public.ig_content_items item ON item.id = ci.content_item_id
        WHERE ci.received_at >= NOW() - (INTERVAL '1 day' * ${days})
        ORDER BY ci.received_at DESC
        LIMIT 80
    `;

    const igContentItemsSql = `
        SELECT
            id,
            content_type,
            posted_at,
            LEFT(COALESCE(analysis_reply_context, analysis_summary, caption, ''), 1000) AS summary,
            COALESCE(analysis_topics, '{}'::TEXT[]) AS topics
        FROM public.ig_content_items
        WHERE COALESCE(posted_at, created_at) >= NOW() - (INTERVAL '1 day' * ${days})
        ORDER BY COALESCE(posted_at, created_at) DESC
        LIMIT 40
    `;

    const igContentPerformanceSql = `
        WITH interaction_counts AS (
            SELECT
                ci.content_item_id,
                COUNT(*)::INT AS interaction_count,
                COUNT(*) FILTER (WHERE ci.event_type = 'comment')::INT AS comment_count,
                COUNT(*) FILTER (WHERE ci.event_type = 'story_reply')::INT AS story_reply_count,
                MAX(ci.received_at) AS latest_interaction_at,
                STRING_AGG(
                    LEFT(NULLIF(TRIM(COALESCE(ci.text, '')), ''), 180),
                    ' || ' ORDER BY ci.received_at DESC
                ) FILTER (WHERE LENGTH(TRIM(COALESCE(ci.text, ''))) > 0) AS sample_reactions
            FROM public.ig_content_interactions ci
            WHERE ci.received_at >= NOW() - (INTERVAL '1 day' * ${Math.max(days, 45)})
            GROUP BY ci.content_item_id
        )
        SELECT
            item.id,
            item.content_type,
            item.media_product_type,
            item.media_type,
            item.posted_at,
            item.permalink,
            LEFT(COALESCE(item.caption, ''), 500) AS caption,
            LEFT(COALESCE(item.analysis_reply_context, item.analysis_summary, ''), 900) AS summary,
            COALESCE(item.analysis_topics, '{}'::TEXT[]) AS topics,
            COALESCE(ic.interaction_count, 0) AS interaction_count,
            COALESCE(ic.comment_count, 0) AS comment_count,
            COALESCE(ic.story_reply_count, 0) AS story_reply_count,
            ic.latest_interaction_at,
            LEFT(COALESCE(ic.sample_reactions, ''), 800) AS sample_reactions,
            COALESCE(
                item.raw_payload #>> '{insights,reach}',
                item.raw_payload #>> '{latest_insights,reach}',
                item.raw_payload #>> '{insights,impressions}',
                item.raw_payload #>> '{latest_insights,impressions}'
            ) AS reach_or_impressions,
            COALESCE(
                item.raw_payload #>> '{insights,plays}',
                item.raw_payload #>> '{latest_insights,plays}',
                item.raw_payload #>> '{insights,video_views}',
                item.raw_payload #>> '{latest_insights,video_views}'
            ) AS plays_or_views
        FROM public.ig_content_items item
        LEFT JOIN interaction_counts ic ON ic.content_item_id = item.id
        WHERE COALESCE(item.posted_at, item.created_at) >= NOW() - (INTERVAL '1 day' * ${Math.max(days, 45)})
        ORDER BY COALESCE(ic.interaction_count, 0) DESC,
            COALESCE(ic.latest_interaction_at, item.posted_at, item.created_at) DESC
        LIMIT 60
    `;

    const contextualReplySamplesSql = `
        SELECT
            ci.id,
            ci.event_type,
            ci.received_at,
            LEFT(ci.text, 500) AS text,
            ci.from_username,
            item.content_type,
            item.media_product_type,
            LEFT(COALESCE(item.analysis_reply_context, item.analysis_summary, item.caption, ''), 900) AS content_context,
            COALESCE(item.analysis_topics, '{}'::TEXT[]) AS topics,
            t.lead_stage,
            t.profile_name,
            t.ig_username
        FROM public.ig_content_interactions ci
        LEFT JOIN public.ig_content_items item ON item.id = ci.content_item_id
        LEFT JOIN public.ig_threads t ON t.id = ci.ig_thread_id
        WHERE ci.received_at >= NOW() - (INTERVAL '1 day' * ${days})
            AND (
                LENGTH(TRIM(COALESCE(ci.text, ''))) > 0
                OR LENGTH(TRIM(COALESCE(item.analysis_reply_context, item.analysis_summary, item.caption, ''))) > 0
            )
        ORDER BY ci.received_at DESC
        LIMIT 80
    `;

    const [
        igMessages,
        clientMessages,
        clientMemory,
        igContentInteractions,
        igContentItems,
        igContentPerformance,
        contextualReplySamples,
    ] = await Promise.all([
        execSqlJson(igMessagesSql).catch(err => {
            console.warn('[content-radar] IG messages query failed:', err.message);
            return [];
        }),
        execSqlJson(clientMessagesSql).catch(err => {
            console.warn('[content-radar] client messages query failed:', err.message);
            return [];
        }),
        execSqlJson(clientMemorySql).catch(err => {
            console.warn('[content-radar] client memory query failed:', err.message);
            return [];
        }),
        execSqlJson(igContentInteractionsSql).catch(err => {
            console.warn('[content-radar] IG content interactions query failed:', err.message);
            return [];
        }),
        execSqlJson(igContentItemsSql).catch(err => {
            console.warn('[content-radar] IG content items query failed:', err.message);
            return [];
        }),
        execSqlJson(igContentPerformanceSql).catch(err => {
            console.warn('[content-radar] IG content performance query failed:', err.message);
            return [];
        }),
        execSqlJson(contextualReplySamplesSql).catch(err => {
            console.warn('[content-radar] contextual reply samples query failed:', err.message);
            return [];
        }),
    ]);

    const sourceCounts = {
        windowDays: days,
        igMessages: igMessages.length,
        clientMessages: clientMessages.length,
        clientMemory: clientMemory.length,
        igContentInteractions: igContentInteractions.length,
        igContentItems: igContentItems.length,
        igContentPerformance: igContentPerformance.length,
        contextualReplySamples: contextualReplySamples.length,
    };

    return {
        sourceCounts,
        igMessages: igMessages.map(row => ({ ...row, text: cleanText(row.text, 700) })),
        clientMessages: clientMessages.map(row => ({ ...row, text: cleanText(row.text, 700) })),
        clientMemory: clientMemory.map(row => ({ ...row, text: cleanText(row.text, 900) })),
        igContentInteractions: igContentInteractions.map(row => ({
            ...row,
            text: cleanText([row.summary, row.text].filter(Boolean).join(' | '), 900),
        })),
        igContentItems: igContentItems.map(row => ({
            ...row,
            text: cleanText([
                row.summary,
                Array.isArray(row.topics) && row.topics.length ? `topics: ${row.topics.join(', ')}` : '',
            ].filter(Boolean).join(' | '), 900),
        })),
        igContentPerformance: igContentPerformance.map(row => {
            const interactionCount = safeCount(row.interaction_count);
            const commentCount = safeCount(row.comment_count);
            const storyReplyCount = safeCount(row.story_reply_count);
            const metrics = [
                `${interactionCount} replies/comments`,
                commentCount ? `${commentCount} comments` : '',
                storyReplyCount ? `${storyReplyCount} story replies` : '',
                row.reach_or_impressions ? `reach/impressions: ${row.reach_or_impressions}` : '',
                row.plays_or_views ? `plays/views: ${row.plays_or_views}` : '',
            ].filter(Boolean).join(', ');
            return {
                ...row,
                text: cleanText([
                    `${row.content_type || 'content'}${row.media_type ? `/${row.media_type}` : ''}`,
                    row.summary || row.caption,
                    Array.isArray(row.topics) && row.topics.length ? `topics: ${row.topics.join(', ')}` : '',
                    metrics,
                    row.sample_reactions ? `recent reactions: ${row.sample_reactions}` : '',
                ].filter(Boolean).join(' | '), 1100),
            };
        }),
        contextualReplySamples: contextualReplySamples.map(row => ({
            ...row,
            text: cleanText([
                `${row.event_type || 'reply'} on ${row.content_type || 'IG content'}`,
                row.content_context ? `content: ${row.content_context}` : '',
                row.text ? `inbound: ${row.text}` : '',
                row.lead_stage ? `lead stage: ${row.lead_stage}` : '',
                Array.isArray(row.topics) && row.topics.length ? `topics: ${row.topics.join(', ')}` : '',
            ].filter(Boolean).join(' | '), 1100),
        })),
    };
}

async function generateRadarModel(sources, windowDays) {
    const prompt = buildContentRadarPrompt(sources, windowDays);
    try {
        const raw = await callGeminiFallback(
            [{ role: 'user', parts: [{ text: prompt }] }],
            { maxOutputTokens: 3800, temperature: 0.35, responseMimeType: 'application/json' }
        );
        const parsed = parseJsonMaybe(raw);
        if (!parsed) {
            const fallback = buildFallbackResult(sources.sourceCounts);
            return {
                ...fallback,
                raw: { ...fallback.raw, parse_failed: true, preview: truncate(raw, 600) },
            };
        }
        const normalized = normalizeModelResult(parsed, {
            summary: `Mined ${sources.sourceCounts.igMessages + sources.sourceCounts.clientMessages} recent DMs plus IG content reactions.`,
        });
        if (!normalized.ideas.length) return buildFallbackResult(sources.sourceCounts);
        return normalized;
    } catch (err) {
        console.warn('[content-radar] model generation failed:', err.message);
        const fallback = buildFallbackResult(sources.sourceCounts);
        return {
            ...fallback,
            raw: { ...fallback.raw, model_error: truncate(err.message, 400) },
        };
    }
}

async function storeRadarRun({ coachId, windowDays, generatedBy, sources, result }) {
    const rows = await supabaseQuery('content_radar_runs', {
        method: 'POST',
        body: [{
            coach_id: coachId,
            window_days: windowDays,
            status: 'completed',
            summary: result.summary || '',
            source_counts: sources.sourceCounts,
            themes: result.themes || [],
            raw_model: result.raw || {},
            generated_by: generatedBy,
        }],
        prefer: 'return=representation',
    });
    const run = rows[0];
    if (!run?.id) throw new Error('Content Radar run insert failed');

    const itemRows = buildItemRows({
        runId: run.id,
        coachId,
        ideas: result.ideas || [],
    });

    let items = [];
    if (itemRows.length) {
        items = await supabaseQuery('content_radar_items', {
            method: 'POST',
            body: itemRows,
            prefer: 'return=representation',
        });
    }

    return { run, items };
}

function buildItemRows({ runId, coachId, ideas }) {
    return (ideas || []).map((idea, index) => ({
        run_id: runId,
        coach_id: coachId,
        rank: idea.rank || index + 1,
        idea_type: idea.idea_type || 'other',
        title: idea.title || `Content idea ${index + 1}`,
        hook: idea.hook || null,
        angle: idea.angle || null,
        talking_points: idea.talking_points || [],
        script: idea.script || null,
        caption: idea.caption || null,
        cta: idea.cta || null,
        source_theme: idea.source_theme || null,
        source_mix: idea.source_mix || [],
        evidence: idea.evidence || [],
        privacy_note: idea.privacy_note || null,
        priority: idea.priority || 'medium',
    }));
}

async function loadLatest(coachId) {
    const safeCoachId = sqlUuid(coachId, 'coachId');
    const runs = await supabaseQuery(
        `content_radar_runs?select=*&coach_id=eq.${safeCoachId}&order=created_at.desc&limit=1`
    );
    const run = runs[0] || null;
    if (!run) return { run: null, items: [] };
    let items = await supabaseQuery(
        `content_radar_items?select=*&run_id=eq.${encodeURIComponent(run.id)}&order=rank.asc,created_at.asc`
    );
    if (!items.length) items = await backfillItemsFromRawRun(run);
    return { run, items };
}

async function backfillItemsFromRawRun(run) {
    const normalized = normalizeModelResult(run.raw_model || {}, { summary: run.summary || '' });
    const itemRows = buildItemRows({
        runId: run.id,
        coachId: run.coach_id,
        ideas: normalized.ideas || [],
    });
    if (!itemRows.length) return [];
    try {
        return await supabaseQuery('content_radar_items', {
            method: 'POST',
            body: itemRows,
            prefer: 'return=representation',
        });
    } catch (err) {
        console.warn('[content-radar] raw item backfill failed:', err.message);
        return [];
    }
}

async function updateItemStatus({ coachId, itemId, status }) {
    const safeCoachId = sqlUuid(coachId, 'coachId');
    const safeItemId = sqlUuid(itemId, 'itemId');
    const nextStatus = ['idea', 'saved', 'used', 'dismissed'].includes(status) ? status : 'idea';
    const rows = await supabaseQuery(
        `content_radar_items?id=eq.${safeItemId}&coach_id=eq.${safeCoachId}`,
        {
            method: 'PATCH',
            body: { status: nextStatus },
            prefer: 'return=representation',
        }
    );
    return rows[0] || null;
}

exports.handler = async (event = {}) => {
    if (event.httpMethod !== 'POST') {
        return json(405, { error: 'Method not allowed' });
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return json(500, { error: 'Server misconfigured' });
    }

    const body = parseBody(event);
    const caller = await resolveCaller(event, body);
    if (caller.response) return caller.response;

    const coachId = sqlUuid(
        caller.generatedBy === 'scheduled' ? caller.user?.id : (body.coachId || caller.user?.id),
        'coachId'
    );
    if (caller.generatedBy === 'manual' && coachId !== caller.user?.id) {
        return json(403, { error: 'Forbidden' });
    }

    const action = caller.generatedBy === 'scheduled'
        ? 'generate'
        : String(body.action || 'latest').toLowerCase();
    const windowDays = clampWindowDays(body.windowDays || body.window_days || 30);

    if (action === 'update-item') {
        const item = await updateItemStatus({ coachId, itemId: body.itemId, status: body.status });
        return json(200, { ok: true, item });
    }

    if (action === 'latest') {
        const latest = await loadLatest(coachId);
        return json(200, { ok: true, ...latest });
    }

    if (action !== 'generate') {
        return json(400, { error: 'Unknown action' });
    }

    const sources = await collectSources(coachId, windowDays);
    const result = await generateRadarModel(sources, windowDays);
    const stored = await storeRadarRun({
        coachId,
        windowDays,
        generatedBy: caller.generatedBy,
        sources,
        result,
    });

    return json(200, {
        ok: true,
        ...(caller.generatedBy === 'scheduled'
            ? { generated: true }
            : {
                run: stored.run,
                items: stored.items,
                sourceCounts: sources.sourceCounts,
            }),
    });
};

module.exports._test = {
    collectSources,
    generateRadarModel,
    sqlUuid,
    sqlText,
};

/**
 * Daily Message Learning
 *
 * Nightly safety net for the coach DM learning loop. Send paths usually fire
 * edit-learning and memory extraction immediately, but scheduled/manual sends,
 * timeouts, legacy paths, or trigger failures can leave sent alerts unanalyzed.
 *
 * This job scans recent sent coach_alerts and replays:
 *   1. edit learning for all sent client/lead alerts with a draft + final text
 *   2. client_memory extraction for in-app client conversation turns
 *
 * Cold IG/FB lead memory is still handled by extract-ig-thread-memory, which
 * reads ig_messages directly and updates ig_threads/client_memory.
 */

const SITE_URL = process.env.URL || process.env.SITE_URL || 'https://plantbased-balance.org';
const DEFAULT_LOOKBACK_HOURS = Number(process.env.DAILY_MESSAGE_LEARNING_LOOKBACK_HOURS || 30);
const MAX_ALERTS_PER_RUN = Number(process.env.DAILY_MESSAGE_LEARNING_MAX_ALERTS || 120);
const MAX_EDIT_ANALYSES = Number(process.env.DAILY_MESSAGE_LEARNING_MAX_EDIT_ANALYSES || 18);
const MAX_MEMORY_EXTRACTIONS = Number(process.env.DAILY_MESSAGE_LEARNING_MAX_MEMORY_EXTRACTIONS || 18);
const MIN_REMAINING_MS = Number(process.env.DAILY_MESSAGE_LEARNING_MIN_REMAINING_MS || 4500);
const RUN_BUDGET_MS = Number(process.env.DAILY_MESSAGE_LEARNING_BUDGET_MS || 25000);

const {
    supabaseQuery,
    analyzeCoachEditAndUpdatePrompt,
    normalizeCoachDraftText,
    truncate,
} = require('./_lib/client-context');

const CLIENT_MEMORY_ALERT_TYPES = new Set([
    'incoming_dm',
    'unread_message',
    'win_to_celebrate',
]);

function json(statusCode, body) {
    return {
        statusCode,
        body: JSON.stringify(body),
    };
}

function clampInt(value, fallback, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
}

function parseBody(event) {
    if (!event?.body) return {};
    try {
        return JSON.parse(event.body);
    } catch {
        return {};
    }
}

function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function alertData(alert) {
    return safeObject(alert?.data);
}

function sentMessageFor(alert) {
    const data = alertData(alert);
    return normalizeCoachDraftText(data.sent_message || data.auto_sent_message || '').trim();
}

function draftTextFor(alert) {
    const data = alertData(alert);
    return normalizeCoachDraftText(
        data.draft_text
        || data.scheduled_reply_text
        || alert?.scheduled_reply_text
        || alert?.suggested_message
        || ''
    ).trim();
}

function hasEditAnalysis(alert) {
    const analysis = alertData(alert).edit_analysis;
    return !!(analysis && typeof analysis === 'object' && analysis.analyzed_at);
}

function shouldRunEditAnalysis(alert, { force = false } = {}) {
    if (force) return true;
    if (hasEditAnalysis(alert)) return false;
    return !!(draftTextFor(alert) && sentMessageFor(alert));
}

function shouldRunClientMemoryExtraction(alert, { force = false } = {}) {
    const data = alertData(alert);
    if (!alert?.coach_id || !alert?.client_id) return false;
    if (!CLIENT_MEMORY_ALERT_TYPES.has(alert.alert_type)) return false;
    if (!sentMessageFor(alert)) return false;
    if (!force && data.client_memory_extracted_at) return false;
    return true;
}

async function markClientMemoryExtraction(alertId, patch) {
    const rows = await supabaseQuery(`coach_alerts?select=data&id=eq.${encodeURIComponent(alertId)}&limit=1`);
    const current = safeObject(rows[0]?.data);
    await supabaseQuery(`coach_alerts?id=eq.${encodeURIComponent(alertId)}`, {
        method: 'PATCH',
        body: { data: { ...current, ...patch } },
        prefer: 'return=minimal',
    });
}

async function runClientMemoryExtraction(alertId) {
    const response = await fetch(`${SITE_URL}/.netlify/functions/extract-client-memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId }),
    });
    const text = await response.text();
    let payload = {};
    try {
        payload = text ? JSON.parse(text) : {};
    } catch {
        payload = { raw: truncate(text, 500) };
    }
    if (!response.ok) {
        throw new Error(`extract-client-memory ${response.status}: ${truncate(text, 500)}`);
    }
    await markClientMemoryExtraction(alertId, {
        client_memory_extracted_at: new Date().toISOString(),
        client_memory_extraction_result: payload,
    });
    return payload;
}

async function loadSentAlerts({ lookbackHours, maxAlerts }) {
    const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();
    return supabaseQuery(
        `coach_alerts?select=id,client_id,client_name,coach_id,alert_type,suggested_message,scheduled_reply_text,created_at,actioned_at,data` +
        `&status=eq.sent` +
        `&data->>sent_message=not.is.null` +
        `&actioned_at=gte.${encodeURIComponent(since)}` +
        `&order=actioned_at.asc` +
        `&limit=${maxAlerts}`
    );
}

async function runDailyMessageLearning(options = {}) {
    const startedAt = Date.now();
    const lookbackHours = clampInt(options.lookbackHours, DEFAULT_LOOKBACK_HOURS, 1, 168);
    const maxAlerts = clampInt(options.maxAlerts, MAX_ALERTS_PER_RUN, 1, 500);
    const maxEditAnalyses = clampInt(options.maxEditAnalyses, MAX_EDIT_ANALYSES, 0, 80);
    const maxMemoryExtractions = clampInt(options.maxMemoryExtractions, MAX_MEMORY_EXTRACTIONS, 0, 80);
    const force = options.force === true;

    const alerts = await loadSentAlerts({ lookbackHours, maxAlerts });
    const summary = {
        scanned: alerts.length,
        edit_candidates: 0,
        edit_analyzed: 0,
        edit_updated: 0,
        memory_candidates: 0,
        memory_processed: 0,
        memory_updated: 0,
        skipped: {
            already_analyzed: 0,
            no_draft_or_final: 0,
            edit_cap: 0,
            memory_cap: 0,
            time_budget: 0,
        },
        errors: [],
    };

    for (const alert of alerts) {
        const remainingMs = RUN_BUDGET_MS - (Date.now() - startedAt);
        if (remainingMs < MIN_REMAINING_MS) {
            summary.skipped.time_budget++;
            break;
        }

        const draftText = draftTextFor(alert);
        const sentMessage = sentMessageFor(alert);

        if (!force && hasEditAnalysis(alert)) {
            summary.skipped.already_analyzed++;
        } else if (!draftText || !sentMessage) {
            summary.skipped.no_draft_or_final++;
        } else if (shouldRunEditAnalysis(alert, { force })) {
            summary.edit_candidates++;
            if (summary.edit_analyzed >= maxEditAnalyses) {
                summary.skipped.edit_cap++;
            } else {
                try {
                    const result = await analyzeCoachEditAndUpdatePrompt({
                        alertId: alert.id,
                        draftText,
                        sentMessage,
                        source: force ? 'daily-message-learning-force' : 'daily-message-learning',
                    });
                    summary.edit_analyzed++;
                    if (result?.promptUpdated || result?.editAnalysis?.global_prompt_updated) {
                        summary.edit_updated++;
                    }
                } catch (error) {
                    summary.errors.push({
                        alertId: alert.id,
                        stage: 'edit_learning',
                        error: truncate(error.message || String(error), 300),
                    });
                }
            }
        }

        if (shouldRunClientMemoryExtraction(alert, { force })) {
            summary.memory_candidates++;
            if (summary.memory_processed >= maxMemoryExtractions) {
                summary.skipped.memory_cap++;
            } else {
                try {
                    const result = await runClientMemoryExtraction(alert.id);
                    summary.memory_processed++;
                    if (result?.updated) summary.memory_updated++;
                } catch (error) {
                    summary.errors.push({
                        alertId: alert.id,
                        stage: 'client_memory',
                        error: truncate(error.message || String(error), 300),
                    });
                }
            }
        }
    }

    return {
        ok: summary.errors.length === 0,
        source: 'daily-message-learning',
        lookback_hours: lookbackHours,
        force,
        duration_ms: Date.now() - startedAt,
        ...summary,
    };
}

exports.handler = async (event = {}) => {
    const body = parseBody(event);
    try {
        const result = await runDailyMessageLearning({
            lookbackHours: body.lookbackHours,
            maxAlerts: body.maxAlerts,
            maxEditAnalyses: body.maxEditAnalyses,
            maxMemoryExtractions: body.maxMemoryExtractions,
            force: body.force === true,
        });
        return json(200, result);
    } catch (error) {
        console.error('[daily-message-learning] failed:', error);
        return json(500, {
            ok: false,
            error: error.message || String(error),
        });
    }
};

exports._test = {
    CLIENT_MEMORY_ALERT_TYPES,
    draftTextFor,
    hasEditAnalysis,
    runDailyMessageLearning,
    sentMessageFor,
    shouldRunClientMemoryExtraction,
    shouldRunEditAnalysis,
};

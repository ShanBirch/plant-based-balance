/**
 * Story Comment Quality Audit
 *
 * Daily soft feedback loop for the native IG story commenter. This does not
 * block or throttle story outreach. It looks at sent native story comments and
 * the recipient's next replies, then creates one Needs You card when the reply
 * suggests the opener was confusing, mismatched, or aimed at the wrong context.
 */

const {
    supabaseQuery,
    insertCoachAlert,
    truncate,
} = require('./_lib/client-context');

const SOURCE = 'balance-story-comment-quality-audit';
const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';
const BRISBANE_TZ = 'Australia/Brisbane';
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const LOOKBACK_HOURS = Number(process.env.STORY_COMMENT_AUDIT_LOOKBACK_HOURS || 96);
const REPLY_WINDOW_HOURS = Number(process.env.STORY_COMMENT_AUDIT_REPLY_WINDOW_HOURS || 72);
const PRIOR_AUDIT_LOOKBACK_DAYS = Number(process.env.STORY_COMMENT_AUDIT_DEDUPE_DAYS || 14);
const MAX_OUTBOUND_MESSAGES = Number(process.env.STORY_COMMENT_AUDIT_MAX_OUTBOUNDS || 350);
const MAX_FINDINGS = Number(process.env.STORY_COMMENT_AUDIT_MAX_FINDINGS || 20);

function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function cleanText(value = '', max = 1000) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeHandle(value = '') {
    return cleanText(value, 120).replace(/^@+/, '').toLowerCase();
}

function brisbaneParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-AU', {
        timeZone: BRISBANE_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date).reduce((acc, p) => {
        acc[p.type] = p.value;
        return acc;
    }, {});
    return {
        dateKey: `${parts.year}-${parts.month}-${parts.day}`,
        hour: Number(parts.hour || 0),
    };
}

function inList(values = []) {
    return `(${values.map(value => `"${String(value || '').replace(/"/g, '')}"`).join(',')})`;
}

function priorityScore(priority = '') {
    return ({ urgent: 4, high: 3, medium: 2, low: 1 })[priority] || 0;
}

function containsDirectSecondPerson(comment = '') {
    return /\b(?:you|your|yours|u|ya)\b/i.test(comment);
}

function asksOwnedContext(comment = '') {
    const text = cleanText(comment, 300).toLowerCase();
    return /\b(?:your|you|how(?:'s|s| is| was)|did you|are you|were you|what are you|where were you|where was that|what was that|what breed|their name|their names|session|workout|lift|run|ride|game|trip|party|night|day)\b/.test(text);
}

function isIgnorableInbound(message = {}) {
    const source = String(message.source || '').toLowerCase();
    const text = cleanText(message.text || message.message || '', 200);
    if (!text) return true;
    if (/reaction|like/.test(source)) return true;
    if (/^(?:liked your message|reacted to your message)$/i.test(text)) return true;
    return false;
}

function classifyReplyConfusion({ outboundText = '', replyText = '', story = {} } = {}) {
    const out = cleanText(outboundText, 300);
    const reply = cleanText(replyText, 600);
    if (!out || !reply) return null;

    const directConfusionPatterns = [
        /\b(?:wdym|wym)\b/i,
        /\bwhat\s+(?:do|did)\s+(?:you|u)\s+mean\b/i,
        /\bwhat\s+are\s+you\s+(?:talking\s+about|meaning)\b/i,
        /\b(?:i\s+)?(?:don'?t|do\s+not|didn'?t|did\s+not)\s+(?:understand|get)\b/i,
        /\b(?:i'?m|im)\s+confused\b/i,
        /\bthat(?:'s|s| is)\s+confusing\b/i,
        /^(?:huh\??|what\?+|what|sorry\??|pardon\??|\?{2,})$/i,
        /\bwhat\s+is\s+that\s+supposed\s+to\s+mean\b/i,
    ];
    if (directConfusionPatterns.some(re => re.test(reply))) {
        return {
            signal: 'direct_confusion_reply',
            priority: 'high',
            reason: 'The recipient directly sounded confused by the story comment.',
        };
    }

    const wrongContextRe = /\b(?:not\s+(?:me|mine|my|ours|us)|wasn'?t\s+(?:me|mine|my|ours|us)|isn'?t\s+(?:me|mine|my|ours|us)|that(?:'s|s| is)\s+not\s+(?:me|mine|my|ours|us)|i\s+(?:just\s+)?(?:shared|reposted|reshared)\s+it|it(?:'s|s| is)\s+(?:a\s+)?repost|not\s+my\s+(?:dog|cat|pet|kid|baby|friend|session|workout|video|photo|post)|i\s+don'?t\s+know\s+(?:them|him|her|their\s+name|whose|where)|no\s+idea\s+(?:who|what|where|whose|sorry)?|wrong\s+person)\b/i;
    if (wrongContextRe.test(reply) && (asksOwnedContext(out) || containsDirectSecondPerson(out))) {
        return {
            signal: 'wrong_story_context_reply',
            priority: 'high',
            reason: 'The recipient corrected that the story/comment context was not theirs or not known to them.',
        };
    }

    const awkwardColdRe = /\b(?:do\s+i\s+know\s+you|who\s+are\s+you|why\s+(?:did|would)\s+you\s+(?:ask|say|comment)|that(?:'s|s| is)\s+(?:random|weird|odd)|bit\s+random|creepy)\b/i;
    if (awkwardColdRe.test(reply)) {
        return {
            signal: 'awkward_or_random_reply',
            priority: 'medium',
            reason: 'The recipient framed the comment as random or out of place.',
        };
    }

    const storyData = safeObject(story.data);
    const sharedFrom = normalizeHandle(storyData.shared_from_username || story.shared_from_username);
    if (sharedFrom && containsDirectSecondPerson(out) && /\b(?:not\s+me|not\s+mine|repost|shared|no\s+idea)\b/i.test(reply)) {
        return {
            signal: 'shared_story_owner_mismatch',
            priority: 'high',
            reason: 'The reply suggests the opener treated shared content as the account owner\'s own story.',
        };
    }

    return null;
}

function firstFlaggedReplyAfter({ outbound, inboundMessages = [], outboundMessages = [], alert = null, now = new Date() }) {
    const outMs = Date.parse(outbound.created_at || '');
    if (!Number.isFinite(outMs)) return null;
    const windowEnd = Math.min(now.getTime(), outMs + REPLY_WINDOW_HOURS * HOUR_MS);
    const nextOutMs = outboundMessages
        .filter(m => m.thread_id === outbound.thread_id && m.id !== outbound.id)
        .map(m => Date.parse(m.created_at || ''))
        .filter(ms => Number.isFinite(ms) && ms > outMs)
        .sort((a, b) => a - b)[0] || null;

    const candidates = inboundMessages
        .filter(m => m.thread_id === outbound.thread_id && !isIgnorableInbound(m))
        .map(m => ({ ...m, _ms: Date.parse(m.created_at || '') }))
        .filter(m => Number.isFinite(m._ms) && m._ms > outMs && m._ms <= windowEnd)
        .filter(m => !nextOutMs || m._ms < nextOutMs)
        .sort((a, b) => a._ms - b._ms);

    for (const reply of candidates) {
        const classification = classifyReplyConfusion({
            outboundText: outbound.text,
            replyText: reply.text,
            story: alert || {},
        });
        if (classification) {
            return { reply, classification };
        }
    }
    return null;
}

function buildFinding({ outbound, reply, classification, alert = null, thread = null }) {
    const data = safeObject(alert?.data);
    const handle = normalizeHandle(data.ig_username || thread?.ig_username || thread?.profile_name || alert?.client_name);
    const key = [
        outbound.id || outbound.alert_id || data.story_id || handle,
        reply.id || reply.created_at,
        classification.signal,
    ].filter(Boolean).join(':');
    return {
        issue_key: key,
        signal: classification.signal,
        priority: classification.priority,
        reason: classification.reason,
        ig_thread_id: outbound.thread_id || data.ig_thread_id || null,
        ig_username: handle || null,
        profile_name: thread?.profile_name || alert?.client_name || null,
        story_id: data.story_id || null,
        story_url: data.story_url || null,
        story_description: truncate(data.story_description || alert?.description || '', 260),
        story_visible_text: truncate(data.story_visible_text || '', 220),
        outbound_message_id: outbound.id || null,
        outbound_alert_id: outbound.alert_id || alert?.id || null,
        outbound_comment: truncate(outbound.text || alert?.suggested_message || '', 220),
        outbound_at: outbound.created_at || null,
        reply_message_id: reply.id || null,
        reply_text: truncate(reply.text || '', 260),
        reply_at: reply.created_at || null,
    };
}

function summarizeFindings(findings = [], { dateKey } = {}) {
    const sorted = [...findings].sort((a, b) => priorityScore(b.priority) - priorityScore(a.priority));
    const selected = sorted.slice(0, MAX_FINDINGS);
    const overflow = Math.max(0, sorted.length - selected.length);
    const counts = sorted.reduce((acc, item) => {
        acc[item.priority] = (acc[item.priority] || 0) + 1;
        acc.by_signal[item.signal] = (acc.by_signal[item.signal] || 0) + 1;
        return acc;
    }, { high: 0, medium: 0, low: 0, by_signal: {} });
    const lines = selected.map((item, index) => {
        const who = item.ig_username ? `@${item.ig_username}` : (item.profile_name || 'unknown lead');
        const context = item.story_description ? ` Story: ${item.story_description}` : '';
        return [
            `${index + 1}. [${String(item.priority || 'medium').toUpperCase()}] ${who}: ${item.reason}`,
            `   Comment: "${item.outbound_comment}"`,
            `   Reply: "${item.reply_text}"`,
            context ? `  ${context}` : '',
        ].filter(Boolean).join('\n');
    });
    if (overflow > 0) lines.push(`Plus ${overflow} more item${overflow === 1 ? '' : 's'} not shown here.`);
    return {
        counts,
        text: [
            `Story comment relevance audit for ${dateKey}.`,
            '',
            ...lines,
            '',
            'Goal: review the replies and update the bot patterns if needed. Do not shut down normal story outreach, this is just catching comments that clearly confused someone.',
        ].join('\n'),
    };
}

function buildAuditAlert({ coachId, findings = [], dateKey, now = new Date() }) {
    const summary = summarizeFindings(findings, { dateKey });
    const title = findings.length === 1
        ? 'Story comment audit: 1 reply needs eyes'
        : `Story comment audit: ${findings.length} replies need eyes`;
    const priority = summary.counts.high ? 'high' : 'medium';
    return {
        coach_id: coachId,
        client_id: null,
        client_name: 'Story Comment Audit',
        alert_type: 'weekly_checkin',
        priority,
        title,
        description: summary.counts.high
            ? `${summary.counts.high} high-signal confused story replies found.`
            : 'Story comment replies need a quick relevance check.',
        suggested_message: summary.text,
        status: 'pending',
        data: {
            subtype: 'story_comment_quality_audit',
            story_comment_quality_audit: true,
            story_comment_quality_audit_source: SOURCE,
            date_key: dateKey,
            finding_counts: summary.counts,
            findings: findings.slice(0, MAX_FINDINGS),
            issue_keys: findings.map(f => f.issue_key).filter(Boolean).slice(0, 100),
            operator_queue: 'needs_you',
            needs_you_required: true,
            needs_you_reason: 'story comment replies suggest possible confusion or wrong context',
            needs_you_reasons: ['story_comment_relevance_audit'],
            client_manager_review_required: true,
            manual_checkin_roster: true,
            non_challenge_checkin: true,
            is_coach_note: true,
            drafted_at: now.toISOString(),
            codex_review: {
                source: SOURCE,
                decision: 'needs_you_story_comment_quality_audit',
                queue: 'needs_you',
                reason: 'Daily story comment audit found replies that may indicate confused or mismatched openers.',
                needs_shannon_approval: true,
                reviewed_at: now.toISOString(),
                automation_id: SOURCE,
                evidence_ids: findings.flatMap(f => [
                    f.outbound_alert_id ? `coach_alerts:${f.outbound_alert_id}` : '',
                    f.ig_thread_id ? `ig_threads:${f.ig_thread_id}` : '',
                    f.outbound_message_id ? `ig_messages:${f.outbound_message_id}` : '',
                    f.reply_message_id ? `ig_messages:${f.reply_message_id}` : '',
                ].filter(Boolean)).slice(0, 60),
            },
        },
    };
}

async function loadShannonCoachId() {
    const rows = await supabaseQuery(`users?select=id,email&email=eq.${encodeURIComponent(BALANCE_ADMIN_EMAIL)}&limit=1`);
    return rows[0]?.id || null;
}

async function loadRecentNativeStoryOutbounds(sinceIso) {
    return supabaseQuery(
        `ig_messages?select=id,thread_id,direction,text,source,created_at,alert_id&direction=eq.out&source=eq.native_story_comment&created_at=gte.${sinceIso}&order=created_at.desc&limit=${MAX_OUTBOUND_MESSAGES}`
    ).catch(() => []);
}

async function loadAlertsById(alertIds = []) {
    const out = new Map();
    const unique = [...new Set(alertIds.filter(Boolean))];
    for (let i = 0; i < unique.length; i += 80) {
        const chunk = unique.slice(i, i + 80);
        const rows = await supabaseQuery(
            `coach_alerts?select=id,client_name,description,suggested_message,status,created_at,actioned_at,data&id=in.${inList(chunk)}&limit=120`
        ).catch(() => []);
        rows.forEach(row => out.set(row.id, row));
    }
    return out;
}

async function loadThreadsById(threadIds = []) {
    const out = new Map();
    const unique = [...new Set(threadIds.filter(Boolean))];
    for (let i = 0; i < unique.length; i += 80) {
        const chunk = unique.slice(i, i + 80);
        const rows = await supabaseQuery(
            `ig_threads?select=id,ig_username,profile_name,channel,last_inbound_at,last_outbound_at,custom_data&id=in.${inList(chunk)}&limit=120`
        ).catch(() => []);
        rows.forEach(row => out.set(row.id, row));
    }
    return out;
}

async function loadInboundMessages(threadIds = [], sinceIso) {
    const rows = [];
    const unique = [...new Set(threadIds.filter(Boolean))];
    for (let i = 0; i < unique.length; i += 80) {
        const chunk = unique.slice(i, i + 80);
        const found = await supabaseQuery(
            `ig_messages?select=id,thread_id,direction,text,source,created_at,alert_id&thread_id=in.${inList(chunk)}&direction=eq.in&created_at=gte.${sinceIso}&order=created_at.asc&limit=900`
        ).catch(() => []);
        rows.push(...found);
    }
    return rows;
}

async function loadPriorIssueKeys(coachId, now = new Date()) {
    const sinceIso = new Date(now.getTime() - PRIOR_AUDIT_LOOKBACK_DAYS * DAY_MS).toISOString();
    const rows = await supabaseQuery(
        `coach_alerts?select=id,data&coach_id=eq.${coachId}&created_at=gte.${sinceIso}&data->>subtype=eq.story_comment_quality_audit&limit=100`
    ).catch(() => []);
    const keys = new Set();
    rows.forEach(row => {
        const data = safeObject(row.data);
        (Array.isArray(data.issue_keys) ? data.issue_keys : []).forEach(key => {
            if (key) keys.add(String(key));
        });
        (Array.isArray(data.findings) ? data.findings : []).forEach(item => {
            if (item?.issue_key) keys.add(String(item.issue_key));
        });
    });
    return keys;
}

async function findExistingAudit(coachId, dateKey) {
    const key = `story_comment_quality_audit:${coachId}:${dateKey}`;
    const rows = await supabaseQuery(
        `coach_alerts?select=id,status,data&idempotency_key=eq.${encodeURIComponent(key)}&limit=1`
    ).catch(() => []);
    return rows[0] || null;
}

async function upsertAuditAlert({ coachId, dateKey, findings, now }) {
    if (!findings.length) return { alertId: null, inserted: false, updated: false, skipped: 'no_findings' };
    const key = `story_comment_quality_audit:${coachId}:${dateKey}`;
    const alert = buildAuditAlert({ coachId, findings, dateKey, now });
    const existing = await findExistingAudit(coachId, dateKey);
    if (existing?.id && existing.status === 'pending') {
        await supabaseQuery(`coach_alerts?id=eq.${encodeURIComponent(existing.id)}&status=eq.pending`, {
            method: 'PATCH',
            body: {
                priority: alert.priority,
                title: alert.title,
                description: alert.description,
                suggested_message: alert.suggested_message,
                data: { ...safeObject(existing.data), ...alert.data, updated_at: now.toISOString() },
            },
            prefer: 'return=minimal',
        });
        return { alertId: existing.id, inserted: false, updated: true };
    }
    if (existing?.id) return { alertId: existing.id, inserted: false, updated: false, skipped: `existing_${existing.status}` };
    const result = await insertCoachAlert(alert, key);
    return { alertId: result.alertId, inserted: !result.deduped, updated: false, deduped: result.deduped };
}

async function runStoryCommentQualityAudit({ now = new Date(), write = true } = {}) {
    const started = Date.now();
    const { dateKey } = brisbaneParts(now);
    const coachId = await loadShannonCoachId();
    if (!coachId) return { ok: true, date_key: dateKey, scanned: 0, findings: 0, skipped: 'no_coach' };

    const sinceIso = new Date(now.getTime() - LOOKBACK_HOURS * HOUR_MS).toISOString();
    const outbounds = await loadRecentNativeStoryOutbounds(sinceIso);
    const alertIds = outbounds.map(m => m.alert_id).filter(Boolean);
    const threadIds = outbounds.map(m => m.thread_id).filter(Boolean);
    const [alertsById, threadsById, inboundMessages, priorIssueKeys] = await Promise.all([
        loadAlertsById(alertIds),
        loadThreadsById(threadIds),
        loadInboundMessages(threadIds, sinceIso),
        loadPriorIssueKeys(coachId, now),
    ]);

    const findings = [];
    for (const outbound of outbounds) {
        if (!outbound.thread_id || !cleanText(outbound.text)) continue;
        const alert = outbound.alert_id ? alertsById.get(outbound.alert_id) : null;
        const flagged = firstFlaggedReplyAfter({
            outbound,
            inboundMessages,
            outboundMessages: outbounds,
            alert,
            now,
        });
        if (!flagged) continue;
        const finding = buildFinding({
            outbound,
            reply: flagged.reply,
            classification: flagged.classification,
            alert,
            thread: threadsById.get(outbound.thread_id) || null,
        });
        if (finding.issue_key && priorIssueKeys.has(finding.issue_key)) continue;
        findings.push(finding);
    }

    findings.sort((a, b) => priorityScore(b.priority) - priorityScore(a.priority));
    const selected = findings.slice(0, MAX_FINDINGS);
    const alertWrite = write
        ? await upsertAuditAlert({ coachId, dateKey, findings: selected, now })
        : {
            alertId: null,
            inserted: false,
            updated: false,
            skipped: selected.length ? 'dry_run' : 'no_findings',
        };
    return {
        ok: true,
        dry_run: !write,
        date_key: dateKey,
        scanned: outbounds.length,
        replies_scanned: inboundMessages.length,
        findings: findings.length,
        inserted_findings: selected.length,
        audit_alert: alertWrite,
        elapsed_ms: Date.now() - started,
    };
}

exports.handler = async (event = {}) => {
    try {
        const qs = event.queryStringParameters || {};
        const dryRun = qs.dry_run === '1' || qs.dryRun === '1' || qs.dry_run === 'true' || qs.dryRun === 'true';
        const result = await runStoryCommentQualityAudit({ write: !dryRun });
        return { statusCode: 200, body: JSON.stringify(result) };
    } catch (error) {
        console.error('[story-comment-quality-audit] failed:', error);
        return { statusCode: 500, body: JSON.stringify({ ok: false, error: error.message || String(error) }) };
    }
};

exports._test = {
    SOURCE,
    brisbaneParts,
    asksOwnedContext,
    classifyReplyConfusion,
    firstFlaggedReplyAfter,
    buildFinding,
    summarizeFindings,
    buildAuditAlert,
    runStoryCommentQualityAudit,
};

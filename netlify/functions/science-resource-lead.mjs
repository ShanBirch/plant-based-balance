import growthOutcomes from "./_lib/growth-outcomes.js";

const {
    recordGrowthOutcome,
} = growthOutcomes;

const SUPABASE_URL =
    getEnv("SUPABASE_URL")
    || getEnv("VITE_SUPABASE_URL")
    || "https://hzapaorxqboevxnumxkv.supabase.co";
const SUPABASE_SERVICE_KEY =
    getEnv("SUPABASE_SERVICE_ROLE_KEY")
    || getEnv("SUPABASE_SERVICE_KEY");

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getEnv(name) {
    const netlifyEnv = globalThis.Netlify?.env?.get?.(name);
    const processEnv = globalThis.process?.env?.[name];
    return String(netlifyEnv || processEnv || "").trim();
}

function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
    };
}

function json(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: corsHeaders(),
    });
}

function cleanString(value, max = 1000) {
    return String(value || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max);
}

function cleanMultiline(value, max = 2500) {
    return String(value || "")
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, max);
}

function cleanEmail(value) {
    return cleanString(value, 320).toLowerCase();
}

function normalizeIgHandle(value) {
    return cleanString(value, 120)
        .replace(/^@+/, "")
        .replace(/\s+/g, "")
        .toLowerCase();
}

function safeUuid(value) {
    const clean = cleanString(value, 80);
    return UUID_RE.test(clean) ? clean : null;
}

function cleanStringArray(value, maxItems = 8, max = 120) {
    const raw = Array.isArray(value)
        ? value
        : String(value || "").split(/[,;\n|]/);
    return raw.map(item => cleanString(item, max)).filter(Boolean).slice(0, maxItems);
}

function sourceForResource(resourceSlug) {
    const slug = cleanString(resourceSlug || "science-resource", 120)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    return `science_resource_${slug || "resource"}`;
}

function compactAnswers(answers = {}) {
    const support = Array.isArray(answers.support)
        ? answers.support.map(item => cleanString(item, 120)).filter(Boolean).slice(0, 8)
        : [];
    return {
        goal: cleanString(answers.goal, 180),
        diet_style: cleanString(answers.diet_style, 180),
        training_days: cleanString(answers.training_days, 120),
        hard_part: cleanMultiline(answers.hard_part, 800),
        current_setup: cleanMultiline(answers.current_setup, 800),
        support,
        wants_challenge: cleanString(answers.wants_challenge, 80),
    };
}

export function buildAboutMe(payload = {}) {
    const resourceSlug = cleanString(payload.resource_slug || "free-will-willpower", 120);
    const resourceTitle = cleanString(payload.resource_title || "Free will, willpower, and fitness behaviour", 220);
    const step = cleanString(payload.step || "email", 60);
    const answers = compactAnswers(payload.answers || {});

    const lines = [
        "Science resource lead",
        `Resource: ${resourceTitle}`,
        `Slug: ${resourceSlug}`,
        `Step: ${step}`,
    ];

    if (answers.goal) lines.push(`Goal: ${answers.goal}`);
    if (answers.diet_style) lines.push(`Nutrition style: ${answers.diet_style}`);
    if (answers.training_days) lines.push(`Training days: ${answers.training_days}`);
    if (answers.hard_part) lines.push(`Hardest behaviour: ${answers.hard_part}`);
    if (answers.current_setup) lines.push(`Current setup: ${answers.current_setup}`);
    if (answers.support.length) lines.push(`Useful support: ${answers.support.join(", ")}`);
    if (answers.wants_challenge) lines.push(`Challenge interest: ${answers.wants_challenge}`);

    return lines.join("\n").slice(0, 2000);
}

export function buildInvitationRow(payload = {}) {
    const resourceSlug = cleanString(payload.resource_slug || "free-will-willpower", 120);
    const email = cleanEmail(payload.email);
    const source = sourceForResource(resourceSlug);

    return {
        email,
        cohort_type: cleanString(payload.cohort_type || "transform_30", 80),
        source,
        name: cleanString(payload.name, 160) || null,
        ig_handle: normalizeIgHandle(payload.instagram || payload.ig_handle) || null,
        about_me: buildAboutMe(payload),
        utm_source: cleanString(payload.utm_source, 128) || null,
        utm_medium: cleanString(payload.utm_medium, 128) || null,
        utm_campaign: cleanString(payload.utm_campaign, 128) || null,
        referrer: cleanString(payload.referrer, 500) || null,
    };
}

export function buildGrowthLeadKey(payload = {}, row = buildInvitationRow(payload)) {
    const botAccount = cleanString(payload.bot_account || payload.botAccount || "shan_n_sunny", 120);
    const handle = normalizeIgHandle(payload.instagram || payload.ig_handle || row.ig_handle);
    const fromId = cleanString(payload.from_ig_user_id || payload.fromIgUserId, 180);
    return [
        botAccount,
        fromId || handle || row.email,
        row.source,
    ].filter(Boolean).join(":").toLowerCase();
}

export function buildGrowthLeadRow(payload = {}, row = buildInvitationRow(payload), now = new Date().toISOString()) {
    const answers = compactAnswers(payload.answers || {});
    const interests = cleanStringArray([
        row.source,
        answers.goal,
        answers.diet_style,
        ...answers.support,
    ]);
    return {
        lead_key: buildGrowthLeadKey(payload, row),
        owner_ig_user_id: cleanString(payload.owner_ig_user_id || payload.ownerIgUserId, 180) || null,
        campaign_id: safeUuid(payload.campaign_id || payload.campaignId),
        from_ig_user_id: cleanString(payload.from_ig_user_id || payload.fromIgUserId, 180) || null,
        from_username: normalizeIgHandle(payload.instagram || payload.ig_handle || row.ig_handle) || null,
        first_keyword: cleanString(payload.keyword || payload.matched_keyword || payload.matchedKeyword, 120) || null,
        source_media_id: cleanString(payload.ig_media_id || payload.igMediaId, 180) || null,
        status: "qualified",
        business_type: cleanString(answers.diet_style, 180) || null,
        notes: buildAboutMe(payload),
        last_private_reply_at: cleanString(payload.private_reply_sent_at || payload.privateReplySentAt, 80) || null,
        last_inbound_at: now,
        ig_thread_id: safeUuid(payload.ig_thread_id || payload.igThreadId),
        email: row.email,
        email_consent_at: now,
        dm_problem: cleanMultiline(answers.hard_part || answers.current_setup, 800) || null,
        content_interests: interests,
        questionnaire: {
            resource_slug: cleanString(payload.resource_slug || "free-will-willpower", 120),
            resource_title: cleanString(payload.resource_title || "Free will, willpower, and fitness behaviour", 220),
            answers,
            wants_challenge: answers.wants_challenge || null,
        },
        last_submission_at: now,
        metadata: {
            bot_account: cleanString(payload.bot_account || payload.botAccount || "shan_n_sunny", 120),
            source: row.source,
            resource_slug: cleanString(payload.resource_slug || "free-will-willpower", 120),
            resource_title: cleanString(payload.resource_title || "", 220) || null,
            invitation_source: "science_resource_lead",
            utm_source: row.utm_source,
            utm_medium: row.utm_medium,
            utm_campaign: row.utm_campaign,
            referrer: row.referrer,
        },
    };
}

export function buildGrowthSubmissionRow(payload = {}, row = buildInvitationRow(payload), leadId = null, invitationId = null, now = new Date().toISOString()) {
    const answers = compactAnswers(payload.answers || {});
    return {
        submission_key: `science_resource:${row.source}:${row.email}`,
        campaign_id: safeUuid(payload.campaign_id || payload.campaignId),
        lead_id: safeUuid(leadId),
        owner_ig_user_id: cleanString(payload.owner_ig_user_id || payload.ownerIgUserId, 180) || null,
        bot_account: cleanString(payload.bot_account || payload.botAccount || "shan_n_sunny", 120),
        from_ig_user_id: cleanString(payload.from_ig_user_id || payload.fromIgUserId, 180) || null,
        from_username: normalizeIgHandle(payload.instagram || payload.ig_handle || row.ig_handle) || null,
        email: row.email,
        email_consent: payload.email_consent === false ? false : true,
        email_consent_at: payload.email_consent === false ? null : now,
        business_type: cleanString(answers.diet_style, 180) || null,
        dm_problem: cleanMultiline(answers.hard_part || answers.current_setup, 800) || null,
        content_interests: cleanStringArray([row.source, answers.goal, answers.diet_style, ...answers.support]),
        ig_content_preferences: cleanStringArray(payload.ig_content_preferences || payload.igContentPreferences),
        biggest_bottleneck: cleanMultiline(answers.hard_part, 800) || null,
        source_page: cleanString(payload.source_page || payload.sourcePage || payload.landing_url || payload.landingUrl || row.referrer, 500) || null,
        raw_payload: {
            resource_slug: cleanString(payload.resource_slug || "free-will-willpower", 120),
            resource_title: cleanString(payload.resource_title || "Free will, willpower, and fitness behaviour", 220),
            invitation_id: invitationId,
            answers,
            utm_source: row.utm_source,
            utm_medium: row.utm_medium,
            utm_campaign: row.utm_campaign,
            referrer: row.referrer,
            ig_media_id: cleanString(payload.ig_media_id || payload.igMediaId, 180) || null,
        },
    };
}

async function supabaseFetch(pathname, options = {}) {
    if (!SUPABASE_SERVICE_KEY) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
    }

    const res = await fetch(`${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/${pathname}`, {
        method: options.method || "GET",
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            "Content-Type": "application/json",
            Prefer: options.prefer || "return=representation",
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await res.text();
    if (!res.ok) {
        throw new Error(`Supabase ${res.status}: ${text.slice(0, 500)}`);
    }
    return text ? JSON.parse(text) : [];
}

function invitationLookupPath(row) {
    const params = new URLSearchParams({
        select: "id",
        email: `eq.${row.email}`,
        cohort_type: `eq.${row.cohort_type}`,
        source: `eq.${row.source}`,
        claimed_at: "is.null",
        order: "created_at.desc",
        limit: "1",
    });
    return `cohort_invitations?${params.toString()}`;
}

async function upsertGrowthLeadAndSubmission(payload, row, invitationId, mode) {
    const now = new Date().toISOString();
    const leadRows = await supabaseFetch("ig_growth_leads?on_conflict=lead_key", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=representation",
        body: [buildGrowthLeadRow(payload, row, now)],
    });
    const lead = leadRows?.[0] || null;
    const submissionRows = await supabaseFetch("ig_growth_lead_submissions?on_conflict=submission_key", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=representation",
        body: [buildGrowthSubmissionRow(payload, row, lead?.id || null, invitationId, now)],
    });
    const submission = submissionRows?.[0] || null;

    const common = {
        sourceSystem: "science_resource_lead",
        botAccount: payload.bot_account || payload.botAccount || "shan_n_sunny",
        leadKey: lead?.lead_key || buildGrowthLeadKey(payload, row),
        fromIgUserId: payload.from_ig_user_id || payload.fromIgUserId,
        fromUsername: payload.instagram || payload.ig_handle || row.ig_handle,
        email: row.email,
        igThreadId: payload.ig_thread_id || payload.igThreadId,
        contentItemId: payload.content_item_id || payload.contentItemId,
        campaignId: payload.campaign_id || payload.campaignId,
        igGrowthLeadId: lead?.id || null,
        igGrowthSubmissionId: submission?.id || null,
        cohortInvitationId: invitationId,
        sourceKey: row.source,
        igMediaId: payload.ig_media_id || payload.igMediaId,
        campaignSlug: row.source,
        landingUrl: payload.landing_url || payload.landingUrl || payload.source_page || payload.sourcePage,
        utmSource: row.utm_source,
        utmMedium: row.utm_medium,
        utmCampaign: row.utm_campaign,
        occurredAt: now,
        attribution: {
            resource_slug: payload.resource_slug || "free-will-willpower",
            resource_title: payload.resource_title || "Free will, willpower, and fitness behaviour",
            invitation_id: invitationId,
            mode,
        },
        rawPayload: {
            answers: compactAnswers(payload.answers || {}),
            source: row.source,
            submission_id: submission?.id || null,
            lead_id: lead?.id || null,
        },
    };

    await recordGrowthOutcome({
        ...common,
        eventType: "free_info_unlocked",
        eventKey: `science_resource:${row.source}:${row.email}:free_info_unlocked`,
    }, supabaseFetch);
    await recordGrowthOutcome({
        ...common,
        eventType: "email_captured",
        eventKey: `science_resource:${row.source}:${row.email}:email_captured`,
    }, supabaseFetch);

    return { leadId: lead?.id || null, submissionId: submission?.id || null };
}

export async function upsertScienceLead(payload) {
    const row = buildInvitationRow(payload);
    if (!VALID_EMAIL.test(row.email)) {
        return { status: 400, body: { ok: false, error: "valid_email_required" } };
    }

    const existing = await supabaseFetch(invitationLookupPath(row));
    if (Array.isArray(existing) && existing[0]?.id) {
        const id = encodeURIComponent(existing[0].id);
        const updated = await supabaseFetch(`cohort_invitations?id=eq.${id}`, {
            method: "PATCH",
            body: row,
        });
        let tracking = {};
        try {
            tracking = await upsertGrowthLeadAndSubmission(payload, row, updated?.[0]?.id || existing[0].id, "updated");
        } catch (error) {
            console.warn("[science-resource-lead] tracking upsert failed:", error?.message || error);
        }
        return {
            status: 200,
            body: {
                ok: true,
                mode: "updated",
                invitationId: updated?.[0]?.id || existing[0].id,
                source: row.source,
                tracking,
            },
        };
    }

    const inserted = await supabaseFetch("cohort_invitations", {
        method: "POST",
        body: [row],
    });
    let tracking = {};
    try {
        tracking = await upsertGrowthLeadAndSubmission(payload, row, inserted?.[0]?.id || null, "created");
    } catch (error) {
        console.warn("[science-resource-lead] tracking upsert failed:", error?.message || error);
    }
    return {
        status: 200,
        body: {
            ok: true,
            mode: "created",
            invitationId: inserted?.[0]?.id || null,
            source: row.source,
            tracking,
        },
    };
}

export default async function handler(req) {
    if (req.method === "OPTIONS") return new Response("", { status: 200, headers: corsHeaders() });
    if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

    let payload;
    try {
        payload = await req.json();
    } catch {
        return json(400, { ok: false, error: "invalid_json" });
    }

    try {
        const result = await upsertScienceLead(payload || {});
        return json(result.status, result.body);
    } catch (error) {
        console.error("[science-resource-lead] failed:", error?.message || error);
        return json(200, { ok: false, error: "lead_capture_failed" });
    }
}

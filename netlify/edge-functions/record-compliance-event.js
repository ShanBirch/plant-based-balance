const DOCUMENT_VERSIONS = {
  terms: "2026-05-19",
  privacy: "2026-05-19",
  client_agreement: "2026-05-19",
  refund_policy: "2026-05-19",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
    },
  });
}

function cleanString(value, maxLength = 2000) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

function cleanEmail(value) {
  const email = cleanString(value, 320);
  return email ? email.toLowerCase() : null;
}

function safeJson(value, fallback) {
  if (value && typeof value === "object") return value;
  return fallback;
}

function detectRiskFlags(profile = {}, screening = {}) {
  const flags = new Set();
  const joined = [
    screening.safety_notes,
    screening.injuries_or_limitations,
    screening.medical_conditions,
    screening.medications,
    screening.pregnancy_status,
    profile.health_screening_notes,
    profile.injuries,
    profile.medical_conditions,
    profile.medications,
    profile.pregnancy_status,
  ].filter(Boolean).join(" ").toLowerCase();

  const checks = [
    ["pregnancy_or_postpartum", /\bpregnan|postpartum|gave birth|breastfeeding/],
    ["injury_or_pain", /\binjur|pain|surgery|rehab|tear|fracture|sprain|back|knee|shoulder/],
    ["cardio_or_dizziness", /\bheart|chest pain|dizz|faint|blood pressure|palpitation/],
    ["medical_condition", /\bdiabetes|asthma|epilepsy|thyroid|pcos|endometriosis|arthritis|osteoporosis/],
    ["medication_disclosed", /\bmedication|medicine|ssri|antidepressant|insulin|thyroxine|blood thinner/],
    ["eating_disorder_risk", /\beating disorder|binge|purge|anorexia|bulimia/],
  ];

  checks.forEach(([flag, pattern]) => {
    if (pattern.test(joined)) flags.add(flag);
  });

  const age = Number(profile.age);
  if (Number.isFinite(age) && age >= 65) flags.add("older_adult_screening");

  return Array.from(flags);
}

async function supabaseInsert(path, rows) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Supabase is not configured");
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    },
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Supabase insert failed: ${response.status} ${text}`);
    error.status = response.status;
    error.body = text;
    throw error;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : [];
}

export default async (request, context) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  try {
    const body = await request.json();
    const profile = safeJson(body.profile, {});
    const screening = safeJson(body.screening, {});
    const eventType = cleanString(body.event_type || body.eventType, 80) || "unknown";
    const email = cleanEmail(body.email || profile.email);
    const name = cleanString(body.name || profile.name, 200);
    const userId = cleanString(body.user_id || body.userId, 80);
    const sourcePage = cleanString(body.source_page || body.sourcePage || request.headers.get("referer"), 500);
    const ipAddress = cleanString(
      request.headers.get("x-nf-client-connection-ip") || request.headers.get("client-ip"),
      80
    );
    const userAgent = cleanString(request.headers.get("user-agent"), 500);
    const metadata = safeJson(body.metadata, {});
    const documentVersions = {
      ...DOCUMENT_VERSIONS,
      ...safeJson(body.document_versions || body.documentVersions, {}),
    };

    const accepted = safeJson(body.accepted, {});
    const legalRows = await supabaseInsert("legal_acceptance_records", [{
      user_id: userId,
      email,
      name,
      event_type: eventType,
      source_page: sourcePage,
      plan_key: cleanString(body.plan_key || body.planKey, 120),
      accepted_terms: Boolean(accepted.terms ?? body.accepted_terms ?? body.acceptedTerms),
      accepted_privacy: Boolean(accepted.privacy ?? body.accepted_privacy ?? body.acceptedPrivacy),
      accepted_client_agreement: Boolean(accepted.client_agreement ?? body.accepted_client_agreement ?? body.acceptedClientAgreement),
      accepted_refund_policy: Boolean(accepted.refund_policy ?? body.accepted_refund_policy ?? body.acceptedRefundPolicy),
      marketing_consent: Boolean(body.marketing_consent ?? body.marketingConsent),
      health_data_consent: Boolean(body.health_data_consent ?? body.healthDataConsent),
      document_versions: documentVersions,
      metadata: {
        ...metadata,
        checkout_session_id: cleanString(body.checkout_session_id || body.checkoutSessionId, 200),
        amount: body.amount ?? null,
        order_bump: body.order_bump ?? body.orderBump ?? null,
      },
      ip_address: ipAddress,
      user_agent: userAgent,
      idempotency_key: cleanString(body.idempotency_key || body.idempotencyKey, 300),
    }]);

    const legalRecord = legalRows?.[0] || null;
    const hasHealthData = Boolean(body.health_data_consent ?? body.healthDataConsent)
      || Object.keys(profile).length > 0
      || Object.keys(screening).length > 0;

    let healthRecord = null;
    if (hasHealthData) {
      const healthRows = await supabaseInsert("health_screening_records", [{
        legal_acceptance_id: legalRecord?.id || null,
        user_id: userId,
        email,
        name,
        source_page: sourcePage,
        screening_status: "submitted",
        safety_notes: cleanString(screening.safety_notes || profile.health_screening_notes, 4000),
        injuries_or_limitations: cleanString(screening.injuries_or_limitations || profile.injuries_or_limitations, 2000),
        medical_conditions: cleanString(screening.medical_conditions || profile.medical_conditions, 2000),
        medications: cleanString(screening.medications || profile.medications, 2000),
        pregnancy_status: cleanString(screening.pregnancy_status || profile.pregnancy_status, 1000),
        emergency_contact: cleanString(screening.emergency_contact || profile.emergency_contact, 1000),
        responses: profile,
        risk_flags: detectRiskFlags(profile, screening),
      }]);
      healthRecord = healthRows?.[0] || null;
    }

    return jsonResponse({
      ok: true,
      legal_record_id: legalRecord?.id || null,
      health_screening_id: healthRecord?.id || null,
    });
  } catch (error) {
    console.error("record-compliance-event error:", error?.message || error);
    const isDuplicate = /duplicate key value|23505/.test(error?.message || "") || /23505/.test(error?.body || "");
    if (isDuplicate) {
      return jsonResponse({ ok: true, deduped: true });
    }
    return jsonResponse({ ok: false, error: error?.message || "Unable to record compliance event" }, 400);
  }
};

const {
    normalizeApprovalIdentity,
    verifyApprovalToken,
} = require('./_lib/ig-dispatch-approval-token');

const SUPABASE_URL = process.env.SUPABASE_URL
    || process.env.VITE_SUPABASE_URL
    || 'https://hzapaorxqboevxnumxkv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';
const STATE_FIELDS = ['cursor_start', 'cursor_current', 'cursor_end', 'next_resume', 'receipt'];
const BATCH_READ_FIELDS = ['next_resume', 'cursor_current', 'cursor_end', 'receipt', 'cursor_start'];

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify(body),
    };
}

function parseBody(event) {
    try {
        return event?.body ? JSON.parse(event.body) : {};
    } catch {
        return {};
    }
}

async function supabaseRequest(path, options = {}) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...options,
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!response.ok) {
        throw new Error(`Supabase ${response.status}: ${String(text).slice(0, 300)}`);
    }
    return body;
}

function approvalBatchFrom(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const batch = value.approval_batch;
    return batch && typeof batch === 'object' && !Array.isArray(batch) ? batch : null;
}

function batchIdentity(batch) {
    if (!batch) return null;
    return {
        batchId: String(batch.batch_id || batch.batchId || '').trim(),
        batchVersion: Number(batch.version || batch.batch_version || batch.batchVersion),
    };
}

function rowBatch(row) {
    for (const field of BATCH_READ_FIELDS) {
        const batch = approvalBatchFrom(row?.[field]);
        if (batch) return batch;
    }
    return null;
}

function matchesBatch(batch, identity) {
    const found = batchIdentity(batch);
    return found?.batchId === identity.batchId && found?.batchVersion === identity.batchVersion;
}

function expiryTimestamp(item = {}) {
    const evidence = item.expiry_evidence && typeof item.expiry_evidence === 'object'
        ? item.expiry_evidence
        : {};
    const value = item.expires_at
        || item.estimated_expires_at
        || item.story_expires_at
        || evidence.expires_at
        || evidence.estimated_expires_at
        || evidence.story_expires_at
        || '';
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : null;
}

function isBatchExpired(batch, nowMs = Date.now()) {
    const directExpiry = expiryTimestamp(batch);
    if (directExpiry !== null && directExpiry <= nowMs) return true;
    const items = Array.isArray(batch?.items) ? batch.items : [];
    if (!items.length) return false;
    const expiries = items.map(expiryTimestamp).filter(value => value !== null);
    return expiries.length === items.length && expiries.every(value => value <= nowMs);
}

function approvedBatch(batch, { recipientId, nowIso }) {
    return {
        ...batch,
        state: 'approved',
        approved_at: nowIso,
        approved_by_user_id: recipientId,
        approval_source: 'balance_phone_notification_tap',
        approval_confirmation_key: `${batchIdentity(batch).batchId}-v${batchIdentity(batch).batchVersion}`,
    };
}

function buildApprovalPatch(row, identity, nowIso) {
    const existing = rowBatch(row);
    const approved = approvedBatch(existing, { recipientId: identity.recipientId, nowIso });
    const patch = {};
    for (const field of STATE_FIELDS) {
        const container = row?.[field];
        if (matchesBatch(approvalBatchFrom(container), identity) || field === 'next_resume' || field === 'receipt') {
            patch[field] = {
                ...(container && typeof container === 'object' && !Array.isArray(container) ? container : {}),
                approval_batch: approved,
            };
        }
    }
    patch.updated_at = nowIso;
    return patch;
}

async function verifyAdminRecipient(recipientId) {
    const rows = await supabaseRequest(
        `users?select=id,email&id=eq.${encodeURIComponent(recipientId)}&limit=1`
    );
    const email = String(rows?.[0]?.email || '').trim().toLowerCase();
    return email === BALANCE_ADMIN_EMAIL;
}

async function approveExactBatch(identity) {
    const rows = await supabaseRequest(
        'ig_browser_shift_runs?select=id,run_id,status,started_at,lease_expires_at,updated_at,cursor_start,cursor_current,cursor_end,next_resume,receipt&order=started_at.desc&limit=200'
    );
    const nowMs = Date.now();
    const healthyLease = (rows || []).find(row => row.status === 'running' && Date.parse(row.lease_expires_at || '') > nowMs);
    if (healthyLease) {
        return { statusCode: 409, body: { ok: false, reason: 'dispatcher_lease_active' } };
    }

    const row = (rows || []).find(candidate => rowBatch(candidate));
    if (!row || !matchesBatch(rowBatch(row), identity)) {
        return { statusCode: 409, body: { ok: false, reason: 'batch_not_current' } };
    }

    const batch = rowBatch(row);
    if (batch.state === 'approved') {
        return { statusCode: 200, body: { ok: true, approved: true, idempotent: true } };
    }
    if (batch.state !== 'awaiting_approval') {
        return { statusCode: 409, body: { ok: false, reason: 'batch_not_awaiting_approval' } };
    }
    if (isBatchExpired(batch, nowMs)) {
        return { statusCode: 409, body: { ok: false, reason: 'batch_expired' } };
    }

    const nowIso = new Date(nowMs).toISOString();
    const updated = await supabaseRequest(
        `ig_browser_shift_runs?id=eq.${encodeURIComponent(row.id)}&updated_at=eq.${encodeURIComponent(row.updated_at)}`,
        {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify(buildApprovalPatch(row, identity, nowIso)),
        }
    );
    if (!Array.isArray(updated) || updated.length !== 1) {
        return { statusCode: 409, body: { ok: false, reason: 'batch_changed_during_approval' } };
    }
    return {
        statusCode: 200,
        body: {
            ok: true,
            approved: true,
            idempotent: false,
            batchId: identity.batchId,
            batchVersion: identity.batchVersion,
        },
    };
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json(500, { error: 'Server configuration error' });

    const body = parseBody(event);
    const identity = normalizeApprovalIdentity({
        batchId: body.batchId || body.batch_id,
        batchVersion: body.batchVersion || body.batch_version,
        recipientId: body.recipientId || body.recipient_id,
    });
    if (!identity || !verifyApprovalToken(identity, body.approvalToken || body.approval_token, SUPABASE_SERVICE_KEY)) {
        return json(401, { ok: false, reason: 'invalid_approval_token' });
    }

    try {
        if (!(await verifyAdminRecipient(identity.recipientId))) {
            return json(403, { ok: false, reason: 'recipient_not_admin' });
        }
        const result = await approveExactBatch(identity);
        return json(result.statusCode, result.body);
    } catch (error) {
        console.error('[IG Dispatch Approval] failed:', error);
        return json(500, { ok: false, reason: 'approval_failed' });
    }
};

module.exports.__test = {
    approvalBatchFrom,
    batchIdentity,
    rowBatch,
    matchesBatch,
    isBatchExpired,
    buildApprovalPatch,
};

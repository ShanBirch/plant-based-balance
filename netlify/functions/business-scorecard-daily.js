const { createScorecardToken } = require('./_lib/business-scorecard-token');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://hzapaorxqboevxnumxkv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const SITE_URL = (process.env.URL || 'https://plantbased-balance.org').replace(/\/+$/, '');
const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';

async function supabaseRequest(path, { method = 'GET', body, prefer = 'return=representation' } = {}) {
    if (!SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
    const response = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/${path}`, {
        method,
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: prefer,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Supabase ${method} ${path} failed: ${response.status} ${text.slice(0, 500)}`);
    if (!text.trim()) return null;
    try { return JSON.parse(text); } catch { return null; }
}

function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function compactMoney(amountMinor) {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        maximumFractionDigits: 0,
    }).format(toNumber(amountMinor) / 100);
}

function constraintLabel(value) {
    return String(value || 'measurement')
        .replaceAll('_', ' ')
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function buildNotificationCopy(snapshot = {}) {
    const current = snapshot.metrics?.current || snapshot.current || {};
    const revenue = compactMoney(current.founders_revenue_minor);
    const sales = toNumber(current.founders_sales);
    const checkouts = toNumber(current.checkout_sent);
    const constraint = String(snapshot.primary_constraint || 'measurement');
    const shortNext = {
        checkout_conversion: 'Review the exact checkout handoffs.',
        checkout_handoff: 'Fix the offer-to-checkout transition.',
        offer_progression: 'Move qualified leads into a clear offer.',
        paid_acquisition: 'Verify attributed ads reach the live worker.',
        unit_economics_visibility: 'Connect Meta spend and calculate CAC.',
        client_results: 'Increase measurable client progress coverage.',
        automation_reliability: 'Reduce the largest repeat Needs You cause.',
        scale_acquisition: 'Scale the best verified source one step.',
    }[constraint] || 'Open the scorecard for the next move.';

    return {
        title: `Balance: ${constraintLabel(constraint)}`,
        body: `7d ${revenue} · ${checkouts} checkout${checkouts === 1 ? '' : 's'} · ${sales} sale${sales === 1 ? '' : 's'}. ${shortNext}`,
    };
}

async function patchNotificationReceipt(snapshotId, { sent, status }) {
    const now = new Date().toISOString();
    const body = {
        notification_attempted_at: now,
        notification_status: status,
        updated_at: now,
    };
    if (sent > 0) body.notification_sent_at = now;
    await supabaseRequest(`balance_business_scorecards?id=eq.${encodeURIComponent(snapshotId)}`, {
        method: 'PATCH',
        body,
        prefer: 'return=minimal',
    });
}

exports.handler = async () => {
    const startedAt = new Date().toISOString();
    try {
        const snapshot = await supabaseRequest('rpc/record_balance_business_scorecard', {
            method: 'POST',
            body: {
                p_days: 7,
                p_release_ref: process.env.COMMIT_REF || process.env.DEPLOY_ID || null,
            },
        });

        if (!snapshot?.id) throw new Error('Scorecard RPC returned no snapshot id');
        if (snapshot.notification_attempted_at) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    ok: true,
                    skipped: 'already_attempted_today',
                    scorecard_id: snapshot.id,
                    scorecard_date: snapshot.scorecard_date,
                }),
            };
        }

        const admins = await supabaseRequest(
            `users?select=id&email=eq.${encodeURIComponent(BALANCE_ADMIN_EMAIL)}&limit=1`
        );
        const recipientId = admins?.[0]?.id;
        if (!recipientId) {
            await patchNotificationReceipt(snapshot.id, { sent: 0, status: 'admin_not_found' });
            throw new Error('Shannon admin account was not found');
        }

        const copy = buildNotificationCopy(snapshot);
        const identity = {
            scorecardId: snapshot.id,
            scorecardDate: snapshot.scorecard_date,
            recipientId,
        };
        const scorecardToken = createScorecardToken(identity, SUPABASE_SERVICE_KEY);
        const response = await fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientId,
                senderId: snapshot.id,
                senderName: copy.title,
                messageText: copy.body,
                type: 'business_scorecard',
                actionType: 'business_scorecard',
                scorecardId: snapshot.id,
                scorecardDate: snapshot.scorecard_date,
                scorecardToken,
                collapseKey: `business-scorecard:${snapshot.scorecard_date}`,
                url: '/admin-dashboard.html#metrics',
            }),
        });
        const responseText = await response.text();
        let pushResult = {};
        try { pushResult = JSON.parse(responseText); } catch { /* preserve empty result */ }
        if (!response.ok) throw new Error(`Scorecard push failed: ${response.status} ${responseText.slice(0, 500)}`);

        const sent = toNumber(pushResult.sent);
        const status = sent > 0 ? 'sent' : (pushResult.reason || pushResult.message || 'no_registered_device');
        await patchNotificationReceipt(snapshot.id, { sent, status: String(status).slice(0, 160) });

        return {
            statusCode: 200,
            body: JSON.stringify({
                ok: true,
                started_at: startedAt,
                scorecard_id: snapshot.id,
                scorecard_date: snapshot.scorecard_date,
                primary_constraint: snapshot.primary_constraint,
                notification_sent: sent,
                notification_status: status,
                release_ref: snapshot.release_ref,
            }),
        };
    } catch (error) {
        console.error('[business-scorecard-daily]', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ ok: false, error: error.message, started_at: startedAt }),
        };
    }
};

exports._test = {
    buildNotificationCopy,
    compactMoney,
    constraintLabel,
};

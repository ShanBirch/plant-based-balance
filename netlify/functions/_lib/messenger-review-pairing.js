const { createHash, randomBytes } = require('node:crypto');

const hashCode = code => createHash('sha256').update(code).digest('hex');
const keyFor = hash => `messenger_review_${hash}`;
const validHash = value => /^[a-f0-9]{64}$/.test(value || '');
const isPairingMessage = text => /^BALANCE REVIEW [a-f0-9]{32}$/.test(text || '');
const active = (grant, now) => grant?.enabled === true && Number.isFinite(Date.parse(grant.expires_at))
    && Date.parse(grant.expires_at) > now;
const parseGrant = row => { try { return JSON.parse(row?.value || 'null'); } catch { return null; } };

// Only the signature-verified webhook calls this. Ordinary message-table rows
// are not proof: legacy INSERT policies may permit callers to spoof their source.
async function recordPairingProof(event, thread, query, now = Date.now()) {
    if (event.direction !== 'in' || !isPairingMessage(event.text)) return false;
    const key = `messenger_review_proof_${hashCode(event.text)}`;
    const [row] = await query(`app_private_secrets?select=value&key=eq.${key}&limit=1`);
    const pending = parseGrant(row);
    if (pending?.phase !== 'waiting' || pending.page_id !== event.pageId
        || !(Date.parse(pending.expires_at) > now) || !(Date.parse(event.at) >= Date.parse(pending.since))
        || Date.parse(event.at) > now) return true;
    await query(`app_private_secrets?key=eq.${key}&value=in.(${encodeURIComponent(JSON.stringify(row.value))})`, {
        method: 'PATCH', body: { value: JSON.stringify({ source: 'facebook_messenger_verified', thread_id: thread.id,
            page_id: event.pageId, psid: event.psid, at: event.at }), updated_at: new Date(now).toISOString() },
    });
    return true;
}

// Compare the whole old value so simultaneous opens/pairs cannot overwrite a
// revocation or bind a session to a different participant. No public DB policy.
async function replaceGrant(query, hash, oldValue, grant) {
    const match = encodeURIComponent(JSON.stringify(oldValue));
    // PostgREST only unquotes escaped string literals inside the in-list grammar.
    // A quoted eq value compares the quote characters too and matches no rows.
    return query(`app_private_secrets?key=eq.${keyFor(hash)}&value=in.(${match})`, {
        method: 'PATCH', body: { value: JSON.stringify(grant), updated_at: new Date().toISOString() },
    });
}

async function resolvePairing({ query, hash, secret, grant, action, now, random = randomBytes }) {
    const fail = (status, error) => ({ status, body: { error } });
    if (grant.kind === 'invitation') {
        if (action !== 'open') return fail(400, 'Open a new review session with your invitation code.');
        if (!/^\d+$/.test(grant.page_id || '')) return fail(403, 'Review invitation is unavailable.');
        const day = new Date(now).toISOString().slice(0, 10);
        const count = grant.session_day === day ? grant.session_count : 0;
        if (!Number.isInteger(count) || count < 0 || count >= 20) return fail(429, 'Review session limit reached. Please contact the app owner.');
        const updated = await replaceGrant(query, hash, secret.value, { ...grant, session_day: day, session_count: count + 1 });
        if (updated.length !== 1) return fail(409, 'Review invitation changed. Please try opening it again.');
        const code = random(32).toString('hex');
        const session = { kind: 'session', enabled: true, parent_hash: hash, page_id: grant.page_id,
            challenge: `BALANCE REVIEW ${random(16).toString('hex')}`, since: new Date(now).toISOString(),
            pair_expires_at: new Date(Math.min(now + 30 * 60000, Date.parse(grant.expires_at))).toISOString(),
            expires_at: new Date(Math.min(now + 2 * 3600000, Date.parse(grant.expires_at))).toISOString() };
        await query('app_private_secrets', { method: 'POST', body: { key: keyFor(hashCode(code)), value: JSON.stringify(session) } });
        await query('app_private_secrets', { method: 'POST', body: {
            key: `messenger_review_proof_${hashCode(session.challenge)}`,
            value: JSON.stringify({ phase: 'waiting', page_id: session.page_id, since: session.since, expires_at: session.pair_expires_at }),
        } });
        return { status: 200, body: { phase: 'pair', sessionCode: code, challenge: session.challenge,
            pageUrl: `https://m.me/${session.page_id}`, status: 'Send this pairing phrase yourself in Messenger, then check the connection. Keep this tab open.' } };
    }
    if (grant.kind !== 'session') return { grant };
    if (!validHash(grant.parent_hash)) return fail(403, 'Review access is unavailable.');
    const [parentRow] = await query(`app_private_secrets?select=value&key=eq.${keyFor(grant.parent_hash)}&limit=1`);
    const parent = parseGrant(parentRow);
    if (!active(parent, now) || parent.kind !== 'invitation' || parent.page_id !== grant.page_id) return fail(403, 'Review invitation is unavailable or expired.');
    if (grant.thread_id) return { grant };
    if (!['read', 'open', 'pair'].includes(action)) return fail(409, 'Connect your own Messenger conversation first.');
    if (!isPairingMessage(grant.challenge) || !Number.isFinite(Date.parse(grant.since))
        || Date.parse(grant.since) > now || !Number.isFinite(Date.parse(grant.pair_expires_at))
        || Date.parse(grant.pair_expires_at) <= now) return fail(403, 'Pairing expired. Open a new session with your invitation code.');
    const pending = { status: 200, body: { phase: 'pair', challenge: grant.challenge, pageUrl: `https://m.me/${grant.page_id}`,
        status: 'No matching message received yet. Send the exact phrase from your own Messenger account, then check again. If Meta restricts delivery, an app role or reviewer access must be resolved first.' } };
    if (action !== 'pair') return pending;
    // Proof is in the service-only secret store, never in the public message table.
    const [proofRow] = await query(`app_private_secrets?select=value&key=eq.messenger_review_proof_${hashCode(grant.challenge)}&limit=1`);
    const match = parseGrant(proofRow);
    if (!match || match.phase === 'waiting') return pending;
    if (match.source !== 'facebook_messenger_verified' || match.page_id !== grant.page_id
        || !/^[a-f0-9-]{36}$/.test(match.thread_id || '') || !/^\d+$/.test(match.psid || '')
        || !Number.isFinite(Date.parse(match.at)) || Date.parse(match.at) < Date.parse(grant.since)
        || Date.parse(match.at) >= Date.parse(grant.pair_expires_at) || Date.parse(match.at) > now) return fail(409, 'Pairing could not be verified. Open a new review session.');
    const [thread] = await query(`ig_threads?select=id,channel,subscriber_id,linked_user_id,custom_data&id=eq.${match.thread_id}&limit=1`);
    const route = thread?.custom_data?.facebook_messenger;
    if (!thread || thread.linked_user_id || thread.channel !== 'messenger' || route?.page_id !== grant.page_id
        || route?.psid !== match.psid || thread.subscriber_id !== `fb_graph:${grant.page_id}:${route.psid}`) return fail(403, 'This conversation cannot be used for review.');
    const paired = { ...grant, thread_id: match.thread_id, psid: route.psid,
        // Pairing and all older history stay outside the readable review scope.
        since: new Date(Date.parse(match.at) + 1).toISOString() };
    delete paired.challenge;
    const saved = await replaceGrant(query, hash, secret.value, paired);
    if (saved.length !== 1) return fail(409, 'Review session changed. Please refresh.');
    return { status: 200, body: { phase: 'connected', status: 'Connected. Send a new question to Balance APP in Messenger, then refresh this inbox.' } };
}

module.exports = { resolvePairing, recordPairingProof, isPairingMessage, active, parseGrant, hashCode };

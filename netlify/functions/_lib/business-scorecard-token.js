const crypto = require('crypto');

function normalizeScorecardIdentity({ scorecardId, scorecardDate, recipientId } = {}) {
    const normalized = {
        scorecardId: String(scorecardId || '').trim().toLowerCase(),
        scorecardDate: String(scorecardDate || '').trim(),
        recipientId: String(recipientId || '').trim().toLowerCase(),
    };
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(normalized.scorecardId)) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized.scorecardDate)) return null;
    if (!uuidPattern.test(normalized.recipientId)) return null;
    return normalized;
}

function scorecardTokenMessage(identity) {
    return `balance-business-scorecard:v1:${identity.scorecardId}:${identity.scorecardDate}:${identity.recipientId}`;
}

function createScorecardToken(input, secret) {
    const identity = normalizeScorecardIdentity(input);
    if (!identity || !secret) return '';
    return crypto.createHmac('sha256', secret).update(scorecardTokenMessage(identity)).digest('hex');
}

function verifyScorecardToken(input, suppliedToken, secret) {
    const expected = createScorecardToken(input, secret);
    const supplied = String(suppliedToken || '').trim().toLowerCase();
    if (!expected || !/^[0-9a-f]{64}$/.test(supplied)) return false;
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(supplied, 'hex'));
}

module.exports = {
    normalizeScorecardIdentity,
    createScorecardToken,
    verifyScorecardToken,
};

const crypto = require('crypto');

const BATCH_ID_PATTERN = /^balance-ig-approval-[A-Za-z0-9_-]+$/;

function normalizeApprovalIdentity({ batchId, batchVersion, recipientId } = {}) {
    const normalized = {
        batchId: String(batchId || '').trim(),
        batchVersion: Number(batchVersion),
        recipientId: String(recipientId || '').trim(),
    };
    if (!BATCH_ID_PATTERN.test(normalized.batchId)) return null;
    if (!Number.isInteger(normalized.batchVersion) || normalized.batchVersion <= 0) return null;
    if (!/^[0-9a-f-]{36}$/i.test(normalized.recipientId)) return null;
    return normalized;
}

function approvalTokenMessage(identity) {
    return `ig-dispatch-approval:v1:${identity.batchId}:${identity.batchVersion}:${identity.recipientId}`;
}

function createApprovalToken(input, secret) {
    const identity = normalizeApprovalIdentity(input);
    if (!identity || !secret) return '';
    return crypto.createHmac('sha256', secret).update(approvalTokenMessage(identity)).digest('hex');
}

function verifyApprovalToken(input, suppliedToken, secret) {
    const expected = createApprovalToken(input, secret);
    const supplied = String(suppliedToken || '').trim().toLowerCase();
    if (!expected || !/^[0-9a-f]{64}$/.test(supplied)) return false;
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(supplied, 'hex'));
}

module.exports = {
    normalizeApprovalIdentity,
    createApprovalToken,
    verifyApprovalToken,
};

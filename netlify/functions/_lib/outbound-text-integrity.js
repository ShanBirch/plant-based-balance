const STANDALONE_QUESTION_MARK_REPLACEMENT_RE = /(?:^|[\s([{'"`.,;:!?])\?\?(?=$|[\s)\]}'"`.,;:!?])/;

const OUTBOUND_TEXT_ENCODING_CORRUPTION_CODE = 'outbound_text_encoding_corruption';
const OUTBOUND_TEXT_ENCODING_CORRUPTION_MESSAGE = 'Reply text contains a standalone "??" token, which indicates Windows emoji encoding corruption. Re-submit using UTF-8-safe text; nothing was sent.';

function createTransportTextError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function decodeUtf8Base64(value, fieldName = 'textUtf8Base64') {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 === 1) {
        throw createTransportTextError('invalid_utf8_base64', `${fieldName} must be valid UTF-8 Base64`);
    }

    const bytes = Buffer.from(normalized, 'base64');
    const text = bytes.toString('utf8');
    if (text.includes('\uFFFD')) {
        throw createTransportTextError('invalid_utf8_base64', `${fieldName} is not valid UTF-8`);
    }

    const expected = normalized.replace(/=+$/, '');
    const actual = bytes.toString('base64').replace(/=+$/, '');
    if (actual !== expected) {
        throw createTransportTextError('invalid_utf8_base64', `${fieldName} must be canonical UTF-8 Base64`);
    }
    return text;
}

function resolveUtf8TransportText({ text, textUtf8Base64, fieldName = 'text' } = {}) {
    if (textUtf8Base64 !== undefined && textUtf8Base64 !== null && String(textUtf8Base64).trim() !== '') {
        return decodeUtf8Base64(textUtf8Base64, `${fieldName}Utf8Base64`);
    }
    return String(text || '');
}

function validateOutboundTextIntegrity(value) {
    const text = String(value || '');
    const match = text.match(STANDALONE_QUESTION_MARK_REPLACEMENT_RE);
    if (!match) return { ok: true };
    return {
        ok: false,
        code: OUTBOUND_TEXT_ENCODING_CORRUPTION_CODE,
        message: OUTBOUND_TEXT_ENCODING_CORRUPTION_MESSAGE,
        token: '??',
        index: match.index + match[0].indexOf('??'),
    };
}

module.exports = {
    OUTBOUND_TEXT_ENCODING_CORRUPTION_CODE,
    OUTBOUND_TEXT_ENCODING_CORRUPTION_MESSAGE,
    decodeUtf8Base64,
    resolveUtf8TransportText,
    validateOutboundTextIntegrity,
};

const assert = require('assert');

const {
    decodeUtf8Base64,
    resolveUtf8TransportText,
    validateOutboundTextIntegrity,
} = require('../netlify/functions/_lib/outbound-text-integrity');

const emojiText = `Hahaha, that session was huge ${String.fromCodePoint(0x1f525)}`;
const emojiTextBase64 = Buffer.from(emojiText, 'utf8').toString('base64');

assert.strictEqual(decodeUtf8Base64(emojiTextBase64), emojiText);
assert.strictEqual(resolveUtf8TransportText({
    text: 'this fallback should not be used',
    textUtf8Base64: emojiTextBase64,
    fieldName: 'replyText',
}), emojiText);
assert.strictEqual(validateOutboundTextIntegrity(emojiText).ok, true);
assert.strictEqual(validateOutboundTextIntegrity('Hahaha, same energy ?? What did you train?').ok, false);
assert.strictEqual(validateOutboundTextIntegrity('I didn?t mean that').ok, false);
assert.strictEqual(validateOutboundTextIntegrity('first line`nsecond line').ok, false);
assert.strictEqual(validateOutboundTextIntegrity('thats .').ok, false);
assert.strictEqual(validateOutboundTextIntegrity('bad replacement \uFFFD').ok, false);
assert.strictEqual(validateOutboundTextIntegrity('wait what??').ok, true);
assert.strictEqual(validateOutboundTextIntegrity('what? that is wild').ok, true);
assert.throws(() => decodeUtf8Base64('not base64!'), /valid UTF-8 Base64/);

console.log('outbound text-integrity tests passed');

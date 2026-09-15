const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../netlify/functions/ig-instant-draft')._test;

test('direct course price openers answer without the BALANCE keyword', () => {
    for (const message of ["What's the price of the course?", 'What is the cost of the course?', 'How much is the course?', 'Can you tell me the course price?']) {
        assert.equal(api.shouldUseDeterministicMetaAdFirstReply(message), true, message);
        const reply = api.buildMetaAdFoundersPassFirstReply(message, { flowVariant: 'broad_pain' });
        assert.equal(reply.firstReplyIntent, 'price', message);
        assert.match(reply.joined, /^Hey!/);
        assert.match(reply.joined, /AUD \$/);
        assert.match(reply.joined, /no subscription or automatic renewal/);
        assert.match(reply.joined, /hoping to work towards/);
        assert.ok(reply.joined.split(/\s+/).length < 60);
        assert.equal(reply.checkoutUrl, null);
    }
});

test('general course introduction stays brief while an explicit outline still gets the curriculum', () => {
    const brief = api.buildMetaAdFoundersPassFirstReply('Tell me about the course', { flowVariant: 'broad_pain' });
    assert.equal(brief.firstReplyIntent, 'overview');
    assert.match(brief.joined, /^Hey/);
    assert.doesNotMatch(brief.joined, /Week 1/i);
    assert.ok(brief.joined.split(/\s+/).length < 60);
    const detailed = api.buildMetaAdFoundersPassFirstReply('What will I learn week by week?', { flowVariant: 'broad_pain' });
    assert.equal(detailed.firstReplyIntent, 'curriculum');
    assert.match(detailed.joined, /Week 1/i);
});

test('accepted course price and a grocery expense are not course price questions', () => {
    const reply = api.buildMetaAdFoundersPassFirstReply("The course price is fine. Fancy groceries are what I can't afford. Can the food plan use basic supermarket stuff?", { flowVariant: 'broad_pain' });
    assert.notEqual(reply.firstReplyIntent, 'price');
});

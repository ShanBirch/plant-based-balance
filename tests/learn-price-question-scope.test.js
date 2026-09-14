const test = require('node:test');
const assert = require('node:assert/strict');
const { collectPaidMetaWriterContractIssues, buildDeterministicPaidMetaConversationReply } = require('../netlify/functions/ig-instant-draft')._test;

const history = [{ direction: 'out', text: "What's the main change you want in the next six weeks?" }];
const priceIssues = (currentMessage, reply) => collectPaidMetaWriterContractIssues({
    currentMessage, history, qualifier: { facts: {} }, flowVariant: 'broad_pain',
    draft: { joined: reply, chunks: [reply] },
}).filter(issue => /answer the price exactly/i.test(issue));

const practicalQuestions = [
    ["The course price is fine. Fancy groceries are what I can't afford. Can the food plan use basic supermarket stuff?", 'Yeah, the food plan can use basic supermarket ingredients and fit your budget.'],
    ["Course price is fine but groceries cost too much. Can I use frozen veg?", 'Yes, frozen veg can fit your meal plan.'],
    ["How much will the groceries cost?", 'Your grocery bill depends on the foods and portions you choose. We can keep the food plan based on everyday ingredients.'],
    ["What is the cost of a gym membership? Do I need one?", 'You can train at home with a workout program fitted to the equipment you have.'],
    ["Equipment costs worry me. Can I start with no weights?", 'Yes, we can start your workouts around the equipment you have, including none.'],
    ["Childcare prices are the issue. Can I train at home?", 'Yes, you can do your workouts at home around the time you have.'],
    ["The price is okay. How much time does each workout take?", 'Workout length can fit the time you have available.'],
    ["How much protein do I need?", 'Your food setup can be fitted to your goals and dietary preferences.'],
    ["I'm not asking about the price. Can the meal plan be vegetarian?", 'Yes, your meal plan can fit vegetarian dietary preferences.'],
    ["I already know the course price. Are supplements required?", 'No, you do not need specialty supplements to start.'],
];
for (const [message, reply] of practicalQuestions) {
    test(`preserves practical answer instead of forcing course fee: ${message}`, () => {
        assert.deepEqual(priceIssues(message, reply), []);
        const deterministic = buildDeterministicPaidMetaConversationReply({
            currentMessage: message, history, qualifier: { facts: {} }, flowVariant: 'broad_pain',
        });
        assert.notEqual(deterministic?.model, 'deterministic_paid_meta_autonomy_v1');
    });
}

for (const message of [
    'Price?', 'How much is it?', 'What does the course cost?',
    'Can you tell me the price?', 'What is the price of the course and can I use basic groceries?',
    'Groceries are expensive. How much is Balance Learn?',
    'The gym price is fine, but how much is the course?',
]) {
    test(`still requires an exact course-price answer: ${message}`, () => {
        assert.equal(priceIssues(message, 'The food plan can fit your preferences.').length, 1);
        assert.deepEqual(priceIssues(message, "It's one AUD $149 payment for the full six weeks, with no subscription or auto-renewal."), []);
    });
}

test('weekly pricing keeps its own terms', () => {
    assert.deepEqual(priceIssues('How much does it cost weekly?', 'It is $24.83 per week with a six-week minimum, then continues until you cancel.'), []);
});

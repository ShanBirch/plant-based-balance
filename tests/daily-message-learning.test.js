const assert = require('assert');

const {
    draftTextFor,
    hasEditAnalysis,
    sentMessageFor,
    shouldRunClientMemoryExtraction,
    shouldRunEditAnalysis,
} = require('../netlify/functions/daily-message-learning')._test;

const baseAlert = {
    id: 'alert-1',
    coach_id: 'coach-1',
    client_id: 'client-1',
    alert_type: 'incoming_dm',
    suggested_message: 'draft from suggested',
    data: {
        sent_message: 'final sent',
        message_preview: 'client reply',
    },
};

assert.strictEqual(draftTextFor(baseAlert), 'draft from suggested');
assert.strictEqual(sentMessageFor(baseAlert), 'final sent');
assert.strictEqual(shouldRunEditAnalysis(baseAlert), true);
assert.strictEqual(shouldRunClientMemoryExtraction(baseAlert), true);

const alreadyAnalyzed = {
    ...baseAlert,
    data: {
        ...baseAlert.data,
        edit_analysis: {
            analyzed_at: '2026-06-22T10:00:00.000Z',
        },
    },
};

assert.strictEqual(hasEditAnalysis(alreadyAnalyzed), true);
assert.strictEqual(shouldRunEditAnalysis(alreadyAnalyzed), false);
assert.strictEqual(shouldRunEditAnalysis(alreadyAnalyzed, { force: true }), true);

const coldLead = {
    ...baseAlert,
    client_id: null,
    alert_type: 'ig_incoming_dm',
    data: {
        ...baseAlert.data,
        ig_thread_id: 'thread-1',
    },
};

assert.strictEqual(
    shouldRunClientMemoryExtraction(coldLead),
    false,
    'cold lead memory should stay in extract-ig-thread-memory, not client_memory extraction'
);
assert.strictEqual(shouldRunEditAnalysis(coldLead), true);

const memoryDone = {
    ...baseAlert,
    data: {
        ...baseAlert.data,
        client_memory_extracted_at: '2026-06-22T11:00:00.000Z',
    },
};

assert.strictEqual(shouldRunClientMemoryExtraction(memoryDone), false);
assert.strictEqual(shouldRunClientMemoryExtraction(memoryDone, { force: true }), true);

console.log('daily message learning tests passed');

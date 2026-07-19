const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
    buildExtractorPrompt,
    mergeRelationshipSummary,
    fallbackRelationshipSummary,
    buildRelationshipMemoryBlock,
    countConversationEpisodes,
} = require('../netlify/functions/extract-ig-thread-memory')._test;

const prompt = buildExtractorPrompt({
    leadName: 'Alex',
    channel: 'instagram',
    leadStage: 'warm',
    existing: {
        goals: 'build strength',
        communication_style: null,
        running_notes: null,
        injuries_limits: null,
        personal_context: null,
    },
    existingRelationshipSummary: 'Alex previously asked about home workouts and declined a call.',
    conversation: 'Alex: I have adjustable dumbbells now.',
});

assert(prompt.includes('COMPRESSED UNDERSTANDING OF EARLIER CONVERSATIONS'));
assert(prompt.includes('Alex previously asked about home workouts and declined a call.'));
assert(prompt.includes('CONVERSATION BATCH'));
assert(prompt.includes('conversation_summary_updates'));
assert(prompt.includes('CORRECTIONS WIN'));

assert.strictEqual(
    mergeRelationshipSummary('old summary', { conversation_summary_updates: '  complete   new summary  ' }),
    'complete new summary'
);
assert.strictEqual(mergeRelationshipSummary('old summary', {}), 'old summary');

const fallback = fallbackRelationshipSummary({
    goals: 'build strength',
    personal_context: 'trains at home',
    injuries_limits: 'sore knee',
    running_notes: '[2026-07-01] has adjustable dumbbells',
});
assert(fallback.includes('Goals: build strength'));
assert(fallback.includes('Person/context: trains at home'));
assert(fallback.includes('has adjustable dumbbells'));

const relationshipBlock = buildRelationshipMemoryBlock({
    custom_data: {
        relationship_memory_compaction: {
            version: 2,
            summary: 'Alex has discussed home training across several chats.',
            messages_compacted: 146,
            conversation_episodes: 5,
        },
    },
});
assert(relationshipBlock.includes('146 canonical messages across 5 conversation episodes'));
assert(relationshipBlock.includes('Alex has discussed home training'));
assert(relationshipBlock.includes('not permission to continue a stale topic'));

assert.strictEqual(countConversationEpisodes([
    { created_at: '2026-07-01T00:00:00.000Z' },
    { created_at: '2026-07-01T01:00:00.000Z' },
    { created_at: '2026-07-05T01:00:00.000Z' },
]), 2);
assert.strictEqual(countConversationEpisodes([
    { created_at: '2026-07-05T01:00:00.000Z' },
], '2026-07-01T01:00:00.000Z'), 1);

const extractorSource = fs.readFileSync(
    path.join(__dirname, '../netlify/functions/extract-ig-thread-memory.js'),
    'utf8'
);
assert(extractorSource.includes('loadEveryPage('));
assert(extractorSource.includes('MEMORY_BATCH_SIZE'));
assert(!extractorSource.includes('HISTORY_LOOKBACK'));

const draftSource = fs.readFileSync(
    path.join(__dirname, '../netlify/functions/ig-instant-draft.js'),
    'utf8'
);
assert(draftSource.includes('buildRelationshipMemoryBlock(thread)'));

const netlifyConfig = fs.readFileSync(path.join(__dirname, '../netlify.toml'), 'utf8');
assert(netlifyConfig.includes('[functions."extract-ig-thread-memory"]'));
assert(netlifyConfig.includes('schedule = "29 */4 * * *"'));

console.log('ig full relationship memory tests passed');

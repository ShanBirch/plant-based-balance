const assert = require('assert');

const {
    cleanText,
    parseJsonMaybe,
    clampWindowDays,
    normalizeModelResult,
    buildFallbackResult,
    buildContentRadarPrompt,
    _test,
} = require('../netlify/functions/_lib/content-radar');

assert.strictEqual(cleanText('hello   [PHOTO:https://x.test/a.jpg]  world'), 'hello [photo] world');
assert.strictEqual(clampWindowDays(2), 7);
assert.strictEqual(clampWindowDays(120), 90);
assert.deepStrictEqual(parseJsonMaybe('```json\n{"ok":true}\n```'), { ok: true });

const normalized = normalizeModelResult({
    summary: 'Recent DMs point to practical consistency.',
    themes: [{
        name: 'Scale frustration',
        signal: 'People keep mentioning the number not moving.',
        source_mix: ['client DMs'],
        content_angle: 'Explain non-scale progress plainly.',
    }],
    ideas: [{
        rank: 1,
        type: 'reel',
        priority: 'high',
        title: 'The scale is not the whole scoreboard',
        hook: 'If the scale is annoying you, check these first.',
        talking_points: ['protein', 'steps', 'sleep'],
        evidence: ['Several clients mentioned scale frustration.'],
    }],
});

assert.strictEqual(normalized.themes[0].name, 'Scale frustration');
assert.strictEqual(normalized.ideas[0].idea_type, 'reel');
assert.strictEqual(normalized.ideas[0].priority, 'high');
assert.ok(normalized.ideas[0].evidence[0].note.includes('scale frustration'));

const fallback = buildFallbackResult({ igMessages: 3, clientMessages: 2 });
assert.ok(fallback.ideas.length >= 1);
assert.ok(fallback.ideas[0].angle.includes('3 IG/FB DMs'));

const prompt = buildContentRadarPrompt({
    sourceCounts: { igMessages: 1, clientMessages: 0 },
    igMessages: [{ created_at: '2026-05-15T00:00:00Z', channel: 'instagram', text: 'protein ideas please' }],
    clientMessages: [],
    clientMemory: [],
    igContentInteractions: [],
    igContentItems: [],
}, 30);
assert.ok(prompt.includes('Return JSON only'));
assert.ok(prompt.includes('protein ideas please'));

const idea = _test.normalizeIdea({ format: 'story', sources: ['DMs', 'DMs', 'check-ins'] }, 0);
assert.deepStrictEqual(idea.source_mix, ['DMs', 'check-ins']);

console.log('content radar tests passed');

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
    performance_brain: {
        summary: 'Story polls are getting the cleanest replies.',
        winning_patterns: [{
            pattern: 'Polls about routine friction',
            why: 'They make it easy to answer.',
            evidence: ['Story replies mention planning.'],
            do_more: 'Run one blocker poll each week.',
        }],
        next_tests: [{
            format: 'story',
            hook: 'Which bit breaks first?',
            success_signal: 'Specific blocker replies.',
        }],
    },
    reply_engine: {
        summary: 'Reply from the story context first.',
        context_rules: [{
            trigger: 'story_reply',
            reply_move: 'Mirror the blocker before asking what gets in the way.',
            example: 'Yeah that planning bit is the one. Is it dinners or snacks first?',
        }],
    },
    story_strategy: {
        summary: 'Use a three-slide blocker sequence.',
        today_sequence: [{
            slide: 1,
            type: 'poll',
            text: 'What falls over first?',
            sticker: 'Poll',
            reply_follow_up: 'Ask what makes that option hard.',
        }],
        daily_prompts: [{
            prompt: 'What is the easiest healthy thing you already do?',
            reply_keyword: 'easy',
        }],
    },
});

assert.strictEqual(normalized.themes[0].name, 'Scale frustration');
assert.strictEqual(normalized.ideas[0].idea_type, 'reel');
assert.strictEqual(normalized.ideas[0].priority, 'high');
assert.ok(normalized.ideas[0].evidence[0].note.includes('scale frustration'));
assert.strictEqual(normalized.performance_brain.winning_patterns[0].pattern, 'Polls about routine friction');
assert.strictEqual(normalized.reply_engine.context_rules[0].trigger, 'story_reply');
assert.strictEqual(normalized.story_strategy.today_sequence[0].type, 'poll');
assert.ok(normalized.raw.story_strategy.today_sequence.length);

const fallback = buildFallbackResult({ igMessages: 3, clientMessages: 2 });
assert.ok(fallback.ideas.length >= 1);
assert.ok(fallback.ideas[0].angle.includes('3 IG/FB DMs'));
assert.ok(fallback.performance_brain.next_tests.length >= 1);
assert.ok(fallback.raw.reply_engine.context_rules.length >= 1);

const prompt = buildContentRadarPrompt({
    sourceCounts: { igMessages: 1, clientMessages: 0, contextualReplySamples: 1 },
    igMessages: [{ created_at: '2026-05-15T00:00:00Z', channel: 'instagram', text: 'protein ideas please' }],
    clientMessages: [],
    clientMemory: [],
    igContentInteractions: [],
    igContentItems: [],
    igContentPerformance: [{ content_type: 'story', text: 'story poll | 4 story replies' }],
    contextualReplySamples: [{ event_type: 'story_reply', text: 'content: protein story | inbound: yes please' }],
}, 30);
assert.ok(prompt.includes('Return JSON only'));
assert.ok(prompt.includes('protein ideas please'));
assert.ok(prompt.includes('performance_brain'));
assert.ok(prompt.includes('Contextual reply samples'));

const idea = _test.normalizeIdea({ format: 'story', sources: ['DMs', 'DMs', 'check-ins'] }, 0);
assert.deepStrictEqual(idea.source_mix, ['DMs', 'check-ins']);

console.log('content radar tests passed');

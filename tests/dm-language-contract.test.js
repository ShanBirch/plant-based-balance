const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { ACQUISITION_MODES } = require('../netlify/functions/_lib/ig-acquisition-mode');
const {
    ORGANIC_DM_CONTROL,
    ORGANIC_DM_TREATMENT,
    resolveDmLanguageExperiment,
    measureDmLanguageShape,
} = require('../netlify/functions/_lib/dm-language-contract');
const { buildPaidMetaAgentPrompt } = require('../netlify/functions/ig-instant-draft')._test;
const { resolveDmLanguageAuthorship } = require('../netlify/functions/send-ig-reply')._test;

test('verified paid Meta is protected from the organic wording experiment', () => {
    const assignment = resolveDmLanguageExperiment({
        acquisitionMode: ACQUISITION_MODES.PAID_META,
        threadId: 'paid-thread-1',
    });

    assert.equal(assignment.enrolled, false);
    assert.equal(assignment.protectedLane, true);
    assert.equal(assignment.variant, 'paid_meta_existing_flow');
    assert.equal(assignment.reason, 'verified_paid_meta_protected');
    assert.equal(assignment.promptBlock, '');

    const paidPrompt = buildPaidMetaAgentPrompt({
        leadName: 'Lead',
        channelLabel: 'Instagram',
        timeline: 'Lead: I came from the ad',
        unansweredMessages: [{ text: 'I came from the ad' }],
        flowVariant: 'plant_based_control',
    });
    assert.match(paidPrompt, /dedicated paid-Meta lead conversation agent/i);
    assert.doesNotMatch(paidPrompt, /ORGANIC DM RESPONSE-SHAPE TEST/i);

    const source = fs.readFileSync(
        path.join(__dirname, '../netlify/functions/ig-instant-draft.js'),
        'utf8'
    );
    assert.match(source, /const dmLanguageExperimentBlock = !paidMetaSingleWriter && isSalesLeadThread/);
    assert.match(source, /paidMetaSingleWriter[\s\S]{0,1000}buildPaidMetaAgentPrompt/);
});

test('organic threads receive a stable 50/50 assignment with treatment instructions only in treatment', () => {
    const assignments = Array.from({ length: 40 }, (_, index) => resolveDmLanguageExperiment({
        acquisitionMode: index % 2
            ? ACQUISITION_MODES.ORGANIC_OUTREACH
            : ACQUISITION_MODES.ORGANIC_INBOUND,
        threadId: `organic-thread-${index}`,
        channel: 'instagram',
    }));
    const variants = new Set(assignments.map(item => item.variant));

    assert.deepEqual(variants, new Set([ORGANIC_DM_CONTROL, ORGANIC_DM_TREATMENT]));
    for (const assignment of assignments) {
        assert.equal(assignment.enrolled, true);
        if (assignment.variant === ORGANIC_DM_TREATMENT) {
            assert.match(assignment.promptBlock, /one exact detail/i);
            assert.match(assignment.promptBlock, /roughly 25 words or fewer/i);
            assert.match(assignment.promptBlock, /exactly one purposeful question/i);
            assert.match(assignment.promptBlock, /never changes paid-Meta progression/i);
        } else {
            assert.equal(assignment.promptBlock, '');
        }
    }

    const first = resolveDmLanguageExperiment({
        acquisitionMode: ACQUISITION_MODES.ORGANIC_INBOUND,
        threadId: 'stable-thread',
        channel: 'instagram',
    });
    const second = resolveDmLanguageExperiment({
        acquisitionMode: ACQUISITION_MODES.ORGANIC_INBOUND,
        threadId: 'stable-thread',
        channel: 'instagram',
    });
    assert.equal(first.variant, second.variant);
});

test('unknown and linked-client lanes fail closed', () => {
    assert.equal(resolveDmLanguageExperiment({
        acquisitionMode: 'ambiguous',
        threadId: 'thread-1',
    }).enrolled, false);
    assert.equal(resolveDmLanguageExperiment({
        acquisitionMode: ACQUISITION_MODES.ORGANIC_INBOUND,
        linkedUserId: 'client-1',
        threadId: 'thread-2',
        channel: 'instagram',
    }).variant, 'existing_client_not_enrolled');
    assert.equal(resolveDmLanguageExperiment({
        acquisitionMode: ACQUISITION_MODES.ORGANIC_INBOUND,
        channel: 'instagram',
    }).reason, 'stable_assignment_unavailable');
    assert.equal(resolveDmLanguageExperiment({
        acquisitionMode: ACQUISITION_MODES.ORGANIC_INBOUND,
        threadId: 'messenger-thread',
        channel: 'messenger',
    }).reason, 'organic_experiment_is_instagram_only');
});

test('shape metadata separates statement-led recognition from question-led turns', () => {
    const statement = measureDmLanguageShape({
        chunks: ['changing shifts would make a rigid plan a nightmare. a flexible setup makes way more sense'],
        inboundText: 'My changing shifts keep ruining every rigid plan I try.',
    });
    assert.equal(statement.bubble_count, 1);
    assert.equal(statement.question_count, 0);
    assert.equal(statement.statement_led, true);
    assert.equal(statement.simple_length_25_or_less, true);
    assert.ok(statement.specific_detail_overlap_count >= 2);
    assert.ok(statement.function_tags_heuristic.includes('exact_detail_reflection_candidate'));

    const question = measureDmLanguageShape({
        chunks: ['changing shifts would make that hard. what usually breaks first?'],
        inboundText: 'My changing shifts make consistency hard.',
    });
    assert.equal(question.question_count, 1);
    assert.ok(question.function_tags_heuristic.includes('elicitation'));
});

test('send-time authorship distinguishes unchanged drafts, manager rewrites and Shannon edits', () => {
    assert.equal(resolveDmLanguageAuthorship({ wasEdited: false, source: 'inline_reply' }), 'automated_draft_unchanged');
    assert.equal(resolveDmLanguageAuthorship({ wasEdited: true, source: 'balance_lead_client_manager_cron' }), 'automated_rewrite');
    assert.equal(resolveDmLanguageAuthorship({ wasEdited: true, source: 'inline_reply' }), 'shannon_edited');
    assert.equal(resolveDmLanguageAuthorship({ wasEdited: true, source: 'unclassified_source' }), 'edited_source_uncertain');
});

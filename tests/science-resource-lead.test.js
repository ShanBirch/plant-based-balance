const assert = require('assert');

(async () => {
    const lead = await import('../netlify/functions/science-resource-lead.mjs');

    const about = lead.buildAboutMe({
        resource_slug: 'free-will-willpower',
        resource_title: 'Free will, willpower, and fitness behaviour',
        step: 'questionnaire',
        answers: {
            goal: 'Get consistent with training',
            diet_style: 'Mostly plant-based',
            training_days: '3-4 days a week',
            hard_part: 'I train for two weeks, then work gets hectic.',
            current_setup: 'No booked sessions yet.',
            support: ['Weekly accountability', 'Clear protein and calorie targets'],
            wants_challenge: 'Yes, send details',
        },
    });

    assert.match(about, /Science resource lead/);
    assert.match(about, /Step: questionnaire/);
    assert.match(about, /Get consistent with training/);
    assert.match(about, /Mostly plant-based/);
    assert.match(about, /3-4 days a week/);
    assert.match(about, /Weekly accountability/);

    const row = lead.buildInvitationRow({
        email: '  TEST@Example.COM ',
        name: ' Shannon ',
        instagram: '@shan_n_sunny ',
        resource_slug: 'free-will-willpower',
        answers: {
            goal: 'Lose body fat',
            diet_style: 'Vegetarian',
            training_days: '1-2 days a week',
        },
    });

    assert.strictEqual(row.email, 'test@example.com');
    assert.strictEqual(row.cohort_type, 'transform_30');
    assert.strictEqual(row.source, 'science_resource_free_will_willpower');
    assert.strictEqual(row.ig_handle, 'shan_n_sunny');
    assert.match(row.about_me, /Lose body fat/);
    assert.match(row.about_me, /Vegetarian/);
    assert.match(row.about_me, /1-2 days a week/);

    const leadKey = lead.buildGrowthLeadKey({
        ...row,
        instagram: '@Shan_N_Sunny',
        resource_slug: 'free-will-willpower',
    }, row);
    assert.strictEqual(
        leadKey,
        'shan_n_sunny:shan_n_sunny:science_resource_free_will_willpower'
    );

    const now = '2026-06-22T01:02:03.000Z';
    const growthLead = lead.buildGrowthLeadRow({
        email: 'test@example.com',
        instagram: '@Shan_N_Sunny',
        resource_slug: 'free-will-willpower',
        answers: {
            goal: 'Lose body fat',
            diet_style: 'Vegetarian',
            support: ['Weekly accountability'],
            hard_part: 'I stop after busy weeks.',
        },
        utm_source: 'instagram',
    }, row, now);
    assert.strictEqual(growthLead.status, 'qualified');
    assert.strictEqual(growthLead.email, 'test@example.com');
    assert.strictEqual(growthLead.email_consent_at, now);
    assert.strictEqual(growthLead.from_username, 'shan_n_sunny');
    assert.ok(growthLead.content_interests.includes('Lose body fat'));
    assert.strictEqual(growthLead.metadata.bot_account, 'shan_n_sunny');

    const submission = lead.buildGrowthSubmissionRow({
        email: 'test@example.com',
        instagram: '@Shan_N_Sunny',
        resource_slug: 'free-will-willpower',
        answers: {
            goal: 'Lose body fat',
            diet_style: 'Vegetarian',
            hard_part: 'I stop after busy weeks.',
        },
    }, row, '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', now);
    assert.strictEqual(
        submission.submission_key,
        'science_resource:science_resource_free_will_willpower:test@example.com'
    );
    assert.strictEqual(submission.lead_id, '22222222-2222-4222-8222-222222222222');
    assert.strictEqual(submission.raw_payload.invitation_id, '33333333-3333-4333-8333-333333333333');

    console.log('science resource lead tests passed');
})();

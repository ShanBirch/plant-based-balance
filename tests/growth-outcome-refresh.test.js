const assert = require('assert');

(async () => {
    const refresh = await import('../netlify/functions/growth-outcome-refresh.mts');

    assert.strictEqual(typeof refresh.default, 'function');
    assert.strictEqual(refresh.config.schedule, '@daily');

    const sql = refresh.buildRefreshSql(9999);
    assert.ok(sql.includes("INTERVAL '1 day' * 365"), 'window should clamp at 365 days');
    assert.ok(sql.includes('client_goal_completed'));
    assert.ok(sql.includes('client_checkin_completed'));
    assert.ok(sql.includes('client_workout_logged'));
    assert.ok(sql.includes('ig_dm_response_sent'));
    assert.ok(sql.includes('client_message_response_sent'));
    assert.ok(sql.includes('stripe_subscription:'));
    assert.ok(sql.includes('conversion_operator:'));

    const shortSql = refresh.buildRefreshSql(7);
    assert.ok(shortSql.includes("INTERVAL '1 day' * 7"), 'window should accept safe numeric values');

    const summarySql = refresh.buildSummarySql(7);
    assert.ok(summarySql.includes('GROUP BY event_family, event_type'));
    assert.ok(summarySql.includes("INTERVAL '1 day' * 7"));

    console.log('growth outcome refresh tests passed');
})();

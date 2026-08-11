const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

const { handler } = require('../netlify/functions/meal-plan-nutrition-audit');

function response(status, body) {
    return {
        ok: status >= 200 && status < 300,
        status,
        async text() {
            return body === undefined ? '' : JSON.stringify(body);
        },
    };
}

test('meal fetch failures stop the audit instead of creating false missing-meal alerts', async () => {
    const originalFetch = global.fetch;
    const originalConsoleError = console.error;
    let alertWrites = 0;

    global.fetch = async (url, options = {}) => {
        const path = new URL(url).pathname + new URL(url).search;

        if (path.includes('/coach_clients?')) {
            return response(200, [{ client_id: 'client-1', coach_id: 'coach-1', status: 'active' }]);
        }
        if (path.includes('/users?')) {
            return response(200, [{ id: 'client-1', name: 'Test Client', email: 'test@example.com' }]);
        }
        if (path.includes('/quiz_results?')) {
            return response(200, []);
        }
        if (path.includes('/ai_generated_meal_plans?')) {
            return response(200, [{
                id: 'plan-1',
                user_id: 'client-1',
                plan_name: 'Test Plan',
                status: 'active',
                calorie_goal: 1800,
                protein_goal_g: 90,
                carbs_goal_g: 225,
                fat_goal_g: 55,
                created_at: '2026-08-11T00:00:00Z',
            }]);
        }
        if (path.includes('/ai_generated_meals?')) {
            return response(503, { message: 'temporary upstream failure' });
        }
        if (path.includes('/coach_alerts') && options.method === 'POST') {
            alertWrites += 1;
            return response(201, [{ id: 'false-alert' }]);
        }
        if (path.includes('/coach_alerts?')) {
            return response(200, []);
        }

        throw new Error(`Unexpected request: ${options.method || 'GET'} ${url}`);
    };
    console.error = () => {};

    try {
        const result = await handler({ queryStringParameters: {} });
        const body = JSON.parse(result.body);

        assert.equal(result.statusCode, 500);
        assert.equal(body.success, false);
        assert.match(body.error, /ai_generated_meals/);
        assert.equal(alertWrites, 0);
    } finally {
        global.fetch = originalFetch;
        console.error = originalConsoleError;
    }
});

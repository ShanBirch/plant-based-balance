const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const dashboardScript = fs.readFileSync(
    path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'),
    'utf8'
);

function makeStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key),
        clear: () => values.clear(),
        dump: () => Object.fromEntries(values),
    };
}

function loadScopeHelpers({ currentUser, local = {}, session = {}, guestMode = false }) {
    const start = dashboardScript.indexOf('function stampSessionProfileForActiveUser');
    const end = dashboardScript.indexOf('async function getLatestQuizResultCached', start);
    assert.ok(start >= 0 && end > start, 'account-scope helpers must remain available');

    const localStorage = makeStorage(local);
    const sessionStorage = makeStorage(session);
    const window = { currentUser, guestMode };
    const context = {
        window,
        localStorage,
        sessionStorage,
        getActiveDashboardUserId() {
            return window.currentUser && (window.currentUser.id || window.currentUser.user_id) || null;
        },
        normalizeGenderValue(value) {
            const gender = String(value || '').trim().toLowerCase();
            return gender === 'male' || gender === 'female' ? gender : '';
        },
    };
    vm.runInNewContext(dashboardScript.slice(start, end), context);
    return { context, localStorage, sessionStorage };
}

test('a session profile owned by another account is rejected', () => {
    const run = loadScopeHelpers({
        currentUser: { id: 'main-user', email: 'main@example.com' },
        local: { pbb_last_user_id: 'main-user' },
        session: {
            userProfile: JSON.stringify({ sex: 'female', name: 'Test Client' }),
            pbb_profile_owner_user_id: 'test-user',
        },
    });

    assert.equal(run.context.readSessionProfileForActiveUser(), null);
});

test('an unowned legacy profile is rejected after a same-tab account switch', () => {
    const run = loadScopeHelpers({
        currentUser: { id: 'main-user' },
        local: { pbb_last_user_id: 'test-user' },
        session: { userProfile: JSON.stringify({ sex: 'female' }) },
    });

    assert.equal(run.context.readSessionProfileForActiveUser(), null);
});

test('a paid-preview guest profile can be claimed only through the explicit claim path', () => {
    const run = loadScopeHelpers({
        currentUser: { id: 'new-member' },
        local: { pbb_last_user_id: 'new-member' },
        session: {
            userProfile: JSON.stringify({ sex: 'female' }),
            pbb_profile_owner_user_id: 'guest',
        },
    });

    assert.equal(run.context.readSessionProfileForActiveUser(), null);
    assert.equal(run.context.readSessionProfileForActiveUser({ allowGuestClaim: true }).sex, 'female');
});

test('gender cache records the authenticated owner', () => {
    const run = loadScopeHelpers({ currentUser: { id: 'main-user' } });

    assert.equal(run.context.cacheActiveUserGender('MALE'), true);
    assert.deepEqual(run.localStorage.dump(), {
        userGender: 'male',
        pbb_user_gender_owner_id: 'main-user',
    });
});

test('startup and rendering paths enforce account ownership', () => {
    const startup = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-3-1_get_user_data.js'), 'utf8');
    const authGuard = fs.readFileSync(path.join(root, 'lib/auth-guard.js'), 'utf8');
    const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
    const hormoneHub = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-9-hormone_hub_superboost_engine.js'), 'utf8');

    assert.match(startup, /lastUserId !== window\.currentUser\.id[\s\S]*sessionStorage\.clear\(\)/);
    assert.match(dashboardScript, /readSessionProfileForActiveUser\(\{ allowGuestClaim: pendingMetaClaim \}\)/);
    assert.match(dashboardScript, /embeddedUserId !== activeUserId/);
    assert.match(authGuard, /genderOwnerId === cachedUserId/);
    assert.match(dashboard, /getActiveUserGender\(\) === 'male'/);
    assert.match(hormoneHub, /genderOwnerId === activeUserId/);
});

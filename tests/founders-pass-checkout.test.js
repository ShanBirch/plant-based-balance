const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('one-time Founders Pass has a complete purchase and activation path', () => {
    const page = read('plant-based-fitness.html');
    const guard = read('netlify/edge-functions/lib/checkout-guard.js');
    const checkout = read('netlify/edge-functions/create-checkout-session.js');
    const claim = read('netlify/edge-functions/claim-founders-pass.js');
    const webhook = read('netlify/edge-functions/stripe-webhook.js');
    const purchaseTracker = read('netlify/edge-functions/track-purchase.js');
    const login = read('login.html');
    const success = read('success.html');
    const config = read('netlify.toml');
    const migration = read('supabase/migrations/20260717090000_founders_pass_purchases.sql');

    assert.match(page, /data-plan="founders-pass"/);
    assert.match(page, /Six weeks with Shannon in your corner/);
    assert.match(page, /one weekly check-in/i);
    assert.match(page, /does not renew automatically/i);
    assert.match(guard, /balance_vegan_founders_pass[\s\S]*?unitAmount: 8999[\s\S]*?mode: "payment"/);
    assert.match(checkout, /checkout\.plan\.mode === "subscription"/);
    assert.match(checkout, /payment_intent_data\[metadata\]/);
    assert.match(checkout, /balance_foundations_six_week/);
    assert.match(checkout, /safeReturnPath/);
    assert.match(checkout, /"\/plant-based-fitness\.html", "\/fitness-coaching\.html"/);
    assert.match(checkout, /founders\|fitness/);
    assert.match(checkout, /`\$\{cancelPath\}#join`/);
    assert.match(claim, /payment_status !== "paid"/);
    assert.match(claim, /This purchase does not match the signed-in account/);
    assert.match(claim, /subscription_status: expired \? "expired" : "active"/);
    assert.match(claim, /access_expires_at: accessExpiresAt/);
    assert.match(read('lib/auth-guard.js'), /fetch\('\/\.netlify\/functions\/claim-founders-pass'/);
    assert.match(webhook, /recordFoundersPassSale/);
    assert.match(webhook, /event_type: "purchase_completed"/);
    assert.match(webhook, /utm_content: cleanString\(session\?\.metadata\?\.utm_content/);
    assert.match(webhook, /page_variant: cleanString\(session\?\.metadata\?\.landing_page_variant/);
    assert.match(webhook, /sendCAPIEvent\('Purchase'/);
    assert.match(purchaseTracker, /sendCAPIEvent\('Purchase'/);
    assert.match(login, /claimPendingFoundersPass/);
    assert.match(login, /Set up your Balance account/);
    assert.match(login, /same email you used at checkout/i);
    assert.match(login, /OPEN MY FOUNDERS PASS/);
    assert.match(success, /balance_founders_pass_session_id/);
    assert.match(success, /fbq\('track', 'Purchase'/);
    assert.match(config, /function = "claim-founders-pass"/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.founders_pass_purchases/);
    assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
    assert.match(migration, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.founders_pass_purchases TO service_role/);
});

test('Founders Pass experiment has two honest measured landing experiences', () => {
    const plantPage = read('plant-based-fitness.html');
    const broadPage = read('fitness-coaching.html');
    const analytics = read('analytics.js');
    const eventLogger = read('netlify/functions/log-lp-event.js');

    assert.match(plantPage, /data-landing-variant="plant_based_control"/);
    assert.match(broadPage, /data-landing-variant="broad_pain"/);
    assert.doesNotMatch(broadPage, /plant[ -]?based|vegan|vegetarian/i);
    assert.match(broadPage, /future-balance\.netlify\.app\/fitness/);
    assert.match(broadPage, /data-plan="founders-pass"/);
    assert.match(plantPage, /<script src="analytics\.js"><\/script>/);
    assert.match(broadPage, /<script src="analytics\.js"><\/script>/);
    assert.match(analytics, /balance_first_touch/);
    assert.match(analytics, /balance_last_touch/);
    assert.match(analytics, /campaign_id/);
    assert.match(analytics, /checkout_click/);
    assert.match(eventLogger, /checkout_started/);
    assert.match(eventLogger, /onboarding_completed/);
});

test('Balance Foundations is a six-week course that preserves the existing lesson library', () => {
    const learning = read('lib/learning-inline.js');
    const dashboard = read('dashboard.html');

    assert.match(learning, /const BALANCE_FOUNDATIONS = Object\.freeze\(\{/);
    assert.equal((learning.match(/Object\.freeze\(\{ number:\s*[1-6],/g) || []).length, 6);
    assert.match(learning, /getFoundationsProgress/);
    assert.match(learning, /new Set\(progress\?\.lessons_completed \|\| \[\]\)/);
    assert.match(learning, /completedSet\.has\(id\)/);
    assert.match(learning, /id="balance-foundations-course-card"/);
    assert.match(learning, /Course Library/);
    assert.match(learning, /foundations_course_completed/);
    assert.match(learning, /Continue with weekly coaching/);
    assert.match(dashboard, /id: 'balance-foundations-course-v1'/);
    assert.match(dashboard, /sel: '#balance-foundations-course-card'/);
    assert.match(dashboard, /fallbackSel: '#learning-content'/);
});

test('Founders Pass onboarding captures the real-world blocker behind consistency', () => {
    const onboarding = read('js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js');
    assert.match(onboarding, /Let\\'s set up your goals one small answer at a time/);
    assert.match(onboarding, /key: 'main_blocker'[\s\S]*?What usually knocks you off track when life gets messy/);
    assert.match(onboarding, /setWizardFieldValue\('wizard-main-blocker', answers\.main_blocker\)/);
    assert.match(onboarding, /key: 'competing_priorities'[\s\S]*?What does a normal week actually have to fit around/);
    assert.match(onboarding, /key: 'weekly_capacity'[\s\S]*?how many training windows could you genuinely protect/);
    assert.match(onboarding, /key: 'routine_window'[\s\S]*?least likely to get stolen/);
    assert.match(onboarding, /key: 'starter_session_minutes'[\s\S]*?what size session would still feel easy to finish/i);
    assert.match(onboarding, /function getWizardRecommendedStarterFrequency/);
    assert.match(onboarding, /function selectWizardRoutineWindow/);
    assert.match(onboarding, /function selectWizardStarterMinutes/);
    assert.match(onboarding, /Your chosen starting routine/);
    assert.match(onboarding, /you chose \$\{displayedFrequency\}/);
    assert.match(onboarding, /Change anything below if another choice suits you better/);
    assert.match(onboarding, /function getWizardUnavailableTrainingDays/);
    assert.match(onboarding, /filter\(day => !unavailable\.has\(day\)\)/);
    assert.match(onboarding, /competingPriorities\.replace\(\/\[\.\!\?\]\+\$\//);
});

test('meal-plan and Weekly Goals routes use durable production fields', () => {
    const dashboard = read('dashboard.html');
    const dashboardStyle = read('css/dashboard/dashboard-style-2.css');
    const weeklyGoals = read('js/dashboard/pbb-deferred-weeklygoals.js');
    const migration = read('supabase/migrations/20260725020647_create_user_food_preferences.sql');

    assert.match(dashboard, /id="browse-plans-pill"[\s\S]*?onclick="openAiMealPlanView\(this\)"/);
    assert.doesNotMatch(dashboard, /id="story-preload-models"[\s\S]{0,500}?document\.write/);
    assert.match(dashboardStyle, /\.story-speech-area[\s\S]*?pointer-events: none/);
    assert.match(dashboardStyle, /#fitgotchi-story-overlay\.active \.story-speech-area[\s\S]*?pointer-events: auto/);
    assert.doesNotMatch(weeklyGoals, /select\('id,workout_name,template_name,created_at,workout_type'\)/);
    assert.match(migration, /CREATE TABLE public\.user_food_preferences/);
    assert.match(migration, /ALTER TABLE public\.user_food_preferences ENABLE ROW LEVEL SECURITY/);
    assert.match(migration, /WITH CHECK \(auth\.uid\(\) = user_id\)/);
});

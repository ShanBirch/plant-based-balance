const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const coaching = read('coaching.html');
const founders = read('plant-based-fitness.html');
const broadFounders = read('fitness-coaching.html');
const checkout = read('checkout.js');
const success = read('success.html');
const bookingPage = read('book.html');
const booking = read('booking.js');
const bookingStyles = read('booking.css');
const bookingFunction = read('netlify/functions/balance-booking.mts');
const netlifyConfig = read('netlify.toml');
const adminAi = read('netlify/edge-functions/admin-ai-coach.ts');
const migration = read('supabase/migrations/20260716100000_standardise_ig_coaching_checkout_url.sql');
const salesBot = read('netlify/edge-functions/sales-bot.js');

test('DM coaching page goes directly to hosted Stripe Checkout', () => {
    assert.match(coaching, /href="#plan-checkout"/);
    assert.doesNotMatch(coaching, /shop\.html#pricing/);
    assert.match(coaching, /id="terms-checkbox"/);
    assert.match(coaching, /data-hosted-checkout-only="true"/);
    assert.match(coaching, /src="checkout\.js"/);
    assert.match(checkout, /btn\.dataset\.hostedCheckoutOnly !== 'true'/);
    assert.match(checkout, /create-checkout-session/);
    assert.match(coaching, /data-plan="app-monthly"/);
    assert.match(checkout, /'app-monthly': 'balance_app_community_monthly'/);
    assert.match(coaching, /App \+ Community/);
    assert.match(coaching, /\$19\.99<span>\/month<\/span>/);
    assert.match(coaching, /data-plan="coaching-calls"/);
    assert.match(checkout, /'coaching-calls': 'balance_coaching_calls_weekly'/);
    assert.match(coaching, /\$99\.99<span>\/week<\/span>/);
});

test('What I Offer presents the Founders Pass as the primary offer', () => {
    assert.match(coaching, /AU\$89\.99 Founders Pass is a fixed six-week course/);
    assert.match(coaching, /one weekly check-in, workout and food review/i);
    assert.match(coaching, /No auto-renewal/i);
    assert.match(coaching, /href="plant-based-fitness\.html#join">Get the Founders Pass<\/a>/);
    assert.match(coaching, /Starter Coaching is AU\$29\.99 per week for ongoing individual progression/i);
    assert.doesNotMatch(coaching, /The main offer is AUD \$29\.99\/week/);
});

test('What I Offer presents capacity-gated 1:1 Zoom PT pricing', () => {
    assert.match(coaching, /id="zoom-pt"/);
    assert.match(coaching, /Zoom PT 1[\s\S]*?\$125<span>\/week<\/span>/);
    assert.match(coaching, /Zoom PT 3[\s\S]*?\$275<span>\/week<\/span>/);
    assert.match(coaching, /Zoom PT 5[\s\S]*?\$425<span>\/week<\/span>/);
    assert.match(coaching, /book\.html\?source=zoom_pt&amp;pt_sessions=1/);
    assert.match(coaching, /book\.html\?source=zoom_pt&amp;pt_sessions=3/);
    assert.match(coaching, /book\.html\?source=zoom_pt&amp;pt_sessions=5/);
    assert.match(coaching, /confirm health fit and recurring times before payment/i);
    assert.doesNotMatch(coaching, /data-plan="zoom-pt/);
});

test('What I Offer uses real coaching photography between offer sections', () => {
    assert.match(coaching, /photos\/journey\/melbourne-gym-group\.png/);
    assert.match(coaching, /photos\/shannon-portrait\.jpg/);
    assert.match(coaching, /alt="Shannon with members of his Melbourne personal training studio"/);
    assert.match(coaching, /alt="Shannon holding training ropes outdoors"/);
    assert.match(coaching, /loading="lazy" decoding="async"/);
});

test('Zoom PT availability choice reaches the booking record and calendar event', () => {
    assert.match(booking, /bookingSource === 'zoom_pt'/);
    assert.match(booking, /ptSessionsPerWeek/);
    assert.match(booking, /Check your Zoom PT/);
    assert.match(bookingFunction, /normalizePtSessionsPerWeek/);
    assert.match(bookingFunction, /pt_sessions_per_week: ptSessionsPerWeek/);
    assert.match(bookingFunction, /Requested Zoom PT sessions each week/);
    assert.match(booking, /if \(isZoomPtEnquiry\) \{[\s\S]*Zoom PT fit call booked\.[\s\S]*\} else \{/);
    assert.match(booking, /prepareZoomPtForm\(form\);\s*prepareZoomPtForm\(outsideForm\);\s*updateCallTypeFields\(form, 'booking-phone-label', 'booking-call-type-note'\);\s*updateCallTypeFields\(outsideForm, 'booking-outside-phone-label', 'booking-outside-call-type-note'\);/);
    assert.match(bookingPage, /id="booking-unavailable-action"/);
    assert.match(booking, /Email my availability/);
    assert.match(booking, /const subject = encodeURIComponent\(`\$\{packageName\} availability`\)/);
});

test('all active DM handoffs use the clean permanent Founders Pass URL', () => {
    const files = [
        'netlify/edge-functions/sales-bot.js',
        'netlify/functions/_lib/client-context.js',
        'netlify/functions/_lib/dm-sparring-gym.js',
        'netlify/functions/_lib/qualifier-engine.js',
        'netlify/functions/client-lead-manager.js',
        'netlify/functions/ig-instant-draft.js',
        'netlify/functions/scheduled-coach-reply-worker.js'
    ];

    for (const file of files) {
        const source = read(file);
        assert.match(source, /https:\/\/plantbased-balance\.org\/founders/, file);
        assert.doesNotMatch(source, /plantbased-balance\.org\/founders\?/, file);
        assert.doesNotMatch(source, /https:\/\/future-balance\.netlify\.app\/coaching\.html/, file);
    }
});

test('clean Founders Pass route and cream-gold social preview stay wired', () => {
    const netlify = read('netlify.toml');
    const analytics = read('analytics.js');
    assert.match(netlify, /from = "\/founders"[\s\S]{0,120}to = "\/plant-based-fitness\.html"[\s\S]{0,80}status = 200/);
    assert.match(netlify, /from = "\/founders\/:meta_ref"[\s\S]{0,120}to = "\/plant-based-fitness\.html"[\s\S]{0,80}status = 200/);
    assert.match(analytics, /shortMetaRoute[\s\S]{0,900}incoming\.ad_id = decoded\.toString\(\)/);
    assert.match(founders, /<base href="\/">/);
    assert.match(founders, /href="\/founders#join"/);
    assert.match(broadFounders, /<base href="\/">/);
    assert.match(broadFounders, /href="\/fitness#join"/);
    assert.match(founders, /property="og:url" content="https:\/\/plantbased-balance\.org\/founders"/);
    assert.match(founders, /property="og:image" content="https:\/\/plantbased-balance\.org\/assets\/balance-founders-og-cream-gold\.png\?v=20260804"/);
    assert.match(broadFounders, /property="og:url" content="https:\/\/future-balance\.netlify\.app\/fitness"/);
    assert.match(broadFounders, /property="og:image" content="https:\/\/future-balance\.netlify\.app\/assets\/balance-founders-og-cream-gold\.png\?v=20260804"/);
    assert.ok(fs.existsSync(path.join(root, 'assets', 'balance-founders-og-cream-gold.png')));
});

test('Founders Pass page sells the one-time membership through guarded hosted checkout', () => {
    assert.match(founders, /Balance Foundations Founders Pass/);
    assert.match(founders, /AU\$89\.99/);
    assert.match(founders, /complete six-week Balance Foundations course/i);
    assert.match(founders, /One payment\. Six weeks\. No auto-renewal/i);
    assert.match(founders, /weekly workout and food review with adjustments/i);
    assert.match(founders, /id="terms-checkbox"/);
    assert.match(founders, /data-plan="founders-pass"/);
    assert.match(founders, /data-hosted-checkout-only="true"/);
    assert.match(founders, /src="checkout\.js"/);
    assert.match(checkout, /'founders-pass': 'balance_vegan_founders_pass'/);
});

test('money funnel recognises new and historic coaching links', () => {
    assert.match(migration, /plantbased-balance\.org\/coaching\.html/);
    assert.match(migration, /future-balance\.netlify\.app\/coaching\.html/);
    assert.match(migration, /ig_message_has_coaching_checkout_link/);
});

test('legacy public funnel pages route into the current customer journey', () => {
    assert.match(netlifyConfig, /from = "\/shop"[\s\S]*?to = "\/coaching\.html"[\s\S]*?force = true/);
    assert.match(netlifyConfig, /from = "\/success-stories"[\s\S]*?to = "\/clients\.html"[\s\S]*?force = true/);
});

test('paid coaching handoff sends buyers into Balance with the checkout email', () => {
    assert.match(success, /Create your account using the same email you used at checkout/);
    assert.match(success, /login\.html\?action=signup&amp;source=checkout/);
    assert.match(success, /I already have a Balance account/);
    assert.doesNotMatch(success, /Your hormones will thank you/);
    assert.match(success, /app_community_monthly/);
    assert.match(success, /Balance App \+ Community/);
    assert.match(success, /coaching_calls_weekly/);
    assert.match(success, /BOOK MY FIRST CALL/);
    assert.match(success, /book\.html\?source=coaching_calls_purchase&amp;first_call=1/);
    assert.match(success, /Step 1: book your first call/);
    assert.match(success, /Step 2: open Balance/);
    assert.match(booking, /isFirstCoachingCall/);
    assert.match(booking, /login\.html\?action=signup&source=coaching_calls_booking/);
    assert.match(bookingPage, /booking-success-existing/);
    assert.match(bookingStyles, /\.booking-date-list::-webkit-scrollbar/);
    assert.match(adminAi, /profile\.subscription_plan \|\| profile\.subscription_type/);
});

test('the paid acupressure bonus has every diagram it references', () => {
    const guide = read('acupressure-guide.html');
    const diagrams = [...guide.matchAll(/assets\/acupressure\/([^"']+\.png)/g)].map((match) => match[1]);
    assert.ok(diagrams.length >= 10);
    for (const diagram of diagrams) {
        assert.ok(fs.existsSync(path.join(root, 'assets', 'acupressure', diagram)), diagram);
    }
});

test('website sales chat uses the working OpenAI provider and shared compatibility wrapper', () => {
    assert.match(salesBot, /OPENAI_API_KEY/);
    assert.match(salesBot, /callOpenAIGeminiCompat/);
    assert.match(salesBot, /profile:\s*"coach_fallback"/);
    assert.match(salesBot, /Personalized\/personalised coaching plan/);
    assert.match(salesBot, /means Starter Coaching at AUD \$29\.99\/week/);
    assert.match(salesBot, /Do not lead with Founders Pass/);
    assert.doesNotMatch(salesBot, /generativelanguage\.googleapis\.com/);
    assert.doesNotMatch(salesBot, /GEMINI_API_KEY/);
});

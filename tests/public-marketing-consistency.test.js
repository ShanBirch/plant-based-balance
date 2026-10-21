const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const visible = file => read(file).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const offers = ['coaching.html', 'fitness-coaching.html', 'plant-based-challenge.html'];
const legal = ['terms.html', 'client-agreement.html', 'refund-policy.html'];
const pages = [...offers, ...legal, 'plant-based-fitness.html', 'bio.html', 'balance.html', 'index.html', 'book.html', 'learning.html'];

test('comparison destinations show three agreed starting packages, inclusions and minimum totals', () => {
    for (const file of offers) {
        const text = visible(file);
        for (const fact of ['Balance Learn', 'Zoom Personal Training', 'Programming & Nutrition', '$125', '$75', '$120', '$1,370', '$870', 'Ten-week minimum', 'GST included']) assert.ok(text.includes(fact), `${file}: ${fact}`);
        const cards = [...read(file).matchAll(/<article class="offer-card[^>]*" id="(learn|zoom-pt|programming-nutrition)">([\s\S]*?)<\/article>/g)];
        assert.equal(cards.length, 3, file);
        for (const [, id, card] of cards) {
            assert.match(card, /A meal plan/);
            assert.match(card, /workout program updated weekly/);
            assert.match(card, /weekly voice-note check-in inside Balance/);
            assert.match(card, new RegExp(`href="/book\\?offer=${id}"`));
            assert.match(card, /data-track="cta_click"/);
            assert.match(card, id === 'programming-nutrition' ? /No live teaching lesson or supervised session/ : /45-minute/);
            if (id === 'learn') assert.match(card, /teaching lesson/);
            if (id === 'zoom-pt') assert.match(card, /supervised Zoom workout.*replacing the teaching lesson/);
        }
    }
});

test('ongoing coaching is separate without an invented repeat upfront charge or renewal', () => {
    for (const file of ['coaching.html', 'fitness-coaching.html']) {
        const section = read(file).match(/<section id="ongoing-coaching">([\s\S]*?)<\/section>/)[1];
        for (const fact of ['three-month minimum', '$75', '$125', '45-minute supervised Zoom PT', 'Existing clients keep their agreed rates and terms']) assert.ok(section.includes(fact), `${file}: ${fact}`);
        assert.doesNotMatch(section, /Plus.*\$120|data-plan=/);
        assert.match(section, /repeat upfront fee and automatic renewal are not part/);
        assert.match(section, /Group coaching.*not currently available to purchase/);
    }
});

test('current public pages cannot start mismatched legacy checkout or replace prices dynamically', () => {
    for (const file of pages) {
        assert.doesNotMatch(read(file), /data-plan=|src="\/?checkout\.js|src="\/learn-course-pricing-ui\.js|data-learn-upfront/, file);
        assert.doesNotMatch(visible(file), /\$149\b|\$450\b|\$24\.83\b|\$29\.99\b|\$49\.99\b|\$74\.99\b|Starts 5 October 2026/, file);
        assert.doesNotMatch(visible(file), /FitGotchi|—|\bAI\b|household budget|personal allowance/i, file);
    }
});

test('Learn and legal copy distinguish teaching from supervised workouts and preserve legacy terms', () => {
    for (const file of ['plant-based-fitness.html', ...legal]) {
        const text = visible(file);
        for (const fact of ['$125/week', '$120', '$1,370', 'ten learning sections', '45-minute Zoom teaching lesson']) assert.ok(text.includes(fact), `${file}: ${fact}`);
    }
    for (const file of legal) {
        assert.match(visible(file), /Existing clients keep their agreed rates, billing and terms/);
        assert.match(visible(file), /three-month minimum/);
        assert.match(visible(file), /automatic renewal.*not assumed/);
    }
});

test('primary entries and menus lead to current packages while campaign evidence is retained', () => {
    assert.match(read('bio.html'), /href="\/coaching#starting-packages" data-bio-link="starting_packages"/);
    assert.match(read('balance.html'), /href="\/coaching#starting-packages" data-track="cta_click"/);
    assert.doesNotMatch(read('site-navigation.js'), /textContent = 'Summer Ready Shred'|set\('source', 'plant_based_challenge'\)/);
    assert.match(read('public-offer-links.js'), /utm_source.*utm_medium.*utm_campaign/);
    assert.match(read('public-offer-links.js'), /analytics_test/);
    for (const file of pages) assert.doesNotMatch(read(file), /href="\/plant-based-challenge"[^>]*>Summer Ready Shred/);
});

test('separate local home PT details remain intact', () => {
    const home = read('coaching.html').match(/<section id="home-pt"[\s\S]*?<\/section>/)[0];
    assert.match(home, /\$120/);
    assert.match(home, /\$170/);
    assert.match(home, /45-minute home/);
    assert.match(home, /home_pt_package=balance/);
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const visibleText = (file) => read(file)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const corePages = [
    'bio.html',
    'balance.html',
    'clients.html',
    'coaching.html',
    'journey.html',
    'plant-based-fitness.html',
    'book.html',
    'index.html',
    'client-agreement.html',
    'terms.html',
    'refund-policy.html'
];

test('public journey consistently routes the primary action to the Founders Pass', () => {
    assert.match(read('bio.html'), /class="hub-button primary" href="plant-based-fitness\.html"/);
    assert.match(read('clients.html'), /class="nav-button primary" href="plant-based-fitness\.html">Founders Pass/);
    assert.match(read('journey.html'), /class="nav-button primary" href="plant-based-fitness\.html">Founders Pass/);
    assert.match(read('balance.html'), /class="btn primary" href="plant-based-fitness\.html">Get the Founders Pass/);
    assert.match(visibleText('book.html'), /You do not need a call to join the Founders Pass/);
});

test('offer facts agree across marketing and legal pages', () => {
    const founders = visibleText('plant-based-fitness.html');
    const coaching = visibleText('coaching.html');
    const agreement = visibleText('client-agreement.html');
    const terms = visibleText('terms.html');
    const refunds = visibleText('refund-policy.html');

    for (const content of [founders, coaching]) {
        assert.match(content, /(?:AU|AUD)?\$89\.99 once/i);
        assert.match(content, /six-week/i);
        assert.match(content, /one weekly check-in/i);
        assert.match(content, /no auto-renewal|does not renew|does not auto-renew/i);
    }

    assert.match(agreement, /does not include instant replies, unlimited daily one-to-one access or live calls/i);
    assert.match(coaching, /Starter Coaching.*\$29\.99 \/week/s);
    assert.match(terms, /Balance Foundations Founders Pass/);
    assert.match(refunds, /Founders Pass is a one-time purchase/);
    assert.match(founders, /BALANCE FOUNDATIONS AU\$89\.99 COMPLETE 6-WEEK CURRICULUM WEEKLY COACHING REVIEW/);
    assert.doesNotMatch(founders, /Starter Coaching/);
});

test('Shannon story agrees wherever it appears', () => {
    assert.match(visibleText('journey.html'), /plant-based from birth/i);
    assert.match(visibleText('journey.html'), /five years as a vegan/i);
    assert.match(visibleText('plant-based-fitness.html'), /raised vegetarian from birth and have been vegan for five years/i);
    assert.doesNotMatch(visibleText('journey.html'), /building Balance/i);
});

test('public marketing copy does not expose automation, the legacy codename or em dashes', () => {
    for (const file of corePages) {
        const copy = visibleText(file);
        assert.doesNotMatch(copy, /\bAI\b|artificial intelligence/i, file);
        assert.doesNotMatch(copy, /FitGotchi/i, file);
        assert.doesNotMatch(copy, /—/, file);
    }
});

test('retired legacy offer pages are forced onto the aligned pages', () => {
    const netlify = read('netlify.toml');
    assert.match(netlify, /from = "\/shop\.html"[\s\S]*?to = "\/coaching\.html"[\s\S]*?status = 301[\s\S]*?force = true/);
    assert.match(netlify, /from = "\/success-stories\.html"[\s\S]*?to = "\/clients\.html"[\s\S]*?status = 301[\s\S]*?force = true/);
});

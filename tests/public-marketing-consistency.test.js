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

test('public journey consistently routes the primary action to Balance Foundations', () => {
    assert.match(read('bio.html'), /class="hub-button primary" href="\/founders"/);
    assert.match(read('clients.html'), /class="nav-button primary" href="\/founders">See your Balance preview/);
    assert.match(read('journey.html'), /class="nav-button primary" href="\/founders">See your Balance preview/);
    assert.match(read('balance.html'), /class="btn primary" href="\/founders">See your personalised Balance preview/);
    assert.match(visibleText('book.html'), /You do not need a call to start Balance Foundations/);
});

test('independent public resources use the Balance brand and Foundations-first action', () => {
    const resourcePages = [
        'blog.html',
        'blog-fitness.html',
        'calculators.html',
        'calc-calorie-deficit.html',
        'research.html',
        'contact.html',
        'learning.html'
    ];

    for (const file of resourcePages) {
        const content = read(file);
        const copy = visibleText(file);
        assert.doesNotMatch(copy, /FitGotchi|Start Your Reset|Download Free/i, file);
        assert.match(content, /href="\/founders"/, file);
    }

    assert.match(visibleText('balance.html'), /One AUD \$149 payment for the full six weeks\. No subscription or automatic renewal\./);
    assert.match(visibleText('learning.html'), /Foundations gives every member the same practical six-week starting path/);
    assert.match(read('netlify.toml'), /from = "\/welcome\.html"[\s\S]*?to = "\/balance\.html"[\s\S]*?status = 301/);
    assert.match(read('robots.txt'), /Sitemap: https:\/\/plantbased-balance\.org\/sitemap\.xml/);
    assert.match(read('sitemap.xml'), /https:\/\/plantbased-balance\.org\/founders/);
});

test('offer facts agree across marketing and legal pages', () => {
    const founders = visibleText('plant-based-fitness.html');
    const coaching = visibleText('coaching.html');
    const agreement = visibleText('client-agreement.html');
    const terms = visibleText('terms.html');
    const refunds = visibleText('refund-policy.html');

    for (const content of [founders, coaching]) {
        assert.match(content, /(?:AU|AUD)\s?\$149/i);
        assert.match(content, /full six weeks|complete six weeks/i);
        assert.match(content, /six-week/i);
        assert.match(content, /one weekly check-in/i);
        assert.match(content, /no subscription|not a subscription/i);
        assert.match(content, /no auto-renewal|no automatic renewal|does not renew|does not auto-renew/i);
        assert.doesNotMatch(content, /\$89(?:\.99)?|\b(?:8900|8999)\b/i);
    }

    assert.match(agreement, /does not include instant replies, unlimited daily one-to-one access or live calls/i);
    assert.match(coaching, /6-Month Coaching.*\$29\.99 \/week/s);
    assert.match(coaching, /3-Month Coaching.*\$49\.99 \/week/s);
    assert.match(coaching, /Month-to-Month Coaching.*\$74\.99 \/week/s);
    assert.match(terms, /26 weekly payments at AU\$29\.99/);
    assert.match(refunds, /26-week, 13-week or four-week initial minimum/);
    assert.match(terms, /Balance Foundations is one AUD \$149 payment for the full six weeks/i);
    assert.match(refunds, /Balance Foundations is one AUD \$149 payment for the full six weeks/i);
    assert.match(founders, /Balance Foundations turns behaviour-change and neuroscience principles into one guided weekly rhythm/i);
    assert.match(founders, /One AUD \$149 payment Full six weeks, no automatic renewal/i);
    assert.doesNotMatch(founders, /Starter Coaching/);
});

test('Shannon story agrees wherever it appears', () => {
    assert.match(visibleText('journey.html'), /plant-based from birth/i);
    assert.match(visibleText('journey.html'), /five years as a vegan/i);
    assert.match(visibleText('plant-based-fitness.html'), /I am an exercise scientist and former gym owner/i);
    assert.doesNotMatch(visibleText('plant-based-fitness.html'), /I am a neuroscientist/i);
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
    assert.match(netlify, /from = "\/fitness"[\s\S]*?to = "\/fitness-coaching\.html"[\s\S]*?status = 200[\s\S]*?force = true/);
});

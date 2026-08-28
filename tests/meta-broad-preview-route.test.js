const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('broad signed preview uses a neutral public wrapper and the existing preview destination', () => {
    const netlify = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
    const wrapper = fs.readFileSync(path.join(root, 'meta-app-preview.html'), 'utf8');
    const destination = fs.readFileSync(path.join(root, 'plant-based-fitness.html'), 'utf8');

    assert.match(netlify, /from = "\/p\/:meta_ref"[\s\S]{0,120}to = "\/meta-app-preview\.html"/);
    assert.match(wrapper, /window\.location\.replace\('\/founders\?' \+ incoming\.toString\(\)\)/);

    const ogDescription = wrapper.match(/<meta property="og:description" content="([^"]+)">/)?.[1] || '';
    assert.match(ogDescription, /workout and nutrition preferences/i);
    assert.doesNotMatch(ogDescription, /plant[ -]?based|vegan|vegetarian/i);
    assert.match(destination, /one AUD \$149 payment for the full six weeks/i);
    assert.match(destination, /No subscription or automatic renewal/i);
});

test('active paid campaign source contains one neutral route and current terms', () => {
    const source = fs.readFileSync(path.join(root, 'scripts', 'build-meta-broad-pain-test.mjs'), 'utf8');
    assert.doesNotMatch(source, /(?:AU\$|AUD\s*\$?)89(?:\.99)?\b/i);
    assert.match(source, /one AUD \$149 payment for the full six weeks/i);
    assert.match(source, /no auto-renewal/i);
    assert.doesNotMatch(source, /Existing plant-based control|plantBasedControl|plant_based_control/);
    assert.match(source, /Every verified paid-Meta lead uses the one neutral general-fitness flow/i);
});

test('preview outcome reconciliation recognises both plant-control and broad signed hosts', () => {
    const logEvent = fs.readFileSync(path.join(root, 'netlify', 'functions', 'log-lp-event.js'), 'utf8');
    const stripeWebhook = fs.readFileSync(path.join(root, 'netlify', 'edge-functions', 'stripe-webhook.js'), 'utf8');
    for (const source of [logEvent, stripeWebhook]) {
        assert.match(source, /plantbased-balance\\\.org\|future-balance\\\.netlify\\\.app/);
        assert.match(source, /meta-app-preview\\\.html\|p\\\//);
    }
});

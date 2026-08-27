const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').trim();

test('store copy leads with neuroscience-informed fitness within platform limits', () => {
    const appName = read('store-listing/app-store/en-AU/name.txt');
    const subtitle = read('store-listing/app-store/en-AU/subtitle.txt');
    const promo = read('store-listing/app-store/en-AU/promotional_text.txt');
    const keywords = read('store-listing/app-store/en-AU/keywords.txt');
    const appleDescription = read('store-listing/app-store/en-AU/description.txt');
    const playTitle = read('store-listing/google-play/en-AU/title.txt');
    const shortDescription = read('store-listing/google-play/en-AU/short_description.txt');
    const playDescription = read('store-listing/google-play/en-AU/full_description.txt');
    const combined = [appName, subtitle, promo, keywords, appleDescription, playTitle, shortDescription, playDescription].join('\n');

    assert.equal(appName, 'Balance: Neuroscience Fitness');
    assert.equal(playTitle, appName);
    assert.ok(appName.length <= 30);
    assert.ok(subtitle.length <= 30);
    assert.ok(promo.length <= 170);
    assert.ok(keywords.length <= 100);
    assert.ok(shortDescription.length <= 80);
    assert.ok(playDescription.length <= 4000);
    assert.match(combined, /neuroscience/i);
    assert.match(combined, /behaviour/i);
    assert.match(combined, /vegan/i);
    assert.match(combined, /community/i);
    assert.doesNotMatch(combined, /FitGotchi|Tamagotchi|AI coach|artificial intelligence/i);
});

test('store visuals use approved phone dimensions and no character assets', async () => {
    const appleDir = path.join(root, 'store-listing', 'app-store-screenshots', 'en-AU');
    const playDir = path.join(root, 'store-listing', 'google-play', 'en-AU', 'images', 'phoneScreenshots');
    const appleFiles = fs.readdirSync(appleDir).filter((file) => file.endsWith('.png')).sort();
    const playFiles = fs.readdirSync(playDir).filter((file) => file.endsWith('.png')).sort();

    assert.equal(appleFiles.length, 6);
    assert.equal(playFiles.length, 6);
    const expectedCampaign = [
        '01-neuroscience-fitness.png',
        '02-behaviour-change.png',
        '03-training.png',
        '04-personalised-nutrition.png',
        '05-progress.png',
        '06-community.png',
    ];
    assert.deepEqual(appleFiles, expectedCampaign);
    assert.deepEqual(playFiles, expectedCampaign);
    assert.doesNotMatch([...appleFiles, ...playFiles].join(' '), /character|fitgotchi|tamagotchi/i);

    const manifest = JSON.parse(read('store-listing/manifest.json'));
    assert.match(manifest.sourcePolicy, /real supplied photography/i);
    assert.match(manifest.sourcePolicy, /redacted/i);

    for (const file of appleFiles) {
        const meta = await sharp(path.join(appleDir, file)).metadata();
        assert.deepEqual([meta.width, meta.height], [1290, 2796]);
    }
    for (const file of playFiles) {
        const meta = await sharp(path.join(playDir, file)).metadata();
        assert.deepEqual([meta.width, meta.height], [1080, 1920]);
    }

    const feature = await sharp(path.join(root, 'store-listing', 'google-play', 'en-AU', 'images', 'featureGraphic.png')).metadata();
    assert.deepEqual([feature.width, feature.height], [1024, 500]);
});

test('store visual generator keeps listing callouts readable and authentic', () => {
    const generator = read('scripts/generate-store-listing-assets.mjs');

    assert.doesNotMatch(generator, />COACH-LED CHALLENGE<\/text>/);
    assert.match(generator, /x="\$\{spec\.width \* 0\.05\}"[^>]+width="\$\{spec\.width \* 0\.9\}"/);
    assert.doesNotMatch(generator, /\{ slug: 'founders-pass'/);
    assert.match(generator, /THE SCIENCE OF CHANGE/);
    assert.match(generator, /NUTRITION THAT FITS YOU/);
    assert.match(generator, /Personalised meal plans/);
    assert.match(generator, /const calloutWidth = spec\.width \* 0\.44/);
    assert.match(generator, /const calloutTextX = spec\.width \* 0\.075/);
    assert.match(generator, /const calloutFontSize = Math\.round\(spec\.width \* 0\.026\)/);
    assert.doesNotMatch(generator, />[^<]*vegan[^<]*<\/text>/i);
    assert.match(generator, /community-meal-win\.jpg/);
    assert.match(generator, /community-milestone-win\.jpg/);
    assert.match(generator, /community-workout-win\.jpg/);
});

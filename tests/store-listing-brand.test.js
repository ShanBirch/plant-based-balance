const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').trim();

test('store copy leads with plant-based fitness within platform limits', () => {
    const appName = read('store-listing/app-store/en-AU/name.txt');
    const subtitle = read('store-listing/app-store/en-AU/subtitle.txt');
    const promo = read('store-listing/app-store/en-AU/promotional_text.txt');
    const keywords = read('store-listing/app-store/en-AU/keywords.txt');
    const appleDescription = read('store-listing/app-store/en-AU/description.txt');
    const playTitle = read('store-listing/google-play/en-AU/title.txt');
    const shortDescription = read('store-listing/google-play/en-AU/short_description.txt');
    const playDescription = read('store-listing/google-play/en-AU/full_description.txt');
    const combined = [appName, subtitle, promo, keywords, appleDescription, playTitle, shortDescription, playDescription].join('\n');

    assert.equal(appName, 'Balance: Plant-Based Fitness');
    assert.equal(playTitle, appName);
    assert.ok(appName.length <= 30);
    assert.ok(subtitle.length <= 30);
    assert.ok(promo.length <= 170);
    assert.ok(keywords.length <= 100);
    assert.ok(shortDescription.length <= 80);
    assert.ok(playDescription.length <= 4000);
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
    assert.doesNotMatch([...appleFiles, ...playFiles].join(' '), /character|fitgotchi|tamagotchi/i);

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

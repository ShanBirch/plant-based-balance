const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/dashboard/dashboard-script-7-video_logic.js'), 'utf8');
const start = source.indexOf('function startInlineVideoPlayback(');
const end = source.indexOf('function playInlineVideo(', start);

for (const scenario of [
    { name: 'retry reloads a stalled same-URL resource', reload: true, error: null, loads: 1 },
    { name: 'play recovers a failed same-URL resource', reload: false, error: { code: 4 }, loads: 1 },
    { name: 'ordinary resume preserves a healthy resource', reload: false, error: null, loads: 0 }
]) test(scenario.name, async () => {
    let loads = 0;
    let played = false;
    const video = {
        src: 'https://example.test/demo.mp4', error: scenario.error,
        dataset: {}, style: {}, currentTime: 0, setAttribute() {},
        load() { loads++; this.error = null; },
        play() {
            if (this.error) return Promise.reject(new Error('Retained media error'));
            played = true;
            return Promise.resolve();
        }
    };
    const context = {
        clearInlineVideoLoadTimer() {}, hideInlineVideoStatus() {},
        cacheWorkoutVideosForOffline() {}, revealInlineExerciseThumbnail() {},
        showInlineVideoStatus() { throw new Error('Playback should recover'); },
        setTimeout() { return 1; }, console
    };
    vm.createContext(context);
    vm.runInContext(source.slice(start, end), context);
    context.startInlineVideoPlayback({}, video, video.src, { style: {} }, scenario.reload);
    await Promise.resolve();
    assert.equal(loads, scenario.loads);
    assert.equal(played, true);
});

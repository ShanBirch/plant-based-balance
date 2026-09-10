const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../lib/lesson-reflections.js'), 'utf8');
function setup(response) {
    let reads = 0;
    const context = { window: { currentUser: { id: 'learner' }, supabaseClient: { from() {
        reads++; return { select() { return this; }, eq() { return this; }, maybeSingle: async () => response };
    }}}, document: { getElementById: () => null }, console };
    vm.runInNewContext(source, context);
    return { context, open: context.window.BalanceLessonReflections.open, reads: () => reads };
}
test('non-perfect and signed-out results never query or open a prompt', async () => {
    const s = setup({ data: null });
    await s.open({ lessonId: 'lesson', score: 80 });
    s.context.window.currentUser = null;
    await s.open({ lessonId: 'lesson', score: 100 });
    assert.equal(s.reads(), 0);
});
test('saved reflections suppress repeat prompts', async () => {
    const s = setup({ data: { lesson_id: 'lesson' } });
    await s.open({ lessonId: 'lesson', score: 100 });
    assert.equal(s.reads(), 1);
});
test('optional lookup failures do not block completion or leave a stuck prompt lock', async () => {
    const s = setup({ error: new Error('offline') });
    await s.open({ lessonId: 'lesson', score: 100 });
    await s.open({ lessonId: 'lesson', score: 100 });
    assert.equal(s.reads(), 2);
});

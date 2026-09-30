const {test,after} = require('node:test');
const assert = require('node:assert/strict');
process.env.SUPABASE_URL = 'https://instruction-test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
const realFetch = global.fetch;
let savedInstructions;
let writes = 0;
global.fetch = async (url, options) => {
    const request = new URL(url);
    assert.equal(request.host, 'instruction-test.invalid');
    assert.equal(options.method, 'PATCH');
    writes++;
    const expected = request.searchParams.get('coach_instructions');
    const decoded = expected.startsWith('eq."') && expected.endsWith('"')
        ? expected.slice(4,-1).replace(/\\(["\\])/g, '$1') : undefined;
    const matches = expected === 'is.null' ? savedInstructions === null : decoded === savedInstructions;
    if (!matches) return new Response('[]');
    savedInstructions = JSON.parse(options.body).coach_instructions;
    return new Response(JSON.stringify([{coach_instructions:savedInstructions}]));
};
after(() => { global.fetch = realFetch; });
const {splitCoachInstructionSections,buildCoachInstructionsWithEditLearning,saveEditLearningInstructions} = require('../netlify/functions/_lib/client-context');

test('explicit human directions below the learned header survive replacement learning without being shortened', () => {
    const direction = ('Shannon explicit direction, for this person only: answer their actual question, then use their stated goals before introducing the current challenge. ' + 'Preserve the confirmed facts. '.repeat(15)).trim();
    const fact = 'Confirmed directly by Shannon: use his current age and gym-starting age instead of older profile facts.';
    const boundary = 'Current explicit boundary, 30 September 2026: no sales sequence or proactive follow-up; respect their own pace.';
    const sections = splitCoachInstructionSections(`Manual: keep this person reactive only.\n\nLearned from Shannon edits:\n- Keep replies short.\n- ${direction}\n- ${fact}\n${boundary}`);
    assert.ok(sections.manual.includes(direction));
    assert.ok(sections.manual.includes(fact));
    assert.deepEqual(sections.autoBullets,['Keep replies short.']);
    const replacement = buildCoachInstructionsWithEditLearning(sections.manual,['Prefer a specific acknowledgment.']);
    assert.ok(replacement.includes(direction));
    assert.ok(replacement.includes(fact));
    assert.ok(replacement.includes(boundary));
    assert.ok(replacement.indexOf(direction) < replacement.indexOf('Learned from Shannon edits:'));
    assert.doesNotMatch(replacement,/Keep replies short/);
});

test('a newer manual instruction cannot be overwritten by a slow learning call', async () => {
    savedInstructions = 'Shannon added a newer manual hold.';
    for (const target of [
        {type:'ig_threads',igThreadId:'thread',expectedInstructions:'Old learned instructions'},
        {type:'client_memory',coachId:'coach',clientId:'client',expectedInstructions:'Old learned instructions'},
    ]) {
        assert.equal(await saveEditLearningInstructions(target,'Outdated model rewrite'),false);
        assert.equal(savedInstructions,'Shannon added a newer manual hold.');
    }
});

test('matching versions update once; null is different from an empty string', async () => {
    savedInstructions = '"Existing instructions with a comma, quote " and backslash \\\\ and newline\nsecond line';
    const target = {type:'ig_threads',igThreadId:'thread',expectedInstructions:savedInstructions};
    assert.equal(await saveEditLearningInstructions(target,'New learned instructions'),true);
    assert.equal(await saveEditLearningInstructions(target,'Duplicate stale rewrite'),false);
    savedInstructions = null;
    assert.equal(await saveEditLearningInstructions({...target,expectedInstructions:''},'Wrong empty baseline'),false);
    assert.equal(await saveEditLearningInstructions({...target,expectedInstructions:null},'First learning'),true);
    const before = writes;
    assert.equal(await saveEditLearningInstructions({type:'ig_threads',igThreadId:'thread'},'Unknown baseline'),false);
    assert.equal(writes,before);
});

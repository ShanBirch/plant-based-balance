const test=require('node:test');
const assert=require('node:assert/strict');
const curriculum=require('../lib/learn-curriculum');
const api=require('../netlify/functions/ig-instant-draft')._test;

test('new and historical course questions return the current eight-week curriculum',()=>{
 for(const currentMessage of ['What do you teach in each of the eight weeks? How many lessons are there?','What do you teach in each of the six weeks? How many lessons are there?']){
  const draft=api.buildDeterministicPaidMetaConversationReply({currentMessage,flowVariant:'broad_pain'});
  assert.match(draft.joined,/45 lessons across eight weeks/);
  for(const w of curriculum.weeks())assert.ok(draft.joined.toLowerCase().includes(w.title.replace(/\?$/,'').toLowerCase()),w.title);
  assert.equal((draft.joined.match(/\?/g)||[]).length,1,'one sales question, curriculum headings are not counted as questions');
 }
});
test('weeks seven and eight can be answered without dumping the entire curriculum',()=>{
 for(const n of [7,8]){
  const draft=api.buildDeterministicPaidMetaConversationReply({currentMessage:`What is in week ${n}?`,flowVariant:'broad_pain'});
  assert.match(draft.joined,new RegExp(`Week ${n}:`));assert.doesNotMatch(draft.joined,/Week 1:/);
 }
});
test('eight-week access and six-payment subscription commitment remain distinct',()=>{
 const draft=api.buildDeterministicPaidMetaConversationReply({currentMessage:'When does it start and what happens after eight weeks?',flowVariant:'broad_pain'});
 assert.match(draft.joined,/end after eight weeks/);
 const issues=api.collectPaidMetaWriterContractIssues({currentMessage:'How much does it cost weekly?',draft:{joined:'It is $24.83 per week with a six-week minimum, then continues until you cancel.'},history:[],flowVariant:'broad_pain'});
 assert.ok(!issues.some(x=>/price exactly/.test(x)));
});

test('upfront members are not sent an end-of-access message at six weeks',()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const source=fs.readFileSync(require.resolve('../netlify/functions/onboarding-scheduled-scan'),'utf8');
 const block=source.slice(source.indexOf('const MILESTONES = ['),source.indexOf('// Activity summary'));
 const milestones=vm.runInNewContext(block+'\nMILESTONES');
 const learn=milestones.filter(m=>m.requiredPlan==='balance_foundations_six_week');
 assert.deepEqual(Array.from(learn,m=>m.days),[49,56]);
 assert.match(learn[1].instructions,/included eight-week/);
 assert.equal(learn[1].windowMs,56*86400000);
});

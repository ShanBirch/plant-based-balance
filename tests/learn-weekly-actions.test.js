const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const learn = require('../lib/learn-weekly-actions');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/dashboard/pbb-social-journey.js'), 'utf8');
function fixture(week = 1) {
  const rows = {}, writes = [];
  const c = { console, Intl, Date, URLSearchParams, setTimeout() {}, localStorage: { getItem: () => 'true' }, sessionStorage: { getItem: () => null }, document: { getElementById: () => null } };
  c.window = c; c.BalanceLearnWeeklyActions = learn; c.actionRecords = {}; c.BalanceLearnActionReview = {open(){},record:w=>c.actionRecords[w],complete:r=>['completed','legacy_completed'].includes(r?.status),status:()=> 'Planned'}; c.location = { hostname: 'test', search: '' }; c.currentUser = { id: 'member' };
  c.supabaseClient = { from(table) {
    let payload;
    const q = { upsert(p) { payload = p; writes.push(p); return q; }, then(resolve) { return Promise.resolve({ data: payload || rows[table] || [] }).then(resolve); } };
    for (const name of ['select','eq','neq','gte','lt','in','not','order','limit','single']) q[name] = () => q;
    return q;
  } };
  vm.runInNewContext(source.slice(0, source.indexOf('  window.finishBalanceActivationLesson')) + `window.fixture = { calculateProgress, getFoundationsCourseProgress, taskAction, set: row => { state = normalizeState(row); }, get: () => state, definitions: WEEK_DEFINITIONS }; })();`, c);
  c.fixture.set({current_week: week, week_started_at: '2026-09-09', settings: {learn_actions_v2: {prior_week:1,credited_weeks:[]}}});
  return { c, rows, writes, f:c.fixture };
}
test('six weeks each contain five trackable actions with approved targets and Feed participation', () => {
  const { f } = fixture();
  f.definitions.slice(0,6).forEach((week,i) => {
    assert.equal(week.tasks.length,5);
    assert.equal(week.tasks.find(t=>t.type==='learn_meals').target, learn.meals[i]);
    assert.equal(week.tasks.find(t=>t.type==='learn_workouts').target, learn.workouts[i]);
    assert.equal(week.tasks.filter(t=>t.type==='learn_experiment').length,1);
    assert.equal(week.tasks.filter(t=>t.type==='weekly_checkin').length,1);
    assert.ok(!week.tasks.some(t=>t.type==='manual'));
  });
  assert.ok(f.definitions[4].tasks.some(t=>t.id==='w5_feed_participation'));
});
test('opening actions cannot award meals, movement, experiments or check-ins; saved records drive course ticks', async () => {
  const { f, rows, writes, c } = fixture();
  c.switchAppTab = () => {}; c.openWeeklyCheckinPreview = () => {};
  for (const id of ['w1_meals','w1_workouts','w1_experiment','w1_weekly_checkin']) await f.taskAction(id);
  await f.calculateProgress();
  assert.equal(f.getFoundationsCourseProgress().weekProgress[0].completedTasks,0);
  rows.meal_logs = [{id:'a'},{id:'b'},{id:'c'}];
  rows.workouts = [{workout_date:'2026-09-10',reps:10},{workout_date:'2026-09-10',reps:8}];
  rows.daily_checkins = [{checkin_date:'2026-09-07',additional_data:{weekly_checkin:{week_start:'2026-09-07',submitted_at:'2026-09-11T06:00:00Z',course_week:1,course_learning:'I snack when I sit down after work.',course_experiment_completed:true}}}];
  await f.calculateProgress();
  const week = f.getFoundationsCourseProgress().weekProgress[0];
  assert.equal(week.completedTasks,3);
  assert.equal(week.tasks.find(t=>t.type==='learn_workouts').current,1);
  assert.equal(writes.at(-1).settings.foundation_week_progress['1'].tasks.filter(t=>t.complete).length,3);
  const persisted = JSON.parse(JSON.stringify(writes.at(-1))); f.set(persisted);
  await f.calculateProgress(); assert.equal(f.getFoundationsCourseProgress().weekProgress[0].completedTasks,3);
  rows.daily_checkins[0].additional_data.weekly_checkin.course_experiment_completed=false;
  await f.calculateProgress();
  assert.equal(f.getFoundationsCourseProgress().weekProgress[0].tasks.find(t=>t.type==='learn_experiment').complete,false);
  assert.equal(f.getFoundationsCourseProgress().weekProgress[0].tasks.find(t=>t.type==='weekly_checkin').complete,true);
});
test('movement deduplicates sets and imported activity on the same day, rejects empty records', () => {
  assert.equal(learn.movementDays([{workout_date:'2026-09-10',reps:0},{workout_date:'2026-09-11',reps:4}], [{activity_date:'2026-09-11',duration_minutes:20},{activity_date:'2026-09-12',duration_minutes:15},{activity_date:'2026-09-13',duration_minutes:0}]),2);
});
test('weekly evidence handles non-Monday starts, excludes midweek, stale and future reports', () => {
  const report={week_start:'2026-09-07',submitted_at:'2026-09-11T08:00:00Z',course_week:2};
  const rows=[{additional_data:{weekly_checkins:[report,{...report,occurrence:'midweek_wednesday'},{...report,course_week:1},{...report,submitted_at:'2026-09-16T08:00:00Z'}]}}];
  assert.equal(learn.reportsForWeek(rows,2,'2026-09-09T00:00:00+10:00','2026-09-16T00:00:00+10:00').length,1);
  assert.equal(learn.effectiveWeek({current_week:1,week_started_at:'2026-09-02'},new Date('2026-09-11T00:00:00Z')),2);
});
test('completed old weeks keep explicit earlier credit and setup remains separately saved', async () => {
  const { f, rows, c } = fixture(3); c.actionRecords={1:{status:'legacy_completed'},2:{status:'legacy_completed'}};
  f.set({current_week:3,week_started_at:'2026-09-09',settings:{learn_actions_v2:{prior_week:3,credited_weeks:[1,2]},foundations_wearable_setup:{status:'no_compatible_watch'},fitgotchi_intro:{completed_at:'2026-09-01'}}});
  rows.weekly_progress_photos=[{notes:{saved_at:'2026-09-01T00:00:00Z',shots:['front','side','back'].map(angle=>({angle,photo_url:'https://example.test/'+angle}))}}];
  await f.calculateProgress(); const progress=f.getFoundationsCourseProgress();
  assert.ok(progress.weekProgress[0].tasks.every(t=>t.complete && t.exempt));
  assert.ok(progress.weekProgress[1].tasksComplete);
  assert.equal(progress.weekProgress[2].completedTasks,0);
  assert.equal(progress.setupTasks.length,3);
  assert.ok(progress.setupTasks.every(t=>t.complete));
});

test('only confirmed completion gives a course tick, including earlier weeks', async()=>{ const {f,c}=fixture(3); for(const status of ['planned','submitted','needs_information','completed']) { c.actionRecords[1]={status}; await f.calculateProgress(); assert.equal(f.getFoundationsCourseProgress().weekProgress[0].tasks.find(t=>t.type==='learn_experiment').complete,status==='completed'); } });

test('Feed participation counts distinct posts, excludes own replies and other weeks, and accepts PB as a post',()=>{
 const start='2026-09-09T00:00:00+10:00',end='2026-09-16T00:00:00+10:00';
 const base={user_id:'member',created_at:start};
 const posts=['meal','walk','pb'].map(id=>({...base,id,media_type:id==='pb'?'workout_card':'photo'}));
 const comments=[1,2,3].map(id=>({...base,id,story_id:'other-'+id,comment_text:'How did you make this?',stories:{user_id:'other'}}));
 const evidence=learn.feedEvidence([...posts,posts[0],{...base,id:'foreign',user_id:'other'},{...base,id:'late',created_at:end}], [...comments,comments[0],{...comments[0],id:4,story_id:'self',stories:{user_id:'member'}}], 'member',start,end);
 assert.equal(evidence.post_count,3);assert.equal(evidence.comment_post_count,3);assert.equal(evidence.complete,true);
 assert.equal(learn.feedEvidence(posts,comments.slice(0,2),'member',start,end).complete,false);
 assert.equal(learn.feedEvidence(posts.slice(0,2),comments,'member',start,end).complete,false);
 assert.equal(learn.feedEvidence(posts,comments.map(c=>({...c,story_id:'same'})),'member',start,end).complete,false);
 assert.equal(learn.feedEvidence(posts,comments.map(c=>({...c,comment_text:' '})),'member',start,end).complete,false);
});

test('week five Feed counts persist and review remains separate from participation',async()=>{
 const {f,rows,c,writes}=fixture(5);
 const base={user_id:'member',created_at:'2026-09-11T08:00:00Z'};
 rows.stories=[1,2,3].map(id=>({...base,id}));
 rows.feed_comments=[1,2,3].map(id=>({...base,id,story_id:'s'+id,comment_text:'That looks good, what did you use?',stories:{user_id:'other'}}));
 await f.calculateProgress();
 let week=f.getFoundationsCourseProgress().weekProgress[4];
 assert.equal(week.tasks.find(t=>t.type==='learn_feed_participation').complete,true);
 assert.equal(week.tasks.find(t=>t.type==='learn_experiment').complete,false);
 f.set(JSON.parse(JSON.stringify(writes.at(-1))));c.actionRecords[5]={status:'completed'};
 await f.calculateProgress();week=f.getFoundationsCourseProgress().weekProgress[4];
 assert.equal(week.tasks.find(t=>t.type==='learn_experiment').complete,true);
 rows.feed_comments.pop();await f.calculateProgress();
 assert.equal(f.getFoundationsCourseProgress().weekProgress[4].tasks.find(t=>t.type==='learn_feed_participation').complete,false);
});

test('earlier completed PB task keeps credit through the new Feed task and reopening',async()=>{
 const {f,writes}=fixture(5);
 f.set({current_week:5,week_started_at:'2026-09-09',settings:{foundation_week_progress:{5:{tasks:[{id:'w5_pb_feed',type:'foundations_pb_feed',complete:true,current:1}]}}}});
 for(let i=0;i<2;i++){
  await f.calculateProgress();assert.equal(f.getFoundationsCourseProgress().weekProgress[4].tasks.find(t=>t.type==='learn_feed_participation').complete,true);
  f.set(JSON.parse(JSON.stringify(writes.at(-1))));
 }
});

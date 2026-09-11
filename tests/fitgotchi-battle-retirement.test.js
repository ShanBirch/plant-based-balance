const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('dashboard.html');
const battle=read('js/dashboard/dashboard-script-14-stat_system_save_load_display.js');
const points=read('js/dashboard/dashboard-script-10-points_widget_functions.js');
function load(){
  const c={window:{_battleChallengeInterval:123},timers:[],cleared:[],console:{log(){},warn(){}},
    document:new Proxy({}, {get(){throw Error('Unexpected DOM access')}}),
    localStorage:new Proxy({}, {get(){throw Error('Unexpected storage access')}}),
    setTimeout:fn=>{c.timers.push(fn);return 1;},setInterval:fn=>{c.timers.push(fn);return 2;},
    clearInterval:id=>c.cleared.push(id)};
  vm.runInNewContext(battle,c);
  return c;
}
test('legacy fight entry points cannot open a modal, send invites, spend coins or start the engine',async()=>{
  const c=load();
  c.window.supabaseClient=new Proxy({}, {get(){throw Error('Unexpected network request')}});
  for(const name of ['startBattle','_sendBattleInvite','acceptBattleChallenge','checkForBattleChallenges','_runBattle']){
    assert.equal(await c.window[name]('test-opponent','Test'),false,name);
  }
  assert.equal(c.window._battleInProgress,undefined);
});
test('old fight polling is stopped while independent quiz games keep working',()=>{
  const c=load();
  assert.ok(c.cleared.includes(123));
  assert.equal(c.window._battleChallengeInterval,null);
  assert.ok(!c.timers.some(fn=>fn.name==='checkForBattleChallenges'));
  assert.ok(c.timers.some(fn=>fn.name==='checkForQuizBattleChallenges'));
  assert.equal(typeof c.window._acceptQuizBattleFromToast,'function');
});
test('combat allocations cannot interrupt level-up or modify saved stats',async()=>{
  const c=load();
  for(const name of ['showStatAllocationModal','grantStatPoints','grantStatPointsForLevelUp','ensureRetroactiveStatPoints','showStatTooltip']){
    assert.equal(await c.window[name](9,10),false,name);
  }
});
test('default colours work without a saved palette and existing colours are preserved',()=>{
  const character=read('js/dashboard/dashboard-script-13.js');
  const start=character.indexOf('        const DEFAULT_CHARACTER_COLORS');
  const end=character.indexOf('        // Load character colors and gender',start);
  const c={window:{},localStorage:{getItem:()=>c.saved||null},console};
  vm.runInNewContext(character.slice(start,end),c);
  const standard=c.window.getCharacterColors();
  for(const field of ['hair','shirt','pants','shoes','skin']) assert.match(standard[field],/^#[0-9a-f]{6}$/i);
  c.saved=JSON.stringify({...standard,hair:'#112233'});
  assert.equal(c.window.getCharacterColors().hair,'#112233');
});
test('retired controls are hidden in both themes without hiding character progress or community games',()=>{
  assert.doesNotMatch(html,/onclick="[^"]*startBattle\(\)/);
  const rule=html.slice(html.indexOf('.battle-trigger-btn,'),html.indexOf('/* Defensive:'));
  for(const id of ['battle-stats-row','battle-mode-overlay','battle-hp-container','battle-action-container','stat-alloc-overlay']){
    assert.ok(rule.includes('#'+id),id);
  }
  assert.match(rule,/display: none !important/);
  assert.doesNotMatch(rule,/#tamagotchi-stats-bar|#feed-start-battle-card|#balance-level-bar/);
  assert.doesNotMatch(points,/displayName: 'Battle Mode'/);
  assert.match(html,/fitgotchi-simple-progress-no-combat-v1/);
  assert.match(html,/title:'Meet your FitGotchi'.*standard colours/);
  assert.match(html,/Your character comes ready with standard colours|It comes ready with its standard colours/);
});
test('changed scripts and discovery controllers parse',()=>{
  new Function(battle);new Function(points);
  for(const marker of ['GUIDED FEATURE TOUR','NEW FEATURE REVEAL']){
    const start=html.indexOf('<script>',html.indexOf('<!-- ========== '+marker))+8;
    new Function(html.slice(start,html.indexOf('</script>',start)));
  }
  assert.equal((html.match(/dashboard-script-14-stat_system_save_load_display.js\?v=3-no-character-battles/g)||[]).length,2);
});

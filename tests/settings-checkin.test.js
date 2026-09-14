const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const frontend=fs.readFileSync(require.resolve('../js/dashboard/pbb-weekly-checkin-preview.js'),'utf8');
const dashboard=fs.readFileSync(require.resolve('../dashboard.html'),'utf8');
function fixture(){
 const c={Intl,Date,state:{schedule:{enabled:true,additional_days:['wednesday']}}};
 vm.runInNewContext(frontend.slice(frontend.indexOf('  function isWeeklyCheckinWindowOpen('),frontend.indexOf('  function openYourCheckin(')),c);
 return c;
}
test('Settings only opens Friday through Sunday in Brisbane, including midnight boundaries',()=>{
 const c=fixture();
 for(const [date,expected] of [['2026-09-14T02:00:00Z',false],['2026-09-15T02:00:00Z',false],['2026-09-16T02:00:00Z',false],['2026-09-17T13:59:59Z',false],['2026-09-17T14:00:00Z',true],['2026-09-19T02:00:00Z',true],['2026-09-20T13:59:59Z',true],['2026-09-20T14:00:00Z',false]]){
  assert.equal(c.isWeeklyCheckinWindowOpen(new Date(date),true),expected,date);
 }
 assert.equal(c.isWeeklyCheckinWindowOpen(new Date('2026-09-16T02:00:00Z')),true,'Assigned Wednesday remains available through existing routes');
});
test('closed Settings access never loads data, creates an overlay or records an open',async()=>{
 let loaded=0,shown='';
 const c={window:{BalanceLearnActionReview:{load:async()=>{loaded++;}}},isWeeklyCheckinWindowOpen:(_,weekendOnly)=>{assert.equal(weekendOnly,true);return false;},showToast:m=>shown=m};
 vm.runInNewContext(frontend.slice(frontend.indexOf('  function openYourCheckin('),frontend.indexOf('  function closeWeeklyCheckinPreview(')),c);
 await c.openYourCheckin();assert.equal(loaded,0);assert.match(shown,/Friday.*Sunday/);
});
test('Settings shortcut and both discovery systems use the verified destination',()=>{
 const personal=dashboard.slice(dashboard.indexOf('aria-labelledby="settings-personal-title"'),dashboard.indexOf('id="settings-community-games"'));
 assert.match(personal,/id="settings-your-checkin"/);assert.match(personal,/>Your Check-In</);
 assert.match(personal,/openSettingsDestination\('checkin'\)/);
 assert.equal((dashboard.match(/sel:'#settings-your-checkin'/g)||[]).length,2);
 assert.match(dashboard,/id:'settings-your-checkin-v1'/);
 assert.match(frontend,/enableSwipeBackNavigation\('weekly-checkin-preview-overlay', closeWeeklyCheckinPreview\)/);
});

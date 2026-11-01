const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
test('Top Levels uses the global top ten without friends or private profile fallbacks',async()=>{
 const source=read('js/dashboard/dashboard-script-6-ai_coach_draft_mode_logic_auth.js');const a=source.indexOf('async function loadFeedLevelLeaderboard('),b=source.indexOf('window.toggleFeedLevelLeaderboard =',a);const nodes={};const rows=Array.from({length:11},(_,i)=>({user_id:'stranger-'+i,name:'Member '+i,profile_photo:'',lifetime_points:1000-i}));
 const window={currentUser:{id:'own'},supabaseClient:{rpc:async name=>{assert.equal(name,'my_balance_level_leaderboard');return {data:rows};}}};
 const ctx={window,document:{getElementById:id=>nodes[id]||(nodes[id]={innerHTML:'',textContent:''})},feedLevelLeaderboardLoading:false,feedLevelLeaderboardLoaded:false,FEED_LEVEL_LEADERBOARD_LIMIT:10,ensureFeedLevelLeaderboardShell(){},addFeedLevelRecord:(map,row)=>map.set(row.user_id,{lifetime_points:row.lifetime_points}),getFeedLevelInfo:points=>({level:Math.floor(points/100)}),getFeedLevelTitleForLevel:()=> 'Level',getFeedLevelInitials:()=> 'M',escapeHtml:s=>s,console};
 vm.runInNewContext(source.slice(a,b),ctx);await ctx.loadFeedLevelLeaderboard();const html=nodes['feed-level-leaderboard-list'].innerHTML;
 assert.equal((html.match(/class="feed-level-person"/g)||[]).length,10);assert.match(html,/Member 0/);assert.doesNotMatch(html,/Member 10/);assert.match(nodes['feed-level-leaderboard-summary'].textContent,/across all Balance members/);assert.doesNotMatch(source.slice(a,b),/getFriends|\.from\('users'\)|email/);
});
test('new games and challenges expose only free entry and the header has no coin widget',()=>{
 const html=read('dashboard.html');assert.doesNotMatch(html,/id="home-coin-header-widget"/);
 const games=read('lib/games.js');assert.match(games,/const BET_OPTIONS = \[0\]/);assert.match(games,/selectedGameBet = 0/);
 const script=read('js/dashboard/dashboard-script-6-ai_coach_draft_mode_logic_auth.js');assert.match(script,/const betAmount = 0/);assert.match(script,/const entryFee = 0/);assert.match(script,/Join challenge for free/);
 const migration=read('supabase/migrations/20261101020000_free_games_global_levels.sql');assert.match(migration,/new.entry_fee:=0/);assert.match(migration,/new.coin_bet:=0/);assert.match(migration,/balance_free_game_entry_guard/);assert.match(migration,/not coalesce\(u.is_test_account,false\)/);
});

test('challenge instructions describe free entry rather than the retired coin charge',()=>{
 const html=read('dashboard.html'),start=html.indexOf('id="create-challenge-modal"'),end=html.indexOf('id="challenge-pass-modal"');
 assert.doesNotMatch(html.slice(start,end),/Pay the <strong/);assert.match(html.slice(start,end),/No coins or payment needed/);
});

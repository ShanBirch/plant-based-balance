// A controlled preview using the app's actual weekly-calendar renderer. This
// creates no user, grants no access and sends no messages.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const plan = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
const output = path.resolve(process.argv[3]);
const timezone = process.argv[4];
if (!Array.isArray(plan.weekly_schedule) || plan.weekly_schedule.length !== 7 || !timezone) throw Error('Verified seven-day plan and confirmed timezone required.');
const source = fs.readFileSync(path.join(root,'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'),'utf8');
const start = source.indexOf('function escapeCalendarHtml(');
const end = source.indexOf('// --- MONTHLY CALENDAR VIEW ---', start);
if (start < 0 || end < 0) throw Error('Calendar renderer changed; review before previewing.');
const renderer = source.slice(start,end);
const dashboard = fs.readFileSync(path.join(root,'dashboard.html'),'utf8');
const styles = [...dashboard.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
const json = value => JSON.stringify(value).replace(/</g,'\\u003c');
const html = `<!doctype html><html data-pbb-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Coaching setup verification</title><style>${styles}</style><style>body{margin:0;font:16px/1.5 system-ui;background:#fffaf0;color:#24211b}main{max-width:540px;margin:auto;padding:max(48px,env(safe-area-inset-top,0px)) 16px max(28px,env(safe-area-inset-bottom,0px));box-sizing:border-box}h1{font-size:24px}#weekly-calendar{display:flex;flex-direction:column;gap:8px}details{margin:12px 0;padding:14px;border:1px solid #b38d49;border-radius:12px}video{width:100%;max-height:320px;background:#111}button{min-height:44px}</style></head><body><main id="view-cycle"><p>Controlled setup verification preview</p><h1 id="program-title"></h1><div id="weekly-calendar"></div><div id="sessions"></div></main><script>
const plan=${json(plan)},timezone=${json(timezone)};
const PHASE_INFO={wellness:{color:'#a47b27',name:'Balanced'}},userCycleData={lastPeriod:null,logs:{},noPeriodMode:true};
window.currentUser={id:'controlled-preview'};window.activeCustomProgramCache={...plan,is_active:true,start_date:new Date().toISOString().slice(0,10)};
window.BalanceFreeStarter={coached:()=>true,access:()=>({setup:{timezone}})};
function isMaleUser(){return true}function customProgramUsesCompletionGating(){return false}function getCustomProgramWorkoutWeekNumber(){return 1}function applyWorkoutDayOrder(s){return s}function attachCalendarDayDrag(){}function getLocalDateString(d=new Date()){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
${renderer}
document.getElementById('program-title').textContent=plan.program_name;renderWeeklyCalendar();
function openCalendarActionModal(day){document.getElementById('session-'+day)?.scrollIntoView({block:'start'})}
plan.weekly_schedule.forEach((entry,index)=>{if(entry.workout.type==='rest')return;const section=document.createElement('section');section.id='session-'+index;const title=document.createElement('h2');title.textContent=entry.day+' · '+entry.time+' · '+entry.workout.name;section.append(title);entry.workout.exercises.forEach(ex=>{const details=document.createElement('details'),summary=document.createElement('summary'),video=document.createElement('video');summary.textContent=ex.name+' · '+ex.sets+' sets × '+ex.reps;video.controls=true;video.preload='none';video.src=new URL(ex.video_url,'https://plantbased-balance.org').href;details.append(summary,video);section.append(details)});document.getElementById('sessions').append(section)});
</script></body></html>`;
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'index.html'),html);
process.stdout.write(path.join(output,'index.html'));

const actions = require('../../../lib/learn-weekly-actions');
const { supabaseQuery } = require('./client-context');
const clean = (value,max=2000) => typeof value === 'string' ? value.trim().slice(0,max) : '';
const unwrap = value => Array.isArray(value) ? value[0] : value;
const error = (message,status=400) => Object.assign(new Error(message),{status});
async function canReview(actor,user) {
  if(actor===user)return false;
  const [admin,coach]=await Promise.all([
    supabaseQuery(`admin_users?select=user_id&user_id=eq.${encodeURIComponent(actor)}&role=eq.super_admin&limit=1`),
    supabaseQuery(`coach_clients?select=id&coach_id=eq.${encodeURIComponent(actor)}&client_id=eq.${encodeURIComponent(user)}&status=eq.active&limit=1`)
  ]);
  return !!(admin.length || coach.length);
}
function courseStart(journey) {
  const date=new Date(journey.week_started_at+'T12:00:00Z');
  date.setUTCDate(date.getUTCDate()-(Number(journey.current_week)-1)*7);
  return date.toISOString().slice(0,10);
}
async function context(actor,user=actor,enrollmentId=null) {
  if(actor!==user && !await canReview(actor,user))throw error('You cannot review this member.',403);
  const rows=await supabaseQuery(`social_journey_progress?select=current_week,week_started_at&user_id=eq.${encodeURIComponent(user)}&limit=1`);
  if(!rows[0])return {available:false,records:[],enrollments:[]};
  const current=unwrap(await supabaseQuery('rpc/ensure_learn_action_enrollment',{method:'POST',body:{p_user_id:user,p_start_date:courseStart(rows[0]),p_restart:false}}));
  const enrollments=await supabaseQuery(`learn_action_enrollments?select=*&user_id=eq.${encodeURIComponent(user)}&order=created_at.desc`);
  const enrollment=enrollmentId ? enrollments.find(e=>e.id===enrollmentId) : current;
  if(!enrollment)throw error('That course enrollment is not available.',404);
  const records=await supabaseQuery(`learn_action_reviews?select=*&enrollment_id=eq.${encodeURIComponent(enrollment.id)}&user_id=eq.${encodeURIComponent(user)}&order=week`);
  return {available:true,enrollment,records,enrollments,current_week:actions.effectiveWeek(rows[0]),can_review:actor!==user};
}
async function write(ctx,actor,week,operation,payload,revision) {
  const record=unwrap(await supabaseQuery('rpc/write_learn_action_review',{method:'POST',body:{p_enrollment:ctx.enrollment.id,p_week:week,p_actor:actor,p_operation:operation,p_payload:payload,p_revision:revision}}));
  if(!record?.id)throw error('The action record could not be confirmed.',500);
  const saved=await supabaseQuery(`learn_action_reviews?select=*&id=eq.${encodeURIComponent(record.id)}&enrollment_id=eq.${encodeURIComponent(ctx.enrollment.id)}&limit=1`);
  if(saved[0]?.revision!==record.revision || saved[0]?.status!==record.status)throw error('The action save could not be verified. Reload before retrying.',409);
  return saved[0];
}
function assertMemberContext(ctx,input) {
  const week=Number(input.week);
  if(!ctx.available || ctx.enrollment.id!==input.enrollment_id || !ctx.enrollment.active)throw error('Your course enrollment changed. Reopen your check-in.',409);
  if(!actions.experiment(week) || week>ctx.current_week)throw error('That action week is not available yet.',409);
  const existing=ctx.records.find(r=>r.week===week);
  if(Number(input.revision)!==Number(existing?.revision||0))throw error('Your action evidence changed. Reopen it before continuing.',409);
  return {week,existing,definition:actions.experiment(week)};
}
async function nutrition(user,weekStart) {
  const [meals,targets]=await Promise.all([
    supabaseQuery(`user_saved_meals?select=id,name,food_items,protein_g,carbs_g,fat_g,calories,created_at&user_id=eq.${encodeURIComponent(user)}&created_at=gte.${encodeURIComponent(weekStart+'T00:00:00+10:00')}&order=created_at.desc&limit=100`),
    supabaseQuery(`daily_nutrition?select=nutrition_date,calorie_goal,protein_goal_g,carbs_goal_g,fat_goal_g&user_id=eq.${encodeURIComponent(user)}&nutrition_date=lte.${new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Brisbane',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}&order=nutrition_date.desc&limit=1`)
  ]);
  return {meals,targets:targets[0]||null};
}
function weekStart(ctx,week) {
  const d=new Date(ctx.enrollment.start_date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+(week-1)*7);return d.toISOString().slice(0,10);
}
async function prepareReport(user,input,weeklyResponse) {
  const ctx=await context(user);
  const {week,existing,definition}=assertMemberContext(ctx,input);
  if(['completed','legacy_completed'].includes(existing?.status))return {ctx,existing,alreadyComplete:true};
  const answers=Object.fromEntries(definition.fields.map(([key])=>[key,clean(input.answers?.[key])]));
  let meal=null,targets=null;
  if(week===6){
    const source=await nutrition(user,weekStart(ctx,6));targets=source.targets;
    if(input.meal_id){meal=source.meals.find(m=>m.id===input.meal_id);if(!meal)throw error('Choose your own meal saved during week six. No food has been logged as eaten.',400);}
  }
  const complete=actions.reportComplete(week,answers,meal) && (week!==6 || ['protein_goal_g','carbs_goal_g','fat_goal_g'].every(k=>Number(targets?.[k])>0));
  return {ctx,week,revision:Number(input.revision),payload:{instructions:definition,complete,report:{answers,meal,targets,weekly_checkin:weeklyResponse,reported_at:new Date().toISOString(),evidence_kind:'member_report'}}};
}
async function saveReport(user,prepared) {
  if(prepared.alreadyComplete)return prepared.existing;
  return write(prepared.ctx,user,prepared.week,'report',prepared.payload,prepared.revision);
}
module.exports={actions,context,write,assertMemberContext,nutrition,weekStart,prepareReport,saveReport,canReview,clean,error};

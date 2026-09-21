// Pull Shane Minahan's first-week tracking data for a coaching review.
// One-off — run with: node scripts/shane_week_review.js

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzapaorxqboevxnumxkv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6YXBhb3J4cWJvZXZ4bnVteGt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODY2MDcxNiwiZXhwIjoyMDg0MjM2NzE2fQ.h8-RNr_2rudikdmsW2_7Euhgy69N4V145p23fSzufTA';

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function section(title) {
  console.log('\n' + '='.repeat(70));
  console.log(title);
  console.log('='.repeat(70));
}

function pretty(rows) {
  if (!rows || rows.length === 0) return '  (none)';
  return rows.map(r => '  ' + JSON.stringify(r)).join('\n');
}

async function findShane() {
  // Try a few name variants
  const { data, error } = await db
    .from('users')
    .select('id, email, name, created_at, program_start_date, sex, location, subscription_status, subscription_plan, onboarding_complete, last_login')
    .ilike('name', '%shane%');
  if (error) { console.error('user lookup error', error); return null; }
  console.log('Candidates matching "shane":');
  for (const u of data) console.log(' -', u.name, '|', u.email, '|', u.id, '| created', u.created_at);
  // Prefer a Minahan
  const minahan = data.find(u => (u.name || '').toLowerCase().includes('minahan'));
  return minahan || data[0] || null;
}

async function safeSelect(table, builder) {
  try {
    const { data, error } = await builder;
    if (error) return { err: `${table}: ${error.message}` };
    return { data: data || [] };
  } catch (e) {
    return { err: `${table}: ${e.message}` };
  }
}

(async () => {
  const user = await findShane();
  if (!user) { console.log('No Shane found.'); process.exit(0); }

  section('USER');
  console.log(user);

  const since = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const sinceDate = since.slice(0, 10);
  console.log('\nLooking back since:', since);

  // ---- Quiz / goals ----
  section('QUIZ RESULTS (latest)');
  const quiz = await safeSelect('quiz_results',
    db.from('quiz_results').select('*').eq('user_id', user.id).order('taken_at', { ascending: false }).limit(1));
  console.log(quiz.err || JSON.stringify(quiz.data[0] || null, null, 2));

  section('USER FACTS (struggles / goals / preferences)');
  const facts = await safeSelect('user_facts',
    db.from('user_facts').select('*').eq('user_id', user.id));
  console.log(facts.err || JSON.stringify(facts.data[0] || null, null, 2));

  // ---- Weigh-ins ----
  section('DAILY WEIGH-INS (last 10 days)');
  const weighs = await safeSelect('daily_weigh_ins',
    db.from('daily_weigh_ins').select('*').eq('user_id', user.id).gte('weigh_in_date', sinceDate).order('weigh_in_date', { ascending: true }));
  console.log(weighs.err || pretty(weighs.data));

  // ---- Meals / nutrition ----
  section('MEAL LOGS (last 10 days)');
  const meals = await safeSelect('meal_logs',
    db.from('meal_logs').select('meal_date, meal_time, meal_type, calories, protein_g, carbs_g, fat_g, food_items').eq('user_id', user.id).gte('meal_date', sinceDate).order('meal_date', { ascending: true }));
  if (meals.err) console.log(meals.err); else {
    const byDay = {};
    for (const m of meals.data) (byDay[m.meal_date] ||= []).push(m);
    for (const d of Object.keys(byDay).sort()) {
      const day = byDay[d];
      const cals = day.reduce((a, b) => a + (Number(b.calories) || 0), 0);
      const p = day.reduce((a, b) => a + (Number(b.protein_g) || 0), 0);
      console.log(`  ${d}  ${day.length} meals  ${Math.round(cals)}kcal  P:${Math.round(p)}g`);
      for (const m of day) {
        const items = Array.isArray(m.food_items) ? m.food_items.map(x => x.name || x).join(', ') : '';
        console.log(`     - ${m.meal_type || '?'} ${m.meal_time || ''}  ${m.calories || 0}kcal  ${items}`);
      }
    }
    if (meals.data.length === 0) console.log('  (none)');
  }

  section('DAILY NUTRITION TOTALS (last 10 days)');
  const nutr = await safeSelect('daily_nutrition',
    db.from('daily_nutrition').select('*').eq('user_id', user.id).gte('nutrition_date', sinceDate).order('nutrition_date', { ascending: true }));
  console.log(nutr.err || pretty(nutr.data));

  // ---- Workouts ----
  section('WORKOUT HISTORY (last 10 days)');
  const workouts = await safeSelect('workouts',
    db.from('workouts').select('workout_date, exercise_name, set_number, reps, weight_kg, time_duration, created_at')
      .eq('user_id', user.id).eq('workout_type', 'history')
      .gte('workout_date', sinceDate).order('workout_date', { ascending: true }));
  if (workouts.err) console.log(workouts.err); else {
    const byDay = {};
    for (const w of workouts.data) (byDay[w.workout_date] ||= []).push(w);
    for (const d of Object.keys(byDay).sort()) {
      const sets = byDay[d];
      const exercises = [...new Set(sets.map(s => s.exercise_name))];
      const volume = sets.reduce((a, s) => {
        const w = parseFloat(s.weight_kg) || 0;
        const r = parseFloat((s.reps || '').toString().split(/[^0-9.]/)[0]) || 0;
        return a + w * r;
      }, 0);
      console.log(`  ${d}  ${sets.length} sets  ${exercises.length} exercises  vol ${Math.round(volume)}kg`);
      console.log('     ', exercises.slice(0, 8).join(', '));
    }
    if (workouts.data.length === 0) console.log('  (none)');
  }

  // ---- Mood ----
  section('MOOD LOGS (last 10 days)');
  const mood = await safeSelect('mood_logs',
    db.from('mood_logs').select('*').eq('user_id', user.id).gte('log_date', sinceDate).order('log_date', { ascending: true }));
  console.log(mood.err || pretty(mood.data));

  // ---- Activity logs (steps / sleep / etc from wearables) ----
  section('ACTIVITY LOGS (last 10 days)');
  const activity = await safeSelect('activity_logs',
    db.from('activity_logs').select('*').eq('user_id', user.id).gte('activity_date', sinceDate).order('activity_date', { ascending: true }));
  console.log(activity.err || pretty(activity.data));

  // ---- Challenges ----
  section('CHALLENGES JOINED');
  const cp = await safeSelect('challenge_participants',
    db.from('challenge_participants').select('status, starting_points, current_points, challenge_points, invited_at, accepted_at, challenges(name, start_date, end_date, status, duration_days)').eq('user_id', user.id));
  console.log(cp.err || pretty(cp.data));

  // ---- Personal bests / milestones ----
  section('PERSONAL BESTS');
  const pbs = await safeSelect('personal_bests',
    db.from('personal_bests').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(20));
  console.log(pbs.err || pretty(pbs.data));

  section('WORKOUT MILESTONES');
  const ms = await safeSelect('workout_milestones',
    db.from('workout_milestones').select('milestone_type, milestone_value, exercise_name, achieved_at').eq('user_id', user.id).order('achieved_at', { ascending: false }).limit(20));
  console.log(ms.err || pretty(ms.data));

  // ---- AI coach conversations ----
  section('AI COACH CHAT COUNT (last 10 days)');
  const chat = await safeSelect('conversations',
    db.from('conversations').select('role, chat_type, timestamp').eq('user_id', user.id).gte('created_at', since));
  if (chat.err) console.log(chat.err); else {
    const userMsgs = chat.data.filter(c => c.role === 'user').length;
    const botMsgs = chat.data.filter(c => c.role === 'bot').length;
    console.log(`  user→ ${userMsgs}   bot→ ${botMsgs}   total ${chat.data.length}`);
  }

  // ---- User activity (logins etc) ----
  section('USER ACTIVITY (last 10 days, any event type)');
  const ua = await safeSelect('user_activity',
    db.from('user_activity').select('activity_type, occurred_at').eq('user_id', user.id).gte('occurred_at', since).order('occurred_at', { ascending: true }).limit(500));
  if (ua.err) console.log(ua.err); else {
    const byType = {};
    const byDay = {};
    for (const e of ua.data) {
      byType[e.activity_type] = (byType[e.activity_type] || 0) + 1;
      const d = (e.occurred_at || '').slice(0, 10);
      byDay[d] = (byDay[d] || 0) + 1;
    }
    console.log(' by type:', byType);
    console.log(' by day :', byDay);
    console.log(' total events:', ua.data.length);
  }

  // ---- Custom programs ----
  section('CUSTOM WORKOUT PROGRAMS');
  const cwp = await safeSelect('custom_workout_programs',
    db.from('custom_workout_programs').select('id, program_name, duration_weeks, is_active, start_date, created_at, weekly_schedule').eq('user_id', user.id));
  if (cwp.err) console.log(cwp.err); else {
    for (const p of cwp.data) {
      console.log(`  ${p.is_active ? '[ACTIVE]' : '        '} ${p.program_name}  (${p.duration_weeks}w, started ${p.start_date || '?'})`);
      if (Array.isArray(p.weekly_schedule)) {
        for (const d of p.weekly_schedule) {
          const w = d.workout || {};
          console.log(`     ${d.day}: ${w.name || '-'}`);
        }
      }
    }
    if (cwp.data.length === 0) console.log('  (none)');
  }

  console.log('\nDONE.');
})();

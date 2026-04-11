#!/usr/bin/env node
/**
 * Admin script: check whether a user has tracked calories on a given date.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/check-calorie-tracking.js "Shane Minahan" [YYYY-MM-DD]
 *
 * If no date is provided, today's local date is used.
 *
 * This script uses the Supabase service_role key, which bypasses Row Level
 * Security. NEVER expose the service_role key in client-side code or commit
 * it to git. Keep it in your local .env (already gitignored) or pass it
 * inline as an environment variable.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars are required.');
  console.error('Get the service_role key from Supabase: Settings -> API -> service_role.');
  process.exit(1);
}

const nameArg = process.argv[2];
const dateArg = process.argv[3];

if (!nameArg) {
  console.error('Usage: node scripts/check-calorie-tracking.js "<full name>" [YYYY-MM-DD]');
  process.exit(1);
}

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const targetDate = dateArg || todayLocal();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

(async () => {
  // 1. Find matching users by name (case-insensitive substring match)
  const { data: users, error: userErr } = await supabase
    .from('users')
    .select('id, name, email')
    .ilike('name', `%${nameArg}%`);

  if (userErr) {
    console.error('Failed to query users:', userErr.message);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log(`No users found matching "${nameArg}".`);
    process.exit(0);
  }

  if (users.length > 1) {
    console.log(`Found ${users.length} users matching "${nameArg}":`);
    users.forEach((u) => console.log(`  - ${u.name} <${u.email}> (${u.id})`));
    console.log('Refine the name to disambiguate.');
  }

  for (const user of users) {
    console.log(`\n=== ${user.name} <${user.email}> ===`);
    console.log(`User ID: ${user.id}`);
    console.log(`Date:    ${targetDate}`);

    // 2. Daily nutrition totals for the date
    const { data: daily, error: dailyErr } = await supabase
      .from('daily_nutrition')
      .select('total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g, meal_count, calorie_goal, updated_at')
      .eq('user_id', user.id)
      .eq('nutrition_date', targetDate)
      .maybeSingle();

    if (dailyErr) {
      console.error('Failed to query daily_nutrition:', dailyErr.message);
      continue;
    }

    // 3. Individual meal logs for the date
    const { data: meals, error: mealErr } = await supabase
      .from('meal_logs')
      .select('id, meal_time, meal_type, calories, protein_g, carbs_g, fat_g, food_items, notes')
      .eq('user_id', user.id)
      .eq('meal_date', targetDate)
      .order('meal_time', { ascending: true });

    if (mealErr) {
      console.error('Failed to query meal_logs:', mealErr.message);
      continue;
    }

    const mealCount = meals ? meals.length : 0;
    const tracked = mealCount > 0 || (daily && Number(daily.total_calories) > 0);

    console.log(`Tracked today: ${tracked ? 'YES' : 'NO'}`);

    if (daily) {
      console.log('Daily totals:');
      console.log(`  Calories: ${daily.total_calories} / ${daily.calorie_goal} goal`);
      console.log(`  Protein:  ${daily.total_protein_g} g`);
      console.log(`  Carbs:    ${daily.total_carbs_g} g`);
      console.log(`  Fat:      ${daily.total_fat_g} g`);
      console.log(`  Fiber:    ${daily.total_fiber_g} g`);
      console.log(`  Meals:    ${daily.meal_count}`);
      console.log(`  Updated:  ${daily.updated_at}`);
    } else {
      console.log('No daily_nutrition row for this date.');
    }

    if (mealCount > 0) {
      console.log(`\nMeal logs (${mealCount}):`);
      meals.forEach((m) => {
        const items = Array.isArray(m.food_items)
          ? m.food_items.map((i) => (typeof i === 'string' ? i : i.name || JSON.stringify(i))).join(', ')
          : '';
        console.log(`  [${m.meal_time}] ${m.meal_type || 'meal'}: ${m.calories ?? '?'} kcal` +
          (items ? ` — ${items}` : '') +
          (m.notes ? ` (${m.notes})` : ''));
      });
    } else {
      console.log('No meal_logs rows for this date.');
    }
  }
})().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});

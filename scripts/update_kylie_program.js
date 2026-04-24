// One-off script: replace Kylie's active custom program with the 4-day,
// knee-friendly schedule the user approved — workouts Mon/Tue/Thu/Fri
// (Upper A / Legs A / Upper B / Legs B), rest Wed/Sat/Sun. No lunges,
// dumbbells + kettlebells + mini bands only (no bench — floor press).
// Clears the transferred-client flag so "Design Your Character" stops
// appearing on each login.
//
// Safe to re-run — uses upsert/update semantics.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzapaorxqboevxnumxkv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6YXBhb3J4cWJvZXZ4bnVteGt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODY2MDcxNiwiZXhwIjoyMDg0MjM2NzE2fQ.h8-RNr_2rudikdmsW2_7Euhgy69N4V145p23fSzufTA';

const TARGET_EMAIL = 'twentyninepearls@gmail.com';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Inline workouts — exercises embedded directly so we don't depend on library rotation.
// No lunges, no bench (floor press variants), dumbbells / kettlebells / mini bands only.

const UPPER_A = {
  type: 'inline',
  name: 'Upper A — Push/Pull Strength',
  duration: '40 min',
  difficulty: 'Intermediate',
  icon: '💪',
  category: 'home_weights',
  exercises: [
    { name: 'Dumbbell Floor Press', sets: 4, reps: '8-10', desc: 'Chest compound — elbows stop at floor' },
    { name: 'Dumbbell Bent Over Row', sets: 4, reps: '8-10', desc: 'Back compound' },
    { name: 'Dumbbell Seated Shoulder Press', sets: 3, reps: '10-12', desc: 'Shoulders' },
    { name: 'Dumbbell Lateral Raise', sets: 3, reps: '12-15', desc: 'Side delts' },
    { name: 'Dumbbell Bicep Curl', sets: 3, reps: '12-15', desc: 'Biceps' },
    { name: 'Dumbbell Overhead Tricep Extension', sets: 3, reps: '12-15', desc: 'Triceps' },
    { name: 'Plank', sets: 3, reps: '45 sec', desc: 'Core hold' },
  ],
};

const LEGS_A = {
  type: 'inline',
  name: 'Legs A — Squat & Glute Med',
  duration: '40 min',
  difficulty: 'Intermediate',
  icon: '🦵',
  category: 'home_weights',
  exercises: [
    { name: 'Dumbbell Goblet Squat', sets: 4, reps: '10-12', desc: 'Squat to chair depth — controlled' },
    { name: 'Kettlebell Romanian Deadlift', sets: 4, reps: '10-12', desc: 'Hip hinge, hamstrings' },
    { name: 'Dumbbell Hip Thrust', sets: 4, reps: '12-15', desc: 'Glute drive (shoulders on couch/step)' },
    { name: 'Mini Band Side Steps (Squat Stance)', sets: 3, reps: '20 each', desc: 'Glute med activation' },
    { name: 'Mini Band Standing Hip Abduction', sets: 3, reps: '15 each', desc: 'Lateral glute' },
    { name: 'Dumbbell Calf Raise', sets: 3, reps: '15-20', desc: 'Calves' },
  ],
};

const UPPER_B = {
  type: 'inline',
  name: 'Upper B — Unilateral Variety',
  duration: '40 min',
  difficulty: 'Intermediate',
  icon: '🏋️',
  category: 'home_weights',
  exercises: [
    { name: 'Dumbbell Single-Arm Floor Press', sets: 4, reps: '10 each', desc: 'Unilateral chest — anti-rotation core' },
    { name: 'Dumbbell Single-Arm Row', sets: 4, reps: '10 each', desc: 'Unilateral back — support on couch/step' },
    { name: 'Dumbbell Arnold Press', sets: 3, reps: '10-12', desc: 'Shoulders with rotation' },
    { name: 'Dumbbell Front Raise', sets: 3, reps: '12', desc: 'Front delts' },
    { name: 'Dumbbell Hammer Curl', sets: 3, reps: '12', desc: 'Biceps + brachialis' },
    { name: 'Dumbbell Tricep Kickback', sets: 3, reps: '12-15', desc: 'Triceps — elbow pinned' },
    { name: 'Side Plank', sets: 3, reps: '30 sec each', desc: 'Lateral core' },
  ],
};

const LEGS_B = {
  type: 'inline',
  name: 'Legs B — Hinge & Unilateral',
  duration: '40 min',
  difficulty: 'Intermediate',
  icon: '🏃‍♀️',
  category: 'home_weights',
  exercises: [
    { name: 'Dumbbell Sumo Squat', sets: 4, reps: '10-12', desc: 'Wide stance — inner thigh + glute' },
    { name: 'Dumbbell Single-Leg Romanian Deadlift', sets: 3, reps: '10 each', desc: 'Unilateral hinge + balance' },
    { name: 'Dumbbell B-Stance Hip Thrust', sets: 3, reps: '12 each', desc: 'Staggered hip thrust (not a lunge)' },
    { name: 'Mini Band Clamshell', sets: 3, reps: '15 each', desc: 'Glute med — side-lying' },
    { name: 'Mini Band Fire Hydrant', sets: 3, reps: '12 each', desc: 'Glute med — quadruped' },
    { name: 'Single-Leg Calf Raise', sets: 3, reps: '12 each', desc: 'Unilateral calf' },
  ],
};

const REST = { name: 'Rest Day', type: 'rest' };

// 4-day split: Mon Upper A, Tue Legs A, Wed Rest, Thu Upper B, Fri Legs B, Sat/Sun Rest.
const NEW_SCHEDULE = [
  { day: 'Mon', workout: UPPER_A },
  { day: 'Tue', workout: LEGS_A },
  { day: 'Wed', workout: REST },
  { day: 'Thu', workout: UPPER_B },
  { day: 'Fri', workout: LEGS_B },
  { day: 'Sat', workout: REST },
  { day: 'Sun', workout: REST },
];

async function findUserByEmail(email) {
  const perPage = 200;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const hit = (data?.users || []).find(u => (u.email || '').toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (!data?.users || data.users.length < perPage) return null;
  }
  return null;
}

async function main() {
  console.log(`\nUpdating Kylie's program (${TARGET_EMAIL})\n`);

  const user = await findUserByEmail(TARGET_EMAIL);
  if (!user) throw new Error(`No auth user for ${TARGET_EMAIL}`);
  console.log('User id:', user.id);

  // 1. Clear transferred-client flag so "Design Your Character" stops popping.
  {
    const { error } = await supabase
      .from('users')
      .update({ is_transferred_client: false })
      .eq('id', user.id);
    if (error) throw error;
    console.log('✅ is_transferred_client=false');
  }

  // 2. Deactivate any existing custom programs — we're replacing with a single
  //    active one so the Cycle calendar + Movement hero aren't ambiguous.
  {
    const { error } = await supabase
      .from('custom_workout_programs')
      .update({ is_active: false, start_date: null })
      .eq('user_id', user.id);
    if (error) throw error;
    console.log('✅ existing programs deactivated');
  }

  // 3. Insert the new 4-day program as the active one starting today.
  const today = new Date().toISOString().slice(0, 10);
  {
    const { data, error } = await supabase
      .from('custom_workout_programs')
      .insert({
        user_id: user.id,
        program_name: 'Knee-Friendly Strength (4-day)',
        duration_weeks: 12,
        weekly_schedule: NEW_SCHEDULE,
        is_active: true,
        start_date: today,
      })
      .select()
      .single();
    if (error) throw error;
    console.log('✅ new active program inserted:', data.id);
  }

  console.log('\nDone. Have Kylie hard-refresh to pick up the new program.\n');
}

main().catch(err => {
  console.error('\n❌ Update failed:', err);
  process.exit(1);
});

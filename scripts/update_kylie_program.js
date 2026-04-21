// One-off script: replace Kylie's active custom program with the 4-day,
// knee-friendly schedule the user approved (Upper / Legs / Yoga / Full Body)
// and clear the transferred-client flag so the "Design Your Character"
// popup stops appearing on each login.
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
const UPPER = {
  type: 'inline',
  name: 'Upper Body Strength',
  duration: '40 min',
  difficulty: 'Intermediate',
  icon: '💪',
  category: 'home_weights',
  exercises: [
    { name: 'Dumbbell Flat Bench Press', sets: 4, reps: '8-10', desc: 'Chest compound' },
    { name: 'Dumbbell Bent Over Row', sets: 4, reps: '8-10', desc: 'Back compound' },
    { name: 'Dumbbell Seated Shoulder Press', sets: 3, reps: '10-12', desc: 'Shoulders' },
    { name: 'Dumbbell Lateral Raise', sets: 3, reps: '12-15', desc: 'Side delts' },
    { name: 'Dumbbell Bicep Curl', sets: 3, reps: '12-15', desc: 'Biceps' },
    { name: 'Dumbbell Overhead Tricep Extension', sets: 3, reps: '12-15', desc: 'Triceps' },
    { name: 'Plank', sets: 3, reps: '45 sec', desc: 'Core hold' },
  ],
};

const LEGS = {
  type: 'inline',
  name: 'Knee-Friendly Leg Day',
  duration: '40 min',
  difficulty: 'Intermediate',
  icon: '🦵',
  category: 'home_weights',
  exercises: [
    { name: 'Dumbbell Goblet Squat', sets: 4, reps: '10-12', desc: 'Squat to chair depth — controlled' },
    { name: 'Kettlebell Romanian Deadlift', sets: 4, reps: '10-12', desc: 'Hip hinge, hamstrings' },
    { name: 'Dumbbell Hip Thrust', sets: 4, reps: '12-15', desc: 'Glute drive' },
    { name: 'Mini Band Side Steps (Squat Stance)', sets: 3, reps: '20 each', desc: 'Glute med activation' },
    { name: 'Mini Band Standing Hip Abduction', sets: 3, reps: '15 each', desc: 'Lateral glute' },
    { name: 'Dumbbell Calf Raise', sets: 3, reps: '15-20', desc: 'Calves' },
  ],
};

const YOGA = {
  type: 'inline',
  name: 'Restorative Yoga',
  duration: '30 min',
  difficulty: 'All Levels',
  icon: '🧘',
  category: 'yoga',
  exercises: [
    { name: 'Yoga - Cat Cow', sets: 1, reps: '2 min', desc: 'Spinal mobility' },
    { name: "Yoga - Child's Pose", sets: 1, reps: '1 min', desc: 'Hip release' },
    { name: 'Yoga - Supine Twist', sets: 1, reps: '1 min each', desc: 'Spinal twist' },
    { name: 'Yoga - Pigeon Pose', sets: 1, reps: '1 min each', desc: 'Hip opener' },
    { name: 'Yoga - Reclined Butterfly', sets: 1, reps: '2 min', desc: 'Inner thigh release' },
    { name: 'Yoga - Supported Bridge', sets: 3, reps: '30 sec', desc: 'Gentle back extension' },
    { name: 'Yoga - Happy Baby', sets: 1, reps: '1 min', desc: 'Lower back release' },
    { name: 'Yoga - Legs Up the Wall', sets: 1, reps: '3 min', desc: 'Circulation reset' },
    { name: 'Yoga - Savasana', sets: 1, reps: '3 min', desc: 'Final rest' },
  ],
};

const FULLBODY = {
  type: 'inline',
  name: 'Full Body',
  duration: '45 min',
  difficulty: 'Intermediate',
  icon: '🏋️',
  category: 'home_weights',
  exercises: [
    { name: 'Dumbbell Goblet Squat', sets: 3, reps: '10-12', desc: 'Legs compound' },
    { name: 'Kettlebell Romanian Deadlift', sets: 3, reps: '10-12', desc: 'Hip hinge' },
    { name: 'Dumbbell Flat Bench Press', sets: 3, reps: '10-12', desc: 'Chest' },
    { name: 'Dumbbell Bent Over Row', sets: 3, reps: '10-12', desc: 'Back' },
    { name: 'Dumbbell Seated Shoulder Press', sets: 3, reps: '10-12', desc: 'Shoulders' },
    { name: 'Dumbbell Hip Thrust', sets: 3, reps: '12-15', desc: 'Glutes' },
    { name: 'Plank', sets: 3, reps: '45 sec', desc: 'Core hold' },
  ],
};

const REST = { name: 'Rest Day', type: 'rest' };

// 4-day split: Mon Upper, Tue Legs, Wed Yoga, Thu Full Body, Fri-Sun Rest.
const NEW_SCHEDULE = [
  { day: 'Mon', workout: UPPER },
  { day: 'Tue', workout: LEGS },
  { day: 'Wed', workout: YOGA },
  { day: 'Thu', workout: FULLBODY },
  { day: 'Fri', workout: REST },
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

// Transfer a client from Trainerize -> Balance with minimal onboarding.
//
// WHAT THIS DOES:
//   1. Runs the is_transferred_client migration (idempotent, safe to re-run).
//   2. Creates (or resets) her auth user with a generated password. Email is
//      pre-confirmed so she doesn't need to click any verification link —
//      she just opens the app, types her email + password, and she's in.
//   3. Pre-fills public.users (name, sex, location, onboarding_complete=true,
//      is_transferred_client=true so the dashboard runs the trimmed flow).
//   4. Pre-fills public.quiz_results with everything we know from Trainerize.
//      We deliberately skip weight / goal_weight — the weigh-in card will
//      collect those on her first session and nutrition goals will recompute
//      from that point.
//   5. Pre-fills public.user_facts personal_details (DOB, phone, units).
//   6. Creates 3 six-week home-dumbbell programs in custom_workout_programs
//      and activates the first one (Strength & Stability).
//   7. Prints a ready-to-copy welcome message with App Store + Play Store
//      links and her login credentials.
//
// AFTER THE CLIENT LOGS IN:
//   dashboard-script-5's checkAndTriggerOnboarding sees is_transferred_client
//   and calls startTransferredClientFlow() instead of the full wizard. That
//   opens slide 17 (design your Fitgotchi), wires the Save button to clear
//   the transferred flag, and fires the guided feature tour.
//
// USAGE:
//   node scripts/transfer_kylie.js
//
// The client's existing program from Trainerize (screenshots: Stability
// Lower, Upper Body, Mobility/Recovery, Upper Body 2, superset day) is the
// model for Program 1. Programs 2 and 3 are fresh takes on the same split
// so she has variety when the 6 weeks are up.

const { createClient } = require('@supabase/supabase-js');

// ---- Config -----------------------------------------------------------------

const SUPABASE_URL = 'https://hzapaorxqboevxnumxkv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6YXBhb3J4cWJvZXZ4bnVteGt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODY2MDcxNiwiZXhwIjoyMDg0MjM2NzE2fQ.h8-RNr_2rudikdmsW2_7Euhgy69N4V145p23fSzufTA';

// App Store + Play Store URLs that go in the welcome message.
const IOS_STORE_URL = 'https://apps.apple.com/app/balance-fitness-gamified/id6761238161';
const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.fitgotchi.app';

// Password policy: memorable but unique so multiple transfers don't collide.
// Kylie can change this in-app under Settings after she logs in.
function generatePassword(firstName) {
  const suffix = Math.floor(1000 + Math.random() * 9000); // 4 random digits
  const safeName = (firstName || 'balance').toLowerCase().replace(/[^a-z]/g, '');
  return `${safeName}-balance-${suffix}`;
}

// ---- Client details from Trainerize ----------------------------------------

const CLIENT = {
  email: 'twentyninepearls@gmail.com',
  firstName: 'Kylie',
  lastName: 'Pinder',
  phone: '+61413151494',
  sex: 'female',
  age: 38,
  dateOfBirth: '1987-08-29',
  heightCm: 175,
  activityLevel: 'very', // maps to quiz_results.activity_level
  dietaryPreference: 'omnivore',
  goalBodyType: 'Athletic',
  equipmentAccess: 'dumbbells', // home dumbbells + bands + foam roller + mat + kettlebell
  location: 'Cocos Connected',
  timezone: 'Australia/Sydney',
};

// ---- Program definitions (three 6-week home dumbbell programs) -------------
// Schedule shape matches what dashboard-script-5 / program_builder_state emits:
//   { day, workout: { type, name, category, subcategory, icon } }
// 'type' is the WORKOUT_LIBRARY category key; subcategory selects the subtree.
// Rest days use { type: 'rest', name: 'Rest Day' }.

function libWorkout(subcategory, name, icon) {
  return {
    type: 'home_weights',
    name,
    category: 'home_weights',
    subcategory,
    icon: icon || '🏋️',
  };
}

function recoveryWorkout(subcategory, name, icon) {
  return {
    type: 'recovery',
    name,
    category: 'recovery',
    subcategory,
    icon: icon || '🧘',
  };
}

function rest() {
  return { type: 'rest', name: 'Rest Day' };
}

const PROGRAMS = [
  {
    name: 'Home Strength & Stability (6wk)',
    durationWeeks: 6,
    activateOnImport: true,
    weeklySchedule: [
      { day: 'Mon', workout: libWorkout('lower', 'Lower Strength', '🦵') },
      { day: 'Tue', workout: libWorkout('upper', 'Upper Strength', '💪') },
      { day: 'Wed', workout: recoveryWorkout('foam_rolling', 'Foam Roll & Release', '🎯') },
      { day: 'Thu', workout: libWorkout('lower', 'Lower Unilateral', '🦵') },
      { day: 'Fri', workout: libWorkout('upper', 'Upper Variety', '💪') },
      { day: 'Sat', workout: rest() },
      { day: 'Sun', workout: rest() },
    ],
  },
  {
    name: 'Home Dumbbell Athletic Build (6wk)',
    durationWeeks: 6,
    activateOnImport: false,
    weeklySchedule: [
      { day: 'Mon', workout: libWorkout('lower', 'Lower Athletic', '⚡') },
      { day: 'Tue', workout: libWorkout('upper', 'Upper Athletic', '⚡') },
      { day: 'Wed', workout: recoveryWorkout('active_recovery', 'Active Recovery', '🌀') },
      { day: 'Thu', workout: libWorkout('lower', 'Lower Power', '🦵') },
      { day: 'Fri', workout: libWorkout('upper', 'Upper Power', '💪') },
      { day: 'Sat', workout: rest() },
      { day: 'Sun', workout: rest() },
    ],
  },
  {
    name: 'Home Dumbbell Hypertrophy (6wk)',
    durationWeeks: 6,
    activateOnImport: false,
    weeklySchedule: [
      { day: 'Mon', workout: libWorkout('lower', 'Leg Volume', '🏋️') },
      { day: 'Tue', workout: libWorkout('upper', 'Push/Pull Volume', '🏋️') },
      { day: 'Wed', workout: recoveryWorkout('stretch', 'Stretch & Mobility', '🤸') },
      { day: 'Thu', workout: libWorkout('lower', 'Leg Variety', '🦵') },
      { day: 'Fri', workout: libWorkout('upper', 'Upper Variety', '💪') },
      { day: 'Sat', workout: rest() },
      { day: 'Sun', workout: rest() },
    ],
  },
];

// ---- Script -----------------------------------------------------------------

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureMigration() {
  const sql = `
    ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS is_transferred_client BOOLEAN DEFAULT FALSE;
  `;
  const { error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    // exec_sql might not be installed yet — fall back to a probing query and
    // tell the operator what to do.
    console.warn('⚠️  exec_sql RPC failed:', error.message);
    console.warn('    Please run database/transferred_client_migration.sql in the Supabase SQL editor first.');
  } else {
    console.log('✅ is_transferred_client column ensured');
  }
}

async function createOrResetUser(password) {
  // Happy path: create a brand-new user with a pre-confirmed email and the
  // generated password. email_confirm=true means she does NOT need to click
  // a confirmation link — she can log in immediately.
  const fullName = `${CLIENT.firstName} ${CLIENT.lastName}`.trim();
  const metadata = {
    name: fullName,
    full_name: fullName,
    phone: CLIENT.phone,
    imported_from: 'trainerize',
    imported_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.auth.admin.createUser({
    email: CLIENT.email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (!error && data?.user) {
    console.log(`✅ Created ${CLIENT.email} with pre-set password`);
    return data.user;
  }

  // Fallback: user already exists (e.g. from a prior run of this script).
  // Reset their password via updateUserById so the printed credentials at
  // the end of the run are guaranteed to work.
  console.log(`ℹ️  createUser failed (${error?.message}); looking up existing user to reset password`);
  const existing = await findUserByEmail(CLIENT.email);
  if (!existing) {
    throw new Error(`Could not create or find user ${CLIENT.email}: ${error?.message}`);
  }

  const { error: updErr } = await supabase.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (updErr) {
    throw new Error(`Password reset failed for ${CLIENT.email}: ${updErr.message}`);
  }
  console.log(`✅ Reset password for existing user ${existing.id}`);
  return existing;
}

async function findUserByEmail(email) {
  // auth.admin.listUsers paginates; iterate until we find the email.
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

async function prefillUsersRow(userId) {
  const fullName = `${CLIENT.firstName} ${CLIENT.lastName}`.trim();
  const { error } = await supabase
    .from('users')
    .update({
      name: fullName,
      sex: CLIENT.sex,
      location: CLIENT.location,
      onboarding_complete: true,
      is_transferred_client: true,
    })
    .eq('id', userId);

  if (error) throw error;
  console.log('✅ users row prefilled');
}

async function prefillQuizResults(userId) {
  // We deliberately skip weight / goal_weight / bmr / tdee / calorie_goal /
  // macros. The app will prompt for a weigh-in on her first session and
  // recompute goals from there.
  const quizRow = {
    user_id: userId,
    age: CLIENT.age,
    height: CLIENT.heightCm,
    sex: CLIENT.sex,
    activity_level: CLIENT.activityLevel,
    goal_body_type: CLIENT.goalBodyType,
    dietary_preference: CLIENT.dietaryPreference,
    equipment_access: CLIENT.equipmentAccess,
    // Leave hormone / cycle fields null — she can fill them in later if she
    // enables cycle sync.
  };

  // Upsert style: if a prior row exists from an earlier run, replace it.
  const { data: existing } = await supabase
    .from('quiz_results')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from('quiz_results')
      .update(quizRow)
      .eq('id', existing.id);
    if (error) throw error;
    console.log('✅ quiz_results updated');
  } else {
    const { error } = await supabase.from('quiz_results').insert(quizRow);
    if (error) throw error;
    console.log('✅ quiz_results inserted');
  }
}

async function prefillUserFacts(userId) {
  const personalDetails = [
    `Date of birth: ${CLIENT.dateOfBirth}`,
    `Phone: ${CLIENT.phone}`,
    `Timezone: ${CLIENT.timezone}`,
    `Units: metric (kg, km, cm)`,
    `Transferred from Trainerize on ${new Date().toISOString().slice(0, 10)}`,
  ];

  const { error } = await supabase
    .from('user_facts')
    .upsert(
      {
        user_id: userId,
        personal_details: personalDetails,
      },
      { onConflict: 'user_id' }
    );

  if (error) throw error;
  console.log('✅ user_facts prefilled');
}

async function insertPrograms(userId) {
  // Clear any pre-existing programs from a previous script run so we don't
  // pile up duplicates.
  const { error: delErr } = await supabase
    .from('custom_workout_programs')
    .delete()
    .eq('user_id', userId);
  if (delErr) console.warn('Could not clear old programs:', delErr.message);

  const today = new Date().toISOString().slice(0, 10);

  for (const p of PROGRAMS) {
    const { data, error } = await supabase
      .from('custom_workout_programs')
      .insert({
        user_id: userId,
        program_name: p.name,
        duration_weeks: p.durationWeeks,
        weekly_schedule: p.weeklySchedule,
        is_active: !!p.activateOnImport,
        start_date: p.activateOnImport ? today : null,
      })
      .select()
      .single();

    if (error) throw error;
    console.log(`   ${p.activateOnImport ? '▶️ ' : '   '} ${p.name} (${data.id})`);
  }
  console.log('✅ 3 programs inserted; first one active');
}

function printWelcomeMessage(password) {
  const firstName = CLIENT.firstName;
  const line = '━'.repeat(60);
  console.log(`\n${line}`);
  console.log('📲  COPY + PASTE THIS INTO A TEXT / EMAIL TO HER');
  console.log(`${line}\n`);
  console.log(`Hey ${firstName}! 🌱 I've moved you over to Balance — the new`);
  console.log(`Plant Based Balance app. Your workouts, profile and 6-week`);
  console.log(`program are already waiting for you inside. Just download,`);
  console.log(`log in, pick your character, and you're off.`);
  console.log('');
  console.log(`📱 iPhone:  ${IOS_STORE_URL}`);
  console.log(`🤖 Android: ${ANDROID_STORE_URL}`);
  console.log('');
  console.log(`Login: ${CLIENT.email}`);
  console.log(`Password: ${password}`);
  console.log('');
  console.log(`(You can change the password in Settings once you're in.)`);
  console.log(`\n${line}\n`);
}

async function main() {
  console.log(`\nTransferring ${CLIENT.firstName} ${CLIENT.lastName} (${CLIENT.email})\n`);

  const password = process.env.BALANCE_TRANSFER_PASSWORD || generatePassword(CLIENT.firstName);

  await ensureMigration();
  const authUser = await createOrResetUser(password);
  await prefillUsersRow(authUser.id);
  await prefillQuizResults(authUser.id);
  await prefillUserFacts(authUser.id);
  await insertPrograms(authUser.id);

  console.log('\n🎉 Supabase work done.');
  console.log(`   Auth user ID: ${authUser.id}`);
  printWelcomeMessage(password);
}

main().catch(err => {
  console.error('\n❌ Transfer failed:', err);
  process.exit(1);
});

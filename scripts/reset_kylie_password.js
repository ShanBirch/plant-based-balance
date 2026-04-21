// Reset Kylie's Supabase auth password to a known value.
//
// Supabase stores passwords hashed, so we can't recover the original — we
// just set a new one via the admin API and make sure her email is confirmed
// so she can log in immediately.
//
// USAGE:
//   node scripts/reset_kylie_password.js
//
//   # Or to use a different password:
//   BALANCE_RESET_PASSWORD='some-new-password' node scripts/reset_kylie_password.js

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzapaorxqboevxnumxkv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6YXBhb3J4cWJvZXZ4bnVteGt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODY2MDcxNiwiZXhwIjoyMDg0MjM2NzE2fQ.h8-RNr_2rudikdmsW2_7Euhgy69N4V145p23fSzufTA';

const TARGET_EMAIL = 'twentyninepearls@gmail.com';
const DEFAULT_PASSWORD = 'kylie-balance-4829';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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
  const password = process.env.BALANCE_RESET_PASSWORD || DEFAULT_PASSWORD;
  console.log(`\nResetting password for ${TARGET_EMAIL}\n`);

  let user = await findUserByEmail(TARGET_EMAIL);

  if (!user) {
    // Supabase returns the same "Invalid login credentials" for both a wrong
    // password AND a non-existent account, so if we got here the user simply
    // hasn't been created yet. Create a pre-confirmed account so she can log
    // in immediately with the password below.
    console.log(`No existing user for ${TARGET_EMAIL} — creating one`);
    const { data, error } = await supabase.auth.admin.createUser({
      email: TARGET_EMAIL,
      password,
      email_confirm: true,
    });
    if (error || !data?.user) {
      throw new Error(`Create user failed: ${error?.message || 'no user returned'}`);
    }
    user = data.user;
    console.log(`Created auth user: ${user.id}`);
  } else {
    console.log(`Found auth user: ${user.id}`);
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    });
    if (error) {
      throw new Error(`Password reset failed: ${error.message}`);
    }
  }

  const line = '━'.repeat(60);
  console.log(`\n${line}`);
  console.log('✅ Password reset successful');
  console.log(`${line}`);
  console.log(`Login:    ${TARGET_EMAIL}`);
  console.log(`Password: ${password}`);
  console.log(`${line}\n`);
}

main().catch(err => {
  console.error('\n❌ Reset failed:', err);
  process.exit(1);
});

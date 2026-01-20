# Fix Gender Reset Bug - Database Migration

## Problem

Users reported that their gender setting resets to female every time they refresh the page, even after setting it to male during onboarding. This causes incorrect BMR/TDEE calculations and forces users to retake the onboarding quiz.

## Root Cause

The `sex` field was only being stored in the `quiz_results` table, but not in the `users` table. When the profile is loaded on page refresh, it only fetches data from `users` and `user_facts` tables, missing the `sex` field. This causes nutrition calculations to default to 'female'.

## Solution

This migration adds a `sex` column to the `users` table and backfills existing user data from `quiz_results`.

## Prerequisites

- Supabase account with access to SQL Editor
- Existing Plant Based Balance database

## Migration Steps

### 1. Log in to Supabase Dashboard

- Go to https://app.supabase.com
- Select your Plant Based Balance project

### 2. Open SQL Editor

- Navigate to the SQL Editor in the left sidebar
- Click "New query"

### 3. Run Migration Script

- Copy the contents of `database/add_sex_column_to_users.sql`
- Paste into the SQL Editor
- Click "Run" or press Ctrl+Enter

### 4. Verify Migration

Run this query to confirm the column was created:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name = 'sex';
```

Expected output:
- column_name: sex
- data_type: text
- is_nullable: YES

### 5. Verify Data Backfill

Check that existing users have their sex field populated:

```sql
-- Count users with sex field populated
SELECT
  COUNT(*) as total_users,
  COUNT(sex) as users_with_sex,
  COUNT(*) - COUNT(sex) as users_without_sex
FROM public.users;
```

### 6. Deploy Code Changes

After running the migration, deploy the updated frontend code:
- `dashboard.html` (lines 9069-9074, 9182-9189)
- `database/schema.sql` (line 26)

The code changes ensure that:
1. New quiz completions save `sex` to both `quiz_results` AND `users` tables
2. Profile loading restores `sex` field from database to sessionStorage
3. Nutrition calculations always have access to the correct gender

## Testing the Fix

### For Existing Users (Already Completed Quiz)

1. Log in as a user who previously set their gender to male
2. Refresh the page
3. Check the browser console - you should see:
   - "Restored sex from DB to sessionStorage: male"
4. Verify that:
   - Gender-specific UI remains correct
   - BMR/TDEE calculations use male formula (s = +5)
   - No prompt to retake onboarding

### For New Users

1. Create a new account
2. Complete the onboarding quiz and select "Male"
3. Refresh the page immediately after completing
4. Verify that:
   - Gender remains "Male"
   - No need to retake onboarding
   - BMR uses correct male formula

### Manual Testing Query

You can manually verify a specific user's sex field:

```sql
-- Replace with actual user email
SELECT
  u.email,
  u.sex as sex_in_users_table,
  qr.sex as sex_in_quiz_results
FROM public.users u
LEFT JOIN public.quiz_results qr ON u.id = qr.user_id
WHERE u.email = 'shannonburch@gmail.com'
ORDER BY qr.created_at DESC
LIMIT 1;
```

Both `sex_in_users_table` and `sex_in_quiz_results` should match.

## Rollback (If Needed)

If you need to rollback this migration:

```sql
-- Remove the sex column from users table
ALTER TABLE public.users DROP COLUMN IF EXISTS sex;

-- Drop the index
DROP INDEX IF EXISTS idx_users_sex;
```

Note: This will require reverting the code changes as well.

## Technical Details

### Files Changed

1. **database/add_sex_column_to_users.sql** (NEW)
   - Adds `sex` column to users table
   - Backfills data from quiz_results
   - Creates index for performance

2. **database/schema.sql** (line 26)
   - Adds `sex TEXT` column definition for new installations

3. **dashboard.html** (lines 9069-9074)
   - Saves `sex` to users table on quiz completion

4. **dashboard.html** (lines 9182-9189)
   - Restores `sex` from database to sessionStorage on page load

### BMR Calculation

The Mifflin-St Jeor Equation uses different constants for males and females:

```javascript
// Male: BMR = (10 × weight) + (6.25 × height) - (5 × age) + 5
// Female: BMR = (10 × weight) + (6.25 × height) - (5 × age) - 161
```

The difference of 166 kcal/day significantly impacts calorie goals and weight management.

## Troubleshooting

### Issue: "Column 'sex' already exists"

The migration is idempotent and checks if the column exists before adding it. This is safe to ignore.

### Issue: Users still see female settings after migration

1. Clear browser localStorage and sessionStorage:
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   ```
2. Log out and log back in
3. Check that the database migration ran successfully

### Issue: New quiz completions not saving sex

1. Check browser console for errors
2. Verify `dbHelpers.users.update` has correct permissions
3. Ensure RLS policies allow users to update their own sex field

## Support

For issues or questions:
- Check the browser console for errors
- Verify the migration ran successfully in Supabase
- Test with the manual queries above
- Check that code changes are deployed

## Migration Checklist

- [ ] Logged into Supabase dashboard
- [ ] Opened SQL Editor
- [ ] Ran migration script (`add_sex_column_to_users.sql`)
- [ ] Verified column creation
- [ ] Verified data backfill
- [ ] Deployed code changes
- [ ] Tested with existing male user
- [ ] Tested with new user signup
- [ ] Verified BMR calculations are correct
- [ ] Cleared affected users' cache (if needed)

---

**Migration Date:** 2026-01-20
**Bug Report:** Gender resets to female on page refresh
**Affected User:** shannonburch@gmail.com (and potentially others)
**Priority:** HIGH - Affects user experience and nutrition calculations

# Database Migration Instructions

## Workout Progress Tracking Migration

This migration adds support for workout milestones and progress tracking.

### Prerequisites

- Supabase account with access to SQL Editor
- Existing Plant Based Balance database with workouts table

### Migration Steps

1. **Log in to Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your Plant Based Balance project

2. **Open SQL Editor**
   - Navigate to the SQL Editor in the left sidebar
   - Click "New query"

3. **Run Migration Script**
   - Copy the contents of `database/add_milestones_table.sql`
   - Paste into the SQL Editor
   - Click "Run" or press Ctrl+Enter

4. **Verify Migration**

   Run this query to confirm the table was created:
   ```sql
   SELECT table_name, column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'workout_milestones'
   ORDER BY ordinal_position;
   ```

   Expected output should show columns:
   - id (uuid)
   - user_id (uuid)
   - milestone_type (text)
   - milestone_value (integer)
   - exercise_name (text)
   - achievement_data (jsonb)
   - achieved_at (timestamp with time zone)
   - created_at (timestamp with time zone)

5. **Verify RLS Policies**
   ```sql
   SELECT policyname, permissive, roles, cmd, qual
   FROM pg_policies
   WHERE tablename = 'workout_milestones';
   ```

   Expected policies:
   - Users can view own milestones (SELECT)
   - Users can insert own milestones (INSERT)
   - Admins can view all milestones (SELECT)

### Testing the Migration

After running the migration, test the functionality:

1. **Test Milestone Creation:**
   ```sql
   -- Insert a test milestone (replace YOUR_USER_ID with actual user ID)
   INSERT INTO workout_milestones (user_id, milestone_type, milestone_value, achievement_data)
   VALUES (
     'YOUR_USER_ID',
     'workout_count',
     1,
     '{"total_workouts": 1}'::jsonb
   );
   ```

2. **Query Milestones:**
   ```sql
   -- View your milestones
   SELECT * FROM workout_milestones
   WHERE user_id = auth.uid()
   ORDER BY achieved_at DESC;
   ```

3. **Test Helper Functions:**
   ```sql
   -- Get workout count for current user
   SELECT get_user_workout_count(auth.uid());

   -- Check if milestone exists
   SELECT milestone_already_achieved(auth.uid(), 'workout_count', 1);
   ```

### Rollback (If Needed)

If you need to rollback this migration:

```sql
-- Drop the table and related objects
DROP TABLE IF EXISTS workout_milestones CASCADE;
DROP FUNCTION IF EXISTS get_user_workout_count(UUID);
DROP FUNCTION IF EXISTS milestone_already_achieved(UUID, TEXT, INTEGER);
```

### Next Steps

1. Deploy the updated frontend code
2. Complete a workout to test milestone detection
3. Verify milestones appear on the success screen
4. Check that improvements are calculated correctly

### Troubleshooting

**Error: "relation 'workout_milestones' does not exist"**
- The migration hasn't been run yet or failed
- Re-run the migration script

**Error: "permission denied for table workout_milestones"**
- RLS policies may not have been created
- Verify policies with the query above
- Re-run the RLS policy section of the migration

**Milestones not appearing in app:**
- Clear browser cache and reload
- Check browser console for JavaScript errors
- Verify the migration was successful
- Ensure user is authenticated

**Performance issues:**
- Verify indexes were created:
  ```sql
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE tablename = 'workout_milestones';
  ```
- Should see index: `idx_milestones_user_type`

### Support

For issues or questions:
- Check the browser console for errors
- Review the `WORKOUT_PROGRESS_TRACKING.md` documentation
- Verify all migration steps were completed

### Migration Checklist

- [ ] Logged into Supabase dashboard
- [ ] Opened SQL Editor
- [ ] Ran migration script (`add_milestones_table.sql`)
- [ ] Verified table creation
- [ ] Verified RLS policies
- [ ] Tested helper functions
- [ ] Cleared browser cache
- [ ] Tested complete workout flow
- [ ] Confirmed milestone appears on success screen
- [ ] Verified improvements are calculated

---

**Migration Date:** 2026-01-19
**Migration Version:** 1.0
**Database:** Plant Based Balance (Supabase PostgreSQL)

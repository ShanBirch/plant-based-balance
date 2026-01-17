# Database Schema

This directory contains the database schema for PlantBasedBalance.

## Files

- **schema.sql** - Complete PostgreSQL database schema for Supabase

## What's Included

The schema creates:

### Tables
- `users` - User profiles and authentication
- `user_facts` - User preferences, struggles, goals, health notes
- `quiz_results` - Hormone quiz results
- `conversations` - Shannon and community chat messages
- `workouts` - Workout history and custom templates
- `daily_checkins` - Daily energy, sleep, water tracking
- `reflections` - Journal entries and Saturday stories
- `uploads` - File storage metadata
- `chat_stats` - Shannon chat statistics
- `user_activity` - Activity logging for analytics
- `admin_users` - Admin role management

### Features
- ✅ Row Level Security (RLS) policies - users can only access their own data
- ✅ Automatic timestamps (created_at, updated_at)
- ✅ Indexes for fast queries
- ✅ Triggers for auto-updating timestamps
- ✅ Admin access controls
- ✅ Referential integrity (foreign keys)

## How to Use

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor in your Supabase dashboard
3. Copy and paste the contents of `schema.sql`
4. Run the query
5. All tables, policies, and triggers will be created!

## Documentation

- See `/DATABASE_SETUP.md` for full setup instructions
- See `/DATABASE_API_REFERENCE.md` for API documentation
- See `/MIGRATION_EXAMPLES.md` for code examples

## Support

If you encounter issues:
- Check Supabase logs (Dashboard → Logs)
- Verify RLS policies are enabled (Dashboard → Authentication → Policies)
- Review the setup guide in DATABASE_SETUP.md

---

**Database Version:** 1.0
**Last Updated:** 2024-01-17

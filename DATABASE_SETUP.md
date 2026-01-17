# Database Backend Setup Guide

This guide will walk you through setting up the Supabase backend database for PlantBasedBalance.

## 🎯 What You're Getting

Your app will now have:
- ✅ **Real Authentication** - Users can sign up and log in
- ✅ **Cloud Database** - All data stored in PostgreSQL (not just localStorage)
- ✅ **Multi-Device Access** - Users can access their data from any device
- ✅ **Admin Dashboard** - View all users, conversations, and analytics
- ✅ **Automatic Data Migration** - Existing localStorage data moves to database on first login
- ✅ **Data Persistence** - User data never gets lost
- ✅ **Row Level Security** - Users can only access their own data

---

## 📋 Prerequisites

- A Supabase account (free tier works great!) - Sign up at [supabase.com](https://supabase.com)
- Your PlantBasedBalance code repository

---

## 🚀 Step-by-Step Setup

### Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and log in
2. Click **"New Project"**
3. Fill in:
   - **Project Name**: PlantBasedBalance
   - **Database Password**: Choose a strong password (save it somewhere!)
   - **Region**: Select the region closest to your users (e.g., Australia/Sydney)
4. Click **"Create new project"**
5. Wait ~2 minutes for your project to be created

### Step 2: Run the Database Schema

1. In your Supabase dashboard, click on the **"SQL Editor"** tab (left sidebar)
2. Click **"New Query"**
3. Copy the entire contents of `/database/schema.sql` from your repository
4. Paste it into the SQL editor
5. Click **"Run"** (or press Cmd/Ctrl + Enter)
6. You should see "Success. No rows returned" - this is good! ✅

This creates all your database tables, triggers, and security policies.

### Step 3: Get Your API Credentials

1. In Supabase dashboard, go to **"Settings"** → **"API"** (left sidebar)
2. You'll see two important values:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon/public key** (long string starting with `eyJ...`)
3. Keep this tab open - you'll need these values next!

### Step 4: Configure Your App

1. Open `/lib/supabase.js` in your code editor
2. Find these lines at the top:
   ```javascript
   const SUPABASE_URL = 'https://your-project.supabase.co';
   const SUPABASE_ANON_KEY = 'your-anon-key-here';
   ```
3. Replace with your actual values from Step 3:
   ```javascript
   const SUPABASE_URL = 'https://xxxxx.supabase.co'; // Your Project URL
   const SUPABASE_ANON_KEY = 'eyJhbGc...'; // Your anon key
   ```
4. Save the file

### Step 5: Add Supabase to Your Environment Variables (Optional but Recommended)

For better security, you can store these as environment variables instead:

Create a `.env` file in your project root:
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
```

Then update `/lib/supabase.js` to read from environment:
```javascript
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key-here';
```

### Step 6: Update Dashboard.html to Use Authentication

The dashboard needs to be protected so only logged-in users can access it.

1. Open `dashboard.html`
2. Add these scripts in the `<head>` section, right before the closing `</head>` tag:
   ```html
   <!-- Supabase Client -->
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   <script src="/lib/supabase.js"></script>
   <script src="/lib/auth-guard.js"></script>
   <script src="/lib/migrate-localstorage.js"></script>
   ```

This will:
- Load Supabase client library
- Initialize database connection
- Redirect to login if user is not authenticated
- Automatically migrate localStorage data to database on first login

### Step 7: Create Your First Admin User

1. Go to your app's login page: `https://yourdomain.com/login.html`
2. Click "Sign up here"
3. Enter your details and create an account
4. Once logged in, you'll have access to the dashboard

To make this user an admin:

1. In Supabase dashboard, go to **"Table Editor"** → **"admin_users"**
2. Click **"Insert row"**
3. Fill in:
   - **user_id**: Copy your user ID from the `users` table
   - **role**: `super_admin`
   - **permissions**: `["view_users", "view_conversations", "view_analytics"]`
4. Click **"Save"**

Now you can access the admin dashboard at: `https://yourdomain.com/admin-dashboard.html`

---

## 📁 Files Created

Here's what was added to your codebase:

```
/database/
  └── schema.sql                 # Database schema (tables, triggers, RLS policies)

/lib/
  ├── supabase.js               # Supabase client and database helpers
  ├── auth-guard.js             # Page authentication middleware
  └── migrate-localstorage.js   # Auto-migrate localStorage → database

/
  ├── login.html                # Updated with authentication
  ├── admin-dashboard.html      # New admin interface
  └── DATABASE_SETUP.md         # This file
```

---

## 🔐 Security Features

Your database is protected with **Row Level Security (RLS)**:

- ✅ Users can only view/edit their own data
- ✅ Admins can view all users and conversations
- ✅ All queries are validated against security policies
- ✅ API keys are safe to expose in client-side code (anon key only gives user-level access)

---

## 🔄 How Data Migration Works

When an existing user logs in for the first time:

1. System checks if `pbb_data_migrated` exists in localStorage
2. If not migrated, it automatically transfers:
   - User profile (name, photo, preferences)
   - Shannon chat history
   - Community chat messages
   - Workout history and custom workouts
   - Daily check-ins
   - Reflections and journal entries
   - Quiz results
3. Marks migration as complete with timestamp
4. Shows success message to user

All future data is saved directly to the database!

---

## 🎨 Next Steps: Update Dashboard to Use Database

The dashboard currently uses localStorage. You need to update it to use the database instead:

### Example: Saving Shannon Chat Messages

**Old code (localStorage):**
```javascript
const chatHistory = JSON.parse(localStorage.getItem('shannon_chat_history') || '[]');
chatHistory.push({
  role: 'user',
  text: message,
  timestamp: Date.now()
});
localStorage.setItem('shannon_chat_history', JSON.stringify(chatHistory));
```

**New code (database):**
```javascript
const user = window.currentUser; // Set by auth-guard.js
await dbHelpers.conversations.create(
  user.id,
  'shannon',
  'user',
  message
);
```

### Example: Loading Chat History

**Old code:**
```javascript
const chatHistory = JSON.parse(localStorage.getItem('shannon_chat_history') || '[]');
```

**New code:**
```javascript
const user = window.currentUser;
const chatHistory = await dbHelpers.conversations.getHistory(user.id, 'shannon');
```

---

## 🧪 Testing Your Setup

### Test Authentication:
1. Visit `/login.html`
2. Create a new account
3. Verify you're redirected to dashboard
4. Check Supabase "Table Editor" → "users" - your user should be there!

### Test Data Persistence:
1. Add a workout or send a chat message
2. Logout
3. Login again (even from a different browser/device)
4. Data should still be there! ✅

### Test Admin Dashboard:
1. Make yourself an admin (see Step 7)
2. Visit `/admin-dashboard.html`
3. You should see all users and their data

---

## 🐛 Troubleshooting

### "Failed to fetch" error
- Check that your SUPABASE_URL and SUPABASE_ANON_KEY are correct in `/lib/supabase.js`
- Make sure you're using the **anon/public** key, not the service_role key

### Users can see other users' data
- RLS policies might not be enabled. Run the schema.sql again to ensure policies are created
- Check Supabase dashboard → "Authentication" → "Policies" to verify policies exist

### Migration not working
- Check browser console for errors
- Verify localStorage has data before login
- Make sure `/lib/migrate-localstorage.js` is loaded in dashboard.html

### Can't access admin dashboard
- Verify you added your user to the `admin_users` table
- Check browser console for authentication errors

---

## 📞 Support

If you encounter issues:
1. Check browser console for error messages
2. Check Supabase logs: Dashboard → "Logs" → "Postgres Logs"
3. Verify all files are uploaded and paths are correct
4. Make sure you're using HTTPS (not HTTP) for your site

---

## 🎉 You're All Set!

Your PlantBasedBalance app now has:
- Real user authentication
- Cloud-hosted database
- Multi-device data sync
- Admin dashboard
- Automatic data migration

Users can now sign up, log in, and access their data from any device!

Next recommended steps:
1. Update all localStorage calls in dashboard.html to use database helpers
2. Test the full user flow (signup → chat → workout → logout → login)
3. Customize the admin dashboard to your needs
4. Set up Supabase email templates for password resets

Happy coding! 🚀

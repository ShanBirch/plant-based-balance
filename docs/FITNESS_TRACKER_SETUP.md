# Fitness Tracker Integrations Setup Guide

This guide walks you through setting up Fitbit and Garmin integrations for Plant Based Balance.

## Table of Contents

- [Overview](#overview)
- [Database Setup](#database-setup)
- [Fitbit Setup](#fitbit-setup)
- [Garmin Setup](#garmin-setup)
- [Environment Configuration](#environment-configuration)
- [Frontend Integration](#frontend-integration)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Overview

The fitness tracker integration allows users to connect their Fitbit and Garmin accounts to automatically sync:

- **Steps** - Daily step count
- **Calories** - Calories burned
- **Heart Rate** - Resting heart rate
- **Sleep** - Sleep duration and quality
- **Distance** - Distance traveled
- **Active Minutes** - Exercise duration

### Architecture

```
User → Frontend UI → Netlify Functions → Fitbit/Garmin API → Database
```

**Components:**
- Database tables: `fitness_integrations`, `fitness_sync_history`, `fitness_metrics`, `oauth_temp_tokens`
- Netlify Functions: OAuth callbacks and sync endpoints
- Frontend: JavaScript module and UI components

---

## Database Setup

### 1. Run Migrations

Execute these SQL files in your Supabase SQL Editor (in order):

```sql
-- 1. Fitness tracker tables
database/migrations/add_fitness_tracker_integrations.sql

-- 2. OAuth temporary tokens (for Garmin OAuth 1.0a)
database/migrations/add_oauth_temp_tokens.sql
```

### 2. Verify Tables

Check that these tables were created:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('fitness_integrations', 'fitness_sync_history', 'fitness_metrics', 'oauth_temp_tokens');
```

You should see 4 tables listed.

---

## Fitbit Setup

### 1. Create Fitbit Developer Account

1. Go to [https://dev.fitbit.com](https://dev.fitbit.com)
2. Sign up or log in with your Fitbit account
3. Click **Register an App**

### 2. Configure Application

Fill in the registration form:

| Field | Value |
|-------|-------|
| **Application Name** | Plant Based Balance |
| **Description** | Fitness tracking integration for Plant Based Balance wellness app |
| **Application Website** | https://your-domain.com |
| **Organization** | Your Organization Name |
| **Organization Website** | https://your-domain.com |
| **OAuth 2.0 Application Type** | **Server** |
| **Callback URL** | `https://your-domain.com/.netlify/functions/fitbit-callback` |
| **Default Access Type** | **Read-Only** |

**Important:** Replace `your-domain.com` with your actual domain.

### 3. Get API Credentials

After registration, you'll receive:
- **OAuth 2.0 Client ID** (e.g., `23ABCD`)
- **Client Secret** (e.g., `a1b2c3d4e5f6g7h8i9j0`)

**Save these securely!** You'll need them for environment variables.

### 4. Request Additional Scopes (If Needed)

By default, Fitbit grants basic scopes. If you need additional permissions:

1. Go to your app settings
2. Request additional scopes (heart rate, sleep, etc.)
3. Fitbit may require approval for some scopes

---

## Garmin Setup

### 1. Create Garmin Developer Account

1. Go to [https://developer.garmin.com](https://developer.garmin.com)
2. Click **Register** (top right)
3. Complete registration form
4. Verify your email

### 2. Join Developer Program

1. Go to [Garmin Connect Developer Program](https://developer.garmin.com/gc-developer-program/)
2. Click **Apply Now**
3. Fill out the application form:
   - **Business Name:** Your company/app name
   - **Application Name:** Plant Based Balance
   - **Description:** Fitness tracking integration for wellness coaching
   - **Website:** https://your-domain.com
   - **Use Case:** Health and fitness data sync for personalized coaching

### 3. Wait for Approval

- **Typical approval time:** 1-4 business days
- You'll receive an email when approved
- Check application status at: [https://developer.garmin.com/gc-developer-program/applications](https://developer.garmin.com/gc-developer-program/applications)

### 4. Get API Credentials

Once approved:

1. Log in to [Garmin Developer Portal](https://developer.garmin.com)
2. Go to **Applications**
3. Create a new application or view existing one
4. Note your credentials:
   - **Consumer Key** (e.g., `abc123-def456-ghi789`)
   - **Consumer Secret** (e.g., `XyZ789AbC123DeF456`)

### 5. Configure OAuth Settings

In your Garmin application settings:

| Field | Value |
|-------|-------|
| **Callback URL** | `https://your-domain.com/.netlify/functions/garmin-callback` |

---

## Environment Configuration

### 1. Update `.env` File

Add these variables to your `.env` file:

```bash
# Fitbit OAuth Configuration
FITBIT_CLIENT_ID=your-fitbit-client-id
FITBIT_CLIENT_SECRET=your-fitbit-client-secret
FITBIT_REDIRECT_URI=https://your-domain.com/.netlify/functions/fitbit-callback

# Garmin OAuth Configuration
GARMIN_CONSUMER_KEY=your-garmin-consumer-key
GARMIN_CONSUMER_SECRET=your-garmin-consumer-secret
GARMIN_REDIRECT_URI=https://your-domain.com/.netlify/functions/garmin-callback
```

**Replace:**
- `your-domain.com` with your actual domain
- Credential placeholders with actual values from Fitbit and Garmin

### 2. Configure Netlify Environment Variables

For production deployment:

1. Go to Netlify Dashboard → Your Site → **Site settings** → **Environment variables**
2. Add each variable from above
3. Click **Save**
4. Trigger a new deployment

---

## Frontend Integration

### 1. Add UI to Dashboard

Add this HTML to your dashboard settings section (around line 7350 in `dashboard.html`):

```html
<!-- FITNESS TRACKER INTEGRATIONS -->
<h3 style="padding: 0 25px; margin: 30px 0 20px 0; display:flex; align-items:center; gap:10px;">
    <span>⌚</span>
    Fitness Trackers
</h3>
<div style="padding: 0 25px; margin-bottom: 30px;">
    <div style="background:white; border-radius:12px; border:1px solid #f1f5f9; overflow:hidden;">

        <!-- Fitbit Integration -->
        <div style="padding:20px; border-bottom:1px solid #f1f5f9;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div>
                    <div style="font-weight:600; margin-bottom:5px;">Fitbit</div>
                    <div id="fitbit-status" style="font-size:0.85rem; color:var(--text-muted);">Not connected</div>
                    <div id="fitbit-last-sync" style="font-size:0.75rem; color:var(--text-muted); margin-top:3px; display:none;"></div>
                </div>
                <div style="display:flex; gap:10px;">
                    <button id="fitbit-connect-btn" style="background:var(--primary); color:white; border:none; padding:8px 16px; border-radius:8px; cursor:pointer; font-size:0.9rem;">
                        Connect
                    </button>
                    <button id="fitbit-sync-btn" style="background:var(--secondary); color:white; border:none; padding:8px 16px; border-radius:8px; cursor:pointer; font-size:0.9rem; display:none;">
                        Sync Now
                    </button>
                    <button id="fitbit-disconnect-btn" style="background:#ef4444; color:white; border:none; padding:8px 16px; border-radius:8px; cursor:pointer; font-size:0.9rem; display:none;">
                        Disconnect
                    </button>
                </div>
            </div>
        </div>

        <!-- Garmin Integration -->
        <div style="padding:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div>
                    <div style="font-weight:600; margin-bottom:5px;">Garmin</div>
                    <div id="garmin-status" style="font-size:0.85rem; color:var(--text-muted);">Not connected</div>
                    <div id="garmin-last-sync" style="font-size:0.75rem; color:var(--text-muted); margin-top:3px; display:none;"></div>
                </div>
                <div style="display:flex; gap:10px;">
                    <button id="garmin-connect-btn" style="background:var(--primary); color:white; border:none; padding:8px 16px; border-radius:8px; cursor:pointer; font-size:0.9rem;">
                        Connect
                    </button>
                    <button id="garmin-sync-btn" style="background:var(--secondary); color:white; border:none; padding:8px 16px; border-radius:8px; cursor:pointer; font-size:0.9rem; display:none;">
                        Sync Now
                    </button>
                    <button id="garmin-disconnect-btn" style="background:#ef4444; color:white; border:none; padding:8px 16px; border-radius:8px; cursor:pointer; font-size:0.9rem; display:none;">
                        Disconnect
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Today's Fitness Metrics Summary -->
<div style="padding: 0 25px; margin-bottom: 30px;">
    <h4 style="margin-bottom:15px; color:var(--primary);">Today's Activity</h4>
    <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:15px;">
        <div style="background:white; border-radius:12px; padding:15px; border:1px solid #f1f5f9;">
            <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:5px;">Steps</div>
            <div id="metric-steps" style="font-size:1.5rem; font-weight:700; color:var(--primary);">-</div>
        </div>
        <div style="background:white; border-radius:12px; padding:15px; border:1px solid #f1f5f9;">
            <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:5px;">Calories</div>
            <div id="metric-calories" style="font-size:1.5rem; font-weight:700; color:var(--primary);">-</div>
        </div>
        <div style="background:white; border-radius:12px; padding:15px; border:1px solid #f1f5f9;">
            <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:5px;">Sleep</div>
            <div id="metric-sleep" style="font-size:1.5rem; font-weight:700; color:var(--primary);">-</div>
        </div>
        <div style="background:white; border-radius:12px; padding:15px; border:1px solid #f1f5f9;">
            <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:5px;">Resting HR</div>
            <div id="metric-heart_rate" style="font-size:1.5rem; font-weight:700; color:var(--primary);">-</div>
        </div>
    </div>
</div>
```

### 2. Include JavaScript Module

Add this script tag to your dashboard HTML (in the `<head>` or before `</body>`):

```html
<script src="lib/fitness-trackers.js"></script>
```

---

## Testing

### 1. Test Fitbit Connection

1. Log into your app as a test user
2. Navigate to Settings (or wherever you added the UI)
3. Click **Connect** under Fitbit
4. You should be redirected to Fitbit's authorization page
5. Log in and authorize the app
6. You should be redirected back with a success message
7. Check that status shows "✓ Connected"
8. Click **Sync Now** to manually trigger a sync

### 2. Test Garmin Connection

Follow the same steps as Fitbit, but for Garmin.

### 3. Verify Data Sync

Check that data was synced:

```sql
-- Check integrations
SELECT * FROM fitness_integrations WHERE is_active = true;

-- Check sync history
SELECT * FROM fitness_sync_history ORDER BY created_at DESC LIMIT 10;

-- Check metrics
SELECT * FROM fitness_metrics ORDER BY metric_date DESC LIMIT 20;
```

### 4. Test Disconnect

1. Click **Disconnect** button
2. Confirm the action
3. Status should change to "Not connected"
4. Verify in database:

```sql
SELECT * FROM fitness_integrations WHERE is_active = false;
```

---

## Troubleshooting

### Fitbit Issues

**Problem:** "Invalid redirect URI" error

**Solution:**
- Verify `FITBIT_REDIRECT_URI` in `.env` matches the callback URL in Fitbit app settings
- Ensure URL uses `https://` (not `http://`)
- Check that Netlify function is deployed

**Problem:** "Insufficient scope" error

**Solution:**
- Go to Fitbit app settings
- Request additional scopes (activity, heartrate, sleep, weight, profile)
- May require Fitbit approval

**Problem:** Token refresh fails

**Solution:**
- Check that `FITBIT_CLIENT_SECRET` is correct
- Verify tokens haven't been manually revoked in Fitbit settings

### Garmin Issues

**Problem:** "Application not approved" error

**Solution:**
- Check Garmin Developer Program application status
- Wait for approval (can take 1-4 days)
- Contact Garmin support if delayed

**Problem:** "Invalid OAuth signature" error

**Solution:**
- Verify `GARMIN_CONSUMER_SECRET` is correct
- Check system clock is synchronized (OAuth 1.0a is time-sensitive)
- Ensure callback URL matches exactly

**Problem:** No data returned from Garmin

**Solution:**
- Verify user has recent activity on their Garmin device
- Check that device has synced to Garmin Connect
- Garmin may have rate limits - wait and try again

### General Issues

**Problem:** Database errors

**Solution:**
- Verify all migrations were run successfully
- Check Supabase service role key is set correctly
- Review database logs in Supabase dashboard

**Problem:** Netlify function errors

**Solution:**
- Check Netlify function logs: Netlify Dashboard → Functions → View logs
- Verify all environment variables are set
- Check function deployment status

**Problem:** UI not updating

**Solution:**
- Clear browser cache
- Check browser console for JavaScript errors
- Verify `lib/fitness-trackers.js` is included

---

## API Rate Limits

### Fitbit
- **150 requests per user per hour**
- Sync conservatively (once per day for initial sync, manual for updates)
- Spread requests across time if syncing multiple days

### Garmin
- **More generous limits** (specific limits not publicly documented)
- Real-time updates available
- Daily summaries are most reliable

---

## Next Steps

1. **Automated Sync:** Set up a cron job (via Netlify Scheduled Functions) to sync data daily
2. **Webhooks:** Implement Fitbit/Garmin webhooks for real-time updates
3. **Data Visualization:** Create charts and graphs from synced metrics
4. **Shannon Integration:** Feed fitness data into AI coach for personalized recommendations

---

## Support

For issues or questions:
- Check Supabase logs
- Check Netlify function logs
- Review browser console errors
- Consult Fitbit/Garmin API documentation

**Documentation:**
- [Fitbit Web API](https://dev.fitbit.com/build/reference/web-api/)
- [Garmin Connect API](https://developer.garmin.com/gc-developer-program/overview/)

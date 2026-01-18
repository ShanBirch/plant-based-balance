# Backblaze B2 Setup Guide for Stories Feature

This guide will help you set up Backblaze B2 storage for the stories feature, enabling support for longer videos and better performance.

## Why Backblaze B2?

- **Cost-effective**: $5/TB/month (vs Supabase Storage at $100/TB/month)
- **No size limits**: Support videos of any length
- **Better performance**: Fast CDN delivery
- **Auto-cleanup**: Lifecycle rules to delete expired stories

## Step 1: Create Backblaze B2 Account

1. Go to [backblaze.com/b2](https://www.backblaze.com/b2/cloud-storage.html)
2. Sign up for a free account (10GB free storage included)
3. Verify your email address

## Step 2: Create a Bucket

1. Log in to your Backblaze account
2. Click **"Buckets"** in the left sidebar
3. Click **"Create a Bucket"**
4. Configure the bucket:
   - **Bucket Name**: `plant-based-balance-stories` (or any unique name)
   - **Files in Bucket**: `Public` (so story URLs work without authentication)
   - **Default Encryption**: `Disable` (not needed for public stories)
   - **Object Lock**: `Disable`
5. Click **"Create a Bucket"**

## Step 3: Create Application Key

1. Go to **"App Keys"** in the left sidebar
2. Click **"Add a New Application Key"**
3. Configure the key:
   - **Name**: `plant-based-balance-netlify`
   - **Allow access to Bucket(s)**: Select your stories bucket
   - **Type of Access**: `Read and Write`
   - **Allow List All Bucket Names**: ✅ (checked)
4. Click **"Create New Key"**
5. **IMPORTANT**: Copy and save these values immediately (they won't be shown again):
   - `keyID`
   - `applicationKey`

## Step 4: Get Bucket ID

1. Go back to **"Buckets"**
2. Click on your stories bucket
3. In the bucket details, copy the **Bucket ID** (looks like: `4a48fe8875c6214145f50c08`)

## Step 5: Add Environment Variables to Netlify

1. Go to your Netlify dashboard
2. Select your site
3. Go to **Site settings** → **Environment variables**
4. Add the following variables:

```
B2_KEY_ID = <your keyID from step 3>
B2_APPLICATION_KEY = <your applicationKey from step 3>
B2_BUCKET_ID = <your Bucket ID from step 4>
B2_BUCKET_NAME = plant-based-balance-stories (or your bucket name)
SUPABASE_URL = <your existing Supabase URL>
SUPABASE_SERVICE_ROLE_KEY = <your Supabase service role key>
```

5. Click **"Save"**

## Step 6: Set Up CORS (Cross-Origin Resource Sharing)

This allows your website to directly access B2 files.

1. In Backblaze, go to your bucket settings
2. Scroll to **"Bucket Settings"** → **"CORS Rules"**
3. Click **"Add a CORS Rule"**
4. Use this configuration:

```json
{
  "corsRuleName": "allowWebsite",
  "allowedOrigins": [
    "https://plantbased-balance.org",
    "https://www.plantbased-balance.org",
    "http://localhost:*"
  ],
  "allowedOperations": [
    "s3_get"
  ],
  "allowedHeaders": [
    "*"
  ],
  "exposeHeaders": [],
  "maxAgeSeconds": 3600
}
```

5. Click **"Save Changes"**

## Step 7: Optional - Set Up Lifecycle Rules for Auto-Cleanup

Configure B2 to automatically delete files older than 1 day:

1. Go to **"Lifecycle Settings"** in your bucket
2. Click **"Add a New Rule"**
3. Configure:
   - **Rule Name**: `delete-expired-stories`
   - **File name prefix**: `stories/` (only affects story files)
   - **Days to keep**: `1`
   - **Keep only**: `the last version`
4. Click **"Save Rule"**

## Step 8: Deploy and Test

1. Push your code changes to trigger a Netlify deployment
2. Test uploading a story with a large video file (> 5MB)
3. Verify the file appears in your B2 bucket
4. Verify the story plays correctly in the app

## How It Works

### File Size Threshold

- **Files < 5MB**: Stored as Base64 in PostgreSQL (fast for small images)
- **Files > 5MB**: Uploaded to Backblaze B2 (efficient for videos)

### Upload Flow

1. User selects a video file
2. Frontend checks file size
3. If > 5MB:
   - File is sent to `/api/upload-story-media` edge function
   - Edge function uploads to B2
   - B2 URL is returned
   - URL is saved in database
4. If < 5MB:
   - File is converted to Base64
   - Base64 is saved directly in database

### Cleanup Flow

The `/api/cleanup-expired-stories` endpoint:
- Runs hourly via cron (or manually)
- Finds expired stories with B2 URLs
- Deletes files from B2
- Removes stories from database

To manually trigger cleanup:
```bash
curl -X POST https://your-site.netlify.app/api/cleanup-expired-stories
```

## Cost Estimate

Example for 1000 active users posting 2 stories/day:

- **Storage**: 2000 stories × 50MB avg = 100GB = $0.50/month
- **Bandwidth**: 2000 stories × 50 views × 50MB = 5TB = ~$50/month
- **Total**: ~$50-60/month

Compare to Supabase Storage: ~$500/month for same usage

## Troubleshooting

### Stories not uploading
- Check Netlify environment variables are set
- Check browser console for errors
- Verify bucket is set to "Public"

### Videos not playing
- Check CORS is configured correctly
- Verify file exists in B2 bucket
- Check browser network tab for 403/404 errors

### Cleanup not working
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set (not the anon key)
- Check Netlify function logs for errors
- Manually test: `curl -X POST https://your-site.netlify.app/api/cleanup-expired-stories`

## Security Notes

- ✅ Application keys are stored securely in Netlify environment variables
- ✅ Never exposed to frontend
- ✅ Bucket is public but files have unpredictable names
- ✅ Stories auto-expire after 24 hours
- ✅ Old files are automatically deleted

## Next Steps

After setup is complete:
1. Test uploading various file sizes
2. Set up a cron job to call cleanup endpoint hourly
3. Monitor B2 usage in the Backblaze dashboard
4. Optionally enable B2 CDN for faster delivery

## Support

For issues or questions:
- Backblaze Support: [help.backblaze.com](https://help.backblaze.com)
- B2 API Docs: [backblaze.com/b2/docs](https://www.backblaze.com/b2/docs/)

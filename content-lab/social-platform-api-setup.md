# Balance Social Platform API Setup

This connects the existing Balance content review packs to YouTube Shorts and TikTok.

The publish layer is intentionally review-first. It dry-runs by default and only sends content when both of these are true:

- The command includes `--publish`.
- `CONTENT_LAB_AUTOPUBLISH=true` is present in the runtime environment.

## Files

- `content-lab/src/providers/youtube.js`: YouTube OAuth refresh and resumable MP4 upload.
- `content-lab/src/providers/tiktok.js`: TikTok OAuth refresh, creator info, direct video posting, chunked file upload, and photo post init.
- `content-lab/src/social-publisher.js`: Manifest-driven publisher for review packs.
- `content-lab/src/cli.js`: Adds `publish-social`.

## YouTube Setup

Create a Google Cloud project, enable YouTube Data API v3, and create an OAuth client.

Required OAuth scope:

```text
https://www.googleapis.com/auth/youtube.upload
```

For post metrics and feedback loops, also enable the YouTube Analytics API and use these scopes when generating the refresh token:

```text
https://www.googleapis.com/auth/youtube.upload
https://www.googleapis.com/auth/youtube.readonly
https://www.googleapis.com/auth/yt-analytics.readonly
```

Set these environment variables in the local shell or Netlify secret store:

```text
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REFRESH_TOKEN=
YOUTUBE_PRIVACY_STATUS=private
YOUTUBE_CATEGORY_ID=26
```

Optional:

```text
YOUTUBE_ACCESS_TOKEN=
```

Prefer `YOUTUBE_REFRESH_TOKEN` for regular use, because access tokens expire.

For local testing, protected Netlify secret values may not be retrievable through `netlify dev:exec`. Put the same values in a local-only file that is not committed:

```text
content-lab/.env.local
```

Example:

```text
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REFRESH_TOKEN=
YOUTUBE_PRIVACY_STATUS=private
YOUTUBE_CATEGORY_ID=26
```

Notes:

- Keep the default privacy as `private` until the upload flow is proven.
- YouTube may restrict public API uploads from unaudited projects until the project passes a YouTube API Services audit.
- The adapter uses the normal video upload API. A vertical MP4 that meets YouTube Shorts rules is treated as a Short by YouTube.

## TikTok Setup

Create a TikTok Developer app and add the Content Posting API product.

Required scopes:

```text
video.publish
video.upload
```

Set these environment variables:

```text
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REFRESH_TOKEN=
TIKTOK_PRIVACY_LEVEL=SELF_ONLY
TIKTOK_PHOTO_POST_MODE=MEDIA_UPLOAD
```

Optional:

```text
TIKTOK_ACCESS_TOKEN=
TIKTOK_MAX_VIDEO_DURATION_SEC=180
TIKTOK_UPLOAD_CHUNK_SIZE=67108864
```

Notes:

- TikTok requires the app to query creator info and honor the available privacy options before direct posting.
- Unaudited clients are limited. Keep `SELF_ONLY` and `MEDIA_UPLOAD` until the account and app are approved for public direct posting.
- TikTok photo/carousel posts require HTTPS image URLs from a verified domain or URL prefix. Local PNG slides need to be uploaded to a public verified URL before publishing.

## Dry Run

From the repo root:

```powershell
node content-lab\src\cli.js publish-social --manifest=content-lab\output\balance-daily\2026-06-08\manifest.json --dry-run
```

Filter to one platform:

```powershell
node content-lab\src\cli.js publish-social --manifest=content-lab\output\balance-daily\2026-06-08\manifest.json --platform=youtube --dry-run
```

Filter to one lane:

```powershell
node content-lab\src\cli.js publish-social --manifest=content-lab\output\balance-daily\2026-06-08\manifest.json --platform=tiktok --lane=exercise --dry-run
```

## Real Publish

Only after credentials and audits are ready:

```powershell
$env:CONTENT_LAB_AUTOPUBLISH="true"
node content-lab\src\cli.js publish-social --manifest=content-lab\output\balance-daily\2026-06-08\manifest.json --platform=youtube --lane=science --publish
```

TikTok direct public posting should stay off until TikTok approval is complete:

```powershell
$env:CONTENT_LAB_AUTOPUBLISH="true"
$env:TIKTOK_PRIVACY_LEVEL="SELF_ONLY"
node content-lab\src\cli.js publish-social --manifest=content-lab\output\balance-daily\2026-06-08\manifest.json --platform=tiktok --lane=exercise --publish
```

## YouTube Metrics

After deploying `netlify/functions/youtube-content-metrics.mjs`, fetch metrics for any uploaded YouTube video with:

```powershell
Invoke-RestMethod `
  -Uri "https://plantbased-balance.org/.netlify/functions/youtube-content-metrics" `
  -Method POST `
  -Headers @{ "x-balance-content-secret" = $env:BALANCE_CONTENT_AUTOMATION_SECRET } `
  -ContentType "application/json" `
  -Body '{"videoId":"XP9f9UY1jAk"}'
```

The function returns:

```text
video.statistics.viewCount
video.statistics.likeCount
video.statistics.commentCount
analytics.columns
analytics.rows
```

YouTube Analytics can lag behind uploads and may return an empty `rows` array for brand-new or zero-view private videos.

## Manifest Fields

The publisher looks for these fields on each post:

```json
{
  "id": "2026-06-08-science-sleep-restriction-fat-loss",
  "lane": "science",
  "title": "Same diet, different weight loss",
  "caption": "Caption text",
  "mediaLocalPath": "C:\\path\\to\\vertical-reel.mp4",
  "thumbnailUrl": "https://example.com/cover.png",
  "social": {
    "platforms": ["youtube", "tiktok"],
    "youtube": {
      "title": "Same diet, different weight loss #Shorts",
      "privacyStatus": "private"
    },
    "tiktok": {
      "privacyLevel": "SELF_ONLY",
      "postMode": "MEDIA_UPLOAD"
    }
  }
}
```

For TikTok photo/carousel posts:

```json
{
  "mediaType": "carousel",
  "social": {
    "tiktok": {
      "mode": "photo",
      "photoUrls": [
        "https://plantbased-balance.org/path/slide-1.jpg",
        "https://plantbased-balance.org/path/slide-2.jpg"
      ]
    }
  }
}
```

## Approval Gates

Keep these rules:

- Do not publish if a science review is missing its final MP4 or ElevenLabs voice artifact.
- Do not publish local Proof Pulse PNGs to TikTok until they are hosted as verified HTTPS image URLs.
- Do not set TikTok to `PUBLIC_TO_EVERYONE` until creator info confirms that option is available and the app audit is complete.
- Do not mention automation, models, or internal tooling in any caption.

# Social Media Integration Research

## Overview

Research into integrating Instagram, TikTok, and Facebook alongside the existing Spotify integration in Plant-Based Balance.

## Current Integration Architecture

The app follows a consistent OAuth2 pattern for all integrations (Spotify, Fitbit, WHOOP, Oura, Strava):

```
1. Auth Edge Function  → OAuth redirect + callback + token storage
2. Sync Edge Function  → Data fetching + aggregation
3. Database Migration   → {service}_connections + {service}_data tables
4. netlify.toml routes → Map API endpoints to edge functions
5. Frontend dashboard  → Connect/disconnect buttons + status display
```

Key reference files:
- Auth template: `netlify/edge-functions/spotify-auth.js`
- Sync template: `netlify/edge-functions/spotify-sync.js`
- DB template: `database/spotify_migration.sql`
- Routing: `netlify.toml`

---

## Platform API Analysis

### Instagram (Meta Graph API)

**API:** Meta Graph API (v18.0+)
**Developer Portal:** https://developers.facebook.com/

| Capability | Available? | Notes |
|---|---|---|
| OAuth Login | Yes | Via Facebook Login |
| Read user's own posts | Business/Creator accounts only | Personal accounts have no feed access |
| Read user's feed | No | Locked down post-2018 |
| Post/share content | Yes (Stories, Feed) | Requires `publish_to_groups` or Content Publishing API |
| Engagement analytics | Business/Creator only | Impressions, reach, saves |
| Follower count | Business/Creator only | Via Insights API |
| Stories | Business/Creator only | Can read and post |

**Key Limitations:**
- Instagram Basic Display API was deprecated December 2024
- Personal accounts have minimal API access
- Meta app review process is slow (weeks to months) and strict
- Each permission must be individually justified

**Required Scopes (Business):**
- `instagram_basic` - Profile info
- `instagram_content_publish` - Post content
- `instagram_manage_insights` - Analytics
- `pages_show_list` - Required for Instagram Business accounts

### Facebook (Meta Graph API)

**API:** Meta Graph API (v18.0+)
**Developer Portal:** https://developers.facebook.com/

| Capability | Available? | Notes |
|---|---|---|
| OAuth Login | Yes | Most straightforward of the three |
| Read News Feed | No | Locked down after Cambridge Analytica (2018) |
| Read user profile | Limited | Name, email, profile picture |
| Share to Feed | Yes | Via Share Dialog (client-side) |
| Page management | Yes | For users who manage Pages |
| Groups | Very limited | Mostly deprecated |

**Key Limitations:**
- Cannot read a user's News Feed or friends list
- Personal data access is extremely restricted
- Sharing works via client-side Share Dialog (no server-side needed)

**Note:** We already have Meta CAPI integration in `netlify/edge-functions/lib/capi-utils.js` for conversion tracking. A Meta Developer account may already exist.

### TikTok

**API:** TikTok API for Developers
**Developer Portal:** https://developers.tiktok.com/

| Capability | Available? | Notes |
|---|---|---|
| OAuth Login (Login Kit) | Yes | Basic profile + avatar + follower count |
| Read user's own videos | Yes | Videos they posted |
| Read For You Page | No | Not available |
| Post videos (Content Posting API) | Yes | Share videos to TikTok from app |
| Video embed (oEmbed) | Yes | Embed TikTok videos in app |
| Analytics | Basic | View counts on own videos |

**Key Limitations:**
- Cannot pull a user's TikTok feed or For You Page
- Research API exists but is for academic purposes only
- Content Posting API requires app review

---

## Feasibility Summary

### What IS possible (and valuable)

1. **Share to Social Platforms**
   - Share achievements, pet screenshots, streak milestones
   - Uses native share dialogs (minimal API approval needed)
   - Drives organic growth
   - Implementation: Client-side share links/buttons, no OAuth required

2. **Social Login**
   - "Login with Facebook/Instagram/TikTok"
   - Straightforward OAuth implementation
   - Follows existing Spotify auth pattern

3. **Instagram Business Analytics** (for fitness creators)
   - Pull post engagement metrics
   - Reward XP for posting fitness content
   - Requires Business/Creator Instagram account

4. **TikTok Content Posting**
   - Let users share transformation videos directly to TikTok
   - Requires app review from TikTok

### What is NOT possible

- **Aggregating feeds**: None of these platforms allow third-party apps to display their feeds
- **"See everything in one app"**: Platform restrictions prevent this for Instagram, Facebook, and TikTok
- **Reading friends/followers data**: Heavily restricted on all platforms

---

## Recommended Approach

### Phase 1: Share to Social (Lowest effort, highest impact)
- Add share buttons for achievements, milestones, pet screenshots
- Use Web Share API or platform-specific share URLs
- No API keys or approval needed
- Drives organic user acquisition

### Phase 2: Social Login (Medium effort)
- Add "Login with Facebook" (covers Instagram too via Meta)
- Add "Login with TikTok"
- Follows existing OAuth2 pattern
- Requires developer accounts + app review

### Phase 3: Creator Analytics (Higher effort, niche audience)
- Instagram Business insights integration
- TikTok video performance tracking
- XP rewards for posting fitness content
- Only relevant for creator/influencer users

---

## Alternative Platforms Worth Considering

| Platform | API Openness | Relevance to Fitness App |
|---|---|---|
| **YouTube** | Very open | Workout video playlists, log video workouts for XP |
| **Discord** | Very open | Community hub, challenges, social features |
| **Twitter/X** | Moderate | Share achievements, follow fitness accounts |
| **Pinterest** | Moderate | Meal planning pins, recipe discovery |

---

## Developer Account Requirements

| Platform | Portal | Approval Time | Cost |
|---|---|---|---|
| Meta (FB + IG) | developers.facebook.com | 2-8 weeks | Free |
| TikTok | developers.tiktok.com | 1-4 weeks | Free |
| YouTube | console.cloud.google.com | Days | Free (quota limits) |
| Discord | discord.com/developers | Instant | Free |

---

## Environment Variables Needed

```env
# Meta (Facebook + Instagram)
META_APP_ID=your-meta-app-id
META_APP_SECRET=your-meta-app-secret

# TikTok
TIKTOK_CLIENT_KEY=your-tiktok-client-key
TIKTOK_CLIENT_SECRET=your-tiktok-client-secret
```

---

*Research date: 2026-02-19*

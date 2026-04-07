# Plant Based Balance

A gamified plant-based fitness, nutrition and wellness PWA — built as a single-developer full-stack project and shipped to the Google Play Store and App Store via Capacitor.

> This is a public portfolio snapshot of the codebase. Heavy media assets (workout images, character GLBs, instagram exports) and signing keys have been removed. The live app runs at [plantbasedbalance.com](https://plantbasedbalance.com).

## What it does

- **Workout tracking** with a 1000+ exercise library, supersets, PB detection and a social feed of completed workouts as shareable cards
- **Nutrition logging** with a calorie/macro tracker, meal library, and a fasting timer
- **Wearable sync** via Health Connect (Android), HealthKit (iOS) and Fitbit OAuth, with reverse-calculated real TDEE vs formula BMR insights
- **Gamification**: XP, coins, daily challenges, a Tamagotchi-style 3D character that levels up, real-time PvP quiz battles with coin wagering, and group challenges
- **AI coach** ("Gotchi") — an LLM chat that gathers the user's full context (workouts, mood, nutrition, energy balance) and gives proactive insights
- **Mood + recovery**: 3x daily mood/energy/stress check-ins, acupressure guides, breathwork
- **Social feed** with reactions, referral network visibility, and shareable workout cards

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Vanilla JS PWA (no framework), single-file `dashboard.html` (~37k lines), inline + `styles.css` |
| Native shell | Capacitor 8 (Android + iOS) |
| Backend | Supabase (Postgres + RLS + Realtime + Auth + Storage) |
| Serverless | Netlify Edge Functions (Deno) for AI chat, points awarding, Fitbit sync, Stripe webhooks |
| AI | Anthropic Claude + Google Gemini for the in-app coach |
| Payments | Stripe (web subscriptions) + Google Play Billing / RevenueCat (mobile) |
| 3D | Three.js + meshopt-compressed GLBs hosted on Backblaze B2 |
| Health | `@capgo/capacitor-health` (Health Connect + HealthKit), Fitbit Web API |
| Push | Capacitor Push Notifications + web-push |

## Repo layout

```
├── dashboard.html             # Main app UI — every screen lives here
├── lib/                       # Client modules
│   ├── supabase.js            # DB client + dbHelpers wrapper
│   ├── stories.js             # Social feed + workout cards
│   ├── learning-inline.js     # Quiz lessons + PvP quiz battles
│   ├── games.js               # Mini-games
│   ├── avatar3d.js            # Three.js character renderer
│   ├── native-health.js       # Health Connect / HealthKit bridge
│   ├── native-iap.js          # Mobile in-app purchases
│   └── ...
├── netlify/edge-functions/    # Deno serverless functions
│   ├── home-ai-chat.ts        # AI coach with full user-context prompt
│   ├── analyze-story-points.ts
│   ├── fitbit-sync.js
│   └── ...
├── database/                  # Supabase SQL migrations + RLS policies
├── android/                   # Capacitor Android shell
├── *.html                     # Marketing pages, blog, calculators
└── sw.js                      # PWA service worker
```

## Things I'm proud of

- **Reverse-calculated real TDEE** — instead of trusting formula BMR, the Activity Insights view reconstructs each user's actual TDEE from logged calories and weight delta over rolling windows, then compares it against wearable-reported and formula-derived numbers.
- **Realtime PvP quiz battles** — both players get the same 15-question deck via a seeded RNG (mulberry32), with live score sync over Supabase Realtime broadcast and coin wagering settled atomically by Postgres RPCs.
- **Workout cards in the feed** — a swipeable carousel where slide 1 is the gym photo and slide 2 is a generated gradient card with sets, reps, PRs, and a green/gold color depending on whether a PB was hit.
- **AI coach with proactive insights** — `gatherUserContext()` assembles ~2 weeks of workouts, mood logs, nutrition, sleep and energy balance into a single prompt so the LLM can correlate (e.g. "your stress spikes the day after low-protein meals").
- **No framework, no build step** — the entire client is plain JS/HTML loaded straight from a CDN. Updates ship instantly without an app store review.

## What's not in this snapshot

- Production secrets (Supabase service-role key, Stripe keys, AI API keys — all referenced via env vars in edge functions)
- Android signing keystore
- Heavy media (~1.4 GB of workout images, 3D character GLBs, marketing assets) — these live on Backblaze B2 in production
- iOS Xcode project (kept Android only for brevity)

## Author

Shannon Birch — solo developer, designer and operator of Plant Based Balance.

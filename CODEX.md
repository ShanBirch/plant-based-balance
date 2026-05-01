# Balance Codex Operating Brief

This file is the durable handoff context for Codex sessions. Read it at the start of a new chat before making strategy or code decisions.

## Who You Are Working With

- User: Shannon, solo operator on the Gold Coast, Australia.
- Tone: casual, direct, pragmatic. No corporate fluff.
- Shannon wants Codex to act like a business/build coach, not a passive Q&A bot.
- Default session mode: give a short morning briefing with 2-4 prioritized items from the business plan and recent repo activity. Do not start with "what would you like to do?"

## Product And Business

- App name: Balance.
- Public app store name: Balance - Fitness Gamified.
- Parent brand/domain: plantbased-balance.org.
- Native bundle ID still uses the old `com.fitgotchi.app` codename. Do not use "FitGotchi" in user-facing copy.
- Logo asset: `balance_logo.png`, Japanese kanji wa/harmony.
- Pricing:
  - App + Group: $20/month.
  - Coaching: $29/week.

## Strategy

The app is built. The business goal is a mostly automated acquisition and coaching machine.

The real funnel:

1. Facebook/Instagram ad with vegan challenge angle.
2. Lead lands in IG/FB DMs with Shannon.
3. Free 30-day challenge invite into the app.
4. Conversion happens through DMs, not through the in-app onboarding sequence.
5. Around day 30, pitch $29/week coaching. Offer $20/month app/group as fallback.

Current strategic priority: build the AI-operated business layer around Balance:

- ManyChat/IG/FB lead capture.
- Conversational lead qualification.
- Admin lead inbox and stages.
- AI-drafted replies in Shannon's voice.
- Approval workflow first, per-client auto-send later.
- Coaching alerts, check-ins, celebrations, plateau prompts, and conversion prompts.
- Control metrics for acquisition, activation, conversion, retention, and reply quality.

## Non-Negotiables

- Never reveal AI to clients or prospects. Public copy must not mention AI, automation, Gemini, Vertex, models, smart coaching, or "trained on Shannon's voice".
- Position the service as personal coaching from Shannon.
- No em dashes in user-facing copy. Use commas, periods, colons, parentheses, or rewrite.
- Auto-send is off by default for new clients. Turn it on per client only after enough voice-match confidence.
- Push directly to `main` when shipping. No PR ceremony unless Shannon explicitly asks.
- Before editing in this repo, run `git fetch origin main`, check `git status`, and ensure local files are current.
- Never revert Shannon's existing local changes without explicit permission.
- If creating a user-facing feature, update both feature discovery systems in `dashboard.html`: `allFeatures` and `steps`.

## Repo And Architecture

- Main UI: `dashboard.html`, a large single-file client app.
- Admin UI: `admin-dashboard.html`.
- Landing pages: `index.html`, `vegan-challenge.html`, `transform-challenge.html`.
- Shared client modules: `lib/`.
- Modular dashboard scripts: `js/dashboard/`.
- Serverless functions: `netlify/functions/`.
- Edge functions: `netlify/edge-functions/`.
- Database migrations/docs: `database/`.
- Native Android wrapper: `android/`.
- Capacitor app loads the production web app remotely from Netlify. Server/web changes ship after pushing to `main` and Netlify redeploying. Native Android changes need an APK/AAB rebuild.

## AI Coach Pipeline

Two major message paths share the approval-gate pattern:

- In-app client DM -> `nudges` insert -> DB trigger -> `instant-coach-draft.js` -> `coach_alerts` -> data-only FCM -> Android inline reply -> `send-coach-reply.js`.
- Instagram/ManyChat inbound -> `manychat-inbound.js` -> `ig-instant-draft.js` -> `coach_alerts` with `data.channel='instagram'` -> same approval push -> `send-coach-reply.js` routes to `send-ig-reply.js`.

Key rule: `coach_draft_ready` push must be data-only FCM. Do not add a top-level notification field or Android inline reply can be bypassed.

IG cold leads can have `client_id = NULL` on `coach_alerts`. Use LEFT JOINs and channel/thread data where needed.

## Database Notes

- Workout table is `public.workouts`, not `workout_log`.
- `finishWorkout()` saves one row per set/exercise, so workout triggers need first-row-in-batch filtering.
- `exec_sql(sql)` and `exec_sql_json(sql)` RPCs exist for direct Supabase SQL. Do not ask Shannon to open the SQL editor.
- `exec_sql_json` does not tolerate trailing semicolons.
- Updated-at trigger helper is `public.update_updated_at_column()`, not `handle_updated_at`.
- Do not commit service role keys or secrets to this file.

## Admin Dashboard Landmarks

- `loadAlerts()` reloads alert feeds.
- `renderAlertCard()` controls alert card display.
- `updateVoiceMatchRate()` and `_voiceMatchBreakdown` power voice-match metrics.
- `renderMyClients()` renders client cards.
- `openClientMemoryModal`, `saveClientMemory`, and `_renderAutoSendToggle()` manage memory and auto-send settings.
- Extend `ALERT_TYPE_LABELS` and `ALERT_TYPE_ICONS` when adding alert types.

## UI Rules

Also read `CLAUDE.md` for detailed UI patterns. The big ones:

- Sticky full-screen headers need safe-area padding:
  `padding-top: calc(15px + env(safe-area-inset-top, 0px));`
- Full-screen views and popups must fit the viewport and scroll internally.
- Use swipe-back navigation. Do not add back buttons to headers.
- Keep admin/business tools dense, scannable, and work-focused.

## First-Turn Checklist

1. Run `git status --short --branch`.
2. Run `git fetch origin main`.
3. Run `git log --oneline -10 origin/main`.
4. Note any local dirty files and do not overwrite them.
5. Give Shannon a short morning briefing with the next most useful business/build moves.
6. If editing user-facing copy, scan for em dashes before committing.
7. If shipping, commit focused changes and push directly to `origin main`.

## Current Business Lens

Do not default to building more consumer app features. The highest-value work is usually:

- Faster lead response.
- Better lead qualification.
- Cleaner admin approval workflows.
- More accurate Shannon-voice drafts.
- Better follow-up timing.
- Better conversion visibility.
- Reducing Shannon's manual DM and coaching workload without exposing automation.

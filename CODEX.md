# Balance Codex Operating Brief

This file is the durable handoff context for Codex sessions. Read it at the start of a new chat before making strategy or code decisions.

## Who You Are Working With

- User: Shannon, solo operator on the Gold Coast, Australia.
- Shannon is 34 as of 2026 and lives in Tugun on the southern Gold Coast.
- Shannon's pet detail is a free-roam rabbit named Sunshine. Do not describe it as any other pet.
- Background: grew up around Tamborine Mountain, lifelong vegetarian from Seventh-day Adventist family heritage, heavy freestyle BMX until breaking both knees, Bachelor of Exercise Science, moved to Melbourne, became a PT, owned a studio in Hampton for 8 years, sold the gym, moved back to Queensland.
- Shannon is not actively coaching/training in the old PT-studio way anymore. The mission is to build the app and then build the AI/operator layer that runs the business.
- Tone: casual, direct, pragmatic. No corporate fluff.
- Shannon wants Codex to act like a business/build coach, not a passive Q&A bot.
- Default session mode: give a short morning briefing with 2-4 prioritized items from the business plan and recent repo activity. Do not start with "what would you like to do?"
- Shannon explicitly wants help building a business that makes money, and eventually wants the AI/system to run the business while he supervises.

## Product And Business

- App name: Balance.
- Use singular "Balance", not "Balances" and not the legacy codename.
- Public app store name: Balance - Fitness Gamified.
- Parent brand/domain: plantbased-balance.org.
- Native bundle ID still uses the old `com.fitgotchi.app` codename. Do not use "FitGotchi" in user-facing copy.
- Logo asset: `balance_logo.png`, Japanese kanji wa/harmony.
- Facebook Pixel: `1928402271406692`.
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

Critical: the in-app 30-day onboarding sequence is not the main conversion mechanism. DMs are.

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
- Approved public-facing framing: "weekly check-ins with Shannon", "Shannon in your corner", "ongoing support".
- No em dashes in user-facing copy. Use commas, periods, colons, parentheses, or rewrite.
- Auto-send is off by default for new clients. Turn it on per client only after enough voice-match confidence.
- Shannon's coaching voice varies by gender and individual. The system must observe Shannon's actual sent messages before trusting automation.
- Push directly to `main` when shipping. No PR ceremony unless Shannon explicitly asks. Treat pushing `main` for Netlify deploy as the default ship path.
- Before editing in this repo, run `git fetch origin main`, check `git status`, and ensure local files are current.
- Never revert Shannon's existing local changes without explicit permission.
- When editing from a worktree, edit only inside that worktree, not through a parent project path.
- When building or editing a client's workout program, verify in the UI with a calendar/Cycle tab screenshot. Correct DB rows do not guarantee the workout renders.
- If creating a user-facing feature, update both feature discovery systems in `dashboard.html`: `allFeatures` and `steps`.
- If shipping a user-facing feature or meaningful feature change, use a fresh `allFeatures.id` so returning users see the Feature Drop slide/pop-up on next login.

## Repo And Architecture

- Stack: vanilla JS + Supabase PWA, Capacitor wrapper for Android/iOS, Netlify hosting and functions, Vertex AI fine-tuned Shannon voice model for drafts, Gemini for extraction/fallback.
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
- Important globals: `window.currentUser`, `completedWorkoutDataForShare`.
- Important localStorage flags: `pbb_seen_features`, `featureTourComplete`.
- Realtime channels are used for live multiplayer, battles, and group chat.

## Code Landmarks

- `dashboard.html`: main app shell. Important searches: `finishWorkout`, `showWorkoutSuccessScreen`, `gatherUserContext`, `checkAndShowMoodCheckinCard`, `submitMoodCheckin`, `renderEnergyBalance`, `awardWorkoutSharePoint`, `NEW FEATURE REVEAL`, `GUIDED FEATURE TOUR`.
- `lib/supabase.js`: DB helper namespace, including `dbHelpers.*`.
- `lib/stories.js`: feed system, including `loadPhotoFeed` and `openFeedPostViewer`.
- `lib/learning-inline.js`: quiz battle and mascot learning system.
- `js/dashboard/pbb-deferred-battle.js`: character color application. Be careful with material-name allowlists.
- `js/dashboard/dashboard-script-13.js`: stub character functions.
- `netlify/functions/_lib/client-context.js`: shared helper used by coach-draft producers.
- `netlify/edge-functions/admin-ai-coach.ts`: admin dashboard AI assistant.
- `android/app/src/main/java/com/fitgotchi/app/`: native Android push and inline reply code.

## AI Coach Pipeline

Two major message paths share the approval-gate pattern:

- In-app client DM -> `nudges` insert -> DB trigger -> `instant-coach-draft.js` -> `coach_alerts` -> data-only FCM -> Android inline reply -> `send-coach-reply.js`.
- Instagram/ManyChat inbound -> `manychat-inbound.js` -> `ig-instant-draft.js` -> `coach_alerts` with `data.channel='instagram'` -> same approval push -> `send-coach-reply.js` routes to `send-ig-reply.js`.
- PB celebration path starts from `pb_history` insert and uses the same approval shape.

Key rule: `coach_draft_ready` push must be data-only FCM. Do not add a top-level notification field or Android inline reply can be bypassed.

IG cold leads can have `client_id = NULL` on `coach_alerts`. Use LEFT JOINs and channel/thread data where needed.

Voice match feedback loop:

- Sent untouched: `status='sent'`, `data.sent_message`, `data.was_edited=false`. Counts numerator and denominator.
- Edited then sent: `status='sent'`, `data.sent_message`, `data.was_edited=true`. Counts denominator only.
- Auto-send: `status='sent'`, `data.sent_via='auto_send'`, `data.was_edited=false`. Counts numerator and denominator.
- Dismissed: `status='dismissed'`, optional `data.dismiss_reason`. Counts denominator only.
- Score is sent-as-drafted divided by sent plus dismissed, rolling 30 days, bucketed overall, per alert type, and per client.

Auto-send:

- `client_memory.auto_send_enabled BOOLEAN DEFAULT FALSE`.
- Shared helper: `maybeAutoSendDraft(...)` in `netlify/functions/_lib/client-context.js`.
- When enabled, draft producers can skip the approve-gate, insert the DM, mark alert sent, and send Shannon a low-key confirmation push.
- IG cold leads should never auto-send.

Memory extractor:

- Triggered when `coach_alerts` moves pending to sent for relevant alert types.
- Function: `extract-client-memory.js`.
- Uses Gemini Flash-style structured extraction, not the Shannon voice draft model.
- Appends dated running notes and updates goals/style/injuries/personal context.
- Known issue: it can occasionally capture Shannon's own side as if it were a client fact, especially in early exchanges. Audit new-client notes.

## Database Notes

- Supabase project ID: `hzapaorxqboevxnumxkv`.
- Supabase URL: `https://hzapaorxqboevxnumxkv.supabase.co`.
- Service role keys and other secrets must never be committed.
- Workout table is `public.workouts`, not `workout_log`.
- `finishWorkout()` saves one row per set/exercise, so workout triggers need first-row-in-batch filtering.
- `exec_sql(sql)` and `exec_sql_json(sql)` RPCs exist for direct Supabase SQL. Do not ask Shannon to open the SQL editor.
- `exec_sql_json` does not tolerate trailing semicolons.
- Updated-at trigger helper is `public.update_updated_at_column()`, not `handle_updated_at`.
- Do not commit service role keys or secrets to this file.

Important tables:

- `users`: all users, including `coin_balance`, `is_test_account`, cycle preferences, etc.
- `coach_clients`: coach/client assignment and status.
- `coach_alerts`: central action feed for Shannon. Includes status, alert type, suggested message, action data.
- `client_memory`: per coach/client relationship memory, communication style, notes, injuries, auto-send.
- `nudges`: in-app DMs.
- `ig_threads`: Instagram/ManyChat lead threads, stage, linked user, custom data.
- `ig_messages`: IG message history.
- `workouts`: canonical workout log, one row per set/exercise.
- `pb_history`: personal best events and PB celebration trigger source.
- `mood_logs`, `stories`, `quiz_battles`, `coin_transactions`, `meal_plans`, `challenges`, `challenge_participants`: major product systems.

Important RPCs/functions:

- `exec_sql(sql)`, `exec_sql_json(sql)`.
- `credit_coins`, `debit_coins`, `get_coin_balance`, `settle_battle_bet`.
- `create_quiz_battle`, `join_quiz_battle`, `submit_quiz_battle_result`.
- `get_extended_referral_network`.
- `update_updated_at_column`.

Important triggers:

- `trigger_instant_coach_draft` on `nudges`.
- `trigger_pb_celebration_draft` on `pb_history`.
- `trigger_extract_client_memory` on `coach_alerts` pending to sent.
- `trigger_coach_clients_onboarding_welcome` on active `coach_clients` insert.
- `trigger_first_workout_celebration` on first workout batch row.
- `trigger_nudge_push_notification`, older trigger, early-returns when receiver is admin.

## Scheduled Functions

- `ai-client-monitor`: every 2 hours, proactive coaching ideas and wins.
- `morning-pulse-scan`: daily around 05:17 AEST, proactive morning drafts for up to 10 clients.
- `onboarding-scheduled-scan`: hourly, day 3/7/14/30 onboarding milestones.
- `weekly-coach-digest`: Sunday UTC schedule, Monday morning AEST planning report.
- `weekly-checkin-scan`: Monday UTC schedule, Tuesday morning AEST client-facing weekly check-ins for post-day-30 clients.
- `plateau-detection-scan`: weekly, catches weight/strength stalls post-day-30.
- `send-meal-reminders`, `sync-fitbit-data`, `sync-wearable-data`: reminders and wearable sync.

Morning pulse priority signals:

- High: missed scheduled workout, 5+ day streak broken, challenge versus Shannon.
- Medium: low mood trend, quiet client, active challenge solo.
- Low: cycle check-in, strong momentum.
- Skip test accounts, clients with pending alerts, and clients already pulsed in the last 20 hours.

Plateau detection only applies post-day-30. It should open a reassessment conversation, not prescribe a fix.

Onboarding:

- Day 0 welcome is event-driven from `coach_clients` insert.
- First 72 hours: onboarding mode in instant drafts. If client reply count is under 3, do not pitch.
- Three or more client replies can allow one soft Health-IQ quiz challenge pitch.
- Day 3/7/14/30 are scheduled milestones.

## Admin Dashboard Landmarks

- `loadAlerts()` reloads alert feeds.
- `renderAlertCard()` controls alert card display.
- `updateVoiceMatchRate()` and `_voiceMatchBreakdown` power voice-match metrics.
- `renderMyClients()` renders client cards.
- `openClientMemoryModal`, `saveClientMemory`, and `_renderAutoSendToggle()` manage memory and auto-send settings.
- Extend `ALERT_TYPE_LABELS` and `ALERT_TYPE_ICONS` when adding alert types.

Admin AI coach:

- `netlify/edge-functions/admin-ai-coach.ts`.
- Model chain has used Gemini Pro-style fallbacks.
- Tools include read-only Supabase query via `exec_sql_json`, describe table, read/list/search repo files.
- Frontend expects `{ reply }`, with optional `toolCalls` and `modelUsed`.
- Preserved trigger phrases include `___FETCH_USER:Name___`, `___BATCH_REPLY_MESSAGES___`, and `___BATCH_SEND_CHECKINS___`.

## ManyChat And Instagram

- ManyChat inbound lands in `manychat-inbound.js`.
- Required env vars include `MANYCHAT_API_TOKEN`, optional `MANYCHAT_WEBHOOK_SECRET`, `MANYCHAT_SEND_URL`, and `MANYCHAT_MESSAGE_TAG`.
- Default send endpoint has been ManyChat `/fb/sending/sendContent` with `HUMAN_AGENT`.
- 24-hour IG messaging window applies. Human-agent tag can extend but Meta may still reject if the lead has not messaged recently.
- First captured message from a lead often has no visible context because Shannon has already commented on or replied to their story/post natively, outside ManyChat. Treat empty IG/FB history as an unseen Shannon opener, not as the lead initiating cold. The AI should build rapport from whatever signal exists, ask one light human question, and avoid intake/pitch unless they clearly ask about the challenge or link.
- Lead stages: `new`, `qualifying`, `invited`, `in_app`, `churned`, and newer paid/accepted states may exist in migrations.
- Ad quick replies have included:
  - "What's actually included?"
  - "Do I need to already be Plant Based?"
  - "I'm In - save me a spot!"
- If ad quick replies change, update `META_AD_FUNNEL_CONTEXT` in `ig-instant-draft.js`.
- "I'm In" qualifier asks: name/age, main goal, what has tripped them up before, then "ill get back to you asap" in deliberately casual lowercase.

## Android Native

- `CoachDraftMessagingService.java` intercepts `type='coach_draft_ready'` and builds MessagingStyle inline reply.
- `CoachReplyReceiver.java` extracts RemoteInput and posts to `send-coach-reply.js`.
- `AndroidManifest.xml` uses `tools:node="remove"` on Capacitor's default messaging service so the custom service wins.
- Native code changes require APK/AAB rebuild and install. Server/web changes deploy through Netlify after pushing main.
- iOS push is not configured. iOS users get in-app indicators only.
- `send-coach-reply` trusts `alertId` as a one-use capability token. Treat that route carefully.

## Known Landmines

- Data-only FCM is mandatory for coach draft ready pushes.
- `client_id = NULL` for IG cold lead alerts.
- Test accounts use `users.is_test_account`; proactive generators should filter them.
- `exec_sql_json` hates trailing semicolons.
- Character color evolution material names are risky. Do not expand allowlists without dumping real GLB material names at runtime.
- Pre-existing clients do not get retroactive day-0 welcome. They rely on scheduled day 3/7/14/30 scans.
- Auto-send confirmation push uses `type='auto_sent_confirmation'` and should not trigger RemoteInput.
- Memory extractor can capture Shannon's side as client facts.
- Onboarding pitch counter: under 3 client replies means no pitch; 3 or more allows one soft pitch only.

## Recent Context

As of the Codex handoff, recent mainline work included:

- Admin DMs Discarded tab.
- Urgent alert threshold adjusted to fit the 7-day IG/FB window.
- Admin measurable parameters tab.
- IG Leads per-lead voice match accuracy and auto-send toggle.
- Control Center real send/schedule errors.
- Qualifier funnel improvements for smoother conversational discovery.
- Startup unread sync from `nudges` and `ig_threads`.
- Codex added `CODEX.md` and fixed admin DM edited-message sync so sent/scheduled cards prefer actual edited text.

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

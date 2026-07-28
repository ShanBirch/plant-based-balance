# Balance Codex Operating Brief

This file is the durable handoff context for Codex sessions. Read it at the start of a new chat before making strategy or code decisions.

## Who You Are Working With

- User: Shannon, solo operator on the Gold Coast, Australia.
- Shannon is 34 as of 2026 and lives in Tugun on the southern Gold Coast.
- Shannon's pet detail is a free-roam rabbit named Sunshine. Do not describe it as any other pet.
- Background: grew up around Tamborine Mountain, vegan for five years, heavy freestyle BMX until breaking both knees, Bachelor of Exercise Science, moved to Melbourne, became a PT, owned a studio in Hampton for 8 years, sold the gym, moved back to Queensland.
- Shannon is not actively coaching/training in the old PT-studio way anymore. Balance is already built, live, and published; the mission now is to grow the business and build the AI/operator layer that runs it.
- Tone: casual, direct, pragmatic. No corporate fluff.
- Shannon wants Codex to act like a business/build coach, not a passive Q&A bot.
- Default session mode: give a short morning briefing with 2-4 prioritized items from the business plan and recent repo activity. Do not start with "what would you like to do?"
- Shannon explicitly wants help building a business that makes money, and eventually wants the AI/system to run the business while he supervises.

## Product And Business

- App name: Balance.
- Use singular "Balance", not "Balances" and not the legacy codename.
- Public app store name: Balance: Plant-Based Fitness.
- Parent brand/domain: plantbased-balance.org.
- Native bundle ID still uses the old `com.fitgotchi.app` codename. Do not use "FitGotchi" in user-facing copy.
- Logo asset: `balance_logo.png`, Japanese kanji wa/harmony.
- Default video logo treatment: whenever the Balance logo appears in a video or Reel, animate a tasteful gold glimmer sweep over it unless Shannon explicitly asks for a different treatment.
- Facebook Pixel: `1928402271406692`.
- Pricing:
  - Balance Plant-Based Fitness Founders Pass: AUD $99 once. Six weeks of one-to-one in-app coaching support from Shannon for questions, direction and accountability, plus lifetime access to the core Balance app and plant-based community. This is real personal coaching support, not an app-only product. Instant daily replies, unlimited access and fully customised weekly plan reviews are not included.
  - Balance App + Community: AUD $19.99/month for self-directed ongoing app/community access, tailored workout structure and Weekly Goals, without weekly one-to-one review.
  - Balance Starter Coaching: AUD $29.99/week for one weekly check-in plus workout and food review/adjustments from Shannon.
  - Balance Coaching + Calls: AUD $99.99/week for Starter Coaching plus one weekly live call and deeper review.
  - Route by fit instead of forcing the Founders Pass: guided kickstart/reset -> Founders Pass; self-directed app/community -> App + Community; personalised weekly review/adjustments -> Starter Coaching; regular live calls/deeper support -> Coaching + Calls. Use `https://plantbased-balance.org/coaching.html` for recurring-plan comparison and checkout.

## Strategy

The app is built. The business goal is a mostly automated acquisition and coaching machine.

Client/prospect-facing language must reflect this: do not say Shannon is "building Balance", "working on the app", or "still building it" in a way that makes the app sound unfinished. Safe phrasing is "I built Balance", "Balance is my app", "I run Balance", or "I'm improving the coaching/business systems around it".

The real funnel:

1. Instagram/Facebook outreach, content, referrals, or ads create a conversation.
2. Lead lands in IG/FB DMs with Shannon.
3. The DM flow builds rapport, identifies the live goal/blocker, and qualifies fit without interrogating.
4. When earned, offer the Balance Plant-Based Fitness Founders Pass at AUD $99 once and complete the sale through DMs.
5. Send the Founders Pass details/checkout link in the DM when they ask or accept. Do not require a call.
6. Offer a short call only when the lead explicitly wants to talk, remains genuinely uncertain after a clear DM explanation, or the situation needs Shannon's judgement. The call is an escalation lane, not the default close.
7. If they explicitly want Shannon personally reviewing and adjusting their plan each week, offer Starter Coaching at $29.99/week as the optional upgrade.

Critical: Balance no longer uses a free 30-day challenge as its acquisition or conversion path. DMs are the primary sales surface, and the Plant-Based Fitness Founders Pass is the primary offer. Starter Coaching is the optional higher-touch upgrade.

Shannon is currently running a live six-week Balance challenge. Keep its participant experience, daily proof, recap, and challenge Story automations active. It is current client/community delivery and social proof, not the default lead-acquisition offer. Do not confuse it with the retired free 30-day funnel or invite unlinked leads into it as the normal DM close.

Canonical Plant-Based Fitness Founders Pass signup path:

1. Explain the fit and AUD $99 one-time offer inside the DM. Be clear that six weeks of in-app coaching support from Shannon are included, while ongoing individual weekly plan reviews and adjustments after the kickstart are separate.
2. When the lead asks for details, accepts, or says they are ready, send `https://plantbased-balance.org/plant-based-fitness.html`.
3. The branded Founders Pass page gives a clear offer summary and starts a Stripe-hosted one-time Checkout Session after legal acceptance.
4. Stripe webhook-backed payment is the sale; then onboarding continues through Balance.

Do not send a raw, temporary Stripe Checkout Session URL in DMs. The stable branded Founders Pass URL keeps the offer understandable, preserves legal/attribution handling, and then hands payment to Stripe securely.

Current paid-acquisition positioning test:

- Keep `acquisition_mode` separate from offer positioning. `paid_meta` means the thread has verified Meta attribution and may use the direct paid conversation contract. `organic_follower`, `organic_outreach`, and `organic_inbound` use the slower statement-led relationship contract. `existing_client` remains a separate client lane.
- Keep two distinct end-to-end acquisition flows. `plant_based_control` uses plant-based positioning from ad through landing page and DM handoff. `broad_pain` uses general fitness, restarting, follow-through and real-life scheduling language with no plant-based positioning in the ad, landing page or route-specific DM handoff.
- Only verified `paid_meta` threads may enter the `broad_pain` experiment. Never infer the broad route for an organic follower or outreach lead merely because they mention work, kids, busyness, consistency, follow-through or starting again. Organic leads use the canonical plant-based Founders Pass route.
- Paid Meta leads knowingly entered a commercial conversation, so answer offer, price, inclusions, fit and starting questions directly from the first reply and preserve that contract throughout the thread. Organic conversations begin from the exact human context, use statement-led elicitation, and bridge only from the lead's own goal, blocker, help signal or explicit request.
- The broad route uses `https://future-balance.netlify.app/fitness-coaching.html` so the visible destination does not inject the plant-based domain into that test. The plant-based route continues to use `https://plantbased-balance.org/plant-based-fitness.html`.
- Do not blend the two routes based only on a later generic message. Preserve the Meta ad referral variant and attribution through checkout and purchase. Configure broad creative IDs in `META_BROAD_AD_IDS` when the reviewed broad ads are created.
- This is a positioning experiment, not a permanent company rebrand. Keep the current plant-based site and domain live while the data is collected.

Revenue operating loop:

- Miranda (`miranda_laree_is_me`) is no longer an active Balance app client as of 2026-07-28. She was a non-paying client and stepped away after recognising that the long-running points/competition loop was consuming too much attention, increasing stress, and costing sleep. She wants her focus on workouts, meal prep, and rest. The competing app also removes concrete friction for her by retaining workout history, connecting Apple Watch heart rate/calorie burn to her established calorie tracker, and using pounds without workout-time conversions. Treat her as a former-client win-back relationship, never as an active app user or current challenge participant. Keep her explicit manager-reviewed Instagram reply flags and keep her in the 24-hour browser dispatcher's client-community support lane via `custom_data.client_community_support_enabled=true`, even though `coach_clients.status` is ended. Public/Story touches stay warm, specific, question-free, and non-commercial. Do not use inactivity check-ins, badge/XP/challenge prompts, guilt, urgency, or argue with her reason for leaving. The current win-back move is support and listening; invite her back only after a genuinely relevant product/setup improvement can be stated truthfully and framed around workouts, food, rest, low pressure, and her autonomy.

- The Warm Lead Money Queue is the exact commercial worklist inside `ig_next_actions`; it is not a second inbox and never authorizes a blind send.
- Conversation warmth and commercial readiness are separate. Use `qualifier.commercial_stage` for revenue routing: `engaged` (rapport only), `problem_qualified` (relevant personal goal plus blocker), `offer_ready` (acknowledged wanting help/structure/accountability), and `buyer_intent` (explicit price, details, link, signup, start, join, or sales-call request).
- A high reply count, Story engagement, enthusiasm, professional curiosity, or a generic use of words such as coaching/start/call does not create buyer intent. Only `problem_qualified`, `offer_ready`, and `buyer_intent` may enter the Money Queue, and every operator must re-read the live thread before progressing it.
- The single scheduled Instagram Chrome operator is the 24-hour browser shift dispatcher. Its watchdog wakes every 15 minutes, but only the renewable dispatcher lease owner works, for at most one 30-minute shift. A dispatcher wake that finds a healthy active lease immediately exits without opening Chrome, closing the active run, or altering its ledger. Each owned shift works one persistent lane task instead of restarting the full checklist or rolling through all eight lanes. Technical interruptions, uncertain actions, and browser failures resume the same lane first. A normal feed-comment work slice instead ends at 20 verified comments or minute 25, whichever comes first, saves its exact feed cursor, and advances rotation; feed resumes from that cursor when its normal slot returns. The worker reserves five minutes for reconciliation and clean Chrome release and claims one person at a time. Its replaced dedicated Instagram Chrome jobs remain paused so scheduled dispatcher ownership never overlaps. This lease coordinates dispatcher wakes only; it is not a global lock on browser use by other Codex chats.
- The API-based `Balance Lead + Client DM Manager` is a separate 24-hour worker that wakes every 10 minutes. The webhook/`ig-instant-draft` pipeline creates the first draft immediately, then the manager re-reads the full live thread, repairs or approves the draft, sends/schedules normal unlinked-lead replies, and verifies canonical readback. Two AI-coach fast lanes may schedule for four minutes later after a clean safety/context/draft-review pass: every reply in a thread with verified Meta `ADS` attribution, and a current or active recent conversation clearly discussing exercise or training. The scheduled `client-lead-manager` also runs every ten minutes as a conservative availability fallback: it may claim the exact `dm_manager` controller row and schedule a normal unlinked-lead text reply for four minutes later only when the saved draft has a clean passing review and there is no warning, URL, voice/media, missing context, support issue, sales/call/buyer-intent moment, manual flag, or linked-client identity. It parks that controller beyond the scheduled send window so the local manager cannot race it; the scheduled worker still performs live identity, stale-thread, and no-double-send checks. A warning is not a pass; warnings and all context, media, identity, commercial-decision, current-client, or safety holds remain pending for the manager. Current clients normally receive a generated draft in Needs You and no automated schedule/send. Miranda (`miranda_laree_is_me`) is the narrow exception: while her live linked IG thread has both `custom_data.client_manager_auto_reply_enabled=true` and `custom_data.client_manager_browser_dispatch_enabled=true`, the manager may review normal understood text replies. Inside Meta's 24-hour API window it sends with source `balance_lead_client_manager_cron`. Outside that window it atomically transfers the exact `reply_inbound` controller row from `dm_manager` to `browser_dispatcher`; the browser dispatcher re-reads the native thread, sends the approved text once, verifies native/canonical readback, and returns any later inbound to the API manager. The AI-coach scheduler and scheduled worker remain blocked, and safety, authenticity, incomplete-media, app-fix verification, personal-boundary, duplicate, and transport holds still apply. One controller owner holds Miranda at a time, so the two managers never create parallel replies. It also owns current-client draft/support routing, checkout readback, and hard-hold routing. It stops claiming new work after minute seven, reconciles and releases its own lock by minute nine, and uses a 15-minute crash-recovery lease. Its local file lock is never shared with the browser dispatcher.
- Each owned shift may complete up to 20 verified native Instagram interactions in its current lane task. Productive Story-reply and public-comment lanes work toward 10 to 20 genuine actions, while plant-based discovery-follow shifts work toward 20 eligible follows. Boundary-driven follower, notification, missed-DM, and client lanes clear their eligible live boundary up to the same ceiling without manufacturing volume. DMs, Story replies, public comments/replies, reactions, follows, and likes each count as one. Profile checks, Story views, skips, queue updates, and cursor work do not count. Startup and pre-action checks deduplicate canonical action IDs for the shift. Twenty is a hard ceiling, never permission to force a weak action, and per-person cooldowns, duplicate prevention, context gates, acquisition capacity, and native restrictions still apply.
- `ig_browser_shift_runs` is the dispatcher-level source of truth. Acquire the chosen lane with `start_ig_browser_shift(..., 600)` before acting, resume from the returned lane cursor, and checkpoint with `heartbeat_ig_browser_shift(..., lease_seconds=600)` after every inspected person or attempted native action and at least every five minutes during read-only work. Technical interruption or uncertain-action handoffs finalize `partial` with an exact same-lane `next_resume`. A normal feed work-slice boundary finalizes `completed` with `slice_complete=true`, its exact feed cursor in `cursor_end`, and cross-lane `next_resume` to external comments/mentions even if `full_cycle_complete=false`. Other lanes retain their stated live-boundary completion rules. Never treat a zero-row saved queue claim as completion. `blocked` requires native restriction evidence. A run that receives `acquired=false` does no Instagram work; an abandoned owner can be replaced only after its renewable lease expires.
- No single Chrome connection, navigation, snapshot, or recovery attempt may consume more than 60 seconds. After two reconnection attempts or two minutes total, finalize the lane as `partial` with `browser_connection_retry`, release any provably unattempted queue claim, release Chrome, and exit. Never leave the automation process alive waiting for Chrome after its database lease expires.
- Follower notification work is one atomic low-volume dispatcher pass: claim due deferred welcomes first, then scan from the saved cursor, qualify each new follower/follow-back, claim or create `follower_operator` / `welcome_follower`, and welcome once when eligible with canonical readback. A valid discovery follow or other touch less than 24 hours old is deferred with `safe_after=touch+24 hours`; it is not permanently cancelled. Discovery following remains separate and never triggers an immediate automatic DM.
- Ranked Story nurturing works toward 10 to 20 verified replies per shift, with 20 as the hard ceiling. Rank the next-best eligible relationship, then visit that person's current profile and check for a presently visible Story. The person is durable; an exact Story URL from a prior run is not. Cancel expired frame actions and create the fresh visible exact-frame action with `p_supersede=true`. Do not use the broad tray to fill the ranked target.
- Story-tray discovery works forward from a durable tray cursor toward 10 to 20 verified replies per shift, with 20 as the hard ceiling. It assesses one owner and one exact paused frame at a time, creates or claims `story_operator` / `story_reply` with `p_supersede=true`, skips active conversations, clients, recent touches, duplicates, weak hooks, unclear or sensitive context, and records `source=story_tray_discovery`, new-versus-known lead, Story context, native/canonical IDs, and the next cursor. Story replies remain rapport-first and never contain a blind pitch or link. Exact Story frames are terminal after inspection and never become claimable merely because a cooldown timestamp elapsed.
- Story discovery is inbound-first. If a viewed Story owner has a latest Direct message that Shannon has not answered, do not send a Story reply. Check the native Direct thread and the canonical latest message, then call `prioritize_story_viewer_unanswered_inbound` with the exact thread/message/run IDs. It atomically replaces stale proactive ownership with an urgent `dm_manager` reply action, preserves a live DM-manager claim plus manual, suppression, `needs_you`, and safety holds, and never makes the browser a parallel conversational sender. Checkpoint the Story cursor and continue only after recording the handoff outcome; the DM manager performs the full-thread review and reply.
- The legacy `hot_lead_feed_nurture` lane name represents one durable full lead list, ordered hot, warm, cold, then unscored-as-cold, with an exact target and hard ceiling of 20 verified public comments per owned shift. Load at most 25 people at a time through `get_ig_feed_nurture_batch`, using tier rank, warmth score, and thread id as the durable cursor. Work every person in order and fetch the next batch while time remains. The current feed work slice ends at 20 comments or minute 25, saves its exact cursor, and rotates; the next feed slot resumes there. Normal no-post/no-hook skips advance immediately with no timed cooldown and cannot be revisited until the next full cycle; browser failure keeps the cursor on that person for retry. Only a zero-row batch after the saved cursor proves `full_cycle_complete=true`. This lane is public-comment-only: never click Like and never use a like-only fallback. Only a verified specific comment receives the rolling seven-day duplicate gate.
- Reciprocal engagement creates one delayed cross-surface nurture opportunity. A genuine reply to Shannon's comment on someone else's post can queue a named-profile Story check after at least 24 hours; a genuine reply to Shannon's Story message can queue a newest-safe-post feed check after the unanswered DM batch is resolved and at least 24 hours have passed. These use `p_supersede=false`, never replace DM/manual/sales/support ownership, and persist a pending `cross_surface_nurture` marker when the single action row is occupied. The later operator still needs a natural hook, never touches the person again in the triggering shift, and allows at most one reciprocal cross-surface touch per person per rolling seven days.
- Fresh inbound intent comes first, then call requests, checkout/close actions, and one due offer/checkout follow-up after at least 24 hours with no reply.
- Treat a checkout link as priority immediately, but do not chase the person after 15 minutes. From 15 minutes after a verified checkout-link send, the DM manager may run a read-only checkout watch: reconcile fresh reply, Stripe-backed payment, account creation/onboarding evidence, delivery errors, and app/access support. It sends nothing merely because the person has not bought yet. If there is no reply or payment, the existing single contextual checkout follow-up becomes eligible only after 24 hours and remains ahead of normal nurture/acquisition work.
- A general warm label alone is not a follow-up trigger. Proactive follow-up requires an explicit milestone: commitment reached, Founders Pass pitched, or checkout sent.
- `growth_outcome_events` records engaged, problem-qualified, offer-ready, buyer-intent, pitched, checkout, call, and paid milestones so the admin scorecard measures the DM-to-revenue path.
- The active `Balance Daily Lead Movement Brief` runs read-only at 06:05 Australia/Brisbane. It compares completed Brisbane days, names genuine stage movers and stalled revenue opportunities, ranks at most five next actions, groups verified movement by acquisition source, and flags missing stage or attribution receipts instead of presenting incomplete tracking as a true zero.
- Proactive Story/feed/discovery volume adapts to due revenue work: 0-5 money actions = normal, 6-15 = half volume, and 16+ = pause acquisition. Fresh replies, support, and client work are never paused by this gate.

Current strategic priority: build the AI-operated business layer around Balance:

- Instagram Graph lead capture, with ManyChat kept only as a temporary legacy/Facebook Messenger backstop.
- Conversational lead qualification.
- Admin lead inbox and stages.
- AI-drafted replies in Shannon's voice.
- Approval workflow first, per-client auto-send later.
- Coaching alerts, check-ins, celebrations, plateau prompts, and conversion prompts.
- Control metrics for acquisition, activation, conversion, retention, and reply quality.

## Non-Negotiables

- The 24-hour Instagram browser shift dispatcher's lease coordinates dispatcher instances only. Other Codex chats may use browser automation concurrently without checking or waiting for that lease. Use the chat's own browser binding and tab, and do not deliberately claim, navigate, close, recover, or otherwise disturb the dispatcher's active Instagram tab or alter its run ledger. Shannon's direct instruction that he is personally using a specific tab or browser remains a reason not to disturb that exact surface.
- Never reveal AI to clients or prospects. Public copy must not mention AI, automation, Gemini, Vertex, models, smart coaching, or "trained on Shannon's voice".
- The Balance AI coach pipeline creates the first draft for every lead and client message. The API manager owns deep final review and delivery for normal unlinked-lead replies, with full-thread readback and no-double-send reconciliation. Every reply in an unlinked thread with verified Meta `ADS` attribution may be auto-scheduled by the AI-coach pipeline for four minutes later after a clean review; the manager reconciles it but never sends a parallel reply. If the local API manager is unavailable, `client-lead-manager` may use the narrowly gated clean-text fallback above after atomically claiming the same controller row; it is an availability path, not permission to make sales, support, media, voice, identity, or client decisions. Only the actual first ad inbound uses the deterministic ad opener, while all later replies use the full conversation-aware generator. Shannon should not receive lead handoffs for ordinary draft/style judgment calls; explicit safety, authenticity, transport, or unrecoverable-media holds still route to Needs You. Current clients are approval-only unless a live thread carries Shannon's explicit `client_manager_auto_reply_enabled=true` exception. The only current exception is Miranda's linked IG thread. It authorizes direct API-manager delivery inside 24 hours and, only with the separate live `client_manager_browser_dispatch_enabled=true` flag, one atomic native browser-dispatch fallback outside 24 hours. It never authorizes AI-coach scheduling or scheduled-worker delivery. Re-read live `ig_threads.linked_user_id` and `custom_data` immediately before either transport so stale identity or permission cannot bypass the boundary.
- When the API manager makes a final text decision, send through `send-coach-reply` with `forceText=true` (or `deliveryMode='text'`). This overrides any stale `outbound_voice_message=true` suggestion on the alert so a reviewed text reply cannot accidentally enter synthetic voice generation.
- Position the service as personal coaching from Shannon.
- Approved public-facing framing: "weekly check-ins with Shannon", "Shannon in your corner", "ongoing support".
- No em dashes in user-facing copy. Use commas, periods, colons, parentheses, or rewrite.
- Automated replies are off for every current client except Miranda's explicit manager-owned linked-IG exception. Her normal understood IG text replies may be reviewed by the API manager while the live opt-in is true; delivery uses the API inside 24 hours and the separately flagged browser dispatcher outside 24 hours. All other clients, all in-app client messages, and all scheduled-worker paths remain approval-only. A fixed one-time system onboarding welcome may still be delivered as a product event, but it must not open an automated client conversation.
- Shannon's coaching voice varies by gender and individual. The system must observe Shannon's actual sent messages before trusting automation.
- Push directly to `main` when shipping. No PR ceremony unless Shannon explicitly asks. Treat pushing `main` for Netlify deploy as the default ship path.
- Auto-ship by default after making repo changes: once Codex completes and verifies an edit Shannon asked for, commit the focused change and push it to `origin/main` without waiting for Shannon to say "push". This applies to code, docs, migrations, Netlify functions, app assets, and instruction updates.
- For every Balance web change, do not call the work complete immediately after pushing. Wait for the Netlify production deploy, then fetch the live production page or changed asset and verify it serves the intended new version/content. Report that live check explicitly. If the change is in a cacheable client script, bump its versioned asset URL when needed so Capacitor/iOS loads the change.
- Do not auto-ship only when Shannon explicitly says to hold, draft, review only, do not push, or when the task is purely exploratory with no file changes requested.
- A dirty worktree is not a reason to leave completed Codex work unpushed. Preserve unrelated local changes, stage only the files intentionally changed for the task, and use a clean worktree from `origin/main` if the main checkout is too messy.
- Stop before auto-shipping only for a real blocker: merge conflict needing Shannon's product decision, failed auth, suspected secret/destructive change, failed verification that matters for the change, or uncertainty about which dirty files belong to Codex's current work.
- Do not leave completed work sitting unmerged or only mentioned in chat. If Shannon asks to merge or ship, finish the commit and push to `main` in the same session unless there is a concrete blocker.
- When Shannon says "push", treat that as explicit approval to carefully ship. Do not stop with "the worktree has unrelated dirty changes" or "`main` is behind origin/main" as the final answer. Preserve unrelated local work, stage only the intended files, use a clean worktree when the main workspace is messy, integrate `origin/main` when needed, and push. Only stop for a hard blocker such as auth failure, a conflict that needs Shannon's product decision, or apparent secret/destructive risk.
- If the main workspace is messy but the requested fix is complete and verified, create a clean worktree from `origin/main`, apply only the intended diff there, commit, and push to `main`. Do not make Shannon ask twice just because the local workspace has unrelated changes.
- Never create a worktree inside another worktree. Use the Codex-managed worktree location or an explicit system temp path outside the repository.
- Keep generated previews, renders, test output, downloaded media, and one-off scratch scripts in ignored output folders or the system temp directory. Do not leave them as untracked files in a task worktree.
- After a successful ship, the task worktree must be clean. Do not leave tracked edits, untracked source files, or generated output behind. The daily `scripts/safe-git-housekeeping.ps1` job may remove clean worktrees and local branches only after their commits are in `origin/main` and the grace period has elapsed.
- Before editing in this repo, run `git fetch origin main`, check `git status`, and ensure local files are current.
- Never revert Shannon's existing local changes without explicit permission.
- When editing from a worktree, edit only inside that worktree, not through a parent project path.
- When building or editing a client's workout program, verify in the UI with a calendar/Cycle tab screenshot. Correct DB rows do not guarantee the workout renders.
- When any backend coach action actually changes a client's program, workout schedule, exercises, or other client-facing state, always create a pending Needs You receipt for Shannon in `coach_alerts`, and make sure `admin-dashboard.html` routes that receipt into Needs You.
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
- Instagram Graph inbound -> `instagram-webhook.js` -> `ig-instant-draft.js` -> `coach_alerts` with `data.channel='instagram'` and usually `data.delivery_channel='instagram_graph'` -> same approval push -> `send-coach-reply.js` routes to `send-ig-reply.js`.
- A first inbound carrying a verified Meta `ADS` referral starts a permanent paid-ad fast lane for that unlinked lead thread: persist its ad/referral attribution, run the normal media/context/safety/draft review, and schedule every clean passing reply for four minutes later. Never send instantly. Verified historic Meta attribution deliberately retains fast-lane ownership even after 24 hours or a quiet period. Only the actual first ad inbound uses the deterministic ad-opening reply; later messages use the full conversation-aware draft generator. Separately, any current unlinked-lead inbound, or an exchange active within the last two hours, that clearly discusses exercise or training may use the same four-minute lane after a clean pass. Any reviewer warning or hard hold falls back to the DM manager. Current-client identity overrides ad/exercise attribution at draft, schedule, and worker time. Miranda's live opt-in allows only a manager-reviewed text reply through its window-correct API/native transport, not either fast lane.
- ManyChat inbound still exists as a legacy/backstop path via `manychat-inbound.js`, mainly while old IG threads gain Graph identity and for Facebook Messenger if Shannon keeps it.
- PB celebration path starts from `pb_history` insert and uses the same approval shape.

Key rule: `coach_draft_ready` push must be data-only FCM. Do not add a top-level notification field or Android inline reply can be bypassed.

IG cold leads can have `client_id = NULL` on `coach_alerts`. Use LEFT JOINs and channel/thread data where needed.

Voice match feedback loop:

- Sent untouched: `status='sent'`, `data.sent_message`, `data.was_edited=false`. Counts numerator and denominator.
- Edited then sent: `status='sent'`, `data.sent_message`, `data.was_edited=true`. Counts denominator only.
- Auto-send: `status='sent'`, `data.sent_via='auto_send'`, `data.was_edited=false`. Counts numerator and denominator.
- Dismissed: `status='dismissed'`, optional `data.dismiss_reason`. Counts denominator only.
- Score is sent-as-drafted divided by sent plus dismissed, rolling 30 days, bucketed overall, per alert type, and per client.

Approved ElevenLabs Instagram voice-note recipe:

- Shannon approved the conversational test set created on 2026-07-24 as the reference sound for future generated Instagram DM voice notes.
- Use the professional Shannon voice ID `UHnJrglEof8vTMenwnVm` with `eleven_multilingual_v2`. The five Cocos clips Shannon approved used stability `0.5`, similarity boost `0.75`, style `0`, and speaker boost enabled. Production may keep its transport-required audio format; local previews used `mp3_44100_128`.
- The five approved Cocos scripts were 35 to 46 words and usually landed around 14 to 18 seconds, but duration is not the target. Require at least 34 words so the voice has room to settle; do not enforce a maximum or pad/cut a natural reply to hit a timer.
- Write loose spoken sentences, not Reel copy. The approved scripts each had three to four imperfect thinking beats, such as `um`, `ahh`, `okay`, `yeah`, `honestly`, `anyway`, `alright`, `like`, `you know`, or a small repeated thought. Require at least one genuine `um` or `ah`. Use commas, sentence breaks, or an occasional ellipsis as audible breathing space, and vary placement so notes do not share a template.
- Never write laughter into a generated voice-note script. Ban `haha`, stretched laughter, `ahaha`, `hehe`, `lol`, `lmao`, and any other imitation of a chuckle anywhere in the note. Carry warmth or humour through the wording and cadence instead, and usually open directly on the exact thing the lead said.
- Shape: recognise one exact thing they said, reflect or normalise it, give one useful thought or next step, then stop. Use contractions, commas, short pauses, and occasional fragments. Do not use stage directions, polished presenter phrasing, a list read aloud, or filler in every sentence.
- The approved examples sounded spontaneous because they were specific and slightly imperfect, not because they were packed with verbal filler. Preserve that balance whenever generating a new note.
- For unlinked Instagram leads with a working Graph route, a generated voice note may replace the drafted text after the lead has shared a meaningful personal goal, current situation, or blocker. Require at least two meaningful lead replies and qualifier evidence, and cap this personal touch at one generated voice note per thread every 30 days.
- Never use a generated or cloned voice note to answer an AI, bot, automation, or "is this really Shannon?" authenticity question. Keep the existing Needs You hold, forbid the synthetic send, and recommend that Shannon record a fresh native note. Suggested honest wording: "hey, yep it's Shannon. I do use a bit of help organising my inbox because it gets busy, but the coaching and support inside Balance is me."
- Linked clients remain draft-only Needs You even when a voice note would be useful. Miranda's exception is manager-reviewed text delivery only, through API or native browser dispatch according to the live window; Shannon still decides whether to record and send any voice note. The separate proactive inactivity rule below is text-only and never authorizes an inbound reply or voice note.

DM question discipline:

- Do not ask for a status the client or lead just gave. If they say "just pain when I walk" or "not great", the better Shannon-style reply is usually a short acknowledgement or statement, such as "ahhh that's not good fra", not "how's it feeling today, still pain when you walk?"
- Ask fewer questions overall. Ask one precise question only when the missing answer changes the next coaching, support, or qualified lead step. Otherwise use a statement, short reaction, clear next step, or a simple day/week check-in if Shannon has not already asked it.
- Avoid same-topic question ladders in rapport. If Shannon asks a small food/place/photo/music/work question and they answer with enough texture, usually react to the answer, add a tiny opinion, tease, or pause. Do not immediately ask a sibling version of the same question, like "what did you like most?" then "what surprised you most?", unless the second question opens genuinely new useful context.
- A missing qualifier field is not permission to ask. If the lead says the point is answered, says there is no current blocker/problem, or gives a detailed answer that resolves the live question, clear the proposed next question and use a statement-led acknowledgement or leave space. Never say an answer is sufficient and then ask the same semantic question again.
- Treat phrases such as "hope this answers your question", "everything is good", "nothing is getting in the way", and equivalent question-fatigue signals as a hard stop on automated qualification for that turn. Do not search for a blocker after the lead has said there is not one.
- Treat "are you trying to sell me something?", "is this a pitch?", and equivalent sales-suspicion language as an autonomy hard stop. Answer honestly, acknowledge the concern, and back off with no new fitness question, offer, link, or continuation hook. Keep that hold through later ordinary fitness sharing; answering Shannon's last question does not reopen qualification. Resume only when the lead explicitly asks for help, details, a link, signup, or how to start.
- Do not switch from vegan identity, animal ethics, activism, or other rapport into fitness/food qualification unless the current lead-authored turn contains a relevant fitness, food-structure, consistency, energy, help, support, safety, or buyer-intent signal. After two recent discovery questions, require a statement-led turn plus a fresh relevant lead signal before another question; one acknowledgement does not reset the guard.
- Treat an accusation that Shannon does not sound vegan, is not really vegan, or otherwise contradicts his stated identity as an authenticity challenge for Shannon. Hold automation and route the exact evidence to Needs You even when the lead never says AI or bot.
- An unanswered voice-note batch is complete only when every collected note has durable decode evidence. If any note is missing, keep recovering or route the batch; never ask the lead to resend, repeat, or type the gist.

Auto-send:

- `client_memory.auto_send_enabled BOOLEAN DEFAULT FALSE`.
- Shared helper: `maybeAutoSendDraft(...)` in `netlify/functions/_lib/client-context.js`.
- When enabled, draft producers can skip the approve-gate, insert the DM, mark alert sent, and send Shannon a low-key confirmation push.
- Safe IG/FB unlinked-lead replies are drafted immediately by the Balance AI coach pipeline, then reviewed and delivered by the API manager. Every clean passing reply in a verified Meta `ADS` attributed unlinked-lead thread may use the four-minute AI-coach schedule; the manager reconciles its controller and transport receipts without competing. The ten-minute `client-lead-manager` cloud fallback may also schedule an already clean-reviewed ordinary unlinked-lead text draft under the strict controller and exclusion gates above, preventing local runtime outages from leaving routine replies unanswered. Linked IG/FB clients are draft-only by default. Miranda's doubly flagged thread is the manager-reviewed conversational text exception: API inside 24 hours, atomic `browser_dispatcher` native handoff outside 24 hours. A second narrow exception is proactive client inactivity outreach: the native Instagram browser dispatcher may automatically send the verified 3-day, 7-day, and 14-day check-ins described below without a Needs You card. Neither exception authorizes scheduling through the API worker, synthetic voice, in-app delivery, or weaker safety/readback rules. Other client-facing replies and support completions require Shannon's approval.

Proactive Instagram client inactivity check-ins:

- Current, non-test Balance clients with a uniquely linked Instagram thread may receive at most three native Instagram check-ins for one uninterrupted no-login episode: first after 3 Australia/Brisbane business days, second after 7 business days, and a final open-door close after 14 business days.
- Saturday and Sunday do not advance the inactivity count at all. For example, a Friday login reaches business day 1 on Monday and business day 3 on Wednesday. Later touches also keep at least three business days between verified sends.
- Do not start touch one after business day 7. This prevents a newly enabled or recovered worker from chasing historically dormant clients. A later login creates a new inactivity episode; a reply after any inactivity touch ends the current automated series.
- All three touches send only on weekdays between 8:30am and 6:30pm Brisbane time.
- These are proactive native Instagram DMs owned by the 24-hour browser dispatcher, not Graph API replies and not in-app `nudges`. They bypass Needs You approval only for the exact leased `client_inactivity_checkin` action. Normal client inbounds, coaching, support, media, voice notes, and all other client messages remain under their existing approval rules.
- Before sending, require a current active coaching, paid-membership, or live-challenge relationship; a linked Instagram thread; no unanswered or recent Instagram conversation; no manual/suppression flag; and no competing queue owner. Francesca/Fra and Lara Lessmann remain permanent browser exclusions.
- Each send requires native Sent/composer evidence plus a unique canonical `ig_messages` outbound echo. Complete it through `complete_ig_client_inactivity_checkin` so the exact action and a genuine `conversion_operator_events.action='check_in_done'` receipt are written atomically. Three verified unanswered touches end outreach until the client returns.

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
- `ig_threads`: Instagram Graph / legacy ManyChat lead threads, stage, linked user, custom data.
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

## Support Repair Worker

- Conversational DM work and app/program repair work use separate operators.
- The DM manager should identify a genuine support issue, stamp the source `coach_alerts` row with `data.operator_queue='support_operator'`, `data.support_routed_by`, and `data.support_routed_at`, then leave the repair to the support worker.
- `balance_support_jobs` is the Supabase traffic controller for repairs. `coach_alerts` remains the source message and the final Needs You receipt.
- The support worker calls `refresh_balance_support_jobs`, claims a short lease through `claim_balance_support_jobs`, follows the Balance app-support verification rules, and finishes with `complete_balance_support_job`.
- Never repair a support item without a live claim. Never send around Shannon or another operator. Never claim fixed until the client confirms; the first verified repair remains `fix_attempted_client_confirmation_pending`.

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
- The shared `buildAppNavigationGuideBlock()` prompt grounding in `netlify/functions/_lib/client-context.js` is the canonical concise AI guide for the Founders Pass handoff, signup, onboarding stages, main app tabs, and support truth rules. Keep it aligned with the live onboarding UI whenever navigation or setup changes.

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

## Instagram Graph And ManyChat

- Primary IG capture is direct Meta Graph via `instagram-webhook.js`.
- Primary IG outbound is direct Meta Graph via `send-ig-reply.js` and `send-direct-ig-message.js` when `ig_threads.custom_data.instagram_graph.ig_graph_user_id` or an `ig_graph:` subscriber id exists.
- ManyChat is now a legacy/backstop path. It is still useful for Facebook Messenger and old IG threads that have not yet exposed a Graph recipient id.
- Required Graph env/secrets include `INSTAGRAM_GRAPH_ACCESS_TOKEN` or `app_private_secrets.key='instagram_graph_access_token'`, plus the IG account id env fallback when it is not stored on a thread.
- ManyChat env vars, while the backstop remains active, include `MANYCHAT_API_TOKEN`, optional `MANYCHAT_WEBHOOK_SECRET`, `MANYCHAT_SEND_URL`, and `MANYCHAT_MESSAGE_TAG`.
- 24-hour IG messaging window applies. Human-agent tag can extend to 7 days only when Meta has approved the Human Agent feature; the code gates this behind `INSTAGRAM_GRAPH_HUMAN_AGENT_ENABLED`.
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
8. If Shannon says "push", keep going through fetch/status, selective staging, commit, update from `origin/main` if required, and push. A dirty worktree or a behind local `main` is a caution signal, not a reason to decline the push.
9. If Codex made and verified file changes, auto-ship by default: commit only the intended files and push to `origin/main` unless Shannon explicitly said not to or a real blocker exists.

## Current Business Lens

Do not default to building more consumer app features. The highest-value work is usually:

- Faster lead response.
- Better lead qualification.
- Cleaner admin approval workflows.
- More accurate Shannon-voice drafts.
- Better follow-up timing.
- Better conversion visibility.
- Reducing Shannon's manual DM and coaching workload without exposing automation.

## Measurement Standard

Shannon wants data collected on every meaningful growth, sales, onboarding, and product change from 2026-07-26 onward.

- Before launch, record the hypothesis, variant name, primary KPI, diagnostic metrics, guardrail, and decision date.
- Every campaign destination must preserve first-touch and last-touch attribution with UTMs, Meta click/ad identifiers when available, a durable visitor id, and a session id.
- Every funnel should emit first-party events for the meaningful progression points, not only page views. For paid acquisition this includes landing view, CTA, DM/link handoff, checkout start, purchase, account creation, onboarding start/completion, weekly goals, meal plan, first planned workout, and first completed workout.
- Use stable experiment and event names. Do not change a live definition halfway through a comparison.
- Choose winners using business outcomes and lead quality. Cheap clicks, views, or DMs are diagnostic metrics, not final success metrics.
- No new ad, landing-page variant, checkout path, onboarding change, or automated DM flow is considered ready until its measurement path has been verified.

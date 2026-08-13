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
- Default Balance carousel delivery: render photo-first and editorial carousel slides as playable five-second MP4s using the exact published large bottom-right watermark shimmer, unless Shannon explicitly asks for still-only delivery. Remove the white disc, hold the kanji/ring in quiet black at about 17% opacity, run two 0.65-second diagonal gold passes beginning at 1.20s and 3.55s, return fully to black, composite copy above it, and keep the mark clear of Shannon's face/head. JPGs are posters and review fallbacks, not proof of the shimmer.
- Default avatar-video workflow: create and approve the Shannon voice track in ElevenLabs first, then use HeyGen `precision` lip-sync with an approved reusable Shannon source clip and that audio. HeyGen produces only the presenter layer; never ask it to generate the complete Reel from a prompt. Use normal HeyGen Video/avatar generation only when precision lip-sync cannot produce a usable result, no suitable source clip exists, quality fails, or Shannon explicitly asks for a fresh avatar generation. Build the final Reel separately from the lip-synced presenter, real footage, graphics, captions and music. Follow `C:/Users/shann/.codex/skills/balance-persuasive-reels/references/heygen-precision-lipsync.md` for transport, OAuth handoff, inputs, request, polling, download and QA.
- Shannon's face is protected space in every Reel and video. Never cover or cross his face, mouth, eyes, jawline, hairline, or head silhouette with titles, captions, cards, paper crops, diagrams, CTAs, stickers, or decorative motion. When a graphic needs the frame, use the approved circular presenter bubble pattern instead.
- Shannon's spoken Reel copy should sound like his approved voice notes rather than polished presenter writing. Read `content-lab/SHANNON-SPOKEN-VOICE-BIBLE.md` before any spoken script. Natural contractions are mandatory wherever one exists: write `I'll`, `you're`, `we're`, `it's`, `that's`, `there's`, `don't`, `doesn't`, `isn't`, `can't`, `won't`, `haven't`, and similar forms instead of their expanded equivalents. Exact quotations are the only normal exception. In casual spoken Reel greetings use Shannon's confirmed `How ya going?`, never `How are you going?`. Generated one-to-one DM voice notes should start content-first from the person's newest detail; do not add generic check-in greetings such as `Hey, how are ya.` unless live relationship context provides a specific reason. Across a normal 45–90 second Reel, use four to six imperfect thinking beats, led by a naturally drawn-out `ummm` for genuine wondering or thought-searching, plus punctuation-led pauses, fragments, discourse markers and an occasional restart or self-correction. Do not substitute a relieved `ahh` for that thinking sound. Spread the beats through the script rather than stacking them together or using them to hide missing logic.
- All content-generation and content-automation work must read `content-lab/SHANNON-CONTENT-EDIT-MEMORY.md`. Treat Shannon's explicit edit feedback as a reusable production rule unless he clearly calls it a one-off. Record the feedback, the generalised rule and the affected formats there, then update the relevant skill or automation contract so later batches inherit it.
- All Shannon/Balance science-Reel work must also read `content-lab/SHANNON-SCIENCE-REEL-MASTER-CONTRACT.md`. Keep the research, evidence, production, face-protection and QA standards high while making the spoken voice deliberately raw, direct, uneven and less presenter-like.
- Facebook Pixel: `1928402271406692`.
- Pricing:
  - Balance Foundations Founders Pass: one AUD $89.99 payment for the full six weeks. A fixed six-week Balance Foundations course with six weeks of app/community access, one weekly check-in, and workout and food review/adjustments from Shannon. It does not auto-renew. Do not describe the public offer as `one-off` or merely `$89.99 once`; say `one $89.99 payment for the full six weeks`. The founding price is about 50% of six weeks of Starter Coaching at AUD $179.94. Instant daily replies, unlimited access and live calls are not included. Existing members who purchased the earlier lifetime Founders Pass keep the lifetime entitlement they were promised.
  - Balance App + Community: AUD $19.99/month for self-directed ongoing app/community access, tailored workout structure and Weekly Goals, without weekly one-to-one review.
  - Balance Starter Coaching: AUD $29.99/week for one weekly check-in plus workout and food review/adjustments from Shannon.
- Balance Coaching + Calls: AUD $99.99/week for Starter Coaching plus one weekly live call and deeper review.
- Balance 1:1 Zoom PT is a capacity-limited premium service with live 30-minute sessions, personalised programming, general vegetarian or plant-based food guidance, Balance access, and in-app accountability. Zoom PT 1 is AUD $125/week for one session, Zoom PT 3 is AUD $275/week for three sessions, and Zoom PT 5 is AUD $425/week for five sessions. It begins with a six-week coaching block. Confirm health fit and recurring availability before taking payment; public website CTAs book a fit call rather than opening checkout.
- Route by fit instead of forcing the Founders Pass: structured six-week starting course -> Founders Pass; self-directed ongoing app/community -> App + Community; ongoing personalised weekly progression and review -> Starter Coaching; a weekly conversation/deeper review -> Coaching + Calls; live supervised workouts -> 1:1 Zoom PT. The Founders Pass and Starter both include one weekly review during the first six weeks, but Founders follows the fixed Foundations curriculum and ends after six weeks while Starter continues weekly until cancelled. Use `https://plantbased-balance.org/coaching.html` for package comparison. Zoom PT requires an availability and health-fit check before payment.

## Strategy

The app is built. The business goal is a mostly automated acquisition and coaching machine.

Client/prospect-facing language must reflect this: do not say Shannon is "building Balance", "working on the app", or "still building it" in a way that makes the app sound unfinished. Safe phrasing is "I built Balance", "Balance is my app", "I run Balance", or "I'm improving the coaching/business systems around it".

The real funnel:

1. Instagram/Facebook outreach, content, referrals, or ads create a conversation.
2. Lead lands in IG/FB DMs with Shannon.
3. The DM flow builds rapport, identifies the live goal/blocker, and qualifies fit without interrogating.
4. When earned, offer the six-week Balance program as one AUD $89.99 payment for the full six weeks and complete the sale through DMs.
5. Send the Founders Pass details/checkout link in the DM when they ask or accept. Do not require a call.
6. Offer a short call only when the lead explicitly wants to talk, remains genuinely uncertain after a clear DM explanation, or the situation needs Shannon's judgement. The call is an escalation lane, not the default close.
7. At the end of Foundations, route by fit: App + Community at $19.99/month for self-directed continuation, or Starter Coaching at $29.99/week for ongoing individual progression and weekly review. Starter may also be chosen directly from day one.

Critical: Balance no longer uses a free 30-day challenge as its acquisition or conversion path. DMs are the primary sales surface, and the Balance Foundations Founders Pass is the primary six-week entry offer. App + Community and Starter Coaching are the natural continuation options, not automatic renewals.

Shannon is currently running a live six-week Balance challenge. Keep its participant experience, daily proof, recap, and challenge Story automations active. It is current client/community delivery and social proof, not the default lead-acquisition offer. Do not confuse it with the retired free 30-day funnel or invite unlinked leads into it as the normal DM close.

Canonical Balance Foundations Founders Pass signup path:

1. Explain the fit as one AUD $89.99 payment for the full six weeks inside the DM. Be clear that it is a six-week course with one weekly check-in and plan review, six weeks of app/community access, and no automatic renewal. Ongoing access after week six is separate.
2. When the lead asks for details, accepts, or says they are ready, send the clean public URL `https://plantbased-balance.org/founders`.
3. The branded Founders Pass page gives a clear offer summary and starts a Stripe-hosted one-time Checkout Session after legal acceptance.
4. Stripe webhook-backed payment is the sale; then onboarding continues through Balance.

Do not send a raw, temporary Stripe Checkout Session URL in DMs. The stable branded Founders Pass URL keeps the offer understandable, preserves legal/attribution handling, and then hands payment to Stripe securely.

Current paid-acquisition positioning test:

- Keep `acquisition_mode` separate from offer positioning. `paid_meta` means the thread has verified Meta attribution and may use the direct paid conversation contract. `organic_follower`, `organic_outreach`, and `organic_inbound` use the slower statement-led relationship contract. `existing_client` remains a separate client lane.
- Keep two distinct end-to-end acquisition flows. `plant_based_control` uses plant-based positioning from ad through landing page and DM handoff. `broad_pain` uses general fitness, restarting, follow-through and real-life scheduling language with no plant-based positioning in the ad, landing page or route-specific DM handoff.
- Only verified `paid_meta` threads may enter the `broad_pain` experiment. Never infer the broad route for an organic follower or outreach lead merely because they mention work, kids, busyness, consistency, follow-through or starting again. Organic leads use the canonical plant-based Founders Pass route.
- Paid Meta leads knowingly entered a commercial conversation, so answer offer, price, inclusions, fit and starting questions directly from the first reply and preserve that contract throughout the thread. Organic conversations begin from the exact human context, use statement-led elicitation, and bridge only from the lead's own goal, blocker, help signal or explicit request.
- Paid Meta uses zero artificial queue delay after a clean review. Let the opening ad response feel considered: begin typing after roughly 12 to 30 seconds so the completed reply normally lands within 15 to 60 seconds. Once the lead has received that first reply, switch to live-chat pacing: show typing within roughly one to three seconds of each new inbound and dispatch immediately after the clean draft/review finishes. Prefer one concise answer over a paced dump of several text bubbles.
- Common paid-Meta funnel turns use one guided progression contract: clicked prompt -> goal -> blocker -> tailored structure/accountability voice note -> app-look acceptance -> program details/price -> explicit link handoff. The funnel controls the objective, verified facts and next decision, but the AI writes every ordinary response fresh from the complete newest inbound turn. It must first answer or reflect one exact detail from the person's words, then make the smallest useful next move. Deterministic copy is reserved for exact checkout/app destinations and safety gates; proof media may be deterministic but must not replace the tailored reply. Proof wording and its native attachment are atomic: the final reviewed wording must explicitly introduce the person or media before it sends, and any repair that removes that introduction must also remove the attachment. Every non-terminal progression reply asks exactly one purposeful next question and never repeats an answered question. Any meaningful goal blocker can earn the tailored path; it is not limited to work or children. On the plant-based route, introduce and attach the matching native proof media after the goal is stated. After both goal and blocker are known, the voice note reflects that exact goal/blocker, explains clear weekly structure and Shannon's accountability, states `one $89.99 payment for the full six weeks`, and offers app access before payment with one question. Send the five-minute app-preview URL only after the lead says they are keen; its paywall uses the same fixed six-week offer, not App + Community. A voice note is earned after at least two meaningful lead replies when both the goal and real blocker are known. Use a proactive voice note at most once per day, always allow an immediate voice reply when the lead sends a new voice note, and answer in text whenever they say they cannot or do not want to listen. For unlinked leads, the only content-based safety stopper is explicit suicide or self-harm language. Pregnancy, postpartum, injury, pain, hospital, medical, eating/body-image, and difficult-emotion language stays in the careful non-diagnostic AI-coach lane. Direct checkout handoffs, real opt-outs, authenticity questions, and genuine media/context uncertainty remain separate exceptions. `I stop and start again` is a blocker, not an opt-out.
- The broad route uses `https://future-balance.netlify.app/fitness` so the visible destination does not inject the plant-based domain into that test. The plant-based route uses `https://plantbased-balance.org/founders`. Meta campaign, ad-set, ad and creative attribution stays on the canonical Instagram thread and handoff receipt instead of being pasted into the public DM URL.
- Do not blend the two routes based only on a later generic message. Preserve the Meta ad referral variant and attribution through checkout and purchase. Configure broad creative IDs in `META_BROAD_AD_IDS` when the reviewed broad ads are created.
- This is a positioning experiment, not a permanent company rebrand. Keep the current plant-based site and domain live while the data is collected.

Revenue operating loop:

- Miranda (`miranda_laree_is_me`) is no longer an active Balance app client as of 2026-07-28. She was a non-paying client and stepped away after recognising that the long-running points/competition loop was consuming too much attention, increasing stress, and costing sleep. She wants her focus on workouts, meal prep, and rest. The competing app also removes concrete friction for her by retaining workout history, connecting Apple Watch heart rate/calorie burn to her established calorie tracker, and using pounds without workout-time conversions. Treat her as a former-client win-back relationship, never as an active app user or current challenge participant. Keep her explicit manager-reviewed Instagram reply flags and keep her in the 24-hour browser dispatcher's client-community support lane via `custom_data.client_community_support_enabled=true`, even though `coach_clients.status` is ended. Public/Story touches stay warm, specific, question-free, and non-commercial. Do not use inactivity check-ins, badge/XP/challenge prompts, guilt, urgency, or argue with her reason for leaving. The current win-back move is support and listening; invite her back only after a genuinely relevant product/setup improvement can be stated truthfully and framed around workouts, food, rest, low pressure, and her autonomy.

- The Warm Lead Money Queue is the exact commercial worklist inside `ig_next_actions`; it is not a second inbox and never authorizes a blind send.
- Conversation warmth and commercial readiness are separate. Use `qualifier.commercial_stage` for revenue routing: `engaged` (rapport only), `problem_qualified` (relevant personal goal plus blocker), `offer_ready` (acknowledged wanting help/structure/accountability), and `buyer_intent` (explicit price, details, link, signup, start, join, or sales-call request).
- A high reply count, Story engagement, enthusiasm, professional curiosity, or a generic use of words such as coaching/start/call does not create buyer intent. Only `problem_qualified`, `offer_ready`, and `buyer_intent` may enter the Money Queue, and every operator must re-read the live thread before progressing it.
- The single scheduled Instagram Chrome operator is the 24-hour browser shift dispatcher. Its watchdog wakes every 10 minutes, but only the renewable dispatcher lease owner works, for at most one 30-minute shift. A dispatcher wake that finds a healthy active lease immediately exits without opening Chrome, closing the active run, or altering its ledger. Each owned shift works one persistent lane task instead of restarting the full checklist or rolling through all eight lanes. Technical interruptions, uncertain actions, and browser failures resume the same lane first. A normal feed-comment work slice instead ends at 20 verified comments or minute 25, whichever comes first, saves its exact feed cursor, and advances rotation; feed resumes from that cursor when its normal slot returns. The worker reserves five minutes for reconciliation and clean Chrome release and claims one person at a time. Its replaced dedicated Instagram Chrome jobs remain paused so scheduled dispatcher ownership never overlaps. This lease coordinates dispatcher wakes only; it is not a global lock on browser use by other Codex chats.
- The API-based `Balance Lead + Client DM Manager` is a separate 24-hour worker that wakes every 10 minutes. The webhook/`ig-instant-draft` pipeline creates the first draft immediately, then the manager re-reads the full live thread, repairs or approves the draft, sends/schedules normal unlinked-lead replies, and verifies canonical readback. Verified Meta `ADS` threads atomically claim and dispatch every clean reply immediately after the safety/context/draft-review pass, while `send-coach-reply` still performs its live send-time guard; they do not wait for the per-minute cron or add an artificial four-minute delay. A current or active recent conversation clearly discussing exercise or training retains the separate four-minute AI-coach lane. The scheduled `client-lead-manager` also runs every ten minutes as a conservative availability fallback. A clean passing ordinary unlinked-lead text draft may be scheduled four minutes later. A non-blocking style-only warning may receive one cloud repair attempt, but only when the thread has no URL, voice/media, missing context, support issue, sales/call/buyer-intent moment, manual flag, linked-client identity, safety/authenticity/identity concern, unsupported-fact warning, or other hard hold. The repair uses the labelled latest message and tracked timeline, may use a live active-client count only when that exact fact is asked, must return `hold_reason` for any other missing fact, and must then earn a fresh clean passing review with zero issues. A warning is never sendable as-is. The fallback then claims the exact `dm_manager` controller row, parks it beyond the scheduled-send window so the local manager cannot race it, and the scheduled worker still performs live identity, stale-thread, no-double-send, and send-time safety checks. Every context, media, identity, commercial-decision, current-client, support, fact-uncertainty, or safety hold remains pending for the manager. Linked clients normally receive a generated draft in Needs You and no automated schedule/send. The explicit manager-owned IG reply allowlist is Monica (`pamela_vanderson_finds_her_sol`, `saltydreams_collective`, and `monica.l.sheekey`, including duplicate canonical threads), Lili Grace (`liligrace_h`), Taylah (`she_is_tlc`), Kara (`fitmumchronicles`), Danny Birch (`dannybirch131`), and Miranda (`miranda_laree_is_me`). Authorization is determined from the exact live linked thread, not a name match: `custom_data.client_manager_auto_reply_enabled=true` permits manager review and API delivery inside Meta's 24-hour window, and the separate `custom_data.client_manager_browser_dispatch_enabled=true` permits an atomic native browser handoff outside it. The browser dispatcher re-reads the native thread, sends the approved text once, verifies native/canonical readback, and returns any later inbound to the API manager. The AI-coach scheduler and scheduled worker remain blocked, and safety, authenticity, incomplete-media, app-fix verification, personal-boundary, duplicate, and transport holds still apply. One controller owner holds an allowlisted client at a time, so the two managers never create parallel replies. Dani Minahan, Francesca, Nat, and Shane remain Needs You, as do all linked clients without the exact live opt-in. It also owns current-client draft/support routing, checkout readback, and hard-hold routing. It stops claiming new work after minute seven, reconciles and releases its own lock by minute nine, and uses a 15-minute crash-recovery lease. Its local file lock is never shared with the browser dispatcher.
- Inbound replies to Shannon's own Instagram Stories are the context exception. The webhook detects Meta's `reply_to.story`, stores the inbound, creates the pending alert shell, and atomically assigns the exact `reply_inbound` controller row to `browser_dispatcher` with `reason.browser_story_reply_required=true`. It must not call `ig-instant-draft`, enter either AI-coach fast lane, or use the scheduled cloud fallback. The browser dispatcher opens the native Direct thread, reads the actual Story card/frame and the full conversation, then writes the reply from that native evidence. It may send a normal understood unlinked-lead text once after the live safety, ownership, stale-thread, and no-double-send gates. For a linked client it may inspect and draft from the native Story context, but it leaves the reply in Needs You unless the exact live thread has both manager transport flags. Manual, suppression, safety, authenticity, incomplete-media, support, and personal-boundary holds still win.
- Each owned shift may complete up to 20 verified native Instagram interactions in its current lane task. General, relationship, and viewer Story lanes normally target five canonical replies; plant-based discovery-follow slots target three verified follows; ranked, follower, inbound, and client lanes are inventory-bound. Boundary-driven lanes clear only their eligible live boundary without manufacturing volume. DMs, Story replies, public comments/replies, reactions, follows, and likes each count as one. Profile checks, Story views, skips, queue updates, and cursor work do not count. Startup and pre-action checks deduplicate canonical action IDs for the shift. Twenty is a hard ceiling, never permission to force a weak action, and per-person cooldowns, duplicate prevention, context gates, acquisition capacity, and native restrictions still apply.
- The active-client Instagram community lane supports clients with short, question-free comments on new Stories or genuinely new feed posts. An exact linked thread flag `custom_data.client_community_support_enabled=false` opts that client out of every proactive browser lane while leaving inbound DM/support routing unchanged. Nat (`mrs_natty_t`) is opted out as of 2026-08-02; keep her linked-client replies in Needs You and do not proactively comment on, reply to, react to, like, follow, or otherwise touch her Stories/posts through the dispatcher.
- `ig_browser_shift_runs` is the dispatcher-level source of truth. Acquire the chosen lane with `start_ig_browser_shift(..., 900)` before acting, resume from the returned lane cursor, and checkpoint with `heartbeat_ig_browser_shift(..., lease_seconds=900)` before and after native attempts or recovery, after five owners assessed, and at least every three minutes during read-only work. Technical interruption or uncertain-action handoffs finalize `partial` with an exact same-lane `next_resume`. A normal feed work-slice boundary finalizes `completed` with `slice_complete=true`, its exact feed cursor in `cursor_end`, and cross-lane `next_resume` to external comments/mentions even if `full_cycle_complete=false`. Other lanes retain their stated live-boundary completion rules. Never treat a zero-row saved queue claim as completion. `blocked` requires native restriction evidence. A run that receives `acquired=false` does no Instagram work; an abandoned owner can be replaced only after its renewable lease expires.
- Queue lifecycle and Instagram delivery truth are separate. `terminal_status` records what happened to the reusable `ig_next_actions` instruction; `receipt.delivery_outcome` records `sent_verified`, `sent_attribution_pending`, `not_sent`, or `uncertain`. A cancelled queue row or replaced action version may still represent a verified native send and must retain its canonical message, cooldown, and no-repeat protection. Reconciliation operates only on exact unresolved or invariant-broken receipts, is idempotent, and never repeatedly rewrites already normalised history.
- Dispatcher health is measured from owned shift starts, not watchdog invocations that exited behind a healthy lease. Flag an unexplained gap above 45 minutes, a running row beyond the hard execution wall, repeated same-cursor zero-action failures, or unresolved delivery receipts beyond their reconciliation window. Report lane-level confirmed sends, later inbounds, and movement to `problem_qualified`, `offer_ready`, `buyer_intent`, and paid so acquisition decisions optimise for business progression rather than raw activity.
- No single Chrome connection, navigation, snapshot, or recovery attempt may consume more than 60 seconds. Each distinct controller stall gets one bounded reset/reconnect cycle after its cursor and certain native evidence are saved. A later distinct stall may use the same bounded recovery again while the lease is healthy and the minute-25 native-action wall has not arrived. Never leave the automation process alive waiting for Chrome after its database lease expires.
- Follower notification work is one atomic low-volume dispatcher pass: claim due deferred welcomes first, then scan from the saved cursor, qualify each new follower/follow-back, claim or create `follower_operator` / `welcome_follower`, and welcome once when eligible with canonical readback. A valid discovery follow or other touch less than 24 hours old is deferred with `safe_after=touch+24 hours`; it is not permanently cancelled. Discovery following remains separate and never triggers an immediate automatic DM.
- Ranked Story nurturing is an exact-evidence inventory-bound lane. Rank buyer-intent, then offer-ready, then lead-authored problem-qualified candidates; visit the person's current profile and act only when a current safe Story exists. The person is durable; an exact Story URL from a prior run is not. Cancel expired frame actions and create the fresh visible exact-frame action with `p_supersede=true`. Do not use the broad tray to manufacture ranked inventory.
- General `story_nurture` works forward through every available Home-tray page toward five canonically verified replies. It assesses one owner and one exact paused frame at a time, creates or claims `story_operator` / `story_reply` with `p_supersede=true`, skips active conversations, clients, recent touches, duplicates, unclear or sensitive context, and records the real `story_nurture` contract lane, Story context, native/canonical IDs, and the next cursor. A genuine boundary requires tray-Next exhaustion or a wrap to the first stable fingerprint with no unseen owner. Story replies remain rapport-first and never contain a blind pitch or link. Exact Story frames are terminal after inspection and never become claimable merely because a cooldown timestamp elapsed.
- Story discovery is inbound-first. If a viewed Story owner has a latest Direct message that Shannon has not answered, do not send a Story reply. Check the native Direct thread and the canonical latest message, then call `prioritize_story_viewer_unanswered_inbound` with the exact thread/message/run IDs. It atomically replaces stale proactive ownership with an urgent `dm_manager` reply action, preserves a live DM-manager claim plus manual, suppression, `needs_you`, and safety holds, and never makes the browser a parallel conversational sender. Checkpoint the Story cursor and continue only after recording the handoff outcome; the DM manager performs the full-thread review and reply.
- The legacy `hot_lead_feed_nurture` lane name represents one durable full lead list, ordered hot, warm, cold, then unscored-as-cold, with an exact target and hard ceiling of 20 verified public comments per owned shift. Load at most 25 people at a time through `get_ig_feed_nurture_batch`, using tier rank, warmth score, and thread id as the durable cursor. Work every person in order and fetch the next batch while time remains. The current feed work slice ends at 20 comments or minute 25, saves its exact cursor, and rotates; the next feed slot resumes there. Normal no-post/no-hook skips advance immediately with no timed cooldown and cannot be revisited until the next full cycle; browser failure keeps the cursor on that person for retry. Only a zero-row batch after the saved cursor proves `full_cycle_complete=true`. This lane is public-comment-only: never click Like and never use a like-only fallback. Only a verified specific comment receives the rolling seven-day duplicate gate.
- Reciprocal engagement creates one delayed cross-surface nurture opportunity. A genuine reply to Shannon's comment on someone else's post can queue a named-profile Story check after at least 24 hours; a genuine reply to Shannon's Story message can queue a newest-safe-post feed check after the unanswered DM batch is resolved and at least 24 hours have passed. These use `p_supersede=false`, never replace DM/manual/sales/support ownership, and persist a pending `cross_surface_nurture` marker when the single action row is occupied. The later operator still needs a natural hook, never touches the person again in the triggering shift, and allows at most one reciprocal cross-surface touch per person per rolling seven days.
- Fresh inbound intent comes first, then call requests, checkout/close actions, and one due offer/checkout follow-up after at least 24 hours with no reply.
- Treat a checkout link as priority immediately, but do not chase the person after 15 minutes. From 15 minutes after a verified checkout-link send, the DM manager may run a read-only checkout watch: reconcile fresh reply, Stripe-backed payment, account creation/onboarding evidence, delivery errors, and app/access support. It sends nothing merely because the person has not bought yet. If there is no reply or payment, the existing single contextual checkout follow-up becomes eligible only after 24 hours and remains ahead of normal nurture/acquisition work.
- The paid-Meta app-preview handoff is a deliberate conversational pause: send the signed five-minute preview URL without immediately asking whether the page opened. The app presents the fixed six-week Balance Foundations payment gate itself. Signed preview events are identity-linked into `growth_outcome_events` so the operator can see setup, walkthrough, preview, payment-gate, Stripe-opened, abandoned-payment, and paid stages. Only a valid signed preview reference plus a canonical outbound containing that exact reference may schedule follow-ups: a short preview question after a genuine `trial_gate_shown`, payment-page help 45 minutes after `checkout_started` if Stripe has not confirmed payment, and a quick welcome after Stripe confirms the $89.99 purchase. Checkout cancels the gate message; purchase cancels every non-buyer message. The normal scheduled Graph path must also cancel stale messages if the conversation changes or eligibility cannot be verified. Never infer usage or purchase from elapsed time, a link send, or an unsigned browser event.
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
- Never let an inbound reply to Shannon's own Instagram Story enter the generic API draft/schedule path. `reply_to.story` is routed to the browser dispatcher so the native Story context is read before any response. Keep one controller owner, and preserve linked-client approval and every manual/safety hold.
- The Balance AI coach pipeline creates the first draft for every lead and client message. The API manager owns deep final review and delivery for normal unlinked-lead replies, with full-thread readback and no-double-send reconciliation. Every reply in an unlinked thread with verified Meta `ADS` attribution may be queued immediately after a clean review; the per-minute scheduled worker delivers it on its next tick and the manager reconciles it without ever sending a parallel reply. If the local API manager is unavailable, `client-lead-manager` may use the narrowly gated clean-text fallback above after atomically claiming the same controller row; it is an availability path, not permission to make sales, support, media, voice, identity, or client decisions. Only the actual first ad inbound uses the deterministic ad opener, while all later replies use the full conversation-aware generator. Shannon should not receive lead handoffs for ordinary draft/style judgment calls; explicit safety, authenticity, transport, or unrecoverable-media holds still route to Needs You. Linked clients are approval-only unless Shannon has enabled the channel-specific live opt-in. The current allowlist is Monica's three Instagram identities, Lili Grace, Taylah, Kara, Danny Birch, and Miranda. Linked Instagram delivery is gated by the exact live thread flags. Normal in-app drafts for Monica, Lili Grace, Taylah, Kara, and Danny Birch may auto-send only while Shannon's exact `client_memory` row has `auto_send_enabled=true`; Miranda's former-client exception remains Instagram-only. Dani Minahan is explicitly manual and must not be confused with Danny Birch. Re-read live identity and permission immediately before delivery so stale data cannot bypass the boundary.
- When the API manager makes a final text decision, send through `send-coach-reply` with `forceText=true` (or `deliveryMode='text'`). This overrides any stale `outbound_voice_message=true` suggestion on the alert so a reviewed text reply cannot accidentally enter synthetic voice generation.
- Position the service as personal coaching from Shannon.
- Approved public-facing framing: "weekly check-ins with Shannon", "Shannon in your corner", "ongoing support".
- No em dashes in user-facing copy. Use commas, periods, colons, parentheses, or rewrite.
- Automated replies are off for linked clients by default. Normal understood IG text replies may be manager-delivered only for Monica, Lili Grace, Taylah, Kara, Danny Birch, and Miranda while the exact live thread flags remain enabled; delivery uses the API inside 24 hours and the separately flagged browser dispatcher outside 24 hours. Normal in-app replies may auto-send for Monica, Lili Grace, Taylah, Kara, and Danny Birch while their exact Shannon-owned `client_memory.auto_send_enabled` toggle remains true. Dani Minahan, Francesca, Nat, Shane, every other linked client, and all unsafe, media, authenticity, broad program-change, or stale/duplicate cases remain approval-only. The support-repair exception is separate and narrow: one proof-gated completion reply after a verified fix, then at most one ownership acknowledgement if the same client reports that fix failed before the issue is locked into Needs You. A fixed one-time system onboarding welcome may still be delivered as a product event, but it must not open an automated client conversation.
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
- When building or editing any client workout, start with the canonical exercise-video library, which contains roughly 1,800 available exercise videos. Select the workout exercises from that library and verify each chosen exercise has a usable video before saving. Video coverage is a workout-design constraint, not something to retrofit afterward; do not leave most of a workout without demonstrations unless Shannon explicitly approves a no-video exception.
- Build client workouts from the exact exercise names in `exercise_videos.js` so every prescribed exercise has a demo. Before treating a workout as ready, verify every exercise resolves to a video and confirm the finished workout in the client's Cycle/calendar UI. Francesca's Easy Hip Reset was repaired to four video-backed exercises on 2026-08-01.
- When building or editing a client's workout program, verify in the UI with a calendar/Cycle tab screenshot. Correct DB rows do not guarantee the workout renders.
- When any backend coach action actually changes a client's program, workout schedule, exercises, or other client-facing state, create an auditable `coach_alerts` receipt. Manual/broad changes and failed-fix loops remain pending in Needs You. A claimed support repair may close its source receipt after strongest-path verification and one successful completion reply; its proof must remain in the source alert and `balance_support_jobs.receipt`.
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
- A first inbound carrying a verified Meta `ADS` referral starts a permanent paid-ad fast lane for that unlinked lead thread: persist its ad/referral attribution, run the normal media/context/safety/draft review, and atomically claim and dispatch every clean passing reply immediately through the guarded production sender. Do not wait for the per-minute scheduled worker or add an artificial pacing delay. Verified historic Meta attribution deliberately retains fast-lane ownership even after 24 hours or a quiet period. Only the actual first ad inbound uses the deterministic ad-opening reply; later messages use one full conversation-aware draft writer. Narrow transport code may attach approved proof media, voice or an explicitly requested checkout link, but no post-review rule may force, restore or rewrite a sales question. The canonical Coco internal test thread may simulate this conversation pacing only while both `internal_test_auto_reply_enabled=true` and `internal_test_meta_ad_flow='plant_based_control'`; this test override must never invent or backfill Meta attribution and never applies to a linked client. It is active paid-flow test traffic, not an exclusion or manual-only lane: neither the fast lane nor the DM manager may skip an eligible reply merely because the thread is internal. When resetting that test thread, checkpoint and preserve `custom_data.instagram_graph.last_graph_seen_at` and `last_graph_message_id` before deleting canonical history; set `internal_test_conversation_reset_at` after that checkpoint. Never blank the native Graph cursor, because reconciliation will replay the old Instagram conversation. Any source message older than the reset boundary is stale even if it is temporarily the only canonical row. In offer context, a buyer-intent reply such as `Can I see it?` receives the attributed branded Founders Pass page immediately rather than another link-permission question. Separately, any current unlinked-lead inbound, or an exchange active within the last two hours, that clearly discusses exercise or training may use the four-minute exercise lane after a clean pass. Any reviewer warning or hard hold falls back to the DM manager. Current-client identity overrides ad/exercise attribution at draft, schedule, and worker time. A linked-client live opt-in allows only a manager-reviewed text reply through its window-correct API/native transport, not either fast lane.
- In that paid fast lane, a clean reviewer-passed text reply may bypass the generic coaching-offer timing hold only when the newest inbound contains explicit buyer intent such as price or details and the reply contains no unapproved URL. Generic interest, reviewer warnings, context uncertainty, `Needs You`, linked-client identity, and unapproved link handoffs remain blocked.
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
- Write loose spoken sentences, not Reel copy. The approved scripts each had three to four imperfect thinking beats, such as a drawn-out `ummm`, `okay`, `yeah`, `honestly`, `anyway`, `alright`, `like`, spoken `ya know`, or a small repeated thought. Require at least one genuine `ummm` at a wondering or thought-searching transition. An `ahh` is context-specific relief or realisation and must never be inserted as a generic replacement. Use spoken `ya know` after a complete relatable or reassuring thought when Shannon is inviting shared understanding, not as random decoration or a global replacement for `you`. Use commas, sentence breaks, or an occasional ellipsis as audible breathing space, and vary placement so notes do not share a template. Follow the context, reductions and measured pause bands in `content-lab/SHANNON-SPOKEN-VOICE-BIBLE.md`.
- Never write laughter into a generated voice-note script. Ban `haha`, stretched laughter, `ahaha`, `hehe`, `lol`, `lmao`, and any other imitation of a chuckle anywhere in the note. Carry warmth or humour through the wording and cadence instead, and usually open directly on the exact thing the lead said.
- Shape: recognise one exact thing they said, reflect or normalise it, give one useful thought or next step, then stop. Use contractions, commas, short pauses, and occasional fragments. Do not use stage directions, polished presenter phrasing, a list read aloud, or filler in every sentence.
- The approved examples sounded spontaneous because they were specific and slightly imperfect, not because they were packed with verbal filler. Preserve that balance whenever generating a new note.
- For unlinked Instagram leads with a working Graph route, a generated voice note may replace the drafted text after the lead has shared a meaningful personal goal, current situation, or blocker. Require at least two meaningful lead replies and qualifier evidence, and cap this personal touch at one generated voice note per thread every 30 days.
- An explicit accountability question or request is a preferred one-off connection moment once those same evidence and cooldown gates are met. Answer how Shannon will keep them on track in one connected voice note, without duplicating the explanation in text. Keep prices, links, codes and exact instructions as text.
- Never use a generated or cloned voice note to answer an AI, bot, automation, or "is this really Shannon?" authenticity question. Keep the existing Needs You hold, forbid the synthetic send, and recommend that Shannon record a fresh native note. Suggested honest wording: "hey, yep it's Shannon. I do use a bit of help organising my inbox because it gets busy, but the coaching and support inside Balance is me."
- Linked clients remain draft-only Needs You when a voice note would be useful. The explicit client exceptions authorize manager-reviewed text delivery only, through API or native browser dispatch according to the live window; Shannon still decides whether to record and send any voice note.

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
- Safe IG/FB unlinked-lead replies are drafted immediately by the Balance AI coach pipeline, then reviewed and delivered by the API manager. Every clean passing reply in a verified Meta `ADS` attributed unlinked-lead thread queues immediately for the per-minute scheduled worker; the manager reconciles its controller and transport receipts without competing. The ten-minute `client-lead-manager` cloud fallback may schedule an already clean-reviewed ordinary unlinked-lead text draft, or make one style-only repair and schedule it only after a fresh zero-issue pass, under the strict controller and exclusion gates above. This prevents local runtime outages from leaving routine or safely repairable replies unanswered without authorizing contextual guesses. Linked IG/FB clients are draft-only by default. A doubly flagged allowlisted thread is the manager-reviewed conversational text exception: API inside 24 hours, atomic `browser_dispatcher` native handoff outside 24 hours. The live allowlist is Monica, Lili Grace, Taylah, Kara, Danny Birch, and Miranda; Dani Minahan and all unflagged clients remain Needs You. The IG exception does not itself authorize synthetic voice, in-app delivery, or weaker safety/readback rules. In-app auto-send requires the separate exact `client_memory.auto_send_enabled` opt-in. Other client-facing replies require Shannon's approval; the only support exception is the proof-gated completion/failed-fix loop in the Support Repair Worker section.

Client inactivity outreach is retired:

- Do not message clients because they have not logged in to Balance for a set number of days.
- The login signal does not contain enough real-world context to justify proactive outreach.
- Do not recreate the retired 3-day, 7-day, or 14-day Instagram check-in lane in the browser dispatcher, API manager, in-app nudges, or another automation.

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

Workout-program exercise library rule:

- Every exercise prescribed in a client workout program, including warm-ups, mobility drills, stretches, and finishers, must use an exact exercise name already present in the canonical `exercise_videos.js` catalog with a non-empty working video URL.
- Every canonical demo must use the cross-phone media contract: H.264 Constrained Baseline Level 3.1, `yuv420p`, constant 24 fps, no B-frames, no audio, maximum 1280 px on the long edge, and MP4 `faststart`. Run `node scripts/normalize-exercise-video-library.mjs --write-catalog` with the production B2 environment to normalize new source URLs. The run is resumable and will not rewrite the catalog until every output passes `ffprobe` validation.
- Do not add a raw Backblaze, Drive, MOV, WebM, HEVC, or camera-export URL directly to `exercise_videos.js`. `tests/exercise-video-phone-compat-guard.test.js` is the release guard for this rule.
- Never design a program from general exercise knowledge first and assume Balance contains those movements. Build from the available Balance exercise catalog.
- Before saving or announcing a program, deterministically validate every prescribed exercise against the catalog and verify its video URL is reachable. Replace unsupported free-text names with appropriate existing catalog exercises, or deliberately add and verify the missing exercise/video before assigning it.
- Recovery days such as rest, run, or walk may be schedule labels with `type: 'rest'`; do not create fake exercise rows for them merely to show the label.

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
- `balance_support_jobs` is the Supabase traffic controller for repairs. `coach_alerts` remains the source message and audit receipt; only ambiguous, unsafe, blocked, or client-reported failed fixes remain pending in Needs You.
- The support worker calls `refresh_balance_support_jobs`, claims a short lease through `claim_balance_support_jobs`, follows the Balance app-support verification rules, and finishes with `complete_balance_support_job`.
- Never repair a support item without a live claim. Only explicit, bounded program operations and concrete app faults are eligible; broad program redesign, injury/medical judgment, unclear intent, or uncertain identity stays Needs You.
- After strongest client-path verification, the repair worker may send exactly one short completion reply from `support_state='verified_fix_reply_ready'`. Delivery requires live identity permission in `support_automation_authorized=true`, `support_issue_key`, `repair_verified_at`, `repair_verification_summary`, one-use flags, canonical outbound readback, and source `balance_app_repair_worker`. Explicit manual-only people never receive that authorization. A successful fix does not remain in Needs You.
- If a later inbound clearly says the same issue is still broken, the DM manager may send exactly one short ownership acknowledgement from `support_state='failed_fix_ack_ready'`, then must set `failed_fix_ack_used=true`, `support_loop_guard=true`, and create a pending Needs You receipt with the original request, attempted repair, verification proof, completion message, and failed confirmation. No further automated message is allowed for that issue until Shannon resolves it.

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
- Keep each direct Instagram Graph text bubble at 240 characters or fewer. The native app has visibly shortened an automated 370-character bubble at 250 characters while the API still returned success, so `send-ig-reply.js` must split longer replies at sentence boundaries before transport and record each delivered bubble separately.
- ManyChat is now a legacy/backstop path. It is still useful for Facebook Messenger and old IG threads that have not yet exposed a Graph recipient id.
- Required Graph env/secrets include `INSTAGRAM_GRAPH_ACCESS_TOKEN` or `app_private_secrets.key='instagram_graph_access_token'`, plus the IG account id env fallback when it is not stored on a thread.
- ManyChat env vars, while the backstop remains active, include `MANYCHAT_API_TOKEN`, optional `MANYCHAT_WEBHOOK_SECRET`, `MANYCHAT_SEND_URL`, and `MANYCHAT_MESSAGE_TAG`.
- 24-hour IG messaging window applies. Human-agent tag can extend to 7 days only when Meta has approved the Human Agent feature; the code gates this behind `INSTAGRAM_GRAPH_HUMAN_AGENT_ENABLED`.
- First captured message from a lead often has no visible context because Shannon has already commented on or replied to their story/post natively, outside ManyChat. Treat empty IG/FB history as an unseen Shannon opener, not as the lead initiating cold. The AI should build rapport from whatever signal exists, ask one light human question, and avoid intake/pitch unless they clearly ask about the challenge or link.
- Lead stages: `new`, `qualifying`, `invited`, `in_app`, `churned`, and newer paid/accepted states may exist in migrations.
- The current paid plant-based Meta campaign promotes one public offer: **Balance Foundations**, one $89.99 payment for the complete six-week curriculum, six weeks inside the app/community, and one weekly check-in with training and food review/adjustments. Do not rename it Starter Coaching in this campaign or divert an old ad prompt into the $29.99/week package.
- Preferred Meta prompt questions for this campaign are:
  - "What's included in the six-week Balance Foundations program?"
  - "How does the weekly check-in work?"
  - "Do I need to already be plant-based?"
- Older ads may still send "Do you offer personalized coaching plans?". Answer yes by explaining the Balance Foundations six-week curriculum and weekly review, then ask about the lead's goal. Do not mention Starter Coaching in that paid-ad branch.
- These are Meta messaging-template buttons, not AI-created reply bubbles. Treat a tapped prompt as the lead's ordinary first sentence and never answer with another option menu.
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

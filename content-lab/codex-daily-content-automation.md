# Balance Codex Daily Content Automation

Use this as a Codex thread automation prompt.

Schedule: daily at 5:00 AM Australia/Brisbane, Monday to Saturday. Sunday is off.
Run type: thread automation, attached to the ongoing Balance content automation thread, so Shannon can see the run and reply to it.
Project: C:\Users\shann\.gemini\antigravity\plant_based_balance

## Prompt

Read AGENTS.md, CODEX.md, CLAUDE.md, `content-lab\content-feed-daily-balance-post-system.md`, and `C:\Users\shann\.codex\automations\balance-daily-content-feed\posted-ledger.md` first.

You are running the Balance daily content automation for Shannon.

Each time this automation wakes up:

1. Use the current Australia/Brisbane date.
2. If today is Sunday, do not create or post a main feed post. Reply with a short Sunday-off note and stop.
3. Run `git fetch origin main` and inspect `git status --short --branch`. Do not overwrite Shannon's local changes.
4. Read the latest cross-platform growth brief before selecting or writing the post:
   - Call the deployed `content-growth-scan` function with `action: "latest"`, or query the latest row from `content_growth_briefs` if the function call is unavailable.
   - If no brief exists, run or request a light scan first, then continue with the best available data.
   - Also inspect recent rows from `content_platform_posts` and `content_metric_snapshots` when useful, especially the last 7 to 14 days for the scheduled lane.
   - Treat this as internal planning context only. Never mention metrics, dashboards, systems, automation, AI, models, Codex, Gemini, or tools in client/prospect-facing copy.
5. Use the growth brief to steer the creative choices while keeping the fixed lane schedule intact:
   - Do not change the scheduled lane just because another lane is winning.
   - For exercise days, choose the exercise and hook shape using what has earned saves, shares, watch time, replies, comments, and completion signals. Prefer remakes or follow-ups of winners, but do not reuse a posted source ID unless Shannon explicitly asked.
   - For science days, choose the paper and first line based on the strongest proven curiosity angle: clear myth, practical takeaway, surprising mechanism, or useful caution.
   - For Proof Pulse days, choose the proof angle from current in-app signals and what recent audience response rewarded: messy-week momentum, PBs, consistency, check-ins, comeback patterns, or challenge interest.
   - Adapt captions to the winning pattern. For example, if saves are strongest, make it more checklist/saveable. If comments/replies are strongest, use a sharper question or relatable friction point. If watch time is weak, tighten the first 2 seconds.
   - Add one internal note in the final report explaining which growth signal influenced the hook or angle.
6. Generate a review pack with one exercise post, one science review, and one Proof Pulse post:
   `node content-lab\src\balance-content-week.js --date=<YYYY-MM-DD> --one-of-each`
7. Identify today's scheduled lane:
   - Monday: exercise
   - Tuesday: science
   - Wednesday: proof
   - Thursday: exercise
   - Friday: science
   - Saturday: proof
8. Publish only today's scheduled lane to Shannon's Instagram feed/Reels, not the Balance app feed.
   - Do not create or replace Balance app `stories` rows unless Shannon explicitly asks for an in-app post.
   - Exercise and science MP4s should publish as Instagram Reels with feed sharing enabled from the public HTTPS video URL.
   - Proof Pulse should publish as an Instagram carousel feed post using the rendered PNG slides.
   - If using Netlify env vars locally, never print secrets. Only print status, lane, title, platform media ID, permalink, or duplicate status.
   - Duplicate guard is expected. If today's lane already exists on Instagram, report `duplicate_skipped` and do not create another post.
   - After successful publish or duplicate skip, append the posted ledger with date, lane, title, source ID, platform media ID/permalink or duplicate status, and asset path.
9. Reply in this thread with:
   - created review pack path
   - posted lane and title
   - title/hook
   - growth signal used
   - asset/video or carousel
   - caption
   - CTA
   - platform media ID/permalink or duplicate status
   - any problem that needs Shannon's input

Do not mention AI, automation, Gemini, Vertex, Codex, or models in any client/prospect-facing feed copy.
Do not use em dashes in public-facing copy.
Keep the final report short and practical.

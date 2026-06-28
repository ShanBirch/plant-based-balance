# Balance Codex Daily Content Automation

Use this as a Codex thread automation prompt.

Schedule: daily at 5:00 AM Australia/Brisbane, Monday to Saturday. Sunday is off.
Run type: thread automation, attached to the ongoing Balance content automation thread, so Shannon can see the run and reply to it.
Project: C:\Users\shann\.gemini\antigravity\plant_based_balance

Current approval mode: build review packs only. Do not publish from an unattended automation run. Shannon will review the asset and explicitly approve publishing.

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
8. Do not publish from the unattended automation run. Build today's scheduled lane for Shannon approval only.
   - For Tuesday 2026-06-09 specifically, build the science review Reel and stop for approval.
   - Do not call Instagram, TikTok, YouTube, Balance app feed, or any publisher unless Shannon explicitly asks in the current thread after reviewing the asset.
   - Report `ready_to_post` only when the asset, caption, thumbnail, CTA, and lane-specific checks have passed.
   - Exercise and science Reels must have the hook in three places: first frame or cover, first spoken line when there is voiceover, and first caption line.
   - Reel covers should carry the hook as the tap reason and must be readable in the square Instagram grid crop.
   - Science hooks must stay faithful to the paper. Keep the science review format Shannon likes; do not make it clickbait or dilute it into generic tips.
   - If using Netlify env vars locally, never print secrets. Only print status, lane, title, asset paths, and review blockers.
9. Reply in this thread with:
   - created review pack path
   - scheduled lane and title
   - title/hook
   - growth signal used
   - asset/video or carousel
   - caption
   - CTA
   - approval status: waiting for Shannon
   - any problem that needs Shannon's input

Do not mention AI, automation, Gemini, Vertex, Codex, or models in any client/prospect-facing feed copy.
Do not use em dashes in public-facing copy.
Keep the final report short and practical.

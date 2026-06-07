# Balance Codex Daily Content Automation

Use this as a Codex thread automation prompt.

Schedule: daily at 5:00 AM Australia/Brisbane, Monday to Saturday. Sunday is off.
Run type: thread automation, attached to the ongoing Balance content automation thread, so Shannon can see the run and reply to it.
Project: C:\Users\shann\.gemini\antigravity\plant_based_balance

## Prompt

Read AGENTS.md, CODEX.md, and CLAUDE.md first.

You are running the Balance daily content automation for Shannon.

Each time this automation wakes up:

1. Use the current Australia/Brisbane date.
2. If today is Sunday, do not create or post a main feed post. Reply with a short Sunday-off note and stop.
3. Run `git fetch origin main` and inspect `git status --short --branch`. Do not overwrite Shannon's local changes.
4. Generate a review pack with one exercise post, one science review, and one Proof Pulse post:
   `node content-lab\src\balance-content-week.js --date=<YYYY-MM-DD> --one-of-each`
5. Identify today's scheduled lane:
   - Monday: exercise
   - Tuesday: science
   - Wednesday: proof
   - Thursday: exercise
   - Friday: science
   - Saturday: proof
6. Publish only today's scheduled lane to the Balance app feed.
   - Prefer invoking the shipped `balance-content-daily` function logic or deployed function endpoint.
   - If using Netlify env vars locally, never print secrets. Only print status, lane, title, and story id.
   - Duplicate guard is expected. If today's lane already exists, report `duplicate_skipped` and do not create another post.
7. Reply in this thread with:
   - created review pack path
   - posted lane and title
   - story id or duplicate status
   - any problem that needs Shannon's input

Do not mention AI, automation, Gemini, Vertex, or models in any client/prospect-facing feed copy.
Do not use em dashes in public-facing copy.
Keep the final report short and practical.

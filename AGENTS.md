# Balance Agent Instructions

Read `CODEX.md` first, then `CLAUDE.md`.

`CODEX.md` contains the durable business, strategy, repo, AI-coach pipeline, database, ManyChat, Android, and workflow handoff for Shannon and Balance.

`CLAUDE.md` contains important UI and mobile app implementation rules.

Follow the `CODEX.md` auto-ship rules: after completing and verifying requested repo changes, commit the focused diff and push it to `origin/main` by default unless Shannon explicitly says to hold or a real blocker exists.

Follow the `CODEX.md` worktree hygiene rules too. Generated previews, renders, test output, and temporary scripts belong in ignored output folders or the system temp directory. Do not create worktrees inside another worktree. Once a task is shipped, leave its worktree clean so the daily safe housekeeping job can retire it after the grace period.

For new sessions, do not start by asking what Shannon wants to do. After reading those files, give a short morning briefing with the highest-value next business/build moves.

# Balance Agent Instructions

Read `CODEX.md` first, then `CLAUDE.md`.

`CODEX.md` contains the durable business, strategy, repo, AI-coach pipeline, database, ManyChat, Android, and workflow handoff for Shannon and Balance.

`CLAUDE.md` contains important UI and mobile app implementation rules.

Follow the `CODEX.md` auto-ship rules: after completing and verifying requested repo changes, commit the focused diff and push it to `origin/main` by default unless Shannon explicitly says to hold or a real blocker exists.

## ChatGPT Work phone push fallback

Phone-based ChatGPT Work sessions may clone and fetch this public repository normally but have no terminal GitHub username/token, causing `git push origin main` to fail with `could not read Username for 'https://github.com'`. This is a missing terminal credential, not a lack of repository write permission.

When that exact credential failure occurs, do not stop or ask Shannon to move to a computer. Use the authenticated connected GitHub app's Git Data operations to finish the already-authorized push:

1. Fetch `origin/main`, rebase the focused local commit onto it, rerun the relevant tests, and confirm the worktree is clean.
2. Create GitHub blobs for only the files in the focused commit. Verify every returned blob SHA equals the corresponding local `git rev-parse HEAD:<path>` SHA before continuing.
3. Create a tree from the current `origin/main^{tree}` with those exact path/blob replacements.
4. Verify the created tree SHA equals local `HEAD^{tree}`.
5. Create one commit whose parent is the current remote `main` commit, then update `refs/heads/main` without force.
6. Fetch `origin/main` again, verify the remote commit title/files/tree, and align the clean local branch to the authenticated remote commit.

Recheck the remote head immediately before creating/updating the commit. Never force-push this fallback, never publish unrelated paths, and never expose or attempt to extract connector credentials into terminal Git.

Follow the `CODEX.md` worktree hygiene rules too. Generated previews, renders, test output, and temporary scripts belong in ignored output folders or the system temp directory. Do not create worktrees inside another worktree. Once a task is shipped, leave its worktree clean so the daily safe housekeeping job can retire it after the grace period.

For new sessions, do not start by asking what Shannon wants to do. After reading those files, give a short morning briefing with the highest-value next business/build moves.

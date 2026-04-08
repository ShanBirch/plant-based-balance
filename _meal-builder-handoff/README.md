# Meal Builder Feature — Handoff to Real Repo

These patches contain the **Build-a-Meal** feature plus the **Quick Log overlay
saved-meals view**. They were originally committed to this repo
(`ShanBirch/plant-based-balance`), but this repo turned out to be the **public
portfolio snapshot** — not the production repo where AABs are actually built.
The two commits never reached the real repo, which is why no GitHub Action ran
and no AAB was produced.

This folder lets you bring the work over cleanly.

## What's in the patches

| File | Title | Lines |
|------|-------|-------|
| `0001-Add-Build-a-Meal-feature-to-calorie-tracker.patch` | In-app meal builder modal + `user_saved_meals` table + Recent / Saved tabs on the Recent Meals modal | ~1190 |
| `0002-Add-saved-meals-view-to-QuickMealActivity-overlay.patch` | New 🍽️ icon next to the camera in the native Quick Log overlay → opens an in-overlay "Your Meals" list with one-tap logging + "+ Build New Meal" link | ~450 |

Both are normal `git format-patch` outputs — they preserve the original commit
messages, authors, and timestamps.

## How to apply them in your real repo

1. Open a terminal in your **real** Plant Based Balance repo (the one with
   `.github/workflows/build-android.yml` already in it).
2. Make sure you're on a clean working tree on `main`:
   ```bash
   git checkout main
   git pull
   git status   # should be clean
   ```
3. Create a fresh feature branch:
   ```bash
   git checkout -b add-meal-builder
   ```
4. Apply the two patches (in order):
   ```bash
   git am /path/to/0001-Add-Build-a-Meal-feature-to-calorie-tracker.patch
   git am /path/to/0002-Add-saved-meals-view-to-QuickMealActivity-overlay.patch
   ```
5. Push and merge as normal:
   ```bash
   git push -u origin add-meal-builder
   ```

## If `git am` reports conflicts

The real repo's `main` has 109+ commits that the public snapshot doesn't, so
some files (especially `dashboard.html`, `dashboard-script-11-...js`, and the
two Java files) may have drifted. If `git am` halts:

```bash
# Inspect the conflict
git status

# Edit the conflicted files manually, then:
git add <file>
git am --continue

# Or, to abort and try a different approach:
git am --abort
```

If `git am` is too painful because of drift, fall back to `git apply --3way`:

```bash
git apply --3way /path/to/0001-Add-Build-a-Meal-feature-to-calorie-tracker.patch
git apply --3way /path/to/0002-Add-saved-meals-view-to-QuickMealActivity-overlay.patch
git add -A
git commit -m "Add meal builder feature (ported from public snapshot fork)"
```

## After applying — one manual step

You still need to run the SQL migration in `database/user-saved-meals-migration.sql`
in the Supabase SQL editor (or use the version pasted earlier in chat with the
inline `INDEX` extracted into a separate `CREATE INDEX` — Supabase Postgres
rejects the inline form).

## What gets built once you push to your real repo

- **Web changes** (HTML/CSS/JS) → live via Netlify the moment they hit `main`,
  no AAB needed. The in-app meal builder modal and the Recent / Saved tabs
  appear instantly.
- **Native Android changes** (`QuickMealActivity.java`, `MainActivity.java`)
  → require a fresh AAB. Your existing `.github/workflows/build-android.yml`
  should pick this up automatically. The new 🍽️ icon in the Quick Log
  overlay only appears once you install the new build.

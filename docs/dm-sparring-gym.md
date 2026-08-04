# DM Sparring Gym

Internal simulator for Balance Instagram lead conversations.

It runs fake IG strangers against Shannon-style DM replies, scores the thread, and writes reports under `artifacts/dm-sparring/`. It does not write to Supabase, ManyChat, `ig_threads`, `ig_messages`, or `coach_alerts`.

## Run It

```bash
node scripts/run-dm-sparring-gym.js --count=5 --turns=4
```

Useful options:

```bash
node scripts/run-dm-sparring-gym.js --list-personas
node scripts/run-dm-sparring-gym.js --persona=body_image_lurker --count=1 --turns=5
node scripts/run-dm-sparring-gym.js --count=20 --turns=4 --seed=challenge-v1
node scripts/run-dm-sparring-gym.js --offline --count=2
node scripts/run-dm-sparring-gym.js --coach-model=gemini
node scripts/run-dm-sparring-gym.js --no-qualifier
node scripts/run-dm-sparring-gym.js --no-story-bots
node scripts/run-dm-sparring-gym.js --from-db --count=5 --turns=4
```

Live mode needs either `OPENAI_API_KEY` or `GEMINI_API_KEY`. It follows the configured AI provider, so an OpenAI-routed production environment does not need a dummy Gemini key. The Shannon reply model otherwise tries the fine-tuned Vertex voice first when its Firebase credentials are present, then uses the configured fallback.

By default each run uses a few bots:

- scenario writer: sharpens the stranger's hidden story
- reality checker: makes the stranger less convenient and less AI-ish
- stranger: plays the IG lead
- qualifier: applies the existing Balance lead-stage logic
- Shannon: drafts the reply
- judge: scores the full conversation

Use `--no-story-bots` when you want the cheaper fixed persona cards instead.

## Real-Data Personas

Use `--from-db` to build anonymized persona cards from live, unlinked-lead `ig_threads` and `ig_messages`. Linked clients are excluded before sampling.

```bash
node scripts/run-dm-sparring-gym.js --from-db --count=5 --turns=4 --db-window-days=180
```

Options:

```bash
--db-thread-limit=80
--db-window-days=180
--db-min-inbound=2
--db-min-messages=4
--db-focus=all
--db-focus=lead-relevant
--db-focus=paid-meta
```

`lead-relevant` keeps historical fitness, food, consistency, coaching and offer conversations while removing unrelated Story banter. `paid-meta` is stricter: it requires verified Meta attribution or a recognized historical ad opener. Internal Coco/Shan test threads and linked clients are always excluded.

The script sends sanitized transcript samples to the persona builder and writes only anonymized composite personas to `artifacts/dm-sparring/*.personas.json`. It strips URLs, emails, phone numbers, handles, UUIDs, and raw media URLs before prompting. The reports are ignored by git.

Real-data personas should still be treated as simulation fuel, not training truth. Use them to find prompt rules and then validate against live reply, join, app-start, and conversion outcomes.

## What It Scores

The judge scores:

- `felt_human`
- `heard_first`
- `context_use`
- `not_boring`
- `not_salesy`
- `question_quality`
- `invite_timing`
- `likely_reply`
- `likely_join`

It also flags things like premature challenge invites, stock discovery questions, too many questions, or AI-disclosure risk.

## How To Use The Results

Use the reports to find prompt and strategy improvements. Do not automatically train the live model from synthetic transcripts.

The safe loop is:

```text
simulate -> score -> inspect winners and failures -> update prompt/rules -> compare against real IG outcomes
```

The live truth still comes from real `ig_threads`, `ig_messages`, challenge joins, app starts, and conversions.

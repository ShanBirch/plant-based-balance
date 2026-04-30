-- Lead Qualifier Migration
--
-- Adds a `qualifier` JSONB column to ig_threads that holds the AI-managed
-- per-lead funnel state for the 4-stage qualifier playbook:
--
--   1. current_state     — food + movement + energy now (routes plant-based vs generic challenge)
--   2. motivation        — the deeper outcome (feel sexy, keep up with kids, stop feeling tired)
--   3. history_blockers  — what they've tried, what stopped them
--   4. commitment        — ready to start, save them a spot
--
-- Plus terminal states: pitched / won / lost / paused.
--
-- The column is auto-managed by ig-instant-draft.js after every inbound DM:
-- a Gemini Flash call extracts new facts from the lead's reply, advances the
-- stage when an answer lands, scores warmth, and generates a quote-grounded
-- "next question" + "why now" for Shannon's notification card. The AI judges
-- timing contextually (minutes-to-months) — no reply-count gates.
--
-- Lives next to ig_threads.lead_stage (the coarse funnel: new/qualifying/
-- invited/in_app/paying/churned). lead_stage stays the source of truth for
-- the existing pitchHintForStage routing; `qualifier` is the finer-grained
-- state INSIDE the new/qualifying/invited window.
--
-- Run via exec_sql RPC. Safe to re-run.
--
-- Shape (managed by qualifier-engine.js):
--   {
--     "stage": "current_state",          -- one of 4 stages + pitched/won/lost/paused
--     "stage_label": "Current state",
--     "stage_index": 1,                  -- 1-based for display "1/4"
--     "facts": {
--       "hook_context": "saw her morning run story",
--       "current_state": "trains 4x/week, eats out a lot",
--       "motivation": null,
--       "history_blockers": null,
--       "commitment": null
--     },
--     "warmth_score": 67,                -- 0-100
--     "warmth_label": "warm",            -- cold | lukewarm | warm | hot
--     "next_question": "...",            -- the actual question text
--     "why_now": "...",                  -- quote-grounded reasoning
--     "quote_evidence": "...",           -- the lead's words this hinges on
--     "is_question_moment": true,        -- false = just chat, no push
--     "challenge_route": "undecided",    -- vegan | generic | undecided
--     "evaluated_at": "2026-04-30T..."
--   }

-- 1. Add the column
ALTER TABLE public.ig_threads
    ADD COLUMN IF NOT EXISTS qualifier JSONB DEFAULT NULL;

-- 2. Index by stage for future filtered admin queries (e.g. "all leads stuck at motivation")
CREATE INDEX IF NOT EXISTS idx_ig_threads_qualifier_stage
    ON public.ig_threads ((qualifier->>'stage'))
    WHERE qualifier IS NOT NULL;

-- 3. Index by warmth for "hot leads waiting" admin views
CREATE INDEX IF NOT EXISTS idx_ig_threads_qualifier_warmth
    ON public.ig_threads (((qualifier->>'warmth_score')::int))
    WHERE qualifier IS NOT NULL;

-- Verify:
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='ig_threads' AND column_name='qualifier';
--   SELECT indexname FROM pg_indexes WHERE tablename='ig_threads' AND indexname LIKE 'idx_ig_threads_qualifier%';

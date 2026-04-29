-- client_memory.coach_instructions
--
-- Free-text "AI guidance for THIS client" written by the coach. Injected
-- into every draft prompt for the client (in-app, IG, FB) so Shannon can
-- teach the AI persistent rules per-relationship rather than per-message.
--
-- Examples:
--   "Taylah responds well to vulnerability — ask deeper questions"
--   "Don't push the challenge with this one, they're skeptical"
--   "Keep replies super short, she gets overwhelmed by long messages"
--
-- This sits alongside the existing memory fields (goals, communication_
-- style, running_notes, injuries_limits, personal_context) but is
-- explicitly the COACH speaking to the AI, not extracted observations.
-- Producers wrap it in a "COACH'S INSTRUCTIONS FOR YOU ON THIS CLIENT"
-- block in the prompt so the model knows to weight it heavily.
--
-- Safe to re-run.

ALTER TABLE public.client_memory
    ADD COLUMN IF NOT EXISTS coach_instructions TEXT;

COMMENT ON COLUMN public.client_memory.coach_instructions IS
    'Free-text per-client guidance from the coach to the AI. Injected into every draft prompt for this (coach, client) pair. Use for persistent voice/style rules that apply specifically to this relationship. Empty/null = no extra guidance.';

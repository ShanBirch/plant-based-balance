-- ============================================================
-- AUTO-ASSIGN COACH SHANNON AS COACH FOR EVERY NEW USER
-- ============================================================
-- Every new signup should automatically have Coach Shannon assigned
-- as their coach via a coach_clients row. Inserting that row fires
-- coach_clients_onboarding_trigger (see
-- database/coach_clients_onboarding_trigger.sql), which calls the
-- onboarding-welcome-draft Netlify function. That function drafts a
-- warm first message in Shannon's voice and lands it in the admin
-- alerts feed with a coach_draft_ready push — Shannon reviews /
-- edits / sends from the lockscreen.
--
-- From there, when the client replies, the existing
-- instant_coach_draft_trigger + instant-coach-draft.js pipeline
-- drafts every reply the same way. No extra wiring needed.
--
-- We expose this as an RPC the client calls when onboarding completes
-- (at that point user_facts is populated so the draft can reference
-- their real goal). SECURITY DEFINER so the new user can call it
-- without coach_clients INSERT RLS privileges.
-- ============================================================

CREATE OR REPLACE FUNCTION public.assign_coach_shannon_to_user(new_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  shannon_id UUID;
  already_assigned INT;
BEGIN
  -- Locate Coach Shannon (same lookup as add_coach_shannon_friend)
  SELECT id INTO shannon_id
  FROM public.users
  WHERE email IN (
    'shannonbirch@cocospersonaltraining.com',
    'shannon@plantbased-balance.org'
  )
  ORDER BY CASE email
    WHEN 'shannonbirch@cocospersonaltraining.com' THEN 1
    WHEN 'shannon@plantbased-balance.org' THEN 2
    ELSE 3
  END
  LIMIT 1;

  -- Shannon's account doesn't exist yet (very first signup of the
  -- app): silently no-op. The client-side fallback in
  -- dashboard-script-5 will retry on the next onboarding completion.
  IF shannon_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Don't assign Shannon as her own coach.
  IF shannon_id = new_user_id THEN
    RETURN FALSE;
  END IF;

  -- Dedup: already assigned → skip (prevents duplicate welcome alerts
  -- if the RPC gets called twice across onboarding retries).
  SELECT count(*) INTO already_assigned
  FROM public.coach_clients cc
  WHERE cc.coach_id = shannon_id
    AND cc.client_id = new_user_id;
  IF already_assigned > 0 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.coach_clients (coach_id, client_id, status)
  VALUES (shannon_id, new_user_id, 'active');
  -- coach_clients_onboarding_trigger fires here → welcome draft
  -- alert + push lands on Shannon's phone.

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block the signup / onboarding flow on this.
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.assign_coach_shannon_to_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_coach_shannon_to_user(UUID) TO anon;

COMMENT ON FUNCTION public.assign_coach_shannon_to_user(UUID) IS
  'Assigns Coach Shannon as the given user''s coach by inserting a coach_clients row. Idempotent. Fires the coach_clients_onboarding_trigger which drafts the admin-review welcome alert.';

-- ============================================================
-- BACKFILL: assign Shannon as coach for every existing user who
-- isn't already her client. This will fire one welcome draft per
-- user via the trigger — heavy. Guard with a one-time flag so it
-- doesn't re-run on re-apply.
-- ============================================================
DO $$
DECLARE
  shannon_id UUID;
  u RECORD;
  already_ran BOOLEAN;
BEGIN
  -- Check if backfill already ran (keyed in a settings-style table
  -- or, absent that, check whether shannon already has ANY clients).
  SELECT EXISTS(
    SELECT 1 FROM public.coach_clients LIMIT 1
  ) INTO already_ran;

  IF already_ran THEN
    -- Some coach_clients rows already exist; skip backfill to avoid
    -- mass-triggering welcome drafts for every existing user. The
    -- admin can manually assign older users via the admin dashboard
    -- if they want a fresh welcome draft.
    RETURN;
  END IF;

  SELECT id INTO shannon_id
  FROM public.users
  WHERE email IN (
    'shannonbirch@cocospersonaltraining.com',
    'shannon@plantbased-balance.org'
  )
  ORDER BY CASE email
    WHEN 'shannonbirch@cocospersonaltraining.com' THEN 1
    WHEN 'shannon@plantbased-balance.org' THEN 2
    ELSE 3
  END
  LIMIT 1;

  IF shannon_id IS NULL THEN RETURN; END IF;

  FOR u IN
    SELECT id FROM public.users
    WHERE id <> shannon_id
      AND email NOT IN (
        'shannonbirch@cocospersonaltraining.com',
        'shannon@plantbased-balance.org'
      )
  LOOP
    BEGIN
      INSERT INTO public.coach_clients (coach_id, client_id, status)
      VALUES (shannon_id, u.id, 'active')
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

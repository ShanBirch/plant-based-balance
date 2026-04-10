-- ============================================================
-- FIX: "Failed to join challenge" after getting an invite
-- ============================================================
-- Symptom
--   User receives a challenge invite, opens the Challenge Mode
--   modal, taps "Spend X Coins & Join" and sees the alert
--   "Failed to join challenge. Please try again." — their coins
--   are not debited and their participant row stays as 'invited'.
--
-- Root cause
--   The previous join_wellness_challenge() used an UPSERT
--   (INSERT ... ON CONFLICT ... DO UPDATE). When the row already
--   exists (which is always true for an invited user), the
--   BEFORE INSERT trigger `set_challenge_creator_multiplier`
--   still fires for the INSERT attempt *before* the conflict is
--   detected, and any error it raises bubbles out of the RPC as
--   an uncaught PostgREST error — the client's try/catch then
--   shows the generic "Failed to join challenge" alert.
--
--   The new function avoids the UPSERT entirely by branching on
--   whether a participant row already exists and running a plain
--   UPDATE for invited users. It also guards against NULL entry
--   fees and missing user_points rows, and surfaces SQLERRM back
--   to the client for diagnostics.
--
-- Also adds
--   force_accept_challenge(email TEXT, challenge_id UUID) — a
--   one-shot admin helper that bypasses the RPC entirely and
--   manually marks a user as accepted + debits their coins. Used
--   to unblock clients like Ryan Birch whose invite got stuck.
-- ============================================================

-- ------------------------------------------------------------
-- 1. HARDENED join_wellness_challenge
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.join_wellness_challenge(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.join_wellness_challenge(UUID, UUID);

CREATE OR REPLACE FUNCTION public.join_wellness_challenge(
    p_challenge_id UUID,
    p_user_id      UUID,
    p_weight_goal  TEXT DEFAULT 'lose'
)
RETURNS JSONB AS $$
DECLARE
    v_entry_fee        INTEGER;
    v_new_balance      INTEGER;
    v_current_points   INTEGER;
    v_challenge_status TEXT;
    v_user_status      TEXT;
    v_row_exists       BOOLEAN;
BEGIN
    RAISE NOTICE '[JoinChallenge] user=% challenge=% goal=%',
        p_user_id, p_challenge_id, p_weight_goal;

    -- 1. Look up the challenge
    SELECT status, COALESCE(entry_fee, 0)
      INTO v_challenge_status, v_entry_fee
      FROM public.challenges
     WHERE id = p_challenge_id;

    IF v_challenge_status IS NULL THEN
        RETURN jsonb_build_object(
            'error',   'challenge_not_found',
            'message', 'Challenge not found'
        );
    END IF;

    IF v_challenge_status NOT IN ('pending', 'active') THEN
        RETURN jsonb_build_object(
            'error',   'invalid_status',
            'message', 'This challenge is no longer accepting participants'
        );
    END IF;

    -- 2. Look up the existing participant row (if any)
    SELECT status
      INTO v_user_status
      FROM public.challenge_participants
     WHERE challenge_id = p_challenge_id
       AND user_id      = p_user_id;

    v_row_exists := FOUND;

    IF v_user_status = 'accepted' THEN
        RETURN jsonb_build_object(
            'error',   'already_joined',
            'message', 'You have already joined this challenge'
        );
    END IF;

    -- 3. Debit coins BEFORE touching the participant row so a
    --    failed debit cannot leave the row in a half-accepted state.
    v_new_balance := public.debit_coins(
        p_user_id,
        v_entry_fee,
        'challenge_entry',
        'Joined challenge'
    );

    IF v_new_balance IS NULL OR v_new_balance = -1 THEN
        RETURN jsonb_build_object(
            'error',   'insufficient_coins',
            'message', 'Not enough coins to join challenge'
        );
    END IF;

    -- 4. Seed starting points from user_points (defaulting to 0)
    SELECT COALESCE(current_points, 0)
      INTO v_current_points
      FROM public.user_points
     WHERE user_id = p_user_id;

    v_current_points := COALESCE(v_current_points, 0);

    -- 5. Branch on whether the invite row already exists.
    --    UPSERT caused BEFORE INSERT triggers to fire on the
    --    existing-row path, which was the source of the silent
    --    failure — so we split it into two explicit branches.
    IF v_row_exists THEN
        UPDATE public.challenge_participants
           SET status           = 'accepted',
               accepted_at      = NOW(),
               starting_points  = v_current_points,
               current_points   = v_current_points,
               challenge_points = 0,
               has_paid         = TRUE,
               paid_at          = NOW(),
               weight_goal      = COALESCE(p_weight_goal, 'lose')
         WHERE challenge_id = p_challenge_id
           AND user_id      = p_user_id;
    ELSE
        INSERT INTO public.challenge_participants (
            challenge_id, user_id, status, accepted_at,
            starting_points, current_points, challenge_points,
            has_paid, paid_at, weight_goal
        ) VALUES (
            p_challenge_id, p_user_id, 'accepted', NOW(),
            v_current_points, v_current_points, 0,
            TRUE, NOW(),
            COALESCE(p_weight_goal, 'lose')
        );
    END IF;

    -- 6. Auto-start challenge if 2+ participants are accepted
    IF v_challenge_status = 'pending' THEN
        PERFORM public.start_challenge(p_challenge_id);
    END IF;

    RAISE NOTICE '[JoinChallenge] Success. New balance: %', v_new_balance;

    RETURN jsonb_build_object(
        'success',     true,
        'new_balance', v_new_balance
    );

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[JoinChallenge] CRITICAL: % (%)', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
        'error',    'internal_error',
        'message',  SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.join_wellness_challenge(UUID, UUID, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- 2. ADMIN HELPER: force_accept_challenge
-- ------------------------------------------------------------
-- One-shot helper to manually push a stuck user into 'accepted'
-- and debit their entry fee. Usage from the Supabase SQL editor:
--
--   SELECT public.force_accept_challenge(
--     'ryan@example.com',
--     '<challenge-uuid>'
--   );
--
-- If the user has fewer coins than the entry fee their balance
-- is clamped to 0 instead of erroring out, because the whole
-- point of this helper is to unstick the client.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.force_accept_challenge(TEXT, UUID);
CREATE OR REPLACE FUNCTION public.force_accept_challenge(
    p_user_email   TEXT,
    p_challenge_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_user_id       UUID;
    v_entry_fee     INTEGER;
    v_current_bal   INTEGER;
    v_debit_amount  INTEGER;
    v_new_balance   INTEGER;
    v_current_pts   INTEGER;
    v_row_exists    BOOLEAN;
BEGIN
    SELECT id, COALESCE(coin_balance, 0)
      INTO v_user_id, v_current_bal
      FROM public.users
     WHERE LOWER(email) = LOWER(p_user_email);

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'error',   'user_not_found',
            'message', 'No user with email ' || p_user_email
        );
    END IF;

    SELECT COALESCE(entry_fee, 0)
      INTO v_entry_fee
      FROM public.challenges
     WHERE id = p_challenge_id;

    IF v_entry_fee IS NULL THEN
        RETURN jsonb_build_object(
            'error',   'challenge_not_found',
            'message', 'Challenge ' || p_challenge_id || ' not found'
        );
    END IF;

    -- Clamp debit to whatever the user actually has
    v_debit_amount := LEAST(v_current_bal, v_entry_fee);
    v_new_balance  := v_current_bal - v_debit_amount;

    UPDATE public.users
       SET coin_balance = v_new_balance
     WHERE id = v_user_id;

    IF v_debit_amount > 0 THEN
        INSERT INTO public.coin_transactions (
            user_id, amount, balance_after,
            transaction_type, description, reference_id
        ) VALUES (
            v_user_id, -v_debit_amount, v_new_balance,
            'challenge_entry',
            'Force-accepted challenge (manual unstick)',
            p_challenge_id::TEXT
        );
    END IF;

    SELECT COALESCE(current_points, 0)
      INTO v_current_pts
      FROM public.user_points
     WHERE user_id = v_user_id;

    v_current_pts := COALESCE(v_current_pts, 0);

    SELECT TRUE
      INTO v_row_exists
      FROM public.challenge_participants
     WHERE challenge_id = p_challenge_id
       AND user_id      = v_user_id;

    IF v_row_exists THEN
        UPDATE public.challenge_participants
           SET status           = 'accepted',
               accepted_at      = NOW(),
               starting_points  = v_current_pts,
               current_points   = v_current_pts,
               challenge_points = 0,
               has_paid         = TRUE,
               paid_at           = NOW()
         WHERE challenge_id = p_challenge_id
           AND user_id      = v_user_id;
    ELSE
        INSERT INTO public.challenge_participants (
            challenge_id, user_id, status, accepted_at,
            starting_points, current_points, challenge_points,
            has_paid, paid_at
        ) VALUES (
            p_challenge_id, v_user_id, 'accepted', NOW(),
            v_current_pts, v_current_pts, 0,
            TRUE, NOW()
        );
    END IF;

    -- Start the challenge if enough accepted participants
    PERFORM public.start_challenge(p_challenge_id);

    RETURN jsonb_build_object(
        'success',       true,
        'user_id',       v_user_id,
        'debited',       v_debit_amount,
        'new_balance',   v_new_balance,
        'challenge_id',  p_challenge_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Intentionally NOT granted to `authenticated` — this is an
-- admin-only escape hatch, runnable from the Supabase SQL editor.
REVOKE ALL ON FUNCTION public.force_accept_challenge(TEXT, UUID) FROM PUBLIC;

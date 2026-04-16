-- ============================================================
-- MONTHLY RAFFLE MIGRATION
--
-- Each month has a shared-pool raffle:
--   * First 3 days of the month = signup window.
--   * Every entrant pays the featured rare's buy-in into the pool.
--   * When signups close, one random entrant wins the whole pool
--     plus the month's rare skin.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- 1. Allow 'raffle_entry' / 'raffle_win' coin transaction types.
--    (Keeps every other existing type.)
ALTER TABLE public.coin_transactions
    DROP CONSTRAINT IF EXISTS coin_transactions_transaction_type_check;

ALTER TABLE public.coin_transactions
    ADD CONSTRAINT coin_transactions_transaction_type_check
    CHECK (transaction_type IN (
        'pack_purchase',
        'challenge_entry',
        'challenge_win',
        'battle_bet',
        'battle_win',
        'character_purchase',
        'cosmetic_purchase',
        'refund',
        'admin_grant',
        'welcome_bonus',
        'referral_bonus',
        'daily_reward',
        'raffle_entry',
        'raffle_win'
    ));

-- 2. Raffle header row, one per month.
CREATE TABLE IF NOT EXISTS public.monthly_raffles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month_key TEXT NOT NULL UNIQUE,         -- 'YYYY-MM'
    featured_rare_id TEXT NOT NULL,         -- id from RARE_COLLECTION
    entry_fee INTEGER NOT NULL,             -- locked in at creation
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'drawn')),
    winner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    winner_pool INTEGER,
    drawn_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monthly_raffles_status
    ON public.monthly_raffles(status);

-- 3. One row per entrant per month.
CREATE TABLE IF NOT EXISTS public.raffle_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raffle_id UUID NOT NULL REFERENCES public.monthly_raffles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    entry_fee INTEGER NOT NULL,
    entered_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (raffle_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_raffle_entries_user
    ON public.raffle_entries(user_id);

-- 4. RLS: anyone signed-in can read raffle summaries and their own entries.
ALTER TABLE public.monthly_raffles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raffle_entries   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read raffles" ON public.monthly_raffles;
CREATE POLICY "Authenticated can read raffles" ON public.monthly_raffles
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can read own raffle entries" ON public.raffle_entries;
CREATE POLICY "Users can read own raffle entries" ON public.raffle_entries
    FOR SELECT USING (auth.uid() = user_id);

-- Writes happen only through SECURITY DEFINER RPCs below.

-- 5. Read the current state of a month's raffle (for the calling user).
--    Creates the raffle row lazily on first read so the frontend doesn't
--    have to seed it separately.
DROP FUNCTION IF EXISTS get_monthly_raffle_state(TEXT, TEXT, INTEGER);
CREATE OR REPLACE FUNCTION get_monthly_raffle_state(
    p_month_key TEXT,
    p_featured_rare_id TEXT,
    p_entry_fee INTEGER
)
RETURNS JSONB AS $$
DECLARE
    r_id UUID;
    r_status TEXT;
    r_featured TEXT;
    r_entry_fee INTEGER;
    r_winner UUID;
    r_pool INTEGER;
    participants_count INTEGER;
    caller_joined BOOLEAN;
BEGIN
    -- Lazy insert so repeat calls converge.
    INSERT INTO public.monthly_raffles (month_key, featured_rare_id, entry_fee)
    VALUES (p_month_key, p_featured_rare_id, p_entry_fee)
    ON CONFLICT (month_key) DO NOTHING;

    SELECT id, status, featured_rare_id, entry_fee, winner_id, winner_pool
    INTO r_id, r_status, r_featured, r_entry_fee, r_winner, r_pool
    FROM public.monthly_raffles
    WHERE month_key = p_month_key;

    SELECT COUNT(*) INTO participants_count
    FROM public.raffle_entries
    WHERE raffle_id = r_id;

    SELECT EXISTS (
        SELECT 1 FROM public.raffle_entries
        WHERE raffle_id = r_id AND user_id = auth.uid()
    ) INTO caller_joined;

    RETURN jsonb_build_object(
        'month_key',         p_month_key,
        'raffle_id',         r_id,
        'status',            r_status,
        'featured_rare_id',  r_featured,
        'entry_fee',         r_entry_fee,
        'participants',      participants_count,
        'pool',              participants_count * r_entry_fee,
        'joined',            caller_joined,
        'winner_id',         r_winner,
        'winner_pool',       r_pool
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_monthly_raffle_state(TEXT, TEXT, INTEGER) TO authenticated;

-- 6. Atomic join: debit coins + insert entry in one shot.
DROP FUNCTION IF EXISTS join_monthly_raffle(TEXT, TEXT, INTEGER);
CREATE OR REPLACE FUNCTION join_monthly_raffle(
    p_month_key TEXT,
    p_featured_rare_id TEXT,
    p_entry_fee INTEGER
)
RETURNS JSONB AS $$
DECLARE
    r_id UUID;
    r_status TEXT;
    r_entry_fee INTEGER;
    new_balance INTEGER;
    participants_count INTEGER;
BEGIN
    INSERT INTO public.monthly_raffles (month_key, featured_rare_id, entry_fee)
    VALUES (p_month_key, p_featured_rare_id, p_entry_fee)
    ON CONFLICT (month_key) DO NOTHING;

    SELECT id, status, entry_fee
    INTO r_id, r_status, r_entry_fee
    FROM public.monthly_raffles
    WHERE month_key = p_month_key
    FOR UPDATE;

    IF r_status <> 'open' THEN
        RETURN jsonb_build_object('error', 'closed',
            'message', 'Signups for this raffle are closed.');
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.raffle_entries
        WHERE raffle_id = r_id AND user_id = auth.uid()
    ) THEN
        SELECT COUNT(*) INTO participants_count
        FROM public.raffle_entries WHERE raffle_id = r_id;
        RETURN jsonb_build_object(
            'error', 'already_joined',
            'message', 'You are already entered in this raffle.',
            'participants', participants_count,
            'pool', participants_count * r_entry_fee
        );
    END IF;

    -- Debit the locked-in fee (not the caller-supplied one, to prevent
    -- price manipulation if the frontend is tampered with).
    new_balance := debit_coins(
        auth.uid(),
        r_entry_fee,
        'raffle_entry',
        'Monthly raffle entry — ' || p_month_key,
        p_month_key
    );

    IF new_balance = -1 THEN
        RETURN jsonb_build_object(
            'error', 'insufficient_coins',
            'message', 'Not enough coins to enter.',
            'required', r_entry_fee
        );
    END IF;

    INSERT INTO public.raffle_entries (raffle_id, user_id, entry_fee)
    VALUES (r_id, auth.uid(), r_entry_fee);

    SELECT COUNT(*) INTO participants_count
    FROM public.raffle_entries WHERE raffle_id = r_id;

    RETURN jsonb_build_object(
        'success',      TRUE,
        'new_balance',  new_balance,
        'participants', participants_count,
        'pool',         participants_count * r_entry_fee
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION join_monthly_raffle(TEXT, TEXT, INTEGER) TO authenticated;

-- 7. Draw a winner for a month whose signup window has passed.
--    Idempotent: once a raffle is 'drawn' it stays that way and the RPC
--    just returns the existing result. Anyone can trigger the draw; the
--    first caller for a ready-to-draw raffle triggers the payout.
DROP FUNCTION IF EXISTS draw_monthly_raffle(TEXT);
CREATE OR REPLACE FUNCTION draw_monthly_raffle(p_month_key TEXT)
RETURNS JSONB AS $$
DECLARE
    r_id UUID;
    r_status TEXT;
    r_featured TEXT;
    r_entry_fee INTEGER;
    r_winner UUID;
    r_pool INTEGER;
    picked_user UUID;
    participants_count INTEGER;
    payout INTEGER;
    month_year INTEGER;
    month_month INTEGER;
    signup_close_date DATE;
BEGIN
    SELECT id, status, featured_rare_id, entry_fee, winner_id, winner_pool
    INTO r_id, r_status, r_featured, r_entry_fee, r_winner, r_pool
    FROM public.monthly_raffles
    WHERE month_key = p_month_key
    FOR UPDATE;

    IF r_id IS NULL THEN
        RETURN jsonb_build_object('error', 'not_found');
    END IF;

    IF r_status = 'drawn' THEN
        RETURN jsonb_build_object(
            'already_drawn',   TRUE,
            'winner_id',       r_winner,
            'winner_pool',     r_pool,
            'featured_rare_id', r_featured
        );
    END IF;

    -- Must be past the signup window (day >= 4 of that month, or later month).
    month_year  := split_part(p_month_key, '-', 1)::INTEGER;
    month_month := split_part(p_month_key, '-', 2)::INTEGER;
    signup_close_date := make_date(month_year, month_month, 4);

    IF CURRENT_DATE < signup_close_date THEN
        RETURN jsonb_build_object('error', 'signups_open');
    END IF;

    SELECT COUNT(*) INTO participants_count
    FROM public.raffle_entries WHERE raffle_id = r_id;

    IF participants_count = 0 THEN
        UPDATE public.monthly_raffles
        SET status = 'drawn', drawn_at = NOW(), winner_pool = 0
        WHERE id = r_id;
        RETURN jsonb_build_object(
            'drawn',           TRUE,
            'no_entrants',     TRUE,
            'featured_rare_id', r_featured
        );
    END IF;

    SELECT user_id INTO picked_user
    FROM public.raffle_entries
    WHERE raffle_id = r_id
    ORDER BY random()
    LIMIT 1;

    payout := participants_count * r_entry_fee;

    PERFORM credit_coins(
        picked_user,
        payout,
        'raffle_win',
        'Monthly raffle payout — ' || p_month_key,
        p_month_key
    );

    UPDATE public.monthly_raffles
    SET status = 'drawn',
        winner_id = picked_user,
        winner_pool = payout,
        drawn_at = NOW()
    WHERE id = r_id;

    RETURN jsonb_build_object(
        'drawn',            TRUE,
        'winner_id',        picked_user,
        'winner_pool',      payout,
        'participants',     participants_count,
        'featured_rare_id', r_featured
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION draw_monthly_raffle(TEXT) TO authenticated;

-- 8. Convenience: let a user look up their own prior winning raffles so
--    the frontend can trigger the unlock celebration / equip flow after
--    someone else did the draw while they were offline.
DROP FUNCTION IF EXISTS get_unclaimed_raffle_wins();
CREATE OR REPLACE FUNCTION get_unclaimed_raffle_wins()
RETURNS TABLE (
    month_key TEXT,
    featured_rare_id TEXT,
    winner_pool INTEGER,
    drawn_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT mr.month_key, mr.featured_rare_id, mr.winner_pool, mr.drawn_at
    FROM public.monthly_raffles mr
    WHERE mr.winner_id = auth.uid()
      AND mr.status = 'drawn'
    ORDER BY mr.drawn_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_unclaimed_raffle_wins() TO authenticated;

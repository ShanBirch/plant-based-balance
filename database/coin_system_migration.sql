-- Coin System Migration
-- Virtual currency for challenges, battles, and shop purchases

-- Add coin balance to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS coin_balance INTEGER DEFAULT 0;

-- Coin transaction log (audit trail)
CREATE TABLE IF NOT EXISTS public.coin_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,  -- positive = credit, negative = debit
    balance_after INTEGER NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
        'pack_purchase',       -- bought coins with real money
        'challenge_entry',     -- paid to enter a challenge
        'challenge_win',       -- bonus coins for winning a challenge
        'battle_bet',          -- coins wagered on a battle
        'battle_win',          -- coins won from a battle
        'character_purchase',  -- bought a character
        'cosmetic_purchase',   -- bought a cosmetic item
        'refund',              -- refund from cancelled challenge etc
        'admin_grant'          -- manually granted by admin
    )),
    description TEXT,
    reference_id TEXT,  -- challenge_id, battle nudge id, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coin_transactions_user ON public.coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_type ON public.coin_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_date ON public.coin_transactions(created_at DESC);

-- Add coin bet columns to nudges table for battle betting
ALTER TABLE public.nudges
ADD COLUMN IF NOT EXISTS coin_bet INTEGER DEFAULT 0;

-- RLS for coin_transactions
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON public.coin_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can insert transactions" ON public.coin_transactions
    FOR INSERT WITH CHECK (true);

-- Function to credit coins (used by webhook after Stripe purchase)
CREATE OR REPLACE FUNCTION credit_coins(
    user_uuid UUID,
    coin_amount INTEGER,
    txn_type TEXT DEFAULT 'pack_purchase',
    txn_description TEXT DEFAULT NULL,
    txn_reference TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    new_balance INTEGER;
BEGIN
    -- Update balance
    UPDATE public.users
    SET coin_balance = COALESCE(coin_balance, 0) + coin_amount
    WHERE id = user_uuid
    RETURNING coin_balance INTO new_balance;

    -- Log transaction
    INSERT INTO public.coin_transactions (user_id, amount, balance_after, transaction_type, description, reference_id)
    VALUES (user_uuid, coin_amount, new_balance, txn_type, txn_description, txn_reference);

    RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION credit_coins(UUID, INTEGER, TEXT, TEXT, TEXT) TO authenticated;

-- Function to debit coins (returns new balance, or -1 if insufficient)
CREATE OR REPLACE FUNCTION debit_coins(
    user_uuid UUID,
    coin_amount INTEGER,
    txn_type TEXT,
    txn_description TEXT DEFAULT NULL,
    txn_reference TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    current_bal INTEGER;
    new_balance INTEGER;
BEGIN
    -- Get current balance with row lock
    SELECT COALESCE(coin_balance, 0) INTO current_bal
    FROM public.users
    WHERE id = user_uuid
    FOR UPDATE;

    -- Check sufficient balance
    IF current_bal < coin_amount THEN
        RETURN -1;
    END IF;

    -- Debit
    new_balance := current_bal - coin_amount;
    UPDATE public.users
    SET coin_balance = new_balance
    WHERE id = user_uuid;

    -- Log transaction
    INSERT INTO public.coin_transactions (user_id, amount, balance_after, transaction_type, description, reference_id)
    VALUES (user_uuid, -coin_amount, new_balance, txn_type, txn_description, txn_reference);

    RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION debit_coins(UUID, INTEGER, TEXT, TEXT, TEXT) TO authenticated;

-- Function to process battle bet (debit from loser, credit to winner)
CREATE OR REPLACE FUNCTION settle_battle_bet(
    winner_uuid UUID,
    loser_uuid UUID,
    bet_amount INTEGER,
    battle_reference TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    winner_new_bal INTEGER;
    loser_new_bal INTEGER;
BEGIN
    -- Credit winner
    winner_new_bal := credit_coins(
        winner_uuid, bet_amount,
        'battle_win',
        'Won battle bet of ' || bet_amount || ' coins',
        battle_reference
    );

    RETURN jsonb_build_object(
        'winner_balance', winner_new_bal,
        'bet_amount', bet_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION settle_battle_bet(UUID, UUID, INTEGER, TEXT) TO authenticated;

-- Function to get user's coin balance
CREATE OR REPLACE FUNCTION get_coin_balance(user_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN COALESCE(
        (SELECT coin_balance FROM public.users WHERE id = user_uuid),
        0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_coin_balance(UUID) TO authenticated;

-- Update cosmetic_items to include characters and add coin_price
ALTER TABLE public.cosmetic_items
ADD COLUMN IF NOT EXISTS coin_price INTEGER DEFAULT 0;

-- Update existing items with prices and add characters
UPDATE public.cosmetic_items SET coin_price = 100 WHERE rarity = 'common';
UPDATE public.cosmetic_items SET coin_price = 400 WHERE rarity = 'uncommon';
UPDATE public.cosmetic_items SET coin_price = 600 WHERE rarity = 'rare';
UPDATE public.cosmetic_items SET coin_price = 1200 WHERE rarity = 'legendary';

-- Add character items
INSERT INTO public.cosmetic_items (name, description, item_type, rarity, coin_price, season) VALUES
    -- Common characters (300 coins)
    ('Leafy', 'A cheerful leaf creature', 'character', 'common', 300, 'launch'),
    ('Berry', 'A round berry buddy', 'character', 'common', 300, 'launch'),
    ('Sunny', 'A happy sunflower character', 'character', 'common', 300, 'launch'),
    ('Mushi', 'A cute mushroom friend', 'character', 'common', 300, 'launch'),
    -- Rare characters (600 coins)
    ('Zen Fox', 'A meditating fox warrior', 'character', 'rare', 600, 'launch'),
    ('Iron Panda', 'A muscular panda fighter', 'character', 'rare', 600, 'launch'),
    ('Coco', 'A coconut warrior', 'character', 'rare', 600, 'launch'),
    ('Blaze', 'A fire pepper character', 'character', 'rare', 600, 'launch'),
    -- Legendary characters (1200 coins)
    ('Dragon Fruit', 'An actual tiny dragon', 'character', 'legendary', 1200, 'launch'),
    ('Golden Lotus', 'A glowing lotus spirit', 'character', 'legendary', 1200, 'launch'),
    ('Storm Broccoli', 'Broccoli with lightning aura', 'character', 'legendary', 1200, 'launch'),
    ('Phoenix Chilli', 'A fiery phoenix warrior', 'character', 'legendary', 1200, 'launch')
ON CONFLICT DO NOTHING;

-- Also update the check constraint on item_type to include 'character'
ALTER TABLE public.cosmetic_items DROP CONSTRAINT IF EXISTS cosmetic_items_item_type_check;
ALTER TABLE public.cosmetic_items ADD CONSTRAINT cosmetic_items_item_type_check
    CHECK (item_type IN ('avatar_border', 'profile_badge', 'profile_background', 'name_color', 'reaction_emoji', 'post_frame', 'victory_animation', 'trophy', '3d_prop', 'character'));

-- Function to purchase a cosmetic/character with coins
CREATE OR REPLACE FUNCTION purchase_item(
    user_uuid UUID,
    target_item_id UUID
)
RETURNS JSONB AS $$
DECLARE
    item_price INTEGER;
    item_name_val TEXT;
    new_bal INTEGER;
    already_owned BOOLEAN;
BEGIN
    -- Check if already owned
    SELECT EXISTS (
        SELECT 1 FROM public.user_inventory
        WHERE user_id = user_uuid AND item_id = target_item_id
    ) INTO already_owned;

    IF already_owned THEN
        RETURN jsonb_build_object('error', 'already_owned', 'message', 'You already own this item');
    END IF;

    -- Get item price
    SELECT coin_price, name INTO item_price, item_name_val
    FROM public.cosmetic_items
    WHERE id = target_item_id AND is_active = TRUE;

    IF item_price IS NULL THEN
        RETURN jsonb_build_object('error', 'not_found', 'message', 'Item not found');
    END IF;

    -- Debit coins
    new_bal := debit_coins(
        user_uuid, item_price,
        CASE WHEN (SELECT item_type FROM public.cosmetic_items WHERE id = target_item_id) = 'character'
            THEN 'character_purchase' ELSE 'cosmetic_purchase' END,
        'Purchased: ' || item_name_val,
        target_item_id::TEXT
    );

    IF new_bal = -1 THEN
        RETURN jsonb_build_object('error', 'insufficient_coins', 'message', 'Not enough coins', 'required', item_price);
    END IF;

    -- Add to inventory
    INSERT INTO public.user_inventory (user_id, item_id, source)
    VALUES (user_uuid, target_item_id, 'purchase')
    ON CONFLICT (user_id, item_id) DO NOTHING;

    RETURN jsonb_build_object(
        'success', TRUE,
        'item_name', item_name_val,
        'new_balance', new_bal
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION purchase_item(UUID, UUID) TO authenticated;

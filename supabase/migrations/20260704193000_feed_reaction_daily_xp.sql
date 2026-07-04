-- Award Feed reaction XP at most once per user per local day.

CREATE UNIQUE INDEX IF NOT EXISTS idx_point_transactions_feed_reaction_daily_unique
ON public.point_transactions(user_id, transaction_type, reference_type)
WHERE transaction_type = 'earn_feed_reaction';

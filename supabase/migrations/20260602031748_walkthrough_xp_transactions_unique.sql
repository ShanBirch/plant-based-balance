-- Make walkthrough checkpoint XP idempotent at the database layer.
--
-- The edge function maps client refs like "walkthrough:intro" to stable UUIDs
-- before writing point_transactions.reference_id because that column is UUID.
CREATE UNIQUE INDEX IF NOT EXISTS idx_point_transactions_walkthrough_unique
  ON public.point_transactions(user_id, transaction_type, reference_id)
  WHERE transaction_type = 'earn_walkthrough'
    AND reference_id IS NOT NULL;

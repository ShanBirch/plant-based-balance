-- Transferred Client Migration
-- Adds a flag so the dashboard can route migrated clients (from Trainerize / other apps)
-- through a trimmed setup flow: set password -> design Fitgotchi -> guided tour.
-- The rest of the onboarding wizard is skipped because their data is pre-filled by the
-- import script (scripts/transfer_kylie.js and friends).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_transferred_client BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.users.is_transferred_client IS
  'TRUE if user was imported from another platform with pre-filled data. Dashboard skips the full onboarding wizard and jumps to character customization + tour instead. Cleared to FALSE once they complete character setup.';

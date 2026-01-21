-- Migration: Add biometric_credential_id column to users table
-- This allows biometric login preferences to persist in the database
-- instead of only being stored in localStorage which can be cleared

-- Add the biometric_credential_id column
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS biometric_credential_id TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.users.biometric_credential_id IS 'Base64-encoded WebAuthn credential ID for biometric login persistence';

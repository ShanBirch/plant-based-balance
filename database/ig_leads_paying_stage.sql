-- Add 'paying' funnel stage to ig_threads.lead_stage.
--
-- The original ig_inbound_migration.sql defines a CHECK constraint with
-- (new, qualifying, invited, in_app, churned). 'in_app' covers everyone
-- who signed up — including free users. We need a separate 'paying' bucket
-- so the admin dashboard can track who actually converted to a paying client
-- (subscription active) versus who just downloaded the free app.
--
-- Safe to re-run.

ALTER TABLE public.ig_threads
    DROP CONSTRAINT IF EXISTS ig_threads_lead_stage_check;

ALTER TABLE public.ig_threads
    ADD CONSTRAINT ig_threads_lead_stage_check
    CHECK (lead_stage IN (
        'new',           -- cold inbound, no prior context
        'qualifying',    -- a few back-and-forth, gauging fit
        'invited',       -- pitched the wellness challenge / app invite
        'in_app',        -- signed up to the free app
        'paying',        -- converted to paying subscriber ($29/wk)
        'churned'        -- went cold / explicitly opted out
    ));

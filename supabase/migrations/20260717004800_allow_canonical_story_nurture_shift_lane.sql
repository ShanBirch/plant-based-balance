-- Allow the sticky Story scheduler to acquire its canonical lane while
-- retaining the two legacy lane names for migration/readback compatibility.

ALTER TABLE public.ig_browser_shift_runs
    DROP CONSTRAINT IF EXISTS ig_browser_shift_runs_lane_check;

ALTER TABLE public.ig_browser_shift_runs
    ADD CONSTRAINT ig_browser_shift_runs_lane_check CHECK (lane IN (
        'story_nurture',
        'ranked_story_nurture',
        'follower_notifications',
        'hot_lead_feed_nurture',
        'external_comment_and_mention_replies',
        'story_tray_discovery',
        'plant_based_discovery_follows',
        'missed_dm_audit',
        'active_client_instagram_community'
    ));

DO $migration$
DECLARE
    v_definition TEXT;
BEGIN
    SELECT pg_get_functiondef(p.oid)
    INTO v_definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'start_ig_browser_shift'
      AND pg_get_function_identity_arguments(p.oid) =
          'p_run_id text, p_lane text, p_slot integer, p_cursor_start jsonb, p_lease_seconds integer';

    IF v_definition IS NULL THEN
        RAISE EXCEPTION 'public.start_ig_browser_shift signature not found';
    END IF;

    IF position(E'''story_nurture'',\n        ''ranked_story_nurture''' IN v_definition) = 0 THEN
        v_definition := replace(
            v_definition,
            E'''ranked_story_nurture'',',
            E'''story_nurture'',\n        ''ranked_story_nurture'','
        );
        EXECUTE v_definition;
    END IF;
END
$migration$;

-- Persist the weighted Story lanes under their real dispatcher contract names.
-- Legacy lanes remain accepted for historical rows and unrelated operators.

ALTER TABLE public.ig_browser_shift_runs
    DROP CONSTRAINT IF EXISTS ig_browser_shift_runs_lane_check;

ALTER TABLE public.ig_browser_shift_runs
    ADD CONSTRAINT ig_browser_shift_runs_lane_check CHECK (lane IN (
        'story_nurture',
        'relationship_story_reactivation',
        'ranked_story_nurture',
        'story_viewer_nurture',
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

    IF position(E'''relationship_story_reactivation'',' IN v_definition) = 0 THEN
        v_definition := replace(
            v_definition,
            E'''story_nurture'',\n        ''ranked_story_nurture'',',
            E'''story_nurture'',\n        ''relationship_story_reactivation'',\n        ''ranked_story_nurture'','
        );
    END IF;

    IF position(E'''story_viewer_nurture'',' IN v_definition) = 0 THEN
        v_definition := replace(
            v_definition,
            E'''ranked_story_nurture'',\n        ''follower_notifications'',',
            E'''ranked_story_nurture'',\n        ''story_viewer_nurture'',\n        ''follower_notifications'','
        );
    END IF;

    EXECUTE v_definition;
END
$migration$;

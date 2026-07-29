-- Tahlia is a lightweight community commenter only. Remove her authored Feed
-- posts and stale approval drafts, then enforce one Tahlia comment per post.

DO $$
DECLARE
    v_tahlia_id UUID;
BEGIN
    SELECT id
      INTO v_tahlia_id
      FROM public.users
     WHERE lower(email) = 'seed.tahlia.brooks+kayla30@plantbased-balance.org'
     LIMIT 1;

    IF v_tahlia_id IS NULL THEN
        RAISE NOTICE 'Tahlia user not found; no Feed cleanup required';
        RETURN;
    END IF;

    -- The request is to remove every Tahlia-authored Feed post. Related rows
    -- are removed through the existing story foreign-key cascades.
    DELETE FROM public.stories
     WHERE user_id = v_tahlia_id;

    -- Retire duplicate legacy comments before adding the durable guard. Keep
    -- the earliest comment so existing conversations remain stable.
    DELETE FROM public.feed_comments
     WHERE id IN (
         SELECT id
           FROM (
               SELECT id,
                      row_number() OVER (
                          PARTITION BY story_id, user_id
                          ORDER BY created_at ASC NULLS LAST, id ASC
                      ) AS position
                 FROM public.feed_comments
                WHERE user_id = v_tahlia_id
           ) ranked
          WHERE position > 1
     );

    -- Bring already-published long comments into the same tiny reaction
    -- contract so the live Feed is consistent immediately.
    WITH long_comments AS (
        SELECT id,
               row_number() OVER (ORDER BY created_at ASC NULLS LAST, id ASC) AS position
          FROM public.feed_comments
         WHERE user_id = v_tahlia_id
           AND cardinality(regexp_split_to_array(trim(comment_text), E'\\s+')) > 3
    )
    UPDATE public.feed_comments comments
       SET comment_text = CASE mod(long_comments.position - 1, 3)
           WHEN 0 THEN 'love this'
           WHEN 1 THEN 'amazing work'
           ELSE 'good job'
       END
      FROM long_comments
     WHERE comments.id = long_comments.id;

    EXECUTE format(
        'CREATE UNIQUE INDEX IF NOT EXISTS uq_feed_comments_tahlia_one_per_story ON public.feed_comments (story_id) WHERE user_id = %L',
        v_tahlia_id
    );
END
$$;

UPDATE public.coach_alerts
   SET status = 'dismissed',
       actioned_at = COALESCE(actioned_at, now()),
       data = COALESCE(data, '{}'::jsonb) || jsonb_build_object(
           'dismiss_reason', 'tahlia_comments_only',
           'dismissed_at', now(),
           'operator_queue', 'retired',
           'needs_you_required', false,
           'needs_shannon_approval', false
       )
 WHERE status = 'pending'
   AND client_name = 'Tahlia Brooks'
   AND (
       data->>'source' = 'tahlia-social-worker'
       OR data->>'subtype' = 'tahlia_social_approval'
       OR data->>'tahlia_profile_key' = 'tahlia_brooks'
   );

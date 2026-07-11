-- Feed comment mentions
-- Stores explicit user tags for Feed comments while keeping the visible text as @handles.

CREATE TABLE IF NOT EXISTS public.feed_comment_mentions (
  comment_id UUID NOT NULL REFERENCES public.feed_comments(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_comment_mentions_mentioned_user_id
  ON public.feed_comment_mentions(mentioned_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feed_comment_mentions_comment_id
  ON public.feed_comment_mentions(comment_id);

ALTER TABLE public.feed_comment_mentions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON TABLE public.feed_comment_mentions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.feed_comment_mentions TO service_role;

DROP POLICY IF EXISTS "Users can view feed comment mentions" ON public.feed_comment_mentions;
CREATE POLICY "Users can view feed comment mentions" ON public.feed_comment_mentions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.feed_comments fc
      WHERE fc.id = feed_comment_mentions.comment_id
    )
  );

DROP POLICY IF EXISTS "Users can tag people from their own comments" ON public.feed_comment_mentions;
CREATE POLICY "Users can tag people from their own comments" ON public.feed_comment_mentions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.feed_comments fc
      WHERE fc.id = feed_comment_mentions.comment_id
        AND fc.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can remove tags from their own comments" ON public.feed_comment_mentions;
CREATE POLICY "Users can remove tags from their own comments" ON public.feed_comment_mentions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.feed_comments fc
      WHERE fc.id = feed_comment_mentions.comment_id
        AND fc.user_id = (SELECT auth.uid())
    )
  );

DROP FUNCTION IF EXISTS public.get_story_comments(UUID, INT);
CREATE OR REPLACE FUNCTION public.get_story_comments(p_story_id UUID, p_limit INT DEFAULT 20)
RETURNS TABLE(
  comment_id UUID,
  user_id UUID,
  user_name TEXT,
  profile_photo TEXT,
  comment_text TEXT,
  created_at TIMESTAMPTZ,
  like_count BIGINT,
  liked_by_me BOOLEAN,
  mentions JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fc.id AS comment_id,
    fc.user_id,
    COALESCE(NULLIF(BTRIM(u.name), ''), NULLIF(SPLIT_PART(u.email, '@', 1), ''), 'Unknown')::TEXT AS user_name,
    u.profile_photo::TEXT AS profile_photo,
    fc.comment_text,
    fc.created_at,
    (
      SELECT COUNT(*)::BIGINT
      FROM public.feed_comment_likes fcl
      WHERE fcl.comment_id = fc.id
    ) AS like_count,
    EXISTS (
      SELECT 1
      FROM public.feed_comment_likes fcl
      WHERE fcl.comment_id = fc.id
        AND fcl.user_id = auth.uid()
    ) AS liked_by_me,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', mention_profile.id,
            'name', mention_profile.name,
            'profile_photo', mention_profile.profile_photo
          )
          ORDER BY mention_profile.name
        )
        FROM (
          SELECT DISTINCT
            au.id,
            COALESCE(NULLIF(BTRIM(u2.name), ''), NULLIF(SPLIT_PART(u2.email, '@', 1), ''), 'Member')::TEXT AS name,
            COALESCE(u2.profile_photo, '')::TEXT AS profile_photo
          FROM public.feed_comment_mentions fcm
          JOIN auth.users au ON au.id = fcm.mentioned_user_id
          LEFT JOIN public.users u2 ON u2.id = fcm.mentioned_user_id
          WHERE fcm.comment_id = fc.id
        ) mention_profile
      ),
      '[]'::jsonb
    ) AS mentions
  FROM public.feed_comments fc
  LEFT JOIN public.users u ON u.id = fc.user_id
  WHERE fc.story_id = p_story_id
  ORDER BY fc.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
END;
$$;

CREATE OR REPLACE FUNCTION public.add_feed_comment_with_mentions(
  p_story_id UUID,
  p_comment_text TEXT,
  p_mentioned_user_ids UUID[] DEFAULT '{}'::UUID[]
)
RETURNS TABLE(
  comment_id UUID,
  user_id UUID,
  user_name TEXT,
  profile_photo TEXT,
  comment_text TEXT,
  created_at TIMESTAMPTZ,
  like_count BIGINT,
  liked_by_me BOOLEAN,
  mentions JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_comment_id UUID;
  v_comment_text TEXT := BTRIM(COALESCE(p_comment_text, ''));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF v_comment_text = '' OR CHAR_LENGTH(v_comment_text) > 500 THEN
    RAISE EXCEPTION 'Comment must be between 1 and 500 characters' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.stories s WHERE s.id = p_story_id) THEN
    RAISE EXCEPTION 'Feed post not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.feed_comments (story_id, user_id, comment_text)
  VALUES (p_story_id, v_user_id, v_comment_text)
  RETURNING id INTO v_comment_id;

  INSERT INTO public.feed_comment_mentions (comment_id, mentioned_user_id)
  SELECT v_comment_id, mention_id
  FROM (
    SELECT DISTINCT UNNEST(COALESCE(p_mentioned_user_ids, '{}'::UUID[])) AS mention_id
  ) m
  JOIN auth.users au ON au.id = m.mention_id
  WHERE m.mention_id <> v_user_id
  -- The function exposes comment_id as an output column, so an unqualified
  -- conflict target is ambiguous inside this PL/pgSQL function. The table's
  -- primary key is the only conflict target, so the target can be omitted.
  ON CONFLICT DO NOTHING;

  RETURN QUERY
  SELECT *
  FROM public.get_story_comments(p_story_id, 100) gsc
  WHERE gsc.comment_id = v_comment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_story_comments(UUID, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_feed_comment_with_mentions(UUID, TEXT, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_story_comments(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_feed_comment_with_mentions(UUID, TEXT, UUID[]) TO authenticated;

COMMENT ON TABLE public.feed_comment_mentions IS
  'Explicit user tags extracted from visible @handles in Balance Feed comments.';

COMMENT ON FUNCTION public.add_feed_comment_with_mentions(UUID, TEXT, UUID[]) IS
  'Creates a Feed comment and stores the tagged users in one authenticated call.';

NOTIFY pgrst, 'reload schema';

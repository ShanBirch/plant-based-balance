-- Feed comment likes
-- Allows signed-in users to like comments on Balance Feed posts.

CREATE TABLE IF NOT EXISTS public.feed_comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.feed_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_comment_likes_comment_id
  ON public.feed_comment_likes(comment_id);

CREATE INDEX IF NOT EXISTS idx_feed_comment_likes_user_id
  ON public.feed_comment_likes(user_id);

ALTER TABLE public.feed_comment_likes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.feed_comment_likes FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Users can view feed comment likes" ON public.feed_comment_likes;
CREATE POLICY "Users can view feed comment likes" ON public.feed_comment_likes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create their own feed comment likes" ON public.feed_comment_likes;
CREATE POLICY "Users can create their own feed comment likes" ON public.feed_comment_likes
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own feed comment likes" ON public.feed_comment_likes;
CREATE POLICY "Users can delete their own feed comment likes" ON public.feed_comment_likes
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, DELETE ON public.feed_comment_likes TO authenticated;

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
  liked_by_me BOOLEAN
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
    COALESCE(NULLIF(BTRIM(u.name), ''), NULLIF(split_part(u.email, '@', 1), ''), 'Unknown')::TEXT AS user_name,
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
    ) AS liked_by_me
  FROM public.feed_comments fc
  LEFT JOIN public.users u ON u.id = fc.user_id
  WHERE fc.story_id = p_story_id
  ORDER BY fc.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
END;
$$;

DROP FUNCTION IF EXISTS public.toggle_feed_comment_like(UUID);
CREATE OR REPLACE FUNCTION public.toggle_feed_comment_like(p_comment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_removed_id UUID;
  v_like_count BIGINT := 0;
  v_liked_by_me BOOLEAN := FALSE;
  v_action TEXT := 'added';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.feed_comments fc
    WHERE fc.id = p_comment_id
  ) THEN
    RAISE EXCEPTION 'Feed comment not found' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.feed_comment_likes fcl
  WHERE fcl.comment_id = p_comment_id
    AND fcl.user_id = v_user_id
  RETURNING fcl.id INTO v_removed_id;

  IF v_removed_id IS NOT NULL THEN
    v_action := 'removed';
    v_liked_by_me := FALSE;
  ELSE
    INSERT INTO public.feed_comment_likes (comment_id, user_id)
    VALUES (p_comment_id, v_user_id)
    ON CONFLICT (comment_id, user_id) DO NOTHING;

    v_action := 'added';
    v_liked_by_me := TRUE;
  END IF;

  SELECT COUNT(*)::BIGINT
  INTO v_like_count
  FROM public.feed_comment_likes fcl
  WHERE fcl.comment_id = p_comment_id;

  RETURN jsonb_build_object(
    'action', v_action,
    'comment_id', p_comment_id,
    'like_count', v_like_count,
    'liked_by_me', v_liked_by_me
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_story_comments(UUID, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.toggle_feed_comment_like(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_story_comments(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_feed_comment_like(UUID) TO authenticated;

COMMENT ON TABLE public.feed_comment_likes IS
  'One-tap likes for comments on Balance Feed posts.';

COMMENT ON FUNCTION public.toggle_feed_comment_like(UUID) IS
  'Toggles the current authenticated user''s like on a Feed comment.';

NOTIFY pgrst, 'reload schema';

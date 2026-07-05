-- Record Feed post views through a small RPC so client-side RLS edge cases do
-- not block impression tracking. One viewer can count once per post.

CREATE OR REPLACE FUNCTION public.mark_story_viewed(p_story_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_viewer_id UUID := (SELECT auth.uid());
  v_story_owner_id UUID;
  v_inserted_count INTEGER := 0;
BEGIN
  IF v_viewer_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT s.user_id
  INTO v_story_owner_id
  FROM public.stories s
  WHERE s.id = p_story_id
    AND s.expires_at > NOW();

  IF v_story_owner_id IS NULL OR v_story_owner_id = v_viewer_id THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.story_views (story_id, viewer_id)
  VALUES (p_story_id, v_viewer_id)
  ON CONFLICT (story_id, viewer_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_story_viewed(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_story_viewed(UUID) TO authenticated;

COMMENT ON FUNCTION public.mark_story_viewed(UUID) IS
  'Records one private Feed post view per authenticated non-owner viewer and returns true only when a new view was inserted.';

NOTIFY pgrst, 'reload schema';

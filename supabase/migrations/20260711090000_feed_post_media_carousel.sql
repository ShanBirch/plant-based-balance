-- Ordered media items for multi-photo Feed posts.
-- stories.media_url remains the primary item for backwards compatibility.

CREATE TABLE IF NOT EXISTS public.feed_post_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  b2_file_name TEXT,
  b2_file_id TEXT,
  content_type TEXT,
  file_size_bytes BIGINT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (story_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_feed_post_media_story_order
  ON public.feed_post_media(story_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.feed_post_media TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.feed_post_media TO service_role;

ALTER TABLE public.feed_post_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view active feed post media" ON public.feed_post_media;
CREATE POLICY "Authenticated users can view active feed post media"
  ON public.feed_post_media FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stories s
    WHERE s.id = feed_post_media.story_id AND s.expires_at > NOW()
  ));

DROP POLICY IF EXISTS "Users can insert own feed post media" ON public.feed_post_media;
CREATE POLICY "Users can insert own feed post media"
  ON public.feed_post_media FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = feed_post_media.story_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own feed post media" ON public.feed_post_media;
CREATE POLICY "Users can update own feed post media"
  ON public.feed_post_media FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = feed_post_media.story_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own feed post media" ON public.feed_post_media;
CREATE POLICY "Users can delete own feed post media"
  ON public.feed_post_media FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_feed_post_media_updated_at ON public.feed_post_media;
CREATE TRIGGER update_feed_post_media_updated_at
  BEFORE UPDATE ON public.feed_post_media
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill existing image/video stories as the first carousel item.
INSERT INTO public.feed_post_media (story_id, user_id, media_type, media_url, thumbnail_url, sort_order, created_at, updated_at)
SELECT id, user_id, CASE WHEN media_type = 'video' THEN 'video' ELSE 'image' END,
       media_url, thumbnail_url, 0, created_at, NOW()
FROM public.stories
WHERE COALESCE(media_url, '') <> ''
  AND media_type IN ('image', 'video')
ON CONFLICT (story_id, sort_order) DO NOTHING;

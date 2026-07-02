-- Feed comment push notifications
-- Notifies the post owner when another user comments on their Feed post.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;

CREATE OR REPLACE FUNCTION private.notify_feed_comment_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_story_owner_id UUID;
  v_commenter_name TEXT;
  v_comment_text TEXT;
  v_comment_preview TEXT;
  v_site_url TEXT := 'https://plantbased-balance.org';
  v_request_id BIGINT;
BEGIN
  IF NEW.user_id IS NULL OR NEW.story_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.user_id
  INTO v_story_owner_id
  FROM public.stories s
  WHERE s.id = NEW.story_id
  LIMIT 1;

  IF v_story_owner_id IS NULL OR v_story_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(BTRIM(u.name), ''), 'Someone')
  INTO v_commenter_name
  FROM public.users u
  WHERE u.id = NEW.user_id
  LIMIT 1;

  v_commenter_name := COALESCE(v_commenter_name, 'Someone');
  v_comment_text := REGEXP_REPLACE(BTRIM(COALESCE(NEW.comment_text, '')), '[[:space:]]+', ' ', 'g');
  v_comment_preview := LEFT(v_comment_text, 200);

  IF v_comment_preview = '' THEN
    v_comment_preview := 'commented on your post';
  END IF;

  IF CHAR_LENGTH(v_comment_text) > 200 THEN
    v_comment_preview := v_comment_preview || '...';
  END IF;

  SELECT net.http_post(
    url := v_site_url || '/.netlify/functions/send-dm-notification',
    body := jsonb_build_object(
      'recipientId', v_story_owner_id::TEXT,
      'senderId', NEW.user_id::TEXT,
      'senderName', v_commenter_name || ' commented',
      'messageText', v_comment_preview,
      'type', 'feed_comment',
      'storyId', NEW.story_id::TEXT,
      'commentId', NEW.id::TEXT,
      'url', '/dashboard.html?action=open_feed_post&story_id=' || NEW.story_id::TEXT || '&comment_id=' || NEW.id::TEXT,
      'collapseKey', 'feed-comment-' || NEW.id::TEXT
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb
  ) INTO v_request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Feed comment push notification failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_feed_comment_owner_on_insert ON public.feed_comments;
CREATE TRIGGER notify_feed_comment_owner_on_insert
  AFTER INSERT ON public.feed_comments
  FOR EACH ROW
  EXECUTE FUNCTION private.notify_feed_comment_owner();

REVOKE ALL ON FUNCTION private.notify_feed_comment_owner() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION private.notify_feed_comment_owner() IS
  'Sends a push notification to a Feed post owner when another user comments.';

NOTIFY pgrst, 'reload schema';

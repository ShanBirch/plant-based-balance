CREATE TABLE public.balance_group_sessions (
 slug text PRIMARY KEY, title text NOT NULL, starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL CHECK(ends_at > starts_at), capacity integer NOT NULL CHECK(capacity BETWEEN 1 AND 50),
 meeting_url text NOT NULL, booking_enabled boolean NOT NULL DEFAULT true);
CREATE TABLE public.balance_group_registrations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_slug text NOT NULL REFERENCES public.balance_group_sessions(slug),
 name text NOT NULL CHECK(char_length(name) BETWEEN 1 AND 120),
 email text NOT NULL CHECK(char_length(email) BETWEEN 3 AND 320), phone text,
 status text NOT NULL CHECK(status IN ('confirmed','reserve','cancelled')),
 receipt_token uuid NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(),
 confirmation_email_sent_at timestamptz);
CREATE UNIQUE INDEX balance_group_registration_active_email ON public.balance_group_registrations(session_slug, lower(email)) WHERE status <> 'cancelled';
ALTER TABLE public.balance_group_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_group_registrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.balance_group_sessions, public.balance_group_registrations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.balance_group_sessions, public.balance_group_registrations TO service_role;
CREATE OR REPLACE FUNCTION public.register_balance_group_session(
 p_slug text, p_name text, p_email text, p_phone text, p_reserve boolean, p_token uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE s public.balance_group_sessions; existing public.balance_group_registrations; r public.balance_group_registrations; taken integer;
BEGIN
 SELECT * INTO s FROM public.balance_group_sessions WHERE slug=p_slug FOR UPDATE;
 IF NOT FOUND OR NOT s.booking_enabled OR s.starts_at <= now() THEN
 RETURN jsonb_build_object('error','closed'); END IF;
 SELECT * INTO existing FROM public.balance_group_registrations WHERE session_slug=p_slug AND lower(email)=lower(trim(p_email)) AND status <> 'cancelled';
 IF FOUND THEN
 IF existing.receipt_token=p_token THEN RETURN jsonb_build_object('id',existing.id,'status',existing.status,'token',existing.receipt_token,'existing',true); END IF;
 RETURN jsonb_build_object('error','duplicate'); END IF;
 SELECT count(*) INTO taken FROM public.balance_group_registrations WHERE session_slug=p_slug AND status='confirmed';
 IF taken >= s.capacity AND NOT p_reserve THEN RETURN jsonb_build_object('error','full'); END IF;
 IF taken < s.capacity AND p_reserve THEN RETURN jsonb_build_object('error','spots_available'); END IF;
 INSERT INTO public.balance_group_registrations(session_slug,name,email,phone,status,receipt_token)
 VALUES(p_slug,trim(p_name),lower(trim(p_email)),nullif(trim(p_phone),''),CASE WHEN p_reserve THEN 'reserve' ELSE 'confirmed' END,p_token) RETURNING * INTO r;
 RETURN jsonb_build_object('id',r.id,'status',r.status,'token',r.receipt_token,'existing',false);
END $$;
REVOKE ALL ON FUNCTION public.register_balance_group_session(text,text,text,text,boolean,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_balance_group_session(text,text,text,text,boolean,uuid) TO service_role;
INSERT INTO public.balance_group_sessions(slug,title,starts_at,ends_at,capacity,meeting_url)
VALUES('saturday-10-october-2026','Free Saturday Morning Training with Shannon','2026-10-10T09:00:00+10:00','2026-10-10T10:00:00+10:00',8,'https://meet.google.com/grv-nnhz-pzb');
NOTIFY pgrst, 'reload schema';

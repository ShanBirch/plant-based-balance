-- Keep every queue entrypoint server-only. The subject-key helper does not
-- expose data, but restricting it as well keeps the public RPC surface tidy.
-- The trigger router needs service_role because IG webhook/API ingestion uses
-- that server credential.

REVOKE ALL ON FUNCTION public.ig_next_action_subject_key(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.route_ig_inbound_to_next_action() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ig_next_action_subject_key(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.route_ig_inbound_to_next_action() TO service_role;

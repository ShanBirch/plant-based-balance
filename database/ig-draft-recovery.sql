create or replace function public.claim_ig_draft_recovery(p_alert_id uuid, p_expected_data jsonb)
returns setof public.coach_alerts
language sql security invoker set search_path = ''
as $$
  update public.coach_alerts as a
  set data = coalesce(a.data, '{}'::jsonb) || jsonb_build_object(
    'draft_recovery', jsonb_build_object(
      'attempts', coalesce((a.data #>> '{draft_recovery,attempts}')::integer, 0) + 1,
      'claimed_at', now(),
      'retry_after', now() + interval '16 minutes'
    ))
  where a.id = p_alert_id and a.status = 'pending'
    and a.data is not distinct from p_expected_data
    and nullif(trim(a.suggested_message), '') is null
    and nullif(trim(a.scheduled_reply_text), '') is null
    and nullif(trim(a.data->>'draft_text'), '') is null
    and coalesce((a.data #>> '{draft_recovery,attempts}')::integer, 0) < 3
    and coalesce((a.data #>> '{draft_recovery,retry_after}')::timestamptz, '-infinity') <= now()
  returning a.*;
$$;
revoke all on function public.claim_ig_draft_recovery(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.claim_ig_draft_recovery(uuid,jsonb) to service_role;
notify pgrst, 'reload schema';

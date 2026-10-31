begin;
do $$ declare u uuid; begin
 foreach u in array array['83661229-aacd-4020-a765-ffdbe500c2da','e1403726-19bc-4663-85d4-59b668791a80','aa5b1232-96e3-4bae-8e68-ad8ea0fb581b','9dbbef25-9f3f-4d0a-bf57-8cdc3f66f619']::uuid[] loop
  if organic_outreach_cohort_allowed(u) or organic_outreach_paid_continuation_allowed(u) then raise exception 'Existing/uncertain member entered the new system'; end if;
  perform set_config('request.jwt.claim.sub',u::text,true);
  begin perform save_coaching_support_preferences(true,true,'direct','app_settings');raise exception 'Excluded consent save accepted';exception when raise_exception then if sqlerrm='Excluded consent save accepted' then raise;end if;end;
 end loop;
 if not organic_outreach_cohort_allowed('b8d2b28a-5efd-42d3-882b-3b3ab3230a03') then raise exception 'Source-verified new challenge member lost eligibility';end if;
 if organic_outreach_cohort_allowed(gen_random_uuid()) then raise exception 'Unknown identity accepted';end if;
end $$;
rollback;

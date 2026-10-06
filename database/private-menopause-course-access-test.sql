-- Run on production in one transaction. Every probe rolls back.
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00a6605e-8edb-4917-85ba-24a23f179059","role":"authenticated"}',true);
do $$ begin
  if (select count(*) from public.private_learning_courses) <> 1 then raise exception 'Owner cannot read payload'; end if;
  insert into public.private_learning_progress(user_id,course_id,lesson_id,score,completed,reflection)
  values ('00a6605e-8edb-4917-85ba-24a23f179059','balance-menopause','week-9',100,true,'Rollback-only privacy probe')
  on conflict(user_id,course_id,lesson_id) do update set reflection=excluded.reflection;
  if not exists (select 1 from public.private_learning_progress where lesson_id='week-9' and reflection='Rollback-only privacy probe') then raise exception 'Owner persistence failed'; end if;
  update public.private_learning_progress set reflection='Updated rollback-only probe' where lesson_id='week-9';
  if not exists (select 1 from public.private_learning_progress where reflection='Updated rollback-only probe') then raise exception 'Owner update failed'; end if;
  begin update public.private_learning_courses set payload='{}'; raise exception 'Owner could edit course'; exception when insufficient_privilege then null; end;
  begin delete from public.private_learning_progress; raise exception 'Owner could delete progress'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$ begin
  if exists(select 1 from public.private_learning_courses) then raise exception 'Nonowner read payload'; end if;
  if exists(select 1 from public.private_learning_progress) then raise exception 'Nonowner read progress'; end if;
  update public.private_learning_progress set reflection='Nonowner write';
  if found then raise exception 'Nonowner changed progress'; end if;
  begin
    insert into public.private_learning_progress(user_id,course_id,lesson_id)
    values ('00a6605e-8edb-4917-85ba-24a23f179059','balance-menopause','week-1');
    raise exception 'Nonowner inserted owner progress';
  exception when insufficient_privilege then null; end;
  begin update public.private_learning_courses set payload='{}'; raise exception 'Nonowner could edit course'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
  begin perform payload from public.private_learning_courses; raise exception 'Anonymous read payload'; exception when insufficient_privilege then null; end;
  begin perform reflection from public.private_learning_progress; raise exception 'Anonymous read progress'; exception when insufficient_privilege then null; end;
  begin insert into public.private_learning_progress(user_id,course_id,lesson_id) values ('00a6605e-8edb-4917-85ba-24a23f179059','balance-menopause','week-1'); raise exception 'Anonymous write'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;

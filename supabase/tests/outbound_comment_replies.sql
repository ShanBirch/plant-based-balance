-- Production-safe rollback regression: no synthetic delivery or native action.
BEGIN;
SET LOCAL statement_timeout='8s';
SET LOCAL lock_timeout='2s';
DO $test$
DECLARE failed boolean:=false;
BEGIN
 ASSERT NOT public.outbound_comment_reply_owned('instagram','nonexistent-fixture','foreign');
 ASSERT NOT public.outbound_comment_reply_owned('facebook','nonexistent-fixture','foreign');
 ASSERT NOT has_table_privilege('anon','public.outbound_comment_replies','SELECT');
 ASSERT NOT has_table_privilege('authenticated','public.outbound_comment_replies','INSERT');
 ASSERT NOT has_function_privilege('anon','public.activate_outbound_comment_reply(text,text,uuid,text,text,jsonb)','EXECUTE');
 ASSERT has_function_privilege('service_role','public.reserve_outbound_comment_reply(text,text,text,uuid,text,text,text,text,text,text,text,text,jsonb)','EXECUTE');
 BEGIN
  PERFORM public.reserve_outbound_comment_reply('instagram','nonexistent-fixture','foreign',gen_random_uuid(),
   'synthetic','synthetic','https://www.instagram.com/p/FIXTURE/','100','200','100','Never sent','Never sent','{}');
 EXCEPTION WHEN raise_exception THEN failed:=true; END;
 ASSERT failed,'unowned reservation rejected';
 failed:=false;
 BEGIN PERFORM public.activate_outbound_comment_reply('nonexistent-fixture','foreign',gen_random_uuid(),'200','Never sent','{}');
 EXCEPTION WHEN raise_exception THEN failed:=true; END;
 ASSERT failed,'unowned activation rejected';
 ASSERT NOT EXISTS(SELECT 1 FROM public.outbound_comment_replies WHERE person_key='synthetic');
END $test$;
ROLLBACK;

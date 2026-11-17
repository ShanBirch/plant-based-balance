-- Read-only regression cases; no live recipients or messages are created.
WITH cases(name,inbound_at,last_attempt,last_outbound,receipt,reviewed_at,message_id,expected) AS (
 VALUES
 ('batch review',10,1,0,'{"source_message_id":"second","conversation_review":{"sourceMessageIds":["first","second"]}}'::jsonb,11,'first',false),
 ('single review',10,1,0,'{"source_message_id":"first"}'::jsonb,11,'first',false),
 ('different source',10,1,0,'{"source_message_id":"other"}'::jsonb,11,'first',true),
 ('later outbound',10,1,12,'{}'::jsonb,0,'first',false),
 ('fresh inbound',13,1,12,'{}'::jsonb,0,'first',true),
 ('review before source',10,1,0,'{"source_message_id":"first"}'::jsonb,9,'first',true)
), evaluated AS (
 SELECT name,expected,inbound_at>greatest(last_attempt,last_outbound)
 AND NOT ((receipt->>'source_message_id'=message_id OR coalesce((receipt#>'{conversation_review,sourceMessageIds}') ? message_id,false)) AND reviewed_at>=inbound_at) blocked FROM cases
)
SELECT name,coalesce(blocked,true)=expected passed FROM evaluated;
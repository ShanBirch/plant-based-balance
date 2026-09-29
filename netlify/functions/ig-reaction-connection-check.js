// Server-admin diagnostic. A constrained test retry may like a reviewed goal;
// it never returns credentials, sends text, or targets a customer conversation.
const {timingSafeEqual} = require('node:crypto');
const {getMessengerToken} = require('./_lib/facebook-messenger');
const {postFacebookGoalReaction} = require('./_lib/ig-reaction-transport');
const OWNER = '17841415641641750';
const PAGE = '561122130919678';
exports.handler = async event => {
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
    const supplied = String(event.headers?.authorization || event.headers?.Authorization || '').replace(/^Bearer /, '');
    if (!secret || Buffer.byteLength(supplied) !== Buffer.byteLength(secret) || !timingSafeEqual(Buffer.from(secret),Buffer.from(supplied))) {
        return {statusCode:403,body:JSON.stringify({error:'forbidden'})};
    }
    if (event.httpMethod !== 'POST') return {statusCode:405,body:'{}'};
    try {
        const body=JSON.parse(event.body || '{}');
        if(body.action==='retry_test_goal') {
            const query=async(route,options={})=>{
                const response=await fetch(`${process.env.SUPABASE_URL}/rest/v1/${route}`,{
                    method:options.method || 'GET',headers:{apikey:secret,Authorization:`Bearer ${secret}`,'Content-Type':'application/json',Prefer:'return=representation'},
                    ...(options.body?{body:JSON.stringify(options.body)}:{}),signal:AbortSignal.timeout(10000),
                });
                if(!response.ok)throw new Error('test_receipt_unavailable');
                return response.json();
            };
            const threadId='4baea56e-eab4-4887-a732-39b14e983d44';
            if(!/^[a-f0-9-]{36}$/i.test(body.alert_id || ''))return {statusCode:400,body:'{}'};
            const alert=(await query(`coach_alerts?id=eq.${body.alert_id}&select=id,data,status`))[0];
            const thread=(await query(`ig_threads?id=eq.${threadId}&select=linked_user_id,custom_data,subscriber_id`))[0];
            const inbound=(await query(`ig_messages?thread_id=eq.${threadId}&direction=eq.in&order=created_at.desc&limit=1&select=created_at,manychat_message_id`))[0];
            const target=alert?.data?.instagram_goal_reaction?.target;
            if(alert?.data?.ig_thread_id!==threadId || alert.status!=='sent'
                || alert.data.draft_review?.goal_heart!==true || alert.data.draft_review?.verdict!=='pass'
                || alert.data.instagram_goal_reaction?.outcome!=='unconfirmed' || alert.data.goal_like_page_retry
                || !thread || thread.linked_user_id || thread.custom_data?.internal_test_auto_reply_enabled!==true
                || thread.subscriber_id!==`ig_graph:${OWNER}:989348707404558`
                || inbound?.manychat_message_id!==`ig_graph:${target}` || Date.now()-Date.parse(inbound.created_at)>86400000
            )return {statusCode:409,body:JSON.stringify({error:'test_goal_retry_not_eligible'})};
            const receipt={outcome:'attempting',target,attempted_at:new Date().toISOString()};
            const claimed=await query(`coach_alerts?id=eq.${alert.id}&data->goal_like_page_retry=is.null`,{method:'PATCH',body:{data:{...alert.data,goal_like_page_retry:receipt}}});
            if(!claimed.length)return {statusCode:409,body:'{}'};
            try {
                const result=await postFacebookGoalReaction({accountId:OWNER,query,payload:{recipient:{id:'989348707404558'},sender_action:'react',payload:{message_id:target,reaction:'love'}}});
                receipt.outcome=String(result.recipient_id)==='989348707404558'?'confirmed':'unconfirmed';
                receipt.transport=result.reaction_transport;
            }catch(error){receipt.outcome='unconfirmed';receipt.error=String(error.message).slice(0,250);}
            const fresh=(await query(`coach_alerts?id=eq.${alert.id}&select=data`))[0];
            await query(`coach_alerts?id=eq.${alert.id}`,{method:'PATCH',body:{data:{...fresh.data,goal_like_page_retry:receipt}}});
            return {statusCode:200,body:JSON.stringify(receipt)};
        }
        // Production keeps this existing Page credential private in its runtime.
        const token = await getMessengerToken(PAGE, async()=>[]);
        if (!token) return {statusCode:200,body:JSON.stringify({page_connection:'unavailable'})};
        const response = await fetch(`https://graph.facebook.com/v25.0/${PAGE}?fields=id,instagram_business_account`,{
            headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000),
        });
        const result = await response.json();
        return {statusCode:200,body:JSON.stringify({
            page_connection:response.ok?'verified':'rejected',
            instagram_owner_matches:response.ok && String(result.instagram_business_account?.id || '') === OWNER,
            instagram_link_present:!!result.instagram_business_account?.id,
            ...(result.error ? {graph_status:response.status,graph_error_code:result.error.code,graph_error_subcode:result.error.error_subcode} : {}),
        })};
    } catch { return {statusCode:503,body:JSON.stringify({error:'connection_check_failed'})}; }
};

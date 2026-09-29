// Read-only, server-admin diagnostic. Never returns credentials or sends a DM.
const {timingSafeEqual} = require('node:crypto');
const {getMessengerToken} = require('./_lib/facebook-messenger');
const OWNER = '17841415641641750';
const PAGE = '561122130919678';
exports.handler = async event => {
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
    const supplied = String(event.headers?.authorization || event.headers?.Authorization || '').replace(/^Bearer /, '');
    if (!secret || supplied.length !== secret.length || !timingSafeEqual(Buffer.from(secret),Buffer.from(supplied))) {
        return {statusCode:403,body:JSON.stringify({error:'forbidden'})};
    }
    if (event.httpMethod !== 'POST') return {statusCode:405,body:'{}'};
    try {
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

// Reactive manager replies only. Does not enable proactive drafts or fast lanes.
const STARTED_AT = '2026-09-16T00:00:00+10:00';
async function loadCustomerServicePermission(query, coachId, clientId) {
    if (!coachId || !clientId) return false;
    try {
        const id = encodeURIComponent(clientId);
        const coach = encodeURIComponent(coachId);
        const [[user], relationships, memories] = await Promise.all([
            query(`users?select=name,created_at,is_test_account&id=eq.${id}&limit=1`),
            query(`coach_clients?select=id,assigned_at&coach_id=eq.${coach}&client_id=eq.${id}&status=eq.active&limit=1`),
            query(`client_memory?select=preferences,auto_send_enabled&coach_id=eq.${coach}&client_id=eq.${id}&limit=1`),
        ]);
        if (!user || user.is_test_account || !relationships?.length) return false;
        if (/^(?:nat|shane minahan|arunima sharma)$/i.test(String(user.name || '').trim())) return false;
        const prefs = memories?.[0]?.preferences || {};
        if (prefs.customer_service_manual_only === true || prefs.customer_service_auto_reply_enabled === false) return false;
        return prefs.customer_service_auto_reply_enabled === true || Date.parse(relationships[0].assigned_at || user.created_at) >= Date.parse(STARTED_AT);
    } catch { return false; }
}
module.exports = { loadCustomerServicePermission, STARTED_AT };

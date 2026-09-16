// Called only with a server-verified purchase and its signed/canonical DM identity.
// Never match customers to a conversation by display name or user-entered handle.
export async function handoffPurchasedCustomer({ query, purchase, threadId, userId = null }) {
    if (!purchase?.id || purchase.status !== 'paid' || !threadId) return { skipped: 'missing_verified_purchase_identity' };
    const [thread] = await query(`ig_threads?select=id,coach_id,linked_user_id,custom_data&id=eq.${encodeURIComponent(threadId)}&limit=1`);
    if (!thread) return { skipped: 'thread_missing' };
    if (thread.linked_user_id && userId && thread.linked_user_id !== userId) return { skipped: 'identity_conflict' };
    const linkedId = userId || thread.linked_user_id || null;
    const custom = thread.custom_data || {};
    if (custom.customer_lifecycle?.purchase_id === purchase.id && custom.customer_lifecycle?.user_id === linkedId) {
        return { transitioned: true, alreadyApplied: true, threadId: thread.id, state: custom.customer_lifecycle.state };
    }
    const now = new Date().toISOString();
    const lifecycle = {
        state: linkedId ? 'customer_coaching' : 'paid_awaiting_account',
        purchase_id: purchase.id,
        stripe_checkout_session_id: purchase.stripe_checkout_session_id,
        verified_at: now,
        paid_at: purchase.purchased_at,
        user_id: linkedId,
        source: 'verified_purchase_handoff',
    };
    await query(`founders_pass_purchases?id=eq.${encodeURIComponent(purchase.id)}`, {
        method: 'PATCH', body: { metadata: { ...purchase.metadata, verified_ig_thread_id: thread.id } },
    });
    // Preserve explicit manual settings. The manager opts eligible new clients in
    // only after reading their exact live identity and coach relationship.
    await query(`ig_threads?id=eq.${encodeURIComponent(thread.id)}`, {
        method: 'PATCH', body: {
            linked_user_id: linkedId, lead_stage: linkedId ? 'in_app' : 'paying',
            custom_data: { ...custom, acquisition_mode: 'existing_client', customer_lifecycle: lifecycle },
        },
    });
    const pending = await query(`coach_alerts?select=id,data,created_at&status=in.(pending,scheduled)&data-%3E%3Eig_thread_id=eq.${encodeURIComponent(thread.id)}&created_at=lte.${encodeURIComponent(now)}&limit=200`);
    for (const alert of pending || []) {
        if (alert.data?.customer_service_purchase_id === purchase.id || alert.data?.send_claim_id) continue;
        await query(`coach_alerts?id=eq.${encodeURIComponent(alert.id)}&status=in.(pending,scheduled)`, {
            method: 'PATCH', body: { status: 'canceled', actioned_at: now, data: {
                ...alert.data, cancel_reason: 'customer_handoff_requires_fresh_service_reply',
                customer_handoff_purchase_id: purchase.id, outbound_attempted: false,
            } },
        });
    }
    const actions = await query(`ig_next_actions?select=id,action_version,reason&thread_id=eq.${encodeURIComponent(thread.id)}&owner=in.(codex_live_worker,dm_manager)&status=in.(ready,waiting,cooldown)&claim_token=is.null`);
    for (const action of actions || []) {
        await query(`ig_next_actions?id=eq.${encodeURIComponent(action.id)}&action_version=eq.${action.action_version}&claim_token=is.null&status=in.(ready,waiting,cooldown)`, {
            method: 'PATCH', body: { status: 'cancelled', completed_at: now,
                reason: { ...action.reason, customer_handoff_purchase_id: purchase.id },
                receipt: { delivery_outcome: 'not_sent', reason: 'customer_handoff_requires_fresh_service_reply', purchase_id: purchase.id, verified_at: now } },
        });
    }
    return { transitioned: true, threadId: thread.id, state: lifecycle.state };
}

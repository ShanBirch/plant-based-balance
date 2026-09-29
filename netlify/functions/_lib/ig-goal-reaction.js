// A native acknowledgement is separate from conversational text and receipts.
function goalReactionTarget({review, inbound, challenge, edited = false, enabled = true}) {
    if (!enabled || !challenge || edited || review?.goal_heart !== true || review.verdict !== 'pass'
        || review.issues?.length || review.context_loss_suspected || review.notification_required
        || !String(review.reviewer_model || '').includes('challenge-review')
        || inbound?.direction !== 'in') return null;
    const id = String(inbound.manychat_message_id || '');
    return id.startsWith('ig_graph:') && id.length > 9 ? id.slice(9) : null;
}

async function sendGoalReaction({target, recipientId, previous, persist, post}) {
    if (!target || previous?.target === target) return previous || null;
    const receipt = {target, reaction:'love', outcome:'attempting', attempted_at:new Date().toISOString()};
    // Persist before sending: an ambiguous network result must never trigger a repeat.
    await persist(receipt);
    try {
        const result = await post({recipient:{id:recipientId}, sender_action:'react', payload:{message_id:target,reaction:'love'}});
        if (String(result?.recipient_id || '') !== String(recipientId)) throw new Error('reaction_not_confirmed');
        receipt.outcome = 'confirmed';
        receipt.transport = result.reaction_transport || 'instagram_graph';
    } catch (error) {
        receipt.outcome = 'unconfirmed';
        receipt.error = String(error.message || error).slice(0,250);
    }
    await persist(receipt);
    return receipt;
}

module.exports = {goalReactionTarget, sendGoalReaction};

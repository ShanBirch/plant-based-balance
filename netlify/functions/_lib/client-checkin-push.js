const TYPE = 'client_checkin_ready';

function payloadFor(row) {
    return {
        recipientId: row.user_id,
        senderId: row.user_id,
        senderName: 'Your check-in is ready',
        messageText: 'Take a moment to share how your week is going. Tap to open your check-in.',
        type: TYPE,
        url: '/dashboard.html?checkin=ready',
        collapseKey: `checkin-${row.week_start}-${row.occurrence}`,
    };
}

async function deliver(row, query, send) {
    let result;
    try {
        result = await send(payloadFor(row));
    } catch (_) {
        result = { sent: 0, error: 'delivery_unknown' };
    }
    const sent = Number(result?.sent) > 0;
    await query(`client_checkin_push_receipts?user_id=eq.${row.user_id}&week_start=eq.${row.week_start}&occurrence=eq.${row.occurrence}`, {
        method: 'PATCH', prefer: 'return=minimal',
        body: { sent_at: sent ? new Date().toISOString() : null,
            result: { sent: Number(result?.sent) || 0, failed: Number(result?.failed) || 0, error: result?.error || null } },
    });
    return sent;
}
module.exports = { TYPE, payloadFor, deliver };

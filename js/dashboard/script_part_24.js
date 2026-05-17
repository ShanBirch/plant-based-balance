// --- COACH CHAT - DIRECT MESSAGING ---
const COACH_EMAILS = [
    'shannonbirch@cocospersonaltraining.com'
];
window._coachUserId = null;

// Look up coach user ID by email
async function getCoachUserId() {
    if (window._coachUserId) return window._coachUserId;

    for (const email of COACH_EMAILS) {
        try {
            const { data } = await window.supabaseClient
                .from('users')
                .select('id')
                .eq('email', email)
                .maybeSingle();

            if (data && data.id) {
                window._coachUserId = data.id;
                return window._coachUserId;
            }
        } catch (e) {
            console.warn('Could not look up coach by email:', email, e);
        }
    }

    return null;
}

// Send a push notification to a user when they receive a DM
async function sendDMNotification(recipientId, messageText) {
    try {
        const profile = await window.getUserProfile();
        const senderName = profile?.name || 'Someone';

        const resp = await fetch('/.netlify/functions/send-dm-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientId: recipientId,
                senderName: senderName,
                messageText: messageText
            })
        });

        const result = await resp.json().catch(() => ({}));
        console.log('[PushNotif] send-dm-notification response:', resp.status, result);

        if (!resp.ok) {
            console.error('[PushNotif] Server error:', result.error || resp.statusText);
        } else if (result.sent === 0) {
            console.warn('[PushNotif] No push subscriptions found for recipient', recipientId);
        }
    } catch (error) {
        console.error('[PushNotif] Error sending DM notification:', error);
    }
}

window.submitCoachMessage = async function() {
    const input = document.getElementById('coach-chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    input.value = '';

    // Render user message immediately
    const container = document.getElementById('chat-messages-container');
    if (container) {
        const rowDiv = document.createElement('div');
        rowDiv.style.cssText = "display: flex; justify-content: flex-end; align-items: flex-end; margin-bottom: 20px; animation: fadeIn 0.3s ease;";
        rowDiv.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: flex-end; max-width: 80%;">
                <div style="background: var(--chat-bg-user); color: var(--chat-text-user); padding: 12px 18px; border-radius: 18px 18px 0 18px; font-size: 1rem; line-height: 1.5; box-shadow: 0 2px 5px rgba(0,0,0,0.05); text-align: left;">${text}</div>
                <span style="font-size: 0.7rem; color: var(--text-muted); margin-top: 5px; margin-right: 5px;">You  Just now</span>
            </div>
            <img src="https://ui-avatars.com/api/?name=You&background=cbd5e1&color=fff" style="width: 36px; height: 36px; border-radius: 50%; margin-left: 10px; flex-shrink: 0; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
        `;
        container.appendChild(rowDiv);
        scrollToBottomOfChat();
    }

    // Send as a direct message (nudge) to the coach
    const coachId = await getCoachUserId();
    if (!coachId) {
        console.error('Could not find coach user ID');
        return;
    }

    try {
        const { error } = await window.supabaseClient
            .from('nudges')
            .insert({
                sender_id: window.currentUser.id,
                receiver_id: coachId,
                message: text
            });

        if (error) throw error;

        // Push notification is sent automatically by the database trigger
        // on the nudges table (nudge_push_trigger.sql)
        if (typeof window.refreshWeeklyGoalsCard === 'function') {
            window.refreshWeeklyGoalsCard();
        }
    } catch (error) {
        console.error('Error sending message to coach:', error);
    }
};

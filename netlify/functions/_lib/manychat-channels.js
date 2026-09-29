// One ManyChat workspace owns the restored Balance Page and WhatsApp connection.
const BALANCE_MANYCHAT_WORKSPACE = 'fb996573';
const BALANCE_PAGE_ID = '561122130919678';
function normalizeManyChatChannel(value) {
    const channel = String(value || 'instagram').trim().toLowerCase();
    return ['instagram', 'messenger', 'whatsapp'].includes(channel) ? channel : null;
}
function isBalanceManyChatThread(thread = {}) {
    return ['messenger', 'whatsapp'].includes(thread.channel)
        && /^\d+$/.test(String(thread.subscriber_id || ''))
        && thread.custom_data?.manychat_business?.workspace === BALANCE_MANYCHAT_WORKSPACE
        && thread.custom_data?.manychat_business?.page_id === BALANCE_PAGE_ID;
}
function buildManyChatContent({text, channel, button}) {
    if (!normalizeManyChatChannel(channel)) throw new Error('Unsupported ManyChat channel');
    const message = {type:'text', text};
    if (button) message.buttons = [{type:'url', caption:button.title, url:button.url}];
    return { ...(channel === 'messenger' ? {} : {type:channel}), messages:[message] };
}
module.exports = {BALANCE_MANYCHAT_WORKSPACE, BALANCE_PAGE_ID, normalizeManyChatChannel, isBalanceManyChatThread, buildManyChatContent};

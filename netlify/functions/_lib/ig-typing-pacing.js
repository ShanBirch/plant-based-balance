'use strict';

// Restored from the September Learn conversation's presence policy: about
// 150 words/minute, with generation time already counting toward the first item.
function textTypingDurationMs(text = '') {
    const words = String(text).trim().split(/\s+/).filter(Boolean).length;
    return Math.min(30000, Math.max(3000, 2000 + words * 400));
}

// Meta clears/expires presence independently of our local wait. Keep it alive
// during a long inter-message pause without leaving a background timer behind.
async function waitWithTypingRefresh({ delayMs = 0, refresh, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
    let remaining = Math.max(0, Number(delayMs) || 0);
    while (remaining > 0) {
        const step = Math.min(4000, remaining);
        await wait(step);
        remaining -= step;
        if (remaining > 0 && refresh) await refresh();
    }
}

module.exports = { textTypingDurationMs, waitWithTypingRefresh };

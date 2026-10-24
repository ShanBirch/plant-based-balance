(function () {
    'use strict';
    let previousFocus = null, previousOverflow = '', generation = 0;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    async function api(input, method = 'GET') {
        const { data } = await window.supabaseClient.auth.getSession();
        if (!data?.session?.access_token) throw new Error('Please sign in again to view progress.');
        const response = await fetch('/.netlify/functions/weekly-progress' + (method === 'GET' ? '?' + new URLSearchParams(input) : ''), {
            method, headers: { Authorization: 'Bearer ' + data.session.access_token, 'Content-Type': 'application/json' },
            body: method === 'GET' ? undefined : JSON.stringify(input), cache: 'no-store'
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Progress could not be loaded.');
        return result;
    }
    function close(fromNavigation) {
        const el = document.getElementById('pbb-weekly-progress-view');
        if (!el) return;
        el.remove();
        document.body.style.overflow = previousOverflow;
        document.removeEventListener('keydown', keyboard);
        if (!fromNavigation && typeof window.popNavigationState === 'function') window.popNavigationState('pbb-weekly-progress-view');
        (previousFocus?.isConnected ? previousFocus : document.querySelector('#pbb-progress-toolbar button, #dm-input'))?.focus?.();
    }
    function keyboard(event) {
        const el = document.getElementById('pbb-weekly-progress-view');
        if (!el) return;
        if (event.key === 'Escape') { event.preventDefault(); close(); }
        if (event.key === 'Tab') {
            const nodes = [...el.querySelectorAll('button:not(:disabled),input,textarea,select,a[href],[tabindex="0"]')].filter(n => n.offsetParent !== null);
            const first = nodes[0], last = nodes[nodes.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
    }
    function shell(title) {
        const existing = document.getElementById('pbb-weekly-progress-view');
        if (existing) {
            existing.querySelector('h2').textContent = title;
            existing.querySelector('.pbb-progress-body').innerHTML = '<div class="pbb-progress-inner"></div>';
            return existing.querySelector('.pbb-progress-inner');
        }
        previousFocus = document.activeElement; previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const el = document.createElement('section');
        el.id = 'pbb-weekly-progress-view'; el.className = 'pbb-progress'; el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'pbb-progress-heading');
        el.innerHTML = `<header class="pbb-progress-header"><h2 id="pbb-progress-heading">${esc(title)}</h2><button type="button" aria-label="Close progress">×</button></header><div class="pbb-progress-body" tabindex="0" aria-label="Progress card content"><div class="pbb-progress-inner"></div></div>`;
        document.body.appendChild(el); el.querySelector('button').onclick = () => close();
        if (typeof window.pushNavigationState === 'function') window.pushNavigationState(el.id, () => close(true));
        if (typeof window.enableSwipeBackNavigation === 'function') window.enableSwipeBackNavigation(el.id, () => close());
        document.addEventListener('keydown', keyboard); el.querySelector('button').focus();
        return el.querySelector('.pbb-progress-inner');
    }
    function cardHtml(record, includeTitle = true) {
        const p = record.payload;
        return (includeTitle ? '<h1 class="pbb-progress-title">' + esc(p.title) + '</h1>' : '') +
            (/sample data/i.test(p.sessions || '') ? '<p class="pbb-progress-demo">Sample data</p>' : '') +
            p.entries.map(row => '<article class="pbb-progress-card"><h3>' + esc(row.exercise) + '</h3><div class="pbb-progress-comparison"><div><span>This week</span><strong>' + esc(row.completed.replace(/^SAMPLE · /, '')) + '</strong></div><div class="pbb-progress-next"><span>Next target</span><strong>' + esc(row.next.replace(/^SAMPLE · /, '')) + '</strong></div></div></article>').join('');
    }
    function show(record) { const body = shell(record.payload.title); body.innerHTML = cardHtml(record, false); }
    async function mount(container, messages, peer) {
        const ticket = ++generation;
        document.getElementById('pbb-progress-toolbar')?.remove();
        container.querySelectorAll('.pbb-progress-attachment').forEach(el => el.remove());
        try {
            const result = await api({ peer_id: peer });
            if (generation !== ticket || !container.isConnected) return;
            // Chat rendering scrolls before this request finishes. Keep a reader
            // who is still at the bottom there when attachments add height.
            const pinnedToBottom = container.scrollHeight - container.clientHeight - container.scrollTop <= 48;
            for (const record of result.records.filter(r => r.message_id)) {
                const anchor = container.querySelector(`[data-progress-message-id="${record.message_id}"]`);
                if (!anchor) continue;
                const wrap = document.createElement('div'); wrap.className = 'pbb-progress pbb-progress-attachment';
                wrap.innerHTML = `<strong class="pbb-progress-attachment-title">${esc(record.payload.title)}</strong><button type="button" class="pbb-progress-link">View progress <span aria-hidden="true">→</span></button>`;
                wrap.querySelector('button').onclick = () => show(record); anchor.appendChild(wrap);
            }
            if (pinnedToBottom) container.scrollTop = container.scrollHeight;
        } catch (error) { console.warn('[weekly-progress] Cards unavailable:', error.message); }
    }
    window.balanceWeeklyProgress = { mount, close, show, cardHtml };
})();

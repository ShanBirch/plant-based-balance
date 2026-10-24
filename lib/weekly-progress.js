(function () {
    'use strict';
    let previousFocus = null, previousOverflow = '', generation = 0;
    let revealRun = 0, revealTimers = [], revealCleanup = () => {};
    function stopReveal() { revealRun++; revealTimers.forEach(clearTimeout); revealTimers = []; revealCleanup(); revealCleanup = () => {}; }
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
        stopReveal();
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
    function parseSets(value) {
        const text = String(value || '').replace(/^SAMPLE · /, '').trim();
        const match = text.match(/^(\d+\s*[×x]\s*\d+)\s+(?:at|holding)\s+(\d+(?:\.\d+)?)\s*kg(?:\s+(per dumbbell|each|total))?$/i);
        return match ? { reps: match[1], kg: Number(match[2]), unit: (match[3] || '').replace(/per dumbbell/i, 'each').toLowerCase(), weight: `${match[2]} kg${match[3] ? ' ' + match[3].replace(/per dumbbell/i, 'each') : ''}` } : { reps: text, weight: '' };
    }
    function cardHtml(record, includeTitle = true) {
        const p = record.payload;
        return (includeTitle ? '<h1 class="pbb-progress-title">' + esc(p.title) + '</h1>' : '') +
            p.entries.map((row, index) => {
                const before = parseSets(row.completed), after = parseSets(row.next);
                const increase = before.weight && after.weight && before.unit === after.unit && after.kg > before.kg;
                const targetWeight = increase ? `<span class="wp-weight-change"><span class="wp-old-weight" aria-hidden="true">${esc(before.weight)}</span><span class="wp-weight-notice" aria-hidden="true">Weight increased</span><span class="wp-new-weight">${esc(after.weight)}</span></span>` : `<span class="wp-weight">${esc(after.weight)}</span>`;
                return `<article class="pbb-progress-card" style="--wp-row:${index}"><h3 class="wp-exercise">${esc(row.exercise)}</h3><div class="pbb-progress-comparison"><div><span class="wp-label">This week</span><div class="wp-slot"><strong class="wp-value wp-current${before.weight ? "" : " wp-plain"}">${esc(before.reps)}<span class="wp-weight">${esc(before.weight)}</span></strong></div></div><span class="wp-arrow" aria-hidden="true"><span class="wp-arrow-line"></span><span class="wp-arrow-tip"></span></span><div><span class="wp-label">Next target</span><div class="wp-slot"><strong class="wp-value wp-next${after.weight ? "" : " wp-plain"}">${esc(after.reps)}${targetWeight}</strong></div></div></div></article>`;
            }).join('') + `<footer class="wp-footer"><span class="pbb-progress-demo">${/sample data/i.test(p.sessions || '') ? 'Sample data' : ''}</span><button type="button" class="wp-replay">↻ Replay reveal</button></footer>`;
    }
    function playReveal(body) {
        stopReveal();
        const run = revealRun, scroll = body.closest('.pbb-progress-body');
        body.classList.remove('wp-playing', 'wp-motion'); scroll.scrollTop = 0;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        let userScrolling = false;
        const cancelScroll = () => { userScrolling = true; };
        ['touchstart', 'wheel', 'pointerdown'].forEach(type => scroll.addEventListener(type, cancelScroll, { passive: true }));
        revealCleanup = () => ['touchstart', 'wheel', 'pointerdown'].forEach(type => scroll.removeEventListener(type, cancelScroll));
        body.classList.add('wp-motion');
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (!body.isConnected || run !== revealRun) return;
            body.classList.add('wp-playing');
            body.querySelectorAll('.pbb-progress-card').forEach((row, index) => {
                revealTimers.push(setTimeout(() => {
                    if (userScrolling || run !== revealRun || !body.isConnected || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
                    const bounds = scroll.getBoundingClientRect(), rect = row.getBoundingClientRect();
                    if (rect.bottom > bounds.bottom - 20 || rect.top < bounds.top) scroll.scrollTo({ top: Math.max(0, scroll.scrollTop + rect.top - bounds.top - 16), behavior: 'smooth' });
                }, index * 4500));
            });
        }));
    }
    function show(record) {
        const body = shell(record.payload.title); body.innerHTML = cardHtml(record, false);
        const title = record.payload.title.match(/^(.*?)\s+weekly progress$/i);
        document.getElementById('pbb-progress-heading').innerHTML = title ? `${esc(title[1])}<span>weekly progress.</span>` : esc(record.payload.title);
        body.querySelector('.wp-replay').onclick = () => playReveal(body);
        playReveal(body);
    }
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

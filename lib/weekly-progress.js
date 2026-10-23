(function () {
    'use strict';
    let previousFocus = null, previousOverflow = '', generation = 0;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const date = value => new Date(value + 'T12:00:00Z').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Brisbane' });
    const shift = (value, days) => { const d = new Date(value + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
    function monday() {
        const value = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
        return shift(value, -((new Date(value + 'T12:00:00Z').getUTCDay() + 6) % 7));
    }
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
    function cardHtml(record) {
        const p = record.payload;
        return `<p class="pbb-progress-kicker">BALANCE · WEEKLY CHECK-IN</p><h1 class="pbb-progress-title">${esc(p.title)}</h1>
            <p class="pbb-progress-muted">Review: ${date(record.week_start)} – ${date(shift(record.week_start, 6))}<br>Next targets: ${date(shift(record.week_start, 7))} – ${date(shift(record.week_start, 13))}</p>
            <p class="pbb-progress-muted">${esc(p.sessions)}</p><div class="pbb-progress-note">${esc(p.note)}</div>
            ${p.entries.map(row => `<article class="pbb-progress-card"><h3>${esc(row.exercise)}</h3><div class="pbb-progress-comparison"><div><span>Recorded this week</span><strong>${esc(row.completed)}</strong></div><div class="pbb-progress-next"><span>Next target</span><strong>${esc(row.next)}</strong></div></div>${row.note ? `<p class="pbb-progress-muted">${esc(row.note)}</p>` : ''}</article>`).join('')}
            <footer class="pbb-progress-ladder">Your rep ladder<strong>6 → 8 → 10 → 12 → 15</strong>Complete every working set before moving up. After all sets reach 15, use the next coach-confirmed weight and return to 6. Follow any exercise-specific pain or physio instructions.</footer>`;
    }
    function show(record) { const body = shell('Your weekly progress'); body.innerHTML = cardHtml(record); }
    function messageOptions(messages, records = []) {
        const attached = new Set(records.map(r => r.message_id).filter(Boolean));
        return messages.filter(m => m.sender_id === window.currentUser?.id && !attached.has(m.id)).slice(-30).reverse().map(m => `<option value="${esc(m.id)}">${esc(new Date(m.created_at).toLocaleDateString('en-AU'))} · ${esc(String(m.message).replace(/\[AUDIO:[^\]]+\]/gi, 'Voice check-in').slice(0, 90))}</option>`).join('');
    }
    function attachUi(body, record, ctx) {
        body.innerHTML = cardHtml(record) + `<div class="pbb-progress-editor"><label for="wp-message">Attach beneath your check-in</label><select id="wp-message"><option value="">Choose a sent text or voice message</option>${messageOptions(ctx.messages, ctx.records)}</select><div class="pbb-progress-actions"><button type="button" id="wp-attach">Attach to selected message</button></div><p class="pbb-progress-muted">Send your check-in first if it is not listed, then reopen this saved card. This attaches the card to that existing message without sending another message.</p><p class="pbb-progress-status" role="status"></p></div>`;
        body.querySelector('#wp-attach').onclick = async event => {
            const status = body.querySelector('[role="status"]'), message = body.querySelector('#wp-message').value;
            if (!message) { status.textContent = 'Choose the check-in message first.'; return; }
            event.target.disabled = true; status.textContent = 'Attaching…';
            try { await api({ operation: 'attach', peer_id: ctx.peer, id: record.id, message_id: message }, 'POST'); status.textContent = 'Attached. The progress button is now beneath that check-in.'; await mount(ctx.container, ctx.messages, ctx.peer); }
            catch (error) { status.textContent = error.message; event.target.disabled = false; }
        };
    }
    async function editor(ctx, week = monday()) {
        const body = shell('Weekly progress card'); body.innerHTML = '<p role="status">Loading this week’s records…</p>';
        try {
            const result = await api({ peer_id: ctx.peer, suggestions: '1', week_start: week });
            if (!body.isConnected) return;
            ctx.records = result.records;
            const draft = result.suggestion;
            body.innerHTML = `<p class="pbb-progress-kicker">COACH REVIEW</p><h1 class="pbb-progress-title">A clear next step.</h1><p class="pbb-progress-muted">Check the recorded sets and saved targets. These are suggestions, not an automatic progression decision. Remove warm-ups and any row you do not want to share.</p>
                <div class="pbb-progress-editor"><label for="wp-week">Review week (Monday)</label><input id="wp-week" type="date" value="${esc(week)}"><button type="button" id="wp-load">Load this week</button>
                <label for="wp-title">Title</label><input id="wp-title" maxlength="100" value="${esc(draft.title)}"><label for="wp-sessions">Sessions</label><input id="wp-sessions" maxlength="300" value="${esc(draft.sessions)}">
                <label for="wp-note">Your coaching note</label><textarea id="wp-note" maxlength="3000"></textarea><div id="wp-rows">${draft.entries.map(row => rowEditor(row)).join('')}</div>
                <div class="pbb-progress-actions"><button type="button" id="wp-add">Add exercise</button><button type="button" id="wp-preview">Preview card</button></div><p class="pbb-progress-status" role="status"></p></div>
                ${result.records.filter(r => !r.message_id).length ? '<h3>Saved cards awaiting attachment</h3>' : ''}<div id="wp-drafts"></div>`;
            body.querySelector('#wp-load').onclick = () => editor(ctx, body.querySelector('#wp-week').value);
            body.querySelector('#wp-add').onclick = () => body.querySelector('#wp-rows').insertAdjacentHTML('beforeend', rowEditor({}));
            body.querySelector('#wp-rows').onclick = event => { if (event.target.matches('[data-remove-row]')) event.target.closest('[data-row]').remove(); };
            for (const record of result.records.filter(r => !r.message_id)) {
                const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = `${date(record.week_start)} · ${record.payload.title}`;
                btn.onclick = () => attachUi(body, record, ctx); body.querySelector('#wp-drafts').appendChild(btn);
            }
            body.querySelector('#wp-preview').onclick = () => {
                if (body.querySelector('#wp-week').value !== week) { body.querySelector('[role="status"]').textContent = 'Load the selected week before previewing.'; return; }
                const payload = { title: body.querySelector('#wp-title').value, sessions: body.querySelector('#wp-sessions').value, note: body.querySelector('#wp-note').value,
                    entries: [...body.querySelectorAll('[data-row]')].map(row => Object.fromEntries([...row.querySelectorAll('[data-field]')].map(el => [el.dataset.field, el.value]))) };
                if (!payload.entries.length || payload.entries.some(r => !r.exercise.trim() || !r.completed.trim() || !r.next.trim())) { body.querySelector('[role="status"]').textContent = 'Add an exercise, completed sets and next target for each row.'; return; }
                const preview = document.createElement('div'); preview.innerHTML = cardHtml({ week_start: week, payload });
                const controls = document.createElement('div'); controls.className = 'pbb-progress-actions';
                const back = document.createElement('button'); back.textContent = 'Keep editing'; back.onclick = () => { preview.remove(); body.hidden = false; };
                const save = document.createElement('button'); save.textContent = 'Save reviewed card';
                const status = document.createElement('p'); status.setAttribute('role', 'status');
                const id = crypto.randomUUID();
                save.onclick = async () => {
                    save.disabled = true; status.textContent = 'Saving…';
                    try { const result = await api({ operation: 'save', peer_id: ctx.peer, id, week_start: week, payload }, 'POST'); preview.remove(); body.hidden = false; attachUi(body, result.record, ctx); }
                    catch (error) { status.textContent = error.message; save.disabled = false; }
                };
                controls.append(back, save); preview.append(controls, status); body.after(preview); body.hidden = true;
                preview.closest('.pbb-progress-body').scrollTop = 0; back.focus();
            };
        } catch (error) {
            body.textContent = error.message;
            const retry = document.createElement('button'); retry.textContent = 'Try again'; retry.onclick = () => editor(ctx, week); body.appendChild(retry);
        }
    }
    function rowEditor(row) {
        return `<article class="pbb-progress-card" data-row>${['exercise', 'completed', 'next', 'note'].map((key, index) => `<label>${['Exercise', 'Recorded this week', 'Next target', 'Exercise note'][index]}<input data-field="${key}" maxlength="${key === 'exercise' ? 120 : 400}" value="${esc(row[key] || '')}"></label>`).join('')}<button type="button" data-remove-row>Remove row</button></article>`;
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
            const ctx = { container, messages, peer, records: result.records };
            for (const record of result.records.filter(r => r.message_id)) {
                const anchor = container.querySelector(`[data-progress-message-id="${record.message_id}"]`);
                if (!anchor) continue;
                const wrap = document.createElement('div'); wrap.className = 'pbb-progress pbb-progress-attachment';
                wrap.innerHTML = `<button type="button" class="pbb-progress-link">View this week’s progress<small>${date(record.week_start)} – ${date(shift(record.week_start, 6))}</small></button>`;
                wrap.querySelector('button').onclick = () => show(record); anchor.appendChild(wrap);
            }
            if (result.can_manage) {
                const toolbar = document.createElement('div'); toolbar.id = 'pbb-progress-toolbar'; toolbar.className = 'pbb-progress pbb-progress-toolbar';
                const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'Weekly progress card'; btn.onclick = () => editor(ctx);
                toolbar.appendChild(btn); container.before(toolbar);
            }
            if (pinnedToBottom) container.scrollTop = container.scrollHeight;
        } catch (error) { console.warn('[weekly-progress] Cards unavailable:', error.message); }
    }
    window.balanceWeeklyProgress = { mount, close, show, cardHtml };
})();

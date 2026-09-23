(() => {
    const $ = id => document.getElementById(id);
    let code = '', revision = null, busy = false, generation = 0;
    const status = text => { $('status').textContent = text; };
    async function call(body) {
        const started = generation;
        const response = await fetch('/.netlify/functions/messenger-review', { method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${code}` },
            body: JSON.stringify(body), cache: 'no-store', credentials: 'omit' });
        const data = await response.json();
        if (started !== generation) throw new Error('Inbox locked.');
        if ([401, 403].includes(response.status)) lock();
        if (!response.ok) throw new Error(data.error || 'Review inbox unavailable.');
        return data;
    }
    async function refresh() {
        const data = await call({ action: 'read' });
        $('login').hidden = true; $('inbox').hidden = false;
        $('messages').replaceChildren();
        for (const m of data.messages) {
            const bubble = document.createElement('div'); bubble.className = `message ${m.direction === 'out' ? 'out' : 'in'}`;
            const label = document.createElement('small'); label.textContent = `${m.direction === 'out' ? 'Balance APP' : 'Test participant'} · ${new Date(m.at).toLocaleString()}`;
            bubble.append(label, document.createTextNode(m.text)); $('messages').append(bubble);
        }
        if (!data.messages.length) $('messages').textContent = 'No messages in this review session yet.';
        revision = data.revision; $('draft').value = data.draft; $('send').disabled = !data.canSend;
        status(data.status);
    }
    async function run(action) {
        if (busy) return; busy = true;
        $('refresh').disabled = true; $('send').disabled = true;
        try { await action(); } catch (error) { status(error.message); }
        finally { busy = false; $('refresh').disabled = false; }
    }
    $('login').addEventListener('submit', event => { event.preventDefault(); code = $('code').value.trim(); $('code').value = ''; run(refresh); });
    $('refresh').addEventListener('click', () => run(refresh));
    $('compose').addEventListener('submit', event => { event.preventDefault(); run(async () => {
        status('Sending reviewed reply…'); await call({ action: 'send', revision, text: $('draft').value });
        await refresh(); status('Reply sent. Verify it in Messenger.');
    }); });
    function lock() { generation++; code = ''; revision = null; $('messages').replaceChildren(); $('draft').value = ''; $('inbox').hidden = true; $('login').hidden = false; status('Inbox locked.'); }
    $('lock').addEventListener('click', lock);
    window.addEventListener('pagehide', lock);
})();

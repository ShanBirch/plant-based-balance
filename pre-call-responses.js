(async function () {
    const status = document.getElementById('status');
    const output = document.getElementById('responses');
    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) { status.textContent = 'Sign in to your coach dashboard, then return here to view answers.'; return; }
        const response = await fetch('/api/pre-call', { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (!response.ok) throw new Error('unavailable');
        const { responses } = await response.json();
        status.textContent = responses.length ? `${responses.length} submission${responses.length === 1 ? '' : 's'}. Newest first.` : 'No answers yet.';
        for (const row of responses) {
            const details = document.createElement('details'); details.className = 'section';
            const summary = document.createElement('summary');
            summary.textContent = `${row.client_name} · ${row.data.form_kind === 'menopause' ? 'Menopause' : 'General'} · ${new Date(row.created_at).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })}`;
            const content = document.createElement('div'); content.className = 'answer';
            const email = document.createElement('p'); email.textContent = row.data.contact_email; content.append(email);
            // Render all submitted strings as text, never HTML.
            const questions = window.BalancePreCallForms[row.data.form_kind]?.questions || [];
            Object.entries(row.data.answers || {}).forEach(([key, value]) => {
                const heading = document.createElement('h3'); heading.textContent = questions.find(q => q.id === key)?.label || key.replace(/_/g, ' ');
                const answer = document.createElement('p'); answer.textContent = Array.isArray(value) ? value.join(', ') || 'Skipped' : value || 'Skipped';
                content.append(heading, answer);
            });
            details.append(summary, content); output.append(details);
        }
    } catch (_) { status.textContent = 'Answers couldn’t be loaded. Check your coach sign-in and refresh this page.'; }
})();

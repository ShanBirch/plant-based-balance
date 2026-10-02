(function () {
    'use strict';
    const kind = document.body.dataset.form;
    const config = window.BalancePreCallForms[kind];
    document.getElementById('title').textContent = config.title;
    document.getElementById('subtitle').textContent = config.subtitle;
    document.getElementById('intro').textContent = config.intro;
    const fields = document.getElementById('questions');
    config.questions.forEach((question, index) => {
        const field = document.createElement('fieldset');
        const legend = document.createElement('legend');
        const number = document.createElement('span');
        number.className = 'number'; number.textContent = `QUESTION ${index + 1}`;
        legend.append(number, document.createTextNode(question.label)); field.append(legend);
        if (question.hint || question.type === 'multi') {
            const hint = document.createElement('p'); hint.className = 'hint'; hint.id = `${question.id}-hint`;
            hint.textContent = question.hint || 'Choose any that apply.'; field.append(hint);
        }
        if (question.type === 'text') {
            const input = document.createElement('textarea'); input.name = question.id; input.maxLength = 1800;
            input.setAttribute('aria-label', question.label);
            if (question.hint) input.setAttribute('aria-describedby', `${question.id}-hint`);
            field.append(input);
        } else question.options.forEach(option => {
            const label = document.createElement('label'); label.className = 'option';
            const input = document.createElement('input'); input.type = question.type === 'multi' ? 'checkbox' : 'radio';
            input.name = question.id; input.value = option;
            label.append(input, document.createTextNode(option)); field.append(label);
        });
        fields.append(field);
    });
    const form = document.getElementById('pre-call-form');
    const status = document.getElementById('status');
    const submit = document.getElementById('submit');
    // Keep answers in memory only: no health details in localStorage, URLs, or analytics.
    let submissionId = crypto.randomUUID();
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const data = new FormData(form);
        const answers = {};
        config.questions.forEach(q => { answers[q.id] = q.type === 'multi' ? data.getAll(q.id) : (data.get(q.id) || ''); });
        submit.disabled = true; submit.textContent = 'Sending…';
        status.className = 'status'; status.textContent = '';
        try {
            const response = await fetch('/api/pre-call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                kind, submission_id: submissionId, name: data.get('name'), email: data.get('email'), website: data.get('website'), consent: data.get('consent') === 'yes', answers
            }) });
            if (!response.ok || (await response.json()).ok !== true) throw new Error('submit_failed');
            form.hidden = true;
            const success = document.getElementById('success'); success.hidden = false; success.focus(); success.scrollIntoView({ block: 'start' });
        } catch (_) {
            status.className = 'status error';
            status.textContent = 'Your answers haven’t been sent. Please try again. They’re still here, and you can also discuss them on the call.';
        } finally { submit.disabled = false; submit.textContent = 'Send my answers to Shannon'; }
    });
})();

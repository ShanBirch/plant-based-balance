(function () {
    'use strict';
    const weeks = [
        { title: 'Lead through the example you set', idea: 'Leading begins with behaviour you can stand behind. Sharing a realistic action and following through gives you concrete evidence of the person you want to be. Helping someone else can give that action a social purpose, but your identity does not depend on their result.', task: 'Choose one value you want to practise as a supporter. Describe an action you already take and how you could make it useful to someone else.', question: 'What is useful evidence of leadership?', choices: ['Promising a perfect result', 'Following through on a realistic action', 'Making someone depend on you'], answer: 1 },
        { title: 'Invite someone into a small challenge', idea: 'Ask whether someone wants company or encouragement before setting a challenge. Let them choose a meaningful, manageable action, such as a walk, a planned session or preparing a meal. Agree on the duration and check-in together. A person can decline; the invitation should leave the relationship comfortable.', task: 'Invite someone to a small challenge. Record the invitation, their response and any agreed action and check-in. If they decline, describe how you respected that choice and a low-pressure way to offer support in future.', question: 'Who should choose the challenge?', choices: ['You alone', 'The person with the hardest routine', 'You and the other person together, with their agreement'], answer: 2 },
        { title: 'Encourage without taking over', idea: 'Notice a specific action rather than giving vague praise or commenting on someone’s body. Ask what helped and what kind of support they want. Listening, acknowledging effort and helping someone recognise their own choices keeps ownership with them.', task: 'Offer one specific, supportive response to someone in Balance Feed or your agreed challenge. Write what they shared, how you responded and why that response was useful. Use initials rather than private details.', question: 'Which response keeps ownership with the person?', choices: ['You must follow my plan', 'You made time for that walk. What helped?', 'Your result is now my responsibility'], answer: 1 },
        { title: 'Support someone through a setback', idea: 'A missed action is information about the plan and the week. Listen before offering a fix. Help the person choose a smaller next step if they want help. You can support ordinary habits without acting as their clinician or taking responsibility for problems outside your role.', task: 'Reflect on a real or clearly labelled practice conversation about a setback. Write how you would listen, offer a smaller next step and recognise when the person needs help beyond your role.', question: 'What is a useful first response to a setback?', choices: ['Listen and ask what support would help', 'Make the challenge harder', 'Tell everyone what happened'], answer: 0 },
        { title: 'Make your community stronger', idea: 'A useful community gives people chances to contribute as well as receive encouragement. Welcome someone, answer a question from your experience or connect them with an appropriate resource. Share another person’s story only with their permission. Influence is useful when it helps people make their own choices.', task: 'Contribute one useful action in Balance Feed or your agreed group. Record what you did, why it was relevant and what you learned from the response. Keep other people’s personal information private.', question: 'Before sharing another person’s progress story, what comes first?', choices: ['Make it more dramatic', 'Get their permission', 'Choose a transformation photo'], answer: 1 },
        { title: 'Keep a sustainable supporting role', idea: 'Review what you actually did: showing up, listening, inviting and following through. Those actions provide evidence of the identity you are practising. Decide which you can keep doing without making support a full-time obligation. Someone else’s progress remains theirs.', task: 'Review your challenge or support actions. Describe what helped, what you would change, how your actions relate to your identity and one sustainable commitment for the next four weeks.', question: 'What should your final reflection focus on?', choices: ['Controlling someone else’s outcome', 'Doing more regardless of your capacity', 'Your actions, boundaries and a commitment you can sustain'], answer: 2 }
    ];
    const esc = value => String(value || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    let owner = null, data = {}, context = null, index = 0, busy = false;
    const current = () => { if (owner !== window.currentUser?.id) { owner = window.currentUser?.id; data = {}; } return data; };
    const done = (i, draft = current()) => draft.weeks?.[i]?.complete === true && draft.weeks[i].answer === weeks[i].answer && String(draft.weeks[i].reflection || '').trim().length >= 20;
    function progress() { const completed = weeks.filter((_, i) => done(i)).length; return { completed, total: 6, percent: Math.round(completed / 6 * 100), isComplete: completed === 6 }; }
    async function load() {
        current(); const user = owner;
        if (!user) throw new Error('Sign in to save your Lead work.');
        const result = await window.supabaseClient.from('balance_lead_projects').select('data').eq('user_id', user).maybeSingle();
        if (result.error) throw new Error('Could not load Lead. Please retry.');
        if (window.currentUser?.id !== user) throw new Error('Your account changed. Open Lead again.');
        data = result.data?.data || {};
    }
    function status(text) { const el = document.getElementById('lead-status'); if (el) el.textContent = text; }
    async function save(complete = false) {
        if (busy) return false;
        const form = document.getElementById('lead-form'); if (!form) return true;
        const values = new FormData(form), user = owner, week = index;
        const row = { answer: values.has('answer') ? Number(values.get('answer')) : null, reflection: String(values.get('reflection') || '').trim(), complete: complete || done(week) };
        if (complete && (row.answer !== weeks[week].answer || row.reflection.length < 20)) { status('Choose the answer that supports the person and write your practical reflection before completing this week.'); return false; }
        busy = true;
        try {
            if (!user || user !== window.currentUser?.id) throw new Error('Open Lead again before saving.');
            const draft = { ...data, weeks: { ...data.weeks, [week]: row } };
            const result = await window.supabaseClient.from('balance_lead_projects').upsert({ user_id: user, data: draft, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).select('data').single();
            if (result.error || !result.data) throw new Error('Your work was not saved. Please retry.');
            if (window.currentUser?.id !== user) throw new Error('Your account changed. Open Lead again.');
            data = result.data.data; context?.track?.(complete ? 'lead_week_completed' : 'lead_draft_saved', { week: week + 1, curriculum_version: 'lead_support_v1' });
            status('Saved to your account.'); return true;
        } catch (e) { status(e.message); return false; } finally { busy = false; }
    }
    function render() {
        const host = document.getElementById('learning-content'); if (!host) return;
        const week = weeks[index], row = data.weeks?.[index] || {}, p = progress();
        host.innerHTML = `<div class="master-course"><header><span class="master-kicker">Balance Lead</span><h2>Help someone else take the next step</h2><p>Six practical weeks about encouragement, shared challenges and the identity you practise by helping others. Work through them at your pace.</p><p>${p.completed} of 6 weeks complete</p></header><nav aria-label="Lead weeks">${weeks.map((w,i)=>`<button type="button" data-lead-week="${i}" ${i===index?'aria-current="step"':''}>${done(i)?'✓':i+1}. ${esc(w.title)}</button>`).join('')}</nav><section><h2>Week ${index+1}: ${esc(week.title)}</h2><p>${esc(week.idea)}</p><form id="lead-form"><fieldset><legend>${esc(week.question)}</legend>${week.choices.map((a,i)=>`<label class="master-answer"><input type="radio" name="answer" value="${i}" ${row.answer===i?'checked':''}><span>${esc(a)}</span></label>`).join('')}</fieldset><label class="master-field"><span>${esc(week.task)}</span><textarea name="reflection" rows="6" maxlength="3000">${esc(row.reflection)}</textarea></label><p>This is your own reflection. It does not send a message or verify another person’s activity.</p><div class="master-actions"><button type="button" id="lead-save">Save draft</button><button type="submit">Complete this week</button></div><p id="lead-status" role="status"></p></form>${context?.deeper?.(index+1)||''}${p.isComplete?'<h3>Lead complete</h3><p>You have reflected on a practical pattern of support. Keep your next commitment small and useful.</p>':''}<button id="lead-library">View all courses</button></section></div>`;
        host.querySelector('#lead-form').onsubmit = async e => { e.preventDefault(); const form=e.currentTarget; if (await save(true) && document.getElementById('lead-form')===form) render(); };
        host.querySelector('#lead-save').onclick = () => save();
        host.querySelectorAll('[data-lead-week]').forEach(button => button.onclick = async () => { if (await save()) { index = Number(button.dataset.leadWeek); render(); } });
        host.querySelector('#lead-library').onclick = () => leave(context?.library);
    }
    async function open(options) {
        context = options; current();
        const host = document.getElementById('learning-content'); if (!host) return;
        if (!options.unlocked) { host.innerHTML = '<div class="master-course"><header><h2>Balance Lead</h2><p>Complete Balance Learn to begin. Lead helps you support, motivate and invite someone into a small challenge.</p></header><section>'+weeks.map((w,i)=>'<h3>Week '+(i+1)+': '+esc(w.title)+'</h3>').join('')+'<button id="lead-library">View all courses</button></section></div>'; host.querySelector('#lead-library').onclick=options.library; return; }
        host.innerHTML = '<div class="master-course"><p>Loading your Lead work...</p></div>';
        try { await load(); if (context === options) render(); }
        catch (e) { host.innerHTML = '<div class="master-course"><p role="alert">'+esc(e.message)+'</p><button id="lead-retry">Retry</button><button id="lead-library">View all courses</button></div>'; host.querySelector('#lead-retry').onclick=()=>open(options);host.querySelector('#lead-library').onclick=options.library; }
    }
    async function leave(callback) { if (await save()) { context=null; callback?.(); } }
    window.BalanceLead = { open, load, progress, leave, weeks, done, cancel: () => { context=null; } };
})();

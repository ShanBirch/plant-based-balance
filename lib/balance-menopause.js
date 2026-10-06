/* Private content lives in RLS-protected rows, never in this public module. */
(function () {
    'use strict';
    const COURSE = 'balance-menopause';
    const OWNER = '00a6605e-8edb-4917-85ba-24a23f179059';
    let payload = null, rows = [], loadedFor = null, generation = 0, loading = null;
    let hooks = null, authBound = false, active = false, lastWeek = null;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const userId = () => window.currentUser?.id || null;
    const container = () => document.getElementById('learning-content');
    const owner = () => userId() === OWNER && !window.isAdminViewing;
    const valid = () => owner() && loadedFor === userId() && !!payload;
    function clear() {
        generation++; payload = null; rows = []; loadedFor = null; loading = null;
        hooks?.clear();
        if (active) {
            active = false; lastWeek = null;
            document.getElementById('game-feedback-overlay')?.remove();
            window.LearningMascot?.hide();
            if (container()) container().innerHTML = '<p role="status">Private course closed. Open Learn with your current account.</p>';
        }
        document.getElementById('view-learning')?.classList.remove('menopause-active');
    }
    function bindAuth() {
        if (authBound || !window.supabaseClient?.auth) return;
        authBound = true;
        window.supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT' || (loadedFor && session?.user?.id !== loadedFor)) clear();
        });
    }
    async function load() {
        bindAuth();
        if (loadedFor && loadedFor !== userId()) clear();
        if (!owner()) { clear(); return false; }
        if (valid()) return true;
        if (loading) return loading;
        const identity = userId(), token = generation;
        loading = (async () => {
            try {
                // Verify identity with the auth server, rather than trusting a dashboard global.
                const auth = await window.supabaseClient.auth.getUser();
                if (auth.error || auth.data.user?.id !== OWNER || auth.data.user.email !== 'shannonbirch@cocospersonaltraining.com' || !auth.data.user.email_confirmed_at) throw new Error('Private access unavailable');
                const course = await window.supabaseClient.from('private_learning_courses').select('payload').eq('id', COURSE).maybeSingle();
                const progress = await window.supabaseClient.from('private_learning_progress').select('lesson_id,score,completed,reflection').eq('course_id', COURSE).eq('user_id', identity);
                if (course.error || progress.error || !course.data?.payload) throw new Error('Private course unavailable');
                if (token !== generation || identity !== userId() || !owner()) return false;
                payload = course.data.payload; rows = progress.data || []; loadedFor = identity;
                hooks?.register(payload);
                return true;
            } catch (_) {
                if (token === generation) { payload = null; rows = []; loadedFor = null; }
                return false;
            } finally { if (token === generation) loading = null; }
        })();
        return loading;
    }
    function lesson(id) { return valid() ? payload.weeks.flatMap(w => w.lessons).find(l => l.id === id) || null : null; }
    function progress() {
        const completed = valid() ? rows.filter(r => r.completed && r.lesson_id.startsWith('menopause-')).length : 0;
        return {completed,total:27,percent:Math.round(completed/27*100),isComplete:completed===27};
    }
    function catalog() {
        if (loadedFor && loadedFor !== userId()) clear();
        return {type:'private',id:COURSE,title:'Balance Menopause',subtitle:'Nine weeks of science, nutrition and everyday support',description:owner()?'Your private course review. All nine weeks are available.':'Private review. This course is not open for enrolment.',accent:'#b8892b',number:1,progress:progress(),isUnlocked:owner(),previousTitle:'Private review'};
    }
    function surface() {
        active = true;
        document.getElementById('view-learning')?.classList.add('menopause-active');
        if (container()) container().scrollTop = 0;
    }
    function header(title, subtitle) {
        return `<div class="menopause-page"><header><small>Balance Menopause · Private review</small><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></header>`;
    }
    async function open() {
        surface();
        if (!owner()) {
            if (container()) container().innerHTML = header('Private course','Available only to the authorised review account.') + '<button onclick="window.backToCourseLibrary()">View all courses</button></div>';
            return;
        }
        const identity = userId(), token = generation;
        surface(); lastWeek = null;
        container().innerHTML = header('Opening your course','Loading private lessons and saved progress…') + '</div>';
        if (!await load()) {
            if (identity === userId() && token === generation && active) container().innerHTML = header('Course unavailable','Your private lessons could not be loaded. Please try again.') + '<button onclick="window.BalanceMenopause.open()">Try again</button><button onclick="window.backToCourseLibrary()">View all courses</button></div>';
            return;
        }
        if (!valid() || !active) return;
        const p = progress();
        container().innerHTML = header('Understand the transition','Science, nourishing plant-based meals, strength and informed care.') +
            `<p class="menopause-note">Private educational review for Shannon. Clinical and supplement content needs qualified review before wider release. No personal prescription or guaranteed symptom outcome.</p><p>${p.completed} of 27 lessons complete · ${p.percent}%</p><progress value="${p.completed}" max="27" aria-label="Course progress"></progress><div class="menopause-weeks">${payload.weeks.map(w => `<button onclick="window.BalanceMenopause.week(${w.number})"><small>Week ${w.number} · 3 lessons</small><strong>${esc(w.title)}</strong><span>${w.lessons.filter(l=>rows.some(r=>r.lesson_id===l.id&&r.completed)).length}/3 complete</span></button>`).join('')}</div><button onclick="window.backToCourseLibrary()">View all courses</button></div>`;
        hooks?.history('courseDetail');
    }
    function week(number) {
        if (!valid()) return open();
        const w = payload.weeks.find(w => w.number === number); if (!w) return;
        surface(); lastWeek = number;
        const saved = rows.find(r=>r.lesson_id === 'week-'+number)?.reflection || '';
        container().innerHTML = header('Week '+number+': '+w.title,'Read each lesson, practise an activity and complete its eight-question quiz.') +
            `<div class="menopause-lessons">${w.lessons.map((l,i)=>`<button onclick="window.BalanceMenopause.start('${l.id}')"><small>Lesson ${number}.${i+1}</small><strong>${esc(l.title)}</strong><span>${rows.some(r=>r.lesson_id===l.id&&r.completed)?'Review':'Start'}</span></button>`).join('')}</div><section><h3>Optional weekly reflection</h3><p>${esc(w.reflection)}</p><label for="menopause-reflection">Your notes, saved privately</label><textarea id="menopause-reflection" maxlength="4000" rows="5">${esc(saved)}</textarea><button id="menopause-save-reflection" onclick="window.BalanceMenopause.saveReflection(${number})">Save reflection</button><p id="menopause-save-status" role="status"></p></section><button onclick="window.BalanceMenopause.open()">View course overview</button></div>`;
        hooks?.history('courseDetail');
    }
    function start(id) {
        if (!lesson(id)) return open();
        surface(); lastWeek = Number(id.split('-')[1]);
        hooks?.start(id);
    }
    async function save(row) {
        if (!valid()) throw new Error('Private access changed');
        const identity = userId(), token = generation;
        const next = {user_id:identity,course_id:COURSE,...row,updated_at:new Date().toISOString()};
        const result = await window.supabaseClient.from('private_learning_progress').upsert(next,{onConflict:'user_id,course_id,lesson_id'}).select('lesson_id,score,completed,reflection').single();
        if (result.error) throw new Error('Save failed');
        if (token !== generation || identity !== userId() || !valid()) throw new Error('Private access changed');
        rows = rows.filter(r=>r.lesson_id!==row.lesson_id).concat(result.data);
    }
    async function saveReflection(number) {
        const text = document.getElementById('menopause-reflection')?.value || '';
        const button = document.getElementById('menopause-save-reflection');
        const status = document.getElementById('menopause-save-status');
        if (button) button.disabled = true;
        try { await save({lesson_id:'week-'+number,reflection:text}); if(status?.isConnected)status.textContent='Reflection saved privately.'; }
        catch (_) { if(status?.isConnected)status.textContent='Not saved. Please try again.'; }
        finally { if(button?.isConnected)button.disabled=false; }
    }
    async function complete(id, score) {
        if (!lesson(id)) return;
        const token = generation, identity = userId();
        surface();
        const previous = rows.find(r=>r.lesson_id===id);
        let saved = false;
        try { await save({lesson_id:id,score:Math.max(score,previous?.score||0),completed:score===100||!!previous?.completed}); saved=true; } catch (_) {}
        if (token!==generation || identity!==userId() || !valid() || !active) return;
        const title = lesson(id).title;
        hooks?.history('lessonComplete');
        container().innerHTML = header(saved&&score===100?'Lesson complete':saved?'Keep practising':'Progress not saved',title) +
            `<p>${score}% correct. ${saved?'Your result is saved privately.':'Check your connection and retry saving. This result has not been marked complete.'}</p>${!saved?`<button onclick="window.BalanceMenopause.complete('${id}',${score})">Retry save</button>`:''}<button onclick="window.BalanceMenopause.start('${id}')">Review lesson</button><button onclick="window.BalanceMenopause.week(${lastWeek})">Return to week ${lastWeek}</button></div>`;
    }
    function evidence(l) {
        if (!valid()) return '';
        const researchers=l.id==='menopause-1-1'?`<h3>Meet the researchers</h3>${(payload.researchers||[]).map(r=>`<article><h4>${esc(r.name)}</h4><p>${esc(r.role)}</p><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Official profile and authentic photograph</a></article>`).join('')}<p>These researchers do not endorse Balance. Portrait reuse permissions have not been established, so their photographs remain on the original sites.</p>`:'';
        return `<section class="menopause-evidence">${researchers}<h3>Try it in everyday life</h3><p>${esc(l.activity)}</p><details><summary>Explore the science and its limits</summary>${l.sources.map(s=>`<article><h4><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a></h4><p><strong>Question and design:</strong> ${esc(s.design)}</p><p><strong>What it adds:</strong> ${esc(s.finding)}</p><p><strong>Limits:</strong> ${esc(s.limit)}</p></article>`).join('')}</details></section>`;
    }
    function leave() { active=false; document.getElementById('view-learning')?.classList.remove('menopause-active'); }
    window.BalanceMenopause={load,open,week,start,complete,saveReflection,lesson,catalog,evidence,clear,leave,valid,bind: h=>{hooks=h;bindAuth();},back:()=>lastWeek?week(lastWeek):open()};
    // Dashboard identities can change through coach switching without an auth event.
    setInterval(() => { if (loadedFor && (!owner() || loadedFor !== userId())) clear(); }, 500);
})();

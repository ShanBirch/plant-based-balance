(function () {
    'use strict';
    const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const titles = ['Know the muscles you train','Understand compound lifts','Choose exercises for your muscles','Set your training dose','Build your workout program','Fit cardio and recovery into your plan','Learn how to build a meal','Check variety and essential nutrients','Design one week of meals','Review and adjust your plans'];
    const text = (label,value) => value ? `<p><strong>${esc(label)}</strong><br>${esc(value)}</p>` : '';
    function workout(plan, templates={}) {
        if (!plan) return '';
        return text('Muscle split',plan.split)+text('Why this split',plan.splitReason)+text('Goal',plan.goal)+text('Time and recovery',plan.constraints)+days.map((day,i)=>{
            const id=plan.days?.[i], template=templates[id];
            const exercises = Object.values(plan.prescriptions?.[id] || {}).map(p=>`<li>${esc(p.exercise)}: ${esc(p.sets)} sets × ${esc(p.reps)}; rest ${esc(p.rest)}; effort ${esc(p.effort)}</li>`).join('');
            return `<details><summary>${day}: ${esc(id==='rest'?'Rest / other activity':template?.name || 'Saved workout')}</summary>${text('Why this day',plan.dayReasons?.[i])}${exercises?`<ul>${exercises}</ul>`:''}</details>`;
        }).join('')+text('Muscle coverage',plan.coverage)+text('Progression',plan.progression);
    }
    function meal(plan) {
        if(!plan)return '';
        return text('Dietary needs',plan.needs)+days.map((day,i)=>`<details><summary>${day}</summary>${['breakfast','lunch','dinner','snacks'].map(k=>text(k,plan.days?.[i]?.[k])).join('')}</details>`).join('')+text('Shopping',plan.shopping)+text('Preparation',plan.prep)+text('Backup',plan.backup);
    }
    function actionEvidence(row) {
        const s = row.snapshot || {}, e = row.evidence || {};
        let html = text('Your answer', s.answer);
        for (const [key,label] of Object.entries({split:'Muscle split',splitReason:'Why this split',goal:'Goal',constraints:'Time and equipment',coverage:'Muscle coverage',progression:'Progression',needs:'Dietary needs',shopping:'Shopping list',prep:'Preparation',backup:'Backup meal'})) html += text(label,s[key]);
        if (s.prescriptions) html += Object.entries(s.prescriptions).map(([id,rows]) => `<h4>${esc(e.workouts?.[id]?.name || 'Saved workout')}</h4><ul>${Object.values(rows).map(p=>`<li>${esc(p.exercise)}: ${esc(p.sets)} sets × ${esc(p.reps)}; rest ${esc(p.rest)}; effort ${esc(p.effort)}</li>`).join('')}</ul>`).join('');
        if (s.dayReasons) html += days.map((day,i)=>text(day,s.dayReasons[i])).join('');
        if (s.days) html += days.map((day,i)=> typeof s.days[i] === 'string' ? text(day,s.days[i]==='rest'?'Rest / other activity':e.workouts?.[s.days[i]]?.name || 'Saved workout') : `<details><summary>${day}</summary>${['breakfast','lunch','dinner','snacks'].map(key=>text(key,s.days[i]?.[key])).join('')}</details>`).join('');
        if (/^https:\/\//.test(e.video || '')) html += `<p>Video sent ${esc(new Date(e.submittedAt).toLocaleString('en-AU'))} · <a href="${esc(e.video)}" target="_blank" rel="noopener">View ${esc(s.movement)} clip</a></p>`;
        return html;
    }
    window.loadMasterAssessments = async function(clientId,host) {
        host.innerHTML='<p>Loading Master assignments…</p>';
        try {
            const sb=window.supabaseClient;
            const [submissions,project,reflections,actions]=await Promise.all([
                sb.from('balance_master_submissions').select('*').eq('user_id',clientId).order('week'),
                sb.from('balance_master_projects').select('data,updated_at').eq('user_id',clientId).maybeSingle(),
                sb.from('lesson_reflections').select('lesson_id,lesson_title,reflection_text,updated_at').eq('user_id',clientId).order('updated_at',{ascending:false}),
                sb.from('balance_master_action_submissions').select('*').eq('user_id',clientId).order('week')
            ]);
            if([submissions,project,reflections,actions].some(r=>r.error))throw Error('Could not load course records.');
            if(!host.isConnected)return;
            const rows=submissions.data || [], draft=project.data?.data;
            const actionRows=actions.data || [], plan=window.BalanceMasterActions.weeks;
            const completeWeek=i=>draft?.completedStages?.[i]===true && plan[i].every(a=>actionRows.some(r=>r.week===i+1 && r.action_key===a.key && r.is_current));
            host.innerHTML=`<style>.master-coach-records{background:var(--bg-card,#fff);color:var(--text-primary,#20251f);border:1px solid #b9b5a9;border-radius:14px;padding:16px;margin:14px 0;overflow-wrap:anywhere}.master-coach-records *{-webkit-text-fill-color:currentColor}.master-coach-records details{border-top:1px solid #aaa6;padding:12px 0}.master-coach-records summary{cursor:pointer;font-weight:600}.master-coach-records p{white-space:pre-wrap;line-height:1.5}.master-coach-records a{color:var(--text-primary,#24533c);text-decoration:underline}</style>
                <h3>Master assignments</h3><p><strong>${titles.filter((_,i)=>completeWeek(i)).length}/10 weeks complete · ${actionRows.filter(r=>r.is_current).length}/33 actions recorded</strong>. Each action keeps its saved evidence and dates. Saved work and video submission still need coach review.</p>
                ${titles.map((title,i)=>{
                    const row=rows.find(r=>r.week===i+1), snap=row?.snapshot || {};
                    const count=plan[i].filter(a=>actionRows.some(r=>r.week===i+1 && r.action_key===a.key && r.is_current)).length;
                    const checklist=plan[i].map(a=>{
                        const r=actionRows.find(r=>r.week===i+1 && r.action_key===a.key);
                        return `<details class="master-coach-action"><summary>${r?.is_current?'✓':'○'} ${esc(a.title)} · ${r?.is_current?'Recorded':r?'Update needed':'Required'}</summary>${r?`<p>First recorded: ${esc(new Date(r.submitted_at).toLocaleString('en-AU'))}<br>Latest saved evidence: ${esc(new Date(r.updated_at).toLocaleString('en-AU'))}</p>${!r.is_current?'<p>The current draft no longer meets this action. Previous evidence is kept below.</p>':''}${actionEvidence(r)}`:'<p>No completed action saved yet.</p>'}</details>`;
                    }).join('');
                    return `<details><summary>Week ${i+1}: ${esc(title)} · ${count}/${plan[i].length} actions · ${completeWeek(i)?'Complete':'In progress'}</summary>${checklist}${row?`<details><summary>Last whole-week submission</summary><p>First submitted: ${esc(new Date(row.submitted_at).toLocaleString('en-AU'))}<br>Latest submission: ${esc(new Date(row.updated_at).toLocaleString('en-AU'))}</p>${text('Quiz reflection',snap.quizReflection)}${text('Earlier practical answer',snap.reflection)}${Object.entries(snap.actionAnswers || {}).map(([key,answer])=>text(plan[i].find(a=>a.key===key)?.title || key,answer)).join('')}${workout(snap.workout,snap.workouts)}${meal(snap.meal)}</details>`:'<p>This week has not been submitted yet.</p>'}</details>`;
                }).join('')}
                ${draft?`<details><summary>Latest saved draft · ${esc(new Date(project.data.updated_at).toLocaleString('en-AU'))}</summary><p>This may include unfinished answers or edits after the last submission. The recorded versions remain above.</p>${plan.map((actions,i)=>`<details><summary>Week ${i+1} draft answers</summary>${actions.filter(a=>a.kind==='written').map(a=>text(a.title,draft.actionAnswers?.[i+1]?.[a.key])).join('')}${text('Quiz reflection',draft.quizReflections?.[i])}</details>`).join('')}${workout(draft.workout)}${meal(draft.meal)}</details>`:''}
                <details><summary>Saved lesson reflections (${reflections.data?.length || 0})</summary>${(reflections.data||[]).map(r=>text(r.lesson_title,r.reflection_text)).join('') || '<p>No saved reflections yet.</p>'}</details>`;
        } catch(error) {
            host.textContent=error.message+' ';
            const retry=document.createElement('button');retry.textContent='Retry course records';retry.onclick=()=>window.loadMasterAssessments(clientId,host);host.appendChild(retry);
        }
    };
})();

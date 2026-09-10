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
    window.loadMasterAssessments = async function(clientId,host) {
        host.innerHTML='<p>Loading Master assignments…</p>';
        try {
            const sb=window.supabaseClient;
            const [submissions,project,reflections]=await Promise.all([
                sb.from('balance_master_submissions').select('*').eq('user_id',clientId).order('week'),
                sb.from('balance_master_projects').select('data,updated_at').eq('user_id',clientId).maybeSingle(),
                sb.from('lesson_reflections').select('lesson_id,lesson_title,reflection_text,updated_at').eq('user_id',clientId).order('updated_at',{ascending:false})
            ]);
            if([submissions,project,reflections].some(r=>r.error))throw Error('Could not load course records.');
            if(!host.isConnected)return;
            const rows=submissions.data || [], draft=project.data?.data;
            host.innerHTML=`<style>.master-coach-records{background:var(--bg-card,#fff);color:var(--text-primary,#20251f);border:1px solid #b9b5a9;border-radius:14px;padding:16px;margin:14px 0;overflow-wrap:anywhere}.master-coach-records *{-webkit-text-fill-color:currentColor}.master-coach-records details{border-top:1px solid #aaa6;padding:12px 0}.master-coach-records summary{cursor:pointer;font-weight:600}.master-coach-records p{white-space:pre-wrap;line-height:1.5}.master-coach-records a{color:var(--text-primary,#24533c);text-decoration:underline}</style>
                <h3>Master assignments</h3><p><strong>${rows.length}/10 weeks submitted</strong>. A draft is not a completed action. Video receipts confirm submission, not technique approval.</p>
                ${titles.map((title,i)=>{
                    const row=rows.find(r=>r.week===i+1), snap=row?.snapshot || {};
                    return `<details><summary>Week ${i+1}: ${esc(title)} · ${row?'Submitted':'Not submitted'}</summary>${row?`<p>First submitted: ${esc(new Date(row.submitted_at).toLocaleString('en-AU'))}<br>Latest submission: ${esc(new Date(row.updated_at).toLocaleString('en-AU'))}</p>${text('Quiz reflection',snap.quizReflection)}${text('Practical answer',snap.reflection)}${workout(snap.workout,snap.workouts)}${meal(snap.meal)}${Object.entries(row.evidence?.lifts || {}).map(([key,lift])=>`<p>${esc(key)}: submitted ${esc(new Date(lift.submittedAt).toLocaleString('en-AU'))}${/^https:\/\//.test(lift.video || '')?` · <a href="${esc(lift.video)}" target="_blank" rel="noopener">View clip</a>`:''}</p>`).join('')}`:'<p>No verified submission yet.</p>'}</details>`;
                }).join('')}
                ${draft?`<details><summary>Latest saved draft · ${esc(new Date(project.data.updated_at).toLocaleString('en-AU'))}</summary><p>This may include edits after the last submission. The submitted version remains above.</p>${workout(draft.workout)}${meal(draft.meal)}</details>`:''}
                <details><summary>Saved lesson reflections (${reflections.data?.length || 0})</summary>${(reflections.data||[]).map(r=>text(r.lesson_title,r.reflection_text)).join('') || '<p>No saved reflections yet.</p>'}</details>`;
        } catch(error) {
            host.textContent=error.message+' ';
            const retry=document.createElement('button');retry.textContent='Retry course records';retry.onclick=()=>window.loadMasterAssessments(clientId,host);host.appendChild(retry);
        }
    };
})();

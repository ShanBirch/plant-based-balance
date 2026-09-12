(function () {
  'use strict';
  let state = null, owner = null, selectedWeek = null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels = {planned:'Planned / not started', submitted:'Submitted — checking your action', needs_information:'More information needed', completed:'Completed', legacy_completed:'Earlier completion kept'};
  const complete = row => ['completed','legacy_completed'].includes(row?.status);
  async function api(input = null, query = {}) {
    const session = await window.supabaseClient.auth.getSession();
    const token = session.data?.session?.access_token;
    if (!token) throw new Error('Sign in to view your course actions.');
    const response = await fetch('/.netlify/functions/learn-action-review' + (input ? '' : '?' + new URLSearchParams(query)), {
      method:input ? 'POST' : 'GET', headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'}, ...(input ? {body:JSON.stringify(input)} : {})
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Your course action could not be loaded.');
    return data;
  }
  async function load() {
    const id = window.currentUser?.id;
    state = null; owner = null;
    const data = await api();
    if (id !== window.currentUser?.id) throw new Error('Your account changed.');
    state = data; owner = id;
    window.dispatchEvent(new CustomEvent('pbbLearnActionReviewUpdated'));
    return data;
  }
  function record(week) { return owner === window.currentUser?.id ? state?.records?.find(r=>r.week === Number(week)) : null; }
  function status(week) { return labels[record(week)?.status] || (state ? labels.planned : 'Status unavailable — reopen to retry'); }
  function details(row, definition) {
    const report = row?.report || {};
    return `<p>${esc(definition.prompt)}</p><p><strong>Reflection / plan</strong><br>${esc(row?.reflection_text || 'No reflection saved yet.')}</p>` +
      definition.fields.map(([key,label])=>`<p><strong>${esc(label)}</strong><br>${esc(report.answers?.[key] || 'Not reported yet.')}</p>`).join('') +
      (report.meal ? `<p><strong>Saved meal: ${esc(report.meal.name)}</strong><br>Protein ${esc(report.meal.protein_g)} g · Carbohydrates ${esc(report.meal.carbs_g)} g · Fat ${esc(report.meal.fat_g)} g<br>Personal daily targets: protein ${esc(report.targets?.protein_goal_g)} g · carbohydrates ${esc(report.targets?.carbs_goal_g)} g · fat ${esc(report.targets?.fat_goal_g)} g</p>` : '') +
      (row?.review_note ? `<p><strong>Action review</strong><br>${esc(row.review_note)}</p>` : '') +
      (row?.reviewed_at ? `<p>Reviewed ${esc(new Date(row.reviewed_at).toLocaleString())}</p>` : '');
  }
  function modal(title, body) {
    document.getElementById('learn-action-dialog')?.remove();
    const el = document.createElement('div'); el.id = 'learn-action-dialog';
    el.innerHTML = `<section role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2><button data-close aria-label="Close action">×</button></header><div class="lar-body">${body}<p role="status" data-error></p></div></section>`;
    document.body.appendChild(el);
    const close = () => el.remove(); el.querySelector('[data-close]').onclick = close;
    el.onkeydown = e => { if(e.key==='Escape') close(); };
    window.pushNavigationState?.('learn-action-dialog',close);
    window.enableSwipeBackNavigation?.('learn-action-dialog',close);
    return el;
  }
  function memberPage(week, def, row) {
    const done = complete(row), report = row?.report || {};
    const savedReport = def.fields.some(([key])=>report.answers?.[key]) || report.meal;
    return `<div class="lar-member">
      <div class="lar-week-picker"><label>Course action week<select data-action-week>${Array.from({length:Math.min(6,state.current_week)},(_,i)=>`<option value="${i+1}" ${i+1===week?'selected':''}>Week ${i+1}</option>`).join('')}</select></label><span class="lar-status${done?' is-complete':''}">${done?'✓ ':''}${esc(status(week))}</span></div>
      <div class="lar-hero"><span class="lar-eyebrow">BALANCE LEARN · WEEK ${week}</span><h3>${esc(def.title)}</h3><div class="lar-gold-rule" aria-hidden="true"></div><p>${esc(def.prompt)}</p></div>
      ${week===3 ? '<details class="lar-panel lar-history"><summary>Your week 1 and 2 records</summary>'+[1,2].map(w=>details(record(w),window.BalanceLearnWeeklyActions.experiment(w))).join('')+'</details>' : ''}
      <div class="lar-panel lar-notebook"><span class="lar-eyebrow">01 · YOUR NOTES</span><h3>A little space to reflect</h3>${!done ? `<form data-plan><label>${esc(def.reflection)}<textarea name="reflection" maxlength="2000" placeholder="Start with what you’ve noticed…" required>${esc(row?.reflection_text || '')}</textarea></label><button class="lar-primary">Save reflection / plan</button></form><p class="lar-caption">${row?.reflection_text?'Your saved reflection is shown above. You can come back and update it.':'Save a thought now. You can return to it as the week unfolds.'}</p>` : `<p class="lar-answer">${esc(row?.reflection_text || 'No reflection was recorded.')}</p>`}</div>
      <div class="lar-panel"><span class="lar-eyebrow">02 · YOUR WEEKLY CHECK-IN</span><h3>${done?'What you recorded':'Bring these details back'}</h3><p class="lar-caption">${done?'Your report is saved with this course week.':'Record what happened in your weekly check-in. Use these prompts as your guide.'}</p><ol class="lar-prompts">${def.fields.map(([key,label],i)=>`<li><span class="lar-prompt-number" aria-hidden="true">${i+1}</span><div><h4>${esc(label)}</h4>${report.answers?.[key]?`<p class="lar-answer">${esc(report.answers[key])}</p>`:''}</div></li>`).join('')}</ol>${report.meal ? `<div class="lar-saved-meal"><h4>${esc(report.meal.name)}</h4><p>Protein ${esc(report.meal.protein_g)} g · Carbohydrates ${esc(report.meal.carbs_g)} g · Fat ${esc(report.meal.fat_g)} g</p><p class="lar-caption">Daily targets: protein ${esc(report.targets?.protein_goal_g)} g · carbohydrates ${esc(report.targets?.carbs_goal_g)} g · fat ${esc(report.targets?.fat_goal_g)} g</p></div>`:''}${!done?`${week===6?'<button data-meal>Build and save a meal</button>':''}<button class="lar-primary" data-report>Open weekly check-in</button>`:''}${savedReport&&!done?'<p class="lar-caption">Your latest report is shown above.</p>':''}</div>
      ${done ? '<div class="lar-completion"><span class="lar-completion-icon" aria-hidden="true">✓</span><div><h4>Completed and saved</h4><p>Your action is recorded for this course week. You can return to these notes any time.</p></div></div>' : ''}
    </div>`;
  }
  async function open(week) {
    try {
      await load(); week = Number(week);
      if (!state?.available || week > state.current_week) throw new Error('That course week is not available yet.');
      const def = window.BalanceLearnWeeklyActions.experiment(week), row = record(week);
      const el = modal('Your weekly action', memberPage(week,def,row));
      el.querySelector('[data-action-week]').onchange=e=>open(Number(e.target.value));
      el.querySelector('[data-plan]')?.addEventListener('submit',async e=>{
        e.preventDefault(); const buttons=[...el.querySelectorAll('button,select')]; buttons.forEach(b=>b.disabled=true);
        try { await savePlan(week,e.target.elements.reflection.value); if(el.isConnected) await open(week); } catch(error){el.querySelector('[data-error]').textContent=error.message;buttons.forEach(b=>b.disabled=false);}
      });
      el.querySelector('[data-report]')?.addEventListener('click',()=>{selectedWeek=week;el.remove();window.openWeeklyCheckinPreview?.();});
      el.querySelector('[data-meal]')?.addEventListener('click',()=>{el.remove();window.openMealBuilder?.();});
    } catch(error){window.showToast?.(error.message,'error');}
  }
  async function savePlan(week,text) {
    const def=window.BalanceLearnWeeklyActions.experiment(week);
    const result=await api({operation:'plan',enrollment_id:state.enrollment.id,week,revision:record(week)?.revision || 0,lesson_id:def.lessonId,reflection_text:text});
    await load(); return result.record;
  }
  function form(weekOverride) {
    if (!state?.available) return '';
    const week = Number(weekOverride || selectedWeek || Math.min(6,state.current_week));
    const def=window.BalanceLearnWeeklyActions.experiment(week), row=record(week);
    if (!def || week>state.current_week) return '';
    return `<section data-learn-report data-week="${week}" data-revision="${row?.revision || 0}" data-enrollment="${esc(state.enrollment.id)}"><h3>Week ${week}: ${esc(def.title)}</h3><label class="pbb-wci-field">Course action week<select class="pbb-wci-input" data-learn-week>${Array.from({length:Math.min(6,state.current_week)},(_,i)=>`<option value="${i+1}" ${i+1===week?'selected':''}>Week ${i+1}</option>`).join('')}</select></label><p>${esc(def.prompt)}</p><p><strong>${esc(status(week))}</strong></p>${row?.reflection_text ? `<p>Saved reflection: ${esc(row.reflection_text)}</p>` : ''}${row?.review_note ? `<p>Action review: ${esc(row.review_note)}</p>` : ''}${complete(row) ? '<p>This completion is saved. No further report is needed.</p>' : def.fields.map(([key,label])=>`<label class="pbb-wci-field"><span class="pbb-wci-field-label">${esc(label)}</span><textarea class="pbb-wci-input" data-learn-answer="${key}" maxlength="2000">${esc(row?.report?.answers?.[key] || '')}</textarea></label>`).join('') + (week===6 ? `<label class="pbb-wci-field">Meal saved in your nutrition tracker<select class="pbb-wci-input" data-learn-meal><option value="">Choose a saved meal</option>${(state.meals || []).map(m=>`<option value="${esc(m.id)}" ${row?.report?.meal?.id===m.id?'selected':''}>${esc(m.name)} — P ${esc(m.protein_g)} g / C ${esc(m.carbs_g)} g / F ${esc(m.fat_g)} g</option>`).join('')}</select></label><p>Daily targets: protein ${esc(state.targets?.protein_goal_g ?? 'not set')} g · carbohydrates ${esc(state.targets?.carbs_goal_g ?? 'not set')} g · fat ${esc(state.targets?.fat_goal_g ?? 'not set')} g. Build your meal in the tracker and choose Save for later, then reopen this check-in.</p>` : '') + '<p>Describe what happened in your weekly check-in. Balance checks it alongside your reflection and records the action when the details match.</p>'}</section>`;
  }
  function bindForm(container) {
    container.addEventListener('change',e=>{if(e.target.matches('[data-learn-week]')){selectedWeek=Number(e.target.value);e.target.closest('[data-learn-report]').outerHTML=form(selectedWeek);}});
  }
  function payload(container) {
    const el=container.querySelector('[data-learn-report]');
    if(!el || complete(record(el.dataset.week))) return null;
    return {enrollment_id:el.dataset.enrollment,week:Number(el.dataset.week),revision:Number(el.dataset.revision),answers:Object.fromEntries([...el.querySelectorAll('[data-learn-answer]')].map(e=>[e.dataset.learnAnswer,e.value])),meal_id:el.querySelector('[data-learn-meal]')?.value || null};
  }
  async function coach(clientId,enrollmentId) {
    try {
      const ctx=await api(null,{client_id:clientId,...(enrollmentId?{enrollment_id:enrollmentId}:{})});
      const el=modal('Weekly check-in: Learn actions',`<p>Read the saved reflection and actual report against each action’s criteria. Confirming completion saves the course tick. Sending a coaching reply alone does not confirm an action.</p><label>Course enrollment<select data-enrollment>${ctx.enrollments.map(e=>`<option value="${esc(e.id)}" ${e.id===ctx.enrollment?.id?'selected':''}>Started ${esc(e.start_date)}${e.active?' · current':' · earlier'}</option>`).join('')}</select></label>${ctx.records.map(row=>{const def=row.instructions?.fields ? row.instructions : window.BalanceLearnWeeklyActions.experiment(row.week);return `<article data-review="${esc(row.id)}"><h3>Week ${row.week}: ${esc(def.title)}</h3><strong>${esc(labels[row.status])}</strong>${details(row,def)}<p><strong>Completion criteria</strong><br>${esc(def.criteria)}</p>${row.status==='submitted' && ctx.can_review ? `<label>Review note<textarea data-note maxlength="2000"></textarea></label><button data-operation="approve" data-week="${row.week}" data-revision="${row.revision}">Confirm completion</button><button data-operation="request_information" data-week="${row.week}" data-revision="${row.revision}">Request more information</button>`:''}</article>`;}).join('') || '<p>No action evidence saved yet.</p>'}`);
      el.querySelector('[data-enrollment]').onchange=e=>coach(clientId,e.target.value);
      el.querySelectorAll('[data-operation]').forEach(button=>button.onclick=async()=>{
        const note=button.closest('article').querySelector('[data-note]').value;
        el.querySelectorAll('[data-operation]').forEach(b=>b.disabled=true);
        try {await api({operation:button.dataset.operation,client_id:clientId,enrollment_id:ctx.enrollment.id,week:Number(button.dataset.week),revision:Number(button.dataset.revision),note});await coach(clientId,ctx.enrollment.id);}
        catch(error){el.querySelector('[data-error]').textContent=error.message;el.querySelectorAll('[data-operation]').forEach(b=>b.disabled=false);}
      });
    } catch(error){window.alert(error.message);}
  }
  window.BalanceLearnActionReview={load,record,status,complete,open,savePlan,form,bindForm,payload,coach,api,get state(){return owner===window.currentUser?.id?state:null;}};
})();

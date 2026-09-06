(function () {
    'use strict';
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const lessons = (course, week) => window.BalanceCurriculum?.forCourse(course, week) || [];
    function requirements(course, week, completed = window.getCourseLessonCompletions?.() || []) {
        const rows = lessons(course, week);
        const count = rows.filter(row => completed.includes(row.id)).length;
        return { total: rows.length, completed: count, complete: count === rows.length };
    }
    function row({ title, description = '', kicker = '', status = 'Start', number = '', locked = false, complete = false, attributes = '' }) {
        return `<button type="button" class="course-topic-row foundation-week-toggle${locked?' is-locked':''}${complete?' is-complete':''}" ${attributes} ${locked?'disabled':''}><span class="course-topic-number">${complete?'&#10003;':locked?'&#128274;':esc(number)}</span><span class="course-topic-copy"><span class="course-topic-kicker">${esc(kicker)}</span><span class="course-topic-title">${esc(title)}</span><span class="course-topic-description">${esc(description)}</span></span><span class="course-topic-status">${esc(status)} <span aria-hidden="true">⌄</span></span></button>`;
    }
    function overview({ course, title, subtitle, description, weeks, progress, locked, started = true, primary, onPrimary, number }) {
        return `<div id="course-learning-home" class="course-detail-page course-structured" style="--course-accent:#b8892b"><div class="course-detail-nav"><span class="course-week-page-nav-title">Course overview</span><span class="course-detail-nav-number">Course ${number}</span></div><section class="course-detail-hero"><div class="course-detail-orbit" aria-hidden="true"></div><div class="course-detail-hero-copy"><span class="course-detail-kicker">Balance learning series</span><h2>${esc(title)}</h2><p class="course-detail-subtitle">${esc(subtitle)}</p><p class="course-detail-description">${esc(description)}</p><div class="course-detail-facts"><span>${weeks.length} weeks · Lessons + practical tasks</span><span>${progress.completed}/${weeks.length} weeks complete</span></div><div class="course-detail-progress" aria-label="${progress.percent}% complete"><span style="width:${progress.percent}%"></span></div>${!locked&&onPrimary?`<button type="button" class="course-detail-primary" ${onPrimary}>${esc(primary)}</button>`:''}</div><div class="course-detail-number" aria-hidden="true">${number}</div></section>${locked?'<div class="course-path-lock-note course-detail-lock"><span aria-hidden="true">🔒</span><span>Complete Balance Learn to begin. Your weekly course outline is below.</span></div>':''}<section class="course-detail-curriculum"><div class="course-detail-section-heading"><div><span>Course content</span><h3>Your ${weeks.length===10?'ten':'six'}-week path</h3></div><span>${weeks.length} weeks</span></div><div class="course-topic-list">${weeks.map((week,i)=>{const r=requirements(course,i+1);return row({title:week.title,description:week.outcome,kicker:`Week ${i+1} · ${r.total?`${r.completed}/${r.total} quizzes · `:''}${week.done?1:0}/1 steps`,status:week.done?'Done':week.locked?(week.opens?'Opens '+week.opens:'Locked'):started?'Start':'Start course',number:i+1,locked:locked||week.locked,complete:week.done,attributes:`data-course-week="${i}"`});}).join('')}</div><button type="button" class="course-week-view-course" data-course-library>View all courses</button><p id="${course}-status" role="status"></p></section></div>`;
    }
    function lessonRows(course, week, locked = false) {
        const completed = window.getCourseLessonCompletions?.() || [];
        return lessons(course, week).map((lesson,i)=>row({title:lesson.title,kicker:`Lesson ${i+1} · Quiz`,status:completed.includes(lesson.id)?'Done':locked?'Locked':'Start',number:i+1,locked,complete:completed.includes(lesson.id),attributes:`onclick="window.openPathLesson('${lesson.id}','${course}')"`})).join('');
    }
    function introduction(items) {
        return items.map(([title,body],i)=>`<details class="course-teaching-card"><summary><span class="course-topic-number">${i+1}</span><span><small>Learn the idea</small><strong>${esc(title)}</strong></span><span aria-hidden="true">⌄</span></summary><div class="course-teaching-body"><p>${esc(body)}</p></div></details>`).join('');
    }
    function weekHeader(course, week, total, title, outcome) {
        return `<div class="course-week-page-header"><span class="course-week-page-kicker">Balance ${esc(course)} · Week ${week} of ${total}</span><h2>${esc(title)}</h2><p>${esc(outcome)}</p></div>`;
    }
    window.BalanceCourseLayout = { esc, lessons, requirements, row, overview, lessonRows, introduction, weekHeader };
})();

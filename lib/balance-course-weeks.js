(function () {
    'use strict';
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    function available(startedAt, total, now = Date.now()) {
        const start = Date.parse(startedAt);
        return Number.isFinite(start) ? Math.min(total, Math.max(1, Math.floor((now - start) / weekMs) + 1)) : 0;
    }
    async function read(course) {
        const user = window.currentUser?.id;
        if (!user) throw new Error('Sign in to open your course.');
        const result = await window.supabaseClient.from('balance_course_enrollments').select('started_at').eq('user_id', user).eq('course_id', course).maybeSingle();
        if (result.error) throw new Error('Could not load your course start date. Please retry.');
        if (window.currentUser?.id !== user) throw new Error('Your account changed. Open the course again.');
        return result.data?.started_at || null;
    }
    async function start(course) {
        const user = window.currentUser?.id;
        if (!user) throw new Error('Sign in to start your course.');
        const result = await window.supabaseClient.from('balance_course_enrollments').upsert({ user_id: user, course_id: course }, { onConflict: 'user_id,course_id', ignoreDuplicates: true });
        if (result.error) throw new Error('Your course could not start. Please retry.');
        if (window.currentUser?.id !== user) throw new Error('Your account changed. Open the course again.');
        return read(course);
    }
    function date(startedAt, index) { return new Date(Date.parse(startedAt) + index * weekMs).toLocaleDateString('en-AU', { timeZone: 'Australia/Brisbane', day: 'numeric', month: 'short' }); }
    window.BalanceCourseWeeks = { available, read, start, date };
})();

(function () {
    'use strict';
    const labels = { slide_1: 'Setup questions', slide_3: 'Optional cycle setup', slide_4: 'Training week', slide_6: 'Exercise preferences', slide_7: 'Confirm training week', slide_19: 'Starting recommendations', goal_setup_ready: 'Let’s begin', why_now: 'Six-week goal', main_blocker: 'What gets in the way', equipment_access: 'Training location', weekly_capacity: 'Weekly training capacity', saving_plan: 'Building your plan' };
    const label = key => labels[key] || String(key || '').replace(/[_-]/g, ' ').replace(/^./, s => s.toUpperCase());
    function element(tag, text) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node; }
    function table(container, title, headers, rows) {
        container.appendChild(element('h3', title));
        if (!rows.length) { container.appendChild(element('p', 'No recorded activity in this selection yet.')); return; }
        const wrapper = element('div'); wrapper.className = 'onboarding-report-table'; wrapper.tabIndex = 0; wrapper.setAttribute('aria-label', title + ', scroll horizontally for all columns');
        const grid = element('table'); const head = element('thead'); const tr = element('tr');
        headers.forEach(value => { const th = element('th', value); th.scope = 'col'; tr.appendChild(th); });
        head.appendChild(tr); grid.appendChild(head);
        const body = element('tbody'); rows.forEach(values => { const row = element('tr'); values.forEach(value => { const cell = element('td'); if (value instanceof Node) cell.append(value); else cell.textContent = value; row.appendChild(cell); }); body.appendChild(row); });
        grid.appendChild(body); wrapper.appendChild(grid); container.appendChild(wrapper);
    }
    let requestId = 0;
    window.loadOnboardingFunnel = async function () {
        const container = document.getElementById('onboarding-funnel-result');
        if (!container) return;
        const id = ++requestId;
        container.replaceChildren(element('p', 'Loading onboarding progress…'));
        try {
            const result = await window.supabaseClient.auth.getSession();
            const token = result?.data?.session?.access_token;
            if (!token) throw new Error('Sign in to see onboarding progress.');
            const days = document.getElementById('onboarding-funnel-days').value;
            const traffic = document.getElementById('onboarding-funnel-traffic').value;
            const response = await fetch('/.netlify/functions/onboarding-progress?days=' + days + '&traffic=' + traffic, { headers: { Authorization: 'Bearer ' + token } });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not load onboarding progress.');
            if (id !== requestId) return;
            container.replaceChildren();
            const totals = element('div'); totals.className = 'onboarding-report-totals';
            [[data.visitors, 'Tracked visitors'], [data.completed, 'Finished setup'], [data.quiet, 'Setup unfinished, quiet 24h+']].forEach(([count, title]) => {
                const card = element('div'); card.append(element('strong', count), element('span', title)); totals.appendChild(card);
            });
            container.appendChild(totals);
            container.appendChild(element('p', 'Counts use signed-in accounts where known and browser IDs before sign-in. Devices can count separately. Quiet means no further recorded activity, not a confirmed abandonment. Test browsers are excluded.'));
            container.appendChild(element('p', data.measured_from ? 'Detailed tracking begins with recorded events from ' + new Date(data.measured_from).toLocaleDateString('en-AU') + '. Earlier steps cannot be reconstructed.' : 'Detailed tracking is ready. Results will appear as visitors use the updated flow. Earlier steps cannot be reconstructed.'));
            table(container, 'Where people get to', ['Flow / stage', 'Step', 'Reached', 'Completed', 'Last recorded here', 'Median time'], data.steps.map(step => [label(step.flow) + ' / ' + label(step.phase), label(step.step), step.reached, step.completed, step.last, step.median_seconds == null ? 'Not recorded' : step.median_seconds + 's']));
            container.appendChild(element('p', 'Optional steps and different tour routes are counted separately. Last recorded here includes people still progressing. Times measure elapsed time on completed steps.'));
            table(container, 'Recent onboarding activity', ['Person', 'Last recorded step', 'When', 'Latest available replay'], (data.recent_sessions || []).map(item => {
                let replay = 'No linked replay';
                if (item.user_id && item.replay_session_id) {
                    replay = element('a', 'Watch replay');
                    replay.href = '/admin-session-replays.html?member=' + encodeURIComponent(item.user_id) + '&session=' + encodeURIComponent(item.replay_session_id);
                }
                return [item.member_name, label(item.phase) + ': ' + label(item.step) + ' · ' + label(item.status), new Date(item.last_at).toLocaleString('en-AU'), replay];
            }));
            container.appendChild(element('p', 'Replay starts after sign-in when troubleshooting replay is enabled. The timeline marks setup and tour steps, taps outside the highlight, and leaving or returning to Balance. These markers do not by themselves mean something went wrong. Replays expire after seven days; the latest unsent seconds may be missing.'));
            table(container, 'Campaigns and ads', ['Source', 'Campaign', 'Ad ID', 'Visitors', 'Finished setup'], data.campaigns.map(group => [group.source, group.campaign, group.ad, group.visitors, group.completed]));
            container.appendChild(element('p', 'Campaigns use the entry campaign recorded for this flow. Verified Meta ad IDs are resolved from the signed DM link where available. Missing campaign details stay Unattributed. Opening payment is not counted as a purchase.'));
        } catch (error) {
            if (id === requestId) container.replaceChildren(element('p', error.message || 'Could not load onboarding progress.'));
        }
    };
})();

(function () {
    'use strict';

    const endpoint = '/api/booking?mode=settings';
    const days = [
        ['1', 'Monday'], ['2', 'Tuesday'], ['3', 'Wednesday'], ['4', 'Thursday'],
        ['5', 'Friday'], ['6', 'Saturday'], ['0', 'Sunday'],
    ];
    const byId = (id) => document.getElementById(id);
    const card = byId('booking-settings-card');
    const status = byId('booking-setup-status');
    const form = byId('booking-settings-form');
    let session = null;
    let serverState = null;

    function setStatus(message, type) {
        status.textContent = message;
        status.className = `booking-setup-status${type ? ` ${type}` : ''}`;
    }

    function field(name) { return form.elements.namedItem(name); }

    async function headers() {
        session = await window.authHelpers?.getSession?.();
        if (!session?.access_token) throw new Error('sign_in_required');
        return { Authorization: `Bearer ${session.access_token}`, Accept: 'application/json' };
    }

    function setField(name, value) {
        const input = field(name);
        if (input) input.value = String(value ?? '');
    }

    function renderHours(hours) {
        const host = byId('booking-hours');
        host.innerHTML = days.map(([key, name]) => {
            const range = Array.isArray(hours?.[key]) ? hours[key][0] : null;
            return `<div class="booking-hours-row" data-day="${key}">
                <label><input type="checkbox" ${range ? 'checked' : ''}> ${name}</label>
                <input type="time" name="start" value="${range?.start || '10:00'}" ${range ? '' : 'disabled'}>
                <input type="time" name="end" value="${range?.end || '15:00'}" ${range ? '' : 'disabled'}>
            </div>`;
        }).join('');
    }

    function collectHours() {
        const weeklyHours = {};
        document.querySelectorAll('.booking-hours-row').forEach((row) => {
            const key = row.dataset.day;
            const enabled = row.querySelector('input[type="checkbox"]').checked;
            const start = row.querySelector('input[name="start"]').value;
            const end = row.querySelector('input[name="end"]').value;
            weeklyHours[key] = enabled && start && end && start < end ? [{ start, end }] : [];
        });
        return weeklyHours;
    }

    function renderState(data) {
        serverState = data;
        const settings = data.settings || {};
        field('booking_enabled').checked = Boolean(settings.booking_enabled);
        setField('event_name', settings.event_name || 'Balance call');
        setField('duration_minutes', settings.duration_minutes || 30);
        setField('minimum_notice_hours', settings.minimum_notice_hours || 24);
        setField('booking_window_days', settings.booking_window_days || 28);
        setField('location', settings.location || 'Online, link sent after booking');
        renderHours(settings.weekly_hours || {});
        byId('booking-link-label').textContent = data.bookingUrl || '/book';

        const connected = Boolean(data.googleCalendarConnected);
        byId('google-calendar-title').textContent = connected ? 'Google Calendar connected' : 'Google Calendar is not connected';
        byId('google-calendar-copy').textContent = connected
            ? 'Busy times are protected and confirmed calls create calendar invitations.'
            : (data.googleOAuthConfigured ? 'Connect your calendar before switching live so Balance can protect busy times.' : 'Add the Google OAuth client ID and secret in Netlify first, then connect here.');
        const googleButton = byId('google-calendar-button');
        googleButton.textContent = connected ? 'Disconnect' : 'Connect Google';
        googleButton.dataset.connected = connected ? 'true' : 'false';
        googleButton.disabled = !connected && !data.googleOAuthConfigured;

        byId('confirmation-email-copy').textContent = data.confirmationEmailConfigured
            ? 'Balance will send the branded confirmation email and the calendar invite after every booking.'
            : 'Calendar invitations still send after Google is connected. Add RESEND_API_KEY and BOOKING_EMAIL_FROM in Netlify to turn on the branded Balance confirmation email too.';
    }

    async function load() {
        try {
            const authHeaders = await headers();
            const response = await fetch(endpoint, { headers: authHeaders });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.ok) throw new Error(data.error || 'load_failed');
            renderState(data);
            form.hidden = false;
            card.setAttribute('aria-busy', 'false');
            const result = new URLSearchParams(window.location.search).get('calendar');
            setStatus(result === 'connected' ? 'Google Calendar is connected. Save your availability, then switch bookings live when you are ready.' : result === 'failed' ? 'Google Calendar connection did not complete. Try again once the redirect URI and OAuth credentials are set.' : 'Set your times, connect Google Calendar, then open bookings when it feels right.', result === 'failed' ? 'error' : result === 'connected' ? 'success' : '');
        } catch (error) {
            if (error.message === 'sign_in_required') {
                window.location.href = `/login.html?redirect=${encodeURIComponent('/booking-settings.html')}`;
                return;
            }
            card.setAttribute('aria-busy', 'false');
            setStatus('Could not load booking settings. Make sure you are signed in as Shannon and try again.', 'error');
        }
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const saveButton = byId('booking-settings-save');
        saveButton.disabled = true;
        saveButton.textContent = 'Saving…';
        try {
            const authHeaders = await headers();
            const settings = {
                booking_enabled: field('booking_enabled').checked,
                event_name: field('event_name').value.trim(),
                duration_minutes: Number(field('duration_minutes').value),
                minimum_notice_hours: Number(field('minimum_notice_hours').value),
                booking_window_days: Number(field('booking_window_days').value),
                location: field('location').value.trim(),
                weekly_hours: collectHours(),
            };
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.ok) throw new Error(data.error || 'save_failed');
            renderState({ ...serverState, settings: data.settings });
            setStatus(settings.booking_enabled ? 'Booking settings saved. Your public call page is now open.' : 'Booking settings saved. The public page stays closed until you switch bookings on.', 'success');
        } catch (_) {
            setStatus('Could not save those changes. Please try again.', 'error');
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = 'Save booking settings';
        }
    });

    byId('booking-hours').addEventListener('change', (event) => {
        if (event.target.type !== 'checkbox') return;
        const row = event.target.closest('.booking-hours-row');
        row.querySelectorAll('input[type="time"]').forEach((input) => { input.disabled = !event.target.checked; });
    });

    byId('google-calendar-button').addEventListener('click', async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
            const authHeaders = await headers();
            if (button.dataset.connected === 'true') {
                if (!window.confirm('Disconnect Google Calendar from Balance booking?')) return;
                const response = await fetch('/api/booking/google/disconnect', { method: 'POST', headers: authHeaders });
                if (!response.ok) throw new Error('disconnect_failed');
                await load();
                return;
            }
            const response = await fetch('/api/booking/google/connect', { headers: authHeaders });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.authorizeUrl) throw new Error(data.message || 'connect_failed');
            window.location.assign(data.authorizeUrl);
        } catch (_) {
            setStatus('Could not start the Google Calendar connection. Check the OAuth settings in Netlify and try again.', 'error');
        } finally {
            button.disabled = false;
        }
    });

    load();
}());

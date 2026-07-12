(function () {
    'use strict';

    const endpoint = '/api/booking';
    const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const state = { dates: [], selectedDateIndex: 0, selectedSlot: null, settings: null };

    const byId = (id) => document.getElementById(id);
    const loading = byId('booking-loading');
    const unavailable = byId('booking-unavailable');
    const flow = byId('booking-flow');
    const dateList = byId('booking-date-list');
    const slots = byId('booking-slots');
    const form = byId('booking-form');
    const outsideForm = byId('booking-outside-form');
    const selectedSlot = byId('booking-selected-slot');
    const error = byId('booking-error');
    const outsideError = byId('booking-outside-error');
    const success = byId('booking-success');
    const duration = byId('booking-duration');
    const outsideToggle = byId('booking-outside-toggle');
    const outsidePanel = byId('booking-outside-panel');

    function show(el, visible) {
        if (el) el.hidden = !visible;
    }

    function friendlyTimeZone() {
        return localTimeZone.replace(/_/g, ' ');
    }

    function formatParts(value, options) {
        return new Intl.DateTimeFormat(undefined, { timeZone: localTimeZone, ...options }).format(new Date(value));
    }

    function localDateKey(value) {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: localTimeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(new Date(value));
        const get = (type) => parts.find((part) => part.type === type)?.value || '';
        return `${get('year')}-${get('month')}-${get('day')}`;
    }

    function dateLabel(value) {
        return formatParts(value, { weekday: 'short', day: 'numeric', month: 'short' });
    }

    function timeLabel(value) {
        return formatParts(value, { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    function dateTimeLabel(value) {
        return formatParts(value, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true });
    }

    function selectedDate() {
        return state.dates[state.selectedDateIndex] || null;
    }

    function clearError(target = error) {
        if (!target) return;
        target.hidden = true;
        target.textContent = '';
    }

    function showError(message, target = error) {
        if (!target) return;
        target.hidden = false;
        target.textContent = message;
    }

    function currentCallType(targetForm) {
        const value = String(targetForm?.querySelector('[name="callType"]')?.value || 'phone').toLowerCase();
        return ['phone', 'video', 'whatsapp'].includes(value) ? value : 'phone';
    }

    function updateCallTypeFields(targetForm, phoneLabelId, noteId) {
        const callType = currentCallType(targetForm);
        const needsPhone = callType === 'phone' || callType === 'whatsapp';
        const phoneInput = targetForm?.querySelector('[name="phone"]');
        const phoneLabel = byId(phoneLabelId);
        const callTypeNote = byId(noteId);
        if (phoneInput) phoneInput.required = needsPhone;
        if (phoneLabel) {
            phoneLabel.innerHTML = needsPhone
                ? 'Phone <em>required for phone or WhatsApp</em>'
                : 'Phone <em>optional</em>';
        }
        if (callTypeNote) {
            callTypeNote.textContent = callType === 'video'
                ? 'You will get a Google Meet link in your calendar invitation.'
                : callType === 'whatsapp'
                    ? 'Shannon will give you a WhatsApp call on this number.'
                    : 'Shannon will call you on this number.';
        }
    }

    function groupSlotsInLocalTime(serverDates) {
        const grouped = new Map();
        (serverDates || []).flatMap((date) => Array.isArray(date.slots) ? date.slots : [])
            .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
            .forEach((slot) => {
                const key = localDateKey(slot.start);
                if (!grouped.has(key)) grouped.set(key, { key, label: dateLabel(slot.start), slots: [] });
                grouped.get(key).slots.push({ ...slot, label: timeLabel(slot.start) });
            });
        return Array.from(grouped.values());
    }

    function renderTimeZone() {
        const display = friendlyTimeZone();
        const label = byId('booking-timezone-label');
        const note = byId('booking-timezone-note');
        if (label) label.textContent = `Your time: ${display}`;
        if (note) note.textContent = `Times are shown in your timezone: ${display}`;
    }

    function renderDates() {
        if (!dateList) return;
        dateList.innerHTML = state.dates.map((date, index) => `
            <button class="booking-date-button ${index === state.selectedDateIndex ? 'active' : ''}" type="button" data-date-index="${index}">${escapeHtml(date.label)}</button>
        `).join('');
    }

    function renderSlots() {
        const date = selectedDate();
        state.selectedSlot = null;
        show(form, false);
        clearError();
        if (!slots) return;
        if (!date) {
            slots.innerHTML = '';
            return;
        }
        slots.innerHTML = date.slots.map((slot, index) => `
            <button class="booking-slot" type="button" data-slot-index="${index}">${escapeHtml(slot.label)}</button>
        `).join('');
    }

    function selectSlot(index) {
        const date = selectedDate();
        const slot = date && date.slots[index];
        if (!slot) return;
        state.selectedSlot = slot;
        document.querySelectorAll('.booking-slot').forEach((button, buttonIndex) => button.classList.toggle('active', buttonIndex === index));
        selectedSlot.textContent = `${dateTimeLabel(slot.start)} (${friendlyTimeZone()})`;
        show(form, true);
        clearError();
        form.querySelector('input[name="name"]')?.focus();
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
    }

    function setOutsideDateMinimum() {
        const input = outsideForm?.querySelector('[name="outsideDate"]');
        if (!input) return;
        const now = new Date();
        const localDate = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
        input.min = localDate;
    }

    function setOutsidePanel(open) {
        show(outsidePanel, open);
        if (outsideToggle) outsideToggle.setAttribute('aria-expanded', String(open));
        if (open) {
            clearError(outsideError);
            outsideForm?.querySelector('[name="outsideDate"]')?.focus();
        }
    }

    async function loadAvailability() {
        try {
            const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
            const data = await response.json();
            state.settings = data;
            state.dates = groupSlotsInLocalTime(Array.isArray(data.dates) ? data.dates : []);
            show(loading, false);
            duration.textContent = data.durationMinutes ? `${data.durationMinutes} min call` : 'Call times';
            renderTimeZone();
            if (!data.ok || !data.bookingEnabled || !state.dates.length) {
                show(unavailable, true);
                return;
            }
            show(flow, true);
            renderDates();
            renderSlots();
        } catch (_) {
            show(loading, false);
            duration.textContent = 'Call times';
            show(unavailable, true);
        }
    }

    function validateDetails(targetForm, targetError) {
        const data = new FormData(targetForm);
        const name = String(data.get('name') || '').trim();
        const email = String(data.get('email') || '').trim();
        const callType = currentCallType(targetForm);
        const phone = String(data.get('phone') || '').trim();
        if (!name || !email) {
            showError('Add your name and email to confirm this call.', targetError);
            return null;
        }
        if ((callType === 'phone' || callType === 'whatsapp') && phone.replace(/\D/g, '').length < 6) {
            showError('Add the number Shannon should use for this call.', targetError);
            return null;
        }
        return { data, name, email, callType, phone };
    }

    async function submitBooking(targetForm, startsAt, bookingMode, targetError) {
        clearError(targetError);
        const details = validateDetails(targetForm, targetError);
        if (!details) return;

        const button = targetForm.querySelector('button[type="submit"]');
        button.disabled = true;
        button.classList.add('loading');
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    startsAt,
                    name: details.name,
                    email: details.email,
                    phone: details.phone,
                    callType: details.callType,
                    goal: String(details.data.get('goal') || '').trim(),
                    company: String(details.data.get('company') || '').trim(),
                    visitorTimeZone: localTimeZone,
                    bookingMode,
                }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.ok) {
                if (result.error === 'slot_no_longer_available') {
                    showError('That time is no longer free. Try another time and we will check it again.', targetError);
                    await loadAvailability();
                    return;
                }
                throw new Error(result.error || 'booking_failed');
            }
            show(flow, false);
            show(success, true);
            byId('booking-success-time').textContent = `${dateTimeLabel(result.booking.startsAt)} (${friendlyTimeZone()})`;
            const bookingCallType = result.booking?.callType || details.callType;
            const meetingUrl = result.booking?.meetingUrl || '';
            byId('booking-success-copy').textContent = bookingCallType === 'video'
                ? (meetingUrl
                    ? 'Your video call is confirmed. Your Google Meet link is in the Balance email and calendar invitation.'
                    : 'Your video call is confirmed. Shannon will send the video link shortly.')
                : bookingCallType === 'whatsapp'
                    ? 'Your WhatsApp call is confirmed. Shannon will call the number you entered.'
                    : 'Your phone call is confirmed. Shannon will call the number you entered.';
        } catch (_) {
            showError('Could not confirm that call just now. Please try again in a moment.', targetError);
        } finally {
            button.disabled = false;
            button.classList.remove('loading');
        }
    }

    function submitRegularBooking(event) {
        event.preventDefault();
        if (!state.selectedSlot) return showError('Choose a call time first.');
        submitBooking(form, state.selectedSlot.start, 'standard', error);
    }

    function submitOutsideBooking(event) {
        event.preventDefault();
        const data = new FormData(outsideForm);
        const date = String(data.get('outsideDate') || '');
        const time = String(data.get('outsideTime') || '');
        const localDateTime = new Date(`${date}T${time}:00`);
        if (!date || !time || Number.isNaN(localDateTime.getTime())) {
            return showError('Choose the date and start time that works for you.', outsideError);
        }
        submitBooking(outsideForm, localDateTime.toISOString(), 'outside_hours', outsideError);
    }

    dateList?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-date-index]');
        if (!button) return;
        state.selectedDateIndex = Number(button.dataset.dateIndex || 0);
        renderDates();
        renderSlots();
    });

    slots?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-slot-index]');
        if (button) selectSlot(Number(button.dataset.slotIndex || 0));
    });

    outsideToggle?.addEventListener('click', () => setOutsidePanel(Boolean(outsidePanel?.hidden)));
    form?.addEventListener('submit', submitRegularBooking);
    outsideForm?.addEventListener('submit', submitOutsideBooking);
    form?.querySelector('[name="callType"]')?.addEventListener('change', () => updateCallTypeFields(form, 'booking-phone-label', 'booking-call-type-note'));
    outsideForm?.querySelector('[name="callType"]')?.addEventListener('change', () => updateCallTypeFields(outsideForm, 'booking-outside-phone-label', 'booking-outside-call-type-note'));
    updateCallTypeFields(form, 'booking-phone-label', 'booking-call-type-note');
    updateCallTypeFields(outsideForm, 'booking-outside-phone-label', 'booking-outside-call-type-note');
    setOutsideDateMinimum();
    loadAvailability();
}());

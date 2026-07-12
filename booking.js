(function () {
    'use strict';

    const endpoint = '/api/booking';
    const state = { dates: [], selectedDateIndex: 0, selectedSlot: null, settings: null };

    const byId = (id) => document.getElementById(id);
    const loading = byId('booking-loading');
    const unavailable = byId('booking-unavailable');
    const flow = byId('booking-flow');
    const dateList = byId('booking-date-list');
    const slots = byId('booking-slots');
    const form = byId('booking-form');
    const selectedSlot = byId('booking-selected-slot');
    const error = byId('booking-error');
    const success = byId('booking-success');
    const duration = byId('booking-duration');

    function show(el, visible) {
        if (el) el.hidden = !visible;
    }

    function selectedDate() {
        return state.dates[state.selectedDateIndex] || null;
    }

    function clearError() {
        if (!error) return;
        error.hidden = true;
        error.textContent = '';
    }

    function showError(message) {
        if (!error) return;
        error.hidden = false;
        error.textContent = message;
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
        selectedSlot.textContent = `${date.label}, ${slot.label} Brisbane time`;
        show(form, true);
        clearError();
        form.querySelector('input[name="name"]')?.focus();
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
    }

    async function loadAvailability() {
        try {
            const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
            const data = await response.json();
            state.settings = data;
            state.dates = Array.isArray(data.dates) ? data.dates : [];
            show(loading, false);
            duration.textContent = data.durationMinutes ? `${data.durationMinutes} min call` : 'Call times';
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

    async function submitBooking(event) {
        event.preventDefault();
        clearError();
        if (!state.selectedSlot) return showError('Choose a call time first.');
        const data = new FormData(form);
        const name = String(data.get('name') || '').trim();
        const email = String(data.get('email') || '').trim();
        if (!name || !email) return showError('Add your name and email to confirm this call.');

        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        button.classList.add('loading');
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    startsAt: state.selectedSlot.start,
                    name,
                    email,
                    phone: String(data.get('phone') || '').trim(),
                    goal: String(data.get('goal') || '').trim(),
                    company: String(data.get('company') || '').trim(),
                }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.ok) {
                if (result.error === 'slot_no_longer_available') {
                    showError('That time was just taken. I’ve refreshed the available spots for you.');
                    await loadAvailability();
                    return;
                }
                throw new Error(result.error || 'booking_failed');
            }
            show(flow, false);
            show(success, true);
            byId('booking-success-time').textContent = `${result.booking.label}, Brisbane time`;
            byId('booking-success-copy').textContent = result.confirmationEmailSent
                ? 'Your call is confirmed. A Balance email and calendar invitation are on their way.'
                : 'Your call is confirmed. Shannon will be in touch with the details.';
        } catch (_) {
            showError('Couldn’t confirm that call just now. Please try again in a moment.');
        } finally {
            button.disabled = false;
            button.classList.remove('loading');
        }
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

    form?.addEventListener('submit', submitBooking);
    loadAvailability();
}());

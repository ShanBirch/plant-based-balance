(function () {
    'use strict';

    const endpoint = '/api/booking';
    const bookingWindowDays = 5;
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
    const urlParams = new URLSearchParams(window.location.search);
    const bookingSource = urlParams.get('source') || '';
    const requestedPtSessions = ['1', '3', '5'].includes(urlParams.get('pt_sessions'))
        ? urlParams.get('pt_sessions')
        : '1';
    const isZoomPtEnquiry = bookingSource === 'zoom_pt';
    const isFirstCoachingCall = urlParams.get('first_call') === '1'
        && bookingSource === 'coaching_calls_purchase';

    if (isZoomPtEnquiry) {
        document.title = 'Check 1:1 Zoom PT Availability | Balance';
        byId('booking-intro-kicker').textContent = `${requestedPtSessions} live session${requestedPtSessions === '1' ? '' : 's'} each week`;
        byId('booking-intro-title').innerHTML = 'Check your Zoom PT<br><span>availability.</span>';
        byId('booking-intro-copy').textContent = 'Choose a short fit call so we can check your goals, injury history and recurring session times before you pay anything.';
        byId('booking-card-title').textContent = 'Choose your fit call.';
    }

    if (isFirstCoachingCall) {
        document.title = 'Book Your First Coaching Call | Balance';
        byId('booking-intro-kicker').textContent = 'Coaching + Calls';
        byId('booking-intro-title').innerHTML = 'Book your first call<br><span>with Shannon.</span>';
        byId('booking-intro-copy').textContent = 'Choose a time for your first coaching call. We will use it to get clear on your goal, your plan, and the support you need.';
        byId('booking-card-title').textContent = 'Choose your first call.';
        const successPrimary = byId('booking-success-primary');
        successPrimary.textContent = 'Create my Balance account';
        successPrimary.href = 'login.html?action=signup&source=coaching_calls_booking';
        successPrimary.classList.remove('secondary');
        successPrimary.classList.add('primary');
        show(byId('booking-success-existing'), true);
    }

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
        const phoneInput = targetForm?.querySelector('[name="phone"]');
        const phoneLabel = byId(phoneLabelId);
        const callTypeNote = byId(noteId);
        if (phoneInput) phoneInput.required = true;
        if (phoneLabel) {
            phoneLabel.innerHTML = 'Mobile number <em>for your text confirmation and reminder</em>';
        }
        if (callTypeNote) {
            callTypeNote.textContent = callType === 'video'
                ? 'You will get a Google Meet link in your calendar invitation, plus a text confirmation and reminder.'
                : callType === 'whatsapp'
                    ? 'Shannon will give you a WhatsApp call on this number. We will also text your confirmation and reminder.'
                    : 'Shannon will call you on this number. We will also text your confirmation and reminder.';
        }
    }

    function prepareZoomPtForm(targetForm) {
        if (!isZoomPtEnquiry || !targetForm) return;
        const callType = targetForm.querySelector('[name="callType"]');
        const goal = targetForm.querySelector('[name="goal"]');
        if (callType) callType.value = 'video';
        if (goal) {
            goal.placeholder = `I am interested in Zoom PT ${requestedPtSessions}. Add your main goal, current injuries or limitations, and the days or times that usually work.`;
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
        const formatDateInput = (value) => [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
        const now = new Date();
        const maxDate = new Date(now);
        maxDate.setDate(maxDate.getDate() + bookingWindowDays - 1);
        input.min = formatDateInput(now);
        input.max = formatDateInput(maxDate);
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
        if (phone.replace(/\D/g, '').length < 6) {
            showError('Add a mobile number for your text confirmation and reminder.', targetError);
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
                    source: isZoomPtEnquiry ? 'zoom_pt' : 'public_booking_page',
                    ptSessionsPerWeek: isZoomPtEnquiry ? Number(requestedPtSessions) : null,
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
            if (isFirstCoachingCall) byId('booking-success-title').textContent = 'First call booked.';
            if (isZoomPtEnquiry) {
                byId('booking-success-title').textContent = 'Zoom PT fit call booked.';
                byId('booking-success-copy').textContent = 'Your call is confirmed. We will check health fit, recurring times and the right starting structure before payment.';
            }
            byId('booking-success-time').textContent = `${dateTimeLabel(result.booking.startsAt)} (${friendlyTimeZone()})`;
            const bookingCallType = result.booking?.callType || details.callType;
            const meetingUrl = result.booking?.meetingUrl || '';
            const smsNote = result.smsConfirmationSent ? ' A text confirmation is on its way too.' : '';
            byId('booking-success-copy').textContent = bookingCallType === 'video'
                ? (meetingUrl
                    ? `Your video call is confirmed. Your Google Meet link is in the Balance email and calendar invitation.${smsNote}`
                    : `Your video call is confirmed. Shannon will send the video link shortly.${smsNote}`)
                : bookingCallType === 'whatsapp'
                    ? `Your WhatsApp call is confirmed. Shannon will call the number you entered.${smsNote}`
                    : `Your phone call is confirmed. Shannon will call the number you entered.${smsNote}`;
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
    prepareZoomPtForm(form);
    prepareZoomPtForm(outsideForm);
    setOutsideDateMinimum();
    loadAvailability();
}());

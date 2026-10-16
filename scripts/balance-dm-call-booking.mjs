import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const BOOKING_ENDPOINT = 'https://plantbased-balance.org/api/booking';
const MAX_OFFER_AGE_MS = 5 * 60 * 1000;
const MIN_NOTICE_MS = 2 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validTimezone(timezone) {
    if (!timezone || typeof timezone !== 'string') throw new Error('A verified timezone is required');
    new Intl.DateTimeFormat('en-AU', { timeZone: timezone }).format();
    return timezone;
}

function readyAvailability(data) {
    return data?.ok === true && data.bookingEnabled === true && data.calendarConnected === true
        && data.calendarReconnectRequired === false && data.calendarConnectionIssue === false;
}

function slotLabel(start, timezone) {
    return new Intl.DateTimeFormat('en-AU', {
        timeZone: timezone, weekday: 'long', day: 'numeric', month: 'long',
        hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(new Date(start));
}

function brisbaneDate(value) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane',
        year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}

function allowedSlot(slot, now) {
    const start = Date.parse(slot.start);
    const end = Date.parse(slot.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < now + MIN_NOTICE_MS || end <= start) return false;
    const finish = new Intl.DateTimeFormat('en-GB', { timeZone: 'Australia/Brisbane',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(end));
    return brisbaneDate(start) === brisbaneDate(end) && finish <= '19:00';
}

export async function getSlotOffer({ timezone, fetchImpl = fetch, now = Date.now() }) {
    validTimezone(timezone);
    const response = await fetchImpl(`${BOOKING_ENDPOINT}?source=plant_based_challenge`, {
        headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error('Availability could not be verified');
    const data = await response.json();
    if (!readyAvailability(data)) throw new Error('Booking or calendar is unavailable; do not offer specific times');
    const slots = (Array.isArray(data.dates) ? data.dates : []).flatMap(day => Array.isArray(day.slots) ? day.slots : [])
        .filter(slot => allowedSlot(slot, now))
        .sort((first, second) => Date.parse(first.start) - Date.parse(second.start));
    const unique = slots.filter((slot, index) => slots.findIndex(other => other.start === slot.start) === index);
    const distinctDays = unique.filter((slot, index) => unique.findIndex(other =>
        brisbaneDate(other.start) === brisbaneDate(slot.start)) === index).slice(0, 3);
    const options = distinctDays.map(slot => ({
        start: slot.start, end: slot.end, label: slotLabel(slot.start, timezone), timezone,
    }));
    return { checkedAt: new Date(now).toISOString(), timezone, durationMinutes: data.durationMinutes, options };
}

function validateBooking(input, now) {
    for (const key of ['actionId', 'threadId', 'sourceMessageId']) {
        if (!UUID_RE.test(input?.[key] || '')) throw new Error(`Verified ${key} is required`);
    }
    if (input.selectionConfirmed !== true || input.contactConfirmed !== true || input.ownershipVerified !== true) {
        throw new Error('Explicit slot/contact consent and live action ownership are required');
    }
    validTimezone(input.timezone);
    if (!['phone', 'video'].includes(input.callType)) throw new Error('Confirm phone or video before booking');
    if (typeof input.name !== 'string' || !input.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email || '')) {
        throw new Error('Confirmed name and email are required');
    }
    if (!/^\+?[\d ()-]{8,30}$/.test(input.phone || '')) throw new Error('Confirmed mobile number is required');
    const age = now - Date.parse(input.offer?.checkedAt);
    if (!Number.isFinite(age) || age < 0 || age > MAX_OFFER_AGE_MS || input.offer?.timezone !== input.timezone) {
        throw new Error('Refresh the slot offer before booking');
    }
    if (!input.offer?.options?.some(slot => slot.start === input.startsAt && slot.timezone === input.timezone)) {
        throw new Error('The selected time was not in the verified offer');
    }
}

export async function bookSelectedSlot(input, { receiptsDir, fetchImpl = fetch, now = Date.now() } = {}) {
    if (!receiptsDir || !path.isAbsolute(receiptsDir)) throw new Error('An absolute private receipts directory is required');
    for (const key of ['actionId', 'threadId', 'sourceMessageId']) {
        if (!UUID_RE.test(input?.[key] || '')) throw new Error(`Verified ${key} is required`);
    }
    const binding = createHash('sha256').update(JSON.stringify([
        input.actionId, input.threadId, input.sourceMessageId, input.startsAt, input.email, input.phone,
    ])).digest('hex');
    await fs.mkdir(receiptsDir, { recursive: true, mode: 0o700 });
    const receiptPath = path.join(receiptsDir, `${input.actionId}.json`);
    try {
        const previous = JSON.parse(await fs.readFile(receiptPath, 'utf8'));
        if (previous.binding !== binding) throw new Error('Action already bound to a different booking; do not retry');
        return { ...previous, reusedReceipt: true };
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
    validateBooking(input, now);
    const availabilityResponse = await fetchImpl(`${BOOKING_ENDPOINT}?source=plant_based_challenge`, {
        headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000),
    });
    if (!availabilityResponse.ok) throw new Error('Current availability check failed; nothing booked');
    const live = await availabilityResponse.json();
    if (!readyAvailability(live) || !live.dates?.some(day => day.slots?.some(slot =>
        slot.start === input.startsAt && allowedSlot(slot, now)))) {
        throw new Error('Selected slot is no longer available; offer fresh alternatives');
    }
    const receipt = {
        actionId: input.actionId, threadId: input.threadId, sourceMessageId: input.sourceMessageId,
        binding, status: 'pending_no_repeat', startedAt: new Date(now).toISOString(),
        startsAt: input.startsAt, timezone: input.timezone,
    };
    try {
        await fs.writeFile(receiptPath, JSON.stringify(receipt, null, 2), { flag: 'wx', mode: 0o600 });
    } catch (error) {
        if (error.code === 'EEXIST') throw new Error('Booking action already claimed; reconcile its receipt, do not retry');
        throw error;
    }
    try {
        const response = await fetchImpl(BOOKING_ENDPOINT, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(45000),
            body: JSON.stringify({
                source: 'plant_based_challenge', name: input.name.trim(), email: input.email.trim(),
                phone: input.phone, goal: String(input.goal || '').slice(0, 1000),
                startsAt: input.startsAt, visitorTimeZone: input.timezone, callType: input.callType,
                attribution: input.attribution || {},
            }),
        });
        const result = await response.json();
        const verified = response.status === 201 && result.ok === true && result.booking?.id
            && result.booking.startsAt === input.startsAt && result.booking.timezone === input.timezone
            && result.booking.callType === input.callType;
        if (verified) {
            Object.assign(receipt, {
                status: result.calendarEventCreated === true ? 'confirmed' : 'booking_recorded_calendar_pending',
                booking: result.booking, confirmationEmailSent: result.confirmationEmailSent === true,
                calendarEventCreated: result.calendarEventCreated === true,
                notices: Array.isArray(result.notices) ? result.notices : [],
            });
        } else if (response.status === 400 || response.status === 409) {
            Object.assign(receipt, { status: 'rejected', error: String(result.error || 'booking_rejected') });
        } else {
            Object.assign(receipt, { status: 'uncertain_no_repeat', error: 'Booking response requires reconciliation' });
        }
    } catch {
        Object.assign(receipt, { status: 'uncertain_no_repeat', error: 'Delivery outcome unknown; reconcile before any new attempt' });
    }
    receipt.finishedAt = new Date().toISOString();
    await fs.writeFile(receiptPath, JSON.stringify(receipt, null, 2), { mode: 0o600 });
    return receipt;
}

async function main() {
    const [command, ...values] = process.argv.slice(2);
    const args = {};
    for (let index = 0; index < values.length; index += 2) {
        if (!values[index].startsWith('--') || !values[index + 1]) throw new Error('Each option requires a value');
        args[values[index].slice(2)] = values[index + 1];
    }
    let result;
    if (command === 'availability') {
        result = await getSlotOffer({ timezone: args.timezone });
        if (args.output) await fs.writeFile(path.resolve(args.output), JSON.stringify(result, null, 2), { mode: 0o600 });
    } else if (command === 'book') {
        if (!args.input) throw new Error('A private booking-input file is required');
        result = await bookSelectedSlot(JSON.parse(await fs.readFile(args.input, 'utf8')), { receiptsDir: args['receipts-dir'] });
    } else {
        throw new Error('Use availability --timezone <verified timezone> or book --input <private file> --receipts-dir <private directory>');
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}

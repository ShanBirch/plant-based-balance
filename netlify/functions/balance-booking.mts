import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

type TimeRange = { start: string; end: string };
type WeeklyHours = Record<string, TimeRange[]>;

type BookingSettings = {
    booking_enabled: boolean;
    event_name: string;
    duration_minutes: number;
    minimum_notice_hours: number;
    booking_window_days: number;
    timezone: string;
    calendar_id: string;
    location: string;
    weekly_hours: WeeklyHours;
};

type BusyRange = { start: string; end: string };

const BRISBANE_TIMEZONE = "Australia/Brisbane";
const ADMIN_EMAIL = "shannonbirch@cocospersonaltraining.com";
const GOOGLE_REFRESH_TOKEN_KEY = "balance_booking_google_refresh_token";
const GOOGLE_OAUTH_STATE_KEY = "balance_booking_google_oauth_state";
const DEFAULT_PUBLIC_ORIGIN = "https://plantbased-balance.org";
const DEFAULT_BOOKING_URL = `${DEFAULT_PUBLIC_ORIGIN}/book`;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function getEnv(name: string): string {
    const netlifyValue = globalThis.Netlify?.env?.get?.(name);
    const processValue = globalThis.process?.env?.[name];
    return String(netlifyValue || processValue || "").trim();
}

function publicOrigin(): string {
    return (getEnv("BALANCE_BOOKING_PUBLIC_ORIGIN") || DEFAULT_PUBLIC_ORIGIN).replace(/\/+$/, "");
}

function bookingUrl(): string {
    return getEnv("BALANCE_BOOKING_URL") || `${publicOrigin()}/book` || DEFAULT_BOOKING_URL;
}

function json(status: number, body: Record<string, unknown>, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            ...headers,
        },
    });
}

function redirect(location: string): Response {
    return new Response(null, {
        status: 302,
        headers: { Location: location, "Cache-Control": "no-store" },
    });
}

function trimText(value: unknown, max = 500): string {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function safeHtml(value: unknown): string {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function isIsoDate(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

function dateAtBrisbaneTime(date: string, time: string): Date {
    // Queensland does not observe daylight saving. Keeping appointment hours in
    // Brisbane time prevents an overseas visitor's browser timezone changing a slot.
    return new Date(`${date}T${time}:00+10:00`);
}

function dateKeyForOffset(fromDate: string, offset: number): string {
    const date = new Date(`${fromDate}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
}

function brisbaneDateKey(value = new Date()): string {
    const parts = new Intl.DateTimeFormat("en-AU", {
        timeZone: BRISBANE_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(value);
    const get = (type: string) => parts.find(part => part.type === type)?.value || "";
    return `${get("year")}-${get("month")}-${get("day")}`;
}

function weekdayForDate(date: string): string {
    return String(new Date(`${date}T12:00:00Z`).getUTCDay());
}

function dateTimeLabel(value: string): string {
    return new Intl.DateTimeFormat("en-AU", {
        timeZone: BRISBANE_TIMEZONE,
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    }).format(new Date(value));
}

function dateLabel(value: string): string {
    return new Intl.DateTimeFormat("en-AU", {
        timeZone: BRISBANE_TIMEZONE,
        weekday: "short",
        day: "numeric",
        month: "short",
    }).format(new Date(`${value}T12:00:00+10:00`));
}

function timeLabel(value: string): string {
    return new Intl.DateTimeFormat("en-AU", {
        timeZone: BRISBANE_TIMEZONE,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    }).format(new Date(value));
}

function defaultSettings(): BookingSettings {
    return {
        booking_enabled: false,
        event_name: "Balance call",
        duration_minutes: 30,
        minimum_notice_hours: 24,
        booking_window_days: 28,
        timezone: BRISBANE_TIMEZONE,
        calendar_id: "primary",
        location: "Online, link sent after booking",
        weekly_hours: {
            "1": [{ start: "10:00", end: "15:00" }],
            "2": [{ start: "10:00", end: "15:00" }],
            "3": [{ start: "10:00", end: "15:00" }],
            "4": [{ start: "10:00", end: "15:00" }],
            "5": [],
            "6": [],
            "0": [],
        },
    };
}

function normalizeWeeklyHours(value: unknown): WeeklyHours {
    const source = value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
    const normalized: WeeklyHours = {};

    for (let day = 0; day <= 6; day += 1) {
        const rawRanges = Array.isArray(source[String(day)]) ? source[String(day)] : [];
        const ranges: TimeRange[] = [];
        for (const rawRange of rawRanges.slice(0, 2)) {
            const range = rawRange && typeof rawRange === "object" ? rawRange as Record<string, unknown> : {};
            const start = trimText(range.start, 5);
            const end = trimText(range.end, 5);
            if (!TIME_RE.test(start) || !TIME_RE.test(end) || start >= end) continue;
            ranges.push({ start, end });
        }
        normalized[String(day)] = ranges.sort((a, b) => a.start.localeCompare(b.start));
    }
    return normalized;
}

function normalizeSettings(value: unknown): BookingSettings {
    const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const fallback = defaultSettings();
    const numberInRange = (input: unknown, fallbackValue: number, min: number, max: number) => {
        const parsed = Number(input);
        return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallbackValue;
    };

    return {
        booking_enabled: raw.booking_enabled === true,
        event_name: trimText(raw.event_name, 80) || fallback.event_name,
        duration_minutes: numberInRange(raw.duration_minutes, fallback.duration_minutes, 15, 90),
        minimum_notice_hours: numberInRange(raw.minimum_notice_hours, fallback.minimum_notice_hours, 1, 168),
        booking_window_days: numberInRange(raw.booking_window_days, fallback.booking_window_days, 7, 90),
        timezone: BRISBANE_TIMEZONE,
        calendar_id: trimText(raw.calendar_id, 180) || "primary",
        location: trimText(raw.location, 200) || fallback.location,
        weekly_hours: normalizeWeeklyHours(raw.weekly_hours || fallback.weekly_hours),
    };
}

function serviceConfig(): { url: string; key: string } {
    const url = (getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL")).replace(/\/+$/, "");
    const key = getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SUPABASE_SERVICE_KEY");
    if (!url || !key) throw new Error("Supabase service credentials are not configured");
    return { url, key };
}

async function supabaseRequest(path: string, init: RequestInit = {}): Promise<unknown> {
    const { url, key } = serviceConfig();
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    headers.set("Authorization", `Bearer ${key}`);
    if (init.body) headers.set("Content-Type", "application/json");
    if (!headers.has("Prefer")) headers.set("Prefer", "return=representation");

    const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers });
    const text = await response.text();
    if (!response.ok) {
        const error = new Error(`Supabase ${response.status}: ${text.slice(0, 500)}`) as Error & { status?: number };
        error.status = response.status;
        throw error;
    }
    if (!text.trim()) return [];
    try { return JSON.parse(text); } catch { return []; }
}

async function getSettings(): Promise<BookingSettings> {
    const rows = await supabaseRequest("balance_booking_settings?select=*&id=eq.true&limit=1") as Record<string, unknown>[];
    return normalizeSettings(rows[0]);
}

async function saveSettings(value: unknown): Promise<BookingSettings> {
    const settings = normalizeSettings(value);
    const rows = await supabaseRequest("balance_booking_settings?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify([{ id: true, ...settings }]),
    }) as Record<string, unknown>[];
    return normalizeSettings(rows[0] || settings);
}

async function getPrivateSecret(key: string): Promise<string> {
    const rows = await supabaseRequest(`app_private_secrets?select=value&key=eq.${encodeURIComponent(key)}&limit=1`) as Array<{ value?: unknown }>;
    return trimText(rows[0]?.value, 8000);
}

async function setPrivateSecret(key: string, value: string): Promise<void> {
    await supabaseRequest("app_private_secrets?on_conflict=key", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify([{ key, value }]),
    });
}

async function deletePrivateSecret(key: string): Promise<void> {
    await supabaseRequest(`app_private_secrets?key=eq.${encodeURIComponent(key)}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
    });
}

async function requireAdmin(req: Request): Promise<{ ok: true } | { ok: false; response: Response }> {
    const token = String(req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1] || "";
    if (!token) return { ok: false, response: json(401, { ok: false, error: "sign_in_required" }) };

    const { url, key } = serviceConfig();
    const response = await fetch(`${url}/auth/v1/user`, {
        headers: { apikey: key, Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return { ok: false, response: json(401, { ok: false, error: "sign_in_required" }) };

    const user = await response.json() as { email?: unknown };
    if (trimText(user.email, 320).toLowerCase() !== ADMIN_EMAIL) {
        return { ok: false, response: json(403, { ok: false, error: "forbidden" }) };
    }
    return { ok: true };
}

async function getGoogleAccessToken(): Promise<string> {
    const refreshToken = await getPrivateSecret(GOOGLE_REFRESH_TOKEN_KEY);
    const clientId = getEnv("GOOGLE_CALENDAR_CLIENT_ID");
    const clientSecret = getEnv("GOOGLE_CALENDAR_CLIENT_SECRET");
    if (!refreshToken || !clientId || !clientSecret) return "";

    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
        }),
    });
    const data = await response.json().catch(() => ({})) as { access_token?: unknown };
    if (!response.ok || !data.access_token) throw new Error("Google Calendar connection needs to be reconnected");
    return String(data.access_token);
}

async function googleBusyRanges(settings: BookingSettings, timeMin: string, timeMax: string): Promise<{ connected: boolean; busy: BusyRange[] }> {
    const refreshToken = await getPrivateSecret(GOOGLE_REFRESH_TOKEN_KEY);
    if (!refreshToken) return { connected: false, busy: [] };
    const accessToken = await getGoogleAccessToken();
    if (!accessToken) return { connected: false, busy: [] };

    const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ timeMin, timeMax, items: [{ id: settings.calendar_id || "primary" }] }),
    });
    const data = await response.json().catch(() => ({})) as { calendars?: Record<string, { busy?: BusyRange[]; errors?: unknown[] }> };
    const calendar = data.calendars?.[settings.calendar_id || "primary"];
    if (!response.ok || calendar?.errors?.length) throw new Error("Google Calendar availability could not be read");
    return { connected: true, busy: Array.isArray(calendar?.busy) ? calendar.busy : [] };
}

function overlaps(slotStart: Date, slotEnd: Date, busy: BusyRange): boolean {
    const busyStart = Date.parse(busy.start);
    const busyEnd = Date.parse(busy.end);
    return Number.isFinite(busyStart) && Number.isFinite(busyEnd)
        && slotStart.getTime() < busyEnd && slotEnd.getTime() > busyStart;
}

async function databaseBusyRanges(timeMin: string, timeMax: string): Promise<BusyRange[]> {
    const rows = await supabaseRequest(
        `balance_bookings?select=starts_at,ends_at&status=eq.confirmed&starts_at=lt.${encodeURIComponent(timeMax)}&ends_at=gt.${encodeURIComponent(timeMin)}`
    ) as Array<{ starts_at?: unknown; ends_at?: unknown }>;
    return rows
        .map(row => ({ start: trimText(row.starts_at, 50), end: trimText(row.ends_at, 50) }))
        .filter(row => row.start && row.end);
}

export function buildSlotsForDate(settingsInput: BookingSettings, date: string, busyRanges: BusyRange[], now = new Date()): Array<{ start: string; end: string; label: string }> {
    const settings = normalizeSettings(settingsInput);
    const ranges = settings.weekly_hours[weekdayForDate(date)] || [];
    const noticeCutoff = now.getTime() + settings.minimum_notice_hours * 60 * 60 * 1000;
    const slots: Array<{ start: string; end: string; label: string }> = [];

    for (const range of ranges) {
        const rangeStart = dateAtBrisbaneTime(date, range.start);
        const rangeEnd = dateAtBrisbaneTime(date, range.end);
        for (let current = rangeStart.getTime(); current + settings.duration_minutes * 60 * 1000 <= rangeEnd.getTime(); current += settings.duration_minutes * 60 * 1000) {
            const start = new Date(current);
            const end = new Date(current + settings.duration_minutes * 60 * 1000);
            if (start.getTime() < noticeCutoff) continue;
            if (busyRanges.some(range => overlaps(start, end, range))) continue;
            slots.push({ start: start.toISOString(), end: end.toISOString(), label: timeLabel(start.toISOString()) });
        }
    }
    return slots;
}

async function getAvailability(fromDate: string, settings: BookingSettings): Promise<{ dates: Array<{ date: string; label: string; slots: Array<{ start: string; end: string; label: string }> }>; calendarConnected: boolean }> {
    const days = settings.booking_window_days;
    const firstDate = isIsoDate(fromDate) ? fromDate : brisbaneDateKey();
    const lastDate = dateKeyForOffset(firstDate, days - 1);
    const timeMin = dateAtBrisbaneTime(firstDate, "00:00").toISOString();
    const timeMax = dateAtBrisbaneTime(dateKeyForOffset(lastDate, 1), "00:00").toISOString();
    const databaseBusy = await databaseBusyRanges(timeMin, timeMax);
    const google = await googleBusyRanges(settings, timeMin, timeMax);
    const busy = [...databaseBusy, ...google.busy];
    const dates = [];

    for (let offset = 0; offset < days; offset += 1) {
        const date = dateKeyForOffset(firstDate, offset);
        const slots = buildSlotsForDate(settings, date, busy);
        if (slots.length) dates.push({ date, label: dateLabel(date), slots });
    }
    return { dates, calendarConnected: google.connected };
}

function hmac(input: string): string {
    return createHmac("sha256", getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SUPABASE_SERVICE_KEY"))
        .update(input)
        .digest("base64url");
}

function makeOAuthState(): string {
    const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 10 * 60 * 1000, nonce: randomBytes(18).toString("base64url") })).toString("base64url");
    return `${payload}.${hmac(payload)}`;
}

function isValidOAuthState(state: string): boolean {
    const [payload, signature] = String(state || "").split(".");
    if (!payload || !signature) return false;
    const expected = hmac(payload);
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(signature);
    if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) return false;
    try {
        const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: unknown; nonce?: unknown };
        return Number(parsed.exp) > Date.now() && Boolean(parsed.nonce);
    } catch {
        return false;
    }
}

async function startGoogleConnect(req: Request): Promise<Response> {
    const admin = await requireAdmin(req);
    if (!admin.ok) return admin.response;
    const clientId = getEnv("GOOGLE_CALENDAR_CLIENT_ID");
    const clientSecret = getEnv("GOOGLE_CALENDAR_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
        return json(409, { ok: false, error: "google_oauth_not_configured", message: "Add the Google Calendar OAuth client ID and secret in Netlify first." });
    }
    const state = makeOAuthState();
    await setPrivateSecret(GOOGLE_OAUTH_STATE_KEY, state);
    const callback = `${publicOrigin()}/api/booking/google/callback`;
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: callback,
        response_type: "code",
        access_type: "offline",
        prompt: "consent",
        scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy",
        state,
    });
    return json(200, { ok: true, authorizeUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
}

async function completeGoogleConnect(url: URL): Promise<Response> {
    const error = trimText(url.searchParams.get("error"), 120);
    const code = trimText(url.searchParams.get("code"), 5000);
    const state = trimText(url.searchParams.get("state"), 6000);
    const expectedState = await getPrivateSecret(GOOGLE_OAUTH_STATE_KEY);

    if (error || !code || !state || state !== expectedState || !isValidOAuthState(state)) {
        return redirect(`${publicOrigin()}/booking-settings.html?calendar=failed`);
    }
    await deletePrivateSecret(GOOGLE_OAUTH_STATE_KEY);

    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code,
            client_id: getEnv("GOOGLE_CALENDAR_CLIENT_ID"),
            client_secret: getEnv("GOOGLE_CALENDAR_CLIENT_SECRET"),
            redirect_uri: `${publicOrigin()}/api/booking/google/callback`,
            grant_type: "authorization_code",
        }),
    });
    const data = await response.json().catch(() => ({})) as { refresh_token?: unknown };
    if (!response.ok || !data.refresh_token) return redirect(`${publicOrigin()}/booking-settings.html?calendar=failed`);

    await setPrivateSecret(GOOGLE_REFRESH_TOKEN_KEY, String(data.refresh_token));
    return redirect(`${publicOrigin()}/booking-settings.html?calendar=connected`);
}

async function createCalendarEvent(settings: BookingSettings, booking: Record<string, unknown>): Promise<string> {
    const accessToken = await getGoogleAccessToken();
    if (!accessToken) return "";
    const name = trimText(booking.name, 120);
    const email = trimText(booking.email, 320);
    const goal = trimText(booking.goal, 1000);
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(settings.calendar_id || "primary")}/events?sendUpdates=all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            summary: `${settings.event_name} with ${name}`,
            description: [
                `Booked through Balance`,
                goal ? `What they want to cover: ${goal}` : "",
                `Booking: ${bookingUrl()}`,
            ].filter(Boolean).join("\n\n"),
            location: settings.location,
            start: { dateTime: booking.starts_at, timeZone: BRISBANE_TIMEZONE },
            end: { dateTime: booking.ends_at, timeZone: BRISBANE_TIMEZONE },
            attendees: email ? [{ email, displayName: name }] : [],
            reminders: { useDefault: true },
        }),
    });
    const data = await response.json().catch(() => ({})) as { id?: unknown };
    if (!response.ok) throw new Error("Google Calendar event could not be created");
    return trimText(data.id, 300);
}

async function sendConfirmationEmail(settings: BookingSettings, booking: Record<string, unknown>): Promise<boolean> {
    const apiKey = getEnv("RESEND_API_KEY");
    const from = getEnv("BOOKING_EMAIL_FROM");
    if (!apiKey || !from) return false;

    const name = trimText(booking.name, 120);
    const email = trimText(booking.email, 320);
    const startsAt = trimText(booking.starts_at, 80);
    const prettyDate = dateTimeLabel(startsAt);
    const goal = trimText(booking.goal, 1000);
    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            from,
            to: [email],
            subject: `You’re booked in with Balance, ${prettyDate}`,
            html: `<!doctype html><html><body style="margin:0;background:#f6f3ec;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#171717"><table role="presentation" style="width:100%;max-width:620px;margin:0 auto;background:#111111;border-radius:24px;overflow:hidden"><tr><td style="padding:34px 32px 18px;text-align:center"><img src="${publicOrigin()}/balance_logo_transparent.png" width="64" height="64" alt="Balance" style="display:inline-block;border-radius:16px"><p style="margin:18px 0 0;color:#f5d98a;font-size:12px;font-weight:800;letter-spacing:1.7px;text-transform:uppercase">Call confirmed</p><h1 style="margin:10px 0 0;color:#fff;font-size:30px;line-height:1.1">You’re in, ${safeHtml(name)}.</h1></td></tr><tr><td style="padding:16px 32px 34px"><div style="background:#f5d98a;border-radius:18px;padding:22px;color:#151515"><p style="margin:0 0 7px;font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase">Your Balance call</p><p style="margin:0;font-size:21px;font-weight:800;line-height:1.3">${safeHtml(prettyDate)}<br><span style="font-size:15px;font-weight:600">Brisbane time</span></p></div><p style="margin:24px 0 0;color:#ded8cc;font-size:16px;line-height:1.65">I’m looking forward to hearing where you’re at and what would make things feel easier from here.</p>${goal ? `<p style="margin:18px 0 0;padding:16px;border:1px solid #36332e;border-radius:14px;color:#ded8cc;font-size:14px;line-height:1.55"><strong style="display:block;margin-bottom:5px;color:#f5d98a">You want to cover</strong>${safeHtml(goal)}</p>` : ""}<p style="margin:24px 0 0;color:#aaa396;font-size:13px;line-height:1.55">A calendar invitation is on its way too. If anything changes, reply to this email and we’ll sort it.</p><p style="margin:24px 0 0;color:#f5d98a;font-size:15px;font-weight:800">Shannon<br><span style="color:#aaa396;font-size:13px;font-weight:500">Balance</span></p></td></tr></table></body></html>`,
            text: `You’re booked in with Balance, ${name}.\n\nYour call: ${prettyDate} (Brisbane time).\n\n${goal ? `You want to cover: ${goal}\n\n` : ""}A calendar invitation is on its way too. If anything changes, reply to this email and we’ll sort it.\n\nShannon, Balance`,
        }),
    });
    return response.ok;
}

async function createBooking(req: Request): Promise<Response> {
    let body: Record<string, unknown>;
    try { body = await req.json() as Record<string, unknown>; }
    catch { return json(400, { ok: false, error: "invalid_json" }); }

    if (trimText(body.company || body.website, 200)) return json(400, { ok: false, error: "invalid_request" });
    const settings = await getSettings();
    if (!settings.booking_enabled) return json(409, { ok: false, error: "booking_not_open" });

    const name = trimText(body.name, 120);
    const email = trimText(body.email, 320).toLowerCase();
    const phone = trimText(body.phone, 40);
    const goal = trimText(body.goal, 1000);
    const startsAt = trimText(body.startsAt, 80);
    if (!name || !EMAIL_RE.test(email) || !startsAt || Number.isNaN(Date.parse(startsAt))) {
        return json(400, { ok: false, error: "check_your_details" });
    }

    const start = new Date(startsAt);
    const localDate = brisbaneDateKey(start);
    const availability = await getAvailability(localDate, settings);
    const selectedSlot = availability.dates.flatMap(date => date.slots).find(slot => slot.start === start.toISOString());
    if (!selectedSlot) return json(409, { ok: false, error: "slot_no_longer_available" });

    let inserted: Record<string, unknown>;
    try {
        const rows = await supabaseRequest("balance_bookings", {
            method: "POST",
            body: JSON.stringify([{
                starts_at: selectedSlot.start,
                ends_at: selectedSlot.end,
                name,
                email,
                phone: phone || null,
                goal: goal || null,
                timezone: BRISBANE_TIMEZONE,
                metadata: { source: "public_booking_page", user_agent: trimText(req.headers.get("user-agent"), 300) || null },
            }]),
        }) as Record<string, unknown>[];
        inserted = rows[0] || {};
    } catch (error) {
        if ((error as { status?: number }).status === 409) return json(409, { ok: false, error: "slot_no_longer_available" });
        throw error;
    }

    let calendarEventId = "";
    let emailSent = false;
    const outcome: string[] = [];
    try {
        calendarEventId = await createCalendarEvent(settings, inserted);
        if (calendarEventId) {
            await supabaseRequest(`balance_bookings?id=eq.${encodeURIComponent(String(inserted.id || ""))}`, {
                method: "PATCH",
                headers: { Prefer: "return=minimal" },
                body: JSON.stringify({ calendar_event_id: calendarEventId }),
            });
        }
    } catch (error) {
        console.error("[balance-booking] calendar event failed", error);
        outcome.push("calendar_invite_pending");
    }
    try {
        emailSent = await sendConfirmationEmail(settings, inserted);
        if (emailSent) {
            await supabaseRequest(`balance_bookings?id=eq.${encodeURIComponent(String(inserted.id || ""))}`, {
                method: "PATCH",
                headers: { Prefer: "return=minimal" },
                body: JSON.stringify({ confirmation_email_sent_at: new Date().toISOString() }),
            });
        }
    } catch (error) {
        console.error("[balance-booking] confirmation email failed", error);
        outcome.push("confirmation_email_pending");
    }

    return json(201, {
        ok: true,
        booking: { id: inserted.id || null, startsAt: selectedSlot.start, endsAt: selectedSlot.end, label: dateTimeLabel(selectedSlot.start), timezone: BRISBANE_TIMEZONE },
        calendarEventCreated: Boolean(calendarEventId),
        confirmationEmailSent: emailSent,
        notices: outcome,
    });
}

function publicSettings(settings: BookingSettings): Record<string, unknown> {
    return {
        bookingEnabled: settings.booking_enabled,
        eventName: settings.event_name,
        durationMinutes: settings.duration_minutes,
        timezone: BRISBANE_TIMEZONE,
        minimumNoticeHours: settings.minimum_notice_hours,
    };
}

async function handleSettings(req: Request): Promise<Response> {
    const admin = await requireAdmin(req);
    if (!admin.ok) return admin.response;
    if (req.method === "GET") {
        const [settings, refreshToken] = await Promise.all([getSettings(), getPrivateSecret(GOOGLE_REFRESH_TOKEN_KEY)]);
        return json(200, {
            ok: true,
            settings,
            bookingUrl: bookingUrl(),
            googleCalendarConnected: Boolean(refreshToken),
            googleOAuthConfigured: Boolean(getEnv("GOOGLE_CALENDAR_CLIENT_ID") && getEnv("GOOGLE_CALENDAR_CLIENT_SECRET")),
            confirmationEmailConfigured: Boolean(getEnv("RESEND_API_KEY") && getEnv("BOOKING_EMAIL_FROM")),
        });
    }
    if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });
    let body: Record<string, unknown>;
    try { body = await req.json() as Record<string, unknown>; }
    catch { return json(400, { ok: false, error: "invalid_json" }); }
    const settings = await saveSettings(body.settings || body);
    return json(200, { ok: true, settings });
}

export default async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    try {
        if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { Allow: "GET, POST, OPTIONS" } });
        if (path.endsWith("/google/connect")) return startGoogleConnect(req);
        if (path.endsWith("/google/callback")) return completeGoogleConnect(url);
        if (path.endsWith("/google/disconnect")) {
            const admin = await requireAdmin(req);
            if (!admin.ok) return admin.response;
            if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });
            await deletePrivateSecret(GOOGLE_REFRESH_TOKEN_KEY);
            return json(200, { ok: true });
        }
        if (url.searchParams.get("mode") === "settings") return handleSettings(req);
        if (req.method === "GET") {
            const settings = await getSettings();
            if (!settings.booking_enabled) return json(200, { ok: true, ...publicSettings(settings), dates: [], calendarConnected: false });
            const availability = await getAvailability(url.searchParams.get("from") || "", settings);
            return json(200, { ok: true, ...publicSettings(settings), ...availability });
        }
        if (req.method === "POST") return createBooking(req);
        return json(405, { ok: false, error: "method_not_allowed" });
    } catch (error) {
        console.error("[balance-booking] failed", error);
        return json(500, { ok: false, error: "booking_unavailable" });
    }
}

export const config = {
    path: ["/api/booking", "/api/booking/google/connect", "/api/booking/google/callback", "/api/booking/google/disconnect"],
};

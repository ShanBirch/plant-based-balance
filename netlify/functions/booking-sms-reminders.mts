import { sendBookingSms, smsConfigured } from "./_lib/booking-sms.mts";

type ReminderBooking = {
    id?: unknown;
    starts_at?: unknown;
    phone?: unknown;
    call_type?: unknown;
    timezone?: unknown;
};

const REMINDER_LEAD_MINUTES = 120;
const REMINDER_EARLY_MINUTES = 30;
const REMINDER_LATE_MINUTES = 20;
const MAX_REMINDERS_PER_RUN = 20;

function environment(name: string): string {
    return String(globalThis.Netlify?.env?.get?.(name) || "").trim();
}

function serviceConfig(): { url: string; key: string } {
    const url = environment("SUPABASE_URL").replace(/\/+$/, "");
    const key = environment("SUPABASE_SERVICE_ROLE_KEY") || environment("SUPABASE_SERVICE_KEY");
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
    if (!response.ok) throw new Error(`Supabase ${response.status}: ${text.slice(0, 300)}`);
    if (!text.trim()) return [];
    try { return JSON.parse(text); } catch { return []; }
}

function callTypeLabel(value: unknown): string {
    if (value === "video") return "video call";
    if (value === "whatsapp") return "WhatsApp call";
    return "phone call";
}

function timeZone(value: unknown): string {
    const candidate = String(value || "").trim() || "Australia/Brisbane";
    try {
        new Intl.DateTimeFormat("en-AU", { timeZone: candidate }).format();
        return candidate;
    } catch {
        return "Australia/Brisbane";
    }
}

function dateTimeLabel(value: string, timezone: string): string {
    return new Intl.DateTimeFormat("en-AU", {
        timeZone: timezone,
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    }).format(new Date(value));
}

async function claimReminder(id: string): Promise<ReminderBooking | null> {
    const rows = await supabaseRequest(
        `balance_bookings?id=eq.${encodeURIComponent(id)}&status=eq.confirmed&sms_reminder_sent_at=is.null&sms_reminder_claimed_at=is.null`,
        {
            method: "PATCH",
            body: JSON.stringify({ sms_reminder_claimed_at: new Date().toISOString() }),
        }
    ) as ReminderBooking[];
    return rows[0] || null;
}

async function completeReminder(id: string): Promise<void> {
    await supabaseRequest(`balance_bookings?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ sms_reminder_sent_at: new Date().toISOString() }),
    });
}

async function releaseReminder(id: string): Promise<void> {
    await supabaseRequest(`balance_bookings?id=eq.${encodeURIComponent(id)}&sms_reminder_sent_at=is.null`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ sms_reminder_claimed_at: null }),
    });
}

export default async function bookingSmsReminders(): Promise<void> {
    if (!smsConfigured()) return;

    const now = Date.now();
    const earliest = new Date(now + (REMINDER_LEAD_MINUTES - REMINDER_EARLY_MINUTES) * 60_000).toISOString();
    const latest = new Date(now + (REMINDER_LEAD_MINUTES + REMINDER_LATE_MINUTES) * 60_000).toISOString();
    const candidates = await supabaseRequest(
        `balance_bookings?select=id,starts_at,phone,call_type,timezone&status=eq.confirmed&phone=not.is.null&sms_reminder_sent_at=is.null&sms_reminder_claimed_at=is.null&starts_at=gte.${encodeURIComponent(earliest)}&starts_at=lt.${encodeURIComponent(latest)}&order=starts_at.asc&limit=${MAX_REMINDERS_PER_RUN}`
    ) as ReminderBooking[];

    for (const candidate of candidates) {
        const id = String(candidate.id || "");
        if (!id) continue;

        const booking = await claimReminder(id);
        if (!booking) continue;

        const startsAt = String(booking.starts_at || "");
        const zone = timeZone(booking.timezone);
        const sent = await sendBookingSms({
            to: String(booking.phone || ""),
            body: `Balance reminder: Your ${callTypeLabel(booking.call_type)} with Shannon is in about 2 hours, ${dateTimeLabel(startsAt, zone)}. Check your calendar invite for the details.`,
        });

        if (sent) await completeReminder(id);
        else await releaseReminder(id);
    }
}

export const config = { schedule: "*/10 * * * *" };

const SLUG = "saturday-10-october-2026";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const env = (key: string) => String(globalThis.Netlify?.env?.get?.(key) || process.env[key] || "").trim();
const clean = (value: unknown, max: number) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

async function db(path: string, init: RequestInit = {}) {
    const url = (env("SUPABASE_URL") || env("VITE_SUPABASE_URL")).replace(/\/+$/, "");
    const key = env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SERVICE_KEY");
    if (!url || !key) throw new Error("Booking storage unavailable");
    const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" } });
    if (!response.ok) throw new Error("Booking storage unavailable");
    return response.json();
}

async function email(to: string, subject: string, text: string, id: string) {
    if (!env("RESEND_API_KEY") || !env("BOOKING_EMAIL_FROM")) return false;
    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST", headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json", "Idempotency-Key": id },
            body: JSON.stringify({ from: env("BOOKING_EMAIL_FROM"), to: [to], reply_to: "shannonrhysbirch@gmail.com", subject, text }),
        });
        return response.ok;
    } catch { return false; }
}

export default async function handler(req: Request) {
    try {
        const [session] = await db(`balance_group_sessions?slug=eq.${SLUG}&select=*`);
        if (!session) return reply(404, { error: "closed" });
        const url = new URL(req.url);
        if (req.method === "GET") {
            const token = url.searchParams.get("receipt");
            if (token) {
                if (!UUID.test(token)) return reply(400, { error: "invalid" });
                const [registration] = await db(`balance_group_registrations?receipt_token=eq.${token}&session_slug=eq.${SLUG}&select=status,confirmation_email_sent_at`);
                if (!registration) return reply(404, { error: "not_found" });
                return reply(200, { status: registration.status, emailSent: Boolean(registration.confirmation_email_sent_at), meetingUrl: registration.status === "confirmed" ? session.meeting_url : null });
            }
            const rows = await db(`balance_group_registrations?session_slug=eq.${SLUG}&status=eq.confirmed&select=id`);
            return reply(200, { title: session.title, startsAt: session.starts_at, endsAt: session.ends_at, capacity: session.capacity, booked: rows.length, remaining: Math.max(0, session.capacity - rows.length), closed: !session.booking_enabled || Date.parse(session.starts_at) <= Date.now() });
        }
        if (req.method !== "POST") return reply(405, { error: "method" });
        const origin = req.headers.get("origin");
        if (origin && !["https://plantbased-balance.org", "https://future-balance.netlify.app"].includes(origin)) return reply(403, { error: "origin" });
        if (Number(req.headers.get("content-length")) > 8000) return reply(413, { error: "invalid" });
        let body;
        try { body = await req.json(); } catch { return reply(400, { error: "invalid" }); }
        const name = clean(body.name, 120), address = clean(body.email, 320).toLowerCase(), phone = clean(body.phone, 40), token = clean(body.token, 36);
        if (body.website || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || !UUID.test(token) || typeof body.reserve !== "boolean") return reply(400, { error: "invalid" });
        const result = await db("rpc/register_balance_group_session", { method: "POST", body: JSON.stringify({ p_slug: SLUG, p_name: name, p_email: address, p_phone: phone, p_reserve: body.reserve, p_token: token }) });
        if (result.error) return reply(result.error === "closed" ? 410 : 409, { error: result.error });
        const [registration] = await db(`balance_group_registrations?id=eq.${result.id}&select=confirmation_email_sent_at`);
        let emailSent = Boolean(registration?.confirmation_email_sent_at);
        const confirmed = result.status === "confirmed";
        const receiptUrl = `https://plantbased-balance.org/saturday-training.html#${token}`;
        if (!emailSent) {
            emailSent = await email(address, confirmed ? "You're booked: free Saturday training with Shannon" : "You're on the reserve list: Saturday training", `Hi ${name},\n\n${confirmed ? "Your spot is booked!" : "You're on the reserve list. This isn't a confirmed spot; I'll contact you if a place becomes available."}\n\nSaturday 10 October 2026\n9–10 a.m. Brisbane (10–11 a.m. Melbourne/Sydney)\nFree online group training with Shannon\n\n${confirmed ? `Join the session: ${session.meeting_url}\n\n` : ""}Your booking details: ${receiptUrl}\n\nQuestions or need to cancel? Reply here or call/text 0478 209 395.\n\nShannon`, `group-${result.id}`);
            if (emailSent) {
                try { await db(`balance_group_registrations?id=eq.${result.id}`, { method: "PATCH", body: JSON.stringify({ confirmation_email_sent_at: new Date().toISOString() }) }); } catch { /* The receipt remains available even if email tracking fails. */ }
            }
        }
        if (!result.existing) await email("shannonrhysbirch@gmail.com", `${confirmed ? "New booking" : "New reserve"}: Saturday training`, `${name}\n${address}\n${phone || "No mobile supplied"}\nStatus: ${result.status}\nSaturday 10 October, 9–10 a.m. Brisbane`, `group-owner-${result.id}`);
        return reply(200, { status: result.status, token, emailSent, meetingUrl: confirmed ? session.meeting_url : null });
    } catch {
        return reply(503, { error: "unavailable" });
    }
}

export const config = { path: "/api/group-session" };

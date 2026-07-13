type SmsMessage = {
    to: string;
    body: string;
};

function environment(name: string): string {
    return String(globalThis.Netlify?.env?.get?.(name) || "").trim();
}

export function smsConfigured(): boolean {
    return Boolean(
        environment("TWILIO_ACCOUNT_SID")
        && environment("TWILIO_AUTH_TOKEN")
        && environment("TWILIO_FROM_NUMBER")
    );
}

export function normalizeSmsPhone(value: unknown): string {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const digits = raw.replace(/\D/g, "");
    let normalized = raw.startsWith("+") ? `+${digits}` : raw.startsWith("00") ? `+${digits.slice(2)}` : "";

    // Public bookings are for an Australian business. Accept international numbers
    // when the visitor includes their country code, otherwise normalise Australian
    // mobile numbers to E.164 for Twilio.
    if (!normalized && /^0?4\d{8}$/.test(digits)) {
        normalized = `+61${digits.replace(/^0/, "")}`;
    }

    return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : "";
}

export async function sendBookingSms({ to, body }: SmsMessage): Promise<boolean> {
    const accountSid = environment("TWILIO_ACCOUNT_SID");
    const authToken = environment("TWILIO_AUTH_TOKEN");
    const from = normalizeSmsPhone(environment("TWILIO_FROM_NUMBER"));
    const recipient = normalizeSmsPhone(to);
    const message = String(body || "").trim();

    if (!accountSid || !authToken || !from || !recipient || !message) return false;

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: recipient, From: from, Body: message }).toString(),
    });

    if (!response.ok) console.error("[booking-sms] Twilio delivery failed", response.status);
    return response.ok;
}

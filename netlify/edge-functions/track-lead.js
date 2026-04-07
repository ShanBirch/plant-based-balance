import { sendCAPIEvent, hash } from "./lib/capi-utils.js";

export default async (request, context) => {
  if (request.method !== 'POST') {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const data = await request.json();
    const ip = request.headers.get('x-nf-client-connection-ip') || request.headers.get('client-ip');
    const userAgent = request.headers.get('user-agent');
    const referer = request.headers.get('referer');
    const eventName = data.event || 'Lead';

    const normalizedEmail = data.email ? data.email.trim().toLowerCase() : undefined;
    const externalId = normalizedEmail ? await hash(normalizedEmail) : undefined;

    context.waitUntil(
        sendCAPIEvent(eventName, {
        email: data.email,
        external_id: externalId,
        firstName: data.name ? data.name.split(' ')[0] : undefined,
        ip,
        userAgent,
        fbc: data.fbc,
        fbp: data.fbp,
        sourceUrl: referer
        }, {
        content_category: 'Hormone Analysis Quiz',
        content_name: 'Lead - Quiz Completion',
        status: 'lead'
        })
    );

    return new Response(JSON.stringify({ message: 'Lead event sent to CAPI' }), {
        headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error('Track Lead Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
};

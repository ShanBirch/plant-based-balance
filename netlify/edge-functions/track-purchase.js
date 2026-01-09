import { sendCAPIEvent } from "./capi-utils.js";

export default async (request, context) => {
  if (request.method !== 'POST') {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const data = await request.json();
    const ip = request.headers.get('x-nf-client-connection-ip') || request.headers.get('client-ip');
    const userAgent = request.headers.get('user-agent');
    const referer = request.headers.get('referer');

    context.waitUntil(
        sendCAPIEvent('Purchase', {
            email: data.email,
            firstName: data.name ? data.name.split(' ')[0] : undefined,
            ip,
            userAgent,
            fbc: data.fbc,
            fbp: data.fbp,
            sourceUrl: referer
        }, {
            value: parseFloat(data.value) || 46.00,
            currency: 'AUD',
            content_type: 'product',
            content_name: data.planName || 'PlantBasedReset Plan'
        })
    );

    return new Response(JSON.stringify({ message: 'Purchase event sent to CAPI' }), { 
        headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error('Track Purchase Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
};

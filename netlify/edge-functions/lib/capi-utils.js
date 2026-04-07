export async function hash(text) {
  if (!text) return undefined;
  const msgBuffer = new TextEncoder().encode(text.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function sendCAPIEvent(eventName, userData, eventData = {}) {
  const PIXEL_ID = '1928402271406692';
  // Netlify Edge Functions expose env vars globally via Deno.env
  const ACCESS_TOKEN = Deno.env.get("META_CAPI_ACCESS_TOKEN") || Deno.env.get("meta_capi_key");

  if (!ACCESS_TOKEN) {
    // console.warn("META_CAPI_ACCESS_TOKEN not found. Skipping CAPI event:", eventName);
    // Don't error, just return, to avoid noise if unset
    return;
  }

  const url = `https://graph.facebook.com/v17.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;

  // Hash PII if provided
  let em, fn;
  if (userData.email) em = [await hash(userData.email)];
  if (userData.firstName) fn = [await hash(userData.firstName)];

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_source_url: userData.sourceUrl || "https://plantbased-balance.org",
        user_data: {
          client_user_agent: userData.userAgent,
          client_ip_address: userData.ip,
          em: em,
          fn: fn,
          fbc: userData.fbc || undefined,
          fbp: userData.fbp || undefined
        },
        custom_data: eventData
      }
    ]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    // const result = await response.json();
    // console.log(`CAPI ${eventName} Result vEdge:`, result);
  } catch (err) {
    console.error(`CAPI Error for ${eventName}:`, err);
  }
}

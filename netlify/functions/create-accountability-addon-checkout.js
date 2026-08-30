const { SUPABASE_URL, SUPABASE_SERVICE_KEY, supabaseQuery } = require('./_lib/client-context');

const VOICE_CHECKIN = 'voice_checkin';
const ZOOM_PT_1_UPGRADE = 'zoom_pt_1_upgrade';
const EXTRA_ZOOM_PT = 'extra_zoom_pt';
const ALLOWED_ADDONS = new Set([VOICE_CHECKIN, ZOOM_PT_1_UPGRADE, EXTRA_ZOOM_PT]);

function json(statusCode, body) {
    return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function bearerToken(headers = {}) {
    const match = String(headers.authorization || headers.Authorization || '').match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : '';
}

async function getAuthedUser(accessToken) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !accessToken) return null;
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${accessToken}` },
    });
    return response.ok ? response.json().catch(() => null) : null;
}

function cleanAddons(value) {
    return [...new Set((Array.isArray(value) ? value : []).map(item => String(item || '').trim()).filter(item => ALLOWED_ADDONS.has(item)))];
}

function safeWeekStart(value) {
    const result = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(result) ? result : null;
}

function safeBookingId(value) {
    const result = String(value || '').trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result) ? result : null;
}

function siteOrigin(event) {
    const origin = String(event.headers?.origin || '').trim();
    return /^https:\/\/(?:www\.)?plantbased-balance\.org$/i.test(origin) || /^https:\/\/[^/]+\.netlify\.app$/i.test(origin)
        ? origin
        : 'https://plantbased-balance.org';
}

async function createVoiceCheckinCheckout({ stripeKey, user, origin, weekStart }) {
    const params = new URLSearchParams();
    params.set('mode', 'subscription');
    if (user.stripe_customer_id) params.set('customer', user.stripe_customer_id);
    else if (user.email) params.set('customer_email', user.email);
    params.set('line_items[0][price_data][currency]', 'aud');
    params.set('line_items[0][price_data][product_data][name]', 'Balance extra voice-message check-in');
    params.set('line_items[0][price_data][product_data][description]', 'One extra mid-week accountability voice-message check-in from Shannon. AU$25 billed weekly until cancelled.');
    params.set('line_items[0][price_data][unit_amount]', '2500');
    params.set('line_items[0][price_data][recurring][interval]', 'week');
    params.set('line_items[0][quantity]', '1');
    params.set('custom_text[submit][message]', 'AU$25.00 is billed weekly for one extra voice-message accountability check-in. You can cancel before a future weekly renewal.');
    params.set('success_url', `${origin}/dashboard.html?accountability_addon=voice_checkin&checkout=success`);
    params.set('cancel_url', `${origin}/dashboard.html?accountability_addon=voice_checkin&checkout=cancelled`);
    const metadata = {
        balance_product: 'balance_accountability_addon',
        balance_plan: 'extra_voice_checkin_weekly',
        addon_type: VOICE_CHECKIN,
        balance_user_id: user.id,
        checkout_email: user.email || '',
        week_start: weekStart || '',
    };
    Object.entries(metadata).forEach(([key, value]) => {
        params.set(`metadata[${key}]`, value);
        params.set(`subscription_data[metadata][${key}]`, value);
    });
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.url) throw new Error(payload?.error?.message || 'Secure checkout is temporarily unavailable.');
    return payload.url;
}

async function loadBookedPtSlot({ user, bookingId, addonType }) {
    const rows = await supabaseQuery(`balance_bookings?select=id,starts_at,ends_at,email,status,metadata&id=eq.${encodeURIComponent(bookingId)}&limit=1`).catch(() => []);
    const booking = rows[0];
    const metadata = booking && booking.metadata && typeof booking.metadata === 'object' ? booking.metadata : {};
    if (!booking || booking.status !== 'confirmed' || String(booking.email || '').toLowerCase() !== String(user.email || '').toLowerCase()) {
        throw new Error('That Zoom PT time could not be verified. Please choose the time again.');
    }
    if (metadata.source !== 'weekly_checkin_pt' || metadata.addon_type !== addonType) {
        throw new Error('That booking does not match this Zoom PT option.');
    }
    return booking;
}

async function activeMainSubscription(user) {
    if (!user.stripe_customer_id) return null;
    const rows = await supabaseQuery(`stripe_subscription_links?select=stripe_subscription_id,subscription_plan,subscription_status&stripe_customer_id=eq.${encodeURIComponent(user.stripe_customer_id)}&subscription_status=in.(active,trialing)&order=updated_at.desc&limit=10`).catch(() => []);
    return rows.find(row => !['extra_voice_checkin_weekly', 'extra_zoom_pt_weekly'].includes(String(row.subscription_plan || ''))) || null;
}

async function createPtCheckout({ stripeKey, user, origin, booking, addonType }) {
    const isUpgrade = addonType === ZOOM_PT_1_UPGRADE;
    const unitAmount = isUpgrade ? 12500 : 7500;
    const previous = isUpgrade ? await activeMainSubscription(user) : null;
    const params = new URLSearchParams();
    params.set('mode', 'subscription');
    if (user.stripe_customer_id) params.set('customer', user.stripe_customer_id);
    else params.set('customer_email', user.email);
    params.set('line_items[0][price_data][currency]', 'aud');
    params.set('line_items[0][price_data][product_data][name]', isUpgrade ? 'Balance Zoom PT 1' : 'Balance extra Zoom PT session');
    params.set('line_items[0][price_data][product_data][description]', isUpgrade
        ? 'One recurring 30-minute 1:1 Zoom PT session each week, including Balance app access, programming, food guidance and weekly check-ins.'
        : 'One additional recurring 30-minute 1:1 Zoom PT session each week.');
    params.set('line_items[0][price_data][unit_amount]', String(unitAmount));
    params.set('line_items[0][price_data][recurring][interval]', 'week');
    params.set('line_items[0][quantity]', '1');
    params.set('custom_text[submit][message]', isUpgrade
        ? 'AU$125.00 is your total weekly Zoom PT 1 payment. It replaces your current coaching subscription after payment and begins with a six-week initial block.'
        : 'AU$75.00 is billed weekly for one additional recurring Zoom PT session until cancelled.');
    params.set('success_url', `${origin}/dashboard.html?accountability_addon=${encodeURIComponent(addonType)}&checkout=success`);
    params.set('cancel_url', `${origin}/dashboard.html?accountability_addon=${encodeURIComponent(addonType)}&checkout=cancelled`);
    const metadata = {
        balance_product: isUpgrade ? 'balance_zoom_pt' : 'balance_accountability_addon',
        balance_plan: isUpgrade ? 'zoom_pt_1_weekly' : 'extra_zoom_pt_weekly',
        addon_type: addonType,
        balance_user_id: user.id,
        checkout_email: user.email || '',
        booking_id: booking.id,
        recurring_starts_at: booking.starts_at,
        recurring_ends_at: booking.ends_at,
        previous_subscription_id: previous?.stripe_subscription_id || '',
        replaces_current_coaching: isUpgrade ? 'true' : 'false',
        commitment_weeks: isUpgrade ? '6' : '',
    };
    Object.entries(metadata).forEach(([key, value]) => {
        params.set(`metadata[${key}]`, String(value || ''));
        params.set(`subscription_data[metadata][${key}]`, String(value || ''));
    });
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.url) throw new Error(payload?.error?.message || 'Secure checkout is temporarily unavailable.');
    return payload.url;
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed.' });
    const authUser = await getAuthedUser(bearerToken(event.headers || {}));
    if (!authUser?.id) return json(401, { ok: false, error: 'Please log in again before choosing extra support.' });
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch (_) { return json(400, { ok: false, error: 'Invalid request.' }); }
    const addons = cleanAddons(body.addons);
    if (!addons.length) return json(400, { ok: false, error: 'Choose a support option first.' });
    if (addons.includes(ZOOM_PT_1_UPGRADE) && addons.includes(EXTRA_ZOOM_PT)) {
        return json(400, { ok: false, error: 'Choose either Zoom PT 1 or an extra Zoom PT session.' });
    }
    const weekStart = safeWeekStart(body.week_start);
    const bookingId = safeBookingId(body.booking_id);
    const users = await supabaseQuery(`users?select=id,name,email,stripe_customer_id,subscription_status&id=eq.${encodeURIComponent(authUser.id)}&limit=1`).catch(() => []);
    const user = users[0];
    if (!user || user.subscription_status !== 'active') return json(403, { ok: false, error: 'Extra support is available to active coaching clients.' });

    try {
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeKey) throw new Error('Secure checkout is temporarily unavailable.');
        const ptAddon = addons.find(addon => addon === ZOOM_PT_1_UPGRADE || addon === EXTRA_ZOOM_PT);
        if (ptAddon && !bookingId) {
            return json(200, {
                ok: true,
                booking_url: `${siteOrigin(event)}/book.html?source=weekly_checkin_pt&addon=${encodeURIComponent(ptAddon)}`,
            });
        }
        if (ptAddon) {
            const booking = await loadBookedPtSlot({ user, bookingId, addonType: ptAddon });
            const checkoutUrl = await createPtCheckout({ stripeKey, user, origin: siteOrigin(event), booking, addonType: ptAddon });
            return json(200, { ok: true, checkout_url: checkoutUrl });
        }
        const checkoutUrl = await createVoiceCheckinCheckout({ stripeKey, user, origin: siteOrigin(event), weekStart });
        return json(200, { ok: true, checkout_url: checkoutUrl });
    } catch (error) {
        console.error('[accountability-addon] failed:', error.message);
        return json(500, { ok: false, error: error.message || 'Your support request could not be started.' });
    }
};

exports._test = { cleanAddons, safeWeekStart, safeBookingId };

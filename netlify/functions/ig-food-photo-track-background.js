/**
 * Background runner for opt-in Instagram food photo calorie tracking.
 *
 * instagram-webhook sends the client-facing acknowledgement, then queues this
 * function to download the IG image, run the existing food analyser, upload the
 * photo, and save a standard meal_logs row for the linked Balance user.
 */

const { supabaseQuery } = require('./_lib/client-context');

const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const MAX_IMAGE_BYTES = Number(process.env.IG_FOOD_PHOTO_MAX_BYTES || 6 * 1024 * 1024);
const FOOD_PHOTO_MEAL_DESCRIPTION = 'Instagram food photo';
const BRISBANE_TIME_ZONE = 'Australia/Brisbane';

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function cleanString(value, max = 500) {
    return String(value || '').trim().slice(0, max);
}

function booleanFlagValue(value) {
    if (typeof value === 'boolean') return value;
    const raw = String(value ?? '').trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on', 'enabled'].includes(raw)) return true;
    if (['0', 'false', 'no', 'n', 'off', 'disabled'].includes(raw)) return false;
    return null;
}

function parseBody(event = {}) {
    if (!event.body) return {};
    try {
        const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
        return JSON.parse(raw || '{}');
    } catch {
        return {};
    }
}

function validDate(value, fallback = new Date()) {
    const date = value ? new Date(value) : fallback;
    return Number.isFinite(date.getTime()) ? date : fallback;
}

function brisbaneDateParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-AU', {
        timeZone: BRISBANE_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date).reduce((acc, part) => {
        if (part.type !== 'literal') acc[part.type] = part.value;
        return acc;
    }, {});
    const hour = parts.hour === '24' ? '00' : parts.hour;
    return {
        mealDate: `${parts.year}-${parts.month}-${parts.day}`,
        mealTime: `${hour}:${parts.minute}:${parts.second}`,
        hour: Number(hour),
    };
}

function mealTypeForHour(hour) {
    if (hour >= 5 && hour < 10) return 'breakfast';
    if (hour >= 10 && hour < 15) return 'lunch';
    if (hour >= 17 && hour < 21) return 'dinner';
    return 'snack';
}

function numberOrZero(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function nutritionTotals(nutrition = {}) {
    const totals = safeObject(nutrition.totals);
    if (Object.keys(totals).length) {
        return {
            calories: numberOrZero(totals.calories),
            protein_g: numberOrZero(totals.protein_g),
            carbs_g: numberOrZero(totals.carbs_g),
            fat_g: numberOrZero(totals.fat_g),
            fiber_g: numberOrZero(totals.fiber_g),
        };
    }

    const items = Array.isArray(nutrition.foodItems) ? nutrition.foodItems : [];
    return items.reduce((acc, item) => {
        acc.calories += numberOrZero(item?.calories);
        acc.protein_g += numberOrZero(item?.protein_g);
        acc.carbs_g += numberOrZero(item?.carbs_g);
        acc.fat_g += numberOrZero(item?.fat_g);
        acc.fiber_g += numberOrZero(item?.fiber_g);
        return acc;
    }, { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 });
}

function extensionForMime(mimeType, sourceUrl = '') {
    const lower = String(mimeType || '').toLowerCase();
    if (lower.includes('jpeg') || lower.includes('jpg')) return 'jpg';
    if (lower.includes('png')) return 'png';
    if (lower.includes('webp')) return 'webp';
    if (lower.includes('heic')) return 'heic';
    const match = String(sourceUrl || '').split('?')[0].match(/\.([a-z0-9]{2,5})$/i);
    return match ? match[1].toLowerCase() : 'jpg';
}

function sourceTokenFromBody(body = {}) {
    return cleanString(body.graphMessageId || body.igMessageId || body.dedupeId || body.jobToken || '', 180);
}

function trackingDisabled(customData = {}) {
    const data = safeObject(customData);
    const tracking = safeObject(data.food_photo_tracking);
    const flags = [
        tracking.enabled,
        data.food_photo_tracking_enabled,
        data.calorie_photo_tracking_enabled,
    ];
    return flags.some(flag => booleanFlagValue(flag) === false);
}

function jobTokenMatches(thread = {}, jobToken = '') {
    const token = cleanString(jobToken, 120);
    if (!token) return false;
    const tracking = safeObject(safeObject(thread.custom_data).food_photo_tracking);
    const pending = Array.isArray(tracking.pending_job_tokens)
        ? tracking.pending_job_tokens.map(item => cleanString(item, 120)).filter(Boolean)
        : [];
    return cleanString(tracking.active_job_token, 120) === token || pending.includes(token);
}

function withoutJobToken(tokens, jobToken) {
    const token = cleanString(jobToken, 120);
    return (Array.isArray(tokens) ? tokens : [])
        .map(item => cleanString(item, 120))
        .filter(item => item && item !== token)
        .slice(0, 10);
}

async function loadThread(threadId) {
    const rows = await supabaseQuery(
        `ig_threads?select=id,linked_user_id,custom_data,ig_username,profile_name&channel=eq.instagram&id=eq.${encodeURIComponent(threadId)}&limit=1`
    );
    return rows[0] || null;
}

async function patchThreadTracking(threadId, patch = {}, jobToken = '') {
    if (!threadId) return;
    try {
        const thread = await loadThread(threadId);
        if (!thread) return;
        const customData = safeObject(thread.custom_data);
        const currentTracking = safeObject(customData.food_photo_tracking);
        const nextTracking = {
            ...currentTracking,
            ...patch,
        };
        if (jobToken) {
            nextTracking.pending_job_tokens = withoutJobToken(currentTracking.pending_job_tokens, jobToken);
            if (cleanString(currentTracking.active_job_token, 120) === cleanString(jobToken, 120)) {
                delete nextTracking.active_job_token;
            }
        }
        await supabaseQuery(`ig_threads?id=eq.${encodeURIComponent(threadId)}`, {
            method: 'PATCH',
            body: {
                custom_data: {
                    ...customData,
                    food_photo_tracking: nextTracking,
                },
                updated_at: new Date().toISOString(),
            },
            prefer: 'return=minimal',
        });
    } catch (err) {
        console.warn('[ig-food-photo-track] state patch failed:', err.message);
    }
}

async function fetchImage(photoUrl) {
    const response = await fetch(photoUrl, {
        headers: {
            Accept: 'image/*',
            'User-Agent': 'BalanceMealPhotoTracker/1.0',
        },
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`image download failed ${response.status}: ${text.slice(0, 160)}`);
    }
    const mimeType = cleanString(String(response.headers.get('content-type') || '').split(';')[0], 80) || 'image/jpeg';
    if (!mimeType.startsWith('image/')) {
        throw new Error(`downloaded media was not an image (${mimeType})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
        throw new Error(`image too large (${arrayBuffer.byteLength} bytes)`);
    }
    return {
        buffer: Buffer.from(arrayBuffer),
        mimeType,
    };
}

async function analyzeFood({ buffer, mimeType }) {
    const response = await fetch(`${SITE_URL}/.netlify/functions/analyze-food`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            imageBase64: buffer.toString('base64'),
            mimeType: mimeType || 'image/jpeg',
            description: 'Food photo sent by Instagram DM for calorie tracking',
            only_verify: false,
        }),
    });
    const text = await response.text();
    let parsed;
    try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { raw: text }; }
    if (!response.ok || parsed?.success === false) {
        const detail = parsed?.error || parsed?.details || text;
        throw new Error(`food analysis failed ${response.status}: ${String(detail || '').slice(0, 240)}`);
    }
    return safeObject(parsed.data || parsed);
}

async function uploadMealPhoto({ buffer, mimeType, userId, photoUrl, sourceToken }) {
    if (typeof FormData !== 'function' || typeof Blob !== 'function') return null;
    const form = new FormData();
    const extension = extensionForMime(mimeType, photoUrl);
    const fileName = `instagram-food-${cleanString(sourceToken || Date.now(), 80).replace(/[^a-zA-Z0-9_-]+/g, '-')}.${extension}`;
    form.append('file', new Blob([buffer], { type: mimeType || 'image/jpeg' }), fileName);
    form.append('userId', userId);

    const response = await fetch(`${SITE_URL}/api/upload-meal-photo`, {
        method: 'POST',
        body: form,
    });
    const text = await response.text();
    let parsed;
    try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { raw: text }; }
    if (!response.ok || !parsed?.success) {
        throw new Error(`photo upload failed ${response.status}: ${String(parsed?.error || text || '').slice(0, 180)}`);
    }
    return parsed;
}

async function insertMealLog({ userId, photoUrl, storagePath, nutrition, queuedAt }) {
    const dateParts = brisbaneDateParts(validDate(queuedAt));
    const totals = nutritionTotals(nutrition);
    const notes = [
        cleanString(nutrition.notes, 700),
        cleanString(nutrition.meal_insight, 700),
        'Logged from Instagram food photo.',
    ].filter(Boolean).join('\n\n');
    const rows = await supabaseQuery('meal_logs', {
        method: 'POST',
        body: [{
            user_id: userId,
            meal_date: dateParts.mealDate,
            meal_time: dateParts.mealTime,
            meal_type: mealTypeForHour(dateParts.hour),
            photo_url: photoUrl || 'text-input',
            storage_path: storagePath || photoUrl || 'text-input',
            food_items: Array.isArray(nutrition.foodItems) ? nutrition.foodItems : [],
            calories: totals.calories,
            protein_g: totals.protein_g,
            carbs_g: totals.carbs_g,
            fat_g: totals.fat_g,
            fiber_g: totals.fiber_g,
            micronutrients: safeObject(nutrition.micronutrients),
            notes,
            ai_confidence: cleanString(nutrition.confidence || 'medium', 30),
            input_method: 'photo',
            meal_description: FOOD_PHOTO_MEAL_DESCRIPTION,
            analysis_timestamp: new Date().toISOString(),
        }],
        prefer: 'return=representation',
    });
    return rows[0] || null;
}

async function runFoodPhotoTracking(body = {}) {
    const threadId = cleanString(body.threadId, 120);
    const userId = cleanString(body.userId, 120);
    const photoUrl = cleanString(body.photoUrl, 3000);
    const jobToken = cleanString(body.jobToken, 120);
    const sourceToken = sourceTokenFromBody(body);

    if (!threadId || !userId || !photoUrl || !jobToken) {
        return json(400, { ok: false, error: 'missing_required_fields' });
    }

    const thread = await loadThread(threadId);
    if (!thread) return json(404, { ok: false, error: 'thread_not_found' });
    if (cleanString(thread.linked_user_id, 120) !== userId) {
        return json(403, { ok: false, error: 'thread_user_mismatch' });
    }
    if (trackingDisabled(thread.custom_data)) {
        return json(403, { ok: false, error: 'food_photo_tracking_disabled' });
    }
    if (!jobTokenMatches(thread, jobToken)) {
        return json(403, { ok: false, error: 'job_token_not_queued' });
    }

    await patchThreadTracking(threadId, {
        last_status: 'processing',
        last_processing_at: new Date().toISOString(),
        last_error: null,
    });

    let meal = null;
    try {
        const image = await fetchImage(photoUrl);
        const nutrition = await analyzeFood(image);
        let upload = null;
        try {
            upload = await uploadMealPhoto({
                ...image,
                userId,
                photoUrl,
                sourceToken,
            });
        } catch (uploadErr) {
            console.warn('[ig-food-photo-track] upload fallback to IG URL:', uploadErr.message);
        }

        const savedPhotoUrl = upload?.url || photoUrl;
        const storagePath = upload?.fileName || savedPhotoUrl;
        meal = await insertMealLog({
            userId,
            photoUrl: savedPhotoUrl,
            storagePath,
            nutrition,
            queuedAt: body.queuedAt,
        });
        if (!meal?.id) throw new Error('meal log insert returned no row');

        await patchThreadTracking(threadId, {
            last_status: 'tracked',
            last_meal_log_id: meal.id,
            last_calories: numberOrZero(meal.calories),
            last_tracked_at: new Date().toISOString(),
            last_error: null,
        }, jobToken);
        return json(200, { ok: true, mealLogId: meal.id, calories: numberOrZero(meal.calories) });
    } catch (err) {
        await patchThreadTracking(threadId, {
            last_status: 'error',
            last_error: cleanString(err.message, 500),
            last_failed_at: new Date().toISOString(),
        }, jobToken);
        throw err;
    }
}

exports._test = {
    brisbaneDateParts,
    mealTypeForHour,
    nutritionTotals,
    jobTokenMatches,
};

exports.handler = async (event = {}) => {
    if (event.httpMethod !== 'POST') {
        return json(405, { ok: false, error: 'Method not allowed' });
    }

    const body = parseBody(event);
    try {
        return await runFoodPhotoTracking(body);
    } catch (err) {
        console.error('[ig-food-photo-track] failed:', err.message);
        return json(500, { ok: false, error: 'food_photo_tracking_failed', details: err.message });
    }
};

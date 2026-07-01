/**
 * Netlify Edge Function to upload weekly progress photos to Backblaze B2
 * Handles photo uploads from the weekly progress photo check-in feature
 */

const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

function cleanFirstName(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return 'there';
    return raw.split(/\s+/)[0].replace(/^@+/, '').toLowerCase();
}

function brisbaneWeekMonday(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Brisbane',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short'
    }).formatToParts(date).reduce((acc, part) => {
        acc[part.type] = part.value;
        return acc;
    }, {});

    const weekdayIndex = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 }[parts.weekday] ?? 1;
    const diff = weekdayIndex === 0 ? 6 : weekdayIndex - 1;
    const utcMidday = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 12));
    utcMidday.setUTCDate(utcMidday.getUTCDate() - diff);
    return utcMidday.toISOString().slice(0, 10);
}

async function supabaseQuery(path, options = {}) {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Supabase service env missing');

    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: options.prefer || 'return=representation'
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
        const text = await response.text();
        const err = new Error(`Supabase ${options.method || 'GET'} ${path} failed: ${response.status} ${text}`);
        try {
            const parsed = JSON.parse(text);
            if (parsed?.code) err.sqlstate = parsed.code;
        } catch (_) {}
        throw err;
    }

    const text = await response.text();
    if (!text) return [];
    try { return JSON.parse(text); } catch (_) { return []; }
}

async function loadProgressPhotoAlertTarget(userId) {
    const clientRows = await supabaseQuery(
        `users?select=id,name,email&id=eq.${encodeURIComponent(userId)}&limit=1`
    ).catch(() => []);
    const client = clientRows[0] || { id: userId, name: 'Client', email: '' };

    const assignmentRows = await supabaseQuery(
        `coach_clients?select=coach_id,client_id,status&client_id=eq.${encodeURIComponent(userId)}&status=eq.active&order=assigned_at.desc&limit=1`
    ).catch(() => []);
    let coachId = assignmentRows[0]?.coach_id || null;

    if (!coachId) {
        const coachRows = await supabaseQuery(
            `users?select=id,email&email=eq.${encodeURIComponent(BALANCE_ADMIN_EMAIL)}&limit=1`
        ).catch(() => []);
        coachId = coachRows[0]?.id || null;
    }

    return { client, coachId };
}

function buildProgressPhotoMessage(clientName) {
    const name = cleanFirstName(clientName);
    return `hey ${name}, just saw your progress photos come through. awesome job getting them done this week, i'll have a proper look and we can use these to track the changes over the next few weeks 💪`;
}

async function insertProgressPhotoNeedsYouAlert({ userId, publicUrl, fileName, contentType, sizeBytes }) {
    try {
        const { client, coachId } = await loadProgressPhotoAlertTarget(userId);
        if (!coachId) throw new Error('No coach id found for progress photo alert');

        const clientName = client.name || client.email?.split('@')[0] || 'Client';
        const weekKey = brisbaneWeekMonday();
        const suggestedMessage = buildProgressPhotoMessage(clientName);
        const nowIso = new Date().toISOString();
        const idempotencyKey = `progress_photo_uploaded:${coachId}:${userId}:${weekKey}`;

        const row = {
            coach_id: coachId,
            client_id: userId,
            client_name: clientName,
            alert_type: 'weekly_checkin',
            priority: 'high',
            title: `${clientName} uploaded progress photos`,
            description: `${clientName} uploaded weekly progress photos for the week of ${weekKey}. Review them and send the suggested message.`,
            suggested_message: suggestedMessage,
            status: 'pending',
            idempotency_key: idempotencyKey,
            data: {
                subtype: 'progress_photo_uploaded',
                progress_photo_uploaded: true,
                progress_photo_week: weekKey,
                photo_url: publicUrl,
                storage_path: fileName,
                content_type: contentType || null,
                size_bytes: sizeBytes || null,
                drafted_at: nowIso,
                draft_text: suggestedMessage,
                draft_messages: [suggestedMessage],
                operator_queue: 'needs_you',
                needs_you_required: true,
                needs_you_reason: 'progress_photo_uploaded',
                needs_you_reasons: ['progress_photo_uploaded'],
                client_manager_review_required: true,
                needs_shannon_approval: true,
                non_challenge_checkin: true,
                manual_checkin_roster: true,
                linked_client_name: clientName,
                channel: 'in_app',
                delivery_channel: 'in_app',
                codex_review: {
                    source: 'progress-photo-upload',
                    decision: 'needs_you_progress_photo_uploaded',
                    queue: 'needs_you',
                    reason: 'progress_photo_uploaded',
                    needs_shannon_approval: true,
                    reviewed_at: nowIso,
                    automation_id: 'progress-photo-upload',
                    evidence_ids: [`users:${userId}`, `weekly_progress_photos:${weekKey}`]
                }
            }
        };

        await supabaseQuery('coach_alerts', {
            method: 'POST',
            body: [row],
            prefer: 'return=representation'
        });
    } catch (error) {
        const duplicate = error?.sqlstate === '23505' || /23505|duplicate key/i.test(error?.message || '');
        if (!duplicate) console.warn('Progress photo Needs You alert skipped:', error?.message || error);
    }
}

export default async (request, context) => {
    // Only allow POST
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const userId = formData.get('userId');

        if (!file || !userId) {
            return jsonResponse({
                error: 'Missing required fields: file, userId'
            }, 400);
        }

        // Get B2 credentials from environment
        const B2_KEY_ID = Deno.env.get("B2_KEY_ID");
        const B2_APPLICATION_KEY = Deno.env.get("B2_APPLICATION_KEY");
        const B2_BUCKET_ID = Deno.env.get("B2_BUCKET_ID");
        const B2_BUCKET_NAME = Deno.env.get("B2_BUCKET_NAME");

        if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_ID || !B2_BUCKET_NAME) {
            console.error("Missing B2 configuration");
            return jsonResponse({
                error: 'Server configuration error'
            }, 500);
        }

        // 1. Authorize with B2
        const authResponse = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
            method: 'GET',
            headers: {
                'Authorization': 'Basic ' + btoa(`${B2_KEY_ID}:${B2_APPLICATION_KEY}`)
            }
        });

        if (!authResponse.ok) {
            const errorText = await authResponse.text();
            console.error('B2 Authorization failed:', errorText);
            return jsonResponse({
                error: 'Failed to authorize with storage service'
            }, 500);
        }

        const authData = await authResponse.json();
        const { authorizationToken, apiUrl, downloadUrl } = authData;

        // 2. Get upload URL
        const uploadUrlResponse = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
            method: 'POST',
            headers: {
                'Authorization': authorizationToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ bucketId: B2_BUCKET_ID })
        });

        if (!uploadUrlResponse.ok) {
            const errorText = await uploadUrlResponse.text();
            console.error('Failed to get upload URL:', errorText);
            return jsonResponse({
                error: 'Failed to get upload URL'
            }, 500);
        }

        const { uploadUrl, authorizationToken: uploadToken } = await uploadUrlResponse.json();

        // 3. Prepare file for upload
        const fileBuffer = await file.arrayBuffer();
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const timestamp = Date.now();
        const fileName = `progress-photos/${userId}/${timestamp}.${fileExtension}`;

        // Calculate SHA1 hash (required by B2)
        const hashBuffer = await crypto.subtle.digest('SHA-1', fileBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const sha1Hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // 4. Upload file to B2
        const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': uploadToken,
                'X-Bz-File-Name': encodeURIComponent(fileName),
                'Content-Type': file.type || 'image/jpeg',
                'Content-Length': fileBuffer.byteLength.toString(),
                'X-Bz-Content-Sha1': sha1Hash,
                'X-Bz-Info-Author': `user-${userId}`,
                'X-Bz-Info-upload-type': 'progress-photo'
            },
            body: fileBuffer
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('Upload to B2 failed:', errorText);
            return jsonResponse({
                error: 'Failed to upload file'
            }, 500);
        }

        const uploadData = await uploadResponse.json();

        // 5. Construct public URL
        const publicUrl = `${downloadUrl}/file/${B2_BUCKET_NAME}/${fileName}`;

        // 6. Add a Needs You card for Shannon. This is intentionally non-blocking:
        // the client's upload should still succeed if the alert insert fails.
        await insertProgressPhotoNeedsYouAlert({
            userId,
            publicUrl,
            fileName,
            contentType: file.type,
            sizeBytes: fileBuffer.byteLength
        });

        // Return success with public URL
        return jsonResponse({
            success: true,
            url: publicUrl,
            fileName: fileName,
            fileId: uploadData.fileId,
            contentType: file.type,
            size: fileBuffer.byteLength
        }, 200);

    } catch (error) {
        console.error('Error in upload-progress-photo:', error);
        return jsonResponse({
            error: error.message || 'Internal server error'
        }, 500);
    }
};

export const config = {
    path: "/api/upload-progress-photo"
};

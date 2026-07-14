/**
 * One-time recovery for two videos that reached Shannon's own Instagram inbox
 * after the gallery upload failed. The message is already synced by the
 * Instagram Graph worker, so this keeps the media transfer server-side.
 *
 * The function deliberately preserves each exercise's visibility. Exercise
 * contribution XP is only awarded by the normal flow after an exercise is
 * explicitly shared with the public library.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const OWNER_ID = '00a6605e-8edb-4917-85ba-24a23f179059';
const IG_MESSAGE_ID = '96977a91-f669-4750-8219-c45bea5a6029';
const RECOVERIES = [
    { exerciseId: '89bbcad4-d054-4fe9-a7bf-4ccb981a073f', videoIndex: 0 },
    { exerciseId: 'ad532a6e-a7a1-42ee-8bb3-de0f4f4057ec', videoIndex: 1 },
];

function headers(extra = {}) {
    return {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        ...extra,
    };
}

function escapePostgrestIn(values) {
    return values.join(',');
}

function getVideoUrls(messageText) {
    const urls = [];
    const matcher = /\[VIDEO:(https:\/\/[^\]]+)\]/g;
    let match;
    while ((match = matcher.exec(String(messageText || '')))) {
        const url = new URL(match[1]);
        if (url.protocol === 'https:' && url.hostname === 'lookaside.fbsbx.com') urls.push(url.toString());
    }
    return urls;
}

async function fetchJson(url, options) {
    const response = await fetch(url, options);
    const text = await response.text();
    if (!response.ok) throw new Error(`${response.status}: ${text.slice(0, 240)}`);
    return text ? JSON.parse(text) : null;
}

async function getB2Account() {
    const keyId = process.env.B2_KEY_ID;
    const applicationKey = process.env.B2_APPLICATION_KEY;
    const bucketId = process.env.B2_BUCKET_ID;
    const bucketName = process.env.B2_BUCKET_NAME;
    if (!keyId || !applicationKey || !bucketId || !bucketName) {
        throw new Error('B2 storage configuration is missing');
    }

    const auth = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
        headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${applicationKey}`).toString('base64')}` },
    });
    if (!auth.ok) throw new Error('Could not authorize the exercise video upload');
    return { ...(await auth.json()), bucketId, bucketName };
}

async function uploadToB2(account, fileName, contentType, bytes) {
    const uploadUrl = await fetchJson(`${account.apiUrl}/b2api/v2/b2_get_upload_url`, {
        method: 'POST',
        headers: { Authorization: account.authorizationToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucketId: account.bucketId }),
    });

    const upload = await fetch(uploadUrl.uploadUrl, {
        method: 'POST',
        headers: {
            Authorization: uploadUrl.authorizationToken,
            'X-Bz-File-Name': encodeURIComponent(fileName),
            'Content-Type': contentType,
            'Content-Length': String(bytes.byteLength),
            'X-Bz-Content-Sha1': 'do_not_verify',
            'X-Bz-Info-Author': `user-${OWNER_ID}`,
            'X-Bz-Info-upload-type': 'custom-exercise-video-recovery',
        },
        body: bytes,
    });
    if (!upload.ok) throw new Error(`Exercise video upload failed: ${(await upload.text()).slice(0, 240)}`);
}

export default async () => {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Supabase configuration is missing');

    const exerciseIds = RECOVERIES.map(({ exerciseId }) => exerciseId);
    const exercises = await fetchJson(
        `${SUPABASE_URL}/rest/v1/custom_exercises?id=in.(${escapePostgrestIn(exerciseIds)})&user_id=eq.${OWNER_ID}&select=id,video_url`,
        { headers: headers() },
    );
    const pending = RECOVERIES.filter(({ exerciseId }) => !exercises.find(row => row.id === exerciseId)?.video_url);
    if (!pending.length) return new Response(JSON.stringify({ ok: true, recovered: 0, status: 'already_complete' }), { status: 200 });

    const messages = await fetchJson(
        `${SUPABASE_URL}/rest/v1/ig_messages?id=eq.${IG_MESSAGE_ID}&select=text`,
        { headers: headers() },
    );
    const videoUrls = getVideoUrls(messages?.[0]?.text);
    if (videoUrls.length < RECOVERIES.length) throw new Error('The Instagram Graph message no longer contains both recovery videos');

    const account = await getB2Account();
    const recovered = [];
    for (const { exerciseId, videoIndex } of pending) {
        const source = await fetch(videoUrls[videoIndex]);
        const sourceType = String(source.headers.get('content-type') || '').toLowerCase();
        if (!source.ok || !sourceType.startsWith('video/')) {
            throw new Error(`Could not retrieve Instagram video ${videoIndex + 1}`);
        }
        const bytes = await source.arrayBuffer();
        if (!bytes.byteLength) throw new Error(`Instagram video ${videoIndex + 1} was empty`);

        const extension = sourceType.includes('quicktime') ? 'mov' : 'mp4';
        const storagePath = `exercises/${OWNER_ID}/${exerciseId}.${extension}`;
        await uploadToB2(account, storagePath, sourceType, bytes);
        const videoUrl = `${account.downloadUrl}/file/${account.bucketName}/${storagePath}`;
        const updated = await fetchJson(
            `${SUPABASE_URL}/rest/v1/custom_exercises?id=eq.${exerciseId}&user_id=eq.${OWNER_ID}`,
            {
                method: 'PATCH',
                headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
                body: JSON.stringify({ video_url: videoUrl, storage_path: storagePath }),
            },
        );
        if (!updated?.length) throw new Error(`Could not attach video to exercise ${exerciseId}`);
        recovered.push(exerciseId);
    }

    return new Response(JSON.stringify({ ok: true, recovered }), { status: 200 });
};

export const config = { schedule: '* * * * *' };

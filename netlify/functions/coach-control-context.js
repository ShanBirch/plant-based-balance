/**
 * coach-control-context — backing data for the "Control" panel.
 *
 * The Control panel (rendered both as the Android notification's expanded
 * activity AND as an inline expand-card in the admin dashboard) shows
 * Shannon two things he was previously missing at decision-time:
 *
 *   1. The notes we have on this client (client_memory + IG-thread
 *      running_notes / goals / personal_context / etc.) — the same memory
 *      the draft producer is reading from.
 *   2. The last ~20 messages the AI used as conversation history when it
 *      generated the draft, oldest → newest, with sender labels.
 *
 * Auth: same capability-token pattern as send-coach-reply / schedule-
 * coach-reply / cancel-coach-reply. The coach_alert UUID is the cap; we
 * don't expose anything about the alert that wasn't already encoded in
 * the alert itself + reachable to the device that holds the alertId.
 *
 * Request:
 *   POST { alertId: string }
 *
 * Response:
 *   {
 *     ok: true,
 *     clientName, channel: 'in_app' | 'instagram' | 'messenger',
 *     notes: {
 *       goals, communication_style, personal_context, injuries_limits,
 *       running_notes (multi-line plain text)
 *     } | null,
 *     messages: [
 *       { sender: 'client' | 'coach', text, created_at }, ...
 *     ]   // chronological, oldest first, capped at HISTORY_LIMIT
 *   }
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const HISTORY_LIMIT = 20;
const MESSAGE_PREVIEW_CHARS = 4000;

async function supabase(path) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase ${path} -> ${res.status} ${text}`);
    }
    const text = await res.text();
    if (!text || !text.trim()) return [];
    try { return JSON.parse(text); } catch { return []; }
}

function truncate(s, n) {
    if (!s) return '';
    s = String(s);
    return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…';
}

function extractMedia(s) {
    const text = String(s || '');
    const media = [];
    const re = /\[PHOTO:(https?:\/\/[^\s\]]+)\]/gi;
    let match;
    while ((match = re.exec(text)) !== null) {
        media.push({ type: 'photo', url: match[1] });
        if (media.length >= 4) break;
    }
    return media;
}

function stripPhotoMarkers(s) {
    return String(s || '')
        .replace(/\[PHOTO:https?:\/\/[^\s\]]+\]/gi, '📷 photo')
        .replace(/\[video:\s*https?:\/\/[^\]]+\]/gi, '🎥 video');
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured' }) };
    }

    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    const alertId = (body.alertId || '').trim();
    if (!alertId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing alertId' }) };
    }

    // 1. Resolve alert + figure out the channel + identify the conversation
    //    parties.
    let alert;
    try {
        const rows = await supabase(
            `coach_alerts?select=id,client_id,client_name,coach_id,alert_type,data,created_at&id=eq.${alertId}&limit=1`
        );
        alert = rows[0];
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Alert lookup failed', details: e.message }) };
    }
    if (!alert) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Alert not found' }) };
    }

    const data = alert.data || {};
    const channelHint = data.channel === 'instagram' ? 'instagram'
                      : data.channel === 'messenger' ? 'messenger'
                      : 'in_app';

    const clientName = alert.client_name || (channelHint === 'in_app' ? 'Client' : 'Lead');
    const coachId = alert.coach_id;
    const igThreadId = data.ig_thread_id || null;

    // Resolve clientId — prefer the alert column, but fall back to the
    // CURRENT ig_threads.linked_user_id when the alert was written
    // before the link existed. (Real-world: Taylah's IG-side alert from
    // 2026-04-29 has client_id=NULL even though her thread now has
    // linked_user_id set, because the link was stamped after the draft
    // ran. Without this fallback the panel would miss her in-app DMs.)
    let clientId = alert.client_id;
    if (!clientId && igThreadId) {
        try {
            const tRows = await supabase(
                `ig_threads?select=linked_user_id&id=eq.${igThreadId}&limit=1`
            );
            if (tRows[0] && tRows[0].linked_user_id) {
                clientId = tRows[0].linked_user_id;
            }
        } catch (e) { /* non-fatal */ }
    }

    // 2. Notes — prefer in-app client_memory if we can; fall back to the
    //    ig_threads-side memory for cold IG/FB leads with no linked user.
    let notes = null;
    if (coachId && clientId) {
        try {
            const rows = await supabase(
                `client_memory?select=goals,communication_style,personal_context,injuries_limits,running_notes,coach_instructions&coach_id=eq.${coachId}&client_id=eq.${clientId}&limit=1`
            );
            if (rows[0]) notes = rows[0];
        } catch (e) { /* non-fatal */ }
    }
    if (!notes && igThreadId) {
        try {
            const rows = await supabase(
                `ig_threads?select=goals,communication_style,personal_context,injuries_limits,running_notes,coach_instructions&id=eq.${igThreadId}&limit=1`
            );
            if (rows[0]) notes = rows[0];
        } catch (e) { /* non-fatal */ }
    }

    // 3. Messages — pull the last ~20 of whichever channel is canonical,
    //    plus the cross-channel side when there's a link, so Shannon sees
    //    the same union the draft producer does.
    const messages = [];

    // In-app DMs (nudges) when we have both ids.
    if (coachId && clientId) {
        try {
            const rows = await supabase(
                `nudges?select=sender_id,message,created_at&or=(and(sender_id.eq.${coachId},receiver_id.eq.${clientId}),and(sender_id.eq.${clientId},receiver_id.eq.${coachId}))&order=created_at.desc&limit=${HISTORY_LIMIT}`
            );
            // Reverse to chronological + label sender.
            rows.reverse().forEach(r => {
                messages.push({
                    sender: r.sender_id === clientId ? 'client' : 'coach',
                    text: truncate(stripPhotoMarkers(r.message), MESSAGE_PREVIEW_CHARS),
                    media: extractMedia(r.message),
                    created_at: r.created_at,
                    channel: 'in_app',
                });
            });
        } catch (e) { /* non-fatal */ }
    }

    // IG/FB messages when there's a thread (either alert is IG-side, or
    // alert is in-app DM with a linked IG thread we should also surface).
    if (igThreadId) {
        try {
            const rows = await supabase(
                `ig_messages?select=direction,text,created_at&thread_id=eq.${igThreadId}&order=created_at.desc&limit=${HISTORY_LIMIT}`
            );
            rows.reverse().forEach(r => {
                messages.push({
                    sender: r.direction === 'in' ? 'client' : 'coach',
                    text: truncate(stripPhotoMarkers(r.text), MESSAGE_PREVIEW_CHARS),
                    media: extractMedia(r.text),
                    created_at: r.created_at,
                    channel: channelHint === 'in_app' ? 'instagram' : channelHint,
                });
            });
        } catch (e) { /* non-fatal */ }
    }

    // Sort the union chronologically (the two pulls came from different
    // tables; their timestamps mix correctly when re-sorted) and cap so
    // the panel doesn't blow up.
    messages.sort((a, b) => {
        const ta = Date.parse(a.created_at || '') || 0;
        const tb = Date.parse(b.created_at || '') || 0;
        return ta - tb;
    });
    const trimmed = messages.slice(-HISTORY_LIMIT);

    // 5. Voice match stats for THIS client over the last 30 days. Same
    //    math as the dashboard's pill — % of actioned drafts that went
    //    out as Shannon drafted them. Less than 3 samples → not enough
    //    data, return null pct so the Android UI shows a grey "N=X" pill.
    let voiceMatch = null;
    if (coachId && clientId) {
        try {
            const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            const rows = await supabase(
                `coach_alerts?select=status,data&coach_id=eq.${coachId}&client_id=eq.${clientId}&actioned_at=gte.${since}&status=in.(sent,dismissed)`
            );
            const total = rows.length;
            const asDrafted = rows.filter(r => r.status === 'sent' && r.data && r.data.was_edited === false).length;
            voiceMatch = {
                total,
                asDrafted,
                pct: total > 0 ? Math.round((asDrafted / total) * 100) : 0,
                enoughData: total >= 3,
            };
        } catch (e) { /* non-fatal */ }
    }

    // 6. Reasoning — the "why this draft" story Shannon sees when he opens
    //    Control Center. Two sources, in priority order:
    //    a) data.draft_reasoning — generic per-draft reasoning emitted by
    //       the draft generator (phase 2 wires this into all 8 producers).
    //    b) data.qualifier.why_now — quote-grounded justification from the
    //       qualifier engine for cold-lead alerts (live today on every
    //       ig_incoming_dm / fb_incoming_dm with funnel evaluation).
    //    The label tells the UI which source it's reading from so Shannon
    //    can mentally calibrate ("the model decided this" vs "the funnel
    //    timing engine decided this").
    let reasoning = null;
    const draftReasoningRaw = (data.draft_reasoning || '').trim();
    const qualifierWhyRaw = (data.qualifier && data.qualifier.why_now ? data.qualifier.why_now : '').trim();
    if (draftReasoningRaw) {
        reasoning = { text: draftReasoningRaw, source: 'AI reasoning' };
    } else if (qualifierWhyRaw) {
        reasoning = { text: qualifierWhyRaw, source: 'Why ask this now' };
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            ok: true,
            alertId,
            clientName,
            channel: channelHint,
            notes,
            messages: trimmed,
            voiceMatch,
            reasoning,
        }),
    };
};

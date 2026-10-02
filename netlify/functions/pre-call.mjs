import { createHash } from 'node:crypto';
import forms from '../../lib/pre-call-questions.js';

const ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';
const env = name => globalThis.Netlify?.env?.get?.(name) || process.env[name] || '';
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export function validatePayload(payload) {
    if (!payload || typeof payload !== 'object' || !Object.hasOwn(forms, payload.kind)) throw new Error('invalid_form');
    if (payload.consent !== true) throw new Error('consent_required');
    const name = text(payload.name, 120), email = text(payload.email, 254).toLowerCase();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('contact_required');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.submission_id || '')) throw new Error('invalid_submission');
    const answers = {};
    const raw = payload.answers;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('invalid_answers');
    for (const q of forms[payload.kind].questions) {
        const value = raw[q.id];
        if (q.type === 'text') answers[q.id] = text(value, 1800);
        else if (q.type === 'multi') {
            if (value !== undefined && (!Array.isArray(value) || value.some(v => !q.options.includes(v)))) throw new Error('invalid_option');
            answers[q.id] = [...new Set(value || [])];
        } else {
            if (value && !q.options.includes(value)) throw new Error('invalid_option');
            answers[q.id] = value || '';
        }
    }
    return { kind: payload.kind, name, email, answers, submissionId: payload.submission_id };
}

export default async function handler(req, context = {}) {
    const url = env('SUPABASE_URL') || env('VITE_SUPABASE_URL') || 'https://hzapaorxqboevxnumxkv.supabase.co';
    const key = env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_SERVICE_KEY');
    if (!key) return json(503, { error: 'temporarily_unavailable' });
    const db = async (path, init = {}) => {
        const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' } });
        if (!response.ok) throw new Error('storage_failed');
        return response.status === 204 ? [] : response.json();
    };
    try {
        if (req.method === 'GET') {
            const authorization = req.headers.get('authorization') || '';
            if (!/^Bearer .+/.test(authorization)) return json(401, { error: 'sign_in_required' });
            const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: authorization } });
            if (!userResponse.ok) return json(401, { error: 'sign_in_required' });
            const user = await userResponse.json();
            if (user.email?.toLowerCase() !== ADMIN_EMAIL) return json(403, { error: 'forbidden' });
            const rows = await db(`coach_alerts?select=id,client_name,created_at,status,data&coach_id=eq.${encodeURIComponent(user.id)}&data->>source=eq.pre_call_form&order=created_at.desc&limit=100`);
            return json(200, { responses: rows });
        }
        if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
        const origin = req.headers.get('origin');
        if (origin && !['https://plantbased-balance.org', 'https://www.plantbased-balance.org', 'https://future-balance.netlify.app'].includes(origin) && origin !== new URL(req.url).origin) return json(403, { error: 'forbidden' });
        if (!req.headers.get('content-type')?.includes('application/json')) return json(415, { error: 'json_required' });
        const body = await req.text();
        if (body.length > 40000) return json(413, { error: 'too_long' });
        let payload, clean;
        try { payload = JSON.parse(body); if (text(payload.website, 200)) return json(200, { ok: true }); clean = validatePayload(payload); }
        catch (_) { return json(400, { error: 'check_form' }); }
        const coach = (await db(`users?select=id&email=eq.${encodeURIComponent(ADMIN_EMAIL)}&limit=1`))[0];
        if (!coach?.id) throw new Error('coach_not_configured');
        const existing = await db(`coach_alerts?select=id&coach_id=eq.${coach.id}&data->>source=eq.pre_call_form&data->>submission_id=eq.${clean.submissionId}&limit=1`);
        if (existing.length) return json(200, { ok: true });
        const since = encodeURIComponent(new Date(Date.now() - 86400000).toISOString());
        const ip = context.ip || req.headers.get('x-nf-client-connection-ip') || '';
        const ipHash = ip ? createHash('sha256').update(`${key}:${ip}`).digest('hex') : '';
        const recent = await db(`coach_alerts?select=id&coach_id=eq.${coach.id}&data->>source=eq.pre_call_form&data->>contact_email=eq.${encodeURIComponent(clean.email)}&created_at=gte.${since}&limit=5`);
        if (recent.length >= 5) return json(429, { error: 'try_later' });
        if (ipHash) {
            const fromIp = await db(`coach_alerts?select=id&coach_id=eq.${coach.id}&data->>source=eq.pre_call_form&data->>ip_hash=eq.${ipHash}&created_at=gte.${since}&limit=20`);
            if (fromIp.length >= 20) return json(429, { error: 'try_later' });
        }
        const label = clean.kind === 'menopause' ? 'Menopause pre-call' : 'General pre-call';
        const summary = forms[clean.kind].questions.map(q => {
            const answer = clean.answers[q.id];
            return `${q.label}\n${Array.isArray(answer) ? answer.join(', ') || 'Skipped' : answer || 'Skipped'}`;
        }).join('\n\n');
        await db('coach_alerts', { method: 'POST', body: JSON.stringify({
            id: clean.submissionId, coach_id: coach.id, client_id: null, client_name: clean.name,
            alert_type: 'follow_up_review', priority: 'medium', status: 'pending', title: `${label}: ${clean.name}`,
            description: `${clean.email}\n\n${summary}`, suggested_message: null,
            data: { source: 'pre_call_form', form_kind: clean.kind, contact_email: clean.email, answers: clean.answers,
                submission_id: clean.submissionId, ip_hash: ipHash || null, consent_at: new Date().toISOString(), consent_version: 'pre-call-20261002',
                needs_you_required: true, operator_queue: 'needs_you', manual_only: true,
                needs_you_reason: 'Pre-call answers for Shannon to read. No message to send.', follow_up_reason: `${clean.email}\n\n${summary}` }
        }) });
        return json(200, { ok: true });
    } catch (_) {
        // Never log submitted health answers or contact details.
        return json(503, { error: 'temporarily_unavailable' });
    }
}
export const config = { path: '/api/pre-call' };

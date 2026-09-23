import review from '../functions/_lib/messenger-review.js';
import sender from '../functions/send-ig-reply.js';

export default async (request: Request) => {
    const url = Netlify.env.get('SUPABASE_URL') || Netlify.env.get('VITE_SUPABASE_URL');
    const key = Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY') || Netlify.env.get('SUPABASE_SERVICE_KEY');
    if (!url || !key) return new Response('Unavailable', { status: 503 });
    const query = async (path: string, options: { method?: string; body?: unknown } = {}) => {
        const response = await fetch(`${url}/rest/v1/${path}`, {
            method: options.method || 'GET',
            headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });
        if (!response.ok) throw new Error('Review data unavailable');
        return response.json();
    };
    return review.createReviewHandler({ query, send: sender.handler })(request);
};

// Sends a welcome message from the coach to a new user
// Uses service role to bypass RLS (since we're inserting on behalf of the coach)

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://hzapaorxqboevxnumxkv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const COACH_EMAILS = ['shannon@plantbased-balance.org', 'shannonbirch@cocospersonaltraining.com'];

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    if (!SUPABASE_SERVICE_KEY) {
        console.error('Missing Supabase service key');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server configuration error' })
        };
    }

    try {
        const { newUserId, userName } = JSON.parse(event.body);

        if (!newUserId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing newUserId' })
            };
        }

        // Find the coach user ID
        let coachUserId = null;
        for (const email of COACH_EMAILS) {
            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id&limit=1`,
                {
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.ok) {
                const users = await response.json();
                if (users && users.length > 0) {
                    coachUserId = users[0].id;
                    break;
                }
            }
        }

        if (!coachUserId) {
            console.error('Could not find coach user');
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Coach user not found' })
            };
        }

        // Don't send welcome message to the coach themselves
        if (coachUserId === newUserId) {
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'Skipped - user is the coach' })
            };
        }

        const displayName = userName || 'there';
        const welcomeMessage = `Hey ${displayName}! Thanks so much for joining. This app is in beta and I'm constantly updating it, so if you have any advice on what you'd like to see in it, send me a message and I'll see what I can do.`;

        // Insert the welcome nudge from coach to new user (using service role to bypass RLS)
        const insertResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/nudges`,
            {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({
                    sender_id: coachUserId,
                    receiver_id: newUserId,
                    message: welcomeMessage
                })
            }
        );

        if (!insertResponse.ok) {
            const errorText = await insertResponse.text();
            console.error('Failed to insert welcome message:', errorText);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Failed to send welcome message', details: errorText })
            };
        }

        console.log(`Welcome message sent from coach (${coachUserId}) to new user (${newUserId})`);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Welcome message sent successfully' })
        };

    } catch (error) {
        console.error('Error sending welcome message:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to send welcome message', details: error.message })
        };
    }
};

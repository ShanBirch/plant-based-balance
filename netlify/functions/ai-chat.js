const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { message, chatType, chatHistory, userProfile } = JSON.parse(event.body);
    
    if (!process.env.GEMINI_API_KEY) {
      console.error('CRITICAL: GEMINI_API_KEY is missing');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'API Key missing on server' })
      };
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Restoration of the specific model requested
    const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

    // Get current time context
    const now = new Date();
    const serverTime = now.toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' });
    const hour = now.getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    const dayOfWeek = now.toLocaleDateString('en-AU', { weekday: 'long' });

    // Build conversation history context
    const historyContext = chatHistory && chatHistory.length > 0 
      ? `\n\nPREVIOUS CONVERSATION:\n${chatHistory.map(msg => `${msg.sender}: ${msg.text}`).join('\n')}\n`
      : '';

    // Build user profile context
    const profileContext = userProfile 
      ? `\n\nUSER CONTEXT:\n- Name: ${userProfile.name || 'Friend'}\n- Email: ${userProfile.email || 'Not provided'}\n- Protocol: ${userProfile.protocol || 'Not set'}\n- Current Phase: ${userProfile.currentPhase || 'Week 1'}\n`
      : '';

    const coachPrompt = `You are Shannon Birch, a 34-year-old plant-based health coach from Sunshine Coast, Australia. You're texting with a client RIGHT NOW.
Local Time in Aus: ${serverTime} (${dayOfWeek} ${timeOfDay}).

=== YOUR PERSONALITY ===
- Super chill, casual Aussie bloke.
- Use natural Aussie slang/contractions: "mate", "fkin", "gonna", "wanna", "Imma", "Ya know", "prolly", "reckon".
- Natural emojis: 🤙 😅 🤷 💪 🥗
- Real and authentic - prioritize the client but be yourself.
- Sometimes double/triple text (separate your response into 2-3 short blocks vs one long paragraph).

=== CONVERSATION EXAMPLES ===
"ohhh haha maybe maybe!"
"Yeah ok see what is still fat."
"Just people tryna make some $$"
"Like you got the obliques cranking and everything"
"We need to create something exciting for you that really gets you fkin ramped up. Ya know, otherwise it's just going through the dailys."
"I'm sorry mate, you never reach out, I want to be there when you do, but I've had a huge day."

=== CRITICAL: SOUND 100% HUMAN ===
1. **Multiple Messages**: You MUST separate your response into 2-3 SEPARATE segments using double newlines (\\n\\n).
2. **Imperfections**: Occasionally use lowercase at start of sentences, use the occasional typo (like "the" -> "teh"), or trailing dots...
3. **Fillers**: Use "like", "umm", "basically", "honestly" to sound conversational.
4. **Time-aware**: Acknowledge the time if relevant (e.g. "Morning mate" or "Bit late but wanted to reply").
5. **No Robot Talk**: Never say "As an AI..." or "How can I help you today?". Just talk.

=== YOUR KNOWLEDGE ===${profileContext}${historyContext}

=== CURRENT MESSAGE ===
User: ${message}

=== YOUR RESPONSE ===
Respond as Shannon would. Send 2-3 separate segments (separated by \\n\\n). Be casual, imperfect, and 100% human.`;

    const communityPrompt = `You are a supportive community assistant for a plant-based health group. Be encouraging and helpful.${historyContext}

User: ${message}

Response:`;

    const prompt = chatType === 'coach' ? coachPrompt : communityPrompt;
    
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply: response })
    };
    
  } catch (error) {
    console.error('AI Error Detailed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'AI service unavailable' })
    };
  }
};

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
    // Initialize Gemini
    if (!process.env.GEMINI_API_KEY) {
      console.error('CRITICAL: GEMINI_API_KEY is null or undefined in environment');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'API Key missing on server' })
      };
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Use gemini-1.5-flash as the most reliable high-speed model
    const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

    // ... (rest of the prompt logic remains same)

    // Get current time context
    const now = new Date();
    const hour = now.getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    const dayOfWeek = now.toLocaleDateString('en-AU', { weekday: 'long' });

    // Build conversation history context
    const historyContext = chatHistory && chatHistory.length > 0 
      ? `\n\nPREVIOUS CONVERSATION:\n${chatHistory.map(msg => `${msg.sender}: ${msg.text} (${msg.time})`).join('\n')}\n`
      : '';

    // Build user profile context
    const profileContext = userProfile 
      ? `\n\nUSER CONTEXT:\n- Email: ${userProfile.email || 'Not provided'}\n- Protocol: ${userProfile.protocol || 'Not set'}\n- Current Phase: ${userProfile.currentPhase || 'Week 1'}\n- Symptoms: ${userProfile.symptoms || 'Not specified'}\n- Goals: ${userProfile.goals || 'Health optimization'}\n`
      : '';

    const coachPrompt = `You are Shannon Birch, a 34-year-old plant-based health coach from Sunshine Coast, Australia. You're texting with a client RIGHT NOW on ${dayOfWeek} ${timeOfDay}.

=== YOUR PERSONALITY ===
- Super chill, casual Aussie bloke
- Sometimes double/triple text (2-3 short messages vs one long one)
- Use: "mate", "fkin", "gonna", "wanna", "Imma", "Ya know"
- Natural emojis: 🤙 😅 🤷 💪
- Real and authentic - apologize when busy, set boundaries

=== CONVERSATION EXAMPLES ===
"ohhh haha maybe maybe!"
"Yeah ok see what is still fat."
"Just people tryna make some $$"
"Like you got the obliques cranking and everything"
"We need to create something exciting for you that really gets you fkin ramped up. Ya know, otherwise it's just going through the dailys."
"I'm sorry mate, you never reach out, I want to be there when you do, but I've had a huge day."

=== CRITICAL: SOUND 100% HUMAN ===
1. **Multiple Messages**: MUST send 2-3 SEPARATE text bubbles (use \\n\\n to separate)
2. **Imperfections**: Occasionally skip capital, typo (5%), incomplete thought...
3. **Fillers**: "like", "umm", "basically", "honestly"
4. **Time-aware**: Acknowledge if morning ("Morning!"), late ("sorry for late reply")
5. **Casual grammar**: "gonna", "wanna", "prolly", "kinda"
6. **Mix lengths**: One word responses ("Yeah") + longer explanations

=== YOUR KNOWLEDGE ===${profileContext}${historyContext}

=== CURRENT MESSAGE ===
User: ${message}

=== YOUR RESPONSE ===
Respond as Shannon would RIGHT NOW. Send 2-3 separate text messages (separated by \\n\\n). Be casual, imperfect, and 100% human:`;

    const communityPrompt = `You are a supportive AI for a plant-based health community. Be friendly, encouraging, helpful.${historyContext}

User: ${message}

Response:`;

    const prompt = chatType === 'coach' ? coachPrompt : communityPrompt;
    
    const result = await model.generateContent(prompt);
    let response = result.response.text();
    
    // Add occasional typo (5% chance) to make it more human
    if (Math.random() < 0.05 && chatType === 'coach') {
      const typos = { 'the': 'teh', 'you': 'u', 'your': 'ur', 'probably': 'prolly' };
      const typoKeys = Object.keys(typos);
      const randomKey = typoKeys[Math.floor(Math.random() * typoKeys.length)];
      response = response.replace(new RegExp(`\\b${randomKey}\\b`, 'i'), typos[randomKey]);
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply: response })
    };
    
  } catch (error) {
    console.error('AI Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'AI service unavailable' })
    };
  }
};

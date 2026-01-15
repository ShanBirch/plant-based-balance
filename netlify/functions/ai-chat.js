const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { message, chatType } = JSON.parse(event.body);
    
    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Shannon's Coach Personality
    const coachPrompt = `You are Shannon, a super chill Australian plant-based health coach (34, from Sunshine Coast).

CRITICAL COMMUNICATION STYLE:
- Send 2-3 SHORT messages instead of one long one (like texting)
- Be casual AF: "mate", "fkin", "Imma", "Ya know"
- Sometimes ask questions, sometimes just make statements
- Use emojis naturally: 🤷 😅 
- Be real and authentic - apologize when needed, set boundaries
- Mix short punchy messages with occasional longer ones

EXAMPLES OF YOUR STYLE:
"ohhh haha maybe maybe!"
"Yeah ok see what is still fat."
"Just people tryna make some $$"
"We need to create something exciting for you that really gets you fkin ramped up. Ya know, otherwise it's just going through the dailys."
"I'm sorry mate, you never reach out, I want to be there when you do, but I've had a huge day."

RULES:
- NO formal corporate speak
- NO repetitive greetings
- Sound HUMAN with imperfections
- Be motivational but honest
- Short messages, natural flow

User: ${message}

Respond as Shannon would (2-3 separate message bubbles):`;

    const communityPrompt = `You are the AI assistant for a supportive plant-based health community. Be friendly, encouraging, and helpful. Keep responses concise and natural.

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
    console.error('AI Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'AI service unavailable' })
    };
  }
};

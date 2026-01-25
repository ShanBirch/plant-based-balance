
import { Context } from "@netlify/edge-functions";

export default async function (request: Request, context: Context) {
  // Only accept POST
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { description, mealType } = await request.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      console.error("Missing GEMINI_API_KEY");
      return new Response(JSON.stringify({ error: "Server configuration error: Missing API Key" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!description || description.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Please describe what you ate" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Prepare the Gemini API request (text-only, no image)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

    const mealContext = mealType ? `This was their ${mealType}.` : '';

    const systemPrompt = `You are a nutrition analysis AI. A user has described what they ate, and you need to analyze it and provide nutritional information.

USER'S MEAL DESCRIPTION: "${description}"
${mealContext}

INSTRUCTIONS:
1. Identify all food items mentioned in the description
2. Estimate reasonable portion sizes based on typical servings (if not specified)
3. Calculate nutritional values (calories, macros, and key micronutrients)
4. Be realistic - if the description is vague, make reasonable assumptions
5. Provide your confidence level (high if specific portions given, medium if typical, low if very vague)

RESPONSE FORMAT - Return ONLY valid JSON with this exact structure:
{
  "foodItems": [
    {
      "name": "Food item name",
      "portion": "estimated portion size",
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "fiber_g": number
    }
  ],
  "totals": {
    "calories": number,
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number,
    "fiber_g": number
  },
  "micronutrients": {
    "vitamin_c_mg": number,
    "iron_mg": number,
    "calcium_mg": number,
    "potassium_mg": number
  },
  "confidence": "high/medium/low",
  "notes": "Any assumptions made about portions or clarifications"
}

IMPORTANT:
- Return RAW JSON only - no markdown, no code blocks, no backticks
- Keep food item names SHORT (max 30 chars)
- Be realistic with portion sizes - assume typical serving if not specified
- If the user mentions a restaurant or brand, use typical nutritional values for that item
- For home-cooked meals, estimate based on common recipes
- Round numbers to 1 decimal place
- Only include micronutrients if they're significant in the foods present`;

    const payload = {
      contents: [
        {
          parts: [
            {
              text: systemPrompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096,
      }
    };

    console.log("Analyzing meal from text description...");

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error (Status:", geminiResponse.status, "):", errorText);

      let userMessage = "Failed to analyze meal description";
      if (geminiResponse.status === 429) {
        userMessage = "Too many requests. Please try again in a few moments.";
      }

      return new Response(JSON.stringify({
        error: userMessage,
        status: geminiResponse.status,
      }), {
        status: geminiResponse.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiResponse.json();
    console.log("Gemini API response received for text analysis");

    // Extract the text response
    const aiText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText) {
      console.error("No AI text in response. Full response:", JSON.stringify(geminiData));
      return new Response(JSON.stringify({
        error: "Couldn't analyze your meal description. Please try being more specific.",
        geminiResponse: geminiData
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse the JSON response from the AI
    let nutritionData;
    try {
      // Remove markdown code blocks if present
      const cleanedText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      nutritionData = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", aiText);
      console.error("Parse error:", parseError);
      return new Response(JSON.stringify({
        error: "Couldn't process the analysis. Please try again.",
        parseError: parseError.message,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Return the structured nutrition data
    return new Response(JSON.stringify({
      success: true,
      data: nutritionData,
      inputMethod: 'text'
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in analyze-meal-text function:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

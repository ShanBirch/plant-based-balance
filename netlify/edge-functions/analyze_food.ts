
import { Context } from "@netlify/edge-functions";

export default async function (request: Request, context: Context) {
  // Only accept POST
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { imageBase64, mimeType, description } = await request.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      console.error("Missing GEMINI_API_KEY");
      return new Response(JSON.stringify({ error: "Server configuration error: Missing API Key" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Allow either image OR text description
    if (!imageBase64 && !description) {
      return new Response(JSON.stringify({ error: "No image or meal description provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Prepare the Gemini API request
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

    // Build the system prompt - use simple concatenation to avoid template literal issues
    const responseFormat = 'RESPONSE FORMAT - Return ONLY valid JSON with this exact structure:\n' +
      '{\n' +
      '  "foodItems": [\n' +
      '    {\n' +
      '      "name": "Food item name",\n' +
      '      "portion": "estimated portion size",\n' +
      '      "calories": number,\n' +
      '      "protein_g": number,\n' +
      '      "carbs_g": number,\n' +
      '      "fat_g": number,\n' +
      '      "fiber_g": number\n' +
      '    }\n' +
      '  ],\n' +
      '  "totals": {\n' +
      '    "calories": number,\n' +
      '    "protein_g": number,\n' +
      '    "carbs_g": number,\n' +
      '    "fat_g": number,\n' +
      '    "fiber_g": number\n' +
      '  },\n' +
      '  "micronutrients": {\n' +
      '    "vitamin_c_mg": number,\n' +
      '    "iron_mg": number,\n' +
      '    "calcium_mg": number,\n' +
      '    "potassium_mg": number\n' +
      '  },\n' +
      '  "confidence": "high/medium/low",\n' +
      '  "notes": "Any additional observations or caveats about the analysis"\n' +
      '}';

    const importantNotes = 'IMPORTANT:\n' +
      '- Be realistic with portion sizes\n' +
      '- If you are unsure, estimate conservatively and indicate lower confidence\n' +
      '- Round numbers to 1 decimal place\n' +
      '- Only include micronutrients if they are significant in the foods present';

    let systemPrompt = "";
    const isTextOnly = !imageBase64;

    if (isTextOnly) {
      // Text-only prompt
      const mealDesc = description || 'Not provided';
      systemPrompt = 'You are a nutrition analysis AI. Analyze the meal based on the text description provided and estimate nutritional information.\n\n' +
        'USER MEAL DESCRIPTION: ' + mealDesc + '\n\n' +
        'INSTRUCTIONS:\n' +
        '1. Identify all food items mentioned in the description\n' +
        '2. Estimate reasonable portion sizes based on the description (use standard serving sizes if not specified)\n' +
        '3. Calculate nutritional values (calories, macros, and key micronutrients)\n' +
        '4. Provide your confidence level (high/medium/low based on how detailed the description is)\n\n' +
        responseFormat + '\n\n' +
        importantNotes + '\n' +
        '- If the description is vague, use standard serving sizes and set confidence to medium or low';
    } else {
      // Image-based prompt
      let promptStart = 'You are a nutrition analysis AI. Analyze the food in this image and provide detailed nutritional information.';
      if (description && description.trim().length > 0) {
        promptStart = promptStart + '\n\nUSER MEAL DESCRIPTION: ' + description + '\nUse this description to help identify the food items and estimate portions more accurately.';
      }

      systemPrompt = promptStart + '\n\n' +
        'INSTRUCTIONS:\n' +
        '1. Identify all food items visible in the image\n' +
        '2. Estimate portion sizes\n' +
        '3. Calculate nutritional values (calories, macros, and key micronutrients)\n' +
        '4. Provide your confidence level (high/medium/low)\n\n' +
        responseFormat + '\n\n' +
        importantNotes + '\n' +
        '- If the image does not contain food, set confidence to low and explain in notes';
    }

    // Build payload with conditional parts
    const parts: Array<{text?: string; inline_data?: {mime_type: string; data: string}}> = [{ text: systemPrompt }];
    if (imageBase64) {
      parts.push({
        inline_data: {
          mime_type: mimeType || "image/jpeg",
          data: imageBase64
        }
      });
    }

    const payload = {
      contents: [
        {
          parts: parts
        }
      ],
      generationConfig: {
        temperature: 0.3,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    };

    console.log("Sending request to Gemini API for food analysis...");

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

      let userMessage = "Failed to analyze image";
      if (geminiResponse.status === 400) {
        userMessage = "Invalid image format. Please try another photo.";
      } else if (geminiResponse.status === 403) {
        userMessage = "API key error. Please check your Gemini API key is valid and active.";
      } else if (geminiResponse.status === 429) {
        userMessage = "API rate limit exceeded. Please try again in a few moments.";
      }

      return new Response(JSON.stringify({
        error: userMessage,
        status: geminiResponse.status,
        details: errorText
      }), {
        status: geminiResponse.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiResponse.json();
    console.log("Gemini API response received");

    // Extract the text response
    const aiText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText) {
      console.error("No AI text in response. Full response:", JSON.stringify(geminiData));
      return new Response(JSON.stringify({
        error: "The AI couldn't analyze this image. Please try a clearer photo of the food.",
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
        error: "The AI's response couldn't be processed. Retrying might help.",
        parseError: parseError.message,
        rawResponse: aiText.substring(0, 500) // Limit to first 500 chars
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Return the structured nutrition data
    return new Response(JSON.stringify({
      success: true,
      data: nutritionData
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in analyze_food function:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Netlify Edge Function: Analyze Workout Photo
 * Uses Gemini AI to verify workout photos for points eligibility
 */

import type { Context } from "https://edge.netlify.com";

interface AnalyzeWorkoutRequest {
  imageBase64: string;
  mimeType?: string;
  workoutType?: string;  // Optional hint about expected workout type
}

interface WorkoutAnalysisResult {
  isWorkoutPhoto: boolean;
  confidence: 'high' | 'medium' | 'low';
  workoutType: string;
  detectedElements: string[];
  suspiciousIndicators: string[];
  notes: string;
}

export default async (request: Request, context: Context): Promise<Response> => {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers
    });
  }

  try {
    const body: AnalyzeWorkoutRequest = await request.json();
    const { imageBase64, mimeType, workoutType } = body;

    const apiKey = Deno.env.get('GEMINI_API_KEY');

    if (!apiKey) {
      console.error('Missing GEMINI_API_KEY');
      return new Response(JSON.stringify({
        error: 'Server configuration error',
        message: 'AI service unavailable'
      }), {
        status: 500,
        headers
      });
    }

    if (!imageBase64) {
      return new Response(JSON.stringify({
        error: 'No image provided',
        message: 'Please provide an image to analyze'
      }), {
        status: 400,
        headers
      });
    }

    // Prepare Gemini API request
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const systemPrompt = `You are a workout verification AI. Analyze this image to determine if it shows a legitimate workout or exercise activity.

Your task is to verify this is a REAL workout photo taken by the user, not a stock photo, screenshot, or fake.

INSTRUCTIONS:
1. Determine if the image shows workout-related content (gym, exercise, fitness activity, home workout, outdoor exercise)
2. Check for signs this is a real photo taken by the user:
   - Natural lighting/environment
   - Personal items visible
   - Realistic setting
3. Look for workout indicators:
   - Exercise equipment (weights, machines, mats, bands)
   - Workout clothing
   - Exercise poses or movements
   - Gym or fitness environment
   - Sweat or exertion signs
4. Check for suspicious indicators:
   - Stock photo watermarks
   - Professional studio lighting
   - Screenshot artifacts
   - Text overlays
   - AI generation artifacts

RESPONSE FORMAT - Return ONLY valid JSON with this exact structure:
{
  "isWorkoutPhoto": true/false,
  "confidence": "high/medium/low",
  "workoutType": "gym/home/outdoor/yoga/cardio/strength/sports/unknown",
  "detectedElements": ["list", "of", "detected", "workout", "elements"],
  "suspiciousIndicators": ["list", "of", "any", "suspicious", "elements"],
  "notes": "Brief explanation of your assessment"
}

CONFIDENCE LEVELS:
- "high": Clearly a real workout photo with obvious exercise/fitness elements
- "medium": Appears to be workout-related but some elements unclear
- "low": Cannot verify as workout photo, or suspicious indicators present

${workoutType ? `\nUSER INDICATED WORKOUT TYPE: ${workoutType}` : ''}

Be fair but vigilant - real workout selfies should pass, but reject obvious fakes.`;

    const payload = {
      contents: [{
        parts: [
          { text: systemPrompt },
          {
            inline_data: {
              mime_type: mimeType || 'image/jpeg',
              data: imageBase64
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.3,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    };

    console.log('Sending workout photo to Gemini for analysis...');

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errorText);

      let userMessage = 'Failed to analyze workout photo';
      if (geminiResponse.status === 429) {
        userMessage = 'AI service busy. Please try again in a moment.';
      } else if (geminiResponse.status === 400) {
        userMessage = 'Invalid image format. Please try a different photo.';
      }

      return new Response(JSON.stringify({
        error: userMessage,
        status: geminiResponse.status
      }), {
        status: geminiResponse.status,
        headers
      });
    }

    const geminiData = await geminiResponse.json();
    const aiText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText) {
      console.error('No AI text in Gemini response:', JSON.stringify(geminiData));
      return new Response(JSON.stringify({
        error: 'AI could not analyze this image',
        message: 'Please try a clearer photo'
      }), {
        status: 500,
        headers
      });
    }

    // Parse the JSON response
    let analysisData: WorkoutAnalysisResult;
    try {
      const cleanedText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysisData = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', aiText);
      // Return a conservative result on parse failure
      return new Response(JSON.stringify({
        success: true,
        data: {
          isWorkoutPhoto: false,
          confidence: 'low',
          workoutType: 'unknown',
          detectedElements: [],
          suspiciousIndicators: ['Failed to parse AI analysis'],
          notes: 'Could not verify workout photo'
        },
        pointsEligible: false
      }), {
        status: 200,
        headers
      });
    }

    // Determine points eligibility
    const pointsEligible = analysisData.isWorkoutPhoto && analysisData.confidence !== 'low';

    console.log(`Workout analysis complete: isWorkout=${analysisData.isWorkoutPhoto}, confidence=${analysisData.confidence}, eligible=${pointsEligible}`);

    return new Response(JSON.stringify({
      success: true,
      data: analysisData,
      pointsEligible
    }), {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Error in analyze-workout:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers
    });
  }
};

export const config = {
  path: '/api/analyze-workout'
};

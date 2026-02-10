/**
 * Netlify Edge Function: Analyze Workout Photo
 * Uses Gemini AI to verify workout photos for points eligibility
 * Also classifies venue verifiability for activity XP gating
 */

import type { Context } from "https://edge.netlify.com";

interface AnalyzeWorkoutRequest {
  imageBase64: string;
  mimeType?: string;
  workoutType?: string;  // Optional hint about expected workout type
  activityType?: string; // Optional hint for activity logging (boxing, tennis, walking, etc.)
}

interface WorkoutAnalysisResult {
  isWorkoutPhoto: boolean;
  confidence: 'high' | 'medium' | 'low';
  workoutType: string;
  detectedElements: string[];
  suspiciousIndicators: string[];
  notes: string;
  venueType: string;
  venueVerifiable: boolean;
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
    const { imageBase64, mimeType, workoutType, activityType } = body;

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
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

    const systemPrompt = `You are a workout verification AI. Analyze this image to determine if it shows a legitimate workout or exercise activity.

Your task is to verify this is a REAL workout photo taken by the user, not a stock photo, screenshot, or fake.

IMPORTANT - VALID WORKOUT TYPES INCLUDE:
- Traditional gym workouts (weights, machines, cardio equipment)
- Home workouts (bodyweight exercises, resistance bands, dumbbells)
- Yoga and somatic yoga (mat, yoga poses, meditation poses, stretching)
- Pilates and stretching routines
- Outdoor exercise (running, hiking, cycling, sports)
- Meditation and breathwork (if showing yoga mat, meditation cushion, or relaxed poses)
- Dance fitness and movement practices
- Recovery activities (foam rolling, stretching, mobility work)
- Fitness classes (group exercise, bootcamp, spin class, boxing class)
- Sports activities (tennis, basketball, swimming, martial arts, boxing)

A person on a yoga mat in a calm pose IS a valid workout. Meditation and breathwork count as wellness activities.

INSTRUCTIONS:
1. Determine if the image shows workout-related content (gym, exercise, fitness activity, home workout, outdoor exercise, yoga, meditation, stretching, sports, fitness class)
2. Check for signs this is a real photo taken by the user:
   - Natural lighting/environment
   - Personal items visible
   - Realistic setting (including living rooms, bedrooms used for home yoga/workouts)
3. Look for workout indicators:
   - Exercise equipment (weights, machines, mats, bands, yoga blocks, meditation cushions)
   - Workout clothing or comfortable clothing suitable for yoga/meditation
   - Exercise poses, yoga poses, meditation poses, or stretching positions
   - Gym, fitness studio, sports court, pool, or home fitness environment
   - Sweat or signs of physical activity (not required for yoga/meditation)
4. Check for suspicious indicators:
   - Stock photo watermarks
   - Professional studio lighting (normal room lighting is fine)
   - Screenshot artifacts
   - Text overlays
   - AI generation artifacts
5. CRITICALLY: Classify the VENUE VERIFIABILITY - does this photo prove the user was at a recognizable fitness venue?

VENUE VERIFIABILITY RULES:
- VERIFIABLE venues (venueVerifiable = true): Photos showing identifiable fitness infrastructure:
  * Indoor gym with visible equipment (treadmills, weights, machines)
  * Fitness studio or class environment (mirrors, group class setup)
  * Boxing ring or boxing gym
  * Tennis/basketball/squash court
  * Swimming pool
  * Treadmill or indoor cycling bike (even at home)
  * Running track or athletics track
  * Yoga/pilates studio with props
  * Sports facility (climbing wall, martial arts dojo)
  * Spin/cycling studio
- NON-VERIFIABLE venues (venueVerifiable = false): Photos that don't prove exercise happened:
  * Outdoor park, trail, or nature scenery (could be just standing there)
  * Generic street or sidewalk
  * Selfie with no identifiable fitness context
  * Living room with no visible exercise equipment
  * Generic outdoor photo

RESPONSE FORMAT - Return ONLY valid JSON with this exact structure:
{
  "isWorkoutPhoto": true/false,
  "confidence": "high/medium/low",
  "workoutType": "gym/home/outdoor/yoga/meditation/cardio/strength/stretching/sports/fitness_class/unknown",
  "detectedElements": ["list", "of", "detected", "workout", "elements"],
  "suspiciousIndicators": ["list", "of", "any", "suspicious", "elements"],
  "notes": "Brief explanation of your assessment",
  "venueType": "indoor_gym/studio/court/pool/track/treadmill/outdoor_park/street/home/unknown",
  "venueVerifiable": true/false
}

CONFIDENCE LEVELS:
- "high": Clearly a real workout/yoga/meditation photo with obvious fitness/wellness elements
- "medium": Appears to be workout-related but some elements unclear
- "low": Cannot verify as workout photo, or suspicious indicators present

${workoutType ? `\nUSER INDICATED WORKOUT TYPE: ${workoutType}` : ''}
${activityType ? `\nUSER IS LOGGING ACTIVITY TYPE: ${activityType}` : ''}

Be fair and inclusive - yoga selfies, meditation sessions, and stretching routines should pass. Reject obvious fakes.`;

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
          notes: 'Could not verify workout photo',
          venueType: 'unknown',
          venueVerifiable: false
        },
        pointsEligible: false,
        venueVerifiable: false,
        venueType: 'unknown'
      }), {
        status: 200,
        headers
      });
    }

    // Determine points eligibility
    const pointsEligible = analysisData.isWorkoutPhoto && analysisData.confidence !== 'low';
    const venueVerifiable = analysisData.venueVerifiable || false;
    const venueType = analysisData.venueType || 'unknown';

    console.log(`Workout analysis complete: isWorkout=${analysisData.isWorkoutPhoto}, confidence=${analysisData.confidence}, eligible=${pointsEligible}, venueType=${venueType}, venueVerifiable=${venueVerifiable}`);

    return new Response(JSON.stringify({
      success: true,
      data: analysisData,
      pointsEligible,
      venueVerifiable,
      venueType
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

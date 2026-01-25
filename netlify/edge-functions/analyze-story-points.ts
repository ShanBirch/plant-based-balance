/**
 * Netlify Edge Function: Analyze Story for Workout Points
 * Uses Gemini AI to analyze story posts and award points for workout-related content
 */

import type { Context } from "https://edge.netlify.com";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Points configuration for story posts
const STORY_POINTS_CONFIG = {
  POINTS_PER_WORKOUT_STORY: 2, // More points than regular workout log to encourage sharing
};

interface AnalyzeStoryRequest {
  userId: string;
  storyId: string;
  imageBase64?: string;    // Base64 encoded image
  imageUrl?: string;       // Or URL to fetch image from
  mimeType?: string;
}

interface StoryAnalysisResult {
  isWorkoutRelated: boolean;
  confidence: 'high' | 'medium' | 'low';
  workoutType: string;
  detectedElements: string[];
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
    const body: AnalyzeStoryRequest = await request.json();
    const { userId, storyId, imageBase64, imageUrl, mimeType } = body;

    // Validate required fields
    if (!userId || !storyId) {
      return new Response(JSON.stringify({
        error: 'Missing required fields',
        required: ['userId', 'storyId']
      }), {
        status: 400,
        headers
      });
    }

    if (!imageBase64 && !imageUrl) {
      return new Response(JSON.stringify({
        error: 'Must provide either imageBase64 or imageUrl'
      }), {
        status: 400,
        headers
      });
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

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

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if points already awarded for this story
    const { data: existingTransaction } = await supabase
      .from('point_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('reference_id', storyId)
      .eq('reference_type', 'story')
      .single();

    if (existingTransaction) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Points already awarded for this story',
        pointsAwarded: 0
      }), {
        status: 200,
        headers
      });
    }

    // Get image data - either use provided base64 or fetch from URL
    let imageData = imageBase64;
    let imageMimeType = mimeType || 'image/jpeg';

    if (!imageData && imageUrl) {
      try {
        // Handle base64 data URLs
        if (imageUrl.startsWith('data:')) {
          const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            imageMimeType = matches[1];
            imageData = matches[2];
          }
        } else {
          // Fetch from URL
          const imageResponse = await fetch(imageUrl);
          if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image: ${imageResponse.status}`);
          }
          const arrayBuffer = await imageResponse.arrayBuffer();
          imageData = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          imageMimeType = imageResponse.headers.get('content-type') || 'image/jpeg';
        }
      } catch (fetchError) {
        console.error('Error fetching image:', fetchError);
        return new Response(JSON.stringify({
          error: 'Failed to fetch story image',
          message: fetchError instanceof Error ? fetchError.message : 'Unknown error'
        }), {
          status: 400,
          headers
        });
      }
    }

    if (!imageData) {
      return new Response(JSON.stringify({
        error: 'Could not get image data'
      }), {
        status: 400,
        headers
      });
    }

    // Prepare Gemini API request
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const systemPrompt = `You are analyzing a social media story post to determine if it shows workout or exercise activity.

Your task is to determine if this story post is WORKOUT-RELATED. Users earn points for sharing their fitness journey!

WHAT COUNTS AS A WORKOUT STORY:
- Gym selfies or photos
- Home workout photos
- Outdoor exercise (running, cycling, hiking)
- Yoga or stretching sessions
- Sports activities
- Before/after workout photos
- Workout equipment being used
- Fitness class attendance
- Exercise accomplishment screenshots (like completing a run)
- Post-workout photos (sweaty selfie, etc.)

WHAT DOES NOT COUNT:
- Food photos (even if healthy)
- Random selfies without workout context
- Promotional/spam content
- Screenshots of other apps (unless fitness tracking)
- Memes or text-only posts
- Photos of pets, scenery without person exercising

RESPONSE FORMAT - Return ONLY valid JSON with this exact structure:
{
  "isWorkoutRelated": true/false,
  "confidence": "high/medium/low",
  "workoutType": "gym/home/outdoor/yoga/cardio/strength/sports/recovery/unknown",
  "detectedElements": ["list", "of", "detected", "workout", "elements"],
  "notes": "Brief explanation of your assessment"
}

CONFIDENCE LEVELS:
- "high": Clearly shows workout/exercise activity
- "medium": Appears workout-related but some elements unclear
- "low": Uncertain if workout-related, or missing key indicators

Be encouraging but fair - we want to reward people sharing their fitness journey!`;

    const payload = {
      contents: [{
        parts: [
          { text: systemPrompt },
          {
            inline_data: {
              mime_type: imageMimeType,
              data: imageData
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

    console.log(`Analyzing story ${storyId} for workout content...`);

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errorText);

      return new Response(JSON.stringify({
        error: 'Failed to analyze story',
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
        success: true,
        isWorkoutRelated: false,
        pointsAwarded: 0,
        message: 'Could not analyze story content'
      }), {
        status: 200,
        headers
      });
    }

    // Parse the JSON response
    let analysisData: StoryAnalysisResult;
    try {
      const cleanedText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysisData = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', aiText);
      return new Response(JSON.stringify({
        success: true,
        isWorkoutRelated: false,
        pointsAwarded: 0,
        message: 'Could not parse AI analysis'
      }), {
        status: 200,
        headers
      });
    }

    // Determine if points should be awarded
    const shouldAwardPoints = analysisData.isWorkoutRelated && analysisData.confidence !== 'low';

    if (!shouldAwardPoints) {
      console.log(`Story ${storyId} not workout-related or low confidence. No points awarded.`);
      return new Response(JSON.stringify({
        success: true,
        isWorkoutRelated: analysisData.isWorkoutRelated,
        confidence: analysisData.confidence,
        workoutType: analysisData.workoutType,
        pointsAwarded: 0,
        message: analysisData.isWorkoutRelated
          ? 'Workout detected but confidence too low for points'
          : 'Story does not appear to be workout-related'
      }), {
        status: 200,
        headers
      });
    }

    // Award points for workout story
    const pointsToAward = STORY_POINTS_CONFIG.POINTS_PER_WORKOUT_STORY;

    // Get current user points
    const { data: userPoints } = await supabase
      .from('user_points')
      .select('*')
      .eq('user_id', userId)
      .single();

    const newCurrentPoints = (userPoints?.current_points || 0) + pointsToAward;
    const newLifetimePoints = (userPoints?.lifetime_points || 0) + pointsToAward;
    const newTotalStoriesPosted = (userPoints?.total_stories_posted || 0) + 1;

    // Update user points
    const { error: updateError } = await supabase
      .from('user_points')
      .upsert({
        user_id: userId,
        current_points: newCurrentPoints,
        lifetime_points: newLifetimePoints,
        total_stories_posted: newTotalStoriesPosted,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    if (updateError) {
      console.error('Error updating user points:', updateError);
      throw updateError;
    }

    // Log the transaction
    await supabase.from('point_transactions').insert({
      user_id: userId,
      transaction_type: 'earn_story',
      points_amount: pointsToAward,
      reference_id: storyId,
      reference_type: 'story',
      description: `Earned ${pointsToAward} points for workout story (${analysisData.workoutType})`,
      verification_method: 'ai_verified',
      ai_confidence: analysisData.confidence,
    });

    // Update the story to mark it as verified for points
    await supabase
      .from('stories')
      .update({
        points_awarded: pointsToAward,
        workout_verified: true,
        workout_type: analysisData.workoutType
      })
      .eq('id', storyId);

    console.log(`Awarded ${pointsToAward} points to user ${userId} for workout story ${storyId}`);

    return new Response(JSON.stringify({
      success: true,
      isWorkoutRelated: true,
      confidence: analysisData.confidence,
      workoutType: analysisData.workoutType,
      detectedElements: analysisData.detectedElements,
      pointsAwarded: pointsToAward,
      newTotal: newCurrentPoints,
      message: `Great workout post! You earned ${pointsToAward} points!`
    }), {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Error in analyze-story-points:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to analyze story',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers
    });
  }
};

export const config = {
  path: '/api/analyze-story-points'
};

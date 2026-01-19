/**
 * Netlify Edge Function: Verify Photo
 * Validates photo timestamps to ensure real-time capture (anti-cheat)
 */

import type { Context } from "https://edge.netlify.com";

const MAX_PHOTO_AGE_MINUTES = 5;

interface VerifyPhotoRequest {
  fileLastModified?: number;  // File.lastModified from JavaScript
  exifTimestamp?: string;     // EXIF DateTimeOriginal if available
  serverTimestamp?: number;   // When client made the request
}

interface VerifyPhotoResult {
  isValid: boolean;
  ageMinutes: number;
  maxAgeMinutes: number;
  verificationMethod: string;
  photoTimestamp: string;
  message: string;
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
    const body: VerifyPhotoRequest = await request.json();
    const { fileLastModified, exifTimestamp, serverTimestamp } = body;

    const now = Date.now();
    let photoTimestamp = now;
    let verificationMethod = 'none';
    let isValid = false;

    // Priority: EXIF timestamp > File.lastModified > current time
    // EXIF is most reliable as it comes from camera metadata
    if (exifTimestamp) {
      const parsed = new Date(exifTimestamp).getTime();
      if (!isNaN(parsed)) {
        photoTimestamp = parsed;
        verificationMethod = 'exif';
      }
    } else if (fileLastModified && fileLastModified > 0) {
      photoTimestamp = fileLastModified;
      verificationMethod = 'file_modified';
    } else {
      // No timestamp available - could be gallery photo or browser limitation
      verificationMethod = 'no_timestamp';
      // We'll still allow it but flag it
      photoTimestamp = now;
    }

    // Calculate age
    const ageMs = now - photoTimestamp;
    const ageMinutes = ageMs / (1000 * 60);

    // Validation checks
    if (verificationMethod === 'no_timestamp') {
      // Without timestamp, we can't verify - allow but with warning
      isValid = true; // Be lenient for now, can tighten later
    } else if (photoTimestamp > now + 60000) {
      // Photo timestamp is more than 1 minute in the future - suspicious
      isValid = false;
      verificationMethod = 'future_timestamp_rejected';
    } else if (ageMinutes > MAX_PHOTO_AGE_MINUTES) {
      // Photo is too old
      isValid = false;
    } else if (ageMinutes < -1) {
      // Photo appears to be from the future (negative age beyond tolerance)
      isValid = false;
      verificationMethod = 'invalid_timestamp';
    } else {
      // Photo is within acceptable time window
      isValid = true;
    }

    // Generate user-friendly message
    let message = '';
    if (isValid) {
      if (verificationMethod === 'no_timestamp') {
        message = 'Photo accepted (timestamp unavailable)';
      } else {
        message = 'Photo verified as recent';
      }
    } else {
      if (verificationMethod === 'future_timestamp_rejected' || verificationMethod === 'invalid_timestamp') {
        message = 'Photo timestamp appears invalid. Please take a new photo.';
      } else {
        message = `Photo appears to be ${Math.round(ageMinutes)} minutes old. Please take a fresh photo within ${MAX_PHOTO_AGE_MINUTES} minutes.`;
      }
    }

    const result: VerifyPhotoResult = {
      isValid,
      ageMinutes: Math.round(ageMinutes * 10) / 10,
      maxAgeMinutes: MAX_PHOTO_AGE_MINUTES,
      verificationMethod,
      photoTimestamp: new Date(photoTimestamp).toISOString(),
      message
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Error in verify-photo:', error);
    return new Response(JSON.stringify({
      isValid: false,
      ageMinutes: 0,
      maxAgeMinutes: MAX_PHOTO_AGE_MINUTES,
      verificationMethod: 'error',
      photoTimestamp: new Date().toISOString(),
      message: 'Verification failed - please try again'
    }), {
      status: 200, // Return 200 so client can handle gracefully
      headers
    });
  }
};

export const config = {
  path: '/api/verify-photo'
};

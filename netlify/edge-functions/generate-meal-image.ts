
import type { Context } from "https://edge.netlify.com";

/**
 * Generate a single meal photo using Gemini Imagen and upload to Backblaze B2.
 * Returns the permanent B2 URL so it only needs to be generated once.
 *
 * POST body: {
 *   mealName: string,
 *   mealDescription: string,
 *   userId: string,
 *   planId: string,
 *   mealId: string
 * }
 * Returns: { success, imageUrl }
 */

export default async function (request: Request, context: Context) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { mealName, mealDescription, userId, planId, mealId } = await request.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey || !mealName) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Generate image with Gemini Imagen 3
    const imagePrompt = `Professional food photography of "${mealName}": ${mealDescription || mealName}. Plant-based vegan meal, beautifully plated on a ceramic dish, natural soft lighting, overhead angle, clean kitchen background, appetizing vibrant colors, high resolution food blog style photo.`;

    let imageBase64: string | null = null;
    let mimeType = 'image/png';

    // Try Imagen 3 first
    try {
      const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
      const imgResponse = await fetch(imagenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt: imagePrompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: "16:9",
            safetyFilterLevel: "BLOCK_MEDIUM_AND_ABOVE",
          }
        })
      });

      if (imgResponse.ok) {
        const imgData = await imgResponse.json();
        imageBase64 = imgData.predictions?.[0]?.bytesBase64Encoded || null;
      }
    } catch (e) {
      console.warn("Imagen 3 failed, trying fallback:", e);
    }

    // Fallback: Gemini 2.0 Flash with image generation
    if (!imageBase64) {
      try {
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
        const fallbackResponse = await fetch(fallbackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Generate a professional food photo of this vegan meal: ${imagePrompt}` }] }],
            generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
          })
        });

        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          const parts = fallbackData.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.inlineData) {
              imageBase64 = part.inlineData.data;
              mimeType = part.inlineData.mimeType || 'image/png';
              break;
            }
          }
        }
      } catch (e) {
        console.warn("Gemini image fallback also failed:", e);
      }
    }

    if (!imageBase64) {
      return new Response(JSON.stringify({
        success: false,
        error: "Could not generate image"
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Upload to Backblaze B2
    const B2_KEY_ID = Deno.env.get("B2_KEY_ID");
    const B2_APPLICATION_KEY = Deno.env.get("B2_APPLICATION_KEY");
    const B2_BUCKET_ID = Deno.env.get("B2_BUCKET_ID");
    const B2_BUCKET_NAME = Deno.env.get("B2_BUCKET_NAME");

    let permanentUrl = '';

    if (B2_KEY_ID && B2_APPLICATION_KEY && B2_BUCKET_ID && B2_BUCKET_NAME) {
      try {
        // 1. Authorize with B2
        const authResponse = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
          method: 'GET',
          headers: {
            'Authorization': 'Basic ' + btoa(`${B2_KEY_ID}:${B2_APPLICATION_KEY}`)
          }
        });

        if (!authResponse.ok) throw new Error('B2 auth failed');
        const authData = await authResponse.json();

        // 2. Get upload URL
        const uploadUrlResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_get_upload_url`, {
          method: 'POST',
          headers: {
            'Authorization': authData.authorizationToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ bucketId: B2_BUCKET_ID })
        });

        if (!uploadUrlResponse.ok) throw new Error('B2 upload URL failed');
        const { uploadUrl, authorizationToken: uploadToken } = await uploadUrlResponse.json();

        // 3. Decode base64 to binary
        const binaryStr = atob(imageBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
        const timestamp = Date.now();
        const fileName = `ai-meal-photos/${userId || 'anon'}/${planId || 'plan'}/${mealId || timestamp}.${ext}`;

        // Calculate SHA1
        const hashBuffer = await crypto.subtle.digest('SHA-1', bytes.buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const sha1Hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // 4. Upload
        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': uploadToken,
            'X-Bz-File-Name': encodeURIComponent(fileName),
            'Content-Type': mimeType,
            'Content-Length': bytes.byteLength.toString(),
            'X-Bz-Content-Sha1': sha1Hash,
          },
          body: bytes.buffer
        });

        if (uploadResponse.ok) {
          permanentUrl = `${authData.downloadUrl}/file/${B2_BUCKET_NAME}/${fileName}`;
        } else {
          console.warn('B2 upload failed:', await uploadResponse.text());
        }
      } catch (b2Err) {
        console.warn('B2 upload error:', b2Err);
      }
    }

    // If B2 failed, return as data URI (will still display but won't persist across sessions efficiently)
    if (!permanentUrl) {
      permanentUrl = `data:${mimeType};base64,${imageBase64}`;
    }

    return new Response(JSON.stringify({
      success: true,
      imageUrl: permanentUrl,
      mealId: mealId
    }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in generate-meal-image:", error);
    return new Response(JSON.stringify({
      error: "Failed to generate meal image",
      details: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

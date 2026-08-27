import type { Context } from "https://edge.netlify.com";

const JSON_HEADERS = { "Content-Type": "application/json" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function authenticate(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!/^Bearer\s+\S+$/i.test(authorization) || !supabaseUrl || !supabaseKey) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseKey, authorization },
  });
  return response.ok ? response.json() : null;
}

async function userOwnsMeal(userId: string, planId: string, mealId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return false;
  const headers = { apikey: serviceKey, authorization: `Bearer ${serviceKey}` };
  const planResponse = await fetch(
    `${supabaseUrl}/rest/v1/ai_generated_meal_plans?id=eq.${encodeURIComponent(planId)}&user_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`,
    { headers }
  );
  if (!planResponse.ok || !(await planResponse.json())?.length) return false;
  const mealResponse = await fetch(
    `${supabaseUrl}/rest/v1/ai_generated_meals?id=eq.${encodeURIComponent(mealId)}&plan_id=eq.${encodeURIComponent(planId)}&select=id&limit=1`,
    { headers }
  );
  return mealResponse.ok && !!(await mealResponse.json())?.length;
}

function ingredientList(value: unknown) {
  return (Array.isArray(value) ? value : []).slice(0, 20).map(item => {
    if (typeof item === "string") return item.trim();
    if (!item || typeof item !== "object") return "";
    const ingredient = item as { name?: unknown; amount?: unknown };
    return `${String(ingredient.name || "").trim()} ${String(ingredient.amount || "").trim()}`.trim();
  }).filter(Boolean).join(", ").slice(0, 1200);
}

async function generateImage(apiKey: string, prompt: string) {
  const models = ["gemini-3.1-flash-image", "gemini-2.5-flash-image"];
  let lastError = "";
  for (const model of models) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["IMAGE"]
          }
        })
      }
    );
    if (!response.ok) {
      lastError = `${model}: ${response.status} ${(await response.text()).slice(0, 200)}`;
      continue;
    }
    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const image = parts.find((part: { inlineData?: { data?: string } }) => part.inlineData?.data)?.inlineData;
    if (image?.data) return { base64: image.data, mimeType: image.mimeType || "image/png", model };
    lastError = `${model}: response contained no image`;
  }
  throw new Error(lastError || "Image generation returned no image");
}

async function uploadToB2(bytes: Uint8Array, mimeType: string, fileName: string) {
  const keyId = Deno.env.get("B2_KEY_ID");
  const applicationKey = Deno.env.get("B2_APPLICATION_KEY");
  const bucketId = Deno.env.get("B2_BUCKET_ID");
  const bucketName = Deno.env.get("B2_BUCKET_NAME");
  if (!keyId || !applicationKey || !bucketId || !bucketName) {
    throw new Error("Meal photo storage is not configured");
  }

  const authResponse = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
    headers: { authorization: `Basic ${btoa(`${keyId}:${applicationKey}`)}` },
  });
  if (!authResponse.ok) throw new Error("Meal photo storage authorization failed");
  const auth = await authResponse.json();
  const uploadUrlResponse = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: "POST",
    headers: { authorization: auth.authorizationToken, "Content-Type": "application/json" },
    body: JSON.stringify({ bucketId }),
  });
  if (!uploadUrlResponse.ok) throw new Error("Meal photo storage upload URL failed");
  const upload = await uploadUrlResponse.json();

  const payload = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(payload).set(bytes);
  const hashBuffer = await crypto.subtle.digest("SHA-1", payload);
  const sha1 = Array.from(new Uint8Array(hashBuffer)).map(byte => byte.toString(16).padStart(2, "0")).join("");
  const uploadResponse = await fetch(upload.uploadUrl, {
    method: "POST",
    headers: {
      authorization: upload.authorizationToken,
      "X-Bz-File-Name": encodeURIComponent(fileName),
      "Content-Type": mimeType,
      "Content-Length": String(bytes.byteLength),
      "X-Bz-Content-Sha1": sha1,
    },
    body: payload,
  });
  if (!uploadResponse.ok) throw new Error(`Meal photo upload failed (${uploadResponse.status})`);
  return `${auth.downloadUrl}/file/${bucketName}/${fileName}`;
}

export default async function (request: Request, _context: Context) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let failureStage = "request";
  try {
    failureStage = "authentication";
    const user = await authenticate(request);
    if (!user?.id) return json({ error: "Unauthorized" }, 401);

    const body = await request.json();
    const mealName = String(body.mealName || "").trim().slice(0, 180);
    const mealDescription = String(body.mealDescription || "").trim().slice(0, 500);
    const planId = String(body.planId || "").trim();
    const mealId = String(body.mealId || "").trim();
    if (!mealName || !UUID.test(planId) || !UUID.test(mealId) || body.userId !== user.id) {
      return json({ error: "Invalid meal photo request" }, 400);
    }
    failureStage = "ownership";
    if (!(await userOwnsMeal(user.id, planId, mealId))) return json({ error: "Forbidden", stage: failureStage }, 403);

    const apiKey = Deno.env.get("GEMINI_API_KEY") || "";
    if (!apiKey) return json({ error: "Meal photo generation is not configured" }, 500);
    const ingredients = ingredientList(body.ingredients);
    const prompt = `Create one photorealistic food photograph of the exact prepared meal named "${mealName}".
Meal description: ${mealDescription || mealName}.
Ingredients that must be visually represented where visible: ${ingredients || "use only ingredients implied by the meal name and description"}.
Show the finished meal as one realistic serving on a ceramic plate or bowl. Match the named cuisine, cooking method, key ingredients, sides, and presentation precisely. Do not substitute a different dish and do not add unrelated foods. Natural soft window light, appetizing editorial food photography, slightly overhead three-quarter camera angle, food filling the frame. No people, packaging, logos, labels, text, watermark, collage, or duplicate plate.`;

    failureStage = "image_generation";
    const image = await generateImage(apiKey, prompt);
    const binary = atob(image.base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const extension = image.mimeType.includes("jpeg") || image.mimeType.includes("jpg") ? "jpg" : "png";
    const fileName = `ai-meal-photos/${user.id}/${planId}/${mealId}.${extension}`;
    failureStage = "photo_storage";
    const imageUrl = await uploadToB2(bytes, image.mimeType, fileName);

    return json({ success: true, imageUrl, mealId, model: image.model });
  } catch (error) {
    console.error("generate-meal-image failed:", error);
    return json({ error: "Failed to create the matching meal photo", stage: failureStage }, 500);
  }
}

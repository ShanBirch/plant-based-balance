/**
 * Shared Gemini/Gemma model routing for Netlify Edge Functions.
 *
 * Gemma 4 is tried first for low-risk workloads to keep token spend close to
 * zero. Flash-Lite / Flash remain as reliability fallbacks. Pro models are
 * excluded unless explicitly enabled.
 */

const DEFAULT_CHAINS = {
  admin: ["gemma-4-26b-a4b-it", "gemma-4-31b-it", "gemini-2.5-flash-lite", "gemini-2.5-flash"],
  admin_pro: ["gemini-3.1-pro-preview", "gemini-2.5-pro", "gemini-2.5-flash"],
  food_text: ["gemma-4-26b-a4b-it", "gemini-2.5-flash-lite", "gemini-2.5-flash"],
  food_vision: ["gemma-4-26b-a4b-it", "gemma-4-31b-it", "gemini-2.5-flash-lite", "gemini-2.5-flash"],
  workout_vision: ["gemma-4-26b-a4b-it", "gemini-2.5-flash-lite", "gemini-2.5-flash"],
  story_vision: ["gemma-4-26b-a4b-it", "gemini-2.5-flash-lite", "gemini-2.5-flash"],
  meal_plan: ["gemma-4-26b-a4b-it", "gemini-2.5-flash-lite", "gemini-2.5-flash"],
  general_chat: ["gemma-4-26b-a4b-it", "gemini-2.5-flash-lite", "gemini-2.5-flash"],
  sales_chat: ["gemma-4-26b-a4b-it", "gemini-2.5-flash-lite", "gemini-2.5-flash"],
};

const PROFILE_ENV = {
  admin: "BALANCE_AI_ADMIN_MODELS",
  admin_pro: "BALANCE_AI_ADMIN_PRO_MODELS",
  food_text: "BALANCE_AI_FOOD_TEXT_MODELS",
  food_vision: "BALANCE_AI_FOOD_VISION_MODELS",
  workout_vision: "BALANCE_AI_WORKOUT_VISION_MODELS",
  story_vision: "BALANCE_AI_STORY_VISION_MODELS",
  meal_plan: "BALANCE_AI_MEAL_PLAN_MODELS",
  general_chat: "BALANCE_AI_GENERAL_CHAT_MODELS",
  sales_chat: "BALANCE_AI_SALES_CHAT_MODELS",
};

function splitModels(value) {
  return String(value || "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
}

function envFlag(name, fallback = false) {
  const raw = Deno.env.get(name);
  if (raw == null || raw === "") return fallback;
  return /^(1|true|yes|on)$/i.test(String(raw).trim());
}

function allowProModels() {
  return envFlag("BALANCE_AI_ALLOW_PRO", false);
}

export function getGeminiModelChain(profile = "general_chat") {
  const override = splitModels(Deno.env.get(PROFILE_ENV[profile] || ""));
  const base = override.length ? override : (DEFAULT_CHAINS[profile] || DEFAULT_CHAINS.general_chat);
  if (allowProModels() || profile === "admin_pro") return base;
  return base.filter((model) => !/\bpro\b/i.test(model));
}

export function getPrimaryGeminiModel(profile = "general_chat") {
  return getGeminiModelChain(profile)[0] || "gemini-2.5-flash-lite";
}

function shouldTryFallback(status, model, bodyText = "") {
  if (status === 429 || status >= 500 || status === 404) return true;
  if (String(model || "").startsWith("gemma-") && (status === 400 || status === 403)) return true;
  return /RESOURCE_EXHAUSTED|not found|not supported|not available|quota|rate limit/i.test(bodyText);
}

export async function callGeminiModel({ apiKey, model, payload, timeoutMs = 25_000 }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (!response.ok) {
      const err = new Error(data?.error?.message || `Gemini ${response.status}`);
      err.status = response.status;
      err.body = text;
      err.model = model;
      throw err;
    }
    return { data, model };
  } finally {
    clearTimeout(timeout);
  }
}

export async function callGeminiModelChain({
  apiKey,
  profile = "general_chat",
  models = null,
  payload,
  timeoutMs = 25_000,
  label = profile,
}) {
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  const chain = Array.isArray(models) && models.length ? models : getGeminiModelChain(profile);
  let lastErr = null;
  for (const model of chain) {
    try {
      const result = await callGeminiModel({ apiKey, model, payload, timeoutMs });
      console.log(`[ai-router:${label}] used ${model}`);
      return result;
    } catch (err) {
      lastErr = err;
      const status = err.status || 0;
      const body = err.body || err.message || "";
      console.warn(`[ai-router:${label}] ${model} failed (${status || err.name || "error"}): ${String(body).slice(0, 240)}`);
      if (!shouldTryFallback(status, model, body)) throw err;
    }
  }
  throw lastErr || new Error(`No models configured for ${profile}`);
}

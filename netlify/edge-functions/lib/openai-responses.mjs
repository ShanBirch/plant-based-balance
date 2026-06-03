const DEFAULT_OPENAI_MODEL_CHAINS = {
  coach_fallback: ['gpt-5.4-mini'],
  nutrition: ['gpt-5.4-mini'],
  vision: ['gpt-5.4-mini'],
  default: ['gpt-5.4-mini'],
};

const OPENAI_PRICE_PER_MILLION_TOKENS = {
  'gpt-5.4-mini': { input: 0.75, cachedInput: 0.075, output: 4.50 },
  'gpt-5.4-nano': { input: 0.20, cachedInput: 0.02, output: 1.25 },
};

function env(name) {
  try {
    return Deno.env.get(name);
  } catch {
    return '';
  }
}

function envFlagEnabled(value) {
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(String(value || '').trim().toLowerCase());
}

export function shouldUseOpenAIPrimary() {
  const provider = String(env('AI_PROVIDER') || env('MODEL_PROVIDER') || '').trim().toLowerCase();
  return provider === 'openai'
    || envFlagEnabled(env('GEMINI_DISABLED'))
    || envFlagEnabled(env('GOOGLE_AI_DISABLED'));
}

function parseModelChain(value) {
  return String(value || '')
    .split(',')
    .map(model => model.trim())
    .filter(Boolean);
}

function envKeyForProfile(profile) {
  return `OPENAI_MODEL_CHAIN_${String(profile || 'default').toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
}

function resolveOpenAIModelChain(profile = 'default', models) {
  if (Array.isArray(models) && models.length) return models.map(String).map(s => s.trim()).filter(Boolean);
  const profileEnv = parseModelChain(env(envKeyForProfile(profile)));
  if (profileEnv.length) return profileEnv;
  const globalEnv = parseModelChain(env('OPENAI_MODEL_CHAIN'));
  if (globalEnv.length) return globalEnv;
  return DEFAULT_OPENAI_MODEL_CHAINS[profile] || DEFAULT_OPENAI_MODEL_CHAINS.default;
}

function geminiRoleToOpenAIRole(role) {
  return role === 'model' || role === 'assistant' ? 'assistant' : 'user';
}

function contentPartFromGeminiPart(part, role) {
  if (!part || typeof part !== 'object') return null;
  if (typeof part.text === 'string' && part.text) {
    return { type: role === 'assistant' ? 'output_text' : 'input_text', text: part.text };
  }
  const inline = part.inline_data || part.inlineData;
  if (inline?.data) {
    const mimeType = inline.mime_type || inline.mimeType || 'image/jpeg';
    if (String(mimeType).startsWith('image/')) {
      return { type: 'input_image', image_url: `data:${mimeType};base64,${inline.data}` };
    }
    return { type: 'input_text', text: `[${mimeType || 'media'} attachment included. If you cannot inspect it, say Shannon needs to check it manually.]` };
  }
  return null;
}

function convertGeminiContentsToOpenAIInput(contents) {
  return (Array.isArray(contents) ? contents : [])
    .map(item => {
      const role = geminiRoleToOpenAIRole(item?.role);
      const content = (Array.isArray(item?.parts) ? item.parts : [])
        .map(part => contentPartFromGeminiPart(part, role))
        .filter(Boolean);
      if (!content.length) return null;
      return { role, content };
    })
    .filter(Boolean);
}

function extractOpenAIText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text;
  const chunks = [];
  for (const item of data?.output || []) {
    for (const part of item?.content || []) {
      if (typeof part?.text === 'string') chunks.push(part.text);
      if (typeof part?.output_text === 'string') chunks.push(part.output_text);
    }
  }
  return chunks.join('');
}

function toGeminiCompat(data) {
  return {
    candidates: [{
      content: { parts: [{ text: extractOpenAIText(data) }] },
      finishReason: 'STOP',
    }],
    usageMetadata: {
      promptTokenCount: data?.usage?.input_tokens || null,
      candidatesTokenCount: data?.usage?.output_tokens || null,
      totalTokenCount: data?.usage?.total_tokens || null,
    },
    raw: data,
  };
}

function usageNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function summarizeInput(input) {
  const summary = { imageCount: 0, textChars: 0 };
  for (const item of Array.isArray(input) ? input : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (part?.type === 'input_image') summary.imageCount += 1;
      if ((part?.type === 'input_text' || part?.type === 'output_text') && typeof part.text === 'string') {
        summary.textChars += part.text.length;
      }
    }
  }
  return summary;
}

function estimateCostUsd({ model, inputTokens, cachedInputTokens, outputTokens }) {
  const pricing = OPENAI_PRICE_PER_MILLION_TOKENS[model];
  if (!pricing) return { estimatedCostUsd: null, pricing: {} };
  const cached = Math.min(usageNumber(cachedInputTokens), usageNumber(inputTokens));
  const billableInput = Math.max(0, usageNumber(inputTokens) - cached);
  const output = usageNumber(outputTokens);
  const estimatedCostUsd = (
    (billableInput * pricing.input)
    + (cached * pricing.cachedInput)
    + (output * pricing.output)
  ) / 1000000;
  return {
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(8)),
    pricing: {
      currency: 'usd',
      per: '1m_tokens',
      input: pricing.input,
      cached_input: pricing.cachedInput,
      output: pricing.output,
    },
  };
}

async function logUsageEvent({ model, profile, label, input, data }) {
  const supabaseUrl = env('SUPABASE_URL') || env('VITE_SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_SERVICE_KEY');
  if (!supabaseUrl || !serviceKey) return;

  const usage = data?.usage || {};
  const inputTokens = usageNumber(usage.input_tokens);
  const outputTokens = usageNumber(usage.output_tokens);
  const totalTokens = usageNumber(usage.total_tokens) || inputTokens + outputTokens;
  const cachedInputTokens = usageNumber(
    usage.input_tokens_details?.cached_tokens
    || usage.prompt_tokens_details?.cached_tokens
  );
  const inputSummary = summarizeInput(input);
  const { estimatedCostUsd, pricing } = estimateCostUsd({
    model,
    inputTokens,
    cachedInputTokens,
    outputTokens,
  });

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/ai_usage_events`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        provider: 'openai',
        api_surface: 'responses',
        source: 'netlify-edge',
        label: label || null,
        profile: profile || null,
        model,
        input_tokens: inputTokens,
        cached_input_tokens: cachedInputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        input_image_count: inputSummary.imageCount,
        input_text_chars: inputSummary.textChars,
        estimated_cost_usd: estimatedCostUsd,
        pricing,
        response_id: data?.id || null,
        metadata: {
          object: data?.object || null,
        },
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      console.warn(`[ai-usage] insert failed: ${response.status} ${text.slice(0, 240)}`);
    }
  } catch (err) {
    console.warn(`[ai-usage] insert failed: ${err.message}`);
  }
}

export async function callOpenAIGeminiCompat(payload, { profile = 'default', label = 'openai-edge', models } = {}) {
  const apiKey = env('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
  const input = convertGeminiContentsToOpenAIInput(payload?.contents);
  if (!input.length) throw new Error(`${label}: empty OpenAI input`);
  const generationConfig = payload?.generationConfig || {};
  const maxOutputTokens = Number(generationConfig.maxOutputTokens || generationConfig.max_output_tokens);
  let lastError = null;
  for (const model of resolveOpenAIModelChain(profile, models)) {
    const body = { model, input };
    if (Number.isFinite(maxOutputTokens) && maxOutputTokens > 0) body.max_output_tokens = Math.floor(maxOutputTokens);
    if (generationConfig.temperature != null) body.temperature = generationConfig.temperature;

    let response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    let data = await response.json().catch(async () => ({ error: { message: await response.text() } }));
    const message = data?.error?.message || '';
    if (!response.ok && body.temperature != null && /temperature|unsupported parameter|unknown parameter/i.test(message)) {
      const retryBody = { ...body };
      delete retryBody.temperature;
      response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(retryBody),
      });
      data = await response.json().catch(async () => ({ error: { message: await response.text() } }));
    }
    if (response.ok) {
      await logUsageEvent({ model, profile, label, input, data });
      console.log(`[${label}] OpenAI success with ${model}`);
      return { data: toGeminiCompat(data), model };
    }
    lastError = new Error(`${label} ${model} failed: ${response.status} ${data?.error?.message || JSON.stringify(data).slice(0, 300)}`);
    console.warn(lastError.message);
  }
  throw lastError || new Error(`${label}: no OpenAI models configured`);
}

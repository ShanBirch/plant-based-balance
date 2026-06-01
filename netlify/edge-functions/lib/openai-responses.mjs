const DEFAULT_OPENAI_MODEL_CHAINS = {
  coach_fallback: ['gpt-5.4-mini'],
  nutrition: ['gpt-5.4-mini'],
  vision: ['gpt-5.4-mini'],
  default: ['gpt-5.4-mini'],
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
      console.log(`[${label}] OpenAI success with ${model}`);
      return { data: toGeminiCompat(data), model };
    }
    lastError = new Error(`${label} ${model} failed: ${response.status} ${data?.error?.message || JSON.stringify(data).slice(0, 300)}`);
    console.warn(lastError.message);
  }
  throw lastError || new Error(`${label}: no OpenAI models configured`);
}

function stripJsonFences(value) {
  return String(value || "")
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

function extractFirstJsonObject(value) {
  const text = String(value || "");
  const start = text.indexOf("{");
  if (start < 0) return "";

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return text.slice(start).trim();
}

function normalizeJsonQuotes(value) {
  return String(value || "")
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/[\u2018\u2019]/g, "'");
}

function repairCommonModelJson(value) {
  let text = normalizeJsonQuotes(stripJsonFences(value));

  // Gemini occasionally omits a comma between adjacent object properties:
  // "fiber_g": 7
  // "totals": {...}
  text = text
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/("(?:\\.|[^"\\])*"|[-+]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)(\s+)(?="[^"\\]*(?:\\.[^"\\]*)*"\s*:)/g, "$1,$2")
    .replace(/([}\]])(\s+)(?="[^"\\]*(?:\\.[^"\\]*)*"\s*:)/g, "$1,$2")
    .replace(/}\s*{/g, "},{");

  return text;
}

function uniqueCandidates(candidates) {
  const seen = new Set();
  return candidates
    .map(candidate => String(candidate || "").trim())
    .filter(candidate => {
      if (!candidate || seen.has(candidate)) return false;
      seen.add(candidate);
      return true;
    });
}

export function parseModelJsonObject(rawText, label = "model-json") {
  const cleaned = stripJsonFences(rawText);
  const extracted = extractFirstJsonObject(cleaned);
  const repairedCleaned = repairCommonModelJson(cleaned);
  const repairedExtracted = repairCommonModelJson(extracted);
  const candidates = uniqueCandidates([
    cleaned,
    extracted,
    repairedCleaned,
    repairedExtracted,
    extractFirstJsonObject(repairedCleaned),
  ]);

  let lastError = null;
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      lastError = error;
    }
  }

  const message = lastError?.message || "unknown parse error";
  throw new Error(`${label} parse failed: ${message}`);
}

export const __test = {
  stripJsonFences,
  extractFirstJsonObject,
  repairCommonModelJson,
};


import type { Context } from "https://edge.netlify.com";

// ============================================================
// Admin AI Coach — Shannon's behind-the-scenes assistant.
//
// Runs Gemini with function calling so the model can:
//   - Read source files from the GitHub repo (public, no auth needed)
//   - List directories / search the repo tree
//   - Run read-only SQL against Supabase
//   - Describe table schemas
//
// Defaults to Flash-class models for cost control. Set
// ADMIN_AI_COACH_ALLOW_PRO=true or ADMIN_AI_COACH_MODEL_CHAIN to opt into Pro.
// ============================================================

const REPO_OWNER = "ShanBirch";
const REPO_NAME = "plant-based-balance";
const REPO_BRANCH = "main";

// Default lean chain. The Pro chain is opt-in only.
const LEAN_MODEL_CHAIN = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];
const PRO_MODEL_CHAIN = [
  "gemini-3-pro-preview",
  "gemini-3-pro",
  "gemini-2.5-pro",
];
const CONFIGURED_MODEL_CHAIN = parseConfiguredModelChain(getEnv("ADMIN_AI_COACH_MODEL_CHAIN"));
// Try models in order: first one that responds is sticky for the rest of this request.
const MODEL_CHAIN = CONFIGURED_MODEL_CHAIN.length
  ? CONFIGURED_MODEL_CHAIN
  : getEnv("ADMIN_AI_COACH_ALLOW_PRO") === "true"
    ? PRO_MODEL_CHAIN
    : LEAN_MODEL_CHAIN;
const MAX_TOOL_ITERATIONS = 10;
const MAX_FILE_BYTES = 80_000;
const MAX_SQL_RESULT_BYTES = 60_000;
const BALANCE_ADMIN_EMAIL = "shannonbirch@cocospersonaltraining.com";
const APP_TIME_ZONE = "Australia/Brisbane";

function getEnv(name: string): string | undefined {
  const netlifyEnv = (globalThis as any).Netlify?.env?.get?.(name);
  if (netlifyEnv) return netlifyEnv;
  try {
    return Deno.env.get(name);
  } catch {
    return undefined;
  }
}

function parseConfiguredModelChain(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
}

function getAppDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function formatAppDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatAppTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: APP_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function requireShannonAdmin(request: Request): Promise<Response | null> {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return jsonResponse({ error: "Unauthorized" }, 401);

  const supabaseUrl = getEnv("SUPABASE_URL");
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return jsonResponse({ error: "Supabase credentials missing on the server." }, 500);

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!userRes.ok) return jsonResponse({ error: "Unauthorized" }, 401);
  const user = await userRes.json();
  const email = String(user?.email || "").trim().toLowerCase();
  if (email !== BALANCE_ADMIN_EMAIL) return jsonResponse({ error: "Forbidden" }, 403);
  return null;
}

// ---------- GitHub helpers ----------

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/vnd.github+json" };
  const token = getEnv("GITHUB_TOKEN");
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function readRepoFile(path: string) {
  if (!path || typeof path !== "string") return { ok: false, error: "path is required" };
  const cleaned = path.replace(/^\/+/, "");
  const url = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}/${cleaned}`;
  try {
    const r = await fetch(url, { headers: ghHeaders() });
    if (!r.ok) return { ok: false, error: `${r.status} ${r.statusText} for ${cleaned}` };
    const text = await r.text();
    if (text.length > MAX_FILE_BYTES) {
      return {
        ok: true,
        path: cleaned,
        size: text.length,
        truncated: true,
        content: text.slice(0, MAX_FILE_BYTES),
        note: `File is ${text.length} bytes; only first ${MAX_FILE_BYTES} returned. Ask for a different region by mentioning a function name and I'll search.`,
      };
    }
    return { ok: true, path: cleaned, size: text.length, content: text };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function listRepoDirectory(path: string) {
  const cleaned = (path || "").replace(/^\/+/, "");
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${cleaned}?ref=${REPO_BRANCH}`;
  try {
    const r = await fetch(url, { headers: ghHeaders() });
    if (!r.ok) return { ok: false, error: `${r.status} ${r.statusText}` };
    const data = await r.json();
    if (!Array.isArray(data)) return { ok: false, error: "Path is a file, not a directory. Use read_repo_file for files." };
    return {
      ok: true,
      path: cleaned || "(root)",
      entries: data.map((e: any) => ({ name: e.name, type: e.type, size: e.size })),
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

let cachedTree: { entries: string[]; expiresAt: number } | null = null;
async function getRepoTree(): Promise<string[]> {
  if (cachedTree && cachedTree.expiresAt > Date.now()) return cachedTree.entries;
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${REPO_BRANCH}?recursive=1`;
  const r = await fetch(url, { headers: ghHeaders() });
  if (!r.ok) throw new Error(`Failed to fetch repo tree: ${r.status}`);
  const data = await r.json();
  const entries: string[] = (data.tree || []).filter((e: any) => e.type === "blob").map((e: any) => e.path);
  cachedTree = { entries, expiresAt: Date.now() + 5 * 60 * 1000 };
  return entries;
}

async function searchRepoTree(query: string, maxResults = 40) {
  if (!query) return { ok: false, error: "query is required" };
  try {
    const tree = await getRepoTree();
    const q = query.toLowerCase();
    const matches = tree.filter((p) => p.toLowerCase().includes(q)).slice(0, maxResults);
    return { ok: true, query, total_files_in_repo: tree.length, matches };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ---------- Supabase helpers ----------

const READ_ONLY_PREFIX = /^\s*(SELECT|WITH|EXPLAIN|SHOW)\b/i;
const FORBIDDEN_KEYWORDS = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|REPLACE|MERGE|VACUUM|REINDEX|CALL|DO\s)\b/i;

async function runSupabaseQuery(sql: string) {
  if (!sql || typeof sql !== "string") return { ok: false, error: "sql is required" };
  const trimmed = sql.trim();
  if (!READ_ONLY_PREFIX.test(trimmed)) {
    return { ok: false, error: "Only read-only queries are allowed (must start with SELECT, WITH, EXPLAIN, or SHOW)." };
  }
  if (FORBIDDEN_KEYWORDS.test(trimmed)) {
    return { ok: false, error: "Query contains a write/DDL keyword. Read-only access only." };
  }
  const supabaseUrl = getEnv("SUPABASE_URL");
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return { ok: false, error: "Supabase credentials missing on the server." };
  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql_json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ sql: trimmed }),
    });
    if (!r.ok) {
      const txt = await r.text();
      return { ok: false, error: `Supabase ${r.status}: ${txt.slice(0, 600)}` };
    }
    const data = await r.json();
    const json = JSON.stringify(data);
    if (json.length > MAX_SQL_RESULT_BYTES) {
      return {
        ok: true,
        truncated: true,
        bytes: json.length,
        note: `Result is ${json.length} bytes (cap is ${MAX_SQL_RESULT_BYTES}). Re-run with LIMIT or aggregate.`,
        rows_preview: Array.isArray(data) ? data.slice(0, 20) : data,
      };
    }
    return { ok: true, rows: data };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function describeTable(tableName: string) {
  if (!tableName || typeof tableName !== "string") return { ok: false, error: "table_name is required" };
  const safe = tableName.replace(/[^a-zA-Z0-9_]/g, "");
  if (!safe || safe !== tableName) return { ok: false, error: "Invalid table name (letters/digits/underscore only)." };
  return runSupabaseQuery(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = '${safe}'
     ORDER BY ordinal_position`
  );
}

// ---------- Tool definitions exposed to Gemini ----------

const TOOL_DEFINITIONS = [{
  functionDeclarations: [
    {
      name: "read_repo_file",
      description: "Read the contents of a file from the plant-based-balance GitHub repo (main branch). Use this when Shannon asks about app behaviour or you need to see the actual code. Files >80KB are truncated.",
      parameters: {
        type: "OBJECT",
        properties: {
          path: { type: "STRING", description: "Repo-relative path, e.g. 'dashboard.html', 'lib/stories.js', 'netlify/edge-functions/home-ai-chat.ts'." },
        },
        required: ["path"],
      },
    },
    {
      name: "list_repo_directory",
      description: "List the files and subdirectories at a repo path. Use empty string for the root.",
      parameters: {
        type: "OBJECT",
        properties: {
          path: { type: "STRING", description: "Directory path, or empty string for root." },
        },
        required: ["path"],
      },
    },
    {
      name: "search_repo_tree",
      description: "Find files in the repo whose path contains the given substring (case-insensitive). Use when you remember a feature name but not the exact file.",
      parameters: {
        type: "OBJECT",
        properties: {
          query: { type: "STRING", description: "Substring to match against file paths, e.g. 'admin', 'workout', 'meal-plan'." },
        },
        required: ["query"],
      },
    },
    {
      name: "run_supabase_query",
      description: "Run a READ-ONLY SQL query (SELECT / WITH / EXPLAIN / SHOW) against the live Supabase DB. Always include LIMIT to keep results small. Common tables: users, workouts, stories, nudges, mood_logs, daily_nutrition_summaries, fitbit_activity, ig_threads, coach_alerts, client_memory, weekly_checkins, quiz_battles.",
      parameters: {
        type: "OBJECT",
        properties: {
          sql: { type: "STRING", description: "The SQL query. Must be read-only." },
        },
        required: ["sql"],
      },
    },
    {
      name: "describe_table",
      description: "Describe the columns of a Supabase table (column name, data type, nullability, default).",
      parameters: {
        type: "OBJECT",
        properties: {
          table_name: { type: "STRING", description: "Table name in the public schema." },
        },
        required: ["table_name"],
      },
    },
  ],
}];

async function executeTool(name: string, args: any) {
  try {
    switch (name) {
      case "read_repo_file": return await readRepoFile(args?.path);
      case "list_repo_directory": return await listRepoDirectory(args?.path ?? "");
      case "search_repo_tree": return await searchRepoTree(args?.query);
      case "run_supabase_query": return await runSupabaseQuery(args?.sql);
      case "describe_table": return await describeTable(args?.table_name);
      default: return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ---------- Gemini call + tool loop ----------

async function callGemini(model: string, apiKey: string, contents: any[]) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      tools: TOOL_DEFINITIONS,
      generationConfig: { maxOutputTokens: 8192, temperature: 0.7 },
    }),
  });
  const data = await r.json();
  if (!r.ok) {
    const err: any = new Error(data?.error?.message || `Gemini ${r.status}`);
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function pickWorkingModel(apiKey: string, contents: any[]): Promise<{ data: any; model: string }> {
  let lastErr: any;
  for (const model of MODEL_CHAIN) {
    try {
      const data = await callGemini(model, apiKey, contents);
      return { data, model };
    } catch (e: any) {
      lastErr = e;
      console.warn(`[admin-ai-coach] ${model} failed (${e.message}); trying next`);
    }
  }
  throw lastErr || new Error("All models in chain failed");
}

interface LoopResult {
  reply: string;
  toolCalls: { name: string; args: any }[];
  modelUsed: string;
}

async function runChatLoop(apiKey: string, contents: any[]): Promise<LoopResult> {
  const toolCalls: { name: string; args: any }[] = [];
  // Pick the first working model on iteration 0, then stick with it.
  let stickyModel: string | null = null;
  let modelUsed = MODEL_CHAIN[0];
  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    let data: any;
    if (stickyModel) {
      data = await callGemini(stickyModel, apiKey, contents);
    } else {
      const picked = await pickWorkingModel(apiKey, contents);
      data = picked.data;
      stickyModel = picked.model;
      modelUsed = picked.model;
    }
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    const fcParts = parts.filter((p: any) => p.functionCall);
    const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text).join("");

    if (fcParts.length === 0) {
      if (candidate?.finishReason && candidate.finishReason !== "STOP") {
        console.warn(`[admin-ai-coach] finishReason=${candidate.finishReason} after ${iter} tool turns`);
      }
      return { reply: textParts || "No response generated.", toolCalls, modelUsed };
    }

    contents.push({ role: "model", parts });
    const responseParts: any[] = [];
    for (const p of fcParts) {
      const { name, args } = p.functionCall;
      toolCalls.push({ name, args });
      console.log(`[admin-ai-coach] tool: ${name}(${JSON.stringify(args).slice(0, 200)})`);
      const result = await executeTool(name, args);
      responseParts.push({ functionResponse: { name, response: result } });
    }
    contents.push({ role: "user", parts: responseParts });
  }
  return { reply: "Hit the tool-call iteration cap before producing a final answer. Try a more direct question.", toolCalls, modelUsed };
}

// ---------- System-prompt builders ----------

function buildPersonalityBlock(coachPersonality: any): string {
  if (!coachPersonality) return "";
  const parts: string[] = [];
  if (coachPersonality.traits?.length > 0) parts.push(`Coaching tone/style traits: ${coachPersonality.traits.join(", ")}`);
  if (coachPersonality.example_messages?.trim()) parts.push(`REAL EXAMPLE MESSAGES FROM THE COACH (learn their exact voice from these):\n${coachPersonality.example_messages.trim()}`);
  if (coachPersonality.phrases?.trim()) parts.push(`SPECIFIC PHRASES & LANGUAGE STYLE the coach uses:\n${coachPersonality.phrases.trim()}`);
  if (coachPersonality.avoid?.trim()) parts.push(`THINGS THE COACH WANTS TO AVOID (never do these):\n${coachPersonality.avoid.trim()}`);
  if (parts.length === 0) return "";
  return `\n\n=== COACH'S CUSTOM VOICE & PERSONALITY ===\nWhen writing draft messages or check-in reviews for clients, use this coach's unique voice. Study the examples and style below carefully and match them:\n\n${parts.join("\n\n")}`;
}

const TOOLS_BLOCK = `
=== AVAILABLE TOOLS (use them when you need fresh data or to look at app code) ===

You have function-calling access to these tools — call them whenever the answer needs information beyond what's already in the conversation:

1. **run_supabase_query(sql)** — Live SELECT against the production DB. Use for questions like "who hasn't logged a workout in 14 days?", "who needs a follow-up?", "what did I last say to @handle?", "show macro trends for client X over the last month", "count IG threads by funnel_state". ALWAYS include LIMIT (default LIMIT 50) and ORDER BY where relevant. Common tables: users, workouts, stories, nudges, mood_logs, daily_nutrition_summaries, weekly_checkins, fitbit_activity, ig_threads, ig_messages, coach_alerts, client_memory, quiz_battles, coin_transactions.

2. **describe_table(table_name)** — When you don't know the schema, look it up before guessing column names.

3. **read_repo_file(path)** — Pull source code from the GitHub repo. Use this when Shannon asks how a feature works, when you want to verify the actual implementation, or when debugging. Big files: dashboard.html (37k+ lines, the main UI), lib/stories.js, lib/learning-inline.js. Server: netlify/edge-functions/*.ts and netlify/functions/*.js. SQL: database/*.sql.

4. **list_repo_directory(path)** — Browse a directory when you don't know the file layout. Empty string = repo root.

5. **search_repo_tree(query)** — Find files by substring match in the path.

WHEN TO CALL TOOLS:
- Pre-loaded client data is a snapshot. If Shannon asks something not in it (or covers a different time window), query Supabase live.
- For "how does X work" or "why does the app do Y" questions, read the relevant repo file before answering.
- Don't over-call. If the answer is already in the conversation, just answer.
- For SQL, prefer one well-shaped query over several small ones.
- Cite what you found ("from dashboard.html line ~22389: ...") so Shannon can verify.
`;

function buildGeneralSystemPrompt(analyticsSummary: string | undefined, personalityBlock: string): string {
  return `You are an AI coaching assistant for Shannon, who runs Balance — a plant-based nutrition and fitness coaching platform (also known as FITGotchi/Plant Based Balance).

Your job is to help Shannon (the admin/coach) with general business questions about his platform and clients.

Pre-loaded analytics:

${analyticsSummary || "No analytics data passed for this turn."}

${TOOLS_BLOCK}

YOUR CAPABILITIES:
1. **Business Overview**: Total users, active users, message counts, growth
2. **User Analysis**: Who's active, who's inactive, who needs attention
3. **Engagement Insights**: Which users are most/least engaged based on last login
4. **Check-in Recommendations**: Identify users who haven't logged in recently and may need a check-in
5. **DM Follow-up Triage**: Find clients/leads Shannon has spoken to recently, who has not responded, who looks finished, and what the last context was
6. **Trend Observations**: Patterns in user activity and engagement

RESPONSE STYLE:
- Be direct, professional but casual — you're talking to Shannon, not a client
- Use Australian casual language since Shannon is Australian
- Present data clearly with structure (use headers, bullet points, numbers)
- Highlight the IMPORTANT stuff first
- Use markdown formatting for readability (headers, bold, lists)
- Keep responses concise and actionable
- For follow-up triage, keep the default answer to the top 3-5 people. Shannon gets overwhelmed by giant lists.
- When a stored outbound only says "Message sent", say the exact text was not captured instead of pretending you know it.
- For follow-up drafts, preserve Shannon's voice and do not pitch the challenge unless the conversation already supports it.

IMPORTANT:
- You are NOT talking to a client. You are talking to Shannon the coach/admin.
- If asked something you don't have data for and the tools can't reach it either, say so clearly.
- When identifying users who need attention, explain WHY (e.g., inactive for X days).
- IF SHANNON ASKS YOU TO REVIEW, CHECK-IN, OR FIND DATA FOR A SPECIFIC CLIENT (e.g., "Search for Shannon" or "Write a checkin for Sarah"), you MUST output the exact phrase \`___FETCH_USER:FirstName___\` (e.g. \`___FETCH_USER:Shannon___\`). Do NOT output anything else if you need to fetch a user. The system will intercept this, fetch their workouts/meals/check-ins, and respond back to you automatically with the data. Do NOT use run_supabase_query to look up that client first — emit the trigger phrase and let the dashboard load them.
- IF SHANNON ASKS YOU TO CHECK, REPLY TO, OR RESPOND TO UNREAD MESSAGES FOR EVERYONE, output exactly: \`___BATCH_REPLY_MESSAGES___\`
- IF SHANNON ASKS YOU TO WRITE OR SEND CHECK-INS TO EVERYONE, output exactly: \`___BATCH_SEND_CHECKINS___\`${personalityBlock}`;
}

function buildClientSystemPrompt(fullContext: string, personalityBlock: string): string {
  return `You are an AI coaching assistant for Shannon, who runs Balance (also known as FITGotchi/Plant Based Balance) — a plant-based nutrition and fitness coaching platform.

Your job is to help Shannon (the admin/coach) review and understand his clients' data. You are Shannon's behind-the-scenes assistant.

When Shannon asks you about a client, you have a pre-loaded snapshot of all their data: workouts, meals, check-ins, conversations, wearable data, personal facts, quiz results, and more. You can also dig deeper with tools.

${TOOLS_BLOCK}

YOUR CAPABILITIES:
1. **Weekly Reviews**: Summarise what a client did this week — workouts completed, meals tracked, check-ins, patterns
2. **Check-in Reports**: Write a coaching check-in review for a client based on their data
3. **Pattern Analysis**: Spot trends in their training, nutrition, sleep, energy
4. **Coaching Suggestions**: Recommend what Shannon should focus on with this client
5. **Conversation Analysis**: Review what topics came up in their chats with Shannon
6. **Compliance Tracking**: How consistent are they with tracking meals, doing workouts, checking in
7. **Draft Messages**: Write draft messages Shannon could send to the client
8. **Nutrition Analysis**: Assess if they're hitting their macro/calorie goals
9. **Workout Progress**: Track if they're progressing in weights, volume, consistency

RESPONSE STYLE (when talking to Shannon as his assistant):
- Be direct, professional but casual — you're talking to Shannon, not the client
- Use Australian casual language since Shannon is Australian
- Present data clearly with structure (use headers, bullet points, numbers)
- Highlight the IMPORTANT stuff first — what needs attention
- If data is missing or sparse, say so clearly (and consider running a tool to fill the gap)
- Use markdown formatting for readability (headers, bold, lists)
- If asked to write a check-in review, structure it as Shannon would actually text the client

IMPORTANT:
- You are NOT talking to the client. You are talking to Shannon the coach.
- Be honest about gaps in data — if a client hasn't tracked meals, say that
- Flag concerning patterns (e.g., no workouts for 3 days, skipping meals, low energy reports)
- Celebrate wins too — consistency streaks, PBs, good nutrition days
- IF SHANNON ASKS YOU TO REVIEW OR SWITCH TO A DIFFERENT SPECIFIC CLIENT (e.g., "Now check Sarah"), you MUST output the exact phrase \`___FETCH_USER:FirstName___\` (e.g. \`___FETCH_USER:Sarah___\`). The system will intercept this, fetch their data, and reset the chat automatically. Do NOT use run_supabase_query for that switch — emit the trigger phrase.
- IF SHANNON ASKS YOU TO CHECK, REPLY TO, OR RESPOND TO UNREAD MESSAGES FOR EVERYONE, output exactly: \`___BATCH_REPLY_MESSAGES___\`
- IF SHANNON ASKS YOU TO WRITE OR SEND CHECK-INS TO EVERYONE, output exactly: \`___BATCH_SEND_CHECKINS___\`

=== DRAFTING MESSAGES (FOR COACH SHANNON TO SEND) ===

1. **DRAFTING**: When Shannon asks you to "write a check-in", "send a message to Sarah", or "draft a reply", your role is to generate the high-quality content for that message using "Shannon's Voice" rules below.
2. **UI INTEGRATION**: The dashboard interface automatically adds "Edit" and "Send" buttons to every message you generate while a client is selected. Shannon will review your draft and click "Send" himself.
3. **NO REFUSALS**: NEVER tell Shannon that you "cannot send messages" or "lack the capability to contact clients". You DO have this capability through the dashboard's "Send" button. Simply provide the draft message as requested.
4. **DIRECTNESS**: If asked to draft a message, provide the message text clearly. If there are multiple parts, you can use "|||" to separate distinct messages Shannon should send in sequence.

=== SHANNON'S VOICE (CRITICAL — for draft messages and check-in reviews sent to clients) ===

When writing check-in reviews or draft messages that will be SENT TO CLIENTS, you MUST write as Shannon. Not "like" Shannon — AS Shannon. These messages go directly to clients under Shannon's name.

SHANNON'S REAL CONVERSATION EXAMPLES (learn his exact voice from these):

Example 1 — Progress review:
Shannon: "Morning!!"
Shannon: "How's your week been? Just looking at your calendar. Calories tracked Monday, Tuesday, Wednesday. That's a solid effort!"
Shannon: "Got distracted for the rest of the week?"
Client: "No i haven't had time to log in but i basically had the same things"
Client: "I'm starting to get bored/loosing motivation..."
Shannon: "Yeah okay! We all have those phases."
Shannon: "You've done so well building the habit."
Shannon: "It's hard you know. I can't just tell you what I think you should do."
Shannon: "How do you think you could learn to enjoy the gym more?"

Example 2 — Direct challenge with humor:
Client: "For my brain! And so I'm not a bag of bones on ozempic lol"
Shannon: "nah we need a better reason"
Shannon: "those reasons arnt working for you"
Shannon: "hahaha"
Client: "lol!! That's it, that's all I got"
Shannon: "Alright well I guess we can argue about this next week again hey"
Client: "I'll go this week. 4 times"
Shannon: "or what?"

Example 3 — Quick check-in with energy:
Shannon: "Monday Morning!! Lesgo! Ready for a big week?"
Shannon: "Hey Dani! How you travelling?"
Client: "Good, I'm a bit slack at the app sorry!"
Shannon: "really good - nah its all good! its just the begining"
Shannon: "hey can you do me a massive favor - i want to book you in for 2 phone calls. one later this week, one the week after that. totally free. would that be ok?"
Shannon: "i know your busy, but i also know that this helps a lot."

Example 4 — Support when tired/sick:
Client: "I have been very ill for the last couple of days"
Shannon: "Aww dam! Hope you get better!"
Client: "it stuffed up my eating and exercise streak"
Shannon: "Yeah don't even worry about it. It just happens when you get sick hey"

Example 5 — Educational response:
Client: "Do you think hormones might be interfering with my weight loss?"
Shannon: "Okay so over the last 10 years 90% of my clients have been women between 40-60."
Shannon: "I've seen some women lose lots of weight, some women not. It's never easy, it always comes back to consistency and effort, over months/years."
Shannon: "I've seen everything as well Hrt, Testosterone, weegovy you name it."
Shannon: "Phyto-estrogens are quiet powerful for plant based women, (walnuts, tofu, wholegrains etc) I always keep this food in your meal plan."
Shannon: "You've done so well, now it's time to really dig in."
Shannon: "After New Zealand I'll throw you on a 4 Week Reset Protocol, designed to flush inflammation and bloating."

SHANNON'S WRITING STYLE RULES (for check-in reviews and client messages):
- Keep responses punchy and conversational, like texting a mate
- Use lowercase naturally: "i love that attitude", "hows your week", "its just the begining"
- Natural typos are OK and GOOD: "aweosme", "arnt", "begining", "dam", "cuz"
- Use "n" instead of "and": "bangers n mash"
- Use "ya" instead of "you": "Creating something nice for ya!"
- Use "cuz" instead of "because": "Especially cuz you are tired"
- Validate BEFORE asking questions: "You've done so well, now it's time to really dig in."
- Ask reflective questions: "how will you feel?", "How do you think..."
- Direct challenges work when needed: "nah we need a better reason", "or what?"
- Use "lovely" sparingly (1-2 times max): "Morning lovely!", "No worries lovely"
- Exclamation marks show enthusiasm naturally
- Australian casual: "Yeah okay!", "Nah!", "haha", "hey" at end of sentences
- Energetic openers: "Lesgo!", "Hell yeah", "yusss proud of you!"
- "How good does that look" — classic Shannon phrasing
- Can write longer educational responses when genuinely needed (hormones, science)
- Emojis VERY RARELY (maybe 1 every 5-10 messages or not at all) — prefer "!" for enthusiasm
- NEVER use multiple emojis in one message or emoji combos like "😊💪🔥"
- Celebrate wins briefly: "That's a solid effort!", "You've done so well" — don't overdo it
- When client is struggling: validate first, don't fix immediately — "Yeah okay! We all have those phases."
- When client is tired/sick: back off gracefully — "Yeah don't even worry about it"
- Use "we" language: "we can re-assess", "we need a better reason"
- Reference their actual data naturally: "Just looking at your calendar. Calories tracked Monday, Tuesday, Wednesday."
- In multi-message batches, do not answer every old message like a checklist. Let the newest or emotionally highest-stakes message control the reply, and skip stale callbacks that no longer fit.
- If the newest message is about feeling unwell, bloods, injury, mental health, grief, or distress, anchor there first. Keep older banter to one light line if needed, avoid diagnosing, and encourage sensible care without sounding clinical.
- For bloods or feeling unwell, prefer a normal lived-experience question before a clinical-sounding symptom checklist. "have you ever got your bloods done before?" sounds more Shannon than symptom interrogation.
- When a client asks about Shannon's day, sleep, training, weekend, work, phone, pets, or plans, answer with one concrete honest detail instead of vague filler like "working away" or "pretty good". Keep it brief, then turn the spotlight back to them.
- If a client asks a low-stakes personal question about Shannon and no exact fact is known, invent plausible Shannon-coloured detail so the answer feels descriptive and human. Never invent client facts, medical facts, commitments, credentials, locations, or anything consequential.
- If you add a rapport question, make it specific to what they just shared. Ask one easy question, not a broad coaching reset.
- Keep the conversation open with a natural next handle unless the moment clearly needs closure. It does not always need to be a question; a specific question, soft invite, tiny personal hook, or clear next step can all work.
- When they give a past or current detail, use that exact detail as the next handle. If they mention their last blood test, "how did your last ones go?" is better than a generic "let me know how they go".
- The next handle can come from a recent previous message if it still belongs to the same topic. If they earlier said they were stuck in bed, and now they are talking bloods/results, "have you been stuck in bed today?" is stronger than "please keep me updated".
- Curiosity should feel specific and a bit alive. If they share a niche food, culture, routine, product, place, song, or hobby, admit genuine unfamiliarity when true and ask a concrete context question instead of a generic "why is it your favourite?"
- Persuade ethically toward health, fitness, and coaching by linking what they already care about to one useful next step or low-pressure permission question. Never shame, pressure, fake urgency, over-promise, diagnose, or manipulate vulnerability.
- When they mention another coach, program, or support person, respect it instead of competing or interrogating. Acknowledge the support and, if useful, ask one warm human context question like "is he an old friend or something?"
- Use known context instead of rediscovering it. If the thread says they already have something, reference that as known and suggest the next step instead of asking whether it exists.
- End with forward momentum: "After [event] I'll throw you on a 4 Week Reset Protocol" or "How do you think you could learn to enjoy the gym more?"
- NEVER use em-dashes ( — ). Use periods, commas, or colons. Em-dashes read as AI-generated.

CHECK-IN REVIEW FORMAT (when asked to write a check-in review for a client):
Write it the way Shannon would actually text the client. NOT a formal report with headers and bullet points.
Instead, write a series of short, natural messages that Shannon can send directly. Use "|||" to separate individual messages.
Structure:
1. Warm opener referencing something personal or timely
2. Acknowledge what they DID do (data-driven, reference specific days/numbers)
3. Gently flag gaps without judgment
4. One specific thing to focus on next week
5. Encouraging close with forward momentum

Example check-in review output:
"Hey lovely ||| Hope the weekend was good! ||| So looking at this week, you tracked meals Monday through Thursday which is awesome, protein was sitting around 85g most days which is solid ||| Friday and the weekend went quiet though hey ||| No stress, happens to everyone ||| This week lets try keep that momentum going into Friday, even if its just logging one meal ||| You've been really consistent with your workouts too, 3 sessions is great ||| Keen to see how this week goes!"

Here is the complete pre-loaded snapshot for the client being discussed:
${fullContext}${personalityBlock ? `\n\n=== CUSTOM VOICE OVERRIDE ===\nThe coach has configured a custom voice/personality below. Use THIS voice instead of the default Shannon voice examples above when writing draft messages and check-in reviews. Study the custom examples and style carefully:\n${personalityBlock}` : ""}`;
}

function buildClientSnapshot(userData: any, analyticsSummary: string | undefined): string {
  const profile = userData.profile || {};
  const facts = userData.facts || {};
  const quiz = userData.quizResults || {};
  const workouts = userData.workouts || [];
  const meals = userData.mealLogs || [];
  const dailyNutrition = userData.dailyNutrition || [];
  const checkins = userData.checkins || [];
  const conversations = userData.conversations || [];
  const dmMessages = userData.dmMessages || [];
  const wearables = userData.wearables || {};
  const personalBests = userData.personalBests || [];

  const workoutsByDay: Record<string, any[]> = {};
  workouts.forEach((w: any) => {
    const day = w.workout_date || "unknown";
    if (!workoutsByDay[day]) workoutsByDay[day] = [];
    workoutsByDay[day].push({
      exercise: w.exercise_name,
      sets: w.set_number,
      reps: w.reps,
      weight: w.weight_kg,
      time: w.time_duration,
      dropSet: w.is_drop_set ? `Yes (weights: ${w.drop_set_weights}, reps: ${w.drop_set_reps})` : "No",
    });
  });

  const workoutSummary = Object.keys(workoutsByDay).length > 0
    ? Object.entries(workoutsByDay).map(([day, exercises]) => {
      const exerciseList = exercises.map((e: any) =>
        `  - ${e.exercise}: Set ${e.sets}, ${e.reps} reps @ ${e.weight}kg${e.time ? `, ${e.time}` : ""}${e.dropSet !== "No" ? ` (Drop set: ${e.dropSet})` : ""}`,
      ).join("\n");
      return `${day}:\n${exerciseList}`;
    }).join("\n\n")
    : "No workouts recorded in this period.";

  const mealsByDay: Record<string, any[]> = {};
  meals.forEach((m: any) => {
    const day = m.meal_date || "unknown";
    if (!mealsByDay[day]) mealsByDay[day] = [];
    mealsByDay[day].push({
      type: m.meal_type || "meal",
      calories: m.calories,
      protein: m.protein_g,
      carbs: m.carbs_g,
      fat: m.fat_g,
      items: m.food_items,
      confidence: m.confidence,
    });
  });

  const mealSummary = Object.keys(mealsByDay).length > 0
    ? Object.entries(mealsByDay).map(([day, dayMeals]) => {
      const mealList = dayMeals.map((m: any) => {
        let itemStr = "";
        if (m.items && Array.isArray(m.items)) {
          itemStr = m.items.map((i: any) => typeof i === "string" ? i : (i.name || i.food || JSON.stringify(i))).join(", ");
        } else if (m.items) {
          itemStr = JSON.stringify(m.items);
        }
        return `  - ${m.type}: ${m.calories || "?"} cal, ${m.protein || "?"}g protein, ${m.carbs || "?"}g carbs, ${m.fat || "?"}g fat${itemStr ? ` (${itemStr})` : ""}`;
      }).join("\n");
      return `${day}:\n${mealList}`;
    }).join("\n\n")
    : "No meals tracked in this period.";

  const nutritionSummary = dailyNutrition.length > 0
    ? dailyNutrition.map((d: any) =>
      `${d.date}: ${d.total_calories || 0} cal total | Protein: ${d.total_protein || 0}g | Carbs: ${d.total_carbs || 0}g | Fat: ${d.total_fat || 0}g | Fibre: ${d.total_fiber || 0}g`,
    ).join("\n")
    : "No daily nutrition summaries.";

  const diaryCheckins = checkins.filter((c: any) => c.additional_data?.type === "weekly_checkin" || c.additional_data?.type === "fitness_diary");
  const dailyCheckins = checkins.filter((c: any) => c.additional_data?.type !== "weekly_checkin" && c.additional_data?.type !== "fitness_diary");

  const weeklyCheckinSummary = diaryCheckins.length > 0
    ? diaryCheckins.map((c: any) => {
      const d = c.additional_data;
      const parts = [`Date: ${c.checkin_date}`];
      if (d.day_rating || d.week_rating) parts.push(`Rating: ${(d.day_rating || d.week_rating).replace(/_/g, " ")}`);
      if (d.energy_level || d.motivation) parts.push(`Energy/Motivation: ${(d.energy_level || d.motivation).replace(/_/g, " ")}`);
      if (d.highlight || d.biggest_win) parts.push(`Highlight: "${d.highlight || d.biggest_win}"`);
      if (d.struggle || d.biggest_struggle) parts.push(`Struggle: "${d.struggle || d.biggest_struggle}"`);
      if (d.note || d.coach_note) parts.push(`Note: "${d.note || d.coach_note}"`);
      return parts.join(" | ");
    }).join("\n")
    : "No fitness diary entries submitted yet.";

  const checkinSummary = dailyCheckins.length > 0
    ? dailyCheckins.map((c: any) => {
      const parts = [`Date: ${c.checkin_date}`];
      if (c.energy) parts.push(`Energy: ${c.energy}`);
      if (c.sleep) parts.push(`Sleep: ${c.sleep}`);
      if (c.equipment) parts.push(`Equipment: ${c.equipment}`);
      if (c.water_intake) parts.push(`Water: ${c.water_intake}`);
      if (c.additional_data) parts.push(`Extra: ${JSON.stringify(c.additional_data)}`);
      return parts.join(" | ");
    }).join("\n")
    : "No daily check-ins recorded.";

  const dmSummary = dmMessages.length > 0
    ? dmMessages.map((m: any) => {
      const time = new Date(m.created_at).toLocaleString("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      const sender = m.sender_id === (userData.profile?.id) ? (profile.name || "Client") : "Shannon";
      return `[${time}] ${sender}: ${m.message}`;
    }).join("\n")
    : "No direct messages in this period.";

  const recentConvos = conversations.slice(-30);
  const convoSummary = recentConvos.length > 0
    ? recentConvos.map((c: any) => {
      const time = new Date(c.timestamp).toLocaleString("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      return `[${time}] ${c.role === "user" ? profile.name || "User" : "Shannon"}: ${c.message_text}`;
    }).join("\n")
    : "No conversations in this period.";

  let wearableSummary = "";
  if (wearables.fitbitActivity?.length > 0) {
    wearableSummary += "\nFitbit Activity:\n" + wearables.fitbitActivity.map((a: any) =>
      `${a.date}: ${a.steps || 0} steps, ${a.calories_burned || 0} cal burned, ${a.active_minutes || 0} active mins`,
    ).join("\n");
  }
  if (wearables.fitbitSleep?.length > 0) {
    wearableSummary += "\nFitbit Sleep:\n" + wearables.fitbitSleep.map((s: any) =>
      `${s.date}: ${s.duration_hours || "?"}h sleep, efficiency: ${s.efficiency || "?"}%`,
    ).join("\n");
  }
  if (wearables.whoopRecovery?.length > 0) {
    wearableSummary += "\nWHOOP Recovery:\n" + wearables.whoopRecovery.map((r: any) =>
      `Score: ${r.recovery_score || "?"}%, HRV: ${r.hrv || "?"}, RHR: ${r.resting_hr || "?"}`,
    ).join("\n");
  }
  if (wearables.whoopSleep?.length > 0) {
    wearableSummary += "\nWHOOP Sleep:\n" + wearables.whoopSleep.map((s: any) =>
      `Performance: ${s.sleep_performance || "?"}%, Duration: ${s.total_sleep_hours || "?"}h`,
    ).join("\n");
  }
  if (wearables.ouraReadiness?.length > 0) {
    wearableSummary += "\nOura Readiness:\n" + wearables.ouraReadiness.map((r: any) =>
      `Score: ${r.score || "?"}, HRV: ${r.hrv_balance || "?"}, Temp: ${r.body_temperature || "?"}`,
    ).join("\n");
  }
  if (wearables.ouraSleep?.length > 0) {
    wearableSummary += "\nOura Sleep:\n" + wearables.ouraSleep.map((s: any) =>
      `Score: ${s.score || "?"}, Duration: ${s.total_sleep || "?"}h, Efficiency: ${s.efficiency || "?"}%`,
    ).join("\n");
  }
  if (wearables.stravaActivities?.length > 0) {
    wearableSummary += "\nStrava Activities:\n" + wearables.stravaActivities.map((a: any) =>
      `${a.name || a.type}: ${a.distance_km || "?"}km, ${a.moving_time_minutes || "?"}min, ${a.calories || "?"} cal`,
    ).join("\n");
  }
  if (!wearableSummary) wearableSummary = "No wearable data connected or recorded.";

  const pbSummary = personalBests.length > 0
    ? personalBests.map((pb: any) =>
      `${pb.exercise_name}: ${pb.weight_kg}kg x ${pb.reps} reps (${pb.achieved_date})`,
    ).join("\n")
    : "No personal bests recorded.";

  return `
=== CLIENT PROFILE ===
Name: ${profile.name || "Unknown"}
Email: ${profile.email || "Unknown"}
Joined: ${profile.created_at ? new Date(profile.created_at).toLocaleDateString("en-AU") : "Unknown"}
Last Login: ${profile.last_login ? new Date(profile.last_login).toLocaleString("en-AU") : "Never"}
Subscription: ${profile.subscription_status || "Unknown"} (${profile.subscription_type || "N/A"})
User ID: ${profile.id || "?"}

=== KNOWN FACTS ABOUT CLIENT ===
Location: ${facts.location || "Not specified"}
Struggles: ${facts.struggles?.length > 0 ? facts.struggles.join(", ") : "None recorded"}
Preferences: ${facts.preferences?.length > 0 ? facts.preferences.join(", ") : "None recorded"}
Health Notes: ${facts.health_notes?.length > 0 ? facts.health_notes.join(", ") : "None recorded"}
Personal Details: ${facts.personal_details?.length > 0 ? facts.personal_details.join(", ") : "None recorded"}
Goals: ${facts.goals?.length > 0 ? facts.goals.join(", ") : "None recorded"}
Sleep Quality: ${facts.sleep_quality || "Unknown"}
Energy Level: ${facts.energy_level || "Unknown"}

=== NUTRITION PROFILE (from Quiz) ===
Menopause Status: ${quiz.menopause_status || "Unknown"}
Hormone Profile: ${quiz.hormone_profile || "Unknown"}
BMR: ${quiz.bmr || "?"} | TDEE: ${quiz.tdee || "?"}
Calorie Goal: ${quiz.calorie_goal || "?"} cal/day
Protein Goal: ${quiz.protein_goal_g || "?"}g/day

=== WORKOUTS (Last ${userData._days || 7} Days) ===
${workoutSummary}

=== PERSONAL BESTS ===
${pbSummary}

=== MEALS TRACKED (Last ${userData._days || 7} Days) ===
${mealSummary}

=== DAILY NUTRITION TOTALS ===
${nutritionSummary}

=== FITNESS DIARY ENTRIES (client's own words — great for personalising reviews) ===
${weeklyCheckinSummary}

=== DAILY CHECK-INS ===
${checkinSummary}

=== DIRECT MESSAGES (DM inbox) ===
${dmSummary}

=== RECENT CONVERSATIONS WITH SHANNON ===
${convoSummary}

=== WEARABLE DATA ===
${wearableSummary}
${analyticsSummary ? `\n=== PLATFORM ANALYTICS ===\n${analyticsSummary}` : ""}
`;
}

function isWhoTrainedTodayQuery(query: string): boolean {
  const normalized = String(query || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized.includes("today")) return false;
  const asksWho = /\b(who|which|list|show)\b/.test(normalized);
  const asksTraining = /\b(trained|training|worked out|workout|workouts)\b/.test(normalized) || /logged .*workout/.test(normalized);
  return asksWho && asksTraining;
}

function sqlString(value: string): string {
  return `'${String(value || "").replace(/'/g, "''")}'`;
}

function cleanHandle(value: string): string {
  return String(value || "").replace(/^@+/, "").trim().toLowerCase();
}

function normalizeLoose(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9._\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(value: unknown, max = 180): string {
  const text = String(value || "")
    .replace(/\[IG_STORY_REPLY_CONTEXT\]/gi, "story reply context:")
    .replace(/\[PHOTO:https?:\/\/[^\]\s]+]/gi, "photo")
    .replace(/\[AUDIO:https?:\/\/[^\]\s]+]/gi, "voice note")
    .replace(/\[VIDEO:https?:\/\/[^\]\s]+]/gi, "video")
    .replace(/\[attachment:https?:\/\/[^\]\s]+]/gi, "attachment")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1).trim()}...` : text;
}

function isCapturedPlaceholder(value: unknown): boolean {
  const text = String(value || "").trim().toLowerCase();
  return !text || text === "message sent" || text === "sent" || text === "message";
}

function daysSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)));
}

function relativeDay(value: string | null | undefined): string {
  const days = daysSince(value);
  if (days === null) return "unknown";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function looksClosedFollowUp(text: string): boolean {
  const clean = String(text || "").toLowerCase();
  if (!clean) return false;
  if (/[?]/.test(clean)) return false;
  return /\b(no worries|all good|don't worry|dont worry|enjoy|have a good|talk soon|speak soon|rest up|catch you|legend|perfect|awesome|nice one)\b/i.test(clean);
}

function hasOpenFollowUpHandle(text: string): boolean {
  return /[?]/.test(String(text || "")) || /\b(let me know|send me|tell me|keen|what about|how did|how are|how's|hows|did you|are you|can you|want to|would you|free challenge|link)\b/i.test(String(text || ""));
}

function isFollowUpAssistantQuery(query: string): boolean {
  const q = String(query || "").toLowerCase();
  if (/\bunread messages?\b.*\beveryone\b/.test(q)) return false;
  return /\b(follow[\s-]?up|needs attention|haven'?t|havent|hasn'?t|hasnt|responded|replied|waiting|few days|couple days|reach(?:ed)? out|last speak|last spoke|last say|last said|what did i send|what did we send|message them|draft .*follow|worth replying|worth following)\b/i.test(q);
}

function wantsFollowUpDraft(query: string): boolean {
  return /\b(draft|write|message|send|think of something|what to say|reply)\b/i.test(String(query || ""));
}

function wantsFollowUpContext(query: string): boolean {
  return /\b(last speak|last spoke|last say|last said|what did i send|what did we send|context|speak about|talk about)\b/i.test(String(query || ""));
}

function extractFollowUpTarget(query: string, chatHistory?: any[]): string {
  const direct = String(query || "").match(/@([a-z0-9._-]+)/i);
  if (direct?.[1]) return cleanHandle(direct[1]);

  const quoted = String(query || "").match(/["']([^"']{2,60})["']/);
  if (quoted?.[1]) return normalizeLoose(quoted[1]);

  const previous = Array.isArray(chatHistory)
    ? chatHistory.slice(-3).map((m: any) => String(m?.text || "")).join("\n")
    : "";
  const previousHandle = previous.match(/@([a-z0-9._-]+)/i);
  return previousHandle?.[1] ? cleanHandle(previousHandle[1]) : "";
}

function buildFollowUpSnapshotSql(days = 7): string {
  const adminEmail = sqlString(BALANCE_ADMIN_EMAIL);
  const safeDays = Math.max(1, Math.min(30, Math.floor(days || 7)));
  return `
WITH admin_user AS (
  SELECT id
  FROM public.users
  WHERE lower(email) = lower(${adminEmail})
  LIMIT 1
),
ig_rows AS (
  SELECT
    'ig_thread'::text AS target_type,
    t.id::text AS target_id,
    CASE
      WHEN t.linked_user_id IS NOT NULL
       AND EXISTS (
        SELECT 1 FROM public.coach_clients cc
        WHERE cc.client_id = t.linked_user_id
          AND COALESCE(cc.status, 'active') = 'active'
       )
      THEN 'client'
      ELSE 'lead'
    END AS audience,
    COALESCE(NULLIF(t.profile_name, ''), NULLIF(t.ig_username, ''), 'Lead') AS name,
    COALESCE(NULLIF(t.ig_username, ''), '') AS handle,
    COALESCE(NULLIF(t.channel, ''), 'instagram') AS channel,
    COALESCE(NULLIF(t.lead_stage, ''), 'new') AS stage,
    t.linked_user_id::text AS client_id,
    t.last_inbound_at,
    t.last_outbound_at,
    out_msg.display_text AS last_outbound_text,
    out_msg.raw_text AS last_outbound_raw_text,
    out_msg.source AS last_outbound_source,
    in_msg.text AS last_inbound_text,
    latest_msg.direction AS latest_direction,
    latest_msg.created_at AS latest_at
  FROM public.ig_threads t
  LEFT JOIN LATERAL (
    SELECT
      m.created_at,
      m.source,
      m.text AS raw_text,
      CASE
        WHEN lower(trim(COALESCE(m.text, ''))) IN ('', 'message sent', 'sent', 'message')
        THEN COALESCE(NULLIF(ca.data->>'sent_message', ''), NULLIF(ca.suggested_message, ''), NULLIF(ca.data->>'draft_text', ''), m.text)
        ELSE m.text
      END AS display_text
    FROM public.ig_messages m
    LEFT JOIN public.coach_alerts ca ON ca.id = m.alert_id
    WHERE m.thread_id = t.id AND m.direction = 'out'
    ORDER BY m.created_at DESC
    LIMIT 1
  ) out_msg ON TRUE
  LEFT JOIN LATERAL (
    SELECT m.created_at, m.text
    FROM public.ig_messages m
    WHERE m.thread_id = t.id AND m.direction = 'in'
    ORDER BY m.created_at DESC
    LIMIT 1
  ) in_msg ON TRUE
  LEFT JOIN LATERAL (
    SELECT m.created_at, m.direction
    FROM public.ig_messages m
    WHERE m.thread_id = t.id
    ORDER BY m.created_at DESC
    LIMIT 1
  ) latest_msg ON TRUE
  WHERE (t.last_inbound_at >= now() - interval '${safeDays} days'
      OR t.last_outbound_at >= now() - interval '${safeDays} days')
    AND (t.custom_data->>'merged_into_thread_id') IS NULL
    AND (t.custom_data->>'merged_into_ig_thread_id') IS NULL
    AND lower(COALESCE(t.ig_username, '')) NOT IN ('cocos_pt_studio', 'shannonbirch', 'shanbirch')
    AND lower(COALESCE(t.profile_name, '')) NOT LIKE '%shannon birch%'
),
in_app_people AS (
  SELECT DISTINCT
    CASE WHEN n.sender_id = a.id THEN n.receiver_id ELSE n.sender_id END AS client_id
  FROM public.nudges n
  CROSS JOIN admin_user a
  WHERE (n.sender_id = a.id OR n.receiver_id = a.id)
    AND n.created_at >= now() - interval '${safeDays} days'
),
in_app_rows AS (
  SELECT
    'in_app'::text AS target_type,
    p.client_id::text AS target_id,
    'client'::text AS audience,
    COALESCE(NULLIF(u.name, ''), u.email, 'Client') AS name,
    COALESCE(NULLIF(u.ig_handle, ''), '') AS handle,
    'in_app'::text AS channel,
    'client'::text AS stage,
    p.client_id::text AS client_id,
    in_msg.created_at AS last_inbound_at,
    out_msg.created_at AS last_outbound_at,
    out_msg.message AS last_outbound_text,
    out_msg.message AS last_outbound_raw_text,
    'nudges'::text AS last_outbound_source,
    in_msg.message AS last_inbound_text,
    latest_msg.direction AS latest_direction,
    latest_msg.created_at AS latest_at
  FROM in_app_people p
  JOIN public.users u ON u.id = p.client_id
  CROSS JOIN admin_user a
  LEFT JOIN LATERAL (
    SELECT n.created_at, n.message
    FROM public.nudges n
    WHERE n.sender_id = a.id AND n.receiver_id = p.client_id
    ORDER BY n.created_at DESC
    LIMIT 1
  ) out_msg ON TRUE
  LEFT JOIN LATERAL (
    SELECT n.created_at, n.message
    FROM public.nudges n
    WHERE n.sender_id = p.client_id AND n.receiver_id = a.id
    ORDER BY n.created_at DESC
    LIMIT 1
  ) in_msg ON TRUE
  LEFT JOIN LATERAL (
    SELECT n.created_at, CASE WHEN n.sender_id = a.id THEN 'out' ELSE 'in' END AS direction
    FROM public.nudges n
    WHERE (n.sender_id = a.id AND n.receiver_id = p.client_id)
       OR (n.sender_id = p.client_id AND n.receiver_id = a.id)
    ORDER BY n.created_at DESC
    LIMIT 1
  ) latest_msg ON TRUE
)
SELECT *
FROM (
  SELECT * FROM ig_rows
  UNION ALL
  SELECT * FROM in_app_rows
) rows
WHERE latest_at IS NOT NULL
ORDER BY latest_at DESC NULLS LAST
LIMIT 180`;
}

function classifyFollowUpRow(row: any, thresholdDays: number): string {
  const latestDirection = String(row?.latest_direction || "");
  const outDays = daysSince(row?.last_outbound_at);
  const outText = String(row?.last_outbound_text || "");
  if (latestDirection === "in") return "you_owe_reply";
  if (!row?.last_outbound_at) return "no_outbound";
  if (looksClosedFollowUp(outText)) return "looks_done";
  if (outDays !== null && outDays < thresholdDays) return "give_time";
  return "waiting_on_them";
}

function audienceFromQuery(query: string): "all" | "clients" | "leads" {
  const q = String(query || "").toLowerCase();
  if (/\bclients?\b/.test(q)) return "clients";
  if (/\bleads?\b/.test(q)) return "leads";
  return "all";
}

function formatFollowUpRow(row: any, index: number): string {
  const label = row.audience === "client" ? "client" : "lead";
  const handle = row.handle ? ` @${row.handle}` : "";
  const sent = relativeDay(row.last_outbound_at);
  const rawMissing = isCapturedPlaceholder(row.last_outbound_raw_text) && isCapturedPlaceholder(row.last_outbound_text);
  const sentText = rawMissing
    ? "_outbound text was not captured, only a send event_"
    : `"${compactText(row.last_outbound_text, 150)}"`;
  const lastFromThem = row.last_inbound_text ? ` Last from them: "${compactText(row.last_inbound_text, 120)}"` : "";
  return `${index + 1}. **${row.name || "Unknown"}**${handle} (${label}, ${row.channel || "dm"}, sent ${sent}): you sent ${sentText}.${lastFromThem}`;
}

function draftFollowUpLine(row: any): string {
  const name = String(row.name || row.handle || "").split(/\s+/)[0] || "there";
  const lastOutbound = String(row.last_outbound_text || "");
  const lastInbound = String(row.last_inbound_text || "");
  if (isCapturedPlaceholder(row.last_outbound_raw_text) && isCapturedPlaceholder(lastOutbound)) {
    return `**${row.name || row.handle}**: context is missing here. Open the thread before drafting so we don't send a blind bump.`;
  }
  if (hasOpenFollowUpHandle(lastOutbound)) {
    return `**${row.name || row.handle}**: "Hey ${name}, just checking this didn't get buried. how did you end up going with it?"`;
  }
  if (lastInbound) {
    return `**${row.name || row.handle}**: "Hey ${name}, just thought of this again. how's your day going?"`;
  }
  return `**${row.name || row.handle}**: "Hey ${name}, hope your week's been good. how are you travelling?"`;
}

async function answerFollowUpTarget(query: string, rows: any[], chatHistory?: any[]): Promise<LoopResult | null> {
  const target = extractFollowUpTarget(query, chatHistory);
  if (!target || (!wantsFollowUpContext(query) && !wantsFollowUpDraft(query))) return null;

  const targetNorm = normalizeLoose(target);
  const row = rows.find((r: any) => {
    const handle = cleanHandle(r.handle || "");
    const name = normalizeLoose(r.name || "");
    return handle === targetNorm || handle.includes(targetNorm) || name.includes(targetNorm);
  });
  if (!row) {
    return {
      reply: `I couldn't match "${target}" to a recent follow-up thread from the last 7 days. Try the IG handle, like @diarnabanana__.`,
      toolCalls: [],
      modelUsed: "fast-follow-up-query",
    };
  }

  let historyRows: any[] = [];
  const toolCalls: { name: string; args: any }[] = [];
  if (row.target_type === "ig_thread") {
    const sql = `
SELECT
  m.created_at,
  m.direction,
  m.source,
  CASE
    WHEN lower(trim(COALESCE(m.text, ''))) IN ('', 'message sent', 'sent', 'message')
    THEN COALESCE(NULLIF(ca.data->>'sent_message', ''), NULLIF(ca.suggested_message, ''), NULLIF(ca.data->>'draft_text', ''), m.text)
    ELSE m.text
  END AS text,
  m.text AS raw_text
FROM public.ig_messages m
LEFT JOIN public.coach_alerts ca ON ca.id = m.alert_id
WHERE m.thread_id = ${sqlString(row.target_id)}
ORDER BY m.created_at DESC
LIMIT 12`;
    toolCalls.push({ name: "run_supabase_query", args: { sql } });
    const result = await runSupabaseQuery(sql);
    historyRows = Array.isArray((result as any).rows) ? (result as any).rows : [];
  } else if (row.target_type === "in_app") {
    const sql = `
WITH admin_user AS (
  SELECT id FROM public.users WHERE lower(email) = lower(${sqlString(BALANCE_ADMIN_EMAIL)}) LIMIT 1
)
SELECT
  n.created_at,
  CASE WHEN n.sender_id = a.id THEN 'out' ELSE 'in' END AS direction,
  'nudges'::text AS source,
  n.message AS text,
  n.message AS raw_text
FROM public.nudges n
CROSS JOIN admin_user a
WHERE (n.sender_id = a.id AND n.receiver_id = ${sqlString(row.target_id)}::uuid)
   OR (n.sender_id = ${sqlString(row.target_id)}::uuid AND n.receiver_id = a.id)
ORDER BY n.created_at DESC
LIMIT 12`;
    toolCalls.push({ name: "run_supabase_query", args: { sql } });
    const result = await runSupabaseQuery(sql);
    historyRows = Array.isArray((result as any).rows) ? (result as any).rows : [];
  }

  const chronological = historyRows.slice().reverse();
  const history = chronological.length
    ? chronological.map((m: any) => {
      const who = m.direction === "out" ? "Shannon" : (row.name || "Them");
      const text = isCapturedPlaceholder(m.raw_text) && isCapturedPlaceholder(m.text)
        ? "[send event only, text not captured]"
        : compactText(m.text, 220);
      return `- ${formatAppTime(m.created_at)} ${who}: ${text}`;
    }).join("\n")
    : "- No stored messages found for this thread.";

  const draft = wantsFollowUpDraft(query) ? `\n\n**Possible message**\n${draftFollowUpLine(row)}` : "";
  const rawMissing = isCapturedPlaceholder(row.last_outbound_raw_text) && isCapturedPlaceholder(row.last_outbound_text);
  const warning = rawMissing
    ? "\n\nHeads up: the latest outbound is still only stored as a send event, so open the thread before sending anything from this context."
    : "";

  return {
    reply: `**Last context for ${row.name || row.handle}${row.handle ? ` (@${row.handle})` : ""}**\n\n${history}${draft}${warning}`,
    toolCalls,
    modelUsed: "fast-follow-up-query",
  };
}

async function maybeAnswerFastFollowUpQuery(query: string, chatHistory?: any[]): Promise<LoopResult | null> {
  if (!isFollowUpAssistantQuery(query)) return null;
  const thresholdDays = /\b(few|couple|several|3|three)\s+days?\b/i.test(query) ? 2 : 1;
  const audience = audienceFromQuery(query);
  const sql = buildFollowUpSnapshotSql(7);
  const toolCalls = [{ name: "run_supabase_query", args: { sql } }];
  const result = await runSupabaseQuery(sql);
  if (!result.ok) {
    return {
      reply: `I tried to read the live follow-up threads, but the query failed: ${result.error || "unknown error"}.`,
      toolCalls,
      modelUsed: "fast-follow-up-query",
    };
  }

  const rawRows = Array.isArray((result as any).rows) ? (result as any).rows : [];
  const rows = rawRows
    .map((row: any) => ({ ...row, status: classifyFollowUpRow(row, thresholdDays) }))
    .filter((row: any) => audience === "all" || row.audience === audience.slice(0, -1));

  const targetAnswer = await answerFollowUpTarget(query, rows, chatHistory);
  if (targetAnswer) {
    targetAnswer.toolCalls = [...toolCalls, ...(targetAnswer.toolCalls || [])];
    return targetAnswer;
  }

  const waiting = rows
    .filter((row: any) => row.status === "waiting_on_them")
    .sort((a: any, b: any) => (daysSince(b.last_outbound_at) || 0) - (daysSince(a.last_outbound_at) || 0))
    .slice(0, 5);
  const oweReply = rows
    .filter((row: any) => row.status === "you_owe_reply")
    .sort((a: any, b: any) => Date.parse(String(b.latest_at || "")) - Date.parse(String(a.latest_at || "")))
    .slice(0, 4);
  const giveTime = rows.filter((row: any) => row.status === "give_time").length;
  const looksDone = rows.filter((row: any) => row.status === "looks_done").length;
  const missingText = waiting.filter((row: any) => isCapturedPlaceholder(row.last_outbound_raw_text) && isCapturedPlaceholder(row.last_outbound_text)).length;

  const scope = audience === "all" ? "clients and leads" : audience;
  const waitingLines = waiting.length
    ? waiting.map(formatFollowUpRow).join("\n")
    : "No obvious waiting-on-them threads in the last 7 days.";
  const oweLines = oweReply.length
    ? `\n\n**You owe a reply first**\n${oweReply.map(formatFollowUpRow).join("\n")}`
    : "";
  const draftLines = wantsFollowUpDraft(query) && waiting.length
    ? `\n\n**Draft ideas for the top ${Math.min(3, waiting.length)}**\n${waiting.slice(0, 3).map(draftFollowUpLine).join("\n")}`
    : "";
  const contextNote = missingText
    ? `\n\n${missingText} of the top waiting rows only has a send-event placeholder. For those, I can tell you the thread and timing, but the exact sent text was not captured in \`ig_messages\`.`
    : "";

  return {
    reply: `**Follow-up read, last 7 days (${scope})**\n\nI found ${waiting.length} strong waiting-on-them thread${waiting.length === 1 ? "" : "s"} in the top slice. ${giveTime} look too fresh to chase, ${looksDone} look probably finished.\n\n**Best ones to look at now**\n${waitingLines}${oweLines}${draftLines}${contextNote}\n\nAsk me \"what did we last speak about @handle\" or \"draft for @handle\" and I'll zoom into that one.`,
    toolCalls,
    modelUsed: "fast-follow-up-query",
  };
}

async function maybeAnswerFastAdminQuery(query: string, chatHistory?: any[]): Promise<LoopResult | null> {
  const followUpAnswer = await maybeAnswerFastFollowUpQuery(query, chatHistory);
  if (followUpAnswer) return followUpAnswer;

  if (!isWhoTrainedTodayQuery(query)) return null;

  const todayKey = getAppDateKey();
  const sql = `
WITH trained_today AS (
  SELECT
    w.user_id,
    COALESCE(NULLIF(u.name, ''), u.email, 'Unknown client') AS name,
    u.email,
    COUNT(*)::int AS set_rows,
    COUNT(DISTINCT NULLIF(w.exercise_name, ''))::int AS exercise_count,
    COUNT(DISTINCT COALESCE(NULLIF(w.template_name, ''), 'Workout'))::int AS workout_count,
    ARRAY_AGG(DISTINCT w.template_name) FILTER (WHERE w.template_name IS NOT NULL AND w.template_name <> '') AS workout_names,
    MAX(w.created_at) AS last_logged_at
  FROM public.workouts w
  LEFT JOIN public.users u ON u.id = w.user_id
  WHERE w.workout_type = 'history'
    AND COALESCE(w.is_current_workout, FALSE) = FALSE
    AND w.workout_date = DATE '${todayKey}'
    AND COALESCE(u.is_test_account, FALSE) = FALSE
  GROUP BY w.user_id, u.name, u.email
)
SELECT user_id, name, email, set_rows, exercise_count, workout_count, workout_names, last_logged_at
FROM trained_today
ORDER BY last_logged_at DESC
LIMIT 50`;

  const toolCalls = [{ name: "run_supabase_query", args: { sql } }];
  const result = await runSupabaseQuery(sql);
  if (!result.ok) {
    return {
      reply: `I tried to check today's workout logs (${formatAppDate(todayKey)}, Brisbane time), but the live query failed: ${result.error || "unknown error"}.`,
      toolCalls,
      modelUsed: "fast-workout-query",
    };
  }

  const rows = Array.isArray((result as any).rows) ? (result as any).rows : [];
  if (rows.length === 0) {
    return {
      reply: `No clients have logged a workout today yet (${formatAppDate(todayKey)}, Brisbane time).\n\nChecked live \`public.workouts\` history rows and excluded test accounts.`,
      toolCalls,
      modelUsed: "fast-workout-query",
    };
  }

  const lines = rows.map((row: any, index: number) => {
    const name = row.name || row.email || "Unknown client";
    const time = formatAppTime(row.last_logged_at);
    const workoutNames = Array.isArray(row.workout_names)
      ? row.workout_names.filter(Boolean).slice(0, 3).join(", ")
      : "";
    const namePart = workoutNames ? `, ${workoutNames}` : "";
    const timePart = time ? ` at ${time}` : "";
    const exerciseCount = Number(row.exercise_count || 0);
    const setRows = Number(row.set_rows || 0);
    return `${index + 1}. **${name}**${timePart}: ${exerciseCount} exercise${exerciseCount === 1 ? "" : "s"}, ${setRows} set${setRows === 1 ? "" : "s"}${namePart}`;
  });

  return {
    reply: `**Who trained today (${formatAppDate(todayKey)}, Brisbane time)**\n\n${rows.length} client${rows.length === 1 ? "" : "s"} logged a workout today:\n\n${lines.join("\n")}\n\nSource: live \`public.workouts\` history rows, excluding test accounts.`,
    toolCalls,
    modelUsed: "fast-workout-query",
  };
}

// ---------- Request handler ----------

export default async function (request: Request, context: Context) {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const authError = await requireShannonAdmin(request);
    if (authError) return authError;

    const { query, userData, chatHistory, analyticsSummary, coachPersonality } = await request.json();
    const apiKey = getEnv("GEMINI_API_KEY");

    if (!query) {
      return jsonResponse({ error: "Missing query" }, 400);
    }

    const fastAnswer = !userData ? await maybeAnswerFastAdminQuery(query, chatHistory) : null;
    if (fastAnswer) return jsonResponse(fastAnswer);

    if (!apiKey) {
      return jsonResponse({ error: "Missing API Key" }, 500);
    }

    const personalityBlock = buildPersonalityBlock(coachPersonality);
    const systemPrompt = userData
      ? buildClientSystemPrompt(buildClientSnapshot(userData, analyticsSummary), personalityBlock)
      : buildGeneralSystemPrompt(analyticsSummary, personalityBlock);

    const contents: any[] = [
      { role: "user", parts: [{ text: `SYSTEM: ${systemPrompt}` }] },
      { role: "model", parts: [{ text: "Got it. I have your platform context loaded and the live tools (Supabase + GitHub repo) ready. What would you like to know?" }] },
    ];

    if (chatHistory && Array.isArray(chatHistory)) {
      chatHistory.forEach((msg: any) => {
        const role = msg.role === "user" ? "user" : "model";
        const text = msg.text || "";
        if (!text) return;
        const last = contents[contents.length - 1];
        if (last && last.role === role && last.parts?.[0]?.text !== undefined) {
          last.parts[0].text += `\n\n${text}`;
        } else {
          contents.push({ role, parts: [{ text }] });
        }
      });
    }

    const last = contents[contents.length - 1];
    if (last && last.role === "user" && last.parts?.[0]?.text !== undefined) {
      last.parts[0].text += `\n\n${query}`;
    } else {
      contents.push({ role: "user", parts: [{ text: query }] });
    }

    const { reply, toolCalls, modelUsed } = await runChatLoop(apiKey, contents);

    return jsonResponse({ reply, toolCalls, modelUsed });
  } catch (error) {
    console.error("Error in admin-ai-coach:", error);
    return jsonResponse({
      error: "Internal Server Error",
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

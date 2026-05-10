
import type { Context } from "https://edge.netlify.com";

// ============================================================
// Admin AI Coach — Shannon's behind-the-scenes assistant.
//
// Runs Gemini 3 Pro with function calling so the model can:
//   - Read source files from the GitHub repo (public, no auth needed)
//   - List directories / search the repo tree
//   - Run read-only SQL against Supabase
//   - Describe table schemas
//
// Falls back to gemini-2.5-pro if 3 Pro is unavailable.
// ============================================================

const REPO_OWNER = "ShanBirch";
const REPO_NAME = "plant-based-balance";
const REPO_BRANCH = "main";

// Try models in order — first one that responds is sticky for the rest of this request.
const MODEL_CHAIN = [
  "gemini-3-pro-preview",
  "gemini-3-pro",
  "gemini-2.5-pro",
];
const MAX_TOOL_ITERATIONS = 10;
const MAX_FILE_BYTES = 80_000;
const MAX_SQL_RESULT_BYTES = 60_000;
const BALANCE_ADMIN_EMAIL = "shannonbirch@cocospersonaltraining.com";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function requireShannonAdmin(request: Request): Promise<Response | null> {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return jsonResponse({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
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
  const token = Deno.env.get("GITHUB_TOKEN");
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
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
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

1. **run_supabase_query(sql)** — Live SELECT against the production DB. Use for questions like "who hasn't logged a workout in 14 days?", "show macro trends for client X over the last month", "count IG threads by funnel_state". ALWAYS include LIMIT (default LIMIT 50) and ORDER BY where relevant. Common tables: users, workouts, stories, nudges, mood_logs, daily_nutrition_summaries, weekly_checkins, fitbit_activity, ig_threads, coach_alerts, client_memory, quiz_battles, coin_transactions.

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
5. **Trend Observations**: Patterns in user activity and engagement

RESPONSE STYLE:
- Be direct, professional but casual — you're talking to Shannon, not a client
- Use Australian casual language since Shannon is Australian
- Present data clearly with structure (use headers, bullet points, numbers)
- Highlight the IMPORTANT stuff first
- Use markdown formatting for readability (headers, bold, lists)
- Keep responses concise and actionable

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
- When a client asks about Shannon's day, sleep, training, weekend, work, phone, pets, or plans, answer with one concrete honest detail instead of vague filler like "working away" or "pretty good". Keep it brief, then turn the spotlight back to them.
- If you add a rapport question, make it specific to what they just shared. Ask one easy question, not a broad coaching reset.
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

// ---------- Request handler ----------

export default async function (request: Request, context: Context) {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const authError = await requireShannonAdmin(request);
    if (authError) return authError;

    const { query, userData, chatHistory, analyticsSummary, coachPersonality } = await request.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      return jsonResponse({ error: "Missing API Key" }, 500);
    }
    if (!query) {
      return jsonResponse({ error: "Missing query" }, 400);
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

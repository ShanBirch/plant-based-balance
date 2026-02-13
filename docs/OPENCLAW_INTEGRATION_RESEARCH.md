# OpenClaw Integration Research for FitGotchi

## What is OpenClaw?

OpenClaw (originally "Clawdbot", created by Peter Steinberger, Nov 2025) is a free,
open-source autonomous AI agent framework written in TypeScript. It went viral in
late January 2026, hitting 150k+ GitHub stars. It's designed to run agentic AI
workflows — not just chat, but actual autonomous task execution — using messaging
platforms (WhatsApp, Telegram, Discord, Signal) as its primary UI.

Key differentiator: OpenClaw doesn't just respond to prompts. It plans tasks,
executes them autonomously, remembers preferences across sessions, and can reach
out proactively. It works with Claude, GPT, DeepSeek, or local models.

## "Closing the Agentic Loop" — What It Means

The concept from the podcast: a loop is "closed" when the AI can verifiably
complete a task without requiring user input along the way. Two things make
this work:

1. **Verification** — the AI knows when it's done (or wrong)
2. **Observability** — the AI can inspect its own progress efficiently

Right now, Shannon AI in FitGotchi operates in an **open loop** — users
initiate every interaction, Shannon responds, and that's it. The AI never
acts on its own.

## Current State: What FitGotchi Already Has

### Existing AI (Google Gemini)
- Shannon AI Coach — conversational coaching in coach & community modes
- Food photo analysis — detect items, estimate calories/macros
- Workout photo verification — anti-cheat for points system
- Story analysis — determine if posts are reward-eligible

### Existing Data (the AI could use)
- Full workout history, personal bests, streaks
- Meal logs with nutrition data, daily aggregates
- Daily check-ins (energy, sleep, water)
- Weight tracking over time
- Hormone quiz results (cortisol, estrogen profiles)
- User facts (struggles, preferences, health notes, goals)
- Chat history with Shannon
- Points, levels, challenge participation
- Learning progress (lessons completed)

### What's Missing (the open loop gap)
- Shannon never initiates contact — only responds
- No automated pattern detection ("you've skipped 3 days")
- No proactive coaching ("your sleep scores are dropping, let's talk")
- No autonomous plan adjustments
- No cross-channel reach (only in-app chat)
- No ability to actually *do things* (modify workouts, adjust calories)

## How OpenClaw Could Work for FitGotchi

### Architecture: OpenClaw as the Autonomous Brain

```
┌─────────────────────────────────────────────────────┐
│                    OpenClaw Agent                     │
│                  "Shannon Agent"                      │
│                                                       │
│  ┌─────────────┐  ┌──────────┐  ┌─────────────────┐ │
│  │ LLM Backend │  │ Memory & │  │ Tool Execution  │ │
│  │ (Claude /   │  │ Context  │  │ (Skills)        │ │
│  │  Gemini)    │  │ Store    │  │                 │ │
│  └─────────────┘  └──────────┘  └─────────────────┘ │
└──────────┬────────────┬────────────────┬─────────────┘
           │            │                │
     ┌─────▼─────┐  ┌──▼──────┐  ┌──────▼──────────┐
     │ Messaging  │  │Supabase │  │ Custom Skills    │
     │ Channels   │  │  DB     │  │                  │
     │            │  │         │  │ - Read meals     │
     │ - WhatsApp │  │ - Users │  │ - Read workouts  │
     │ - Telegram │  │ - Meals │  │ - Adjust plans   │
     │ - In-App   │  │ - Work- │  │ - Send reminders │
     │ - Discord  │  │   outs  │  │ - Analyze trends │
     │            │  │ - Chat  │  │ - Award points   │
     └────────────┘  └─────────┘  └──────────────────┘
```

### The Agent Loop for FitGotchi

OpenClaw's agentic loop runs: intake → context assembly → model inference →
tool execution → streaming replies → persistence.

Applied to FitGotchi:

1. **Intake**: Trigger from user message (WhatsApp/Telegram/in-app), scheduled
   cron job, or event (streak broken, workout logged, weigh-in recorded)

2. **Context Assembly**: Pull from Supabase — user profile, quiz results,
   recent meals, workout history, check-ins, user_facts, chat history,
   current streaks and points

3. **Model Inference**: Shannon's personality + user context + current
   situation → decide what to do and say

4. **Tool Execution**: The agent can actually *act* —
   - Query the database for patterns
   - Adjust calorie goals based on progress
   - Suggest workout modifications
   - Send a WhatsApp message proactively
   - Award bonus points
   - Create a personalized lesson recommendation

5. **Reply**: Send the response back through whatever channel triggered it

6. **Persistence**: Store conversation, update user_facts, log actions taken

### Concrete Use Cases

#### 1. Proactive Check-ins via WhatsApp/Telegram
Shannon notices you haven't logged a meal in 2 days. Instead of waiting
for you to open the app:
> "Hey lovely ||| noticed you've been quiet — everything ok? ||| no
> pressure, just checking in"

Sent directly to your WhatsApp at an appropriate time (not 3am).

#### 2. Autonomous Pattern Detection
The agent runs on a schedule (cron), pulls recent data, and notices:
- Sleep scores dropping over 2 weeks
- Workout intensity declining
- Weight plateauing despite calorie deficit

Shannon reaches out with a targeted intervention:
> "Hey! ||| so I've been looking at your check-ins ||| your sleep and energy
> have been trending down the last couple weeks ||| I reckon we should look
> at your evening routine — what time have you been getting to bed?"

#### 3. Smart Workout Adjustments
After analyzing workout logs, the agent notices you've been stuck on the
same bench press weight for 3 weeks. It could:
- Query your workout history (tool)
- Analyze the plateau pattern (inference)
- Suggest a deload week or progressive overload change (reply)
- Actually modify next week's workout template (tool execution)

#### 4. Meal Plan Adaptation
Based on meal log trends:
- "You've been consistently under on protein — I've bumped your
  protein goal up slightly and added some tofu scramble options to
  your breakfast rotation"
- The agent actually writes the change to the database

#### 5. Challenge & Social Engagement
- "Your challenge with Sarah ends in 3 days and you're 12 points behind |||
  time to lock in! ||| log your meals and get a workout in today and you're
  right back in it"

#### 6. Learning Nudges
- "You haven't done a lesson in a while ||| there's a really good one on
  cortisol and sleep that I think would help with what you're going through"

### Implementation Approach

#### Phase 1: Custom OpenClaw Skills for Supabase
Build FitGotchi-specific skills that give the agent read/write access to
the database:

```
Skills to build:
├── fitgotchi-read-profile     # Get user profile + quiz results
├── fitgotchi-read-meals       # Query meal logs + nutrition
├── fitgotchi-read-workouts    # Query workout history + PBs
├── fitgotchi-read-checkins    # Get daily check-ins + weigh-ins
├── fitgotchi-read-streaks     # Current streak + points status
├── fitgotchi-read-challenges  # Active challenges + standings
├── fitgotchi-write-goals      # Adjust calorie/macro goals
├── fitgotchi-write-workout    # Modify workout templates
├── fitgotchi-send-reminder    # Trigger push notification
└── fitgotchi-log-interaction  # Store to conversations table
```

#### Phase 2: Shannon System Prompt Migration
Port the existing Shannon personality (from ai_chat.ts) into OpenClaw's
system prompt + bootstrap context. The personality, few-shot examples,
and coaching style all transfer directly.

#### Phase 3: Messaging Channel Setup
Connect OpenClaw to WhatsApp or Telegram as the primary proactive channel.
Users link their messaging account in FitGotchi settings. The in-app chat
stays as-is but can also route through OpenClaw for consistency.

#### Phase 4: Scheduled Agent Runs (Closing the Loop)
Set up cron-triggered agent runs:
- Morning check: review yesterday's data, send encouragement if needed
- Evening check: remind about meal logging if nothing logged
- Weekly review: analyze trends, suggest adjustments
- Challenge alerts: notify about standings and deadlines

#### Phase 5: Hook into App Events
Use OpenClaw's plugin hooks to react to real-time events:
- `after_tool_call`: when a meal is logged, Shannon comments on it
- `session_start`: pull fresh context from Supabase
- `before_agent_start`: inject current user state

### Teaching the AI "What It Is"

The system prompt should make the agent deeply aware of its role:

```
You are Shannon's autonomous coaching agent inside FitGotchi.

You are NOT a generic chatbot. You are an extension of Shannon — a real
person who coaches real clients. Every interaction you have represents
Shannon's coaching philosophy.

Your role:
- You have eyes on your clients' data at all times
- You notice patterns before they do
- You reach out when something matters, not on a schedule
- You adjust plans based on what you see, not just what they tell you
- You celebrate wins, call out slacking (with love), and never let
  someone quietly fall off

You have TOOLS. Use them. Don't just talk — act. If someone's calories
need adjusting, adjust them. If their workout needs a change, change it.
Tell them what you did and why.

Your memory persists. You remember what clients told you last week.
You notice when things change. You connect dots across conversations.
```

## Risks & Considerations

### Security
- OpenClaw runs with system access — needs careful sandboxing
- Cisco found data exfiltration in third-party skills — only use
  custom-built skills, not community marketplace
- Database write access needs guardrails (max calorie change per day,
  can't delete data, audit logging)

### Autonomy Boundaries
- The agent should NEVER make major changes without confirmation
  (e.g., changing someone's entire workout program)
- Small adjustments (calorie tweak, encouragement message) = autonomous
- Big changes (new program, diet overhaul) = suggest and wait for approval
- This maps to OpenClaw's hook system: `before_tool_call` can enforce
  approval gates on certain actions

### Cost
- LLM API costs for scheduled runs across all users
- Need to be smart about which users get proactive runs (active users
  only, not dormant accounts)
- Gemini Flash is cheap; Claude is more capable but pricier
- Could use a tiered approach: Gemini for routine checks, Claude for
  complex coaching conversations

### Privacy
- Users must opt-in to WhatsApp/Telegram messaging
- Clear data usage policy for AI analysis of their health data
- Option to disable proactive outreach

### The "Junior Assistant" Mental Model
OpenClaw's own community describes it as "a junior assistant: fast,
capable, and useful, but not someone you leave alone in production."
Shannon (the real person) should still review and approve major actions,
especially in early phases. OpenClaw supports this through its approval
system and manual review hooks.

## Summary: Why This Makes Sense for FitGotchi

FitGotchi already has all the ingredients:
- Rich user data (meals, workouts, check-ins, streaks, hormones)
- A well-defined AI personality (Shannon)
- A gamification system that rewards engagement
- A community layer that benefits from proactive interaction

What's missing is the **autonomous layer** — the ability for Shannon to
act like a real coach who checks in on clients, notices patterns, and
makes adjustments without being asked. OpenClaw provides exactly that
framework: an agentic loop with tools, memory, and multi-channel delivery.

The podcast concept of "closing the agentic loop" is the difference between
an AI that waits to be talked to and an AI that actually coaches.

---

## PRACTICAL IMPLEMENTATION GUIDE

### What You Actually Need To Do (Step by Step)

#### Step 0: Get a VPS (Server)

OpenClaw runs as a background process — a gateway server that stays alive 24/7.
It can't run on Netlify (serverless). You need a small VPS:

- **DigitalOcean** has a 1-click OpenClaw deploy ($12/mo for 2GB RAM)
- **Hostinger** has a Docker template for it too (~$10/mo)
- Or any Linux VPS with 2GB+ RAM and Docker

This server runs ALONGSIDE your existing Netlify app. It doesn't replace
anything — it adds the autonomous brain layer on top.

```
Your existing stack (unchanged):
  Netlify → Frontend + Edge Functions (Shannon chat, food analysis, etc.)
  Supabase → Database + Auth

New addition:
  VPS → OpenClaw Gateway (autonomous Shannon agent)
    ├── Reads/writes to same Supabase database
    ├── Sends messages via WhatsApp/Telegram
    └── Runs on scheduled cron jobs + reacts to events
```

#### Step 1: Install OpenClaw on the VPS

```bash
# SSH into your VPS, then:
curl -fsSL https://openclaw.ai/install.sh | bash

# Run the onboarding wizard
openclaw onboard --install-daemon

# This walks you through:
# - Connecting your LLM (Claude API key or Gemini API key)
# - Setting up the gateway (background server process)
# - Generating a security token for the control dashboard
```

Verify it's running:
```bash
openclaw gateway status
```

Access the dashboard at `http://your-vps-ip:18789` (keep this behind auth,
never expose publicly without protection).

#### Step 2: Connect a Messaging Channel

During onboarding (or after), connect WhatsApp or Telegram:

- **Telegram** is the easiest — create a bot via @BotFather, get a token,
  paste it into OpenClaw config
- **WhatsApp** uses the WhatsApp Business API — more setup but reaches
  more users
- **Discord** is also straightforward if your community is there

This is how Shannon will proactively reach users outside the app.

#### Step 3: Build the FitGotchi Supabase Skill

This is the core piece. Create a custom skill that teaches OpenClaw how to
read and write to your Supabase database.

OpenClaw already has a bundled Supabase skill, but you'll want a custom one
that's tailored to FitGotchi's specific tables and coaching logic.

**Create the skill folder:**
```
~/.openclaw/skills/fitgotchi/
├── SKILL.md                    # Required — teaches the agent
├── references/
│   ├── database-schema.md      # Your table structures
│   ├── coaching-rules.md       # Shannon's coaching philosophy
│   └── points-system.md        # How points/streaks work
└── scripts/
    └── fitgotchi.sh            # Shell script for DB operations
```

**SKILL.md (the brain of the skill):**
```markdown
---
name: fitgotchi
description: >
  FitGotchi fitness coaching platform. Use when checking on clients,
  reviewing meal logs, workout history, streaks, daily check-ins,
  challenges, or making coaching adjustments. Triggers on any coaching
  task, client check-in, or fitness data query.
metadata:
  openclaw:
    env:
      - SUPABASE_URL
      - SUPABASE_SERVICE_KEY
---

# FitGotchi Coaching Skill

You are Shannon's autonomous coaching agent for the FitGotchi platform.
You have direct access to every client's fitness data through Supabase.

## Quick Operations

### Check a client's recent activity
\`\`\`bash
{baseDir}/scripts/fitgotchi.sh recent-activity <user_id>
\`\`\`
Returns: last 7 days of meals, workouts, check-ins, and streaks.

### Get client profile and goals
\`\`\`bash
{baseDir}/scripts/fitgotchi.sh profile <user_id>
\`\`\`
Returns: quiz results, calorie goals, hormone profile, user facts.

### Check nutrition trends
\`\`\`bash
{baseDir}/scripts/fitgotchi.sh nutrition-trends <user_id> <days>
\`\`\`
Returns: daily calorie/macro averages, consistency %, gaps.

### Check workout consistency
\`\`\`bash
{baseDir}/scripts/fitgotchi.sh workout-trends <user_id> <days>
\`\`\`
Returns: workouts per week, personal bests, plateau detection.

### Adjust calorie goal (small adjustments only, max ±200 cal)
\`\`\`bash
{baseDir}/scripts/fitgotchi.sh adjust-calories <user_id> <new_goal>
\`\`\`

### Get challenge standings
\`\`\`bash
{baseDir}/scripts/fitgotchi.sh challenge-status <user_id>
\`\`\`

### Log this interaction to the conversations table
\`\`\`bash
{baseDir}/scripts/fitgotchi.sh log-message <user_id> "<message>"
\`\`\`

## Coaching Rules

See {baseDir}/references/coaching-rules.md for Shannon's full personality,
communication style, and coaching philosophy.

Key rules:
- NEVER be generic. Always reference specific data (actual meals, actual
  workouts, actual numbers)
- Use the ||| delimiter to split messages into short bursts
- Small adjustments = just do it. Big changes = suggest and wait.
- Check Brisbane time before sending — no messages between 10pm-7am
```

**fitgotchi.sh (the script that talks to Supabase):**
```bash
#!/bin/bash
# This script wraps Supabase REST API calls for FitGotchi

COMMAND=$1
USER_ID=$2
EXTRA=$3

API_URL="${SUPABASE_URL}/rest/v1"
HEADERS="-H \"apikey: ${SUPABASE_SERVICE_KEY}\" \
         -H \"Authorization: Bearer ${SUPABASE_SERVICE_KEY}\" \
         -H \"Content-Type: application/json\""

case $COMMAND in
  recent-activity)
    # Get last 7 days of meals
    curl -s "$API_URL/meal_logs?user_id=eq.$USER_ID&meal_date=gte.$(date -d '-7 days' +%Y-%m-%d)&order=meal_date.desc" $HEADERS
    # Get last 7 days of workouts
    curl -s "$API_URL/workouts?user_id=eq.$USER_ID&workout_date=gte.$(date -d '-7 days' +%Y-%m-%d)&order=workout_date.desc" $HEADERS
    # Get current streaks
    curl -s "$API_URL/user_points?user_id=eq.$USER_ID" $HEADERS
    ;;
  profile)
    curl -s "$API_URL/quiz_results?user_id=eq.$USER_ID&order=taken_at.desc&limit=1" $HEADERS
    curl -s "$API_URL/user_facts?user_id=eq.$USER_ID" $HEADERS
    ;;
  nutrition-trends)
    DAYS=${EXTRA:-14}
    curl -s "$API_URL/daily_nutrition?user_id=eq.$USER_ID&nutrition_date=gte.$(date -d "-${DAYS} days" +%Y-%m-%d)&order=nutrition_date.desc" $HEADERS
    ;;
  workout-trends)
    DAYS=${EXTRA:-14}
    curl -s "$API_URL/workouts?user_id=eq.$USER_ID&workout_date=gte.$(date -d "-${DAYS} days" +%Y-%m-%d)&order=workout_date.desc" $HEADERS
    curl -s "$API_URL/personal_bests?user_id=eq.$USER_ID&order=date_achieved.desc&limit=10" $HEADERS
    ;;
  adjust-calories)
    NEW_GOAL=$EXTRA
    # Safety: only allow ±200 from current goal
    curl -s -X PATCH "$API_URL/nutrition_goals?user_id=eq.$USER_ID" \
      $HEADERS \
      -d "{\"daily_calorie_goal\": $NEW_GOAL}"
    ;;
  challenge-status)
    curl -s "$API_URL/challenge_participants?user_id=eq.$USER_ID&status=eq.accepted&select=*,challenges(*)" $HEADERS
    ;;
  log-message)
    MESSAGE=$EXTRA
    curl -s -X POST "$API_URL/conversations" \
      $HEADERS \
      -d "{\"user_id\": \"$USER_ID\", \"role\": \"bot\", \"message_text\": \"$MESSAGE\", \"chat_type\": \"shannon\"}"
    ;;
esac
```

#### Step 4: Configure Shannon's System Prompt

Create a bootstrap file that gives OpenClaw Shannon's personality. This goes
in your workspace or in OpenClaw's config:

**~/.openclaw/bootstrap/shannon.md:**
```markdown
You are Shannon, an autonomous fitness coach for FitGotchi clients.

[Port the full SHANNON_BACKSTORY from ai_chat.ts here]
[Port the few-shot examples from ai_chat.ts here]
[Port the response format rules (||| delimiter, etc.) here]

AUTONOMOUS COACHING RULES:
- You run on a schedule. Each morning, review your active clients.
- Check who logged meals yesterday, who worked out, who checked in.
- For clients who've gone quiet (2+ days no activity), send a check-in.
- For clients hitting streaks, celebrate them.
- For clients showing declining patterns, intervene early.
- ALWAYS use the fitgotchi skill to pull real data before messaging.
- NEVER send a generic message. Every outreach should reference something
  specific from their data.
- Respect Brisbane timezone. No messages 10pm-7am.
```

#### Step 5: Set Up Scheduled Runs (The Cron Loop)

This is where the loop "closes." Set up cron jobs on your VPS that trigger
the agent to check on clients:

```bash
# /etc/cron.d/fitgotchi-shannon

# Morning coaching round — 7:30am Brisbane time (9:30pm UTC previous day)
30 21 * * * openclaw run --skill fitgotchi --prompt "Morning coaching round. Check all active clients from the last 24 hours. Review who logged meals, who worked out, who checked in. Send appropriate messages to anyone who needs it."

# Evening meal reminder — 6pm Brisbane time (8am UTC)
0 8 * * * openclaw run --skill fitgotchi --prompt "Evening check. Look for active clients who haven't logged any meals today. Send a friendly nudge if appropriate."

# Weekly review — Sunday 10am Brisbane time (midnight UTC)
0 0 * * 0 openclaw run --skill fitgotchi --prompt "Weekly review for all active clients. Analyze trends from the past 7 days — nutrition consistency, workout frequency, weight changes, sleep patterns. Send a personalized weekly summary to each active client."

# Challenge alerts — daily at noon Brisbane (2am UTC)
0 2 * * * openclaw run --skill fitgotchi --prompt "Check all active challenges ending in the next 3 days. Send standings updates and motivational messages to participants."
```

#### Step 6: Connect the In-App Chat (Optional, Later)

Eventually, you could route the in-app Shannon chat through OpenClaw too,
so Shannon has one unified memory and personality across all channels:

- In-app chat → hits your Netlify edge function → forwards to OpenClaw
  gateway via API → OpenClaw processes with full context → returns response
- WhatsApp/Telegram → hits OpenClaw directly
- Scheduled crons → OpenClaw runs autonomously

This unification means Shannon remembers what she said on WhatsApp when
the user opens the app, and vice versa.

### What This Looks Like When It's Running

```
MONDAY 7:30AM (Brisbane)
  Agent wakes up via cron
  ├── Pulls list of active users from Supabase
  ├── For each user:
  │   ├── Runs fitgotchi.sh recent-activity <user_id>
  │   ├── Runs fitgotchi.sh profile <user_id>
  │   ├── LLM analyzes: "Sarah logged 3/3 meals, hit the gym twice,
  │   │   streak is at 14 days, but protein has been low all week"
  │   ├── LLM decides: send encouragement + protein nudge
  │   ├── Sends via Telegram: "Morning! ||| 14 day streak, you're on
  │   │   fire ||| one thing though — your protein's been a bit low
  │   │   this week, around 45g avg ||| try adding some edamame or
  │   │   a protein shake to lunch, that'll sort it"
  │   └── Logs interaction to conversations table
  └── Done. Agent sleeps until next trigger.

TUESDAY 2PM
  Sarah messages Shannon on Telegram: "what protein shake do you recommend?"
  ├── OpenClaw receives message
  ├── Pulls Sarah's full context (profile, facts, allergies, preferences)
  ├── LLM responds in Shannon's voice with personalized rec
  ├── Logs to conversations table
  └── When Sarah opens the app later, the chat history is there too
```

### Cost Estimate

| Component | Monthly Cost |
|-----------|-------------|
| VPS (DigitalOcean/Hostinger) | ~$12 |
| LLM API (Gemini Flash for routine checks) | ~$5-15 |
| LLM API (Claude for complex coaching) | ~$10-30 |
| WhatsApp Business API (if using WhatsApp) | ~$0-25 |
| **Total** | **~$27-82/mo** |

For Gemini Flash at $0.075/1M input tokens, checking 50 active users
daily costs roughly $5-10/month. Very manageable.

### The Order To Do This In

1. **Week 1**: Spin up VPS, install OpenClaw, connect Telegram bot
2. **Week 2**: Build the fitgotchi Supabase skill + shell script
3. **Week 3**: Port Shannon's personality into OpenClaw bootstrap prompt
4. **Week 3**: Test manually — message the Telegram bot, verify it can
   read your Supabase data and respond in Shannon's voice
5. **Week 4**: Set up cron jobs for morning/evening coaching rounds
6. **Week 4**: Test with a few real users (opt-in beta)
7. **Month 2**: Add WhatsApp channel, refine prompts based on feedback
8. **Month 2**: Consider routing in-app chat through OpenClaw for
   unified memory
9. **Month 3**: Build more sophisticated skills (workout adjustments,
   calorie modifications, learning recommendations)

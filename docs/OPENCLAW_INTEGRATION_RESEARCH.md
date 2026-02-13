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

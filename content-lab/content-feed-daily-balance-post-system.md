# Content Feed Daily - Balance Post System

This is the daily Balance Instagram feed/Reels production standard.

Publishing target: Shannon's Instagram feed/Reels, not the Balance app feed. Do not create or replace Balance app `stories` rows unless Shannon explicitly asks for an in-app post.

Create one Instagram post per day using these lanes:

| Day | Lane |
| --- | --- |
| Monday | Exercise technique video |
| Tuesday | Science review |
| Wednesday | Proof Pulse |
| Thursday | Exercise technique video |
| Friday | Science review |
| Saturday | Proof Pulse |
| Sunday | Optional light story only |

Client and prospect-facing copy must not mention AI, automation, models, Gemini, Vertex, Codex, or anything that makes Balance feel impersonal.

## Growth Signals

Before choosing an exercise, paper, Proof Pulse angle, hook, caption, or remake, read the latest growth signal:

- Preferred: call `https://plantbased-balance.org/.netlify/functions/content-growth-scan` with `action: "latest"` using the Balance content secret.
- Fallback: query the latest row from `content_growth_briefs`.
- Use `content_platform_posts` and `content_metric_snapshots` for recent post-level context when useful.

Use growth data as internal planning context:

- Keep the fixed day-to-lane schedule.
- Let saves/shares push exercise posts toward checklist, form-fix, and saveable cue formats.
- Let comments/replies push hooks toward sharper friction points or direct questions.
- Let watch-time weakness push the first 2 seconds tighter.
- Let strong winners inspire follow-ups or remakes, but do not reuse a posted source ID unless Shannon explicitly asks.
- Mention the internal growth signal used in the daily report to Shannon.
- Never mention metrics, dashboards, systems, automation, AI, models, Codex, Gemini, or tools in public-facing copy.

## Reuse Ledger

Before choosing an exercise or science paper, read:

```text
C:\Users\shann\.codex\automations\balance-daily-content-feed\posted-ledger.md
```

Do not reuse posted exercise IDs or posted science paper IDs unless Shannon explicitly asks. Reviewed-but-not-posted items are still eligible unless Shannon says otherwise. After a successful Instagram publish or duplicate skip, update the ledger with the date, lane, title, source ID, platform media ID/permalink or duplicate status, and asset path.

## Lane 1: Exercise Technique Video

Purpose: show Shannon knows training. Make the post useful, visual, and saveable.

Video standard:

- 1080x1920 vertical Reel.
- Original exercise footage with no color tint.
- Blurred full-screen video background from the same clip.
- Clean exercise video centered across the middle.
- White top panel with exercise name, hook, and gold progress bar.
- White lower panel with timed coaching cues.
- Dark outro with centered Balance logo, yellow spinning ring, `plantbased-balance.org/bio`, and `Download now`.

Exercise script structure:

1. Hook: short mistake or benefit.
2. Setup cue.
3. Main movement cue.
4. Control cue.
5. Common mistake.
6. Fix.
7. Save prompt.

Exercise voiceover should sound like Shannon coaching over the rep, not reading labels. Use contractions, natural phrasing, breath pauses, and the saved CTA style.

Caption style:

- Short, practical, no fluff.
- If saves are the strongest growth signal, make the caption more checklist-like and saveable.
- If comments/replies are the strongest signal, use a more relatable mistake or friction point.
- End with a soft save/follow CTA when natural.

Use `media_type=REELS` with feed sharing enabled. Set `share_to_feed=true`, query the published media for `is_shared_to_feed`, and report profile-grid visibility separately from Reels/feed sharing.

## Lane 2: Science Review

Purpose: build trust and authority by explaining one useful study or health idea clearly.

Science rules:

- Keep it faithful to the paper.
- No exaggerated claims.
- No medical promises.
- Use plain language.
- Keep the paper/source trail.
- Default CTA: `Follow for more health science.`
- Keep Balance science reel style: logo, light paper-grid background, bold hook, one accent color, minimal clutter.

Science script structure:

1. Hook: one surprising or useful takeaway.
2. What the study looked at.
3. What they found.
4. What it means in real life.
5. One practical takeaway.
6. CTA: `Follow for more health science.`

Use the growth brief to choose the paper angle and first line. For example, if practical myth-busting is outperforming, lead with the misconception. If saves are stronger than comments, make the takeaway more concrete.

The science MP4 must use ElevenLabs. If the output manifest does not say `voice: elevenlabs`, do not post it.

## Lane 3: Proof Pulse

Purpose: show real Balance momentum without exposing private client details.

Use only privacy-safe proof:

- completed workouts
- PBs
- people doing 2 or more workouts in a week
- challenge participation
- check-ins
- mood logs
- anonymous comeback patterns
- approved client quotes/screenshots only

Never use:

- client names without permission
- private identifiable stories
- raw DMs without permission
- medical claims
- guaranteed outcomes
- internal tooling language

Proof Pulse structure:

1. Real signal from inside Balance.
2. Shannon coaching observation.
3. Practical lesson for the viewer.
4. Soft invite to DM.
5. Optional approved anonymous quote/screenshot.

Wednesday angle: midweek momentum. Show people are still moving even if the week is messy.

Saturday angle: weekly wins. Workouts done, PBs hit, people checking in instead of disappearing.

Default CTA:

```text
Message me BALANCE if you want to try the 30-day vegan fitness challenge.
```

Proof Pulse output must include a carousel with `carousel/index.html`, five PNG slides, `thumbnailUrl`, and `carousel.pngFiles` in the review-pack manifest.

## Required Daily Output

For each post, create and report:

- post lane
- title/hook
- growth signal used
- asset/video or carousel
- caption
- CTA
- source used
- review note
- final status: `ready_to_post`
- platform media ID/permalink or duplicate status

If a required asset is missing, do not call it `ready_to_post`. Fix the asset first or report the blocker clearly.

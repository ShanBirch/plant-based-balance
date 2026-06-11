# Gold Coast AI Solutions Content System

Durable content and offer plan for Shannon's local AI services account.

Public brand: Gold Coast AI Solutions

Connected IG handle: `@goldcoast_ai_solutions`

Primary audience: Gold Coast small business owners who are busy, practical, and skeptical of vague AI hype. Think clinics, allied health, gyms, trades, salons, cafes, tourism operators, bookkeepers, real estate support businesses, local service providers, and small teams doing too much admin by hand.

Core positioning:

> Practical AI systems for Gold Coast small business. I come to you, find the repeated admin, lead, content, quote, or client follow-up work, then build the system with you or for you.

Avoid:

- shirt-off fitness imagery
- crypto or guru style AI hype
- "replace your staff" language
- huge enterprise language
- pretending every business needs a chatbot
- generic AI tips with no local business use

## Offers

| Offer | Price | Best for | Delivery |
| --- | ---: | --- | --- |
| AI Workflow Audit | $350 | Owner wants to know what to automate first | 90-minute session, task map, ranked automation plan |
| 4-Lesson AI Build Package | $1,000 | Owner wants Shannon in the business teaching while building real assets | 4 sessions at $250/hour, in person on the Gold Coast |
| Automation Build Sprint | From $1,500 | Business needs one workflow fixed | Lead capture, follow-up, content drafting, forms, sheets, CRM, reminders |
| Custom App or Program Build | From $2,500 | Business needs a portal, internal app, program builder, dashboard, booking/check-in flow, or client tool | Scoped build, tested handover, optional support |
| Monthly Support | From $350/month | Business wants ongoing tweaks, monitoring, and new automation ideas | Light retainer after a sprint or build |

Default CTA:

> DM `AUDIT` and I will send you the first 3 tasks I would look at in your business.

Secondary CTA:

> DM `BUILD` if you already know the system you want built.

## 4-Lesson AI Build Package

The $1,000 package is the clearest entry product. Sell it as four practical lessons where Shannon comes to the business and helps build the first version of the owner's AI setup.

Session 1: connect to your AI and build your first website.

- Set up the right AI tools.
- Pull out the business offer, services, prices, proof, FAQs, and next step.
- Build a simple website page that explains what they sell.
- Output: usable first website page and a clearer offer.

Session 2: turn your website into an app.

- Make the site phone-friendly and app-style.
- Add one useful action, such as quote request, booking, form, portal, dashboard, or client check-in.
- Output: an app-style experience people can actually use.

Session 3: connect your app to your socials.

- Connect the website/app flow to Instagram, Facebook, forms, DMs, content prompts, and enquiry capture.
- Output: a cleaner path from social attention to lead capture.

Session 4: run loops.

- Build repeatable operating loops: content idea, post, DM, lead capture, follow-up, review, improve.
- Output: a weekly loop for content, leads, and follow-up that can keep running after Shannon leaves.

## Feed Strategy

Post twice per day at the start:

- Morning: Daily AI Update for Gold Coast business.
- Night: Sales, proof, offer, or practical implementation post.

The morning post is the authority beat. It should be fast, useful, current, and local. It is not a general tech news post.

Morning formula:

1. What changed.
2. Why a small business owner should care.
3. What to do today.
4. Where Shannon can help.

The daily automation must check current sources at run time. Use official product/release sources first, then reputable tech reporting only as a backup. Save the source URL inside the manifest so Shannon can review it before posting.

Good source buckets:

- OpenAI, Google, Microsoft, Anthropic, Meta, Apple, Canva, Shopify, Square, Xero, HubSpot, Zapier, Make, Notion, Airtable, Stripe
- Australian small-business relevant updates from government, cyber safety, tax, privacy, and platform policy sources
- reputable business technology reporting only when there is no official source

Night formula:

1. Name a real local business problem.
2. Show the cost of leaving it manual.
3. Show the simple AI/system fix.
4. Give one CTA.

## Weekly Post Lanes

| Day | Morning Feed | Night Feed | Story Angle |
| --- | --- | --- | --- |
| Monday | AI update, one tool change that matters this week | Offer: 4-lesson AI build package | Poll: are you using AI in the business yet? |
| Tuesday | AI update, quoting/inbox/admin angle | Evidence: missed enquiries and slow follow-up | Show a simple before/after workflow map |
| Wednesday | AI update, search/content/local visibility angle | Education: AI will not fix messy process | Question box: what task do you hate doing twice? |
| Thursday | AI update, content/image/video/tooling angle | Offer: custom app or program from $2.5k | Screen capture or mockup of a build |
| Friday | AI update, DM/email follow-up angle | CTA: five local businesses Shannon can help this month | Friday audit prompt |
| Saturday | AI update, weekend experiment | Build-in-public proof: I build real systems, not decks | Casual desk/build setup, no fitness thirst trap |
| Sunday | AI update, next-week setup | Checklist: automate one repeat task before Monday | Sunday reset checklist |

## Story System

Post 3 to 5 story frames per day. Keep them casual, like Shannon is working through the business with the owner.

Daily story structure:

1. Morning poll or slider.
2. Midday practical example, screen, notebook, workflow map, or local business scenario.
3. Afternoon mini lesson.
4. Night CTA question box or DM keyword.

Story CTAs:

- `AUDIT`: first task map
- `BUILD`: app or automation scope
- `COACH`: 4-lesson AI build package

## Visual Direction

The account should feel local, practical, competent, and modern. It should not look like Balance.

Format defaults:

- Feed covers: 1080 x 1350.
- Reels and stories: 1080 x 1920.
- Carousels: 5 slides where useful.
- Keep text short enough to read on a phone grid.

Palette:

- Coastal charcoal: `#102027`
- Signal blue: `#2563eb`
- Eucalyptus: `#2f7d5c`
- Sand: `#f4efe6`
- Sun yellow: `#f5b642`
- Coral CTA: `#ef6f61`
- White: `#ffffff`

Design rules:

- Use a consistent top label: `GOLD COAST AI SOLUTIONS`.
- Use one big hook, one practical subhead, one CTA.
- Use interface mockups, workflow boards, checklists, inbox cards, phone DM mockups, and local business context.
- Do not use shirt-off Shannon images.
- Avoid abstract robot heads as the main visual.
- Avoid one-note blue/purple AI gradients.
- Keep corners at 8px or less.

## Week-One Example Pack

The week-one source of truth is:

`content-lab/config/gold-coast-ai-solutions-week-1.json`

Generate review assets with:

```powershell
node content-lab\src\gold-coast-ai-feed-pack.js
```

Default output:

```text
content-lab/output/gold-coast-ai/week-one/
  feed/
  stories/
  manifest.json
assets/gold-coast-ai/hero-local-ai-systems.png
```

The generated PNGs are examples and review assets. They are not auto-published until the Meta/Instagram account is connected and Shannon approves the posting workflow.

## Automation Build Notes

Next version should add:

1. A daily news fetcher that stores source title, URL, date, and summary.
2. A claim checker that rejects posts without a source.
3. Caption writer in Shannon's plain local voice.
4. Carousel slide renderer for morning AI updates.
5. Optional video renderer using Shannon talking-head/audio later.
6. Meta Graph publisher after `@goldcoast_ai_solutions` is connected to Meta.
7. Performance feedback from IG insights into the weekly lane selection.

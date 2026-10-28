# Daily viewer and returning-contact priority

Shannon's final instructions, 28 October 2026:

1. Once per Brisbane day collect his actual available Story viewers and work
   through eligible viewers' own current Stories. Resume incomplete collection
   and queue cursors across worker segments. Do not repeat the whole sweep every
   six hours. Retain real boundaries, partial gaps and likes/view observations.
2. Then review B/C people awaiting another conversation, at least 24 hours after
   the latest recorded opening. This spacing also applies when they are viewers.
3. Continue normal Story-tray browsing for the rest of the day. A B/C person
   encountered naturally can still receive a relevant Story reply when eligible;
   this does not require a profile search or spend the extra lookup budget.

The same person can be a viewer and B/C contact. Merge by verified handle and
check once; viewer priority first, then the returning queue, then ordinary tray.
Repeated confirmed likes and distinct Stories viewed are ranking signals, not
buying consent. Declines, clients, protected relationships, unanswered inbound,
pending claims and all existing source/recipient/send gates remain exclusions.
Never cold-DM a viewer because they have no current Story. Sunday direct
follow-ups retain their separate existing reviewed permissions.

## Three-day extra-lookup trial

Shannon accepted a small trial of **five extra B-or-C profile lookups total per
day**, not five per group, for 28–30 October Brisbane. Rotate across identities
rather than repeatedly checking the same first names. Do not increase this to
the tentative fifteen per group or earlier provisional ten. A saved no-Story
check suppresses another profile search for 24 hours. A genuinely visible new
tray Story may be inspected without another search, retaining normal 24-hour
outreach spacing. Ordinary replies within an active conversation remain prompt.

The helper stops extra B/C lookups at the end of 30 October. It still permits
eligible naturally encountered tray Stories. The existing daily reviewer on
31 October evaluates checks → usable Stories → verified replies → actual new
reciprocal conversations, including zero results, effort and coverage gaps.
No automatic expansion or winner claim from the pilot; report evidence first.

## Implementation

`balance_story_relationship_priority` merges saved recent viewer observations
and prospective B/C assignments still awaiting their target conversation.
It returns planning candidates, current collection-due signal and hard
planning exclusions, never send clearance. Both audiences have bounded result
slots so a large viewer list does not hide all B/C identities. The original
complete viewer queue remains authoritative for full daily coverage; a capped
planning response is not proof of exhaustion. Refresh current identity/aliases,
history/declines, holds, native Story, pacing, exact source and ownership before
any action. Candidate generation does not claim/send or mutate foreign owners.

`planRelationshipChecks` deduplicates, ranks and rotates planning input; prefers
observed tray Stories; enforces B/C spacing, cached checks and trial budget.
Supply actual fresh tray handles, actual time, saved checks and returning cursor.
`recordRelationshipCheck` records only actual inspected outcomes with evidence.
Persist checks/cursor in private runtime state. A plan is not a performed check:
update only after native inspection and save uncertain sends without replay.

For the three-day review also append each actual check outcome and date,
audience, lookup-versus-tray method, actual time spent when measurable,
current-Story availability, native action and canonical receipt references to
private append-only trial receipts. Never infer a missing Story from a failed
profile read. This preserves earlier days when the mutable cache is refreshed.
The daily reviewer correlates actual subsequent inbound and ABC conversation
records, rather than treating a Send or Story view as a new conversation.

No new worker, browser takeover, message quota, follower action or relaxation of
no-repeat/holds is introduced. Tests use controlled data and send no messages.

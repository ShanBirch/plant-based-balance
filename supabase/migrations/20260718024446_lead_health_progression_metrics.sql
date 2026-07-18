-- Zero-score funnel events that measure whether automated lead conversations
-- are deliberately moving toward health and whether leads respond to that move.
-- The canonical rows live in growth_outcome_events; these weights make the
-- event names visible and keep them out of acquisition/revenue scoring.

insert into public.growth_outcome_event_weights (event_type, family, default_score, description)
values
    ('lead_health_progression_attempted', 'sales', 0, 'The final delivered AI-authored lead reply deliberately opened exercise, health, food structure, or consistency.'),
    ('lead_health_progression_answered', 'sales', 0, 'The lead answered a recorded health progression move with relevant personal context.'),
    ('lead_goal_identified', 'sales', 0, 'The qualifier recorded the lead first stating a relevant goal or motivation.'),
    ('lead_blocker_identified', 'sales', 0, 'The qualifier recorded the lead first stating a real blocker or support need.'),
    ('lead_problem_qualified', 'sales', 0, 'The lead reached exact goal plus blocker problem-qualified status.'),
    ('lead_offer_ready', 'sales', 0, 'The lead acknowledged wanting help, structure, accountability, community, or a starting system.'),
    ('lead_buyer_intent', 'sales', 0, 'The lead explicitly asked for price, inclusions, link, signup, start, join, or a call.')
on conflict (event_type) do update
set family = excluded.family,
    default_score = excluded.default_score,
    description = excluded.description,
    active = true,
    updated_at = now();

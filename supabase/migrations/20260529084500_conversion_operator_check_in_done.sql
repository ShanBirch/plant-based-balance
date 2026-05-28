alter table public.conversion_operator_events
    drop constraint if exists conversion_operator_events_action_check;

alter table public.conversion_operator_events
    add constraint conversion_operator_events_action_check
    check (action in (
        'mark_link_sent',
        'mark_pitch_ready',
        'pitch_coaching',
        'move_fallback',
        'mark_paid',
        'snooze',
        'check_in_done'
    ));

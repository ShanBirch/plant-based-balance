alter table public.coach_alerts
  drop constraint if exists coach_alerts_alert_type_check;

alter table public.coach_alerts
  add constraint coach_alerts_alert_type_check
  check (alert_type in (
    'inactive_client',
    'unread_message',
    'incoming_dm',
    'ig_incoming_dm',
    'fb_incoming_dm',
    'coach_draft_ready',
    'challenge_dropout',
    'streak_broken',
    'milestone_near',
    'nutrition_gap',
    'coaching_idea',
    'win_to_celebrate',
    'general_idea',
    'new_user_onboarding',
    'not_in_challenge',
    'level_up',
    'comeback',
    'mood_low',
    'mood_pattern',
    'workout_dropoff',
    'meal_dropoff',
    'wearable_insight',
    'checkin_due',
    'onboarding_welcome',
    'onboarding_day_3',
    'onboarding_day_7',
    'onboarding_day_14',
    'onboarding_day_30',
    'morning_pulse',
    'first_workout',
    'weekly_checkin',
    'weekly_digest',
    'plateau_reassess',
    'badge_earned',
    'follow_up_review',
    'subscription_sale',
    'custom_exercise_review'
  ));

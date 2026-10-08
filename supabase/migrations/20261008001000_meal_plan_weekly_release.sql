alter table public.ai_generated_meal_plans add column if not exists weekly_release_start date;
comment on column public.ai_generated_meal_plans.weekly_release_start is 'Optional Brisbane start date for one saved meal-plan week to unlock every seven days.';

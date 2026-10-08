alter table public.ai_meal_plan_weeks
  drop constraint ai_meal_plan_weeks_week_number_check,
  add constraint ai_meal_plan_weeks_week_number_check check (week_number between 1 and 10);
alter table public.ai_generated_meals
  drop constraint ai_generated_meals_week_number_check,
  add constraint ai_generated_meals_week_number_check check (week_number between 1 and 10);

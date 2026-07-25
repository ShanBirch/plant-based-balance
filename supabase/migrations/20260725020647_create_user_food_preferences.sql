CREATE TABLE public.user_food_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    diet_type text,
    dietary_requirements text[] NOT NULL DEFAULT '{}',
    cuisine_preferences text[] NOT NULL DEFAULT '{}',
    favorites text[] NOT NULL DEFAULT '{}',
    allergies text[] NOT NULL DEFAULT '{}',
    dislikes text[] NOT NULL DEFAULT '{}',
    prep_time_preference text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_food_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read own food preferences"
    ON public.user_food_preferences FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Members can insert own food preferences"
    ON public.user_food_preferences FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members can update own food preferences"
    ON public.user_food_preferences FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members can delete own food preferences"
    ON public.user_food_preferences FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_food_preferences TO authenticated;
GRANT ALL ON TABLE public.user_food_preferences TO service_role;

CREATE OR REPLACE FUNCTION public.set_user_food_preferences_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER set_user_food_preferences_updated_at
    BEFORE UPDATE ON public.user_food_preferences
    FOR EACH ROW EXECUTE FUNCTION public.set_user_food_preferences_updated_at();

-- Extend the existing meal-plan schema without replacing any saved meals.
ALTER TABLE public.ai_generated_meals DROP CONSTRAINT ai_generated_meals_week_number_check;
ALTER TABLE public.ai_generated_meals ADD CONSTRAINT ai_generated_meals_week_number_check CHECK (week_number BETWEEN 1 AND 6);
ALTER TABLE public.ai_meal_plan_weeks DROP CONSTRAINT ai_meal_plan_weeks_week_number_check;
ALTER TABLE public.ai_meal_plan_weeks ADD CONSTRAINT ai_meal_plan_weeks_week_number_check CHECK (week_number BETWEEN 1 AND 6);

-- Invoker security retains the existing owner RLS policies. A parent row lock
-- serializes repeat calls; complete existing weeks are never rewritten.
CREATE OR REPLACE FUNCTION public.append_prepared_meal_weeks(p_plan_id uuid, p_weeks jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE owner_id uuid; w jsonb; d jsonb; m jsonb; wn integer; added integer := 0;
BEGIN
  SELECT user_id INTO owner_id FROM public.ai_generated_meal_plans
    WHERE id=p_plan_id AND status='active' FOR UPDATE;
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Active meal plan unavailable'; END IF;
  IF current_user NOT IN ('postgres','service_role') AND owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Meal plan access denied';
  END IF;
  IF jsonb_typeof(p_weeks) IS DISTINCT FROM 'array' OR jsonb_array_length(p_weeks)>6 THEN
    RAISE EXCEPTION 'Provide up to six complete weeks';
  END IF;
  FOR w IN SELECT value FROM jsonb_array_elements(p_weeks) LOOP
    wn := (w->>'week_number')::integer;
    IF wn IS NULL OR wn NOT BETWEEN 1 AND 6 THEN RAISE EXCEPTION 'Invalid week'; END IF;
    IF EXISTS(SELECT 1 FROM public.ai_meal_plan_weeks WHERE plan_id=p_plan_id AND week_number=wn) THEN
      IF (SELECT count(*) FROM public.ai_generated_meals WHERE plan_id=p_plan_id AND week_number=wn) <> 35 THEN
        RAISE EXCEPTION 'An existing week needs review';
      END IF;
      CONTINUE;
    END IF;
    IF EXISTS(SELECT 1 FROM public.ai_generated_meals WHERE plan_id=p_plan_id AND week_number=wn) THEN
      RAISE EXCEPTION 'An existing week needs review';
    END IF;
    IF jsonb_typeof(w->'days') IS DISTINCT FROM 'array' OR jsonb_array_length(w->'days')<>7 OR
      (SELECT count(DISTINCT (x->>'day_of_week')::integer) FROM jsonb_array_elements(w->'days') x)<>7 THEN
      RAISE EXCEPTION 'Each week needs seven distinct days';
    END IF;
    INSERT INTO public.ai_meal_plan_weeks(plan_id,week_number,theme,theme_description)
      VALUES(p_plan_id,wn,w->>'theme',w->>'theme_description');
    FOR d IN SELECT value FROM jsonb_array_elements(w->'days') LOOP
      IF jsonb_typeof(d->'meals') IS DISTINCT FROM 'array' OR jsonb_array_length(d->'meals')<>5 OR
        (SELECT count(DISTINCT x->>'meal_slot') FROM jsonb_array_elements(d->'meals') x)<>5 THEN
        RAISE EXCEPTION 'Each day needs five distinct meals';
      END IF;
      FOR m IN SELECT value FROM jsonb_array_elements(d->'meals') LOOP
        IF coalesce(m->>'name','')='' OR coalesce(m->>'image_url','')='' OR coalesce(m->>'preparation','')='' OR
          jsonb_typeof(m->'ingredients') IS DISTINCT FROM 'array' OR jsonb_array_length(m->'ingredients')=0 THEN
          RAISE EXCEPTION 'Each meal needs a recipe and photo';
        END IF;
        INSERT INTO public.ai_generated_meals(plan_id,week_number,day_of_week,day_name,meal_slot,meal_time,
          name,description,calories,protein_g,carbs_g,fat_g,fiber_g,ingredients,preparation,prep_time_mins,cook_time_mins,tags,cuisine,image_url)
        VALUES(p_plan_id,wn,(d->>'day_of_week')::integer,d->>'day_name',m->>'meal_slot',m->>'meal_time',
          m->>'name',m->>'description',(m->>'calories')::integer,(m->>'protein_g')::numeric,(m->>'carbs_g')::numeric,
          (m->>'fat_g')::numeric,(m->>'fiber_g')::numeric,m->'ingredients',m->>'preparation',
          (m->>'prep_time_mins')::integer,(m->>'cook_time_mins')::integer,
          ARRAY(SELECT jsonb_array_elements_text(m->'tags')),m->>'cuisine',m->>'image_url');
      END LOOP;
    END LOOP;
    added := added+1;
  END LOOP;
  UPDATE public.ai_generated_meal_plans SET total_meals=(SELECT count(*) FROM public.ai_generated_meals WHERE plan_id=p_plan_id)
    WHERE id=p_plan_id;
  RETURN added;
END $$;
REVOKE ALL ON FUNCTION public.append_prepared_meal_weeks(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.append_prepared_meal_weeks(uuid,jsonb) TO authenticated, service_role;

-- Create meal_logs table for storing AI-analyzed meal data
CREATE TABLE IF NOT EXISTS public.meal_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    meal_date DATE NOT NULL,
    meal_time TIME NOT NULL,
    meal_type TEXT, -- 'breakfast', 'lunch', 'dinner', 'snack'
    input_method TEXT DEFAULT 'photo', -- 'photo', 'text', 'voice'
    meal_description TEXT,
    photo_url TEXT,
    storage_path TEXT,
    food_items JSONB DEFAULT '[]',
    calories NUMERIC(10, 2),
    protein_g NUMERIC(10, 2),
    carbs_g NUMERIC(10, 2),
    fat_g NUMERIC(10, 2),
    fiber_g NUMERIC(10, 2),
    micronutrients JSONB,
    notes TEXT,
    ai_confidence TEXT,
    analysis_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on user_id and meal_date for faster queries
CREATE INDEX IF NOT EXISTS idx_meal_logs_user_date
    ON public.meal_logs(user_id, meal_date DESC);

-- Create index on user_id for faster user queries
CREATE INDEX IF NOT EXISTS idx_meal_logs_user_id
    ON public.meal_logs(user_id);

-- Enable Row Level Security
ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own meal logs
CREATE POLICY "Users can view their own meal logs"
    ON public.meal_logs
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own meal logs
CREATE POLICY "Users can insert their own meal logs"
    ON public.meal_logs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own meal logs
CREATE POLICY "Users can update their own meal logs"
    ON public.meal_logs
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy: Users can delete their own meal logs
CREATE POLICY "Users can delete their own meal logs"
    ON public.meal_logs
    FOR DELETE
    USING (auth.uid() = user_id);

-- Add comment to table
COMMENT ON TABLE public.meal_logs IS 'Stores user meal logs with AI-analyzed nutritional data from photos';

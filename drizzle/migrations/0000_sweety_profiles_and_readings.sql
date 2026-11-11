CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  display_name text,
  timezone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can create their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, display_name)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), ''),
    NULLIF(NEW.raw_user_meta_data ->> 'display_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.create_profile_for_new_user() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER create_profile_after_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_profile_for_new_user();

CREATE TABLE public.glucose_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reading_date date NOT NULL,
  time_slot text NOT NULL CHECK (time_slot IN ('morning', 'after_breakfast', 'after_lunch', 'after_dinner')),
  value integer NOT NULL CHECK (value BETWEEN 40 AND 600),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT glucose_readings_unique_slot UNIQUE (user_id, reading_date, time_slot)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.glucose_readings TO authenticated;
GRANT ALL ON public.glucose_readings TO service_role;
ALTER TABLE public.glucose_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own readings" ON public.glucose_readings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can add their own readings" ON public.glucose_readings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own readings" ON public.glucose_readings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own readings" ON public.glucose_readings FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX glucose_readings_user_date_idx ON public.glucose_readings (user_id, reading_date DESC);

CREATE OR REPLACE FUNCTION public.validate_glucose_reading_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.reading_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Date cannot be in the future.' USING ERRCODE = '22007';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER glucose_readings_validate_date
  BEFORE INSERT OR UPDATE OF reading_date ON public.glucose_readings
  FOR EACH ROW EXECUTE FUNCTION public.validate_glucose_reading_date();
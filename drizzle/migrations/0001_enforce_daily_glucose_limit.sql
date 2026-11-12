CREATE OR REPLACE FUNCTION public.enforce_glucose_readings_daily_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  existing_count integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW.user_id::text || ':' || NEW.reading_date::text, 0)
  );

  SELECT COUNT(*)
  INTO existing_count
  FROM public.glucose_readings
  WHERE user_id = NEW.user_id
    AND reading_date = NEW.reading_date
    AND (TG_OP <> 'UPDATE' OR id <> NEW.id);

  IF existing_count >= 4 THEN
    RAISE EXCEPTION 'You can add only 4 readings per day.' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER glucose_readings_daily_limit
  BEFORE INSERT OR UPDATE ON public.glucose_readings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_glucose_readings_daily_limit();
-- PostgreSQL Schema for Sweety Blood Glucose Tracker

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL DEFAULT '',
  display_name VARCHAR(255),
  timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Glucose readings table
CREATE TABLE IF NOT EXISTS glucose_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reading_date DATE NOT NULL,
  time_slot VARCHAR(50) NOT NULL CHECK (time_slot IN ('Morning (fasting)', 'After breakfast', 'After lunch', 'After dinner')),
  value_mg_dl INTEGER NOT NULL CHECK (value_mg_dl BETWEEN 40 AND 600),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT glucose_readings_user_date_slot_unique UNIQUE(user_id, reading_date, time_slot)
);

CREATE INDEX IF NOT EXISTS idx_glucose_readings_user_date ON glucose_readings(user_id, reading_date DESC);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Enforce maximum 4 readings per day per user
CREATE OR REPLACE FUNCTION check_daily_reading_limit()
RETURNS TRIGGER AS $$
DECLARE
  reading_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO reading_count
  FROM glucose_readings
  WHERE user_id = NEW.user_id
    AND reading_date = NEW.reading_date
    AND (TG_OP <> 'UPDATE' OR id <> NEW.id);

  IF reading_count >= 4 THEN
    RAISE EXCEPTION 'You can add only 4 readings per day.' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_daily_reading_limit ON glucose_readings;
CREATE TRIGGER trg_check_daily_reading_limit
  BEFORE INSERT OR UPDATE OF reading_date ON glucose_readings
  FOR EACH ROW
  EXECUTE FUNCTION check_daily_reading_limit();


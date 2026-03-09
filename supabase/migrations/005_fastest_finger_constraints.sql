-- Asegurar constraints únicos para upsert (por si las tablas existían antes de la migración 004)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fastest_finger_rounds_event_round_id_key'
  ) THEN
    ALTER TABLE public.fastest_finger_rounds ADD CONSTRAINT fastest_finger_rounds_event_round_id_key UNIQUE (event_round_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fastest_finger_attempts_round_player_key'
  ) THEN
    ALTER TABLE public.fastest_finger_attempts ADD CONSTRAINT fastest_finger_attempts_round_player_key UNIQUE (fastest_finger_round_id, player_id);
  END IF;
END $$;

-- Marca al ganador de cada salón (1er lugar) como finalista para la Gran Final
ALTER TABLE public.event_players ADD COLUMN IF NOT EXISTS is_finalist boolean DEFAULT false;

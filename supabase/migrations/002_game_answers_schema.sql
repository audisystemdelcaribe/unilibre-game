-- Asegurar que game_answers tiene la estructura correcta para guardar respuestas
-- Ejecutar en Supabase SQL Editor si la tabla existe pero no guarda datos

-- Crear tabla si no existe (ajusta según tu esquema existente)
CREATE TABLE IF NOT EXISTS public.game_answers (
  id bigserial PRIMARY KEY,
  game_session_id integer NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  round_id integer NOT NULL REFERENCES public.event_rounds(id) ON DELETE CASCADE,
  event_id integer NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  player_id integer NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  classroom_group_id text,
  question_id integer NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer_id integer NOT NULL REFERENCES public.answers(id) ON DELETE CASCADE,
  is_correct boolean NOT NULL DEFAULT false,
  response_time_ms integer NOT NULL DEFAULT 0,
  money_at_question integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Si la tabla ya existe, agregar columnas faltantes (ignora errores si ya existen)
DO $$
BEGIN
  ALTER TABLE public.game_answers ADD COLUMN IF NOT EXISTS game_session_id integer;
  ALTER TABLE public.game_answers ADD COLUMN IF NOT EXISTS round_id integer;
  ALTER TABLE public.game_answers ADD COLUMN IF NOT EXISTS event_id integer;
  ALTER TABLE public.game_answers ADD COLUMN IF NOT EXISTS player_id integer;
  ALTER TABLE public.game_answers ADD COLUMN IF NOT EXISTS classroom_group_id text;
  ALTER TABLE public.game_answers ADD COLUMN IF NOT EXISTS question_id integer;
  ALTER TABLE public.game_answers ADD COLUMN IF NOT EXISTS answer_id integer;
  ALTER TABLE public.game_answers ADD COLUMN IF NOT EXISTS is_correct boolean DEFAULT false;
  ALTER TABLE public.game_answers ADD COLUMN IF NOT EXISTS response_time_ms integer DEFAULT 0;
  ALTER TABLE public.game_answers ADD COLUMN IF NOT EXISTS money_at_question integer DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; -- Columna ya existe
END $$;

-- RPC que inserta en game_answers (SECURITY DEFINER bypasea RLS)
CREATE OR REPLACE FUNCTION public.insert_game_answer(
  p_game_session_id integer,
  p_round_id integer,
  p_event_id integer,
  p_player_id integer,
  p_classroom_group_id text,
  p_question_id integer,
  p_answer_id integer,
  p_is_correct boolean,
  p_response_time_ms integer,
  p_money_at_question integer,
  p_level_id integer DEFAULT 1
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id bigint;
BEGIN
  INSERT INTO public.game_answers (
    game_session_id, round_id, event_id, player_id, classroom_group_id,
    question_id, answer_id, is_correct, response_time_ms, money_at_question, level_id
  ) VALUES (
    p_game_session_id, p_round_id, p_event_id, p_player_id, p_classroom_group_id,
    p_question_id, p_answer_id, p_is_correct, p_response_time_ms, p_money_at_question, p_level_id
  )
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

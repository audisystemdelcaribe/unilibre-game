-- =============================================================================
-- EJECUTAR EN SUPABASE SQL EDITOR - Corrige error "duplicate key" al responder
-- =============================================================================
-- Solución: una sola respuesta por pregunta por sesión. Si hay doble envío,
-- retornamos éxito (idempotente) en lugar de fallar.
-- =============================================================================

-- 0. Asegurar que level_id existe
ALTER TABLE public.game_answers ADD COLUMN IF NOT EXISTS level_id integer DEFAULT 1;

-- 1. Eliminar duplicados existentes (conservar el primero)
DELETE FROM public.game_answers a
USING public.game_answers b
WHERE a.game_session_id = b.game_session_id
  AND a.question_id = b.question_id
  AND a.id > b.id;

-- 2. Índice único (uno por sesión+pregunta)
CREATE UNIQUE INDEX IF NOT EXISTS game_answers_session_question_key
  ON public.game_answers(game_session_id, question_id);

-- 3. Función idempotente
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
  existing_id bigint;
BEGIN
  INSERT INTO public.game_answers (
    game_session_id, round_id, event_id, player_id, classroom_group_id,
    question_id, answer_id, is_correct, response_time_ms, money_at_question, level_id
  ) VALUES (
    p_game_session_id, p_round_id, p_event_id, p_player_id, p_classroom_group_id,
    p_question_id, p_answer_id, p_is_correct, p_response_time_ms, p_money_at_question, p_level_id
  )
  ON CONFLICT (game_session_id, question_id) DO NOTHING
  RETURNING id INTO new_id;

  IF new_id IS NULL THEN
    SELECT id INTO existing_id
    FROM public.game_answers
    WHERE game_session_id = p_game_session_id AND question_id = p_question_id
    LIMIT 1;
    RETURN existing_id;
  END IF;

  RETURN new_id;
END;
$$;

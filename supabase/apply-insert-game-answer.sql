-- Ejecutar en Supabase SQL Editor para crear/actualizar la función insert_game_answer
-- Esta función usa SECURITY DEFINER y bypasea RLS completamente

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

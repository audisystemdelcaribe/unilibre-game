-- =============================================================================
-- RESET PARA PRUEBA DESDE CERO - Unilibre Games
-- =============================================================================
-- Ejecutar en Supabase SQL Editor (Dashboard > SQL Editor)
-- Borra todos los datos de eventos, rondas, sesiones y respuestas.
-- MANTIENE: players, facultades, programas, materias, temporadas, niveles,
--           comodines, modos de juego, preguntas, respuestas, secuencias Mente más Rápida.
-- =============================================================================

TRUNCATE TABLE
  public.audience_lifeline_votes,
  public.student_answer_selection,
  public.round_lifeline_usage,
  public.game_answers,
  public.round_questions_shown,
  public.fastest_finger_attempts,
  public.fastest_finger_rounds,
  public.active_contestants,
  public.game_sessions,
  public.event_players,
  public.event_rounds,
  public.events
RESTART IDENTITY CASCADE;

-- =============================================================================
-- OPCIONAL: si quieres borrar también preguntas, respuestas y contenido
-- (descomenta el bloque siguiente)
-- =============================================================================
/*
TRUNCATE TABLE public.answers RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.questions RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.fastest_finger_items RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.fastest_finger_sequences RESTART IDENTITY CASCADE;
*/

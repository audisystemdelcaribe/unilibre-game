-- Tabla para registrar TODAS las preguntas mostradas en una ronda (aunque nadie responda)
-- Garantiza que nunca se repitan preguntas en una sesión
CREATE TABLE IF NOT EXISTS public.round_questions_shown (
  id serial PRIMARY KEY,
  round_id integer NOT NULL REFERENCES public.event_rounds(id) ON DELETE CASCADE,
  question_id integer NOT NULL REFERENCES public.questions(id),
  shown_at timestamptz DEFAULT now(),
  UNIQUE(round_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_round_questions_shown_round ON public.round_questions_shown(round_id);

-- Tiempo total acumulado por jugador en el evento (para desempate y transparencia)
ALTER TABLE public.event_players ADD COLUMN IF NOT EXISTS total_time_ms integer DEFAULT 0;

-- Posición final en el ranking (se actualiza al terminar la ronda)
ALTER TABLE public.event_players ADD COLUMN IF NOT EXISTS final_rank integer;

-- RPC para incrementar tiempo total (evita race conditions)
CREATE OR REPLACE FUNCTION public.add_player_time(p_player_id integer, p_event_id integer, p_response_ms integer)
RETURNS void AS $$
  UPDATE public.event_players
  SET total_time_ms = COALESCE(total_time_ms, 0) + p_response_ms
  WHERE player_id = p_player_id AND event_id = p_event_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Votos del público para el comodín "Ayuda del público"
-- round_id, question_id identifican la pregunta; answer_id es la opción votada; player_id es quien vota
CREATE TABLE IF NOT EXISTS public.audience_lifeline_votes (
  id serial PRIMARY KEY,
  round_id integer NOT NULL REFERENCES public.event_rounds(id) ON DELETE CASCADE,
  question_id integer NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer_id integer NOT NULL REFERENCES public.answers(id) ON DELETE CASCADE,
  player_id integer NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(round_id, question_id, player_id)
);

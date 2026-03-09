-- Comodines usados por el docente en una ronda/pregunta
CREATE TABLE IF NOT EXISTS public.round_lifeline_usage (
  id serial PRIMARY KEY,
  round_id integer NOT NULL REFERENCES public.event_rounds(id) ON DELETE CASCADE,
  question_id integer NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  lifeline_code varchar(50) NOT NULL,
  metadata jsonb,
  used_at timestamptz DEFAULT now(),
  UNIQUE(round_id, question_id, lifeline_code)
);

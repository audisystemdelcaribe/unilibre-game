-- Selección del estudiante (marca sin enviar) - para juego final con evaluación del docente
CREATE TABLE IF NOT EXISTS public.student_answer_selection (
  id serial PRIMARY KEY,
  round_id integer NOT NULL REFERENCES public.event_rounds(id) ON DELETE CASCADE,
  question_id integer NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  player_id integer NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  answer_id integer NOT NULL REFERENCES public.answers(id) ON DELETE CASCADE,
  selected_at timestamptz DEFAULT now(),
  UNIQUE(round_id, question_id, player_id)
);

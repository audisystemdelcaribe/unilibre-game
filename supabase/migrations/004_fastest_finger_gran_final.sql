-- Tablas para Mente más Rápida y Gran Final
-- event_rounds: permitir status 'fastest_finger' para el reto de ordenamiento
-- (Los valores típicos son: waiting, active, finished)

-- fastest_finger_rounds: ronda activa del reto (docente la crea al activar)
CREATE TABLE IF NOT EXISTS public.fastest_finger_rounds (
  id serial PRIMARY KEY,
  event_round_id integer NOT NULL REFERENCES public.event_rounds(id) ON DELETE CASCADE,
  sequence_id integer NOT NULL REFERENCES public.fastest_finger_sequences(id) ON DELETE CASCADE,
  started_at timestamptz DEFAULT now(),
  UNIQUE(event_round_id)
);

-- fastest_finger_attempts: respuestas de los finalistas (orden + tiempo)
CREATE TABLE IF NOT EXISTS public.fastest_finger_attempts (
  id serial PRIMARY KEY,
  fastest_finger_round_id integer NOT NULL REFERENCES public.fastest_finger_rounds(id) ON DELETE CASCADE,
  player_id integer NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  selected_order jsonb NOT NULL,
  response_time_ms integer NOT NULL DEFAULT 0,
  is_correct boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(fastest_finger_round_id, player_id)
);

-- active_contestants: ganador de Mente más Rápida → Silla Caliente
CREATE TABLE IF NOT EXISTS public.active_contestants (
  id serial PRIMARY KEY,
  event_id integer NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  player_id integer NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  round_id integer REFERENCES public.event_rounds(id) ON DELETE SET NULL,
  started_at timestamptz DEFAULT now(),
  UNIQUE(event_id)
);

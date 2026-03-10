-- =============================================================================
-- POLÍTICAS RLS (Row Level Security) - Unilibre Games
-- =============================================================================
-- Ejecutar en el SQL Editor de Supabase (Dashboard > SQL Editor)
-- Nota: El cliente con SUPABASE_SECRET_KEY (service role) BYPASEA RLS.
-- Estas políticas aplican cuando se usa el cliente anon/authenticated (publishable key).
-- =============================================================================

-- 1. Habilitar RLS en todas las tablas públicas
ALTER TABLE IF EXISTS public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.faculties ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.game_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.game_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lifelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.event_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.event_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.game_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fastest_finger_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fastest_finger_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fastest_finger_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fastest_finger_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.active_contestants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.round_lifeline_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_answer_selection ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audience_lifeline_votes ENABLE ROW LEVEL SECURITY;

-- 2. Función helper: verificar si el usuario actual es admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.players
    WHERE auth_user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. Función helper: verificar si es admin o docente (staff)
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.players
    WHERE auth_user_id = auth.uid() AND role IN ('admin', 'docente')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================================================
-- PLAYERS (usuarios/jugadores)
-- =============================================================================
-- Staff (admin y docente) puede leer todos los jugadores (necesario para radar de respuestas en panel de control)
DROP POLICY IF EXISTS "players_select_own_or_admin" ON public.players;
DROP POLICY IF EXISTS "players_select_own_or_staff" ON public.players;
CREATE POLICY "players_select_own_or_staff" ON public.players
  FOR SELECT USING (
    auth_user_id = auth.uid() OR public.is_staff()
  );

DROP POLICY IF EXISTS "players_update_admin_only" ON public.players;
CREATE POLICY "players_update_admin_only" ON public.players
  FOR UPDATE USING (public.is_admin());

-- INSERT en players: se hace por trigger al registrarse o por service role. Sin política = denegado para cliente.

DROP POLICY IF EXISTS "players_delete_admin_only" ON public.players;
CREATE POLICY "players_delete_admin_only" ON public.players
  FOR DELETE USING (public.is_admin());

-- =============================================================================
-- PROGRAMS, FACULTIES, SUBJECTS, SEASONS (lectura para autenticados)
-- =============================================================================
DROP POLICY IF EXISTS "programs_select_authenticated" ON public.programs;
CREATE POLICY "programs_select_authenticated" ON public.programs
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "faculties_select_authenticated" ON public.faculties;
CREATE POLICY "faculties_select_authenticated" ON public.faculties
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "subjects_select_authenticated" ON public.subjects;
CREATE POLICY "subjects_select_authenticated" ON public.subjects
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "seasons_select_authenticated" ON public.seasons;
CREATE POLICY "seasons_select_authenticated" ON public.seasons
  FOR SELECT USING (auth.role() = 'authenticated');

-- Escritura solo admin (cuando se usa cliente anon)
DROP POLICY IF EXISTS "programs_all_admin" ON public.programs;
CREATE POLICY "programs_all_admin" ON public.programs FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "faculties_all_admin" ON public.faculties;
CREATE POLICY "faculties_all_admin" ON public.faculties FOR ALL USING (public.is_admin());

-- =============================================================================
-- GAME_LEVELS, GAME_MODES, LIFELINES (solo admin escritura)
-- =============================================================================
DROP POLICY IF EXISTS "game_levels_select_authenticated" ON public.game_levels;
CREATE POLICY "game_levels_select_authenticated" ON public.game_levels
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "game_modes_select_authenticated" ON public.game_modes;
CREATE POLICY "game_modes_select_authenticated" ON public.game_modes
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "lifelines_select_authenticated" ON public.lifelines;
CREATE POLICY "lifelines_select_authenticated" ON public.lifelines
  FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- EVENTS (lectura para staff, escritura admin/staff)
-- =============================================================================
DROP POLICY IF EXISTS "events_select_authenticated" ON public.events;
CREATE POLICY "events_select_authenticated" ON public.events
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "events_insert_update_staff" ON public.events;
CREATE POLICY "events_insert_update_staff" ON public.events
  FOR ALL USING (public.is_staff());

-- =============================================================================
-- EVENT_ROUNDS (lectura para participantes y staff)
-- =============================================================================
DROP POLICY IF EXISTS "event_rounds_select_authenticated" ON public.event_rounds;
CREATE POLICY "event_rounds_select_authenticated" ON public.event_rounds
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "event_rounds_insert_update_staff" ON public.event_rounds;
CREATE POLICY "event_rounds_insert_update_staff" ON public.event_rounds
  FOR ALL USING (public.is_staff());

-- =============================================================================
-- EVENT_PLAYERS (participantes ven su grupo/evento)
-- =============================================================================
DROP POLICY IF EXISTS "event_players_select_authenticated" ON public.event_players;
CREATE POLICY "event_players_select_authenticated" ON public.event_players
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "event_players_insert_update_authenticated" ON public.event_players;
CREATE POLICY "event_players_insert_update_authenticated" ON public.event_players
  FOR ALL USING (auth.role() = 'authenticated');

-- =============================================================================
-- GAME_SESSIONS (jugador solo su sesión)
-- =============================================================================
DROP POLICY IF EXISTS "game_sessions_select_by_player" ON public.game_sessions;
CREATE POLICY "game_sessions_select_by_player" ON public.game_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.id = game_sessions.player_id AND players.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "game_sessions_insert_own" ON public.game_sessions;
CREATE POLICY "game_sessions_insert_own" ON public.game_sessions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.id = game_sessions.player_id AND players.auth_user_id = auth.uid()
    )
  );

-- =============================================================================
-- QUESTIONS, ANSWERS (lectura para autenticados, escritura staff)
-- =============================================================================
DROP POLICY IF EXISTS "questions_select_authenticated" ON public.questions;
CREATE POLICY "questions_select_authenticated" ON public.questions
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "questions_all_staff" ON public.questions;
CREATE POLICY "questions_all_staff" ON public.questions
  FOR ALL USING (public.is_staff());

DROP POLICY IF EXISTS "answers_select_authenticated" ON public.answers;
CREATE POLICY "answers_select_authenticated" ON public.answers
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "answers_all_staff" ON public.answers;
CREATE POLICY "answers_all_staff" ON public.answers
  FOR ALL USING (public.is_staff());

-- =============================================================================
-- GAME_ANSWERS (inserta el jugador al responder, lee staff)
-- =============================================================================
DROP POLICY IF EXISTS "game_answers_select_staff" ON public.game_answers;
CREATE POLICY "game_answers_select_staff" ON public.game_answers
  FOR SELECT USING (public.is_staff());

-- INSERT: jugador puede insertar su propia respuesta (player_id debe coincidir)
DROP POLICY IF EXISTS "game_answers_insert_own" ON public.game_answers;
CREATE POLICY "game_answers_insert_own" ON public.game_answers
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.players WHERE players.id = game_answers.player_id AND players.auth_user_id = auth.uid())
  );

-- =============================================================================
-- FASTEST FINGER (Mente más Rápida)
-- =============================================================================
-- Secuencias: lectura para autenticados (ver retos), escritura solo admin
DROP POLICY IF EXISTS "fastest_finger_sequences_select_authenticated" ON public.fastest_finger_sequences;
CREATE POLICY "fastest_finger_sequences_select_authenticated" ON public.fastest_finger_sequences
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "fastest_finger_sequences_all_admin" ON public.fastest_finger_sequences;
CREATE POLICY "fastest_finger_sequences_all_admin" ON public.fastest_finger_sequences
  FOR ALL USING (public.is_admin());

-- Items: lectura para autenticados (ver ítems del reto al jugar)
DROP POLICY IF EXISTS "fastest_finger_items_select_authenticated" ON public.fastest_finger_items;
CREATE POLICY "fastest_finger_items_select_authenticated" ON public.fastest_finger_items
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "fastest_finger_items_all_admin" ON public.fastest_finger_items;
CREATE POLICY "fastest_finger_items_all_admin" ON public.fastest_finger_items
  FOR ALL USING (public.is_admin());

-- Rounds: lectura para autenticados (jugadores ven el reto activo), escritura staff
DROP POLICY IF EXISTS "fastest_finger_rounds_select_authenticated" ON public.fastest_finger_rounds;
CREATE POLICY "fastest_finger_rounds_select_authenticated" ON public.fastest_finger_rounds
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "fastest_finger_rounds_all_staff" ON public.fastest_finger_rounds;
CREATE POLICY "fastest_finger_rounds_all_staff" ON public.fastest_finger_rounds
  FOR ALL USING (public.is_staff());

-- Attempts: solo staff puede leer (panel de control). INSERT se hace vía service role.
DROP POLICY IF EXISTS "fastest_finger_attempts_select_staff" ON public.fastest_finger_attempts;
CREATE POLICY "fastest_finger_attempts_select_staff" ON public.fastest_finger_attempts
  FOR SELECT USING (public.is_staff());

-- active_contestants: staff puede leer (para Silla Caliente)
DROP POLICY IF EXISTS "active_contestants_select_staff" ON public.active_contestants;
CREATE POLICY "active_contestants_select_staff" ON public.active_contestants
  FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS "active_contestants_all_staff" ON public.active_contestants;
CREATE POLICY "active_contestants_all_staff" ON public.active_contestants
  FOR ALL USING (public.is_staff());

-- =============================================================================
-- ROUND_LIFELINE_USAGE (comodines usados por el docente)
-- =============================================================================
-- Lectura: autenticados (estudiante ve si 50:50 aplicado; staff en panel)
DROP POLICY IF EXISTS "round_lifeline_usage_select_authenticated" ON public.round_lifeline_usage;
CREATE POLICY "round_lifeline_usage_select_authenticated" ON public.round_lifeline_usage
  FOR SELECT USING (auth.role() = 'authenticated');

-- INSERT/UPDATE: solo staff (docente activa comodines)
DROP POLICY IF EXISTS "round_lifeline_usage_insert_staff" ON public.round_lifeline_usage;
CREATE POLICY "round_lifeline_usage_insert_staff" ON public.round_lifeline_usage
  FOR INSERT WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "round_lifeline_usage_update_staff" ON public.round_lifeline_usage;
CREATE POLICY "round_lifeline_usage_update_staff" ON public.round_lifeline_usage
  FOR UPDATE USING (public.is_staff());

-- =============================================================================
-- STUDENT_ANSWER_SELECTION (selección del estudiante, sin enviar)
-- =============================================================================
-- SELECT: staff (panel docente) o el propio jugador (ver su selección)
DROP POLICY IF EXISTS "student_answer_selection_select" ON public.student_answer_selection;
CREATE POLICY "student_answer_selection_select" ON public.student_answer_selection
  FOR SELECT USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.players
      WHERE players.id = student_answer_selection.player_id AND players.auth_user_id = auth.uid()
    )
  );

-- INSERT/UPDATE: el jugador solo puede insertar/actualizar su propia selección
DROP POLICY IF EXISTS "student_answer_selection_insert_own" ON public.student_answer_selection;
CREATE POLICY "student_answer_selection_insert_own" ON public.student_answer_selection
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.id = student_answer_selection.player_id AND players.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "student_answer_selection_update_own" ON public.student_answer_selection;
CREATE POLICY "student_answer_selection_update_own" ON public.student_answer_selection
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.id = student_answer_selection.player_id AND players.auth_user_id = auth.uid()
    )
  );

-- DELETE: solo staff (cuando el docente evalúa y limpia)
DROP POLICY IF EXISTS "student_answer_selection_delete_staff" ON public.student_answer_selection;
CREATE POLICY "student_answer_selection_delete_staff" ON public.student_answer_selection
  FOR DELETE USING (public.is_staff());

-- =============================================================================
-- AUDIENCE_LIFELINE_VOTES (votación del público en comodín Ayuda del público)
-- =============================================================================
-- SELECT: autenticados pueden leer votos (para gráfica en panel y estudiante)
DROP POLICY IF EXISTS "audience_lifeline_votes_select_authenticated" ON public.audience_lifeline_votes;
CREATE POLICY "audience_lifeline_votes_select_authenticated" ON public.audience_lifeline_votes
  FOR SELECT USING (auth.role() = 'authenticated');

-- INSERT: autenticados pueden votar solo con su propio player_id
DROP POLICY IF EXISTS "audience_lifeline_votes_insert_own" ON public.audience_lifeline_votes;
CREATE POLICY "audience_lifeline_votes_insert_own" ON public.audience_lifeline_votes
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND player_id IN (
      SELECT id FROM public.players WHERE auth_user_id = auth.uid()
    )
  );

-- UPDATE: para upsert (cambiar voto): solo el propio jugador
DROP POLICY IF EXISTS "audience_lifeline_votes_update_own" ON public.audience_lifeline_votes;
CREATE POLICY "audience_lifeline_votes_update_own" ON public.audience_lifeline_votes
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND player_id IN (
      SELECT id FROM public.players WHERE auth_user_id = auth.uid()
    )
  );

-- =============================================================================
-- NOTA SOBRE auth.users
-- =============================================================================
-- La tabla auth.users es gestionada por Supabase Auth.
-- Cambios de contraseña se hacen con auth.admin.updateUserById() desde el backend
-- usando SUPABASE_SECRET_KEY (service role), que tiene acceso total.
-- No se definen políticas RLS sobre auth.users.
-- =============================================================================

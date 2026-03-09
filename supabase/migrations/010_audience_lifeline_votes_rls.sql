-- RLS para audience_lifeline_votes (votación del público en comodín Ayuda del público)
ALTER TABLE IF EXISTS public.audience_lifeline_votes ENABLE ROW LEVEL SECURITY;

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

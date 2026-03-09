-- Ejecutar en Supabase SQL Editor
-- Crea la función is_staff() y actualiza la política de players

-- 1. Crear función is_staff (admin o docente)
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.players
    WHERE auth_user_id = auth.uid() AND role IN ('admin', 'docente')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Actualizar política de players para permitir lectura a staff
DROP POLICY IF EXISTS "players_select_own_or_admin" ON public.players;
DROP POLICY IF EXISTS "players_select_own_or_staff" ON public.players;
CREATE POLICY "players_select_own_or_staff" ON public.players
  FOR SELECT USING (
    auth_user_id = auth.uid() OR public.is_staff()
  );

-- Resultado de verificación para mostrar animaciones al estudiante (Clásico)
ALTER TABLE public.event_rounds ADD COLUMN IF NOT EXISTS verification_result jsonb;

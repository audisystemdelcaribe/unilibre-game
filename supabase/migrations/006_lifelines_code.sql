-- Agregar código a lifelines para identificar funcionalidad (50:50, saltar, llamada, público)
ALTER TABLE public.lifelines ADD COLUMN IF NOT EXISTS code varchar(50);

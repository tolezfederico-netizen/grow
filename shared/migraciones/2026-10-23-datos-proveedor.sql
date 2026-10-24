-- =============================================================================
-- Migración incremental 2026-10-23 — Tarea 1.10 (datos legales del proveedor)
--
-- Para una instancia que YA tiene datos. Correr entero en el SQL Editor de
-- Supabase (idempotente). Orden: primero esta migración, después el deploy
-- del admin y de la tienda (ambos leen las columnas nuevas).
--
-- Después: regenerar tipos con
--   supabase gen types typescript --linked > shared/src/supabase/database.types.ts
-- =============================================================================

BEGIN;

-- ── 7b. Datos legales del proveedor en configuracion_tienda ──────────────────
-- Exigidos para comercio electrónico (Res. 270/2020, Res. GMC 37/2019): razón
-- social, CUIT y domicilio físico. Quedan vacíos en la demo y se completan al
-- personalizar para cada negocio. La tienda los muestra en Términos y en la
-- política de privacidad; si están vacíos, usa nombre_tienda y direccion.
ALTER TABLE configuracion_tienda ADD COLUMN IF NOT EXISTS razon_social text;
ALTER TABLE configuracion_tienda ADD COLUMN IF NOT EXISTS cuit text;
ALTER TABLE configuracion_tienda ADD COLUMN IF NOT EXISTS domicilio_legal text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'config_cuit_check'
  ) THEN
    ALTER TABLE configuracion_tienda
      ADD CONSTRAINT config_cuit_check CHECK (cuit IS NULL OR cuit ~ '^[0-9]{11}$');
  END IF;
END $$;

COMMENT ON COLUMN configuracion_tienda.razon_social IS
  'Razón social del titular (dato legal del proveedor). NULL = no cargada; la tienda usa nombre_tienda.';
COMMENT ON COLUMN configuracion_tienda.cuit IS
  'CUIT del titular, solo los 11 dígitos (el admin quita guiones). NULL = no cargado.';
COMMENT ON COLUMN configuracion_tienda.domicilio_legal IS
  'Domicilio legal del titular. NULL = no cargado; la tienda usa direccion.';

COMMIT;


-- Verificación (correr aparte):
--   SELECT razon_social, cuit, domicilio_legal FROM configuracion_tienda;  -- NULL en la demo

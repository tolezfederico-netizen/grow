-- =============================================================================
-- Grow — Schema de base de datos (Postgres / Supabase)
--
-- Correr en el SQL Editor de Supabase al crear una instancia nueva.
-- Orden: extensiones → tablas (respetando dependencias FK) → índices → triggers
-- =============================================================================

-- ── Extensiones ──────────────────────────────────────────────────────────────
-- pgcrypto ya viene habilitado en Supabase; gen_random_uuid() está disponible
-- de forma predeterminada, no requiere CREATE EXTENSION explícito.
-- Si se usara una instancia Postgres vanilla sin Supabase, descomentar:
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ── 1. productos ────────────────────────────────────────────────────────────

CREATE TABLE productos (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          text        NOT NULL,
  descripcion     text,                           -- nullable: no todos los productos requieren descripción
  especificaciones text,                          -- nullable: contenido extenso tipo ficha técnica (specs, composición, modo de uso)
  imagen_url      text,                           -- nullable: puede no tener imagen al crearse
  tiene_variantes boolean     NOT NULL DEFAULT false,
  precio_base     numeric,                        -- nullable → NOT NULL según CHECK cuando tiene_variantes = false
  estado          text        NOT NULL DEFAULT 'disponible',
  creado_en       timestamptz NOT NULL DEFAULT now(),

  -- Defensa en profundidad: replica la regla del discriminated union de TypeScript
  CONSTRAINT productos_precio_check
    CHECK (
      (tiene_variantes = true  AND precio_base IS NULL)
      OR
      (tiene_variantes = false AND precio_base IS NOT NULL)
    ),

  CONSTRAINT productos_estado_check
    CHECK (estado IN ('disponible', 'pausado', 'sin_stock'))
);

COMMENT ON COLUMN productos.descripcion IS 'Nullable — no todos los productos requieren descripción detallada';
COMMENT ON COLUMN productos.especificaciones IS 'Nullable — contenido extenso tipo ficha técnica (specs, composición, modo de uso), separado de la descripción corta';
COMMENT ON COLUMN productos.imagen_url IS 'URL en Supabase Storage (bucket imagenes-productos), formato WebP';
COMMENT ON COLUMN productos.tiene_variantes IS 'Si true, el precio vive en producto_variantes; si false, se usa precio_base';
COMMENT ON COLUMN productos.precio_base IS 'NOT NULL cuando tiene_variantes = false; NULL cuando tiene_variantes = true';
COMMENT ON COLUMN productos.estado IS 'disponible | pausado | sin_stock (la eliminación es un DELETE físico, no un cuarto estado)';

-- RLS: esta tabla SÍ tiene Row Level Security habilitado (a diferencia del resto
-- del proyecto). El frontend del client usa la clave pública (anon) y solo debe
-- poder leer productos 'disponible' o 'sin_stock' — nunca 'pausado'. El admin usa
-- una policy de gestión completa (probablemente vía service_role o rol autenticado).
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestión completa para administradores" ON productos FOR ALL USING (true);

CREATE POLICY "Lectura pública de productos disponibles" ON productos FOR SELECT USING (estado IN ('disponible', 'sin_stock'));


-- ── 2. categorias ───────────────────────────────────────────────────────────

CREATE TABLE categorias (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre    text        NOT NULL,
  estado    text        NOT NULL DEFAULT 'activa',

  CONSTRAINT categorias_nombre_unique UNIQUE (nombre),
  CONSTRAINT categorias_estado_check CHECK (estado IN ('activa', 'pausada'))
);


-- ── 3. producto_categorias (relación M:N) ───────────────────────────────────

CREATE TABLE producto_categorias (
  producto_id  uuid NOT NULL REFERENCES productos(id)  ON DELETE CASCADE,
  categoria_id uuid NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,

  PRIMARY KEY (producto_id, categoria_id)
);

-- Índice para acelerar búsqueda "productos que pertenecen a una categoría"
-- (la PK ya cubre el lookup por producto_id; este índice cubre el inverso)
CREATE INDEX idx_producto_categorias_categoria
  ON producto_categorias (categoria_id);


-- ── 4. producto_variantes ───────────────────────────────────────────────────

CREATE TABLE producto_variantes (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id      uuid        NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  nombre_variante  text        NOT NULL,
  precio           numeric     NOT NULL,
  estado           text        NOT NULL DEFAULT 'disponible',

  CONSTRAINT variantes_precio_check  CHECK (precio > 0),
  CONSTRAINT variantes_estado_check  CHECK (estado IN ('disponible', 'pausado'))
);

COMMENT ON COLUMN producto_variantes.nombre_variante IS 'Ej: "10L", "20L", "40L", "70L"';
COMMENT ON COLUMN producto_variantes.precio IS 'Precio propio de esta variante (independiente de precio_base del padre)';

CREATE INDEX idx_variantes_producto ON producto_variantes (producto_id);
COMMENT ON INDEX idx_variantes_producto IS 'Cubre el lookup inverso pedido_items → variante, y listado de variantes de un producto';


-- ── 5. pedidos ───────────────────────────────────────────────────────────────

CREATE TABLE pedidos (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_nombre   text        NOT NULL,
  cliente_telefono text        NOT NULL,
  cliente_email    text        NOT NULL,
  usuario_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  estado           text        NOT NULL DEFAULT 'pendiente',
  total            numeric     NOT NULL,
  creado_en        timestamptz NOT NULL DEFAULT now(),
  actualizado_en   timestamptz NOT NULL DEFAULT now(),
  eliminado        boolean     NOT NULL DEFAULT false,

  CONSTRAINT pedidos_estado_check
    CHECK (estado IN ('pendiente', 'confirmado', 'listo_para_retirar', 'completado', 'cancelado')),

  CONSTRAINT pedidos_total_check CHECK (total >= 0)
);

COMMENT ON COLUMN pedidos.cliente_telefono IS 'Obligatorio — usado para contacto vía WhatsApp';
COMMENT ON COLUMN pedidos.cliente_email IS 'Obligatorio — usado para envío de email vía Edge Function de Supabase';
COMMENT ON COLUMN pedidos.eliminado IS 'Borrado lógico: true oculta el pedido de la vista normal sin perder su estado ni datos';
COMMENT ON COLUMN pedidos.usuario_id IS 'Nullable: conviven checkout invitado y checkout logueado. Si el pedido lo crea un cliente autenticado, se guarda su auth.users.id; si no, queda NULL.';


-- ── 6. pedido_items ──────────────────────────────────────────────────────────
--
-- Columnas congeladas al momento de la compra:
--   precio_unitario — snapshot del precio, no referencia viva
--   nombre_producto — snapshot del nombre del producto en el momento de la compra,
--                     permite eliminar productos sin perder el historial legible.
-- Si el producto se borra después, producto_id pasa a NULL (SET NULL).

CREATE TABLE pedido_items (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       uuid    NOT NULL REFERENCES pedidos(id)             ON DELETE CASCADE,
  producto_id     uuid    REFERENCES productos(id)                    ON DELETE SET NULL,
  variante_id     uuid    REFERENCES producto_variantes(id)           ON DELETE SET NULL,
  cantidad        integer NOT NULL,
  precio_unitario numeric NOT NULL,
  nombre_producto text    NOT NULL,

  CONSTRAINT items_cantidad_check       CHECK (cantidad > 0),
  CONSTRAINT items_precio_unitario_check CHECK (precio_unitario >= 0)
);

COMMENT ON COLUMN pedido_items.precio_unitario IS 'Congelado al momento de la compra — no es referencia viva al precio actual';
COMMENT ON COLUMN pedido_items.nombre_producto IS 'Snapshot del nombre del producto al momento de la compra. Permite eliminar productos sin perder el historial legible.';
COMMENT ON COLUMN pedido_items.variante_id IS 'Nullable: un pedido puede incluir productos con y sin variante';
COMMENT ON CONSTRAINT pedido_items_producto_id_fkey ON pedido_items IS 'SET NULL: si se elimina el producto, producto_id pasa a null pero nombre_producto conserva el historial';
COMMENT ON CONSTRAINT pedido_items_variante_id_fkey ON pedido_items IS 'SET NULL: si se elimina la variante (por borrado del producto padre en cascada), variante_id pasa a null';


-- ── 7. configuracion_tienda (fila única) ─────────────────────────────────────
--
-- Estrategia singleton: columna `singleton` con CHECK que fuerza el valor true
-- y UNIQUE que permite como máximo una fila. Es el mecanismo más simple y no
-- requiere introducir un UUID artificial con valor fijo.

CREATE TABLE configuracion_tienda (
  singleton            boolean NOT NULL DEFAULT true,
  nombre_tienda        text    NOT NULL,
  direccion            text    NOT NULL,
  telefono             text    NOT NULL,
  email_contacto       text,
  horario_apertura     text    NOT NULL,
  horario_cierre       text    NOT NULL,
  redes_sociales       jsonb   NOT NULL DEFAULT '{}'::jsonb,
  red_social_destacada text,
  mensaje_alerta       text,

  CONSTRAINT config_singleton_unique UNIQUE (singleton),
  CONSTRAINT config_singleton_check CHECK (singleton = true),

  -- Formato: email con cualquier TLD válido de 2+ letras (.com, .com.ar, .net, etc.).
  -- Nota: se removió la restricción previa a TLD ".com" exacto (decisión de negocio revertida) —
  -- ahora acepta cualquier TLD válido de 2+ letras, alineado con la validación del frontend
  -- en shared/src/utils/validarEmail.ts.
  -- Nullable a nivel de columna (para no romper la fila singleton existente antes de que el admin
  -- lo cargue por primera vez); la obligatoriedad real se exige en el formulario de SettingsPage.
  CONSTRAINT config_email_contacto_check
    CHECK (email_contacto IS NULL OR email_contacto ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

COMMENT ON COLUMN configuracion_tienda.redes_sociales IS 'jsonb flexible: {"instagram": "...", "tiktok": "..."} — claves en minúscula, valores URL completas';
COMMENT ON COLUMN configuracion_tienda.email_contacto IS 'Email de contacto público del local, consumido por el client. Formato validado: cualquier email con TLD válido de 2+ letras (.com, .com.ar, .net, etc.). Nullable hasta que el admin lo carga desde SettingsPage.';
COMMENT ON COLUMN configuracion_tienda.red_social_destacada IS 'Clave (debe existir dentro de redes_sociales) de la única red social que se muestra en el Banner del client. NULL = no se muestra ninguna, aunque haya redes cargadas.';


-- ── 8. paneles_categoria ─────────────────────────────────────────────────────

CREATE TABLE paneles_categoria (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      text        NOT NULL,
  descripcion text,
  orden       integer,                          -- nullable: NULL = "sin asignar", se posiciona automáticamente
  estado      text        NOT NULL DEFAULT 'activo',
  creado_en   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT paneles_categoria_estado_check
    CHECK (estado IN ('activo', 'pausado')),

  -- UNIQUE permite múltiples filas con NULL (Postgres no las considera duplicadas),
  -- pero bloquea dos paneles con el mismo número de orden fijo.
  CONSTRAINT paneles_categoria_orden_unique UNIQUE (orden)
);

COMMENT ON COLUMN paneles_categoria.titulo IS 'Título mostrado en el panel desplegable del header';
COMMENT ON COLUMN paneles_categoria.descripcion IS 'Subtítulo opcional debajo del título';
COMMENT ON COLUMN paneles_categoria.orden IS 'Posición manual 1..N en la navbar (menor = primero). NULL = sin asignar: el frontend lo posiciona automáticamente en un hueco libre, respetando los paneles con orden fijo.';
COMMENT ON COLUMN paneles_categoria.estado IS 'activo | pausado';


-- ── 9. paneles_categoria_items ───────────────────────────────────────────────

CREATE TABLE paneles_categoria_items (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id       uuid    NOT NULL REFERENCES paneles_categoria(id) ON DELETE CASCADE,
  categoria_id   uuid    NOT NULL REFERENCES categorias(id)        ON DELETE RESTRICT,
  nombre_visible text,
  orden          integer NOT NULL DEFAULT 0
);

COMMENT ON COLUMN paneles_categoria_items.nombre_visible IS 'Override opcional del nombre de la categoría en la card. Si es null, el frontend debe usar categorias.nombre';
COMMENT ON COLUMN paneles_categoria_items.orden IS 'Orden dentro del panel (menor = primero)';

CREATE INDEX idx_paneles_categoria_items_panel ON paneles_categoria_items (panel_id);
COMMENT ON INDEX idx_paneles_categoria_items_panel IS 'Cubre el lookup de items por panel en el header del client';


-- ── 10. paneles_categoria_items_productos ────────────────────────────────────

CREATE TABLE paneles_categoria_items_productos (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid    NOT NULL REFERENCES paneles_categoria_items(id) ON DELETE CASCADE,
  producto_id uuid    NOT NULL REFERENCES productos(id)               ON DELETE RESTRICT,
  orden       integer NOT NULL DEFAULT 0
);

COMMENT ON COLUMN paneles_categoria_items_productos.orden IS 'Orden de la imagen dentro de la card (menor = primera)';
COMMENT ON CONSTRAINT paneles_categoria_items_productos_item_id_fkey ON paneles_categoria_items_productos IS 'CASCADE: si se borra el item, se borran sus productos asociados';
COMMENT ON CONSTRAINT paneles_categoria_items_productos_producto_id_fkey ON paneles_categoria_items_productos IS 'RESTRICT: preservar la referencia, el admin debe desvincular manualmente';

CREATE INDEX idx_paneles_categoria_items_productos_item ON paneles_categoria_items_productos (item_id);
COMMENT ON INDEX idx_paneles_categoria_items_productos_item IS 'Cubre el lookup de productos asociados a un item de panel';


-- ── Índices adicionales ───────────────────────────────────────────────────────
-- NOTA: idx_variantes_producto NO se repite acá — ya fue creado en la sección 4,
-- inmediatamente junto a la tabla producto_variantes que indexa. Crearlo de
-- nuevo acá rompería con "relation already exists".

-- Filtro rápido: listar productos disponibles en el catálogo público (client)
CREATE INDEX idx_productos_estado ON productos (estado);

-- Filtro rápido: listar pedidos por estado en el panel de admin (OrdersPage)
CREATE INDEX idx_pedidos_estado ON pedidos (estado);

-- Ordenamiento cronológico de pedidos (dashboard, historial)
CREATE INDEX idx_pedidos_creado ON pedidos (creado_en DESC);

-- Filtro rápido: listar pedidos no eliminados por defecto en OrdersPage
CREATE INDEX idx_pedidos_eliminado ON pedidos (eliminado)
  WHERE eliminado = true;


-- ── Trigger: actualizado_en automático ────────────────────────────────────────

CREATE OR REPLACE FUNCTION actualizar_timestamp_pedidos() RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_pedidos_actualizado
  BEFORE UPDATE ON pedidos
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_timestamp_pedidos();


-- ── Trigger: validación de transiciones de estado de pedido ──────────────────
-- Rechaza cualquier UPDATE que intente cambiar pedidos.estado a un valor no
-- contemplado en la matriz de transiciones válida. Un UPDATE que no modifica
-- estado (ej. el toggle de "eliminado") se permite sin restricción.

CREATE OR REPLACE FUNCTION public.validar_transicion_pedido() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = OLD.estado THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.estado = 'pendiente' AND NEW.estado IN ('confirmado', 'cancelado')) OR
    (OLD.estado = 'confirmado' AND NEW.estado IN ('listo_para_retirar', 'cancelado')) OR
    (OLD.estado = 'listo_para_retirar' AND NEW.estado IN ('completado', 'cancelado'))
  ) THEN
    RAISE EXCEPTION 'Transición de estado de pedido inválida: % → %', OLD.estado, NEW.estado
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_transicion_pedido ON pedidos;
CREATE TRIGGER trg_validar_transicion_pedido
  BEFORE UPDATE ON pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_transicion_pedido();


-- =============================================================================
-- Bloque opcional: creación del bucket de Storage
--
-- Si se prefiere crear el bucket desde SQL en vez del dashboard, descomentar:
--
--   INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
--   VALUES (
--     'imagenes-productos',
--     'imagenes-productos',
--     true,                                     -- público: las imágenes se sirven sin token de autenticación
--     5242880,                                  -- 5 MB de límite por archivo
--     ARRAY['image/webp', 'image/jpeg', 'image/png']::text[]
--   );
--
-- Esto requiere el rol adecuado (service_role o superadmin) y no es necesario
-- para el funcionamiento del schema. Se puede crear manualmente desde el
-- dashboard de Supabase (Storage → Create bucket) con id "imagenes-productos".
-- =============================================================================


-- =============================================================================
-- Migraciones desde schema v1
--
-- Este bloque es seguro de correr tanto en una base nueva (no-op) como en una
-- base existente con datos reales. Todas las operaciones usan IF EXISTS /
-- IF NOT EXISTS para ser idempotentes.
-- =============================================================================

-- ── 6a. Snapshot nombre_producto en pedido_items ──────────────────────────────

ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS nombre_producto text;

-- Backfill: poblar nombre_producto para pedidos existentes que ya tienen items
UPDATE pedido_items pi
SET nombre_producto = p.nombre
FROM productos p
WHERE p.id = pi.producto_id
  AND pi.nombre_producto IS NULL;

ALTER TABLE pedido_items ALTER COLUMN nombre_producto SET NOT NULL;


-- ── 6b. Relajar FKs de pedido_items para permitir DELETE físico ──────────────

ALTER TABLE pedido_items DROP CONSTRAINT IF EXISTS pedido_items_producto_id_fkey;
ALTER TABLE pedido_items ALTER COLUMN producto_id DROP NOT NULL;
ALTER TABLE pedido_items ADD CONSTRAINT pedido_items_producto_id_fkey
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE SET NULL;

ALTER TABLE pedido_items DROP CONSTRAINT IF EXISTS pedido_items_variante_id_fkey;
ALTER TABLE pedido_items ADD CONSTRAINT pedido_items_variante_id_fkey
  FOREIGN KEY (variante_id) REFERENCES producto_variantes(id) ON DELETE SET NULL;


-- ── 5a. Columna eliminado en pedidos ──────────────────────────────────────────

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS eliminado boolean NOT NULL DEFAULT false;


-- ── 7a. Email de contacto en configuracion_tienda ────────────────────────────

ALTER TABLE configuracion_tienda ADD COLUMN IF NOT EXISTS email_contacto text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'config_email_contacto_check'
  ) THEN
    ALTER TABLE configuracion_tienda DROP CONSTRAINT config_email_contacto_check;
  END IF;

  ALTER TABLE configuracion_tienda
    ADD CONSTRAINT config_email_contacto_check
    CHECK (email_contacto IS NULL OR email_contacto ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
END $$;


-- ── 7b. Red social destacada en el Banner ────────────────────────────────────

ALTER TABLE configuracion_tienda ADD COLUMN IF NOT EXISTS red_social_destacada text;

COMMENT ON COLUMN configuracion_tienda.red_social_destacada IS 'Clave de redes_sociales que se muestra en el Banner del client. Nullable — si es NULL o apunta a una clave que ya no existe en redes_sociales, el Banner no muestra ninguna red social.';


-- ── 8a. paneles_categoria.orden → nullable + UNIQUE ("sin asignar") ──────────
--
-- Habilita el estado "sin asignar" (NULL) y prohíbe que dos paneles compartan
-- el mismo número de orden. Antes de aplicar el UNIQUE, resuelve automáticamente
-- cualquier duplicado preexistente: para cada valor de orden repetido, conserva
-- el panel más antiguo (por creado_en) con ese número y pasa el resto a NULL.

ALTER TABLE paneles_categoria ALTER COLUMN orden DROP DEFAULT;
ALTER TABLE paneles_categoria ALTER COLUMN orden DROP NOT NULL;

WITH duplicados AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY orden ORDER BY creado_en ASC) AS rn
  FROM paneles_categoria
  WHERE orden IS NOT NULL
)
UPDATE paneles_categoria pc
SET orden = NULL
FROM duplicados d
WHERE pc.id = d.id AND d.rn > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'paneles_categoria_orden_unique'
  ) THEN
    ALTER TABLE paneles_categoria
      ADD CONSTRAINT paneles_categoria_orden_unique UNIQUE (orden);
  END IF;
END $$;


-- ── 9a. es_card + límite de cards visuales + UNIQUE por panel ────────────────

ALTER TABLE paneles_categoria_items ADD COLUMN IF NOT EXISTS es_card boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION fn_validar_max_items_panel() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.es_card = true THEN
    IF (SELECT COUNT(*) FROM paneles_categoria_items WHERE panel_id = NEW.panel_id AND es_card = true) >= 4 THEN
      RAISE EXCEPTION 'Un panel no puede tener más de 4 categorías marcadas como card visual';
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.es_card = true AND (OLD.es_card IS DISTINCT FROM true) THEN
    IF (SELECT COUNT(*) FROM paneles_categoria_items WHERE panel_id = NEW.panel_id AND es_card = true AND id <> NEW.id) >= 4 THEN
      RAISE EXCEPTION 'Un panel no puede tener más de 4 categorías marcadas como card visual';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_max_items_panel ON paneles_categoria_items;
CREATE TRIGGER trg_validar_max_items_panel
  BEFORE INSERT OR UPDATE ON paneles_categoria_items
  FOR EACH ROW EXECUTE FUNCTION fn_validar_max_items_panel();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'paneles_categoria_items_panel_id_categoria_id_key'
  ) THEN
    ALTER TABLE paneles_categoria_items
      ADD CONSTRAINT paneles_categoria_items_panel_id_categoria_id_key UNIQUE (panel_id, categoria_id);
  END IF;
END $$;


-- ── 1b. productos.especificaciones ───────────────────────────────────────────
--
-- Columna para contenido extenso tipo ficha técnica (specs, composición, modo de uso).
-- Separada de descripcion (texto corto/resumen). Texto plano, nullable.
--
-- ALTER TABLE productos ADD COLUMN IF NOT EXISTS especificaciones text;
--
-- COMMENT ON COLUMN productos.especificaciones IS 'Nullable — contenido extenso tipo ficha técnica (specs, composición, modo de uso), separado de la descripción corta';


-- ── 1c. productos.destacado + límite de 10 destacados ────────────────────────

ALTER TABLE productos ADD COLUMN IF NOT EXISTS destacado boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN productos.destacado IS 'Producto elegido por el admin para aparecer en el carrusel de destacados del Home (máx. 10 simultáneos)';


-- ── 11a. sucursales (locales adicionales, opcional) ──────────────────────────

CREATE TABLE IF NOT EXISTS sucursales (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre    text        NOT NULL,
  direccion text        NOT NULL,
  orden     integer     NOT NULL DEFAULT 0,
  creado_en timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE sucursales IS 'Locales adicionales del negocio, más allá de la dirección principal en configuracion_tienda.direccion. Comparten horario/teléfono/redes con configuracion_tienda — solo nombre y dirección son propios de cada sucursal.';
COMMENT ON COLUMN sucursales.orden IS 'Orden de aparición en el selector del client (menor = primero)';

-- Supabase habilita RLS automáticamente en tablas creadas desde el SQL Editor.
-- Se desactiva explícitamente para esta tabla (a diferencia de `productos`,
-- que sí tiene RLS habilitado — ver sección de policies más abajo).
ALTER TABLE sucursales DISABLE ROW LEVEL SECURITY;


CREATE OR REPLACE FUNCTION fn_validar_max_destacados() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.destacado = true AND (SELECT COUNT(*) FROM productos WHERE destacado = true) >= 10 THEN
      RAISE EXCEPTION 'No se pueden marcar más de 10 productos como destacados';
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.destacado = true AND (OLD.destacado IS DISTINCT FROM true) THEN
    IF (SELECT COUNT(*) FROM productos WHERE destacado = true AND id <> NEW.id) >= 10 THEN
      RAISE EXCEPTION 'No se pueden marcar más de 10 productos como destacados';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_max_destacados ON productos;
CREATE TRIGGER trg_validar_max_destacados
  BEFORE INSERT OR UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION fn_validar_max_destacados();


-- ── 13. admins (allowlist de administradores) ────────────────────────────────
--
-- Fuente de verdad de qué usuarios de auth.users son administradores.
-- Reubicada acá desde rls.sql para seguir la convención del proyecto
-- (schema.sql = definición de tablas, rls.sql = políticas). Las políticas,
-- la función is_admin() y el seed del admin siguen viviendo en rls.sql.

CREATE TABLE IF NOT EXISTS admins (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  creado_en  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE admins IS 'Allowlist de usuarios de auth.users con permisos de administrador. Las políticas RLS que antes usaban TO authenticated USING (true) ahora verifican EXISTS en esta tabla.';

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;


-- ── 14. clientes (perfil de usuarios finales) ────────────────────────────────
--
-- Perfil 1:1 con auth.users para usuarios finales registrados en el client.
-- Reubicada acá desde rls.sql por el mismo motivo que admins. Las políticas
-- y el trigger de alta automática (handle_new_cliente) siguen en rls.sql.

CREATE TABLE IF NOT EXISTS clientes (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  apellido   text NOT NULL,
  email      text NOT NULL,
  telefono   text,
  creado_en  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE clientes IS 'Perfil de usuarios finales registrados en el client vía Supabase Auth. 1:1 con auth.users. El admin los lee para poder contactarlos.';

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Decisiones de diseño (revisar antes de ejecutar en producción)
-- =============================================================================
--
-- 1. ON DELETE producto_variantes.producto_id → CASCADE
--    Motivo: si se elimina físicamente un producto (baja explícita del admin),
--    sus variantes no tienen sentido sin el padre y deben eliminarse con él.
--
-- 2. ON DELETE pedido_items.producto_id → SET NULL
--    Motivo: ahora el historial de pedidos se preserva mediante el snapshot
--    nombre_producto en pedido_items, no por la FK. El admin puede eliminar
--    físicamente un producto; sus pedidos históricos conservan el nombre del
--    producto comprado. producto_id pasa a NULL en los items de esos pedidos.
--    Anteriormente era RESTRICT.
--
-- 3. ON DELETE pedido_items.variante_id → SET NULL
--    Motivo: mismo criterio que producto_id. Si se borra el producto padre
--    (que cascada a sus variantes), la variante_id de items históricos pasa
--    a NULL. El nombre del producto queda preservado en nombre_producto.
--    Anteriormente era RESTRICT.
--
-- 4. Singleton de configuracion_tienda → columna booleana con UNIQUE + CHECK
--    Motivo: sin necesidad de UUID artificial, sin dependencies externas.
--    CHECK forza singleton = true; UNIQUE permite a lo sumo una fila con true.
--    Alternativa descartada: PRIMARY KEY con UUID fijo — más verboso sin beneficio real.
--
-- 5. categorias.nombre → UNIQUE
--    Motivo: no tiene sentido tener dos categorías con el mismo nombre en la
--    misma instancia de tienda.
--
-- 6. productos.descripcion → nullable
--    Motivo: un producto mínimo (nombre + precio) es válido; la descripción es
--    un enriquecimiento opcional.
--
-- 7. productos.imagen_url → nullable
--    Motivo: un producto puede registrarse sin imagen y asignarse después.
--
-- 8. Extensiones → pgcrypto ya viene habilitado en Supabase (gen_random_uuid()
--    funciona sin CREATE EXTENSION explícito).
--
-- 9. configuracion_tienda.email_contacto → columna nueva, no tabla nueva
--    Motivo: es un dato escalar más de la config general de la tienda, igual
--    que telefono o direccion. Crear una tabla aparte para un único campo
--    hubiera sido sobre-ingeniería y rompía el patrón "todo lo que varía por
--    negocio vive en configuracion_tienda" ya establecido en el documento de
--    arquitectura. Nullable a nivel de columna (para no romper la fila
--    singleton ya existente en instancias en producción); el formulario de
--    SettingsPage en admin es responsable de exigirlo como campo obligatorio
--    en la UI. Formato validado por CHECK: acepta cualquier email con TLD
--    válido de 2+ letras (.com, .com.ar, .net, etc.) — la restricción previa
--    a TLD ".com" exacto fue removida (decisión de negocio revertida), y el
--    CHECK quedó alineado con la validación del frontend en
--    shared/src/utils/validarEmail.ts.
--
-- 10. paneles_categoria.orden → de NOT NULL DEFAULT 0 a nullable + UNIQUE
--     Motivo: el valor 0 no comunicaba "sin asignar" y permitía duplicados,
--     lo que rompía el criterio de posicionamiento manual en la navbar del
--     client. NULL ahora representa "sin asignar" (se posiciona automático);
--     UNIQUE impide dos paneles con el mismo número fijo, sin afectar a los
--     NULL (Postgres no los trata como duplicados entre sí).
--
-- 11. productos.destacado → boolean + trigger de límite (máx. 10)
--     Motivo: el admin elige manualmente qué productos aparecen en el carrusel
--     de destacados del Home del client. El límite de 10 evita que el carrusel
--     se vuelva inmanejable; se valida a nivel de base de datos (no solo en la
--     UI) con el mismo patrón ya usado para es_card en paneles_categoria_items,
--     contando globalmente sobre toda la tabla (no hay agrupación por padre,
--     a diferencia de es_card que se cuenta por panel_id).
--
-- 12. sucursales → tabla aparte, no columna en configuracion_tienda
--     Motivo: a diferencia de email_contacto (un único valor escalar), las
--     sucursales son una lista de cardinalidad variable (0..N) donde cada
--     elemento tiene múltiples campos (nombre, dirección). Meter un jsonb
--     array en configuracion_tienda habría funcionado, pero complicaba las
--     consultas individuales (ej: ordenar por nombre, buscar una dirección)
--     y perdía la integridad referencial y tipado fuerte de una tabla real.
--     Una tabla separada sigue el mismo patrón que producto_variantes respecto
--     a productos: relación 1:N con la entidad principal, cada fila con su
--     propia identidad y orden. No se usa RLS por coherencia con el resto del
--     schema (ninguna tabla del proyecto tiene RLS habilitado).
-- =============================================================================


-- ── Vencimiento de mensaje_alerta ─────────────────────────────────────────────
ALTER TABLE configuracion_tienda ADD COLUMN IF NOT EXISTS mensaje_alerta_expira_en timestamptz;
COMMENT ON COLUMN configuracion_tienda.mensaje_alerta_expira_en IS
  'Momento en el que mensaje_alerta se borra automáticamente vía cron job (ver shared/rpc.sql o documentación de infraestructura). NULL = sin vencimiento.';
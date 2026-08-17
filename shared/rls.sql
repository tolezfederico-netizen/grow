-- =============================================================================
-- Grow — Políticas RLS (Row Level Security)
--
-- Multi-tenancy por instancia separada: un solo usuario admin por base de datos.
-- Roles: anon (visitante público) y authenticated (admin logueado con Supabase Auth).
-- =============================================================================

-- =============================================================================
-- Tabla admins — fuente de verdad de qué usuarios autenticados son administradores
-- =============================================================================
--
-- A diferencia del resto de las tablas del proyecto, autenticación de clientes
-- (usuarios finales del client) usa el mismo mecanismo de Supabase Auth que el
-- admin. Para no darle acceso administrativo a cualquier cliente logueado, las
-- políticas que antes asumían "authenticated = admin" ahora chequean membresía
-- en esta tabla en vez de aceptar cualquier sesión autenticada.

-- Sin políticas adicionales: por defecto, con RLS habilitado y sin policies,
-- nadie puede hacer SELECT/INSERT/UPDATE/DELETE directo sobre admins desde
-- el rol anon ni authenticated. Los EXISTS(...) dentro de otras políticas
-- SÍ pueden leerla porque no pasan por RLS de la misma manera (se evalúan
-- como parte de la política del recurso consultado, no como un SELECT
-- directo del cliente sobre admins).

-- =============================================================================
-- Función is_admin() — verifica membresía en admins evitando el RLS de la
-- propia tabla admins (SECURITY DEFINER corre con privilegios elevados).
-- =============================================================================
--
-- Un EXISTS directo contra admins desde dentro de otra política NO funciona:
-- las subconsultas dentro de políticas RLS siguen sujetas al RLS de la tabla
-- consultada, y admins no tiene ninguna política de SELECT. Esta función
-- resuelve ese problema.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Sembrar el admin actual. Reemplazar 'EMAIL_DEL_ADMIN_ACTUAL' por el email
-- real que usa hoy el admin para loguearse en LoginPage.tsx antes de correr
-- este bloque contra la base real.
INSERT INTO admins (id)
SELECT id FROM auth.users WHERE email = 'EMAIL_DEL_ADMIN_ACTUAL'
ON CONFLICT (id) DO NOTHING;

-- ── 1. productos ──────────────────────────────────────────────────────────

ALTER TABLE productos ENABLE ROW LEVEL SECURITY;

-- DROP defensivo: schema.sql (versión histórica) crea sobre esta misma tabla
-- una policy "Gestión completa para administradores" con USING (true), es
-- decir, sin chequear is_admin() — le daba control total a cualquier usuario
-- autenticado, no solo a admins. Si este archivo corre después de schema.sql
-- contra una base nueva, el CREATE POLICY de abajo fallaría por nombre
-- duplicado y esa versión insegura quedaría activa silenciosamente. Los DROP
-- de acá garantizan que, sin importar qué versión de schema.sql corrió antes,
-- las políticas que terminan activas son siempre las de este archivo.
DROP POLICY IF EXISTS "Gestión completa para administradores" ON productos;
DROP POLICY IF EXISTS "Lectura pública de productos disponibles" ON productos;

CREATE POLICY "Lectura pública de productos disponibles"
  ON productos FOR SELECT
  TO anon, authenticated
  USING (estado = 'disponible');

CREATE POLICY "Gestión completa para administradores"
  ON productos FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ── 2. producto_variantes ────────────────────────────────────────────────

ALTER TABLE producto_variantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de variantes disponibles"
  ON producto_variantes FOR SELECT
  TO anon, authenticated
  USING (
    estado = 'disponible'
    AND EXISTS (
      SELECT 1 FROM productos
      WHERE productos.id = producto_id
      AND productos.estado = 'disponible'
    )
  );

CREATE POLICY "Gestión completa para administradores"
  ON producto_variantes FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ── 3. categorias ────────────────────────────────────────────────────────

ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de categorías activas"
  ON categorias FOR SELECT
  TO anon, authenticated
  USING (estado = 'activa');

CREATE POLICY "Gestión completa para administradores"
  ON categorias FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ── 4. producto_categorias ───────────────────────────────────────────────

ALTER TABLE producto_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de relaciones"
  ON producto_categorias FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Gestión completa para administradores"
  ON producto_categorias FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ── 5. pedidos ────────────────────────────────────────────────────────────

ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura de pedidos para administradores"
  ON pedidos FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Actualización de pedidos para administradores"
  ON pedidos FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Lectura de pedidos propios para clientes"
  ON pedidos FOR SELECT
  TO authenticated
  USING (auth.uid() = usuario_id);

-- Nota intencional: anon no tiene SELECT ni DELETE sobre pedidos.
-- Ver sección de aclaraciones al final del archivo.


-- ── 6. pedido_items ──────────────────────────────────────────────────────

ALTER TABLE pedido_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura de items para administradores"
  ON pedido_items FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Lectura de items de pedidos propios para clientes"
  ON pedido_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pedidos
      WHERE pedidos.id = pedido_items.pedido_id
      AND pedidos.usuario_id = auth.uid()
    )
  );

-- Nota intencional: admin tiene SELECT completo sobre pedido_items;
-- clientes autenticados tienen SELECT solo sobre los items de sus propios pedidos;
-- anon no tiene SELECT sobre pedido_items; nadie (ni admin ni cliente)
-- tiene INSERT/UPDATE/DELETE sobre pedido_items.


-- ── 7. configuracion_tienda ──────────────────────────────────────────────

ALTER TABLE configuracion_tienda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de configuración"
  ON configuracion_tienda FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Lectura para administradores"
  ON configuracion_tienda FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Inserción para administradores"
  ON configuracion_tienda FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Actualización para administradores"
  ON configuracion_tienda FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Nota intencional: no hay DELETE porque es una tabla singleton.
-- Tampoco hay FOR ALL separado para SELECT porque ya hay políticas
-- de SELECT separadas para anon y authenticated (fueron intencionales
-- para claridad, aunque una sola FOR ALL TO authenticated también
-- hubiera funcionado — se dejan separadas para documentar la intención).


-- ── 8. paneles_categoria ─────────────────────────────────────────────────

ALTER TABLE paneles_categoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de paneles activos"
  ON paneles_categoria FOR SELECT
  TO anon, authenticated
  USING (estado = 'activo');

CREATE POLICY "Gestión completa para administradores"
  ON paneles_categoria FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ── 9. paneles_categoria_items ───────────────────────────────────────────

ALTER TABLE paneles_categoria_items ENABLE ROW LEVEL SECURITY;

-- Nota intencional: anon SELECT sin filtro propio. El filtro de visibilidad
-- se aplica en el padre (paneles_categoria.estado = 'activo') cuando el
-- frontend arma el árbol. Es el mismo criterio que producto_categorias.

CREATE POLICY "Lectura pública de items de panel"
  ON paneles_categoria_items FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Gestión completa para administradores"
  ON paneles_categoria_items FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ── 10. paneles_categoria_items_productos ────────────────────────────────

ALTER TABLE paneles_categoria_items_productos ENABLE ROW LEVEL SECURITY;

-- Nota intencional: mismo criterio que paneles_categoria_items y
-- producto_categorias — el filtro de visibilidad se delega al padre.

CREATE POLICY "Lectura pública de productos asociados a items"
  ON paneles_categoria_items_productos FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Gestión completa para administradores"
  ON paneles_categoria_items_productos FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- =============================================================================
-- Storage: bucket imagenes-productos
-- =============================================================================

-- Las políticas de Storage se aplican sobre la tabla storage.objects.
-- Por defecto, Supabase activa RLS en storage.objects automáticamente.
-- Si no está activado, descomentar la línea siguiente:
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de imágenes"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'imagenes-productos');

CREATE POLICY "Subida de imágenes para administradores"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'imagenes-productos'
    AND public.is_admin()
  );

CREATE POLICY "Actualización de imágenes para administradores"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'imagenes-productos'
    AND public.is_admin()
  )
  WITH CHECK (
    bucket_id = 'imagenes-productos'
    AND public.is_admin()
  );

CREATE POLICY "Eliminación de imágenes para administradores"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'imagenes-productos'
    AND public.is_admin()
  );


-- =============================================================================
-- Notas sobre diseño
-- =============================================================================
--
-- Los tres problemas documentados originalmente en esta sección fueron
-- resueltos mediante la función RPC crear_pedido_completo (shared/rpc.sql):
--
--   1. anon sin SELECT en pedidos     → la RPC es SECURITY DEFINER y
--                                       devuelve el pedido creado con su id.
--   2. anon sin DELETE en pedidos     → la transacción es atómica dentro de
--                                       la RPC, no hay rollback manual.
--   3. anon INSERT en pedido_items    → solo la RPC puede insertar items,
--       sin validación de pedido_id     y valida producto/variante antes.
--
-- La RPC también protege contra manipulación del total (lo recalcula desde
-- los items) y valida disponibilidad de productos en el momento de la compra.
-- =============================================================================


-- El propio cliente puede leer y actualizar solo su propia fila.
CREATE POLICY "Lectura del propio perfil"
  ON clientes FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Actualización del propio perfil"
  ON clientes FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- El admin puede leer todos los perfiles, para poder contactar a los clientes.
-- Usa public.is_admin() (no un EXISTS directo) por el mismo motivo ya resuelto
-- en las políticas de admins: is_admin() es SECURITY DEFINER y evita el
-- problema de RLS anidado que ya causó un incidente en una tarea anterior.
CREATE POLICY "Lectura de todos los perfiles para administradores"
  ON clientes FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Nota intencional: no hay política de INSERT directo desde el cliente ni el
-- admin. La fila se crea automáticamente vía trigger (ver Paso 3) cuando el
-- usuario se registra en auth.users — nunca por un INSERT manual desde la app.
-- Tampoco hay DELETE: si se necesita en el futuro, se agrega como tarea aparte
-- una vez que se defina la política de baja de cuenta.

-- =============================================================================
-- Trigger: alta automática en clientes al registrarse en auth.users
-- =============================================================================
--
-- El client, al llamar a supabase.auth.signUp(), debe pasar nombre, apellido
-- y telefono dentro de options.data, ej:
--
--   supabase.auth.signUp({
--     email, password,
--     options: { data: { nombre, apellido, telefono } }
--   })
--
-- Este trigger lee esos valores desde raw_user_meta_data y crea la fila de
-- perfil correspondiente en clientes automáticamente.

CREATE OR REPLACE FUNCTION public.handle_new_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.clientes (id, nombre, apellido, email, telefono)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', ''),
    COALESCE(NEW.raw_user_meta_data->>'apellido', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'telefono'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_cliente ON auth.users;

CREATE TRIGGER on_auth_user_created_cliente
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_cliente();
-- =============================================================================
-- Auditoría 2026-10 — Diagnóstico de producción (SOLO LECTURA)
--
-- Correr en el SQL Editor de Supabase, bloque por bloque, y pasar los
-- resultados. No modifica nada.
-- =============================================================================

-- 1. RLS habilitado por tabla (todas deberían dar rowsecurity = true)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. Todas las policies reales (comparar contra shared/rls.sql)
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;

-- 3. Privilegios de anon/authenticated sobre las tablas
--    (en Supabase por defecto tienen ALL; RLS es lo único que frena)
SELECT table_name, grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privilegios
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;

-- 4. Funciones del schema public: quién es dueño, si son SECURITY DEFINER,
--    search_path y quién puede ejecutarlas (todas quedan expuestas en /rpc)
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       p.prosecdef AS security_definer,
       p.proconfig AS config,
       p.proacl AS permisos
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- 5. Definición real en producción de la RPC de pedidos
--    (puede haber más de una versión con distinta cantidad de parámetros)
SELECT pg_get_function_identity_arguments(p.oid) AS args, pg_get_functiondef(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'crear_pedido_completo';

-- 6. Triggers activos
SELECT event_object_schema, event_object_table, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE event_object_schema IN ('public', 'auth')
ORDER BY event_object_table, trigger_name;

-- 7. Bucket de imágenes: público, límite de tamaño y MIME permitidos
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets;

-- 8. Jobs de pg_cron
SELECT jobid, schedule, command, active FROM cron.job;

-- 9. Admins actuales (verificar que sean solo los esperados)
SELECT a.id, u.email, a.creado_en
FROM admins a JOIN auth.users u ON u.id = a.id;

-- 10. Señales de abuso ya ocurrido
--     10a. Items cuyo precio no coincide con el precio actual de catálogo
--          (puede dar falsos positivos si el admin cambió precios después;
--          lo sospechoso son precios muy bajos, ej. 0 o 1)
SELECT pi.pedido_id, pi.nombre_producto, pi.precio_unitario,
       COALESCE(pv.precio, p.precio_base) AS precio_catalogo_actual
FROM pedido_items pi
LEFT JOIN productos p ON p.id = pi.producto_id
LEFT JOIN producto_variantes pv ON pv.id = pi.variante_id
WHERE pi.precio_unitario <> COALESCE(pv.precio, p.precio_base)
ORDER BY pi.pedido_id;

--     10b. Pedidos con usuario_id cuyo email no coincide con el del usuario
SELECT pe.id, pe.cliente_email, u.email AS email_usuario, pe.creado_en
FROM pedidos pe JOIN auth.users u ON u.id = pe.usuario_id
WHERE lower(pe.cliente_email) <> lower(u.email);

--     10c. Sucursales (si RLS está apagado, cualquiera pudo escribir acá)
SELECT * FROM sucursales ORDER BY orden;

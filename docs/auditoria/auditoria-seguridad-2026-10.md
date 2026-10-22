# Auditoría de seguridad y consistencia — 2026-10-22

Alcance: `shared/` (SQL, cliente Supabase, mappers), `supabase/functions`, `client/`, `admin/`, configuración de deploy, historial de git y dependencias. No hubo acceso a la base de producción: lo que depende del estado real de Supabase está marcado **[verificar en prod]** y se resuelve con [diagnostico.sql](diagnostico.sql). Las correcciones de base están en [correcciones.sql](correcciones.sql).

Modelo de amenaza: la `anon key` y la URL de Supabase son públicas (están en el JS del client). Cualquiera puede hablarle directo a PostgREST, a `/rpc`, a Storage y a las Edge Functions sin pasar por la UI. Además, cualquiera puede crearse una cuenta (registro abierto), así que "estar autenticado" no significa nada: la única barrera real es RLS + `is_admin()`.

## Resultado del diagnóstico en producción (2026-10-22)

| Punto | Estado real |
|---|---|
| #1 Precio manipulable | **Confirmado**, y además hay **dos versiones** de `crear_pedido_completo` (4 y 5 parámetros), ambas vulnerables e invocables por anon. C1 borra la vieja. No hay pedidos con precio alterado (10a vacío). |
| #3 `sucursales` sin RLS | **Confirmado** (`rowsecurity = false`, anon con INSERT/UPDATE/DELETE). La única fila es legítima. |
| #4 `usuario_id` del navegador | Confirmado en el código. Hay 1 pedido de `yo@gmail.com` con email `seabas@gmail.com`: el checkout logueado deja escribir otro email (probable prueba manual, no abuso). |
| #5 `productos` con `USING (true)` | **Descartado**: producción tiene las policies correctas de `rls.sql`. |
| #10 Funciones expuestas | **Confirmado**: las 9 funciones de `public` tienen EXECUTE para `PUBLIC`/anon. |
| #11 Storage | **Confirmado**: bucket sin límite de tamaño ni de tipos. |
| #14 `sin_stock` invisible | **Confirmado**: la lectura pública solo deja `disponible`; los productos sin stock no aparecen en la tienda. C3 lo corrige (incluye variantes). |
| Privilegios de tabla | anon/authenticated tienen ALL, incluido `TRUNCATE` (no pasa por RLS). C8 los recorta. |
| Admins | Uno solo (`grow@gmail.com`). |
| Pendiente CLAUDE.md "auditar pg_policies" | **Resuelto**: `productos`, `admins` y `clientes` coinciden con `rls.sql`; `configuracion_tienda` tiene una policy de lectura de admin redundante (inofensiva). |

## Estado de las correcciones

| # | Estado |
|---|---|
| 1, 3, 4, 6 (base), 9, 10, 11, 14 | **Aplicado en producción** (correcciones.sql C1–C8) y trasladado a `shared/*.sql`. |
| 2 Edge Function | **Deployada y probada** (email de confirmación recibido). Ahora exige `is_admin()`, recibe solo `pedido_id` + `estado`, lee todo de la base, escapa el HTML, toma `nombre_tienda` de la configuración, y el remitente se puede configurar con el secret `RESEND_FROM`. |
| 4 (client) | `ResumePage` ya no manda `p_usuario_id` ni `precio_unitario`; solo muestra los errores propios de la RPC (P0001). |
| 8 | Links de redes: el client solo los acepta con `https:`; Configuración del admin no deja guardar otros. |
| 12 | Headers en ambos `vercel.json` (CSP, nosniff, Referrer-Policy, Permissions-Policy; el admin además lleva `noindex`). Probados contra el build con la base real: sin bloqueos. La CSP permite `*.supabase.co`; si una instancia usa dominio propio de Supabase, hay que agregarlo. |
| 13 | `AuthContext` del admin: no vuelve a verificar ni desmonta la página si el usuario no cambió. |
| Mi Cuenta | Los pedidos eliminados por el admin ya no se le muestran al cliente (filtro en `MiCuentaPage` + C9 en las policies de `pedidos` y `pedido_items`). Aplicado y verificado. |
| 16, 19 | `opener = null` en la ventana de WhatsApp; la caché de Mi Cuenta se vacía en el logout. |
| 20 | `npm audit fix` aplicado (resuelta la alta). Quedan `react-router` 6.x (no hay redirects con input del usuario; el fix es migrar a v7) y `uuid` en `exceljs` (no explotable). |
| 21 | supabase-js fijado a `2.109.0` vía `npm:` en `deno.json`; `Deno.serve` en vez de `std@0.168`. |
| 7 Auth | Confirmación de email activada; contraseña mínima 8 con letras y números (también en `RegisterPage`). Leaked password protection: no disponible en el plan free. Falta revisar Site URL / Redirect URLs. |
| 10 (cron) | `limpiar_mensaje_alerta_vencido` y su `cron.schedule` versionados en `rpc.sql`. |
| 17 | Código de país `54`: **excepción aceptada** (clientes nacionales); se revisa si aparece uno de otro país. |
| URLs de Auth | Site URL = tienda publicada; Redirect URLs con `/**` para la tienda y `localhost:5173`. El registro manda `emailRedirectTo` con el origen actual. Probado desde localhost. |
| Login/registro | Con sesión abierta redirigen al inicio (`SoloInvitadoRoute`). |
| Pendientes | **Antes de vender**: dominio propio verificado en Resend → SMTP propio en Supabase (remitente con el nombre de la tienda, límite de envíos mayor que el del servidor por defecto), template de confirmación en español y secret `RESEND_FROM` de la Edge Function. Además: #15, #18 parcial, #23. |

---

## Críticos

### 1. Se puede comprar a cualquier precio (manipulación del total)
`shared/rpc.sql:84-87` y `:103` — `crear_pedido_completo` calcula el total con el `precio_unitario` **que manda el navegador** y lo guarda tal cual en `pedido_items`. El comentario de la función dice lo contrario ("calcula el total del lado del servidor"). El precio de la variante incluso se lee (`pv.precio`) y nunca se usa.

Explotación: desde la consola del navegador, `supabase.rpc('crear_pedido_completo', { ..., p_items: [{ producto_id, cantidad: 10, precio_unitario: 1 }] })`. El pedido entra con total $10 y el admin lo ve como legítimo. `precio_unitario: 0` también pasa (el CHECK es `>= 0`). Tampoco se exige variante en productos con variantes.

Corrección: **C1** de `correcciones.sql` (precio desde catálogo, variante obligatoria si corresponde).

### 2. Edge Function = relay de emails abierto con la cuenta de Resend del negocio
`supabase/functions/enviar-notificacion-pedido/index.ts:104-168` — solo verifica que haya **algún** usuario logueado (`getUser()`), no que sea admin, y arma el email con lo que viene en el body: destinatario, nombre, items, total. Como el registro de clientes es abierto, cualquiera crea una cuenta y puede mandar emails arbitrarios a cualquier dirección desde la cuenta del negocio (phishing con su marca, quema de cuota, baneo del dominio en Resend).

Agravantes: el HTML se arma sin escapar (`${body.cliente_nombre}`, `${i.nombre_producto}`) → inyección de HTML/links en el email; `verify_jwt = false` en `supabase/config.toml`; CORS `*`; devuelve al navegador el texto de error crudo de Resend.

Corrección (código, requiere redeploy de la función): verificar `is_admin()` con el token del que llama, recibir **solo `pedido_id` y `estado`**, leer pedido + items de la base, escapar todo texto antes de meterlo en el HTML, y usar `nombre_tienda` de `configuracion_tienda` en vez de "Grow" fijo (hoy viola el principio de genericidad).

### 3. `sucursales` sin RLS — cualquiera puede crear/editar/borrar locales  **[verificar en prod]**
`shared/schema.sql:502` — `ALTER TABLE sucursales DISABLE ROW LEVEL SECURITY`. En Supabase anon/authenticated tienen privilegios completos sobre las tablas de `public`; sin RLS no hay nada que frene un `DELETE` o un `INSERT` con la anon key. Impacto real: alguien cambia la dirección de retiro que ve el comprador (fraude/estafa en la puerta de otro lugar) o borra todas las sucursales. El comentario del schema ("ninguna tabla del proyecto tiene RLS") quedó desactualizado.

Corrección: **C2**.

### 4. Pedidos colgados en la cuenta de otro usuario
`shared/rpc.sql:30,92` + `client/src/pages/ResumePage.tsx:130` — `usuario_id` viene del parámetro `p_usuario_id` que manda el navegador. Un anónimo puede crear pedidos asignados a cualquier `uuid`, que luego aparecen en "Mi cuenta" de esa persona. Requiere conocer el uuid (no se expone fácilmente), por eso no es el peor, pero es un fallo de autorización clásico.

Corrección: **C1** usa `auth.uid()` e ignora el parámetro. Después, quitar `p_usuario_id` del client.

---

## Altos

### 5. `productos`: posible policy `FOR ALL USING (true)` sin rol  **[verificar en prod]**
`shared/schema.sql:53` crea `"Gestión completa para administradores" ... FOR ALL USING (true)` **sin `TO`**, o sea para `anon` también. `rls.sql` la dropea y la recrea bien, pero el propio proyecto ya tuvo un caso de policy que nunca llegó a producción (v12 §7.5). Si la versión insegura quedó, cualquiera puede editar precios o borrar el catálogo con la anon key. Es justamente el pendiente "auditar pg_policies" del CLAUDE.md.

Corrección: **C3** (idempotente; además alinea la lectura pública con lo que el client espera, ver #14).

### 6. Sin validación ni límites en la creación de pedidos (spam / DoS del panel)
La RPC acepta nombre, teléfono y email de cualquier largo y formato, cualquier cantidad de items y cualquier `cantidad` (hasta 2³¹). Un script puede llenar la tabla de pedidos de basura en minutos y dejar inutilizable OrdersPage, o meter megabytes por fila. El teléfono sin validar además termina en `https://wa.me/54${telefono}` del admin.

Corrección: **C1** valida formato/largos, máx. 50 items, cantidad 1–999 y un freno de 3 pedidos por teléfono cada 10 min. Es un freno básico (se esquiva variando el teléfono); si aparece abuso real, la opción robusta es un captcha (Cloudflare Turnstile) verificado en una Edge Function antes de crear el pedido.

### 7. Configuración de Auth en el dashboard  **[verificar en prod]**
No es código, pero define la superficie:
- **Confirm email** debe estar activado (Authentication → Providers → Email). Si no, cualquiera se registra con un email ajeno.
- Contraseña mínima: hoy el client exige 6. Subir a 8+ en Authentication → Policies y en `RegisterPage.tsx`.
- Activar **leaked password protection** y revisar los rate limits de Auth.
- Site URL y Redirect URLs: solo los dominios reales del client.
- Para el admin, considerar MFA (TOTP) — es la cuenta que puede todo.

---

## Medios

### 8. Links `javascript:` en redes sociales (XSS almacenado vía admin)
`client/src/utils/redesSociales.tsx:10-44` — la URL solo se valida con `new URL()`, que acepta `javascript:alert(1)`. React 18 no bloquea `javascript:` en `href` (solo avisa en consola). Requiere escribir en `configuracion_tienda` (admin, o cualquiera si hubiera una policy rota), pero la defensa es de una línea: exigir `protocol === 'https:'`. Mismo criterio para el campo en `SettingsPage`.

### 9. El perfil de cliente permite cambiar el email
`shared/rls.sql:340-344` — la policy de UPDATE deja editar cualquier columna de la propia fila, incluido `email`. El admin (CustomersPage y el export a Excel) vería un email que no es el de la cuenta. Corrección: **C4** (UPDATE solo de nombre/apellido/teléfono + largos máximos).

### 10. Funciones `SECURITY DEFINER` expuestas por `/rpc`
En Postgres toda función nace con `EXECUTE` para `PUBLIC`, y Supabase expone todo `public` en `/rpc`. `is_admin`, `handle_new_cliente` y `limpiar_mensaje_alerta_vencido` (esta última ni siquiera está en el repo, solo en producción) quedan invocables por anon. Hoy no son dañinas, pero es superficie innecesaria. Corrección: **C6**. Además, versionar `limpiar_mensaje_alerta_vencido` y el `cron.schedule` en `rpc.sql`.

### 11. Storage sin restricción de tipo ni tamaño  **[verificar en prod]**
`admin/src/components/ProductForm.tsx:95-99` — `accept="image/*"` (incluye SVG), la extensión sale del nombre del archivo y no hay límite de tamaño. Si el bucket se creó desde el dashboard sin `allowed_mime_types`, se puede subir SVG/HTML con scripts. Corrección: **C7**. Además, las imágenes reemplazadas o de productos borrados nunca se eliminan del bucket (crecen huérfanas en el plan free). El comentario de `IMAGEN_PRODUCTO_PESO_OBJETIVO_KB` menciona una "Edge Function de resize" que no existe.

### 12. Sin headers de seguridad en Vercel
`client/vercel.json` y `admin/vercel.json` solo tienen el rewrite. Faltan, como mínimo:
- `Content-Security-Policy` (al menos `frame-ancestors`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- En el admin: `frame-ancestors 'none'` (evita clickjacking sobre "cancelar pedido", "eliminar producto") y `X-Robots-Tag: noindex` para que el panel no aparezca en Google.

### 13. El admin se desmonta en cada refresh del token
`admin/src/context/AuthContext.tsx:63-72` — cualquier evento de auth (incluido `TOKEN_REFRESHED`, ~cada hora, y los que dispara volver a la pestaña) pone `loading = true`, y `ProtectedRoute` devuelve `null`: se desmonta toda la página y **se pierde lo que el admin estaba cargando en un formulario**. Además, llamar a `supabase.rpc` dentro del callback de `onAuthStateChange` es un patrón que supabase-js documenta como posible deadlock. Corrección: re-verificar `is_admin` solo si cambió el `user.id`, y diferir la llamada con `setTimeout(…, 0)`.

---

## Bajos / inconsistencias

14. **`sin_stock` invisible por RLS**: `rls.sql:72` deja leer solo `disponible`, pero el client filtra `['disponible', 'sin_stock']` en ProductsPage, HeaderTop y FeaturedCarousel, y el schema dice que `sin_stock` es público. Si producción sigue a `rls.sql`, los productos sin stock desaparecen de la tienda en vez de mostrarse como "sin stock". C3 lo alinea.
15. **Paneles pausados filtran datos**: `paneles_categoria_items` y `..._productos` tienen lectura `USING (true)`; los items de paneles pausados (y los ids de productos pausados) se leen con la anon key. Bajo impacto; se puede filtrar por el estado del padre como en `producto_variantes`.
16. **`window.open("", "_blank")` sin `noopener`** (`admin/src/pages/OrdersPage.tsx:275`): la pestaña de WhatsApp conserva `window.opener` hacia el admin. Agregar `whatsappWindow.opener = null`.
17. **Genericidad**: `54` (código de Argentina) fijo en los links de WhatsApp del admin (`OrdersPage.tsx:305,525`, `CustomersPage.tsx:144`); "Grow" fijo en el email, el asunto, el nombre del Excel (`Clientes_Grow_…`) y el `<title>` de ambos `index.html`; `from: onboarding@resend.dev` (sandbox: solo entrega al email de la cuenta de Resend — ya listado como pendiente).
18. **Errores crudos al usuario**: `ResumePage.tsx:141` muestra `error.message` de Postgres; los mensajes de la RPC están bien, pero un error inesperado expone detalles internos. Mostrar genérico si no es un mensaje conocido.
19. **Cache de Mi Cuenta** (`miCuentaCache.ts`) no se limpia en logout; queda en memoria hasta recargar. Bajo (la ruta está protegida), pero conviene vaciarla en `logout()`.
20. **Dependencias**: `npm audit` reporta 5 (1 alta en `brace-expansion`, de tooling; `react-router` con un open redirect por backslash en `<Link>`/`navigate` — acá no hay redirects con input del usuario, y las de SSR no aplican). `npm audit fix` (sin `--force`) las resuelve sin romper. La de `uuid` dentro de `exceljs` no es explotable en este uso; no forzar el downgrade que propone npm.
21. **Edge Function con imports sin fijar**: `https://esm.sh/@supabase/supabase-js@2` resuelve a la última 2.x en cada deploy (riesgo de cadena de suministro). Fijar versión exacta; `deno.land/std@0.168.0` está muy viejo (`Deno.serve` lo reemplaza).
22. **Schema desactualizado**: `pedidos.usuario_id` duplicado (ya listado), comentarios que dicen que las tablas no tienen RLS, `schema.sql:53` con la policy insegura (conviene borrarla del archivo para que una instancia nueva no dependa del orden de ejecución).
23. **Seed del admin por email** (`rls.sql:50`): en una instancia nueva, si alguien se registra antes con ese email y no hay confirmación obligatoria, el seed lo haría admin. Sembrar por `id` después de verificar el usuario a mano.
24. **`.codex/tmp_fix_orders.sql.ps1`**: script ya ejecutado y versionado por decisión previa; sin secretos. Sin cambios.

## Sin hallazgos

- **Secretos**: no hay `service_role`, claves de Resend ni `.env` en el historial de git (40 commits revisados). Los `.env.example` tienen placeholders.
- **XSS en React**: no hay `dangerouslySetInnerHTML`, `innerHTML` ni `eval`. Todo texto de la base se renderiza escapado. Las URLs de WhatsApp/Maps usan `encodeURIComponent` o se reducen a dígitos.
- **Export a Excel**: `exceljs` escribe strings como texto, no como fórmulas → sin inyección de fórmulas.
- **Puertas traseras**: ninguna. No hay rutas ocultas, usuarios fijos, bypass de `is_admin` ni llamadas a dominios extraños; el admin depende de RLS y no de lógica del navegador.
- **Aislamiento client/admin**: correcto; orígenes distintos, sesiones separadas.
- **Trigger de transiciones de pedido** y triggers de límites: correctos.

## Orden sugerido

1. Correr `diagnostico.sql` y revisar resultados (sobre todo bloques 1, 2, 7 y 10).
2. Aplicar `correcciones.sql` (C1–C7). Probar un pedido real y un registro de cliente.
3. Reescribir y redeployar la Edge Function (#2) y ajustar `OrdersPage` para mandar solo `pedido_id`/`estado`.
4. Revisar Auth en el dashboard (#7).
5. Cambios de código menores: #8, #12, #13, #16–#19, quitar `p_usuario_id` del client, `npm audit fix`.
6. Trasladar todo a `shared/*.sql` y actualizar la doc de arquitectura.

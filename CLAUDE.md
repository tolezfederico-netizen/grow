# Grow

Plataforma modular de ventas para growshops físicos sin e-commerce. Se vende de forma íntegra a cada negocio (pago único, no SaaS). El cliente final arma un pedido en la tienda pública y lo retira en el local (no hay delivery); el dueño gestiona pedidos, catálogo y configuración desde un backoffice privado.

Estado actual: proyecto terminado y desplegado, en etapa de venta (sin usuarios reales todavía).

Documentación de arquitectura: [arquitectura-v13.md](docs/arquitectura/arquitectura-v13.md), documento único y consolidado del estado actual (reemplaza a v6–v12). Leerlo cuando haga falta el detalle o el porqué de una decisión, y actualizarlo cuando cambie algo de lo que describe (también existe como `Grow_Arquitectura_v13.docx`).

## Rediseño visual

Client y admin terminados (el admin, salvo una etapa mobile dedicada). Estilo neo-brutalista / cómic. Antes de tocar estilos, leer [docs/guia-de-estilo.md](docs/guia-de-estilo.md) (variables, componentes, estado por sección y forma de trabajo). Para el admin, además, [docs/guia-de-estilo-admin.md](docs/guia-de-estilo-admin.md): neo-brutalismo **sobrio** (mismas variables duplicadas en `admin/src/index.css`, sin punteado ni sombras en tablas, sin títulos de página porque la barra lateral ya indica la sección, barra superior negra con los filtros, un color por estado de pedido). Lo esencial:
- Solo estética: CSS primero; JSX solo si el layout lo exige; nunca cambiar lógica.
- Usar las variables `--brutal-*`, `--font-*` y `--punteado-*` de `client/src/index.css`; nada hardcodeado.
- Compacto. Botones sin hover (ni movimiento ni color). Resaltador amarillo solo en títulos de sección. Tarjetas en fila con borde parejo y sin sombra. Nada inclinado salvo el logo del header. Imágenes reales del admin, no íconos.
- Verificar en el navegador (1366, ~1920, ~1000 y 375px), typecheck + build, y un commit por sección cuando el usuario lo pida.

## Principios rectores

- **Genericidad**: ningún dato de un negocio particular en el código. Nombre, dirección, horarios, redes, sucursales, catálogo, mensaje de alerta, etc. viven en Supabase.
- **Únicas excepciones deliberadas**: (1) colores del tema, en variables `:root` de `client/src/index.css` y `admin/src/index.css`; (2) reseñas de `ReviewsCarousel` hardcodeadas a propósito (decisión de producto: el admin no las edita, las mantiene el desarrollador). No "arreglar" esto.
- **Aislamiento client/admin**: dos apps independientes, sin links ni imports cruzados entre ellas. Se despliegan por separado. Si algo de UI hace falta en ambas, se duplica (ej. `useModalAccesible.ts` existe en las dos a propósito).
- **`shared/` es capa de dominio agnóstica de framework**: tipos, cliente de Supabase, mappers y utilidades puras. Nada de React ni hooks ahí.
- **Multi-tenancy por instancia**: cada negocio tiene su propia instancia de Supabase (y su propia cuenta de Resend). No hay `tenant_id`.

## Stack

- Monorepo con npm workspaces: `client`, `admin`, `shared`.
- React 18 + TypeScript + Vite 5 + React Router 6. CSS Modules (`.module.css` al lado de cada `.tsx`), consumiendo variables del `:root`; no hardcodear colores.
- Supabase: Postgres + Auth + RLS + RPC + pg_cron + Edge Function en Deno (`supabase/functions/enviar-notificacion-pedido`, emails vía Resend).
- `@shared/*` → `shared/src/*`, alias resuelto por Vite (sin build intermedio). Las Edge Functions (Deno) **no** pueden importar `@shared`.
- Admin usa `exceljs` para exportar clientes (no SheetJS: no soporta estilos de celda gratis).
- Deploy: dos proyectos de Cloudflare Pages sobre el mismo repo (`grow-client` y `grow-admin`, `*.pages.dev`), build desde la raíz con `npm run build:client` / `build:admin`, salida `client/dist` / `admin/dist`, y build watch paths por proyecto. Headers de seguridad en `client/public/_headers` y `admin/public/_headers`; la SPA no necesita `_redirects` (sin `404.html`, Pages sirve `index.html`). Vercel sigue activo en paralelo por decisión del dueño, con sus `vercel.json` (v13 §3.3): si cambian los headers o las variables, cambiarlos en los dos lugares.
- Sin tests automatizados en ningún paquete.

## Comandos (desde la raíz)

```bash
npm install
npm run dev:client      # puerto 5173
npm run dev:admin       # puerto 5174
npm run build:client
npm run build:admin
npm run typecheck       # los tres paquetes
```

Verificar con `npm run typecheck` y el build correspondiente después de cada cambio.

## Estructura

```
client/src/
  components/{layout,common,product,cart,home,auth}/   # organizados por dominio
  hooks/     usePaneles, useSucursales, useConfiguracionTienda (los tres con caché
             compartida por pestaña), useModalAccesible, useFooterVisible
  context/   CartContext (useReducer), AuthContext
  pages/     Home, Products, ProductDetail, Resume (checkout), Login, Register,
             TerminosCondiciones, PoliticaPrivacidad, MiCuenta (+ miCuentaCache.ts,
             cache en memoria), NotFound
  components/common/  CampoTelefono (área + número), PaginaLegal (Términos y privacidad)
  utils/     redesSociales.tsx
admin/src/
  components/  AdminLayout, ProtectedRoute, ConfirmDialog, NotificarPedidoModal, forms…
  context/     AuthContext (con esAdmin), ConfirmContext (confirm/notify/toast)
  pages/       Login, Dashboard, Products, Categories, Orders, Panels, Settings, Customers
shared/
  schema.sql, rpc.sql, rls.sql          # los SQL viven acá, NO en supabase/
  migraciones/                          # scripts incrementales para instancias con datos
  src/{types,supabase,utils,constants}  # supabase/: client, database.types.ts, mappers
supabase/
  functions/enviar-notificacion-pedido, config.toml
.github/workflows/keep-alive.yml        # ping cada 3 días para que Supabase free no se pause
pruebas-carga/carga.mjs                 # prueba de carga contra una instancia de PRUEBA (v13 §3.5);
                                        # .env, semilla y resultados/ no se versionan
```

Convenciones: utilidades que devuelven JSX van como `.tsx` dentro de `utils/`. Nombres de dominio en español (`pedido`, `sucursal`, `mapearX`, etc.).

## Modelo de datos y lógica clave

- `configuracion_tienda`: fila única con los datos del negocio (incluye `mensaje_alerta` y `mensaje_alerta_expira_en`; un job de pg_cron cada minuto limpia el mensaje vencido y `AlertaBanner` también lo oculta del lado del cliente).
- Lenguaje: tienda, admin, WhatsApp y emails hablan de **reservas** (no compras ni pedidos); los estados se muestran como Nueva, Confirmada, Lista para retirar, Retirada y Cancelada (`formatEstadoPedido`). Tablas, estados y rutas conservan los nombres técnicos (`pedidos`, `pendiente`…).
- Teléfonos: formato `549` + código de área + número (13 dígitos), cargados en dos campos (`shared/src/utils/telefono.ts`). Los links de WhatsApp usan el número tal cual.
- Productos: se guardan con la RPC `guardar_producto` (producto, variantes por id y categorías en una transacción). Imágenes en WebP: `imagen_url` (1000 px) e `imagen_miniatura_url` (400 px).
- Pedidos: se crean con la RPC `crear_pedido_completo`, que toma precios del catálogo y el usuario de `auth.uid()` (el `p_usuario_id` de la firma se ignora; checkout como invitado sigue existiendo). Estados: `pendiente → confirmado | cancelado`, `confirmado → listo_para_retirar | cancelado`, `listo_para_retirar → completado | cancelado`; validado por el trigger `trg_validar_transicion_pedido`. Al confirmar o marcar "listo para retirar", el admin puede notificar por WhatsApp y/o email.
- Auth: admins y clientes conviven en el mismo `auth.users`. Admin = presencia en la tabla `admins` (RPC `is_admin()`); `ProtectedRoute` del admin expulsa a cualquier sesión que no sea admin. Clientes tienen perfil en `clientes`, creado por el trigger `handle_new_cliente` desde la metadata del `signUp`.

## Reglas de trabajo con la base de datos

- Producción ya tiene datos: aplicar **solo cambios incrementales** (`ALTER TABLE … ADD COLUMN IF NOT EXISTS`, `CREATE POLICY`…), nunca volver a correr el `CREATE TABLE` del schema.
- Orden de inicialización de una instancia nueva: `schema.sql → rpc.sql → rls.sql` (antes, activar `pg_cron`). Los `.sql` van en UTF-8 **sin BOM**: con BOM el SQL Editor de Supabase falla en la línea 1.
- Pruebas de carga: nunca contra producción. Hay una instancia aparte (`grow-pruebas`) y el script `pruebas-carga/carga.mjs` se frena si apunta a la base de `client/.env.local`.
- Toda columna nueva va acompañada, en el mismo cambio, de la regeneración de tipos: `supabase gen types typescript --linked > shared/src/supabase/database.types.ts` (y actualizar tipos y mappers en `shared/`). Ojo: en Windows la redirección puede generar el archivo en UTF-16; debe quedar en UTF-8.
- Que una policy esté en `rls.sql` no garantiza que esté aplicada en producción (ya pasó con `pedido_items`). Ante datos que "no aparecen", sospechar de RLS y comparar contra `pg_policies`.
- Variables `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` en `.env.local` de cada app (no versionado); los `.env.example` solo llevan placeholders. En Cloudflare Pages y en Vercel se cargan por proyecto junto con `NODE_VERSION=22`; cambiarlas requiere redeploy.

## Plan de trabajo y pendientes (detalle en la sección 12 de v13)

Las decisiones de producto y el plan por fases están en [guia-auditoria-decisiones-2026-10.pdf](docs/auditoria/guia-auditoria-decisiones-2026-10.pdf) (secciones 5, 15, 16 y 17); el estado de cada tarea, en [roadmap-funcionalidades.md](docs/auditoria/roadmap-funcionalidades.md). No volver a discutir las decisiones de la sección 5 salvo que aparezca un hecho nuevo.

- **Fase 1 desplegada y probada** (24/10/2026): push, migración de teléfonos y reservas reales en PC y celular. 1.11 hecha: Cloudflare Pages probado en `*.pages.dev` y Site URL de Supabase Auth apuntando ahí; Vercel queda activo en paralelo (v13 §12.1).
- Fase 1 pendiente: 1.7 (email al dueño, necesita Resend con dominio), 1.12 (backups). Pregunta 5 de la sección 17 ("+18") sin responder.
- Antes de vender: dominio propio en Resend → SMTP propio en Supabase, template de confirmación en español y secret `RESEND_FROM`; datos legales y teléfono del local por instancia; instancia de Supabase en una cuenta del cliente.
- Plan de Supabase: la prueba de carga (24/10/2026, v13 §3.5) dio 0 errores y un techo de ~550 pedidos/s, así que se puede arrancar en Free. Mientras tanto: volcado semanal manual como backup (falta el script) hasta tener la 1.12, keep-alive sin fallas y revisión mensual del uso; pasar a Pro cuando el negocio dependa de la tienda (detalle en v13 §12.4).
- Seguridad: auditoría 2026-10 en [docs/auditoria/](docs/auditoria/auditoria-seguridad-2026-10.md), aplicada y verificada en producción. Auditoría externa de la fase 1 en [informe-auditoria-codex-fase1.md](docs/auditoria/informe-auditoria-codex-fase1.md) (hallazgos corregidos o diferidos, ver v13 §12.3).
- Hook compartido para `precioMinimo` (repetido en ProductsPage, FeaturedCarousel y la búsqueda de HeaderTop).
- Admin responsive: falta una etapa mobile dedicada (las páginas ya se ven en 375px, pero sin revisión pensada para el celular). Logo del admin todavía en PNG de 720 KB.
- `Grow_Arquitectura_v13.docx` desactualizado respecto del Markdown.
- Sin suite de tests.

# Grow

Plataforma modular de ventas para growshops físicos sin e-commerce. Se vende de forma íntegra a cada negocio (pago único, no SaaS). El cliente final arma un pedido en la tienda pública y lo retira en el local (no hay delivery); el dueño gestiona pedidos, catálogo y configuración desde un backoffice privado.

Estado actual: proyecto terminado y desplegado, en etapa de venta (sin usuarios reales todavía).

Documentación de arquitectura completa (incremental por versión): [docs/arquitectura/](docs/arquitectura/README.md). La vigente es [arquitectura-v12.md](docs/arquitectura/arquitectura-v12.md); las bases de cada área están en v6, v7 y v8. Leerlas cuando haga falta el detalle o el porqué de una decisión.

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
- Deploy: dos proyectos de Vercel sobre el mismo repo (Root Directory `client/` y `admin/`), cada uno con `vercel.json` de rewrite SPA a `index.html`.
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
  hooks/     usePaneles, useSucursales, useConfiguracionTienda, useModalAccesible
  context/   CartContext (useReducer), AuthContext
  pages/     Home, Products, ProductDetail, Resume (checkout), Login, Register,
             TerminosCondiciones, MiCuenta (+ miCuentaCache.ts, cache en memoria)
  utils/     redesSociales.tsx
admin/src/
  components/  AdminLayout, ProtectedRoute, ConfirmDialog, NotificarPedidoModal, forms…
  context/     AuthContext (con esAdmin), ConfirmContext (confirm/notify/toast)
  pages/       Login, Dashboard, Products, Categories, Orders, Panels, Settings, Customers
shared/
  schema.sql, rpc.sql, rls.sql          # los SQL viven acá, NO en supabase/
  src/{types,supabase,utils,constants}  # supabase/: client, database.types.ts, mappers
supabase/
  functions/enviar-notificacion-pedido, config.toml
.github/workflows/keep-alive.yml        # ping cada 3 días para que Supabase free no se pause
```

Convenciones: utilidades que devuelven JSX van como `.tsx` dentro de `utils/`. Nombres de dominio en español (`pedido`, `sucursal`, `mapearX`, etc.).

## Modelo de datos y lógica clave

- `configuracion_tienda`: fila única con los datos del negocio (incluye `mensaje_alerta` y `mensaje_alerta_expira_en`; un job de pg_cron cada minuto limpia el mensaje vencido y `AlertaBanner` también lo oculta del lado del cliente).
- Pedidos: se crean con la RPC `crear_pedido_completo` (incluye `p_usuario_id` opcional; checkout como invitado sigue existiendo). Estados: `pendiente → confirmado | cancelado`, `confirmado → listo_para_retirar | cancelado`, `listo_para_retirar → completado | cancelado`; validado por el trigger `trg_validar_transicion_pedido`. Al confirmar o marcar "listo para retirar", el admin puede notificar por WhatsApp y/o email.
- Auth: admins y clientes conviven en el mismo `auth.users`. Admin = presencia en la tabla `admins` (RPC `is_admin()`); `ProtectedRoute` del admin expulsa a cualquier sesión que no sea admin. Clientes tienen perfil en `clientes`, creado por el trigger `handle_new_cliente` desde la metadata del `signUp`.

## Reglas de trabajo con la base de datos

- Producción ya tiene datos: aplicar **solo cambios incrementales** (`ALTER TABLE … ADD COLUMN IF NOT EXISTS`, `CREATE POLICY`…), nunca volver a correr el `CREATE TABLE` del schema.
- Orden de inicialización de una instancia nueva: `schema.sql → rpc.sql → rls.sql`.
- Toda columna nueva va acompañada, en el mismo cambio, de la regeneración de tipos: `supabase gen types typescript --linked > shared/src/supabase/database.types.ts` (y actualizar tipos y mappers en `shared/`). Ojo: en Windows la redirección puede generar el archivo en UTF-16; debe quedar en UTF-8.
- Que una policy esté en `rls.sql` no garantiza que esté aplicada en producción (ya pasó con `pedido_items`). Ante datos que "no aparecen", sospechar de RLS y comparar contra `pg_policies`.
- Variables `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` en `.env.local` de cada app (no versionado); los `.env.example` solo llevan placeholders. En Vercel, cambiar variables requiere redeploy.

## Pendientes conocidos (ver sección 11 de v12)

- Auditoría de seguridad 2026-10 en [docs/auditoria/](docs/auditoria/auditoria-seguridad-2026-10.md): RLS de producción verificado y corregido; quedan los pendientes listados ahí (Auth en el dashboard, código país `54` fijo, deploy de la Edge Function).
- Regenerar `database.types.ts` con el CLI (se editó a mano en v9).
- `usePaneles.ts` todavía hace su propio fetch de `configuracion_tienda`.
- `schema.sql` declara `pedidos.usuario_id` dos veces.
- Migrar los `alert()` restantes a `notify()` de ConfirmContext; hook compartido para `precioMinimo` (ProductsPage/FeaturedCarousel); conectar `CategoryCard`/`es_card`.
- Admin responsive: falta una etapa mobile dedicada (las páginas ya se ven en 375px, pero sin revisión pensada para el celular).
- Dominio propio en Resend (hoy en sandbox). Sin suite de tests.

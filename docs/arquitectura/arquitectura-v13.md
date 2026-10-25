# Grow — Documento de Arquitectura v13

Plataforma modular de ventas para growshops

Versión 13.0 — Documento consolidado (reemplaza a v6–v12)

Octubre 2026

## Cómo leer este documento

Las versiones 6 a 12 se escribieron de forma incremental: cada una describía solo lo que cambiaba y remitía a las anteriores. Este documento las reemplaza por completo. Describe el proyecto **tal como está hoy en el código y en la base de producción**, verificado contra el repositorio y contra `pg_policies` en octubre de 2026. Todo lo que fue reemplazado, eliminado o resuelto ya no figura en el cuerpo; la evolución resumida está en el anexo A.

Documentos complementarios que siguen vigentes:

- `docs/guia-de-estilo.md` y `docs/guia-de-estilo-admin.md` — reglas visuales del rediseño.
- `docs/auditoria/auditoria-seguridad-2026-10.md` — auditoría de seguridad, con los SQL de diagnóstico y corrección.
- `docs/auditoria/guia-auditoria-decisiones-2026-10.pdf` — decisiones de producto (sección 5), orientación legal (15), plan de trabajo por fases (16) y preguntas abiertas (17). Es una foto al 23/10/2026: el avance del plan se lleva en `docs/auditoria/roadmap-funcionalidades.md`.
- `docs/auditoria/auditoria-funcional-2026-10.md`, `roadmap-funcionalidades.md` y `pasarela-de-pago.md` — hallazgos funcionales, plan y estado, y diseño futuro del cobro online.
- `docs/auditoria/informe-auditoria-codex-fase1.md` — auditoría externa de la fase 1, con el estado de cada hallazgo al final.

# 1. Producto y principios

## 1.1 Qué es

Grow es una plataforma de ventas para growshops físicos que no tienen e-commerce. Se vende de forma íntegra a cada negocio (pago único, no SaaS). El cliente final arma un pedido en la tienda pública y lo **retira en el local**: no hay delivery ni cobro online. El dueño gestiona pedidos, catálogo y configuración desde un backoffice privado y avisa al cliente por WhatsApp o email cuando el pedido avanza.

Estado: terminado, desplegado y en etapa de venta, sin usuarios reales todavía.

## 1.2 Genericidad

Ningún dato de un negocio particular vive en el código. Nombre de la tienda, dirección, horarios, teléfono, email, redes sociales, sucursales, catálogo, paneles de navegación y mensaje de alerta están en Supabase y se editan desde el admin.

Excepciones deliberadas (no son deuda técnica):

| Excepción | Dónde | Motivo |
|---|---|---|
| Colores y tipografías del tema | Variables `:root` de `client/src/index.css` y `admin/src/index.css` | Se ajustan por despliegue; el admin no los edita. |
| Reseñas de clientes | `client/src/components/home/ReviewsCarousel/ReviewsCarousel.tsx` (10 reseñas de ejemplo ficticias y genéricas, sin promedio ni total; avatares SVG ilustrados en `AvatarIlustrado.tsx`, con los colores del tema) | Decisión de producto: el desarrollador las mantiene, el admin no las edita. Al personalizar para un negocio se reemplazan por reseñas reales o se oculta la sección. |
| Logo | `client/src/assets/logo.webp` (506 × 160 px, ~24 KB) y `admin/src/assets/logo.png` | Asset gráfico por despliegue, igual que los colores. En la tienda va en WebP liviano: al personalizar, exportarlo a unos 160 px de alto. |
| Teléfonos argentinos | `shared/src/utils/telefono.ts`: formato `549` + área + número, códigos de área de 2 y 3 dígitos | Aceptado: los clientes objetivo son growshops de Argentina. Se revisa si aparece uno de otro país. |

Quedan además textos "Grow" fijos que no se ven en la tienda: `<title>` de ambos `index.html`, el título "Grow Admin" del menú lateral y el nombre del archivo de exportación `Clientes_Grow_AAAA-MM-DD.xlsx`.

## 1.3 Multi-tenancy por instancia

Cada negocio tiene su propia instancia de Supabase (y su propia cuenta de Resend). No existe `tenant_id`. Desplegar para un negocio nuevo es: crear la instancia, correr los SQL de `shared/`, cargar las variables de entorno y deployar las dos apps.

## 1.4 Aislamiento client/admin

- Dos aplicaciones independientes, sin links ni imports cruzados entre ellas.
- Se despliegan por separado (dos proyectos de Cloudflare Pages, dos dominios). Un incidente en una no afecta a la otra.
- Si algo de UI hace falta en ambas, se duplica a propósito (por ejemplo `useModalAccesible.ts`).
- `shared/` es una capa de dominio agnóstica de framework: tipos, cliente de Supabase, mappers y utilidades puras. Nada de React ni hooks.

# 2. Estructura del monorepo

Monorepo con npm workspaces (`client`, `admin`, `shared`) en un único repositorio de GitHub.

```
/
  client/                 tienda pública (Vite, puerto 5173)
    src/
      components/
        layout/   Header, HeaderTop, HeaderNav, CategoryDropdown, AlertaBanner,
                  Footer, WhatsappFloatButton, ScrollToTop, ScrollToTopButton
        common/   LoadingState, ErrorState, ErrorBoundary,
                  ConfirmarPedidoModal, PedidoDetalleModal, PaginaLegal
        product/  ProductCard, CategoryCard, ArticulosSidebar, FeaturedCarousel
        cart/     CartDrawer, CartItemRow, CarritoFlotante
        home/     Banner, ReviewsCarousel/{ReviewsCarousel, AvatarIlustrado}
        auth/     ProtectedRoute, SoloInvitadoRoute
      hooks/      usePaneles, useSucursales, useConfiguracionTienda,
                  useModalAccesible, useFooterVisible
      context/    CartContext, AuthContext
      pages/      HomePage, ProductsPage, ProductDetailPage, ResumePage,
                  LoginPage, RegisterPage, MiCuentaPage (+ miCuentaCache.ts),
                  TerminosCondicionesPage, PoliticaPrivacidadPage, NotFoundPage
      utils/      redesSociales.tsx
      assets/     logo.webp
    public/       favicon.ico, _headers
    vercel.json           (Vercel, activo en paralelo)
  admin/                  backoffice (Vite, puerto 5174)
    src/
      components/ AdminLayout, ProtectedRoute, ConfirmDialog, NotificarPedidoModal,
                  ProductForm, ProductoImagenSelector, PanelForm, PanelItemsEditor,
                  PanelItemForm, LoadingState, ErrorState, ErrorBoundary
      context/    AuthContext (con esAdmin), ConfirmContext
      hooks/      useModalAccesible
      pages/      LoginPage, DashboardPage, OrdersPage, ProductsPage,
                  CategoriesPage, PanelsPage, CustomersPage, SettingsPage
      utils/      iconoEstado.tsx
      assets/     logo.png
    public/       iconadmin.ico, _headers
    vercel.json           (Vercel, activo en paralelo)
  shared/
    schema.sql · rpc.sql · rls.sql        (los SQL viven acá, no en supabase/)
    src/
      types/      producto, categoria, pedido, cliente, configuracion-tienda,
                  panel-categoria
      supabase/   client.ts, database.types.ts, mappers.ts
      utils/      formatPrecio, formatEstadoPedido, validarEmail
      constants/  estados, redes sugeridas, bucket de imágenes
  supabase/
    functions/enviar-notificacion-pedido/   index.ts, deno.json
    config.toml
  .github/workflows/keep-alive.yml
  docs/       arquitectura/, auditoria/, guías de estilo
  .codex/tmp_fix_orders.sql.ps1           (script histórico, ya ejecutado)
```

Convenciones:

- Componentes del client agrupados por dominio en subcarpetas; `ReviewsCarousel` conserva su subcarpeta propia dentro de `home/`.
- Cada componente tiene su `.module.css` al lado del `.tsx`.
- Las utilidades que devuelven JSX son `.tsx` aunque vivan en `utils/` (`redesSociales.tsx`, `iconoEstado.tsx`).
- Nombres de dominio en español (`pedido`, `sucursal`, `mapearX`).

# 3. Stack, build y despliegue

## 3.1 Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | React 18, TypeScript 5, Vite 5, React Router 6, CSS Modules |
| Backend | Supabase: Postgres, Auth, RLS, RPC, Storage, pg_cron, Edge Functions (Deno) |
| Emails | Resend (vía Edge Function) |
| Exportación | `exceljs` en el admin (SheetJS gratuito no soporta estilos de celda) |
| Hosting | Cloudflare Pages (dos proyectos); Vercel activo en paralelo |
| Mantenimiento | GitHub Actions (keep-alive) |

`@shared/*` apunta a `shared/src/*` mediante un alias de Vite en cada `vite.config.ts`; no hay build intermedio de `shared`. Las Edge Functions corren en Deno y no pueden importar `@shared`.

Ambos `main.tsx` cargan `App` con `React.lazy` dentro de `Suspense` y un `ErrorBoundary` de nivel superior.

No hay suite de tests automatizados en ningún paquete: todo se verifica con `npm run typecheck`, el build y pruebas manuales.

## 3.2 Comandos

```
npm install
npm run dev:client       # 5173
npm run dev:admin        # 5174
npm run build:client
npm run build:admin
npm run typecheck        # los tres paquetes
```

## 3.3 Hosting: Cloudflare Pages

- Dos proyectos de Pages (Git integration con GitHub) sobre el mismo repositorio: `grow-client` (`grow-client.pages.dev`) y `grow-admin` (`grow-admin.pages.dev`). Production branch `main`, framework preset **None**, Root directory vacío (la raíz, para que npm resuelva los workspaces con el `package-lock.json` único). Build `npm run build:client` / `npm run build:admin`, salida `client/dist` / `admin/dist`.
- Variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `NODE_VERSION=22` en cada proyecto. Las `VITE_*` se inyectan en el build: cambiarlas requiere redeploy.
- Build watch paths: `client/*, shared/*, package.json, package-lock.json` en la tienda y `admin/*, shared/*, package.json, package-lock.json` en el admin; un cambio solo en `docs/` no reconstruye nada. En el panel, las rutas van en un solo campo separadas por comas y hay que apretar **Enter** para que se habilite Save; si el campo queda vacío, Pages no reconstruye ningún push (pasó al configurarlo).
- SPA: sin `404.html` en la salida, Pages sirve `index.html` para cualquier ruta que no sea un archivo; no hace falta `_redirects`.
- Ojo al crear un proyecto nuevo: **Create application** abre por defecto el flujo de Workers (con "Deploy command: `npx wrangler deploy`"). Hay que entrar por la opción de Pages, cuya pantalla se llama "Set up builds and deployments".
- Auth de Supabase: la Site URL es la de Cloudflare y `https://grow-client.pages.dev/**` está en Redirect URLs, junto con la de Vercel y `http://localhost:5173/**` (el registro usa `emailRedirectTo` con el origen actual).
- Vercel (dos proyectos con Root Directory `client/` y `admin/`) sigue activo en paralelo por decisión del dueño; cada `vercel.json` repite el rewrite SPA y los mismos headers. Un cambio de headers o de variables se hace en los dos hostings.
- Headers de seguridad en `client/public/_headers` y `admin/public/_headers` (Vite los copia a `dist`), idénticos a los de cada `vercel.json`:
  - `Content-Security-Policy`: scripts solo propios; estilos propios y Google Fonts; imágenes propias, `data:`, `blob:` y `*.supabase.co`; conexiones a `*.supabase.co` (https y wss); `frame-ancestors 'none'`; el client además permite frames de Google Maps. Si una instancia usa un dominio propio de Supabase, hay que agregarlo.
  - `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (sin cámara, micrófono, ubicación ni pagos).
  - Solo el admin: `X-Robots-Tag: noindex, nofollow`.

## 3.4 Keep-alive de Supabase

Supabase free pausa la base tras 7 días sin tráfico. `.github/workflows/keep-alive.yml` hace un `curl` de solo lectura a `/rest/v1/configuracion_tienda?select=nombre_tienda&limit=1` con la anon key cada 3 días a las 09:00 UTC (una consulta real a una tabla, para que cuente como actividad de la base) y falla si la respuesta no es 200. También se puede correr a mano. URL y anon key están como secrets del repositorio. La clave `on` va entre comillas (`"on":`) porque sin comillas YAML la interpreta como booleano. Si el proyecto pasa a un plan pago, se borra el workflow.

# 4. Client (tienda pública)

## 4.1 Rutas

| Ruta | Página | Notas |
|---|---|---|
| `/` | HomePage | Destacados, Banner del local, reseñas, footer |
| `/productos` | ProductsPage | Catálogo completo; `?buscar=` filtra por nombre |
| `/productos/:categoriaId` | ProductsPage | Filtrado por categoría |
| `/productos/panel/:panelId` | ProductsPage | Todas las categorías de un panel |
| `/producto/:productoId` | ProductDetailPage | Ficha; un id inexistente muestra la 404 |
| `/resumen` | ResumePage | Checkout; header en variante "light" |
| `/login`, `/registro` | LoginPage, RegisterPage | Solo sin sesión (`SoloInvitadoRoute`) |
| `/mi-cuenta` | MiCuentaPage | Solo con sesión (`ProtectedRoute`) |
| `/terminos-y-condiciones` | TerminosCondicionesPage | Modelo de reserva: la reserva no obliga al pago y la compraventa se celebra en el local; stock, precios y error de precio. Sin checkbox obligatorio en el registro (un aviso con links sobre el botón) |
| `/politica-de-privacidad` | PoliticaPrivacidadPage | Política genérica (Ley 25.326): datos, finalidad, proveedores, derechos y leyenda de la AAIP |
| `*` | NotFoundPage | 404 con accesos a productos e inicio |

`App.tsx` monta además `ScrollToTop` (vuelve arriba en cada cambio de ruta), `WhatsappFloatButton` (salvo en `/resumen`), `ScrollToTopButton` (inicio y catálogo), `CarritoFlotante` (inicio y fichas) y `CartDrawer`.

## 4.2 Header

`Header` es sticky y apila, de arriba hacia abajo:

1. **AlertaBanner** — mensaje de `configuracion_tienda.mensaje_alerta` que se desplaza de derecha a izquierda en loop (CSS puro, `translateX(calc(-100vw - 100%))`). No se renderiza si no hay mensaje o si `mensaje_alerta_expira_en` ya pasó.
2. **HeaderTop** — logo, buscador con resultados en vivo (debounce de 300 ms, hasta 4 productos con su precio mínimo; Enter lleva a `/productos?buscar=`), botón **Info** (local principal, sucursales, horario, teléfono y redes), botón de cuenta y carrito. En mobile se convierte en menú hamburguesa (drawer) y buscador desplegable. El botón de cuenta muestra el nombre leído de `clientes.nombre` (o "Mi Cuenta"); su menú ofrece login/registro o Mi cuenta/cerrar sesión.
3. **HeaderNav** — un botón por panel de navegación activo, más "Términos y Condiciones" y "Ayuda" (WhatsApp y email, solo si están cargados). Hover en desktop, click en touch.
4. **CategoryDropdown** — al abrir un panel muestra su título, descripción y las categorías marcadas como card (`es_card`) mediante `CategoryCard`, con imágenes de productos elegidos en el admin.

Los datos del header salen de `usePaneles`: los paneles activos (con items, categorías y miniaturas) y `configuracion_tienda`, ambos de la caché compartida (4.7). Los paneles con `orden` fijo ocupan su posición; los que tienen `orden` nulo se reparten al azar en los huecos, una sola vez por pestaña, así Header y Footer muestran el mismo orden.

## 4.3 Catálogo y ficha

- **ProductsPage** — lista productos `disponible` y `sin_stock` (los segundos con indicación visual y sin poder agregarse), con filtro por categoría, panel o búsqueda, y el `ArticulosSidebar` de navegación. Pagina de a 24 (más nuevos primero) con un botón "Ver más" y pide solo las columnas de la tarjeta. Para productos con variantes calcula el precio mínimo.
- **Imágenes** — tarjetas, carrusel, búsqueda, menú, carrito y Mi Cuenta usan la miniatura (`imagen_miniatura_url`, o la grande si no hay); la ficha usa la grande. Todas llevan `width`/`height` y, salvo el logo del header y la ficha, `loading="lazy"` y `decoding="async"`.
- **ProductCard** — imagen, nombre, precio (o selector de variante), "Agregar al carrito" con animación de vuelo hacia el ícono del carrito y "Ver Producto" (abre la ficha en otra pestaña).
- **FeaturedCarousel** — productos marcados como destacados (máximo 10), con flechas; se reutiliza también tras confirmar un pedido.
- **ProductDetailPage** — ficha con imagen, precio o variante elegida, cantidad (+/−), agregar al carrito, especificaciones si existen y botones para compartir (WhatsApp, Facebook, copiar link).

## 4.4 Carrito y checkout

- **CartContext** (`useReducer`) mantiene los items en memoria (no se persiste), el total, el estado del drawer y la animación `flyToCart`.
- **CartDrawer** muestra el carrito lateral y lleva a `/resumen`. En mobile, **CarritoFlotante** es una barra fija "Ver reserva" con cantidad y total; los botones flotantes se ocultan al llegar al footer (`useFooterVisible`).
- **ResumePage** pide nombre y apellido, teléfono y email.
- **Teléfonos**: checkout, registro, Mi cuenta y Configuración del admin los piden en dos campos (código de área sin 0 y número sin 15; si se escriben igual, se quitan solos) y los guardan en formato internacional `549` + área + número (`armarTelefonoAR`). Se muestran como `+54 9 11 1234-5678` y los links de WhatsApp usan los dígitos tal cual, sin prefijos agregados.
- **ResumePage**, además: si hay sesión, precarga los datos del perfil sin pisar lo que el cliente ya escribió. Sobre el botón muestra el sello "Datos protegidos" ("Usamos tus datos solo para gestionar tu reserva") con link a `/politica-de-privacidad`; ese texto reemplazó al antiguo "Compra Protegida", que no tenía respaldo (no hay pago online). Al validar abre **ConfirmarPedidoModal** con el resumen; recién al confirmar llama a `crear_pedido_completo` enviando solo producto, variante y cantidad. Precios, total y usuario los resuelve la base (sección 7.3). Si la RPC rechaza el pedido, el modal queda abierto con el mensaje; solo se muestran los mensajes propios de la RPC (código `P0001`) y cualquier otro error se reemplaza por uno genérico.
- **Aviso al local por WhatsApp del comprador**: si la tienda tiene un teléfono válido, al confirmar se abre `wa.me/<teléfono del local>` con un mensaje ya escrito (número de reserva, productos y variantes, total calculado por la base y nombre). La pestaña se abre durante el clic, antes de esperar a la base, para que el navegador no la bloquee; si la RPC falla, se cierra. La pantalla de éxito muestra el número de reserva (`numeroReserva`: los primeros 8 caracteres del id en mayúsculas, el mismo que ven el admin y el asunto del email), un botón para reintentar el WhatsApp, el local con su dirección y horario, y aclara que el pago es en el local. Sin teléfono válido, no se abre WhatsApp y se avisa que el local se va a comunicar.

## 4.5 Home

- **Banner** — "Retiro en nuestros locales": selector entre el local principal y las sucursales, mapa embebido de Google Maps por dirección (sin API key ni geocoding), horario, teléfono, email y la red social destacada.
- **ReviewsCarousel** — carrusel arrastrable (Pointer Events) con modal accesible para leer la reseña completa. Datos fijos por decisión de producto: reseñas de ejemplo con nombres ficticios y textos sin referencias a ninguna tienda, horario, empleado ni medio de pago; avatares SVG generados por `AvatarIlustrado` (pelo, accesorios y fondo combinables) que no representan a personas reales.
- **Footer** — logo, categorías (de los paneles), contacto con sucursales y redes.

## 4.6 Cuentas de cliente

- **AuthContext** expone sesión, `login`, `signUp` y `logout`. El registro manda nombre, apellido y teléfono como metadata (los usa el trigger `handle_new_cliente`) y `emailRedirectTo` con el origen actual, para que el link de confirmación vuelva a la tienda publicada o a `localhost` según dónde se registró. `logout` vacía la caché de Mi Cuenta.
- **RegisterPage** valida nombre, apellido, teléfono, email y contraseña (8 o más caracteres con letras y números, igual que la política de Supabase Auth).
- **MiCuentaPage** — dos columnas independientes en manejo de error:
  - Perfil: email de solo lectura; nombre, apellido y teléfono editables.
  - Historial: pedidos propios no eliminados, con **PedidoDetalleModal** (imagen, variante, cantidad, precio y subtotal por item). Las imágenes se piden al abrir el detalle.
  - `miCuentaCache.ts` guarda en memoria (no en storage) perfil, pedidos, items e imágenes por usuario, para no repetir los fetch al volver a la página.

## 4.7 Hooks y utilidades

| Hook / utilidad | Qué hace | Lo usan |
|---|---|---|
| `usePaneles` | Paneles activos completos + `configuracion_tienda` (vía `obtenerConfiguracionTienda`) | Header, Footer, ArticulosSidebar |
| `useConfiguracionTienda` | `configuracion_tienda` con loading, error y `recargar` | HomePage, WhatsappFloatButton |
| `useSucursales` | Sucursales ordenadas | HeaderTop, Banner, Footer |
| `useModalAccesible` | Escape, foco atrapado y restaurado en modales | Modal de ReviewsCarousel (en el admin existe una copia propia) |
| `useFooterVisible` | Indica si el footer entró en pantalla | Botones flotantes |
| `redesSociales.tsx` | `parseRedSocial` (solo acepta URLs `https:`; WhatsApp se reduce a dígitos) y `RedSocialIcon` | HeaderTop, Banner, Footer |

`usePaneles`, `useConfiguracionTienda` y `useSucursales` comparten una caché a nivel de módulo: la primera llamada hace la consulta y el resto reusa la misma promesa, una vez por pestaña (si falla, se descarta y el próximo intento reconsulta). Un cambio desde el admin se ve al recargar, igual que antes.

# 5. Admin (backoffice)

## 5.1 Acceso

- **AuthContext** expone sesión, `esAdmin` (resultado del RPC `is_admin()`), `login` y `logout`. La verificación se repite solo si cambia el usuario; un refresh del token o volver a la pestaña no la dispara (antes desmontaba la página y se perdían formularios). La llamada se difiere con `setTimeout` porque supabase-js desaconseja llamar a la API dentro de `onAuthStateChange`.
- **ProtectedRoute** espera la verificación; sin sesión manda a `/login` y con una sesión que no es admin cierra sesión y también manda a `/login`. Así un cliente de la tienda no puede entrar al backoffice con sus credenciales.
- La seguridad real está en RLS: el frontend solo decide qué mostrar.

## 5.2 Layout y diálogos

- **AdminLayout**: menú lateral con íconos (Dashboard, Reservas, Productos, Categorías, Paneles, Clientes, Configuración) y cerrar sesión. En mobile es un menú hamburguesa que se cierra con Escape y al navegar.
- **ConfirmContext** ofrece `confirm` (devuelve sí/no), `notify` (aviso bloqueante) y `toast` (aviso que se cierra solo). **ConfirmDialog** los renderiza; `confirm` y `notify` usan `useModalAccesible` y Escape equivale a cancelar o a aceptar el aviso, respectivamente.

## 5.3 Páginas

| Página | Ruta | Funciones |
|---|---|---|
| Dashboard | `/` | Conteo por estado (sin eliminados, con link al filtro), últimas 6 reservas, gráfico de reservas de los últimos 7 días, aviso de productos sin stock |
| Reservas | `/pedidos` | Ver 5.4 (la ruta conserva el nombre técnico) |
| Productos | `/productos` | Listado con búsqueda, filtro por categoría y por completitud (si tiene descripción y especificaciones); crear/editar en modal de dos columnas (`ProductForm`, con variantes y subida de imagen a Storage: el navegador la comprime a WebP en dos versiones, grande de 1000 px y miniatura de 400 px, con caché de un año, y al reemplazarla o eliminar el producto se borran los archivos anteriores; producto, variantes y categorías se guardan juntos con la RPC `guardar_producto`, que conserva el id de las variantes editadas); destacar (tope 10); acciones múltiples: eliminar, pausar, marcar sin stock. No deja eliminar productos usados como imagen de un panel |
| Categorías | `/categorias` | Grilla CSS con cantidad de productos; crear/editar en modal; pausar (pausa los productos que quedan sin ninguna categoría activa); eliminar (desvincula de los productos) |
| Paneles | `/paneles` | Paneles de navegación con orden fijo o automático, pausar, editor en línea de items (`PanelItemsEditor`, `PanelItemForm`): categoría, nombre visible, si es card (máximo 4 por panel) y productos cuyas imágenes se muestran (`ProductoImagenSelector`) |
| Clientes | `/clientes` | Tarjetas con detalle, búsqueda, copiar email/teléfono, WhatsApp, exportación a Excel con encabezado en los colores de marca (todos los clientes cargados, no solo los filtrados) |
| Configuración | `/configuracion` | Secciones: información del local, sucursales, redes sociales (solo URLs `https://`) con red destacada, mensaje de alerta con vencimiento opcional y vista previa, y datos legales del titular (razón social, CUIT, domicilio legal; opcionales) |

## 5.4 Reservas

- Por defecto muestra los últimos 30 días más todas las reservas abiertas (pendiente, confirmado, listo para retirar); "Ver reservas más antiguas" trae el resto.
- El detalle de cada reserva muestra su número (`#` + los primeros 8 caracteres del id, `numeroReserva`), el mismo que recibe el local por WhatsApp y el que va en el asunto del email.
- Agrupa por Hoy / Ayer / Este mes / Más antiguos, filtra por estado (también con `?estado=`), abre un pedido por `?id=`, busca por cliente y ordena por fecha o monto.
- Un pendiente con más de 24 horas lleva la etiqueta "Sin atender".
- Eliminar es un borrado lógico (`eliminado = true`), reversible con "Mostrar eliminados". El pedido eliminado desaparece del Dashboard y de Mi Cuenta del cliente.
- Las transiciones válidas las impone la base (sección 7.4).
- Al pasar a "confirmado" o "listo para retirar" se abre **NotificarPedidoModal** para avisar por WhatsApp, por email o por ambos:
  - WhatsApp: abre `wa.me/<teléfono>` (`linkWhatsapp`, con el teléfono ya guardado como `549…`) con el detalle de la reserva, en una ventana sin acceso al admin (`opener = null`).
  - Email: invoca la Edge Function con `pedido_id` y `estado` (sección 8).

# 6. Paquete shared

- **Tipos** (`types/`): `Producto` como unión discriminada (`ProductoSimple` con `precio_base` / `ProductoConVariantes`), `ProductoVariante`, `Categoria`, `Pedido`, `PedidoItem`, `Cliente`, `ConfiguracionTienda`, `Sucursal`, paneles e items, y los literales de estado.
- **Supabase** (`supabase/`): `client.ts` crea el cliente con las variables de entorno y falla con un mensaje claro si faltan; `database.types.ts` tipa las tablas y funciones; `mappers.ts` convierte filas crudas a tipos de dominio y valida los literales de estado.
- **Utilidades**: `formatPrecio` (ARS sin decimales), `formatEstadoPedido` (`listo_para_retirar` → "Listo para retirar"), `validarEmail` (mismo patrón que el CHECK de la base).
- **Constantes**: estados para los selects, redes sugeridas, nombre del bucket `imagenes-productos`.

# 7. Base de datos

## 7.1 Tablas

| Tabla | Contenido |
|---|---|
| `productos` | Nombre, descripción, especificaciones, imagen (`imagen_url`, 1000 px) y miniatura (`imagen_miniatura_url`, 400 px; NULL en imágenes anteriores, la tienda usa la grande), `tiene_variantes`, `precio_base` (CHECK: obligatorio solo sin variantes), estado `disponible`/`pausado`/`sin_stock`, `destacado` (máx. 10 por trigger) |
| `producto_variantes` | Nombre, precio (> 0), estado `disponible`/`pausado` |
| `categorias` | Nombre único, estado `activa`/`pausada` |
| `producto_categorias` | Relación N:M |
| `pedidos` | Datos de contacto, `usuario_id` (nullable, `ON DELETE SET NULL`), estado, total, `eliminado`, fechas |
| `pedido_items` | Snapshot de nombre del producto, nombre de la variante (`nombre_variante`) y precio unitario; `producto_id`/`variante_id` pasan a NULL si se borra el producto o la variante |
| `configuracion_tienda` | Fila única (columna `singleton`): nombre, dirección, teléfono, email (CHECK de formato), horarios, `redes_sociales` (jsonb), red destacada, `mensaje_alerta`, `mensaje_alerta_expira_en`, datos legales del proveedor (`razon_social`, `cuit` de 11 dígitos, `domicilio_legal`; vacíos en la demo) |
| `sucursales` | Locales adicionales: nombre, dirección, orden |
| `paneles_categoria` | Paneles de navegación: título, descripción, `orden` (único, NULL = automático), estado |
| `paneles_categoria_items` | Categorías de un panel: nombre visible, orden, `es_card` (máx. 4 por panel); categoría única por panel |
| `paneles_categoria_items_productos` | Productos cuyas imágenes ilustran cada card (`RESTRICT` al borrar el producto) |
| `admins` | Allowlist de administradores (1:1 con `auth.users`) |
| `clientes` | Perfil de clientes (1:1 con `auth.users`) |

## 7.2 Archivos SQL

- `shared/schema.sql` — tablas, índices, triggers y migraciones históricas idempotentes.
- `shared/rpc.sql` — `crear_pedido_completo` y `limpiar_mensaje_alerta_vencido` con su `cron.schedule`.
- `shared/rls.sql` — `is_admin()`, policies, privilegios, trigger de alta de clientes, el bucket `imagenes-productos` con sus límites y sus policies de Storage.
- `shared/migraciones/` — scripts incrementales para instancias que ya tienen datos (una instancia nueva no los necesita: ya están incorporados en los tres archivos anteriores).
- Orden para una instancia nueva: `schema.sql → rpc.sql → rls.sql`. Requiere la extensión `pg_cron`.

## 7.3 Funciones

| Función | Tipo | Qué hace |
|---|---|---|
| `crear_pedido_completo(nombre, teléfono, email, items, p_usuario_id)` | RPC, SECURITY DEFINER, ejecutable por anon y authenticated | Valida nombre (3–120), teléfono (formato `549` + área + número, 13 dígitos; por compatibilidad, 10 dígitos de área + número se completan con `549`) y email; 1 a 50 items con cantidad 1–999; máximo 3 pedidos por teléfono cada 10 minutos. Toma el precio del catálogo (variante obligatoria si el producto tiene variantes), calcula el total, inserta pedido e items (con snapshot de `nombre_producto` y `nombre_variante`) en una transacción y asigna `usuario_id = auth.uid()`. `p_usuario_id` se conserva en la firma por compatibilidad y se ignora |
| `guardar_producto(datos, variantes, categoria_ids, p_producto_id)` | RPC, SECURITY INVOKER (pasa por RLS), solo authenticated | Crea o edita un producto con sus variantes y categorías en una transacción. Las variantes se sincronizan por id: actualiza las existentes sin cambiarles el id, crea las nuevas y borra las quitadas; exige al menos una si el producto tiene variantes, rechaza ids repetidos y, si el producto pasa a simple, borra sus variantes. Sin `p_producto_id` crea el producto y devuelve su id |
| `is_admin()` | SECURITY DEFINER, solo authenticated | `EXISTS` en `admins` para `auth.uid()`; la usan las policies y el admin |
| `handle_new_cliente()` | Trigger sobre `auth.users` | Crea la fila de `clientes` desde la metadata del registro |
| `limpiar_mensaje_alerta_vencido()` | SECURITY DEFINER, sin acceso por API | La corre pg_cron cada minuto; borra el mensaje vencido |
| `validar_transicion_pedido()` | Trigger | Matriz de estados (7.4) |
| `fn_validar_max_destacados()`, `fn_validar_max_items_panel()` | Triggers | Topes de 10 destacados y 4 cards por panel |
| `actualizar_timestamp_pedidos()` | Trigger | Mantiene `actualizado_en` |

## 7.4 Estados de pedido

`pendiente → confirmado | cancelado` · `confirmado → listo_para_retirar | cancelado` · `listo_para_retirar → completado | cancelado`. `completado` y `cancelado` son terminales. En pantalla, WhatsApp y emails se muestran con el vocabulario de reserva (`formatEstadoPedido`): Nueva, Confirmada, Lista para retirar, Retirada y Cancelada; tienda y admin hablan de reservas, no de compras ni pedidos (tablas, estados y rutas no cambian). El trigger `trg_validar_transicion_pedido` rechaza cualquier otra transición con `check_violation`; un UPDATE que no cambia el estado (por ejemplo, eliminar) pasa sin validación.

## 7.5 Seguridad: RLS y privilegios

Modelo: la anon key es pública, así que RLS es la única barrera. Admins y clientes conviven en `auth.users`; ser admin es estar en `admins`.

| Tabla | anon / cualquiera | Cliente autenticado | Admin |
|---|---|---|---|
| `productos` | Lee `disponible` y `sin_stock` | Igual | Todo |
| `producto_variantes` | Lee variantes `disponible` de productos visibles | Igual | Todo |
| `categorias` | Lee `activa` | Igual | Todo |
| `producto_categorias`, items de paneles | Lee todo | Igual | Todo |
| `paneles_categoria` | Lee `activo` | Igual | Todo |
| `configuracion_tienda` | Lee | Igual | Lee, inserta, actualiza (sin DELETE) |
| `sucursales` | Lee | Igual | Todo |
| `pedidos` | — (solo vía RPC) | Lee los propios no eliminados | Lee y actualiza |
| `pedido_items` | — | Lee los de sus pedidos no eliminados | Lee |
| `clientes` | — | Lee su fila; actualiza solo nombre, apellido y teléfono | Lee todo |
| `admins` | — | — | — (solo service_role) |

Además:

- Se revocaron `TRUNCATE`, `TRIGGER` y `REFERENCES` a anon y authenticated en todas las tablas, e INSERT/UPDATE/DELETE directos sobre `pedidos` y `pedido_items` salvo el UPDATE del admin.
- Las funciones SECURITY DEFINER no tienen `EXECUTE` para `PUBLIC`; solo lo necesario.
- Storage: bucket público `imagenes-productos`, 5 MB por archivo, solo `image/webp`, `image/jpeg` e `image/png`; lectura pública y escritura solo para admins.
- `clientes` tiene CHECK de largos y formato de teléfono (en producción `NOT VALID`: aplica a filas nuevas o editadas; en una instancia nueva viene en el `CREATE TABLE`).

## 7.6 Auth de Supabase

- Confirmación de email obligatoria.
- Contraseña mínima de 8 caracteres con letras y números (la protección de contraseñas filtradas requiere plan Pro).
- Site URL: la tienda publicada. Redirect URLs: la tienda y `http://localhost:5173`, ambas con `/**`.
- Emails de Auth con el servidor por defecto de Supabase: entrega a cualquier dirección, pero con un límite bajo de envíos por hora y el template en inglés. El SMTP propio y el template en español quedan para cuando haya dominio (sección 11).

# 8. Edge Function `enviar-notificacion-pedido`

- Deno (`Deno.serve`), supabase-js fijado a `2.109.0` vía `npm:` en `deno.json`. `verify_jwt = false` en `config.toml`: la verificación es manual.
- Flujo: exige `Authorization`; obtiene el usuario con ese token; exige `is_admin() = true` (403 si no); valida que el body tenga solo `pedido_id` (uuid) y `estado` (`confirmado` o `listo_para_retirar`); lee el pedido, sus items y `nombre_tienda` con el token del admin (todo pasa por RLS); exige que el pedido ya esté en ese estado; arma el HTML escapando todo texto y lo envía por Resend.
- Contenido: textos de reserva ("Tu reserva fue confirmada" / "ya está lista para retirar"), asunto `Reserva confirmada — #NUMERO` o `Reserva lista para retirar — #NUMERO` y la variante de cada item leída de `pedido_items.nombre_variante`.
- Remitente: `"<nombre_tienda> <RESEND_FROM>"`, con `RESEND_FROM` por defecto `onboarding@resend.dev` (sandbox: solo entrega a la casilla de la cuenta de Resend).
- Errores de Resend se registran en los logs de la función; al admin le llega un mensaje genérico.
- Deploy: `supabase functions deploy enviar-notificacion-pedido`.

# 9. Rediseño visual

Estilo neo-brutalista / cómic: bordes negros sólidos, sombras duras sin difuminar, tipografía gruesa (Archivo Black para títulos, Space Grotesk para el resto) y fondo punteado en algunas secciones. El admin usa una versión sobria del mismo lenguaje (sin punteado ni sombras en tablas, barra superior negra con los filtros, un color por estado de pedido, sin títulos de página).

Reglas que aplican a cualquier cambio de estilo:

- Solo estética: CSS primero, JSX solo si el layout lo exige, nunca cambiar lógica.
- Todo sale de variables (`--color-*`, `--font-*`, `--brutal-*`, `--punteado-*`), duplicadas en `client/src/index.css` y `admin/src/index.css`. Nada hardcodeado.
- Compacto. Botones sin hover. Resaltador amarillo solo en títulos de sección. Nada inclinado salvo el logo del header.
- Verificar a 1366, ~1920, ~1000 y 375 px.

El detalle completo está en `docs/guia-de-estilo.md` y `docs/guia-de-estilo-admin.md`.

# 10. Variables de entorno y secrets

| Dónde | Variable | Notas |
|---|---|---|
| `client/.env.local`, `admin/.env.local` y cada proyecto de Cloudflare Pages y de Vercel | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | No versionadas; los `.env.example` solo tienen placeholders |
| Secrets de Supabase (Edge Functions) | `RESEND_API_KEY` | `supabase secrets set RESEND_API_KEY=...` |
| | `RESEND_FROM` (opcional) | Remitente con dominio verificado |
| | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Automáticas en el runtime |
| Secrets de GitHub | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Para el keep-alive |

La `service_role` key no se usa en ningún lado del proyecto.

# 11. Procedimientos operativos

- **Producción tiene datos**: aplicar solo cambios incrementales (`ALTER TABLE … ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS` + `CREATE POLICY`). Nunca volver a correr un `CREATE TABLE` del schema. Una función se corre entera en una sola ejecución: los comentarios internos no son bloques aparte.
- **Migraciones**: cada cambio de base para una instancia con datos va en `shared/migraciones/AAAA-MM-DD-nombre.sql` (idempotente, entre `BEGIN`/`COMMIT`, con su verificación al final), y además se incorpora a `schema.sql`, `rpc.sql` o `rls.sql` para que una instancia nueva nazca igual. El encabezado de cada script indica el orden respecto del deploy.
- **Columna nueva**: en el mismo cambio, regenerar tipos con `supabase gen types typescript --linked > shared/src/supabase/database.types.ts` (en Windows, verificar que quede en UTF-8) y actualizar tipos y mappers.
- **RLS**: que una policy esté en `rls.sql` no garantiza que esté en producción. Ante datos que "no aparecen", comparar contra `pg_policies` con `docs/auditoria/diagnostico.sql`.
- **Cambios en la Edge Function**: requieren deploy explícito.
- **Variables del hosting** (Cloudflare Pages y Vercel): cambiarlas requiere redeploy en los dos.
- **Verificación**: `npm run typecheck`, build de la app tocada y prueba en el navegador.
- **Trabajo con agentes de código**: tras corregir un error de build o de referencia, revisar el código resultante y no solo el resumen del agente. En zonas con bloques muy parecidos (constantes de íconos, por ejemplo) pedir el cambio con el fragmento exacto de antes y después.

# 12. Pendientes vigentes

Estado al 24/10/2026.

## 12.1 Despliegue de la fase 1 y migración a Cloudflare Pages

Hecho el 24/10/2026:

- Textos legales revisados por el dueño; push de la fase 1 y deploys de client y admin en Vercel.
- Migración `2026-10-23-telefonos-normalizados.sql` aplicada (antes, la vista previa); la verificación dio 0 teléfonos fuera de formato. Las dos reservas de prueba con teléfono no normalizable se eliminaron.
- Reservas reales probadas en PC y celular: WhatsApp se abre con el mensaje, el teléfono queda `549…`, la variante se guarda, y el aviso al cliente desde el admin arma el link sin `54` duplicado. Los emojis de ese aviso se ven como "�" en WhatsApp de escritorio y bien en el celular (es de WhatsApp, no de la app).
- Cloudflare Pages (1.11): proyectos `grow-client` y `grow-admin` creados (§3.3) y probados en `*.pages.dev` (headers, rutas de la SPA, reserva con WhatsApp, login del admin y subida de imagen).

- Site URL de Supabase Auth cambiada a la URL de Cloudflare.
- Vercel queda activo en paralelo por decisión del dueño (sin fecha de baja). Si algún día se da de baja: borrar los dos proyectos, los dos `vercel.json` y la URL de Vercel de las Redirect URLs.
- Dominio propio (cuando haya): agregarlo primero en **Custom domains** del proyecto de Pages (un CNAME creado antes da error 522); un dominio raíz necesita los DNS en Cloudflare, un subdominio alcanza con un CNAME a `<proyecto>.pages.dev`. Después, actualizar Site URL y Redirect URLs de Supabase.

## 12.2 Plan de trabajo (guía, sección 16)

- Fase 1 pendiente: **1.7** email automático al dueño (necesita dominio verificado en Resend), **1.12** backups cifrados (necesita R2, Drive, claves `age` y definir la retención, pregunta 3).
- Preguntas abiertas de la sección 17 sin responder: **5** (casilla "+18" en la reserva), 3 (retención de backups), 4 (backups en caso de mora), 6 (apagar la sección de reseñas desde el admin), 7 (canal de avisos de backup) y 8 (depósito en la DNDA). Respondidas: 1 (etiquetas de reserva) y 2 (teléfono en dos campos).
- Fases 2 y 3: sin empezar. Detalle y estado de cada tarea en `docs/auditoria/roadmap-funcionalidades.md`.

## 12.3 Hallazgos de la auditoría de la fase 1 que quedaron para después

(`docs/auditoria/informe-auditoria-codex-fase1.md`)

- El modal de confirmación muestra los precios del carrito y la base guarda los del catálogo: si un precio cambió mientras tanto, el total difiere. Se resuelve con la tarea 2.1 (re-precio al cargar el carrito y mostrar el total que devuelve la base).
- El aviso al dueño depende de que el comprador envíe el WhatsApp; con la tarea 1.7 deja de depender.
- Los teléfonos se validan por largo (área de 2 a 4 dígitos, 10 en total), no contra la lista oficial de códigos de área de ENACOM. Validarlo exige la lista completa: una incompleta rechazaría números reales.
- La política de privacidad promete supresión y retención sin un proceso definido ni proveedores nombrados: completarlo al personalizar cada instancia y con la tarea 2.6 (baja de cuenta y anonimización). La guía apoya "Datos protegidos" también en backups cifrados, que todavía no existen (1.12).

## 12.4 Antes de vender

- Dominio propio verificado en Resend → SMTP propio en Supabase (remitente con el nombre de la tienda y más envíos por hora), template de confirmación en español y secret `RESEND_FROM`.
- Cargar por instancia los datos legales del titular (Configuración → Datos legales) y el teléfono de WhatsApp del local con código de área. En la demo, el teléfono del local quedó cargado con uno de prueba.

## 12.5 Deuda técnica

- Cálculo de precio mínimo por variantes repetido en ProductsPage, FeaturedCarousel y la búsqueda de HeaderTop; conviene un hook común. La búsqueda filtra variantes con `estado IN (disponible, sin_stock)` aunque las variantes solo admiten `disponible`/`pausado` (inofensivo).
- Admin: etapa mobile dedicada (hoy se ve en 375 px pero sin diseño pensado para celular). Los `<select>` nativos muestran sus opciones con el estilo del sistema.
- Admin: el logo sigue siendo un PNG de 720 KB (el de la tienda ya es WebP de ~24 KB) y el bundle pesa ~1,28 MB.
- Items de paneles pausados legibles con la anon key (impacto bajo).
- Seed del admin por email en `rls.sql`: en una instancia nueva, sembrar por id después de verificar el usuario.
- Archivos huérfanos de antes de octubre de 2026 en el bucket (desde entonces el admin borra las imágenes reemplazadas y las de productos eliminados).
- `react-router` 6.x tiene un aviso moderado (open redirect con barra invertida) que no aplica a esta app; se resuelve migrando a la v7.
- Sin suite de tests automatizados.
- Sin invalidación en vivo: un cambio de configuración desde el admin se ve en la tienda al recargar.
- `Grow_Arquitectura_v13.docx` no refleja los cambios de la fase 1: regenerarlo a partir de este Markdown.

# Anexo A. Evolución resumida

| Versión | Qué agregó o cambió |
|---|---|
| ≤ v5 | Base del proyecto: catálogo, paneles de navegación, checkout como invitado con `crear_pedido_completo`, admin con pedidos y notificación WhatsApp/email, Banner con Google Maps embebido |
| v6 | Mensaje de alerta animado; auditoría del árbol de archivos; los SQL viven en `shared/` |
| v7 | Componentes del client por dominio; trigger de transiciones de pedido; hooks `useSucursales` y `useConfiguracionTienda`; `useModalAccesible`; se eliminan `geocode.ts` y leaflet; reseñas fijas pasan a ser decisión de producto |
| v8 | Cuentas de cliente (`clientes`, `admins`, `is_admin()`), vínculo pedido↔cliente, Mi Cuenta, admin que expulsa a no-admins |
| v9 | Detalle de pedido y caché en Mi Cuenta, modal de confirmación del checkout, nombre del header desde `clientes`, vencimiento del alerta con pg_cron, página de Clientes, policy de `pedido_items` faltante en producción |
| v10 | Normalización responsive desktop del admin |
| v11 | Exportación a Excel, primer deploy (GitHub + dos proyectos de Vercel) |
| v12 | Keep-alive con GitHub Actions |
| Oct. 2026 | Rediseño neo-brutalista de client y admin; barra fija del carrito, botón para subir, 404; auditoría de seguridad (precios y usuario resueltos en la base, RLS de `sucursales`, privilegios, Storage, Edge Function solo para admins, headers en Vercel, Auth endurecido, rutas solo para invitados, pedidos eliminados ocultos al cliente) |
| Oct. 2026, fase 1 | Reseñas de ejemplo genéricas con avatares SVG; "Datos protegidos" en lugar de "Compra Protegida"; lenguaje de reserva y etiquetas de estado; `guardar_producto` y snapshot `nombre_variante`; Términos de reserva, política de privacidad y datos legales del proveedor; SQL de `shared/` al día con producción y keep-alive que consulta una tabla; imágenes WebP en dos tamaños con caché larga y borrado de huérfanas; tienda liviana (paginación, columnas justas, lazy loading, caché compartida de hooks, logo WebP); teléfonos `549` en dos campos; reserva enviada por WhatsApp del comprador con número de reserva; ajustes de la auditoría externa; despliegue y migración del hosting a Cloudflare Pages |

Pendientes de versiones anteriores que hoy están resueltos y por eso no figuran en la sección 12: conectar `CategoryCard`/`es_card` (lo usa `CategoryDropdown`), migrar los `alert()` (no queda ninguno), `pedidos.usuario_id` duplicado en `schema.sql`, columnas de Categorías calculadas con JavaScript (hoy es grilla CSS), auditoría de `pg_policies` y verificación de la Edge Function como admin.

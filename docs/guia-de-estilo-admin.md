# Guía de estilo — rediseño del admin (neo-brutalismo sobrio)

Reglas visuales del backoffice (`admin/`). Complementa a [guia-de-estilo.md](guia-de-estilo.md), que define el estilo de la tienda pública (`client/`): leerla primero, porque acá solo se anota **qué se reusa, qué se suaviza y qué cambia**.

El objetivo es **solo estético**: no se cambia funcionalidad, lógica, datos ni textos con significado.

---

## 1. Enfoque: el mismo producto, menos cómic

El client es una vidriera: el neo-brutalismo con toques de cómic llama la atención y vende. El admin lo usa el dueño **todos los días** para cargar productos y gestionar pedidos: tablas largas, formularios, filtros. Ahí lo cómic cansa y estorba la lectura.

Decisión: **neo-brutalismo sobrio**. Misma base que el client (colores, fuentes, bordes negros, botón amarillo) para que se lea como el mismo producto, pero con menos recursos decorativos y más densidad.

| Recurso del client | En el admin |
|---|---|
| Colores, `--font-display` / `--font-ui`, `--brutal-border`, `--brutal-radius` | ✅ Igual |
| Botón principal amarillo / secundario blanco, con `--brutal-shadow-sm`, sin hover | ✅ Igual |
| Deshabilitado: borde punteado, fondo `--color-background-muted`, sin sombra, `opacity: 0.6` | ✅ Igual |
| Modales: `--brutal-border` + `--brutal-shadow-lg`, cabecera amarilla, botón cerrar cuadrado | ✅ Igual (ver `PedidoDetalleModal` / `ConfirmarPedidoModal` del client) |
| Inputs: `--brutal-border`, alto ~2.3rem, foco con `--brutal-shadow-sm`, errores en `--color-error` | ✅ Igual (ver `LoginPage.module.css` del client) |
| Resaltador amarillo | ⚠️ Solo en el título de página, y los títulos de página se están quitando: la barra lateral ya indica la sección (sin título en Dashboard y Pedidos) |
| Sombras duras | ⚠️ Solo botones, modales y desplegables. **Tablas, filas y tarjetas de métricas sin sombra** |
| Fondo punteado | ⚠️ Solo en el **login del admin**. Nunca detrás de tablas o formularios |
| Viñetas con borde | ⚠️ Para agrupar bloques (tarjetas de métricas, secciones de Configuración). Las tablas van en una sola viñeta con filas separadas por `--brutal-border-thin`, nunca tarjeta dentro de tarjeta |
| Animaciones, elementos inclinados, stickers | ❌ No |
| Etiqueta de estado de pedido monocromática del client | ❌ En el admin, **un color por estado** (ver 3.3) |

## 2. Variables

Viven en `admin/src/index.css`, **duplicadas** de las del client (apps aisladas: nunca importar desde `client/`). Ya están cargadas:

- Las mismas del client: `--color-primary` (amarillo), `--color-secondary` (negro), `--color-background`, `--color-background-muted`, `--color-error`, `--font-*`, `--brutal-*`, `--punteado-*`.
- `--color-texto-suave` (texto secundario) y `--color-overlay` (fondo de modales), derivados del tema con `color-mix()`.
- Los alias históricos `--color-brand-yellow` / `--color-brand-black` y las variables `--color-text` / `--color-border` ya se reemplazaron y se borraron.
- `--estado-<estado>-fondo` / `--estado-<estado>-texto` para `pendiente`, `confirmado`, `listo` (listo para retirar), `completado`, `cancelado`. Son los mismos valores que hoy están escritos sueltos en Dashboard y Pedidos.
- Las fuentes se cargan desde Google Fonts en `admin/index.html`. El `body` usa `--font-ui` y los controles de formulario la heredan.
- Checkboxes y radios tienen un estilo global en `index.css` (borde negro, marcado en amarillo con tilde o punto negro).
- Hoy hay muchos colores hardcodeados en los CSS (`#fff`, `#9ca3af`, `#6b7280`, `#dc2626`, `#059669`, `rgba(0,0,0,.4)`…). Al tocar cada archivo, pasarlos a variables o a `color-mix()`.

## 3. Componentes

### 3.1 Layout (`AdminLayout`)
- Barra lateral negra (`--color-secondary`) con ítems en `--font-ui`; el activo en amarillo con texto negro. Sin hover de color en los ítems (solo cursor), igual que los botones del client.
- Contenido sobre blanco, padding compacto (~1.5rem). Sin título de página (decisión del usuario: repite la barra lateral).
- Páginas con filtros: barra superior negra, despegada de la barra lateral (bloque redondeado, fija al hacer scroll). Sobre el negro, el filtro seleccionado lleva borde y sombra del color fuerte de su estado (`--estado-*-texto`); "Todos" queda blanco con amarillo. Ver `OrdersPage.module.css`. Ojo: ningún ancestro de la barra puede tener `overflow` distinto de `visible`/`clip`, o deja de quedar fija.

### 3.2 Tablas y listados (Pedidos, Productos, Paneles, Categorías, Clientes)
- Una sola viñeta (`--brutal-border`, radio estándar, fondo blanco) con filas separadas por `--brutal-border-thin`. Encabezado de columnas en `--font-display` chico (≈0.68rem, mayúsculas).
- Filas compactas: texto `0.8rem`, padding vertical ~0.55rem. Montos en `--font-display`.
- Botones de fila ("Editar", "Ver"): secundarios chicos. Acciones destructivas ("Eliminar"): secundario con texto `--color-error`, nunca rojo de fondo.

### 3.3 Etiqueta de estado de pedido
- Informativa, **sin sombra**: `--brutal-border-thin`, radio 6px, `--font-display` ~0.6rem en mayúsculas.
- Fondo y texto con `--estado-<estado>-fondo` / `-texto`. El ícono que ya tiene se mantiene.
- Los chips de filtro de Pedidos (Todos, Pendiente, …) usan los mismos colores; el seleccionado lleva `--brutal-border` y `--brutal-shadow-sm`.

### 3.4 Métricas (Dashboard, encabezado de Productos)
- Tarjetas en fila con borde parejo y **sin sombra** (ver la regla de 3.3 de la guía del client). Se quita el borde superior amarillo actual.
- Número en `--font-display`, etiqueta chica en mayúsculas.

### 3.5 Formularios (Configuración, ProductForm, PanelForm)
- Cada bloque en una viñeta con título en `--font-display` chico. Inputs como el client. Ayudas en `0.72rem` con opacidad.
- Toggles, checkboxes y radios: borde negro; marcado en amarillo con tilde negra.

### 3.6 Login del admin
- Una sola viñeta sobre fondo punteado: logo en cabecera negra y formulario debajo (decidido con el usuario).

## 4. Lo que el usuario rechazó en el client (aplica también acá)

- Hovers en botones (ni movimiento ni color). Tamaños grandes. Sombras de un solo lado en elementos en fila. Elementos de distinto peso compitiendo en la misma línea. Espacios desparejos. Íconos nuevos para contenido del admin (se usan las imágenes reales).

## 5. Estado del rediseño

| Sección | Estado | Archivos principales |
|---|---|---|
| Base: variables, fuentes, alias | ✅ | `admin/src/index.css`, `admin/index.html` |
| Login | ✅ (una sola viñeta sobre fondo punteado: logo en cabecera negra y formulario debajo. `/login` se ve aunque haya sesión, así que se verifica sin cerrarla) | `pages/LoginPage` |
| Layout (barra lateral) | ✅ (orden: Dashboard, Pedidos, Productos, Categorías, Paneles, Clientes, Configuración; íconos de trazo grueso 2.5) | `components/AdminLayout` |
| Dashboard | ✅ (rediseño con cambios funcionales pedidos por el usuario: sin métricas duplicadas ni "Ventas de hoy"; fila de 5 estados con Pendiente resaltado, últimos pedidos clickeables que abren el pedido, gráfico de pedidos de 7 días y aviso de productos sin stock) | `pages/DashboardPage` |
| Pedidos + modal de notificar | ✅ (barra superior negra fija; sin título ni total; carga los últimos 30 días + abiertos, con botón para ver antiguos; grupos por fecha en viñetas separadas; marca "Sin atender" para pendientes de más de 24 h; abre el pedido de `?id=`) | `pages/OrdersPage`, `components/NotificarPedidoModal` |
| Productos + formulario + selector de imagen | ✅ Productos y formulario (barra superior negra con buscador, categoría, completitud, chips de estado y acciones; grilla de tarjetas con imagen real y aviso de información incompleta; modal en dos columnas con pie fijo y categorías como chips). 🔶 selector de imagen | `pages/ProductsPage`, `components/ProductForm`, `components/ProductoImagenSelector` |
| Paneles + formularios | ✅ Paneles y editor (barra negra; orden en cuadro amarillo; el editor de categorías se despliega debajo de su fila). 🔶 formularios | `pages/PanelsPage`, `components/PanelForm`, `PanelItemForm`, `PanelItemsEditor` |
| Categorías | ✅ (barra negra con buscador, chips de estado y acciones; grilla CSS en lugar del cálculo de columnas con JS; cuadro de color con la cantidad de productos: amarillo, rojo si está vacía, gris si está pausada; edición del nombre en modal) | `pages/CategoriesPage` |
| Clientes | ✅ (barra negra con buscador por nombre/email/teléfono, orden y Excel; tarjetas con cantidad de pedidos y último pedido; modal de detalle con contacto, total retirado y sus pedidos) | `pages/CustomersPage` |
| Configuración | ✅ (sin título; secciones con cabecera gris, ícono amarillo, título y explicación: Información del local con horario centrado, Sucursales, Redes sociales y Mensaje de alerta con vista previa; Guardar al final, sin posición fija. El gris queda reservado para las cabeceras) | `pages/SettingsPage` |
| Diálogos (confirm / notify / toast) | 🔶 primera pasada | `components/ConfirmDialog`, `context/ConfirmContext` |
| Estados de carga y error | 🔶 primera pasada (`ErrorBoundary` pasó a CSS Module) | `components/LoadingState`, `ErrorState`, `ErrorBoundary` |
| Mobile del admin | ⏳ (etapa pendiente desde antes del rediseño) | todos |

🔶 = rediseñada de una vez en una primera pasada; falta la revisión página por página con el usuario.

Al terminar una sección, actualizar esta tabla.

## 6. Pendientes detectados (no estéticos; consultar antes de tocar)

- **Logo fijo**: `admin/src/assets/logo.png` (y `client/src/assets/logo.png`) es la imagen de un negocio dentro del código. Va contra el principio de genericidad; hoy se cambia reemplazando el archivo en cada instancia.
- "Grow Admin" en la barra lateral y `<title>Grow</title>`: es el nombre del producto, no de un negocio; confirmar con el usuario si se deja.

## 7. Forma de trabajo

La misma que el client (sección 6 de la guía del client), con estas diferencias:

- Dev server: `npm run dev:admin` (puerto **5174**; config `admin` en `.claude/launch.json`).
- Todas las páginas salvo el login requieren sesión de **admin**. El navegador del panel no tiene sesión: pedirle al usuario que inicie sesión ahí antes de verificar (Claude no ingresa credenciales reales). La sesión puede perderse si el panel se cierra; comprobar con `localStorage` (claves `sb-*`).
- Verificar con `npm run typecheck` y `npm run build:admin`.
- **No hacer acciones con efectos reales** al verificar (crear, editar, eliminar, cambiar estados de pedidos, notificar por WhatsApp/email): producción tiene datos. Para ver modales y formularios, abrirlos y cerrarlos sin guardar.

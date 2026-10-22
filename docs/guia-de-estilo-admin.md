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
| Resaltador amarillo | ⚠️ Solo en el **título de cada página** (Pedidos, Productos…), no en secciones internas |
| Sombras duras | ⚠️ Solo botones, modales y desplegables. **Tablas, filas y tarjetas de métricas sin sombra** |
| Fondo punteado | ⚠️ Solo en el **login del admin**. Nunca detrás de tablas o formularios |
| Viñetas con borde | ⚠️ Para agrupar bloques (tarjetas de métricas, secciones de Configuración). Las tablas van en una sola viñeta con filas separadas por `--brutal-border-thin`, nunca tarjeta dentro de tarjeta |
| Animaciones, elementos inclinados, stickers | ❌ No |
| Etiqueta de estado de pedido monocromática del client | ❌ En el admin, **un color por estado** (ver 3.3) |

## 2. Variables

Viven en `admin/src/index.css`, **duplicadas** de las del client (apps aisladas: nunca importar desde `client/`). Ya están cargadas:

- Las mismas del client: `--color-primary` (amarillo), `--color-secondary` (negro), `--color-background`, `--color-background-muted`, `--color-error`, `--font-*`, `--brutal-*`, `--punteado-*`.
- `--color-brand-yellow` / `--color-brand-black`: **alias históricos** que usan hoy los CSS del admin (72 usos cada uno). Apuntan a `--color-primary` / `--color-secondary`. Al rediseñar cada archivo, reemplazarlos por las variables del tema; cuando no quede ninguno, se borran.
- `--estado-<estado>-fondo` / `--estado-<estado>-texto` para `pendiente`, `confirmado`, `listo` (listo para retirar), `completado`, `cancelado`. Son los mismos valores que hoy están escritos sueltos en Dashboard y Pedidos.
- Las fuentes se cargan desde Google Fonts en `admin/index.html`. El `body` todavía usa la fuente del sistema: cada sección rediseñada declara `font-family: var(--font-ui)`; cuando estén todas, se pasa a `body`.
- Hoy hay muchos colores hardcodeados en los CSS (`#fff`, `#9ca3af`, `#6b7280`, `#dc2626`, `#059669`, `rgba(0,0,0,.4)`…). Al tocar cada archivo, pasarlos a variables o a `color-mix()`.

## 3. Componentes

### 3.1 Layout (`AdminLayout`)
- Barra lateral negra (`--color-secondary`) con ítems en `--font-ui`; el activo en amarillo con texto negro. Sin hover de color en los ítems (solo cursor), igual que los botones del client.
- Contenido sobre blanco, padding compacto (~1.5rem). Título de página con el resaltador.

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
- Puede mantener el split amarillo / negro actual o pasar a viñeta sobre fondo punteado como el login del client; decidir con el usuario.

## 4. Lo que el usuario rechazó en el client (aplica también acá)

- Hovers en botones (ni movimiento ni color). Tamaños grandes. Sombras de un solo lado en elementos en fila. Elementos de distinto peso compitiendo en la misma línea. Espacios desparejos. Íconos nuevos para contenido del admin (se usan las imágenes reales).

## 5. Estado del rediseño

| Sección | Estado | Archivos principales |
|---|---|---|
| Base: variables, fuentes, alias | ✅ | `admin/src/index.css`, `admin/index.html` |
| Login | ⏳ | `pages/LoginPage` |
| Layout (barra lateral) | ⏳ | `components/AdminLayout` |
| Dashboard | ⏳ | `pages/DashboardPage` |
| Pedidos + modal de notificar | ⏳ | `pages/OrdersPage`, `components/NotificarPedidoModal` |
| Productos + formulario + selector de imagen | ⏳ | `pages/ProductsPage`, `components/ProductForm`, `components/ProductoImagenSelector` |
| Paneles + formularios | ⏳ | `pages/PanelsPage`, `components/PanelForm`, `PanelItemForm`, `PanelItemsEditor` |
| Categorías | ⏳ (calcula columnas con JS en vez de grid CSS: pendiente conocido) | `pages/CategoriesPage` |
| Clientes | ⏳ | `pages/CustomersPage` |
| Configuración | ⏳ (la página más grande, ~930 líneas) | `pages/SettingsPage` |
| Diálogos (confirm / notify / toast) | ⏳ | `components/ConfirmDialog`, `context/ConfirmContext` |
| Estados de carga y error | ⏳ | `components/LoadingState`, `ErrorState`, `ErrorBoundary` |
| Mobile del admin | ⏳ (etapa pendiente desde antes del rediseño) | todos |

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

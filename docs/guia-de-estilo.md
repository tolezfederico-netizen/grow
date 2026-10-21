# Guía de estilo — rediseño neo-brutalista (client)

Reglas visuales de la tienda pública (`client/`), acordadas durante el rediseño. El objetivo es **solo estético**: no se cambia funcionalidad, lógica ni datos.

Estilo elegido: **neo-brutalista / cómic**. Bordes negros sólidos, sombras duras desplazadas (sin difuminar), tipografía gruesa en títulos y elementos que se leen como "viñetas". Siempre **compacto y limpio**: el usuario rechaza explícitamente lo sobrecargado (tamaños grandes, demasiadas animaciones, recursos repetidos).

---

## 1. Variables del tema

Todo sale de `client/src/index.css` (`:root`). No hardcodear colores ni valores sueltos: si falta algo, se agrega como variable.

| Variable | Valor | Uso |
|---|---|---|
| `--color-primary` | `#FDCE05` (amarillo) | Barra superior, botón principal, resaltador de títulos |
| `--color-secondary` | `#221E1F` (negro) | Bordes, texto, sombras, barra de categorías |
| `--color-background` | `#FFFFFF` | Fondos de tarjetas, botones secundarios |
| `--color-background-muted` | `#F3F4F6` | Placeholders, estados deshabilitados |
| `--font-display` | Archivo Black | Títulos de sección, navegación, precios, totales, nombres en mayúsculas |
| `--font-ui` | Space Grotesk | Todo el resto del texto |
| `--brutal-border` | `2px solid` negro | Borde estándar |
| `--brutal-border-thin` | `1.5px solid` negro | Elementos chicos (chips, miniaturas, botones − / +) |
| `--brutal-shadow-sm` / `--brutal-shadow` / `--brutal-shadow-lg` | 2 / 3 / 4 px | Sombra dura de botones / tarjetas / desplegables y modales |
| `--brutal-radius` | `8px` | Radio estándar (6px en elementos chicos) |
| `--punteado-color` / `--punteado-imagen` / `--punteado-tamano` | crema + puntos | Fondo punteado (ver 3.6) |

- Las fuentes se cargan desde Google Fonts en `client/index.html`.
- Tintes o transparencias: `color-mix(in srgb, var(--color-...) N%, ...)`, nunca `rgba()` ni hex sueltos.
- El `body` todavía usa la fuente del sistema: cada sección rediseñada declara `font-family: var(--font-ui)`. Cuando todas estén listas, se puede pasar a `body`.
- Admin (`admin/`) es una app aislada con su propio `index.css`: si se rediseña, las variables se **duplican** allá; no se importan desde client.

## 2. Tamaños: compacto

En cada iteración el pedido fue achicar. Referencias que funcionaron:

- Títulos de sección: `1.15rem`. Texto de cuerpo: `0.75rem–0.85rem`. Etiquetas chicas: `0.68rem–0.72rem`.
- Tarjetas de producto de unos **200px de ancho** (el carrusel calcula cuántas entran con ese objetivo).
- Header de unos 92px de alto; un desplegable no debería ocupar más de un tercio o la mitad de la pantalla en 1366px.
- Padding de sección: `1.75rem 1rem 2rem`. Contenido alineado a la izquierda con el borde de la barra de categorías (~1rem), no centrado en cajas angostas.

## 3. Componentes

### 3.1 Títulos de sección
"DESTACADOS", "RETIRO EN NUESTROS LOCALES", "LO QUE DICEN NUESTROS CLIENTES":
- `--font-display`, `1.15rem`, mayúsculas, color negro.
- **Resaltador amarillo** debajo del texto: `background: linear-gradient(transparent 58%, var(--color-primary) 58%)`.
- `display: inline` + `box-decoration-break: clone`, para que el resaltador siga cada línea si el título se parte en mobile.
- `margin-left: 0.6rem` para alinear con el contenido.

### 3.2 Botones
- **Secundario**: fondo blanco, `--brutal-border`, `--brutal-shadow-sm`, texto negro `--font-ui` 700.
- **Principal** (Agregar al carrito, Proceder al pago): igual pero con fondo amarillo.
- **Deshabilitado**: borde punteado (`border-style: dashed`), fondo `--color-background-muted`, sin sombra, `opacity: 0.6`.
- **Etiqueta informativa** (no clickeable, por ejemplo "No realizamos envíos"): fondo negro, texto amarillo, `--font-display`, **sin sombra**, para que no se confunda con un botón.

### 3.3 Tarjetas
- **En fila o grilla** (productos, reseñas, viñetas del Banner, productos del carrito): borde parejo en los 4 lados y **sin sombra en reposo**. Una sombra dura en tarjetas una al lado de la otra se lee como "borde más grueso a la derecha" y confunde.
- La tarjeta de producto (`ProductCard`) se levanta al pasar el mouse (`translate(-2px, -2px)` + `--brutal-shadow`) **solo en Destacados**. En la grilla del catálogo (`/productos`) el hover está anulado desde `ProductsPage.module.css`: con muchas tarjetas, el efecto constante resta profesionalismo.
- Precio siempre a la misma altura: el título reserva 2 líneas y, si no hay descripción, el precio reserva su línea (`.nombre + .precio`).
- Excepción: las tarjetas de categoría del desplegable del header (`CategoryCard`) tienen sombra en reposo, se levantan en hover y el pie se pinta de amarillo. Al usuario le gusta ese efecto ahí.
- Las imágenes van con `object-fit: contain` y un poco de padding, sobre blanco, sin recortar.

### 3.4 Desplegables, modales y paneles flotantes
- `--brutal-border` + `--brutal-shadow-lg` (estáticos), radio estándar.
- Ítems internos: en hover, fondo amarillo + borde negro fino (resultados de búsqueda, Info, Mi Cuenta, Ayuda).
- Modales: overlay con `color-mix` del negro; quitar el `outline` de foco del contenedor (`:focus { outline: none }`) cuando lo enfoca `useModalAccesible`.

### 3.5 Logo
- Siempre dentro de un **recuadro negro** (`--color-secondary`) con `box-shadow: 2px 2px 0` blanco: el logo tiene texto blanco ("growshop") que se pierde sobre amarillo o blanco.
- Solo el del header está inclinado (`rotate(-2deg)`). En el resto (mapa del Banner, footer) va **recto**.

### 3.6 Fondo punteado
- Usar siempre las variables `--punteado-*`.
- Está en: el desplegable de categorías, la sección del Banner, la lista de productos del carrito, el cuerpo del menú mobile y la franja del detalle de producto.
- Va **detrás de zonas con tarjetas blancas** encima. **No** usarlo en cada tarjeta, ni detrás de texto chico, totales o botones de acción.

## 4. Lo que el usuario rechazó (no repetir)

- **Hovers en botones**: ni desplazamiento ni cambio de color. Solo cambia el cursor. Aplica a Info, Mi Cuenta, Carrito, Ver Producto, Agregar al carrito, flechas, sucursales, redes y links del footer.
- **Repetir el resaltador amarillo** en precios u otros elementos: solo títulos de sección.
- **Elementos inclinados** fuera del logo del header (stickers, logos secundarios).
- **Íconos para representar contenido que carga el admin** (categorías, productos): se usan las imágenes reales. No agregar íconos nuevos; mantener solo los que ya existían.
- **Tamaños grandes**: tarjetas anchas, desplegables que tapan la pantalla.
- **Sombras de un solo lado** en elementos en fila (ver 3.3).
- **Elementos de distinto peso compitiendo en la misma línea** (por ejemplo, un título y un sticker más "gordo" al lado).
- **Espacios desparejos**: el espacio entre columnas tiene que ser uniforme.

## 5. Estado del rediseño

| Sección | Estado | Archivos principales |
|---|---|---|
| Header (barra, categorías, desplegable, buscador, Info, Mi Cuenta, AlertaBanner) | ✅ | `components/layout/Header*`, `CategoryDropdown`, `AlertaBanner`, `product/CategoryCard` |
| Destacados + tarjeta de producto | ✅ | `product/FeaturedCarousel`, `product/ProductCard` |
| Banner del local (viñetas) | ✅ | `home/Banner` |
| Reseñas | ✅ | `home/ReviewsCarousel` |
| Footer | ✅ | `layout/Footer` |
| Carrito lateral | ✅ | `cart/CartDrawer`, `cart/CartItemRow` |
| Catálogo `/productos` (barra lateral, badge "Compra Protegida", grilla) | ✅ | `pages/ProductsPage`, `product/ArticulosSidebar` |
| Detalle de producto (franja punteada con viñetas de imagen, compra y especificaciones) | ✅ | `pages/ProductDetailPage` |
| Checkout `/resumen` y modal de confirmación | ⏳ | `pages/ResumePage`, `common/ConfirmarPedidoModal` |
| Cuenta (login, registro, Mi Cuenta, detalle de pedido) | ⏳ | `pages/LoginPage`, `RegisterPage`, `MiCuentaPage`, `common/PedidoDetalleModal` |
| Términos y condiciones | ⏳ | `pages/TerminosCondicionesPage` |
| Botones flotantes (WhatsApp, volver arriba): en mobile tapan parte del footer | ⏳ | `layout/WhatsappFloatButton`, `layout/ScrollToTopButton` |
| Menú hamburguesa mobile (drawer) | ✅ (mismo esquema que el carrito lateral) | `layout/HeaderTop` (sección drawer) |
| Estados de carga y error | ⏳ | `common/LoadingState`, `common/ErrorState` |
| Admin | ⏳ (sin empezar) | `admin/` |

Al terminar una sección, actualizar esta tabla.

## 6. Forma de trabajo

1. El usuario manda screenshots de la sección. Antes de tocar nada, leer el `.tsx` y su `.module.css`.
2. Explicar en pocas líneas qué se va a cambiar. Si el pedido admite varias soluciones, recomendar una.
3. **CSS primero.** Tocar JSX solo si el layout lo exige (reordenar o agrupar elementos), sin cambiar lógica, fetches ni textos con significado.
4. Verificar en el navegador del panel (`localhost:5173`; el usuario suele tener el servidor ya levantado, y `.claude/launch.json` tiene la config) en **1366px, ~1920px, ~900–1024px y 375px**. Probar los estados (vacío, con datos, abierto/cerrado, hover).
   - El iframe de Google Maps tarda unos segundos en cargar.
   - Si las capturas del panel fallan o salen mal escaladas, medir con JavaScript (anchos, posiciones, cantidad de líneas).
5. `npm run typecheck` y `npm run build:client`.
6. Un **commit por sección terminada**, solo cuando el usuario lo pide. Push solo cuando lo pide.

## 7. Limitaciones conocidas

- La lista desplegada de un `<select>` nativo (variantes de producto) la dibuja el navegador y no se puede estilizar con CSS.
- La tarjeta de Google dentro del mapa (dirección + "Abrir en Maps") es parte del iframe y no se puede estilizar.

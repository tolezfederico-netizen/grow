# Grow — Contexto de diseño para generar mockups

> Este documento describe la aplicación web **Grow** para que puedas proponer mockups visuales realistas e implementables. Leelo completo antes de generar imágenes. Vas a recibir screenshots de secciones puntuales junto con pedidos concretos de mejora.

---

## 1. Qué es Grow

Grow es una plataforma web de ventas para **growshops físicos** (tiendas de cultivo: sustratos, fertilizantes, iluminación, macetas, parafernalia). Se vende como producto a distintos negocios, así que **no pertenece a una marca puntual**: el nombre de la tienda, el logo, las direcciones, los horarios, las redes y el catálogo cambian según el negocio que la compre.

**Modelo de compra (importante para el diseño):**
- El cliente navega el catálogo, arma un carrito y envía un **pedido**.
- **No hay pago online ni envíos.** El pedido se **retira en el local**. El negocio contacta al cliente por WhatsApp o email para coordinar.
- El cliente puede comprar **como invitado** o con una **cuenta** (registro opcional, con historial de pedidos).

Son dos aplicaciones separadas:
1. **Tienda pública (client):** para el cliente final. Es donde está el foco del rediseño.
2. **Panel de administración (admin):** para el dueño del negocio, que gestiona productos, pedidos, clientes y configuración.

**Objetivo actual:** actualizar y modernizar la estética **sin cambiar la funcionalidad**. Todo funciona bien; buscamos que se vea más actual, prolijo y profesional.

---

## 2. Identidad visual actual

### Colores
| Rol | Valor | Uso actual |
|---|---|---|
| Primario (amarillo de marca) | `#FDCE05` (rgb 253, 206, 5) | Barra de navegación, botones principales, footer, bloque de información del local |
| Secundario (negro de marca) | `#221E1F` (rgb 34, 30, 31) | Barra superior del header, botones secundarios, estado activo, tarjetas sobre fondo amarillo |
| Fondo | `#FFFFFF` | Fondo general |
| Fondo atenuado | `#F3F4F6` | Inputs (buscador) |
| Texto | `#111827` | Texto general |
| Bordes | `#E5E7EB` | Bordes de cards e inputs |

Los colores están centralizados en variables, así que **una paleta nueva es fácil de aplicar**. Igual, el amarillo y el negro son la identidad del producto: proponé variaciones (tonos, acentos, neutros complementarios) antes que reemplazarlos por completo, salvo que se pida explícitamente.

### Tipografía
Hoy usa la fuente del sistema (`system-ui`). Se puede proponer una fuente de **Google Fonts** (indicá cuál por nombre).

### Estilo actual
Bloques planos de color sólido (amarillo y negro), bordes redondeados chicos (4–8px), sombras suaves y pocas, íconos de línea simples (estilo Feather/Lucide), estética funcional y algo "básica".

---

## 3. Estructura general de la tienda pública

Todas las páginas comparten este esqueleto, de arriba hacia abajo:

```
┌──────────────────────────────────────────────────────────┐
│ AlertaBanner (opcional): texto que se desplaza en loop    │  ← solo si el dueño cargó un aviso
├──────────────────────────────────────────────────────────┤
│ HeaderTop (fondo negro): logo · buscador · Info ·         │
│   Mi Cuenta · botón Carrito con contador                  │
├──────────────────────────────────────────────────────────┤
│ HeaderNav (fondo amarillo): paneles de categorías con     │
│   flecha ▾ · a la derecha "Términos y Condiciones", "Ayuda"│
│   └─ al pasar el mouse: menú desplegable con categorías   │
├──────────────────────────────────────────────────────────┤
│                    CONTENIDO DE LA PÁGINA                 │
├──────────────────────────────────────────────────────────┤
│ Footer (fondo amarillo): Categorías · Contacto · Redes    │
│ Franja negra de copyright                                 │
└──────────────────────────────────────────────────────────┘
Flotantes: botón de WhatsApp (abajo a la derecha) y botón "volver arriba".
Carrito: panel lateral (drawer) que se abre desde la derecha.
```

- El header es **sticky** (queda fijo arriba) y se compacta un poco al hacer scroll.
- En **mobile**, la barra amarilla de categorías y los botones se reemplazan por un **menú hamburguesa** que abre un drawer lateral con secciones: Mi cuenta, Categorías, Info y Ayuda. El buscador se abre como una fila aparte con un ícono de lupa.

---

## 4. Páginas y componentes (tienda pública)

### 4.1 Header (`HeaderTop`, `HeaderNav`, `CategoryDropdown`, `AlertaBanner`)
- **HeaderTop:** logo de la tienda (imagen que cambia por negocio), un **buscador** con forma de píldora que muestra resultados en vivo (miniatura, nombre y precio del producto), un botón **Info** con un desplegable (dirección de la sucursal principal y adicionales, horarios, redes sociales con íconos), un botón de **cuenta** ("Mi Cuenta" o el nombre del cliente logueado, con un desplegable: Ingresar / Registrarse, o Mi cuenta / Cerrar sesión) y el botón **Carrito** con un contador circular de unidades.
- **HeaderNav:** una fila con los "paneles" (grupos de categorías que define el dueño, por ejemplo "Cultivo", "Iluminación", "Parafernalia"). Al pasar el mouse sobre uno se despliega un **menú** con sus categorías. A la derecha están "Términos y Condiciones" y "Ayuda" (desplegable con WhatsApp y Email).
- **AlertaBanner:** franja angosta en la parte superior con un mensaje libre que se desplaza de derecha a izquierda (por ejemplo "Este sábado cerramos por feriado"). Aparece solo cuando el dueño carga un mensaje.

### 4.2 Home (`/`)
En orden:
1. **Destacados (`FeaturedCarousel`):** título "Destacados" y un carrusel horizontal de tarjetas de producto con flechas ← →.
2. **Banner del local (`Banner`):** sección a dos columnas:
   - Izquierda: **mapa de Google Maps embebido** (iframe) con el logo encima, un overlay "Abrir en Maps ↗" y, si hay varias sucursales, botones para cambiar de sucursal.
   - Derecha (fondo amarillo): franja negra "Retiro en nuestros locales", texto chico "Encontranos en nuestro local", **nombre de la tienda** grande, dirección con un ícono de pin, y **tres tarjetas negras** con ícono: *Modalidad* (solo retiro, no hacemos envíos), *Horario de atención* (horario, lunes a viernes, fines de semana cerrado) y *Redes sociales / Contacto* (teléfono, email, redes).
3. **Reseñas (`ReviewsCarousel`):** puntaje promedio con estrellas y total de reseñas, más un carrusel que se arrastra con el mouse o el dedo, con tarjetas de reseña (avatar redondo, nombre, estrellas y texto recortado a 5 líneas). Al hacer click se abre un modal con la reseña completa.
4. Footer.

### 4.3 Catálogo (`/productos`, `/productos/:categoria`, `/productos/panel/:panel`)
Layout a dos columnas:
- **Sidebar izquierda (`ArticulosSidebar`):** buscador "Buscar artículo…", botón "Ver pedido" con un badge de cantidad (abre el carrito), y un **acordeón** de paneles: cada panel se expande y muestra sus categorías. El panel o la categoría activa queda resaltado.
- **Contenido:** link "← Ver todos los productos" (cuando hay un filtro activo), badge de confianza **"Compra Protegida — Tus datos cuidados durante toda la compra"** (con ícono de escudo) y una **grilla de tarjetas de producto**.
- Estado vacío: "No hay productos disponibles."

### 4.4 Tarjeta de producto (`ProductCard`), el componente más repetido
De arriba hacia abajo:
- **Imagen** del producto (fondo blanco). Si no tiene imagen, se muestra un placeholder gris con un ícono.
- **Nombre** y una **descripción** corta opcional.
- **Precio** en formato argentino (`$ 12.500`). Si el producto tiene variantes, muestra el precio más bajo de ellas.
- **Selector de variantes** (un `<select>`, por ejemplo "1 litro — $ 8.000"), solo si el producto tiene variantes. Si no las tiene, se deja un espacio vacío para que todas las tarjetas tengan la misma altura.
- Dos acciones: **"Ver Producto"** (secundaria) y **"Agregar al carrito"** (principal, amarilla, con ícono de carrito).
- Estado **sin stock**: el botón se pone gris, dice "Sin Stock" y queda deshabilitado.

### 4.5 Detalle de producto (`/producto/:id`)
Usa la misma sidebar del catálogo a la izquierda. Al centro: imagen grande, nombre (título), precio, selector de variantes, descripción, selector de cantidad (− n +), botón "Agregar al carrito" (o estado sin stock), badge "Compra Protegida" y **"Compartir este producto"** (WhatsApp, Facebook y copiar link). Si el producto tiene **"Especificaciones"**, aparecen en una columna aparte. En mobile todo se apila en una columna.

### 4.6 Carrito (`CartDrawer` + `CartItemRow`)
Panel lateral desde la derecha con un overlay oscuro:
- Encabezado: ícono + "Carrito de Compras" y una X para cerrar.
- Lista de ítems: miniatura, nombre, variante, precio, controles − cantidad + y eliminar.
- Vacío: ícono grande y el texto "El carrito de compras está vacío."
- Pie: **Total**, el aviso "Solo retiro en nuestros locales — no realizamos envíos" y el botón principal **"Proceder al pago"**. El texto dice "pago", pero en realidad lleva al resumen del pedido.

### 4.7 Checkout / Resumen (`/resumen`)
El header aparece en una **versión reducida** (sin la barra de categorías) y no se muestra el botón flotante de WhatsApp.
- Título "Resumen del pedido", lista de productos con totales y un formulario de contacto: **Nombre y Apellido, Teléfono, Email** (con validación y mensajes de error debajo de cada campo). Si el cliente tiene la sesión iniciada, el formulario viene precargado.
- Badge "Compra Protegida".
- Al confirmar se abre un **modal de confirmación** (`ConfirmarPedidoModal`) con el resumen de los ítems y el total, más los botones Cancelar y Confirmar.
- Éxito: "¡Pedido recibido! Te vamos a contactar a la brevedad para coordinar el retiro." y debajo vuelve a aparecer el carrusel de destacados.

### 4.8 Cuenta del cliente
- **Login (`/login`)** y **Registro (`/registro`)**: formularios simples. El registro pide nombre, apellido, teléfono, email y contraseña.
- **Mi Cuenta (`/mi-cuenta`)**: dos columnas en escritorio (se apilan en mobile):
  - **Perfil**: nombre, apellido y teléfono editables; el email es de solo lectura; botón Guardar.
  - **Historial de pedidos**: lista con fecha, **estado** (Pendiente, Confirmado, Listo para retirar, Completado, Cancelado) y productos. Un botón **"Ver"** abre un modal con el detalle: imagen, nombre, variante, cantidad, precio unitario, subtotal y total.
- **Términos y Condiciones**: página de texto legal.

### 4.9 Estados genéricos
- `LoadingState`: indicador de carga.
- `ErrorState`: mensaje de error con un botón "Reintentar".

---

## 5. Panel de administración (admin)

Es una app aparte, de uso interno para el dueño. Comparte la paleta (negro y amarillo).

- **Layout (`AdminLayout`)**: **sidebar negra** a la izquierda con el título "Grow Admin" y los links Dashboard, Pedidos, Productos, Clientes, Paneles, Categorías y Configuración. El link activo se muestra con fondo amarillo y hay un botón de cerrar sesión. En mobile la sidebar se abre con un botón y un overlay.
- **Login**: pantalla dividida entre un panel de marca y un formulario centrado.
- **Dashboard**: tarjetas de estadísticas y una grilla con los pedidos recientes por estado.
- **Pedidos**: lista de pedidos con datos del cliente (botones para copiar email y teléfono), ítems, total y botones para cambiar de estado. Al confirmar o marcar "listo para retirar" se abre un modal para notificar al cliente por WhatsApp o Email.
- **Productos / Categorías / Paneles**: listados con buscador, filtros, estadísticas, selección múltiple con acciones en lote y formularios de alta y edición (en Productos también variantes e imagen).
- **Clientes**: listado con buscador, botones de copiar y "Descargar Excel".
- **Configuración**: formulario largo dividido en bloques (fieldsets con ícono): datos de la tienda, dirección, horarios, teléfono, email, redes sociales, sucursales adicionales y mensaje de alerta con fecha de vencimiento opcional.
- Notificaciones: diálogos de confirmación y toasts en una esquina.

---

## 6. Restricciones para que el mockup sea implementable

1. **Contenido genérico y variable.** Usá nombres de ejemplo neutrales ("Grow Shop", "Sustrato Premium 50L", "Fertilizante Floración 1L"). Los textos tienen largo variable: un nombre de producto puede ocupar una o tres líneas, puede haber 2 o 10 paneles en la barra de navegación, una tienda puede tener 1 o 4 sucursales. El diseño tiene que funcionar en todos esos casos.
2. **No inventar funcionalidades.** No agregues pago con tarjeta, envíos, calculadora de envío, wishlist, comparador, puntuación de productos, chat en vivo, filtros por precio ni selector de idioma o moneda: no existen. Sí podés reubicar, agrupar y reestilizar lo que ya existe.
3. **Mantener los mensajes clave del modelo de negocio**: "solo retiro en el local" y "no realizamos envíos" tienen que seguir visibles donde están hoy (Banner, carrito).
4. **Logo e imágenes:** el logo es una imagen que sube cada negocio (de forma y colores desconocidos). Las fotos de producto vienen en cualquier formato, a menudo con fondo blanco.
5. **Mapa:** el bloque del local usa un mapa de Google Maps embebido; se puede cambiar su tamaño, encuadre o bordes, pero sigue siendo un iframe de Google Maps.
6. **Responsive:** proponé la versión **desktop (~1440px)** y, cuando se pida, la **mobile (~390px)**. El header mobile usa menú hamburguesa.
7. **Implementable con CSS estándar:** colores sólidos, degradados simples, sombras, bordes redondeados, transiciones. Evitá efectos que dependan de imágenes de fondo decorativas generadas, ilustraciones a medida o texturas complejas. Si proponés un ícono, que sea del estilo de línea simple (Lucide / Feather).
8. **Accesibilidad básica:** buen contraste de texto (ojo con el texto blanco sobre amarillo, que no se lee bien) y tamaños de texto legibles.
9. **Idioma:** toda la interfaz está en **español rioplatense** ("Encontranos", "Ingresá", etc.).

---

## 7. Qué entregar con cada mockup

Además de la imagen, acompañala con una breve descripción de:
- Colores usados (en hex) y cuál reemplaza a cuál de la paleta actual.
- Tipografía (nombre de la fuente de Google Fonts, pesos y tamaños aproximados).
- Radios de borde, sombras y espaciados aproximados.
- Qué cambió respecto del screenshot original y por qué.

Esto permite trasladar el diseño al código con precisión.

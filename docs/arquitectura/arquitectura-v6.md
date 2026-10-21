
# GROW

Plataforma Modular de Ventas para Growshops

Documento de Arquitectura y Decisiones Técnicas

Versión 6.0 — Banner de alerta configurable (client + admin), auditoría completa del árbol de archivos contra el código real, y corrección de ubicaciones documentadas de forma incorrecta desde v5.0

Agosto 2026


# 1. Introducción y Filosofía del Proyecto

Grow es una plataforma de software pensada para ser vendida de forma íntegra (pago único, sin modelo de suscripción tipo SaaS) a distintos negocios del rubro growshop. El proyecto se construye bajo un principio rector: la modularidad y la genericidad.

Ningún elemento del código hace referencia a un negocio particular. La carpeta raíz, los nombres de variables, configuraciones por defecto y estructuras de datos están pensados de forma genérica, de modo que el mismo código base pueda reutilizarse para distintos clientes con el menor esfuerzo de adaptación posible.

Todo dato que varía de un negocio a otro (nombre de la tienda, dirección, horarios, redes sociales, email de contacto, catálogo de productos, y desde esta versión, el mensaje de alerta configurable) vive en la base de datos (Supabase), nunca hardcodeado en el código fuente. La única excepción consciente son los colores del tema visual, que se definen a nivel de código por decisión exclusiva del desarrollador en cada despliegue, y no son configurables desde el panel de administración.

Nota — Esta versión detecta una segunda excepción de facto a este principio — no consciente, sino producto de una implementación apresurada — en client/src/components/ReviewsCarousel/ReviewsCarousel.tsx, donde 10 reseñas de clientes, un promedio de puntuación y un total de reseñas están hardcodeados en el componente en vez de vivir en Supabase. Ver sección 4.6 y sección 11.


## 1.1 Modelo de negocio

El sistema resuelve el flujo de ventas de un growshop físico que no cuenta con e-commerce: el cliente final visualiza el catálogo de productos disponibles, arma un pedido, y lo envía al dueño del negocio. El modelo de entrega es exclusivamente retiro en el local (no hay delivery). El dueño gestiona el ciclo de vida del pedido desde un panel de administración privado, puede notificar al cliente en cada cambio de estado relevante (ver sección 5.11), y desde esta versión puede además comunicar avisos generales a todos los visitantes de la tienda mediante un cartel animado configurable (ver sección 4.5).


## 1.2 Estado del proyecto (v6.0)

Esta versión tiene dos frentes de trabajo de naturaleza distinta. El primero es funcional: se implementó de punta a punta un banner de alerta configurable — el dueño del negocio escribe un mensaje libre desde SettingsPage (admin), y ese mensaje se muestra como un cartel animado en la parte superior de la tienda pública (client), desplazándose de derecha a izquierda en loop continuo, con el mismo amarillo de marca que el resto de la navegación. El segundo frente es documental: se realizó una auditoría completa del árbol de archivos real del proyecto contra lo documentado en v5.0, encontrando nueve archivos existentes en el código que nunca habían sido incorporados al documento de arquitectura, y un error de ubicación arrastrado desde v5.0 respecto a dónde viven los archivos SQL del proyecto.

A diferencia de iteraciones anteriores, el desarrollo de esta versión no fue lineal: la implementación del banner de alerta atravesó una serie de errores de edición encadenados de parte del agente ejecutor (una referencia a una constante de ícono nunca declarada, seguida de un borrado accidental de la declaración de una función vecina, seguido de una duplicación completa de esa misma constante, seguido del borrado accidental de una tercera constante no relacionada) antes de estabilizarse. Este historial se documenta en detalle en la sección 8.3, no como anécdota sino porque deja una lección operativa concreta sobre cómo verificar el trabajo de agentes de código en este proyecto.


## 1.3 Novedades respecto a v5.0

- Client: nuevo componente AlertaBanner — cartel de mensaje configurable, posicionado por encima de HeaderTop y HeaderNav, visible únicamente cuando el admin cargó texto en el campo correspondiente.
- Shared: nuevo campo mensaje_alerta (string | null) en el tipo ConfiguracionTienda, con su mapeo correspondiente en mapearConfiguracionTienda, y la columna mensaje_alerta text agregada a la tabla configuracion_tienda.
- Admin: nuevo campo de texto "Mensaje de alerta" en SettingsPage, con su propio fieldset e ícono, siguiendo el patrón visual ya establecido por el resto del formulario.
- Documentación: incorporación al árbol de archivos de nueve componentes/utilidades que existían en el código pero no figuraban en ninguna versión anterior del documento — ver sección 2.1.
- Documentación: corrección de la ubicación real de schema.sql, rls.sql y rpc.sql — viven en /shared, no en /supabase como indicaban v4.0 y v5.0.
- Deuda técnica nueva registrada: tres puntos de fetch independientes y no unificados de configuracion_tienda (antes se documentaba solo la duplicación entre HomePage y usePaneles; se suma ahora WhatsappFloatButton), duplicación del fetch de sucursales entre useSucursales.ts y HeaderNav.tsx, y datos de reseñas de clientes hardcodeados en ReviewsCarousel.tsx en lugar de vivir en Supabase. Ver sección 11.

# 2. Estructura del Monorepo

El proyecto se organiza como un monorepo con npm workspaces, alojado en un único repositorio de GitHub. Contiene tres paquetes principales: client, admin y shared, más una carpeta supabase/functions/ para Edge Functions (introducida en v5.0).


## 2.1 Árbol de archivos relevantes (actualizado y corregido en v6.0)

Nota — Esta sección reemplaza por completo a la 2.1 de v5.0, que tenía dos problemas: omitía nueve archivos existentes en el código, y ubicaba incorrectamente los tres archivos SQL del proyecto dentro de /supabase cuando en realidad viven en /shared. Los elementos nuevos respecto a v5.0 están marcados con (†v6).

/grow

/client/src

/components → Header, HeaderTop, HeaderNav, CategoryDropdown,

ProductCard, CartItemRow, LoadingState, ErrorState,

ErrorBoundary, ArticulosSidebar, Banner, CartDrawer,

CategoryCard, FeaturedCarousel, Footer,

AlertaBanner (†v6, *), ScrollToTop (†v6),

WhatsappFloatButton (†v6),

ReviewsCarousel/ReviewsCarousel (†v6, en subcarpeta propia)

/hooks → usePaneles.ts, useSucursales.ts (†v6)

/context → CartContext.tsx (useReducer)

/pages → HomePage, ProductsPage, ResumePage,

ProductDetailPage (†v6, no documentada desde su creación)

/utils → geocode.ts (‡huérfano, ver sección 11),

redesSociales.tsx (†v6)

App.tsx + main.tsx

/admin/src

/components → AdminLayout, ProductForm, PanelForm,

PanelItemsEditor, PanelItemForm,

ProductoImagenSelector, ProtectedRoute,

LoadingState, ErrorState, ErrorBoundary,

ConfirmDialog, NotificarPedidoModal

/context → AuthContext.tsx, ConfirmContext.tsx

/pages → LoginPage, DashboardPage, ProductsPage,

CategoriesPage, OrdersPage, SettingsPage (*),

PanelsPage

/utils → iconoEstado.tsx (†v6)

App.tsx + main.tsx

/shared/src

/types → producto.ts, categoria.ts, pedido.ts,

configuracion-tienda.ts (*), panel-categoria.ts, index.ts

/supabase → client.ts, database.types.ts, mappers.ts (*), index.ts

/utils → formatPrecio.ts, validarEmail.ts,

formatEstadoPedido.ts (†v6)

/constants → index.ts

schema.sql · rls.sql · rpc.sql   ← ubicación real (‡‡v6)

index.ts

/supabase

/functions

/enviar-notificacion-pedido → index.ts, deno.json

config.toml

(*) Modificado o creado en v6.0.

(†v6) Archivo existente en el código, incorporado a la documentación

por primera vez en esta versión.

(‡) Sin consumidores — candidato a eliminación, ver sección 11.

(‡‡v6) Corrección respecto a v4.0/v5.0, que documentaban estos tres

archivos dentro de /supabase. Viven en /shared desde, al menos,

v4.0 — es un error de documentación arrastrado, no un cambio

de ubicación reciente.

Nota — La carpeta /supabase real del repositorio solo contiene functions/ y config.toml (más una carpeta .temp/ generada localmente por la Supabase CLI — caché de sesión, no forma parte del proyecto versionable). No aloja ningún archivo SQL.

Nota — Se detectaron además dos archivos sueltos en la raíz del repositorio (estructura.txt y estructura_proyecto.txt), generados manualmente durante el proceso de auditoría de esta versión para contrastar el árbol real contra el documentado. No forman parte del código del proyecto — se recomienda agregarlos a .gitignore si no se van a versionar.


### 2.1.1 Excepciones a la convención de estructura plana de components/

La convención general del proyecto es que cada componente vive como un archivo .tsx suelto (junto a su .module.css) directamente dentro de components/, sin subcarpetas. Esta versión documenta la primera y única excepción encontrada en el código: ReviewsCarousel vive en su propia subcarpeta, components/ReviewsCarousel/ReviewsCarousel.tsx. No se identificó una razón funcional para esta excepción — es tratada como inconsistencia menor, no como un patrón a replicar.


### 2.1.2 Utilidades que retornan JSX (.tsx dentro de utils/)

Tanto client/src/utils/ como admin/src/utils/ contienen, cada uno, un archivo con extensión .tsx en lugar de .ts: redesSociales.tsx (client) e iconoEstado.tsx (admin). Ambos son técnicamente utilidades (funciones puras que reciben un identificador de tipo string y devuelven una representación visual), pero como retornan JSX (componentes de ícono SVG inline) requieren la extensión .tsx para que el compilador de TypeScript los procese correctamente. Se documenta como convención observada, no como una regla escrita explícitamente en el proyecto: cuando una utilidad necesita devolver marcado, su archivo pasa a .tsx aunque viva dentro de la carpeta utils/.


## 2.2 Reglas de aislamiento entre client y admin

- Client y admin son aplicaciones completamente independientes: no existe ningún link, botón o redirección de una hacia la otra.
- Cada una se despliega como proyecto separado en Vercel (pendiente), apuntando al mismo repositorio con Root Directory distinto.
- El paquete shared no se despliega de forma independiente. Se consume vía TypeScript path alias @shared/* → shared/src/*, resuelto en tiempo de build por Vite sin paso de compilación intermedio.
- Las Edge Functions en supabase/functions/ corren en un runtime Deno separado (gestionado por Supabase), fuera del build de Vite de client/admin — no comparten el path alias @shared, ver sección 5.12.
- Los puertos de desarrollo son distintos: client en 5173, admin en 5174.

# 3. Stack Tecnológico


## 3.1 Multi-tenancy por instancia separada

Cada negocio que adquiere el proyecto recibe su propia instancia de Supabase, completamente aislada. No existe un modelo multi-tenant con una sola base de datos compartida ni discriminación por tenant_id. Las credenciales de conexión (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY) se configuran vía variables de entorno en .env.local de cada app, una por instancia desplegada.

El envío de emails de notificación depende de una cuenta de Resend por instancia (ver sección 5.12). Esto extiende el modelo de multi-tenancy: cada negocio que use la funcionalidad de email necesitará su propia cuenta de Resend (y, para producción real con clientes, su propio dominio verificado), del mismo modo que ya necesita su propia instancia de Supabase.


## 3.2 Convención de estilos

- Variables de tema declaradas en :root en client/src/index.css y admin/src/index.css (--color-primary, --color-secondary, --color-background, --color-text, --color-border en client; --color-brand-black, --color-brand-yellow y equivalentes en admin).
- Cada componente y page tiene su propio archivo .module.css al lado del .tsx.
- Los module.css consumen las variables del global, nunca hardcodean colores.
- Para adaptar el proyecto a un nuevo negocio, el cambio visual se limita a las variables de :root.
Nota — El componente AlertaBanner (sección 4.5) es la única excepción detectada a la regla de "nunca hardcodear colores": su texto usa color: white de forma literal en vez de una variable de tema, porque el banner siempre se renderiza sobre var(--color-primary) (amarillo de marca) independientemente de qué negocio use el proyecto, y blanco es el único color con suficiente contraste garantizado sobre ese fondo. Se documenta como excepción deliberada, no como deuda técnica.


## 3.3 Librerías

Sin cambios respecto a v5.0. react-leaflet y leaflet ya no forman parte de las dependencias de client desde la migración del Banner documentada en v5.0, aunque su desinstalación efectiva del package.json sigue pendiente (ver sección 11). No se incorporó ninguna librería nueva en v6.0 — la animación del AlertaBanner se implementó con CSS puro (@keyframes), sin dependencias adicionales.


# 4. Aplicación Client (Tienda Pública)

Aplicación pública orientada al consumidor final del growshop. Permite visualizar el catálogo, armar un pedido y enviarlo al dueño del negocio para retiro en el local.


## 4.1 Pages y routing

Cuatro pages conforman el routing público del client: HomePage (landing, con Banner, FeaturedCarousel y ReviewsCarousel), ProductsPage (listado filtrable de catálogo), ProductDetailPage (ficha de producto individual — documentada por primera vez en esta versión, ver sección 4.6), y ResumePage (checkout: carrito, formulario de contacto y confirmación).


## 4.2 CartDrawer — checkout conectado

Sin cambios respecto a v5.0. El botón "Proceder al pago" navega a /resumen, deshabilitado cuando el carrito está vacío, con cierre del drawer antes de navegar.


## 4.3 ResumePage — validaciones de formulario

Sin cambios respecto a v5.0. El formulario de contacto (nombre, teléfono, email) valida nombre y apellido completo (mínimo 2 palabras), teléfono numérico de 8 a 10 dígitos (filtrado de forma reactiva en el propio onChange), y formato de email.


## 4.4 Banner — mapa embebido

Sin cambios respecto a v5.0. Iframe embed de Google Maps generado por URL a partir de la dirección de configuracion_tienda, sin librerías ni geocoding propio.


## 4.5 AlertaBanner — cartel de mensaje configurable (nuevo en v6.0)

Componente nuevo de mayor impacto de esta iteración en el client. Muestra un mensaje de texto libre, cargado por el admin desde SettingsPage, como un cartel animado posicionado por encima de todo el resto del Header (por encima de HeaderTop y HeaderNav, dentro del mismo <header> sticky).


### 4.5.1 Comportamiento

- El componente recibe como prop la misma config: ConfiguracionTienda | null que ya reciben HeaderTop y HeaderNav — no realiza un fetch propio a Supabase.
- Si config es null, o config.mensaje_alerta es null, undefined, o una cadena vacía/solo espacios, el componente retorna null y no renderiza absolutamente nada — no ocupa espacio en el layout ni dentro del header sticky.
- Cuando hay texto válido, se renderiza un contenedor de ancho completo con fondo var(--color-primary) (el mismo amarillo que .nav en HeaderNav.module.css), y dentro el texto del mensaje animado en loop continuo de derecha a izquierda.
- No tiene botón de cierre ni lógica de "descartar": se muestra siempre que haya un mensaje configurado, sin forma de que el visitante lo oculte por sí mismo.

### 4.5.2 Animación — implementación e iteraciones de ajuste

La animación se implementa en CSS puro (sin JavaScript ni librerías), vía @keyframes sobre .textWrapper (position: absolute dentro de .container, que tiene position: relative y overflow: hidden). La versión final, ajustada a lo largo de varias correcciones durante esta iteración, anima la propiedad transform en vez de left:

@keyframes scroll {

from { transform: translateX(0); }

to   { transform: translateX(calc(-100vw - 100%)); }

}

El punto de partida es left: 100% fijo en .textWrapper (el texto arranca pegado al borde derecho del contenedor, sin desfase adicional), y la animación lo traslada exactamente 100vw + 100% de su propio ancho — el ancho de la ventana más su propio ancho —, lo mínimo necesario para garantizar que el texto recorra visiblemente toda la pantalla y desaparezca por completo del lado izquierdo antes de reiniciar el loop, sin distancia muerta invisible en ningún extremo.

Nota — Esta fórmula final es el resultado de dos rondas de corrección sobre una primera implementación defectuosa. La versión original animaba transform: translateX(0) → translateX(-100%) partiendo de left: 100% fijo — un error sutil, porque los porcentajes de transform: translateX() se calculan sobre el ancho propio del elemento (el ancho del texto), no sobre el ancho del contenedor. Como el texto es casi siempre mucho más angosto que el banner completo, el resultado visual era un recorrido muy corto seguido de un salto brusco al reiniciar el loop. La corrección intermedia animó left en lugar de transform (los porcentajes de left sí se calculan sobre el contenedor, por ser position: absolute), lo cual resolvió el recorrido corto pero introdujo un problema distinto: dejaba una distancia muerta muy larga —el elemento viajaba desde 100% del contenedor hasta -100% del contenedor, pero seguía siendo invisible durante buena parte de ese trayecto si el contenedor era más angosto que la ventana—, lo que se percibía como una pausa larga antes de que el texto volviera a aparecer. La fórmula final, con transform: calc(-100vw - 100%), resuelve ambos problemas a la vez al anclar el recorrido al ancho real de la ventana en vez de al ancho del contenedor o del propio texto.


### 4.5.3 Parámetros visuales actuales

- Altura: padding: 18px 0 en .container (ajustado desde un valor inicial de 8px 0, considerado demasiado chico).
- Tipografía: font-size: 1.15rem, font-weight: 600, color: white (ver excepción de la sección 3.2).
- Velocidad: animation: scroll 8s linear infinite en .textWrapper. Este valor pasó por varios ajustes durante la sesión (12s inicial → 6s → 10s → 8s final) hasta encontrarse un balance aceptable entre legibilidad y dinamismo; es el parámetro más subjetivo del componente y el más probable de volver a ajustarse en el futuro.

### 4.5.4 Dato en Supabase

El mensaje se persiste en la columna mensaje_alerta (text, nullable, sin default) de la tabla configuracion_tienda — ver sección 6 y sección 7. Se carga a través del mismo fetch de configuracion_tienda que ya alimentaba a HeaderTop y HeaderNav dentro de usePaneles.ts, consumido por Header.tsx y pasado hacia abajo por props. No se creó un fetch nuevo ni un hook dedicado para este campo, por decisión explícita de no sumar un cuarto punto de fetch de la misma tabla mientras la unificación de esos fetches sigue pendiente (ver sección 11).


## 4.6 ProductDetailPage — ficha de producto individual (documentada por primera vez en v6.0)

Page que existía en el código desde antes de esta versión pero nunca había sido incorporada al documento de arquitectura, detectada durante la auditoría de esta iteración. Muestra la ficha completa de un producto individual: imagen, nombre, precio (o rango de precios / precio de la variante seleccionada), selector de variantes cuando corresponde, descripción, selector de cantidad con botones +/-, botón "Agregar al carrito" (con estado visual distinto cuando el producto está sin stock), badge de "Compra Protegida", y botones de compartir (WhatsApp, Facebook, y copiar link para Instagram).

Reutiliza ArticulosSidebar (el mismo sidebar de navegación/búsqueda de categorías que usa ProductsPage) en su columna izquierda, y agrega una columna de "Especificaciones" cuando el producto tiene ese campo cargado. Layout en dos columnas (flex) que colapsa a una sola columna en mobile (media query a 768px).

Esta versión ajustó además el tamaño de varios elementos considerados demasiado grandes en el diseño original: título y precio bajaron de font-size: 1.5rem a 1.15rem, los botones de sumar/restar cantidad de 2.25rem a 1.75rem de lado, y el botón "Agregar al carrito" redujo su padding y tamaño de fuente proporcionalmente.


## 4.7 ReviewsCarousel — carrusel de reseñas (documentado por primera vez en v6.0)

Componente que existía en el código desde antes de esta versión, detectado durante la auditoría. Muestra un carrusel horizontal de reseñas de clientes con scroll tipo "arrastrar con mouse o dedo" (implementado con Pointer Events — onPointerDown/Move/Up/Leave, usando setPointerCapture), un resumen de puntuación promedio con estrellas, y un modal que se abre al hacer click (no arrastre) sobre una reseña individual para leer el texto completo sin el recorte de 5 líneas (-webkit-line-clamp: 5) que tienen las cards del carrusel.

⚠ Deuda técnica nueva — A diferencia del resto de los datos configurables del proyecto, las reseñas no viven en Supabase: están hardcodeadas como un array de 10 objetos directamente en el componente (reviews: Review[]), junto con dos constantes fijas, PUNTUACION_PROMEDIO = 4.8 y TOTAL_RESENAS = 232. Esto contradice el principio rector documentado en la sección 1 ("todo dato que varía de un negocio a otro vive en Supabase"), ya que las reseñas de clientes son, por definición, un dato específico de cada instancia del proyecto. Las diez imágenes de avatar referenciadas (/1.jpg … /10.jpg) explican, además, por qué esos diez archivos sueltos existen en client/public/. Ver sección 11 para la recomendación de resolución.


## 4.8 Otros componentes y utilidades documentados por primera vez en v6.0


### 4.8.1 ScrollToTop

Componente de utilidad sin render propio (retorna null). Escucha pathname vía useLocation() de React Router y ejecuta window.scrollTo(0, 0) en cada cambio de ruta, montado una única vez a nivel de App.tsx dentro del Router, para que cada navegación entre pages arranque con el scroll en el tope en vez de heredar la posición de scroll de la page anterior.


### 4.8.2 WhatsappFloatButton

Botón flotante circular, fijo en la esquina inferior derecha de la pantalla (position: fixed), con el ícono de WhatsApp, que abre https://wa.me/<telefono> en una pestaña nueva. Solo se renderiza si config.telefono existe y no está vacío.

⚠ Deuda técnica nueva — Este componente realiza su propio fetch independiente a configuracion_tienda (supabase.from('configuracion_tienda').select('*').maybeSingle()) dentro de su propio useEffect, en vez de recibir la configuración por props como hacen HeaderTop, HeaderNav y AlertaBanner. Esto eleva a tres los puntos de fetch duplicado de la misma tabla en el client (los otros dos, HomePage y usePaneles, ya estaban documentados como deuda técnica desde v4.0). Ver sección 11.


### 4.8.3 useSucursales

Hook que trae la lista de sucursales desde Supabase (ordenadas por el campo orden), las mapea con mapearSucursal (de @shared) y devuelve el array Sucursal[] — sin estado explícito de carga ni manejo de error. Consumido por HeaderTop.tsx en el dropdown de "Info", para listar la sucursal principal (tomada de configuracion_tienda) junto con las sucursales adicionales.

⚠ Deuda técnica nueva — HeaderNav.tsx no utiliza este hook: repite la misma consulta a la tabla sucursales de forma independiente dentro de su propio useEffect, para armar el dropdown de "Sucursales" del nav. El resultado es la misma tabla consultada dos veces en paralelo en cada carga de página, desde dos partes distintas del mismo árbol de componentes (Header renderiza tanto HeaderTop como HeaderNav). Ver sección 11.


### 4.8.4 redesSociales.tsx

Dos utilidades relacionadas al manejo de redes sociales configuradas en configuracion_tienda.redes_sociales: parseRedSocial(red, url), que dado el nombre de la red (instagram, facebook, tiktok, twitter, whatsapp) y su valor guardado devuelve un label legible y un href navegable (o null si la URL es inválida o el campo está vacío); y RedSocialIcon({ red }), un componente que devuelve el ícono SVG inline correspondiente a cada red. Ambas se consumen desde HeaderTop.tsx dentro del dropdown de "Info".


# 5. Aplicación Admin (Backoffice)

Backoffice privado de uso exclusivo del dueño del negocio. Requiere autenticación vía Supabase Auth. Permite gestionar catálogo, categorías, paneles de navegación, pedidos y configuración general de la tienda.


## 5.1 — 5.10 Sin cambios funcionales respecto a v5.0

LoginPage, DashboardPage, ProductsPage (admin), CategoriesPage, PanelsPage, AdminLayout, AuthContext/ProtectedRoute y el módulo ConfirmDialog + ConfirmContext no tuvieron cambios en esta iteración. Se documentan íntegramente en versiones anteriores de este documento.


## 5.11 Gestión de pedidos (OrdersPage) — sistema de notificación al cliente

Sin cambios respecto a v5.0. Al transicionar un pedido a "confirmado" o "listo_para_retirar", se abre un modal de selección de canal (NotificarPedidoModal) para notificar al cliente por WhatsApp, Email, o ambos.


## 5.12 Edge Function: enviar-notificacion-pedido

Sin cambios respecto a v5.0. Función serverless en Deno que envía el email de notificación vía la API REST de Resend.


## 5.13 SettingsPage — campo de Mensaje de alerta (nuevo en v6.0)

Se agregó un nuevo fieldset al formulario de configuración de la tienda, siguiendo exactamente el mismo patrón visual que el resto de los campos: un <fieldset className={styles.campoCard}> con <legend> (ícono + texto "Mensaje de alerta") y, dentro, un <textarea> controlado en lugar de un <input> de una sola línea, dado que el mensaje puede ser más extenso que los demás campos de configuración.

- El estado local del formulario (interfaz ConfigData, que no es exactamente ConfiguracionTienda de @shared sino su equivalente con strings vacíos en lugar de null) suma el campo mensaje_alerta: string, siguiendo el mismo criterio que ya usa email_contacto.
- Al guardar, un campo vacío o con solo espacios se persiste como null (config.mensaje_alerta.trim() || null), mismo criterio que email_contacto — el banner del client interpreta null o vacío como "no mostrar nada".
- El campo no tiene validación de formato (a diferencia de email_contacto): cualquier texto, o directamente vacío, es un valor válido.
- Se agregó una nueva constante de ícono, ICONO_ALERTA (triángulo de alerta con exclamación — mismo path SVG que ya usaba el aviso de ResumePage en el client), junto a las demás constantes de íconos del archivo.

### 5.13.1 Incidente de implementación — constantes de ícono corrompidas

La incorporación de ICONO_ALERTA a SettingsPage.tsx no fue un cambio limpio: el agente ejecutor encadenó tres errores sucesivos antes de dejar el archivo en un estado correcto y compilable. Se documenta la secuencia completa porque deja una lección operativa reutilizable para el resto del proyecto, no solo para este campo puntual.

- Error 1 — referencia sin declaración: el primer prompt ejecutado insertó el uso de {ICONO_ALERTA} en el JSX del nuevo fieldset, pero el resumen de la tarea reportado por el agente afirmó (incorrectamente) haber declarado también la constante. En los hechos, la declaración nunca se escribió. Resultado: ReferenceError: ICONO_ALERTA is not defined, que rompía la carga completa del panel de admin (no solo del campo nuevo — un ReferenceError en el árbol de componentes de nivel superior tira abajo toda la SPA).
- Error 2 — declaración de función borrada por colisión de edición: al corregir el error 1, el agente insertó el bloque const ICONO_ALERTA = (...) inmediatamente antes de la función function iconoRed(red: string) { switch (red) { ... }, pero en el proceso eliminó por error la propia línea function iconoRed(...) {, dejando el switch (red) { colgando fuera de cualquier función. Resultado: error de sintaxis de Babel/Vite ('return' outside of function) — un error de build, más grave que el anterior porque ni siquiera permite que la aplicación arranque en modo desarrollo.
- Error 3 — declaración duplicada: al corregir el error 2 (restaurar la línea function iconoRed...), el agente terminó insertando el bloque completo de ICONO_ALERTA por segunda vez en lugar de solamente la línea de función faltante, dejando dos declaraciones idénticas y consecutivas de const ICONO_ALERTA. Resultado: Identifier 'ICONO_ALERTA' has already been declared.
- Error 4 — constante vecina borrada por el mismo patrón: al corregir el error 3 (eliminar la declaración duplicada), el agente borró por error la constante ICONO_SUCURSAL —no relacionada con ICONO_ALERTA, pero ubicada inmediatamente después en el archivo— en lugar de la copia duplicada de ICONO_ALERTA. Resultado: ReferenceError: ICONO_SUCURSAL is not defined, rompiendo nuevamente la carga completa del panel, esta vez en el fieldset de "Sucursales", sin relación funcional alguna con el campo que se estaba intentando arreglar.
Nota — Los cuatro errores comparten un mismo patrón de fondo: ediciones de texto libre sobre bloques de código adyacentes y visualmente similares (varias constantes const ICONO_X = (<svg>...</svg>) seguidas unas de otras), sin un mecanismo de verificación estructural antes de dar la tarea por concluida. En los cuatro casos, el resumen en lenguaje natural que el agente reportó como "listo" no coincidía con el estado real del archivo. La lección operativa adoptada para el resto del proyecto, documentada aquí para consulta futura: (1) para cualquier corrección sobre una zona del código con múltiples bloques estructuralmente idénticos o muy similares entre sí, el prompt correctivo debe incluir el fragmento exacto de antes/después en vez de una descripción en prosa del cambio; y (2) tras cualquier corrección de un error de build o de referencia, se le debe pedir al agente que pegue en su respuesta el bloque de código final resultante (no solo un resumen de lo hecho), para poder verificarlo visualmente antes de recargar la aplicación y confiar en que el problema quedó resuelto.


# 6. Paquete Shared

Tipos TypeScript (producto.ts, categoria.ts, pedido.ts, configuracion-tienda.ts, panel-categoria.ts), cliente de Supabase, capa de mappers, utils y constants.


## 6.1 Cambios en configuracion-tienda.ts (nuevo en v6.0)

Se agregó el campo mensaje_alerta: string | null a la interfaz ConfiguracionTienda. El tipo ConfiguracionTiendaInput, definido como alias directo de ConfiguracionTienda (export type ConfiguracionTiendaInput = ConfiguracionTienda), no requirió ningún cambio propio al ser un alias — se actualizó automáticamente.


## 6.2 Cambios en mappers.ts (nuevo en v6.0)

La función mapearConfiguracionTienda suma el campo mensaje_alerta: row.mensaje_alerta ?? null al objeto de dominio que devuelve, siguiendo el mismo patrón de normalización que ya aplicaba a los demás campos nullable de la tabla.


## 6.3 formatEstadoPedido.ts (documentado por primera vez en v6.0)

Función pura formatEstadoPedido(estado: string): string, existente en el código desde antes de esta versión pero nunca documentada. Formatea un literal de estado de pedido (por ejemplo listo_para_retirar) a texto legible para mostrar en la interfaz: reemplaza guiones bajos por espacios y capitaliza la primera letra (listo_para_retirar → Listo para retirar). Vive en shared/ en lugar de admin/, bajo el criterio de que el estado de un pedido es un concepto de dominio compartido, aunque en la práctica sea consumida casi con certeza únicamente por admin (OrdersPage), dado que client no expone el detalle de estados de pedido al usuario final.

Nota — Las Edge Functions (Deno) no consumen el paquete shared — no tienen acceso al path alias @shared, por correr en un runtime separado del build de Vite. El formateo de moneda usado en el email de notificación se reimplementó de forma local dentro de la función (Intl.NumberFormat('es-AR')), en vez de importar formatPrecio.ts. Ver sección 5.12 y sección 11.


# 7. Base de Datos (Supabase / Postgres)

El modelo de 10 tablas, la función crear_pedido_completo y las políticas de rls.sql se mantienen sin cambios estructurales respecto a v5.0, con una única adición de columna en esta versión.


## 7.1 Nueva columna: configuracion_tienda.mensaje_alerta

ALTER TABLE configuracion_tienda

ADD COLUMN IF NOT EXISTS mensaje_alerta text;

Columna nullable, sin valor por defecto. Definida en shared/schema.sql dentro de la declaración de la tabla configuracion_tienda. No requirió ninguna política nueva en rls.sql: al ser una columna más de una tabla ya cubierta por las políticas RLS existentes de configuracion_tienda, hereda el mismo criterio de lectura/escritura que el resto de los campos de esa tabla.

Nota — Durante la puesta en producción de esta columna se cometió un error operativo que vale la pena documentar: al intentar aplicar el cambio contra la instancia real de Supabase, se pegó por error la sentencia CREATE TABLE configuracion_tienda (...) completa —copiada desde schema.sql— en el SQL Editor del dashboard, en lugar de un ALTER TABLE puntual. Dos problemas con ese enfoque: (1) la tabla ya existía en producción, por lo que un CREATE TABLE hubiera sido rechazado o, en el peor caso, hubiera arriesgado los datos ya cargados; y (2) el fragmento pegado estaba además incompleto (le faltaba el CHECK del email y el cierre final de la sentencia), lo que produjo un error de sintaxis antes de llegar siquiera a ejecutarse. La forma correcta de aplicar una columna nueva sobre una tabla ya existente en producción es siempre un ALTER TABLE ... ADD COLUMN IF NOT EXISTS acotado, nunca volver a correr el CREATE TABLE completo del schema.


# 8. Decisiones Técnicas Tomadas Durante la Implementación

Se conservan las decisiones de versiones anteriores y se agregan las de esta iteración.


## 8.1 Ubicación del nuevo dato: columna vs. tabla nueva

Se evaluó, antes de implementar el banner de alerta, si el mensaje configurable debía vivir como columna nueva en configuracion_tienda o como una tabla propia. Se optó por la columna, por ser un dato único por instancia/negocio (no una lista de elementos), consistente con el resto de los campos de esa misma tabla (nombre_tienda, direccion, horario_apertura, etc., todos también valores únicos por instancia).


## 8.2 Reutilización del fetch existente de configuracion_tienda

Se decidió explícitamente no crear un fetch nuevo ni un hook dedicado para leer mensaje_alerta, a pesar de que hubiera sido la opción más simple de implementar de forma aislada. En cambio, AlertaBanner recibe config como prop, reutilizando el mismo objeto que usePaneles.ts ya trae y que Header.tsx ya distribuye hacia HeaderTop y HeaderNav. La razón: sumar un cuarto fetch independiente de la misma tabla hubiera empeorado activamente una deuda técnica ya identificada (ver sección 11), en vez de solamente no resolverla. Esta decisión implica una limitación conocida y aceptada: el client no tiene forma de enterarse en vivo de un cambio de mensaje hecho desde el admin mientras la página ya está cargada — el visitante necesita refrescar para ver un mensaje nuevo o la desaparición de uno viejo, igual que ocurre con el resto de los campos de configuracion_tienda.


## 8.3 Verificación de trabajo del agente ejecutor tras errores de build

A raíz de la cadena de errores descripta en la sección 5.13.1, se adoptó como práctica para el resto del proyecto que, tras cualquier corrección de un error de sintaxis, referencia no definida, o duplicación de código, se le solicite al agente ejecutor pegar en su propia respuesta el bloque de código final resultante del área modificada, en vez de aceptar únicamente un resumen en lenguaje natural de lo realizado. Esta práctica no reemplaza probar la aplicación en el navegador, pero permite detectar antes errores estructurales (declaraciones faltantes, duplicadas, o mal anidadas) que un resumen textual del propio agente tiende a no reflejar con precisión cuando el propio agente es la fuente del error.


## 8.4 Animación del banner: transform vs. left

Documentada en detalle en la sección 4.5.2. Se deja registrada aquí como principio general reutilizable para cualquier animación futura de desplazamiento horizontal completo de un elemento cuyo ancho es menor al del contenedor: los porcentajes de transform: translateX() se resuelven contra el ancho propio del elemento animado, mientras que los porcentajes de las propiedades de posicionamiento (left, right) en un elemento position: absolute se resuelven contra el ancho de su contenedor con position: relative. Ninguna de las dos por sí sola resuelve correctamente un recorrido de "pantalla completa" cuando el contenedor y el elemento tienen anchos muy distintos entre sí — la solución que sí generaliza bien es anclar el desplazamiento a una unidad de viewport (vw) combinada con el ancho propio vía calc().


# 9. Archivos SQL del Proyecto

Ubicación real (corregida en esta versión, ver sección 2.1): shared/schema.sql, shared/rls.sql, shared/rpc.sql. Orden obligatorio al inicializar una instancia nueva: schema.sql → rpc.sql → rls.sql.


# 10. Variables de Entorno y Secrets


## 10.1 Frontend (client y admin) — sin cambios

VITE_SUPABASE_URL=https://<tu-project-ref>.supabase.co

VITE_SUPABASE_ANON_KEY=<tu-anon-key-publica>

Cada app necesita su propio .env.local, no commiteado a git. Los valores se obtienen en el dashboard de Supabase, bajo Project Settings → API.


## 10.2 Secrets de Edge Functions — sin cambios

Se configuran vía Supabase CLI, no en archivos .env del repositorio:

supabase secrets set RESEND_API_KEY=re_...

SUPABASE_URL y SUPABASE_ANON_KEY están disponibles automáticamente en el runtime de toda Edge Function del proyecto, sin necesidad de setearlas manualmente.


# 11. Puntos Pendientes para Próximas Etapas

- Nuevo en v6.0 — mover las reseñas de clientes de ReviewsCarousel.tsx (array hardcodeado de 10 reviews, más PUNTUACION_PROMEDIO y TOTAL_RESENAS fijos) a una tabla propia en Supabase, siguiendo el mismo principio que rige el resto del catálogo y la configuración de la tienda. Requiere definir una tabla nueva (ej. resenas: autor, puntuacion, texto, imagen_url, orden) y, probablemente, un mecanismo de carga de imágenes de avatar similar al que ya existe para productos (ProductoImagenSelector en admin).
- Nuevo en v6.0 — unificar el fetch de configuracion_tienda entre tres puntos independientes: HomePage, usePaneles (ya documentado como pendiente desde v4.0) y WhatsappFloatButton (nuevo punto detectado en esta versión). Un hook único, por ejemplo useConfiguracionTienda, resolvería los tres casos a la vez.
- Nuevo en v6.0 — unificar el fetch de sucursales entre useSucursales.ts (usado por HeaderTop) y la consulta manual duplicada dentro de HeaderNav.tsx, que no usa el hook existente.
- Verificar un dominio propio en Resend para poder notificar por email a clientes reales — actualmente el envío está limitado a modo sandbox (solo a la casilla registrada en la cuenta de Resend). Es un paso de configuración por instancia/negocio, no de código.
- Eliminar client/src/utils/geocode.ts — quedó sin consumidores tras la migración del Banner a Google Maps embed (v5.0, sección 4.4).
- Desinstalar react-leaflet, leaflet (y @types/leaflet si existiera) del package.json de client — las dependencias de npm no se removieron en el mismo cambio que el código.
- Conectar CategoryCard y el campo es_card a una vista real — sigue sin resolverse desde v4.0 (candidato: grilla de "categorías destacadas" en HomePage).
- Extraer a un hook compartido la lógica de fetch + cálculo de precioMinimo por variantes, duplicada entre ProductsPage (client) y FeaturedCarousel — sigue pendiente desde v4.0.
- Migrar los alert() nativos restantes (SettingsPage, algún flujo de error en OrdersPage) al notify() de ConfirmContext — sigue pendiente desde v4.0.
- Validación de transiciones de estado de pedido en el servidor (trigger de Postgres o RLS condicional) — sigue pendiente desde v3.0.
- Despliegue en Vercel de client y admin como proyectos separados — sigue pendiente desde v2.0.
- Evaluar si el email de notificación debería reusar exactamente el mismo formateo de moneda que el resto del proyecto (formatPrecio de shared) mediante alguna estrategia de código compartido entre Vite y Deno, en vez de la reimplementación local actual en la Edge Function.
- Nuevo en v6.0 — evaluar si conviene agregar al banner de alerta una forma de invalidación en vivo (por ejemplo, Supabase Realtime sobre configuracion_tienda) para que un cambio de mensaje hecho desde el admin se refleje sin necesidad de que el visitante refresque la página — ver la limitación aceptada en la sección 8.2. No es urgente: es la misma limitación que ya tiene el resto de configuracion_tienda desde el inicio del proyecto.

# 12. Resumen Ejecutivo de Decisiones

v6.0 agrega al client y al admin una pieza funcional nueva pero acotada —un banner de mensaje configurable, pensado para avisos generales del negocio (promociones, cambios de horario, feriados) que no ameritan el flujo más pesado de notificación por pedido documentado en la sección 5.11— y dedica el resto de la iteración a una tarea puramente documental: contrastar el árbol de archivos real del repositorio contra lo escrito en el documento de arquitectura, encontrando nueve archivos huérfanos de documentación y una ubicación incorrecta (los tres SQL) arrastrada sin corregir desde, como mínimo, v4.0.

La implementación del banner en sí fue simple en su diseño final —un campo de texto nuevo en Supabase, una prop más pasada a través del árbol de Header, y una animación en CSS puro— pero atravesó dos episodios de fricción real documentados en detalle porque dejan lecciones aplicables al resto del proyecto: una cadena de cuatro errores de edición encadenados sobre un bloque de constantes de ícono estructuralmente repetitivo (sección 5.13.1), que llevó a adoptar la práctica de pedir siempre el código final tras una corrección en vez de confiar en el resumen del agente; y un error conceptual de animación CSS —confundir el sistema de referencia de los porcentajes en transform: translateX() con el de las propiedades de posicionamiento absoluto— que requirió dos iteraciones de ajuste antes de llegar a una fórmula robusta (sección 4.5.2 y 8.4).

La auditoría documental deja como saldo más importante no los nueve archivos en sí —cuyo comportamiento no cambia por documentarlos— sino tres deudas técnicas nuevas que solo se hicieron visibles al leer ese código con atención: datos de reseñas de clientes hardcodeados en contra del principio rector del proyecto (sección 4.7), y dos puntos adicionales de fetch duplicado de tablas que ya tenían este problema documentado desde antes, ahora peor de lo que constaba (sección 11). Quedan como prioridad para la siguiente iteración: resolver el hardcodeo de reseñas, y evaluar si conviene abordar de una vez la unificación de los distintos fetches de configuracion_tienda y sucursales antes de que se sume un punto más.

Grow — Documento de Arquitectura v6.0 — Agosto 2026


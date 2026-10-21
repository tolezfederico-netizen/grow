
# GROW

Plataforma Modular de Ventas para Growshops

Documento de Arquitectura y Decisiones Técnicas

Versión 7.0 — Reorganización de components/ en client por dominio, auditoría de calidad ejecutada y cinco hallazgos resueltos (validación server-side de transiciones de pedido, unificación de fetches duplicados, limpieza de código muerto, accesibilidad de teclado en modales)

Agosto 2026


# 1. Introducción y Filosofía del Proyecto

Grow es una plataforma de software pensada para ser vendida de forma íntegra (pago único, sin modelo de suscripción tipo SaaS) a distintos negocios del rubro growshop. El proyecto se construye bajo un principio rector: la modularidad y la genericidad.

Ningún elemento del código hace referencia a un negocio particular. Todo dato que varía de un negocio a otro (nombre de la tienda, dirección, horarios, redes sociales, catálogo de productos, mensaje de alerta) vive en Supabase, nunca hardcodeado. Las únicas dos excepciones conscientes y documentadas son los colores del tema visual (decisión exclusiva del desarrollador por despliegue) y el contenido de client/src/components/home/ReviewsCarousel/ReviewsCarousel.tsx.

Nota — Sobre esta segunda excepción: en versiones anteriores de este documento, las reseñas hardcodeadas de ReviewsCarousel se habían registrado como deuda técnica a resolver. En esta versión se aclara que es una decisión de producto deliberada, no una omisión: el propietario del proyecto determinó explícitamente que las reseñas de clientes NO deben ser editables por el administrador del negocio desde ningún panel, y que el propio desarrollador se encarga de mantenerlas actualizadas directamente en el código en cada despliegue. Se retira este punto de la lista de deuda técnica en la sección 11 de esta versión.


## 1.1 — 1.2 Modelo de negocio y multi-tenancy

Sin cambios respecto a v6.0. Retiro en local exclusivamente, ciclo de vida de pedidos gestionado desde admin, una instancia de Supabase por negocio.


## 1.3 Estado del proyecto (v7.0)

Esta versión tuvo dos frentes de trabajo, ambos de naturaleza estructural más que funcional — a diferencia de v6.0 (que sumó una feature visible, el banner de alerta), v7.0 no agrega ninguna funcionalidad nueva de cara al usuario final ni al administrador. El primer frente fue reorganizar client/src/components/, que hasta v6.0 tenía todos los componentes sueltos en un mismo nivel (con la única excepción de ReviewsCarousel/), en cinco subcarpetas por dominio. El segundo frente fue una auditoría de calidad de todo el proyecto (client, admin, shared, supabase), ejecutada como tarea dedicada, que identificó once categorías de hallazgos con severidad clasificada; de esos hallazgos, los cinco de mayor prioridad se resolvieron íntegramente en esta misma versión.

Ambos frentes se ejecutaron con Codex (el agente de código de OpenAI/ChatGPT) en lugar del agente utilizado en versiones anteriores, por tratarse de cambios de mayor superficie (la reorganización tocó cerca de treinta archivos y sus imports; la auditoría requirió leer el repositorio completo). El cambio de herramienta no tuvo impacto en el resultado — ambos frentes se completaron sin errores de build en ningún punto, a diferencia del historial de fricción documentado en la sección 5.13.1 de v6.0.


## 1.4 Novedades respecto a v6.0

- Client: client/src/components/ reorganizado en cinco subcarpetas por dominio (layout/, common/, product/, cart/, home/), reemplazando la estructura plana anterior. Ver sección 2.1 y sección 4.
- Shared: shared/src/supabase/database.types.ts regenerado contra el schema real de Supabase, incorporando formalmente el campo mensaje_alerta que había quedado sin reflejar desde v6.0. Ver sección 6.4.
- Base de datos: nuevo trigger BEFORE UPDATE en la tabla pedidos que valida transiciones de estado del lado del servidor, cerrando el hallazgo de mayor severidad de la auditoría. Ver sección 7.2.
- Client: fetch de sucursales unificado — de cuatro implementaciones independientes a una sola (el hook useSucursales, ya existente, ahora reutilizado en los tres puntos que antes lo duplicaban). Ver sección 4.9.1.
- Client: fetch de configuracion_tienda reducido de tres implementaciones a dos, mediante un hook nuevo, useConfiguracionTienda, que unifica HomePage y WhatsappFloatButton. usePaneles.ts mantiene su propio fetch por decisión deliberada. Ver sección 4.9.2.
- Client: eliminado client/src/utils/geocode.ts (sin consumidores desde la migración del Banner a Google Maps embed en v5.0) y las dependencias react-leaflet / @types/leaflet, huérfanas desde el mismo cambio. Ver sección 4.9.3.
- Client y Admin: nuevo hook useModalAccesible (implementado por separado en cada app, de forma intencionalmente duplicada) que agrega cierre con Escape, atrapado de foco y restauración de foco a los modales bloqueantes del proyecto — aplicado a ReviewsCarousel (client) y a ConfirmDialog en sus variantes confirm y notify (admin). Ver sección 4.9.4 y sección 5.14.
- Documentación: se retira ReviewsCarousel de la lista de deuda técnica — sus datos hardcodeados son ahora una decisión de producto documentada, no un pendiente. Ver sección 1.3 y sección 11.

# 2. Estructura del Monorepo

Sin cambios respecto a v6.0 a nivel de paquetes (client, admin, shared, supabase/functions). El cambio de esta versión es interno a client/src/components/.


## 2.1 Árbol de archivos relevantes (actualizado en v7.0)

Nota — Esta sección reemplaza la 2.1 de v6.0 únicamente en lo referido a client/src/components/, cuya estructura plana anterior se reorganizó por completo. El resto del árbol (pages, hooks, context, utils de client; toda la estructura de admin y shared) no cambió.

/grow

/client/src

/components

/layout      -> Header, HeaderTop, HeaderNav, CategoryDropdown,

Footer, AlertaBanner, WhatsappFloatButton,

ScrollToTop

/common      -> LoadingState, ErrorState, ErrorBoundary

/product     -> ProductCard, CategoryCard, ArticulosSidebar,

FeaturedCarousel

/cart        -> CartDrawer, CartItemRow

/home        -> Banner, ReviewsCarousel/ReviewsCarousel

/hooks -> usePaneles.ts, useSucursales.ts,

useConfiguracionTienda.ts (*), useModalAccesible.ts (*)

/context -> CartContext.tsx

/pages -> HomePage, ProductsPage, ResumePage, ProductDetailPage

/utils -> redesSociales.tsx

(geocode.ts eliminado en v7.0 - ver seccion 4.9.3)

App.tsx + main.tsx

/admin/src

/components -> AdminLayout, ProductForm, PanelForm,

PanelItemsEditor, PanelItemForm, ProductoImagenSelector,

ProtectedRoute, LoadingState, ErrorState, ErrorBoundary,

ConfirmDialog (*), NotificarPedidoModal

/hooks -> useModalAccesible.ts (*, nuevo en v7.0)

/context -> AuthContext.tsx, ConfirmContext.tsx

/pages -> LoginPage, DashboardPage, ProductsPage,

CategoriesPage, OrdersPage, SettingsPage, PanelsPage

/utils -> iconoEstado.tsx

App.tsx + main.tsx

/shared/src

/types -> producto.ts, categoria.ts, pedido.ts,

configuracion-tienda.ts, panel-categoria.ts, index.ts

/supabase -> client.ts, database.types.ts (*, regenerado),

mappers.ts, index.ts

/utils -> formatPrecio.ts, validarEmail.ts, formatEstadoPedido.ts

/constants -> index.ts

schema.sql (*) - rls.sql - rpc.sql

index.ts

/supabase

/functions/enviar-notificacion-pedido -> index.ts, deno.json

config.toml

(*) Creado, modificado o regenerado en v7.0.

Nota — client/package.json perdió las dependencias react-leaflet y @types/leaflet en esta versión (ver sección 4.9.3) — no se refleja como línea propia en el árbol de arriba por no ser un archivo de código, pero es un cambio de esta versión igual de real que el resto.


## 2.2 — 2.3 Aislamiento client/admin y stack

Sin cambios respecto a v6.0.


# 3. Stack Tecnológico

Sin cambios respecto a v6.0 en el stack en sí. Se remueven de las dependencias reales del proyecto react-leaflet y @types/leaflet — ya no formaban parte del código desde v5.0, pero hasta esta versión seguían declaradas en client/package.json sin usarse (ver sección 4.9.3).


# 4. Aplicación Client (Tienda Pública)

Sin cambios funcionales en esta versión — client/src/pages/ y el comportamiento visible de la tienda pública son idénticos a v6.0. Los cambios de v7.0 en client son de organización interna (sección 4.1), y de reducción de deuda técnica (sección 4.9).


## 4.1 Reorganización de client/src/components/ (nuevo en v7.0)

Hasta v6.0, todos los componentes de client vivían sueltos en un mismo nivel dentro de components/, con la única excepción de ReviewsCarousel/ (que ya vivía en su propia subcarpeta desde antes, sin que hubiera una razón documentada para esa diferencia — ver sección 2.1.1 de v6.0). Esta versión agrupa todo por dominio/feature en cinco subcarpetas:

- layout/ — todo lo que arma el "marco" de la aplicación, presente potencialmente en cualquier page. Agrupa Header junto con sus subcomponentes acoplados (HeaderTop, HeaderNav, CategoryDropdown — este último solo se usa dentro de HeaderNav), más Footer, AlertaBanner, WhatsappFloatButton y ScrollToTop, que no tienen lógica de dominio propia.
- common/ — componentes genéricos sin conocimiento de dominio: LoadingState, ErrorState, ErrorBoundary. Se usan como fallback en cualquier fetch, sin saber nada de productos, carrito ni pedidos.
- product/ — todo lo relacionado a mostrar o navegar el catálogo: ProductCard, CategoryCard, ArticulosSidebar, FeaturedCarousel. Este último se agrupó aquí y no en home/ porque también se renderiza fuera de la landing (se reutiliza en ResumePage tras la confirmación de un pedido).
- cart/ — CartDrawer y CartItemRow, los dos componentes que interactúan directamente con CartContext para mostrar o editar el carrito.
- home/ — componentes atados exclusivamente a la landing, sin reutilización en otras pages: Banner y ReviewsCarousel (que conserva su subcarpeta propia dentro de home/, sin aplanarla).
La migración actualizó todos los imports afectados en client/src/ (App.tsx, main.tsx, las cuatro pages, y los imports cruzados entre los propios componentes movidos) sin cambiar el contenido de ningún archivo más allá de las rutas de import. El build de client compiló sin errores tras la migración.

Nota — Se evaluó y descartó, durante el diseño de esta reorganización, un folder header/ separado de layout/ (propuesta original del cliente del proyecto). Se descartó porque dejaría layout/ con solo cuatro archivos sueltos sin mucho en común entre sí más que "vivir en todas las pages" — separarlos de Header no sumaba claridad. Si el Header creciera mucho más en subcomponentes propios en el futuro, esa separación podría reconsiderarse.


## 4.2 — 4.8 Pages y componentes existentes

Sin cambios de comportamiento respecto a v6.0. ResumePage, CartDrawer, Banner, AlertaBanner, ProductDetailPage, ReviewsCarousel, y los componentes documentados por primera vez en v6.0 (ScrollToTop, redesSociales.tsx, iconoEstado.tsx, formatEstadoPedido.ts) mantienen su comportamiento sin cambios — solo cambió, para los que corresponde, su ubicación de carpeta (ver sección 4.1) o su fetch interno (ver sección 4.9).


## 4.9 Deuda técnica resuelta en v7.0

Esta sección documenta las cuatro correcciones aplicadas al client como resultado directo de la auditoría de calidad ejecutada en esta versión (ver sección 8 para el detalle completo del proceso de auditoría).


### 4.9.1 Unificación del fetch de sucursales

✅ Resuelto en v7 — La tabla sucursales se consultaba de forma independiente desde cuatro lugares distintos: el hook useSucursales.ts (ya existía, pero solo lo usaba HeaderTop.tsx), y por separado en HeaderNav.tsx, Footer.tsx y Banner.tsx, cada uno con su propio useState + useEffect repitiendo la misma query. Se migraron los tres consumidores restantes a useSucursales(), eliminando el código duplicado (y los imports de supabase / mapearSucursal que quedaron sin uso en esos tres archivos) sin cambiar ningún comportamiento visible: el dropdown de "Sucursales" del nav, la sección "Contacto" del footer, y el selector de sucursal del Banner de la home se verificaron manualmente en el navegador tras el cambio.

Nota — Esta unificación es de código, no de tráfico de red: cada componente que llama a useSucursales() sigue disparando su propio fetch al montarse, porque no existe una capa de cache o store compartido entre instancias de un hook de React en este proyecto. El beneficio real es tener una sola implementación de la query que mantener, no menos requests HTTP en runtime. Se documenta explícitamente para evitar una expectativa de performance que esta solución no cumple.


### 4.9.2 Reducción del fetch de configuracion_tienda

✅ Resuelto en v7 — La tabla configuracion_tienda se consultaba de forma independiente desde tres lugares: usePaneles.ts (en paralelo con paneles_categoria, consumido por Header y Footer), HomePage.tsx (con su propio manejo de loading/error que bloquea toda la página), y WhatsappFloatButton.tsx (sin ningún manejo de loading/error). Se creó client/src/hooks/useConfiguracionTienda.ts, que replica exactamente la lógica que tenía HomePage.tsx (mismo query, mismo patrón de error) y expone además una función recargar para reintentos. Se migraron HomePage.tsx y WhatsappFloatButton.tsx a este hook nuevo, preservando en HomePage su comportamiento exacto de <LoadingState /> / <ErrorState onReintentar={recargar} />.

Nota — usePaneles.ts NO se migró a este hook nuevo, por decisión deliberada: trae configuracion_tienda en paralelo (Promise.all) junto con la consulta pesada de paneles_categoria, para exponer un único loading combinado de ambas cosas. Migrarlo hubiera requerido recomponer ese loading combinado y tocar el camino crítico que alimenta a Header.tsx, un componente ya identificado como sensible en este proyecto (ver el historial de incidentes de edición documentado en la sección 5.13.1 de v6.0). El resultado de esta versión es una reducción de tres implementaciones a dos, no a una — se documenta como una mejora parcial deliberada, no como una limitación no resuelta por descuido. Queda como posible trabajo futuro si se justifica el riesgo de tocar usePaneles.ts (ver sección 11).


### 4.9.3 Eliminación de código y dependencias muertas

✅ Resuelto en v7 — client/src/utils/geocode.ts (geocodificación contra la API de Nominatim, con cache en localStorage) se eliminó por completo: no tenía consumidores desde que Banner.tsx migró a un embed de Google Maps por URL en v5.0. Se verificó la ausencia de imports en todo el monorepo antes de eliminarlo. Junto con el archivo, se removieron de client/package.json las dependencias react-leaflet y @types/leaflet, huérfanas por el mismo motivo, y se corrió npm install para reflejar la limpieza en package-lock.json. El build y el typecheck de client se confirmaron en verde después del cambio.


### 4.9.4 Accesibilidad de teclado en el modal de ReviewsCarousel

✅ Resuelto en v7 — Se creó client/src/hooks/useModalAccesible.ts, un hook que dado un booleano activo y un callback onCerrar: cierra el modal al presionar Escape, atrapa el foco dentro del contenedor del modal mientras Tab/Shift+Tab lo navegan (impidiendo que el foco se escape hacia el resto de la página), enfoca el contenedor al abrirse, y devuelve el foco al elemento que lo tenía antes de que el modal se abriera, al cerrarse. Se aplicó al modal de detalle de reseña de ReviewsCarousel.tsx, agregando ref={modalRef}, role="dialog", aria-modal="true" y tabIndex={-1} al contenedor del panel del modal (styles.modalCard). El comportamiento se verificó manualmente: cierre con Escape, ciclo de foco con Tab sin escapar del modal, y restauración de foco a la card de reseña originalmente clickeada.

Nota — Esta misma solución se implementó también en admin (ver sección 5.14), pero como un archivo independiente y deliberadamente duplicado — no como una utilidad compartida en shared/. La justificación de esa decisión de diseño se documenta en la sección 5.14, por ser una decisión que afecta a ambas apps por igual.


# 5. Aplicación Admin (Backoffice)

Sin cambios funcionales en esta versión salvo lo documentado en 5.14. El resto del backoffice (LoginPage, DashboardPage, ProductsPage, CategoriesPage, PanelsPage, OrdersPage, SettingsPage, el sistema de notificación de pedidos, AdminLayout, AuthContext/ProtectedRoute) se mantiene sin cambios respecto a v6.0.


## 5.14 Accesibilidad de teclado en ConfirmDialog (nuevo en v7.0)

Se creó admin/src/hooks/useModalAccesible.ts — un archivo con contenido idéntico al equivalente de client (sección 4.9.4), duplicado a propósito en vez de compartido.


### 5.14.1 Por qué el hook está duplicado y no en shared/

Esta fue una decisión de diseño explícita, tomada antes de escribir el código, apoyada en dos criterios ya establecidos en el proyecto:

- shared/ es una capa de dominio, no de UI. Hoy contiene únicamente tipos, el cliente de Supabase, mappers y utilidades puras sin dependencia de React (formatPrecio, validarEmail, formatEstadoPedido). Introducir un hook de React ahí cambiaría la naturaleza del paquete — dejaría de ser agnóstico de framework, lo cual además de romper la consistencia interna, lo alejaría de una eventual reutilización fuera de un contexto React (las Edge Functions en Deno, por ejemplo, ya no pueden importar @shared por correr en otro runtime; sumarle una dependencia de React a shared no ayuda a acercar esa brecha, la profundiza).
- El aislamiento entre client y admin es un principio del proyecto, no un accidente. Documentado desde v5.0/v6.0 (sección 2.2): ambas aplicaciones son deliberadamente independientes, sin ningún link ni import cruzado entre ellas, con despliegues separados en Vercel. Crear un punto de acoplamiento nuevo entre ambas solo para ahorrar una veintena de líneas de código va en contra de esa decisión ya tomada.
El costo de la duplicación se consideró bajo: es un hook chico, sin estado de negocio, sin dependencia de ningún tipo compartido, y su lógica (manejo de foco y teclado) es genérica y estable — no es código que se espere que cambie con frecuencia ni que sea fácil de desincronizar accidentalmente entre ambas copias.


### 5.14.2 Aplicación en ConfirmDialog.tsx

ConfirmDialog tiene tres variantes según su prop tipo: confirm, notify y toast. El hook se aplicó únicamente a confirm y notify — el caso toast es una notificación no bloqueante en la esquina de la pantalla que se autocierra con un timer, y atraparle el foco hubiera sido contraproducente, ya que el usuario típicamente sigue interactuando con otra parte de la página mientras el toast está visible.

- modalActivo se calcula como tipo !== 'toast', y controla si el hook está activo.
- Semántica de Escape respetada por variante: para tipo === 'confirm', Escape se comporta como "Cancelar" (invoca onCancelar), nunca como una confirmación implícita. Para tipo === 'notify', que no tiene distinción entre confirmar y cancelar (el propio componente ya trata el click en el overlay de un notify como equivalente a onConfirmar, vía la función handleOverlayClick preexistente), Escape replica esa misma semántica invocando onConfirmar. La elección del callback correcto por tipo fue el punto más delicado de esta tarea, por ser el único lugar del cambio con una decisión de comportamiento no puramente mecánica.
Se agregaron ref={modalRef}, role="dialog", aria-modal="true" y tabIndex={-1} al div con className={styles.modal} en el bloque de retorno compartido por confirm y notify. El bloque if (tipo === 'toast') { return (...) }, con su propio return independiente, no se tocó.

Verificación manual realizada: Escape cierra correctamente un diálogo confirm sin disparar la acción confirmada, Tab no escapa del modal en ninguna de las dos variantes bloqueantes, el foco vuelve al elemento que abrió el diálogo al cerrarlo, y un toast (probado guardando cambios en SettingsPage) sigue apareciendo y autocerrándose sin ningún cambio de comportamiento.


# 6. Paquete Shared

Sin cambios en tipos, mappers ni utilidades respecto a v6.0. El único cambio de esta versión es la regeneración de database.types.ts.


## 6.4 Regeneración de database.types.ts (nuevo en v7.0)

shared/src/supabase/database.types.ts es un archivo de tipos generado automáticamente a partir del schema real de la instancia de Supabase (mediante supabase gen types typescript), del cual dependen los mappers de shared/src/supabase/mappers.ts para tipar cada row de cada tabla. Cuando en v6.0 se agregó la columna mensaje_alerta a configuracion_tienda, este archivo nunca se regeneró — mapearConfiguracionTienda leía row.mensaje_alerta sobre un tipo Row que TypeScript no reconocía, lo cual no se manifestó como error hasta el build de la reorganización de components/ de esta versión (property 'mensaje_alerta' does not exist).

Se corrigió regenerando el archivo completo con:

supabase gen types typescript --linked > shared/src/supabase/database.types.ts

Se confirmó que la definición de configuracion_tienda dentro del archivo regenerado incluye mensaje_alerta: string | null en Row, Insert y Update, y que el build de client volvió a compilar sin errores.

Nota — El archivo regenerado quedó codificado en UTF-16 con terminadores de línea CRLF, a diferencia del resto del proyecto (UTF-8/LF) — efecto de cómo Windows redirige la salida de un comando a un archivo nuevo en ciertas configuraciones de terminal, no un error de la CLI de Supabase ni del contenido en sí. No causa ningún problema funcional, pero puede mostrar el archivo como binario en algunas herramientas de diff. Se deja registrado por si se decide normalizar la codificación en una futura limpieza — no es urgente.

Queda como lección operativa para el resto del proyecto: cualquier columna nueva agregada a una tabla existente debe ir acompañada, en el mismo cambio, de la regeneración de database.types.ts — no es un paso opcional ni posterior, es parte del mismo commit conceptual que el ALTER TABLE.


# 7. Base de Datos (Supabase / Postgres)

Sin cambios estructurales de tablas respecto a v6.0. Se agrega en esta versión un trigger de validación sobre pedidos.


## 7.2 Trigger de validación de transiciones de estado de pedido (nuevo en v7.0)

Resuelve el hallazgo de severidad Crítica de la auditoría de esta versión (ver sección 8.2): hasta v6.0, la tabla pedidos permitía, vía RLS, un UPDATE completo a cualquier rol authenticated sin ninguna validación de qué transición de estado es válida — la única validación existente vivía en el frontend de admin (OrdersPage.tsx), evadible por cualquiera con una sesión autenticada llamando directo a la API REST de Supabase.

Se agregó, en shared/schema.sql, inmediatamente después del trigger existente trigger_pedidos_actualizado (que mantiene actualizado_en), un segundo trigger BEFORE UPDATE:

CREATE OR REPLACE FUNCTION public.validar_transicion_pedido()

RETURNS TRIGGER AS $$

BEGIN

IF NEW.estado = OLD.estado THEN

RETURN NEW;

END IF;

IF NOT (

(OLD.estado = 'pendiente' AND NEW.estado IN ('confirmado', 'cancelado')) OR

(OLD.estado = 'confirmado' AND NEW.estado IN ('listo_para_retirar', 'cancelado')) OR

(OLD.estado = 'listo_para_retirar' AND NEW.estado IN ('completado', 'cancelado'))

) THEN

RAISE EXCEPTION 'Transicion de estado de pedido invalida: % -> %',

OLD.estado, NEW.estado USING ERRCODE = 'check_violation';

END IF;

RETURN NEW;

END;

$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_transicion_pedido ON pedidos;

CREATE TRIGGER trg_validar_transicion_pedido

BEFORE UPDATE ON pedidos

FOR EACH ROW

EXECUTE FUNCTION public.validar_transicion_pedido();

Matriz de transiciones válidas: pendiente → confirmado | cancelado; confirmado → listo_para_retirar | cancelado; listo_para_retirar → completado | cancelado. completado y cancelado son estados terminales, sin transiciones salientes. Cualquier UPDATE donde NEW.estado = OLD.estado (por ejemplo, el toggle del campo eliminado, que no toca estado) se permite sin pasar por la matriz.

Diseño elegido — trigger de Postgres en vez de una función RPC nueva: esta decisión evitó cualquier cambio en el frontend. OrdersPage.tsx sigue llamando a .update({ estado: ... }) exactamente igual que antes; cuando el trigger rechaza una transición inválida, Supabase devuelve el error de Postgres tal cual, y el manejo de error que ya existía en cambiarEstado y confirmarConNotificacion (if (err) { notify(err.message) }) lo muestra al admin sin haber tocado una sola línea de React.

Verificación aplicada contra la instancia real de Supabase (no solo en desarrollo): se creó un pedido de prueba temporal y se corrieron cuatro casos en una sola transacción — (1) pendiente → completado, debía fallar y falló con check_violation; (2) pendiente → confirmado, debía pasar y pasó; (3) actualización de eliminado sin tocar estado, debía pasar y pasó; (4) limpieza del pedido de prueba. Los tres primeros casos resultaron en el comportamiento esperado, confirmado por consulta directa de los resultados en el SQL Editor de Supabase.

Nota — Al aplicar este cambio contra producción se repitió, en un primer intento, el mismo error operativo documentado en la sección 7.1 de v6.0: pegar un bloque más amplio de lo necesario en el SQL Editor. En este caso no llegó a ejecutarse incorrectamente, pero refuerza la misma lección: contra una base ya poblada, solo debe ejecutarse el fragmento incremental, nunca un script pensado para una instalación desde cero.

No se modificó shared/rls.sql ni shared/rpc.sql en esta tarea: la política de UPDATE para authenticated se mantiene igual (el trigger agrega una capa de validación adicional, no reemplaza a RLS), y crear_pedido_completo no se ve afectada porque nunca actualiza estado en un pedido existente, solo lo inserta con su valor por defecto.


# 8. Auditoría de Calidad (nuevo en v7.0)

A diferencia de las versiones anteriores de este documento, que registraban deuda técnica a medida que se descubría de forma incidental durante otras tareas, esta versión incorpora los resultados de una auditoría dedicada: una tarea cuyo único objetivo fue revisar el estado del proyecto completo en busca de inconsistencias, errores, deuda técnica y puntos de mejora, sin modificar ningún archivo durante la revisión en sí.


## 8.1 Alcance y método

La auditoría cubrió once áreas: datos hardcodeados que deberían vivir en Supabase, fetches duplicados o redundantes, inconsistencias entre client y admin, archivos y dependencias huérfanas, manejo de errores y estados de carga, validación de datos en el servidor, seguridad de políticas RLS y de la Edge Function de notificaciones, accesibilidad básica, consistencia de convenciones de código, performance, y cobertura de tests. Cada hallazgo se exigió con ubicación concreta (archivo y línea), no como observación genérica, y con una clasificación de severidad: Crítico, Alto, Medio o Bajo.


## 8.2 Resumen de hallazgos y resolución en esta versión

De los hallazgos reportados, se priorizaron y resolvieron en v7.0 los cinco de mayor severidad y/o mayor costo de mantenimiento acumulado:

- Crítico — pedidos permitía UPDATE completo a cualquier authenticated sin validar transiciones de estado. Resuelto — sección 7.2.
- Alto — fetch de sucursales duplicado en cuatro puntos independientes del client. Resuelto — sección 4.9.1.
- Alto — fetch de configuracion_tienda duplicado en tres puntos independientes del client. Reducido de tres a dos, con justificación documentada para no llegar a uno — sección 4.9.2.
- Medio/Alto — geocode.ts sin consumidores y dependencias react-leaflet / @types/leaflet huérfanas. Resuelto — sección 4.9.3.
- Medio — modales bloqueantes (ReviewsCarousel en client, ConfirmDialog en admin) sin cierre por Escape, sin atrapado de foco, sin restauración de foco. Resuelto — sección 4.9.4 y sección 5.14.
Los hallazgos restantes de la auditoría, de menor severidad o que implican decisiones de mayor alcance (introducir una suite de tests, endurecer la distinción de roles dentro de la Edge Function de notificaciones, revisar colores hardcodeados puntuales en algunos módulos CSS, unificar formato de fechas/moneda entre client y admin, optimizar el bundle de ReviewsCarousel) no se abordaron en esta versión y se listan como pendientes en la sección 11.


## 8.3 Herramienta utilizada

Tanto la reorganización de components/ como la auditoría y las cinco correcciones derivadas de ella se ejecutaron con Codex en lugar del agente utilizado en tareas de menor alcance en versiones anteriores. La razón fue el volumen de superficie tocada en cada tarea, no la dificultad conceptual de los cambios en sí, que fue en general baja. A diferencia de la fricción documentada en la sección 5.13.1 de v6.0 (una cadena de cuatro errores de edición consecutivos con un agente distinto), ninguna de las tareas de esta versión requirió más de un intento para llegar a un build correcto.


# 9. Archivos SQL del Proyecto

Sin cambios de ubicación respecto a v6.0: shared/schema.sql, shared/rls.sql, shared/rpc.sql. Orden de inicialización: schema.sql → rpc.sql → rls.sql. schema.sql incorpora en esta versión el trigger de la sección 7.2.


# 10. Variables de Entorno y Secrets

Sin cambios respecto a v6.0.


# 11. Puntos Pendientes para Próximas Etapas

Esta sección se reescribe por completo respecto a v6.0: se retiran los puntos resueltos en esta versión, se retira el punto de ReviewsCarousel (ver sección 1.3), y se incorporan los hallazgos de la auditoría (sección 8) que quedaron sin resolver, además de los pendientes de versiones anteriores que siguen sin atenderse.


### 11.1 Ya resueltos (retirados de esta lista en v7.0)

- Validación server-side de transiciones de estado de pedido — resuelto, sección 7.2.
- Fetch duplicado de sucursales — resuelto, sección 4.9.1.
- geocode.ts huérfano y dependencias de leaflet — resuelto, sección 4.9.3.
- Accesibilidad de teclado en modales bloqueantes — resuelto, sección 4.9.4 y 5.14.
- Reseñas hardcodeadas en ReviewsCarousel — retirado de la lista de deuda técnica; es una decisión de producto deliberada, no un pendiente (ver sección 1.3).

### 11.2 Pendientes que persisten de versiones anteriores

- Fetch de configuracion_tienda — reducido de tres a dos implementaciones en v7.0 (sección 4.9.2). Unificar usePaneles.ts al mismo hook useConfiguracionTienda sigue pendiente, condicionado a que se justifique el riesgo de tocar el camino crítico de Header.tsx.
- Verificar un dominio propio en Resend para notificar por email a clientes reales (actualmente limitado a modo sandbox).
- Conectar CategoryCard y el campo es_card a una vista real — pendiente desde v4.0.
- Extraer a un hook compartido la lógica de fetch + cálculo de precioMinimo por variantes, duplicada entre ProductsPage y FeaturedCarousel — pendiente desde v4.0.
- Migrar los alert() nativos restantes al notify() de ConfirmContext — pendiente desde v4.0.
- Despliegue en Vercel de client y admin como proyectos separados — pendiente desde v2.0.
- Evaluar código compartido de formateo de moneda entre el frontend y la Edge Function en Deno, que hoy reimplementa el formato de forma local.
- Evaluar invalidación en vivo (por ejemplo, Supabase Realtime) para que un cambio de configuracion_tienda hecho desde admin se refleje sin necesidad de refresh en el client.

### 11.3 Nuevos, provenientes de la auditoría de v7.0 y aún sin resolver

- Medio — la Edge Function enviar-notificacion-pedido valida que exista una sesión autenticada (supabase.auth.getUser()), pero no verifica explícitamente que ese usuario sea el administrador — hoy funciona porque el proyecto es de un único usuario autenticado por diseño, pero es una dependencia implícita de cómo está configurado Auth, no una verificación explícita en el código de la función.
- Medio — inconsistencia entre client y admin en manejo de errores/loading: admin modela estos estados de forma consistente en sus páginas principales, mientras que varios fetches de client — incluso después de las correcciones de esta versión — siguen siendo "fire and forget" sin feedback de error al usuario.
- Bajo/Medio — colores hardcodeados fuera de las excepciones documentadas, señalados puntualmente en admin/src/pages/SettingsPage.module.css, client/src/components/home/ReviewsCarousel/ReviewsCarousel.module.css y admin/src/components/ConfirmDialog.module.css. No se evaluó caso por caso en esta versión si son negligencia real o excepciones justificables — queda pendiente esa evaluación antes de decidir si corregirlos.
- Bajo — client/src/utils/formatEstadoPedido.ts y shared/src/utils/formatPrecio.ts existen como utilidades compartidas, pero tanto admin como client siguen teniendo formatos de texto propios en algunos lugares en vez de reutilizarlas de forma consistente.
- Alto (por ausencia total, no por severidad de un bug puntual) — el proyecto no tiene ninguna suite de tests (unit, integración, ni e2e) en ningún paquete. Es el hallazgo más estructural de los once relevados: no hay red de seguridad automatizada que proteja justamente las zonas más sensibles del proyecto — el trigger de transiciones de pedido, las políticas RLS, los fetches unificados, y la accesibilidad de los modales — quedando su corrección futura sujeta enteramente a verificación manual, como se hizo en cada tarea de esta versión.
- Bajo — client/src/components/home/ReviewsCarousel/ vive en su propia subcarpeta dentro de components/home/, la única excepción a la estructura plana dentro de una subcarpeta de dominio tras la reorganización de esta versión. Se documenta como inconsistencia menor conocida, no como algo a corregir necesariamente.

# 12. Resumen Ejecutivo de Decisiones

v7.0 es, de las versiones documentadas hasta ahora, la primera que no introduce ninguna funcionalidad visible para el usuario final ni para el administrador — su valor es enteramente estructural: una reorganización de archivos que hace el proyecto más navegable a medida que crece, y una auditoría de calidad ejecutada como proceso deliberado en vez de como hallazgos incidentales, seguida de la resolución concreta de los cinco puntos de mayor prioridad que esa auditoría identificó.

El hallazgo más importante resuelto es, sin ambigüedad, la validación server-side de las transiciones de estado de pedido (sección 7.2): hasta esta versión, la única barrera contra mover un pedido a un estado indebido era una convención respetada únicamente por la interfaz de admin, no por la base de datos. El trigger agregado cierra esa brecha sin haber tocado una sola línea de frontend, lo cual es también un ejemplo concreto de una idea que se viene repitiendo en las decisiones técnicas de este proyecto: cuando existe la opción, resolver un problema en la capa donde genuinamente pertenece suele producir una solución más robusta y de menor superficie de cambio que resolverlo en la capa donde el síntoma es visible.

La decisión de duplicar deliberadamente el hook useModalAccesible entre client y admin, en lugar de centralizarlo en shared/, es la decisión de diseño más explícitamente razonada de esta versión (sección 5.14.1) y queda documentada como precedente: shared/ se reserva para lógica de dominio agnóstica de framework, no para utilidades de UI, incluso cuando esas utilidades son idénticas entre ambas aplicaciones.

El saldo más importante que deja la auditoría para adelante no es ninguno de los cinco puntos resueltos, sino el que quedó explícitamente sin tocar: el proyecto no tiene ninguna suite de tests automatizados. Cada una de las correcciones de esta versión se verificó manualmente, una por una, en el navegador o contra la base de datos real. Es un método que funcionó en esta versión, pero que no escala indefinidamente a medida que el proyecto acumula más superficie de código y más historial de cambios; queda como la decisión pendiente de mayor impacto estructural para una futura versión.

Grow — Documento de Arquitectura v7.0 — Agosto 2026


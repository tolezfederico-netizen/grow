
# GROW

Plataforma Modular de Ventas para Growshops

Documento de Arquitectura y Decisiones Técnicas

Versión 11.0 — Exportación de clientes a Excel en el admin, reordenamiento del menú lateral, y primer despliegue real del proyecto (repositorio Git y doble instancia en Vercel para client y admin)

Agosto 2026


# 1. Introducción y Filosofía del Proyecto

Sin cambios respecto a v8.0 en el principio rector del proyecto: modularidad y genericidad, pago único sin modelo de suscripción, y ningún dato de negocio hardcodeado salvo las dos excepciones ya documentadas (colores del tema visual y el contenido de ReviewsCarousel).

Se suma en esta versión un principio de despliegue que pasa a formar parte de la filosofía del proyecto: client y admin están pensados para desplegarse como dos instancias completamente independientes (dos proyectos de Vercel, dos dominios, dos ciclos de deploy propios), aunque conviven en un único repositorio Git (monorepo con npm workspaces). Esto no es una decisión de infraestructura aislada — refuerza la separación modular que el proyecto ya sostenía a nivel de código (client/admin/shared como paquetes independientes) llevándola también al nivel de despliegue: un cambio o un incidente en admin no debería poder afectar la disponibilidad de client, ni viceversa.


## 1.3 Estado del proyecto (v9.0)

A diferencia de v8.0 (que introdujo funcionalidad nueva de cuenta de cliente), v9.0 es principalmente una versión de consolidación y hardening sobre esa misma superficie: reorganiza elementos de navegación del header, enriquece el historial de pedidos con un modal de detalle, agrega un paso de confirmación explícita antes de crear un pedido, resuelve la deuda técnica documentada en v8.0 sobre el nombre mostrado en el header, agrega vencimiento automático al mensaje de alerta de la tienda, y suma la primera vista de administración sobre la tabla clientes. También corrige, por primera vez en la vida del proyecto, un caso real de desincronización entre rls.sql y la base de producción — ver sección 7.5.

Todo el trabajo se ejecutó con Codex, en tareas divididas por archivo/responsabilidad, con verificación de build y typecheck después de cada tarea. La corrección de RLS de la sección 7.5 fue la excepción al patrón habitual: se diagnosticó primero contra la base real (SQL Editor, Table Editor, Network tab del navegador) antes de escribir ningún prompt de código, precisamente porque el síntoma inicial parecía un bug de frontend y no lo era.


## 1.4 Novedades respecto a v8.0

Client — Header: el botón "Sucursales" se retira de HeaderNav.tsx; el botón "Ayuda" (antes en HeaderTop.tsx, con dropdown portaleado) se traslada a HeaderNav.tsx con el mismo estilo visual que "Términos y Condiciones" y un mecanismo de dropdown simple (relative/absolute), reemplazando el patrón de portal + position fixed que tenía en HeaderTop. Ver sección 4.10.3.

Client — Header: se resuelve la deuda técnica señalada en v8.0 (sección 11.3): el nombre mostrado en el botón de cuenta ahora se lee de clientes.nombre (fetch propio en HeaderTop.tsx) en vez de auth.users.user_metadata.nombre, por lo que queda sincronizado con las ediciones hechas desde MiCuentaPage sin esperar a un futuro signUp. Ver sección 4.10.3.

Client — HeaderTop: el dropdown de "Mi Cuenta" pasa a apilar sus opciones verticalmente (antes se mostraban en fila por ausencia de display: flex explícito en .cuentaDropdown).

Client — MiCuentaPage: layout de dos columnas (Perfil a la izquierda, Historial de pedidos a la derecha en escritorio, apiladas en mobile); la página pasa a ocupar todo el ancho disponible y a crecer en alto hasta el fondo del viewport, cambio acotado únicamente a esta página. Ver sección 4.10.2.

Client — MiCuentaPage: cada pedido del historial suma un botón "Ver" que abre un modal nuevo (PedidoDetalleModal, en components/common/) con el detalle completo del pedido — imagen, nombre, variante, cantidad, precio unitario y subtotal por producto, más el total. Las imágenes se piden a productos.imagen_url bajo demanda al abrir cada pedido, con caché en memoria para no repetir el fetch. Ver sección 4.10.2.

Client — MiCuentaPage: los datos de perfil, pedidos e imágenes se cachean en memoria (módulo miCuentaCache.ts, sin persistencia en storage del navegador) por usuario logueado, para no repetir el fetch completo cada vez que se vuelve a montar la página dentro de la misma pestaña. Se pierde con F5 o al cerrar la pestaña, por diseño. Ver sección 4.10.2.

Client — ResumePage: se agrega un modal de confirmación (ConfirmarPedidoModal, en components/common/) entre la validación de datos de contacto y la creación efectiva del pedido, con resumen de items y total. La RPC crear_pedido_completo solo se llama al confirmar dentro del modal; un error de red mantiene el modal abierto en vez de perderlo. Ver sección 4.10.4.

Client — AlertaBanner: deja de mostrar el mensaje de alerta si configuracion_tienda.mensaje_alerta_expira_en ya venció, como respaldo visual mientras el cron job de Supabase (que corre cada minuto) todavía no limpió la base. Ver sección 7.6.

Admin — nueva página: CustomersPage.tsx en /clientes, listado de la tabla clientes (nombre, apellido, email, teléfono) con buscador y botones de copiar al portapapeles, reutilizando el mismo patrón visual que ya usaba OrdersPage.tsx para los datos de contacto de un pedido. Ver sección 5.16.

Admin — SettingsPage: el campo "Mensaje de alerta" suma un campo opcional de vencimiento (datetime-local), que se limpia junto con el mensaje si este queda vacío, y se valida como fecha futura al guardar. Ver sección 5.15.

Shared: nuevo tipo Cliente y mapper mapearCliente, siguiendo el mismo criterio sin validación de literales que ya usaba mapearSucursal. ConfiguracionTienda suma el campo mensaje_alerta_expira_en. Ver sección 6.

Base de datos: nueva columna configuracion_tienda.mensaje_alerta_expira_en (timestamptz, nullable) más una función y un cron job (pg_cron, cada minuto) que borran mensaje_alerta y su vencimiento cuando se cumple la fecha. Ver sección 7.6.

Base de datos — hallazgo y corrección: se detectó que la policy "Lectura de items de pedidos propios para clientes" sobre pedido_items, documentada en rls.sql desde v8.0, nunca se había aplicado contra la base real de producción — MiCuentaPage mostraba historial vacío para cualquier cliente autenticado desde que existe la funcionalidad. Se aplicó directamente en el SQL Editor. Ver sección 7.5.


## 1.5 Filosofía de despliegue (nuevo en v11.0)

El monorepo no se dividió para desplegar cada aplicación por separado: se aprovechó el soporte nativo de Vercel para npm workspaces, que permite apuntar dos proyectos distintos al mismo repositorio, cada uno con su propio "Root Directory" (admin/ y client/), su propio Build Command (npm run build) y su propio Output Directory (dist). Vercel resuelve automáticamente la instalación desde la raíz del monorepo (respetando el package-lock.json y el campo workspaces del package.json raíz) antes de buildear cada subcarpeta de forma aislada, por lo que el paquete shared se resuelve igual que en desarrollo local sin necesidad de publicarlo aparte ni duplicarlo.

Cada instancia tiene su propio conjunto de variables de entorno (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) cargadas desde el dashboard de Vercel, no desde el repositorio — los archivos .env reales nunca se versionan, y los .env.example que sí viven en el repo contienen únicamente placeholders. Ver sección 15 para el detalle completo del proceso de puesta en producción.


# 2. Estructura del Monorepo

Sin cambios a nivel de paquetes respecto a v8.0. Se actualiza el árbol de client/src/components/common/ (dos componentes nuevos), client/src/pages/ (miCuentaCache.ts, nuevo módulo sin ser una page), y admin/src/pages/ (CustomersPage nueva).


## 2.1 Árbol de archivos relevantes (actualizado en v9.0)

Esta sección reemplaza la 2.1 de v8.0 únicamente en lo referido a client/src/components/common/, client/src/pages/, admin/src/pages/ y a shared/src/mappers.ts. El resto del árbol no cambió.

/client/src

/components

/common -> LoadingState, ErrorState, ErrorBoundary,

PedidoDetalleModal (*, nuevo en v9.0),

ConfirmarPedidoModal (*, nuevo en v9.0)

/pages -> ... (sin cambios de listado respecto a v8.0)

miCuentaCache.ts (*, nuevo en v9.0 — módulo de

cache en memoria, no es una page)

/admin/src

/pages -> DashboardPage, ProductsPage, CategoriesPage,

OrdersPage, PanelsPage, SettingsPage (*),

CustomersPage (*, nuevo en v9.0)

App.tsx (*) -- suma ruta /clientes

components/AdminLayout.tsx (*) -- suma link "Clientes"

/shared/src

schema.sql (*) -- suma configuracion_tienda.mensaje_alerta_expira_en

mappers.ts (*) -- suma mapearCliente

types -- suma Cliente; ConfiguracionTienda suma

mensaje_alerta_expira_en

(*) Creado, modificado o regenerado en v9.0.


# 4. Aplicación Client (Tienda Pública)

Las pages y componentes ya documentados en v8.0 mantienen su comportamiento sin cambios, salvo HeaderNav.tsx, HeaderTop.tsx, MiCuentaPage.tsx, ResumePage.tsx y AlertaBanner.tsx, todos actualizados en esta versión.


### 4.10.2 MiCuentaPage (actualizado en v9.0)

Se mantiene la estructura de dos secciones independientes en cuanto a manejo de error, documentada en v8.0 (Perfil editable / Historial de solo lectura), con tres cambios:

Layout de dos columnas en escritorio (Perfil a la izquierda, Historial a la derecha, CSS grid con breakpoint a una columna en mobile), y la página pasa a ocupar el ancho completo del viewport y a crecer en alto hasta el final de la pantalla — cambio acotado a esta página únicamente, sin tocar el resto del sitio.

Cada pedido del historial suma un botón "Ver" que abre PedidoDetalleModal (nuevo, en components/common/), mostrando por cada producto del pedido: imagen (traída de productos.imagen_url bajo demanda al abrir el modal, no precargada), nombre, variante si tiene, cantidad, precio unitario y subtotal, más el total del pedido calculado sobre los items mostrados. Un producto sin imagen (borrado, o sin imagen_url cargada) muestra un placeholder SVG en vez de romper el layout. El modal cierra con click afuera, botón X o tecla Escape.

Los datos de perfil, pedidos, items e imágenes se cachean en memoria por usuario (módulo nuevo miCuentaCache.ts, un Map keyeado por session.user.id, sin persistencia en localStorage/sessionStorage). Al volver a montar la página dentro de la misma pestaña —por ejemplo, navegando a otra ruta de la app y regresando— los datos aparecen de inmediato sin loading ni nueva request. El cache se actualiza al guardar el perfil o al resolver un fetch de imágenes, y se pierde naturalmente con F5 o al cerrar la pestaña.


### 4.10.3 Header con estado de sesión (actualizado en v9.0)

Se resuelve en esta versión la deuda técnica documentada en v8.0 (sección 11.3): HeaderTop.tsx ahora hace un fetch propio, keyeado por session.user.id, contra clientes.nombre, y lo usa para el texto del botón de cuenta en vez de auth.users.user_metadata.nombre. Una edición del perfil desde MiCuentaPage se refleja en el header en la próxima carga del componente, sin depender de un nuevo signUp. Fallback a "Mi Cuenta" sin cambios, para sesión no resuelta, cliente sin fila en clientes, o error de fetch.

El botón "Ayuda" (WhatsApp/Email), antes portaleado dentro de .botones en HeaderTop.tsx, se traslada a HeaderNav.tsx, con el mismo estilo visual que "Términos y Condiciones" (clase compartida) y el mismo mecanismo de dropdown que usaba el botón "Sucursales" — que se retira de HeaderNav en esta misma versión, reemplazado funcionalmente por Ayuda en esa posición. A diferencia del patrón que tenía en HeaderTop (portal + position: fixed calculado con getBoundingClientRect, necesario ahí por el overflow del grid de esa fila), en HeaderNav usa position: relative/absolute simple, consistente con el resto de los dropdowns de esa barra.

Nota — el dropdown de "Mi Cuenta" en HeaderTop.tsx pasó, en esta versión, a apilar sus opciones verticalmente en vez de en fila — la causa era la ausencia de display: flex explícito en .cuentaDropdown, cuyos hijos (inline-flex) se acomodaban uno al lado del otro por flujo normal de línea.


### 4.10.4 Checkout: confirmación explícita (actualizado en v9.0)

ResumePage.tsx suma un paso intermedio entre la validación de datos de contacto (sin cambios respecto a v8.0) y la creación efectiva del pedido: un modal nuevo, ConfirmarPedidoModal (en components/common/), que muestra un resumen de los items del carrito y el total, y requiere confirmación explícita antes de llamar a crear_pedido_completo. La función handleConfirmar de v8.0 se dividió en handleAbrirConfirmacion (validación, sin cambios de comportamiento) y handleEnviarPedidoConfirmado (la llamada a la RPC, ahora disparada desde el botón de confirmación dentro del modal). Un error de la RPC mantiene el modal abierto mostrando el error, en vez de cerrarlo y perder el contexto; mientras la creación está en curso, el modal no se puede cerrar por click afuera ni Escape, solo queda deshabilitado el botón de cancelar.


## 4.12 AlertaBanner (actualizado en v9.0)

Suma un chequeo de vencimiento del lado del cliente: si configuracion_tienda.mensaje_alerta_expira_en ya pasó, el componente deja de renderizar el mensaje aunque el cron job de Supabase (sección 7.6) todavía no haya limpiado la fila — el job corre cada minuto, así que existe una ventana de hasta 60 segundos donde el mensaje seguiría en la base pero ya no debería mostrarse; este chequeo cierra esa ventana del lado de la UI.


# 5. Aplicación Admin (Backoffice)


## 5.15 SettingsPage — vencimiento del mensaje de alerta (nuevo en v9.0)

El fieldset "Mensaje de alerta" suma un campo datetime-local opcional para configuracion_tienda.mensaje_alerta_expira_en. El campo queda deshabilitado si el mensaje está vacío (no tiene sentido un vencimiento sin mensaje asociado). Al guardar: si el mensaje quedó vacío, se fuerza el vencimiento a vacío también, aunque hubiera quedado cargado de un mensaje anterior; si el vencimiento no es una fecha futura respecto al momento de guardar, se rechaza con un error inline sin llegar a persistir. La conversión entre el formato datetime-local (hora local del navegador) y el timestamptz que espera Supabase (UTC/ISO) se resuelve con dos funciones puras en el propio componente.


## 5.16 CustomersPage (actualizado en v11.0)

Página nueva en /clientes, agregada al router (App.tsx) y al menú lateral (AdminLayout.tsx, entre "Pedidos" y "Productos"). Lista la tabla clientes completa (nombre, apellido, email, teléfono, fecha de registro) con un buscador que filtra por nombre/apellido/email, y botones de copiar al portapapeles para email y teléfono, replicando exactamente el patrón visual y de comportamiento que ya existía en OrdersPage.tsx para los datos de contacto de un pedido (mismo ícono SVG, mismo toast de confirmación vía useConfirm). Es una vista de solo lectura — no expone edición ni borrado de clientes desde el admin en esta versión.

Se agregó en esta versión un botón "Descargar Excel" en el header de la página, que exporta a un archivo .xlsx los mismos datos visibles en pantalla (nombre completo, email, teléfono, fecha de registro) para el total de clientes cargados en el state — no solo los que queden visibles tras un filtro de búsqueda activo. La generación es enteramente del lado del cliente: no se agregó ningún endpoint ni función nueva en Supabase.

La librería usada es exceljs (no xlsx/SheetJS): se cambió de una a otra durante el desarrollo porque SheetJS, en su versión gratuita, no soporta estilos de celda. exceljs permite además dar formato al encabezado del archivo generado (negrita y fondo en el amarillo de marca, --color-brand-yellow, con texto en --color-brand-black para contraste), consistente con la identidad visual del resto del admin. El archivo se descarga con el nombre Clientes_Grow_YYYY-MM-DD.xlsx, generado vía Blob + URL.createObjectURL en vez de un método de escritura directa a disco, ya que exceljs expone su salida como buffer.

Caso límite cubierto: sin clientes cargados, el botón no genera archivo y muestra un toast informativo en vez de descargar un Excel vacío. No se agregó indicador de carga para la generación en sí (es una operación asíncrona pero rápida a la escala actual de datos); si el volumen de clientes creciera significativamente, convendría revisar el tiempo de generación y sumar un estado de carga.

Además, el orden del menú lateral del admin (AdminLayout.tsx) se ajustó en esta versión: el link a Clientes pasó a ubicarse después de Productos (antes iba entre Pedidos y Productos), sin ningún otro cambio funcional ni de estilo en el componente.


# 6. Paquete Shared

Suma el tipo Cliente y el mapper mapearCliente (sin validación de literales, mismo criterio que mapearSucursal, porque clientes no tiene columna estado), consumidos únicamente por CustomersPage en esta versión. ConfiguracionTienda suma el campo mensaje_alerta_expira_en: string | null, y mapearConfiguracionTienda lo propaga sin transformación adicional.

shared/src/supabase/database.types.ts se actualizó para reflejar configuracion_tienda.mensaje_alerta_expira_en. A diferencia de v7.0 y v8.0, en esta versión la regeneración no se hizo con el comando estándar (supabase gen types typescript --linked) en el mismo momento que el ALTER TABLE — Codex editó el archivo directamente. Queda pendiente correr el comando real una vez para confirmar que no hay diferencias de formato respecto a lo que hubiera generado el CLI (ver sección 11.3).


# 7. Base de Datos (Supabase / Postgres)


## 7.5 Hallazgo: policy de pedido_items ausente en producción (nuevo en v9.0)

Durante el desarrollo del modal de detalle de pedido (sección 4.10.2), se detectó que MiCuentaPage mostraba historial de pedidos sin items — tanto para pedidos de prueba preexistentes como para un pedido nuevo creado en vivo a través del flujo de checkout normal. El diagnóstico inicial (revisión de ResumePage.tsx, CartContext.tsx y la función crear_pedido_completo) no encontró ninguna falla de código: el payload se armaba correctamente, la RPC insertaba pedido e items en la misma transacción, y Table Editor confirmaba que los items sí existían en la base para el pedido en cuestión.

La causa real se confirmó consultando pg_policies directamente: la policy "Lectura de items de pedidos propios para clientes" sobre pedido_items — documentada en rls.sql desde v8.0 (sección 7.4) — nunca se había ejecutado contra la base real de producción. Solo existía ahí la policy de administradores (is_admin()). Es decir: la funcionalidad de historial de pedidos en MiCuentaPage estuvo, desde que existe (v8.0), silenciosamente rota para cualquier cliente autenticado — Supabase con RLS activo no devuelve error ante una policy faltante, simplemente filtra las filas, por lo que el síntoma (array vacío) era indistinguible de "este pedido no tiene items" hasta que se comparó explícitamente contra el contenido real de la tabla.

Se aplicó la policy directamente en el SQL Editor de Supabase, con el mismo texto ya documentado en rls.sql desde v8.0 (sin cambios de redacción, solo ejecución):

CREATE POLICY "Lectura de items de pedidos propios para clientes"

ON pedido_items FOR SELECT TO authenticated

USING (EXISTS (SELECT 1 FROM pedidos

WHERE pedidos.id = pedido_items.pedido_id

AND pedidos.usuario_id = auth.uid()));

Se verificó, en la misma sesión, que las tres policies documentadas para pedidos (lectura propia de clientes, lectura y actualización para administradores) sí estaban presentes en producción — el problema fue puntual de esta policy de pedido_items, no un patrón sistemático de todas las policies de la migración de v8.0. Queda pendiente, de todas formas, auditar el resto de las tablas con RLS habilitado (productos, admins, clientes) de la misma forma, ver sección 11.3.


## 7.6 Vencimiento automático del mensaje de alerta (nuevo en v9.0)

Se agregó, como cambio incremental contra la base real (mismo criterio que pedidos.usuario_id en v8.0), la columna:

ALTER TABLE configuracion_tienda ADD COLUMN mensaje_alerta_expira_en timestamptz;

Nullable: NULL significa sin vencimiento, comportamiento idéntico al de versiones anteriores (el mensaje queda hasta que un admin lo borre a mano). El borrado automático se implementó con pg_cron en vez de resolverlo únicamente del lado del cliente, por decisión explícita tomada durante esta versión: se quería que el mensaje se limpiara de la base en el momento real, independientemente de si algún navegador tenía la tienda abierta en ese instante. Se creó una función limpiar_mensaje_alerta_vencido() (SECURITY DEFINER) que anula mensaje_alerta y mensaje_alerta_expira_en cuando esta última ya pasó, y un job (cron.schedule) que la ejecuta cada minuto. AlertaBanner suma, de todas formas, el chequeo del lado del cliente documentado en sección 4.12, para cubrir la ventana de hasta 60 segundos entre el vencimiento real y la próxima corrida del job.


# 8. Auditoría de Calidad

No se ejecutó una auditoría dedicada en esta versión más allá del hallazgo puntual de la sección 7.5, que surgió como parte del desarrollo normal (no de una revisión programada) y se documenta igual por su relevancia. Los pendientes identificados en la auditoría de v7.0 que seguían sin resolver al cierre de v8.0 se mantienen sin cambios — ver sección 11.


# 9. Archivos SQL del Proyecto

Sin cambios de ubicación respecto a v8.0: shared/schema.sql, shared/rls.sql, shared/rpc.sql. schema.sql incorpora en esta versión la columna configuracion_tienda.mensaje_alerta_expira_en (documentada como ALTER TABLE incremental, igual que las demás columnas agregadas después del schema base). No se modificó rpc.sql en esta versión.

Se corrigió, además, un problema de encoding que afectaba a todo el archivo schema.sql desde antes de esta versión: la mayoría de sus comentarios (incluidos los separadores decorativos "──") estaban guardados con mojibake (texto UTF-8 re-guardado como si fuera Windows-1252). Se revirtió con un script puntual (codificar como cp1252, decodificar como UTF-8) sobre el archivo completo, verificado por grep y por inspección visual antes y después, sin tocar ninguna sentencia SQL ejecutable — el cambio quedó acotado a texto dentro de comentarios.


# 10. Variables de Entorno y Secrets

Sin cambios respecto a v8.0.


# 11. Puntos Pendientes para Próximas Etapas

Se retira de esta lista, por resolverse en v11.0, el punto de despliegue en Vercel (sección 11.2 de v10.0) — ver sección 11.1. Se mantienen sin cambios los pendientes de versiones anteriores (sección 11.2), y se agrega un hallazgo nuevo detectado durante el trabajo de esta versión (sección 11.3).


## 11.1 Ya resueltos (retirados de esta lista en v9.0)

El nombre del botón de cuenta en el header se leía de auth.users.user_metadata.nombre y quedaba desincronizado tras editar el perfil — resuelto, sección 4.10.3.

pedido_items sin policy de lectura propia aplicada en producción, a pesar de estar documentada en rls.sql desde v8.0 — resuelto, sección 7.5.

Despliegue en Vercel de client y admin como proyectos separados — resuelto, sección 15 (dos instancias sobre el mismo monorepo, con Root Directory distinto y variables de entorno independientes por proyecto).


## 11.2 Pendientes que persisten de versiones anteriores

Fetch de configuracion_tienda — usePaneles.ts sigue sin migrarse a useConfiguracionTienda (pendiente desde v7.0).

Verificar un dominio propio en Resend para notificar por email a clientes reales (pendiente desde v6.0/v7.0).

Conectar CategoryCard y el campo es_card a una vista real — pendiente desde v4.0.

Extraer a un hook compartido la lógica de fetch + cálculo de precioMinimo por variantes, duplicada entre ProductsPage y FeaturedCarousel — pendiente desde v4.0.

Migrar los alert() nativos restantes al notify() de ConfirmContext — pendiente desde v4.0.

Sin ninguna suite de tests automatizados en ningún paquete — pendiente estructural desde la auditoría de v7.0, agravado por el hallazgo de la sección 7.5: una policy de RLS ausente en producción durante toda la vida de una funcionalidad no se detectó por ningún mecanismo automático, solo por revisión manual motivada por un síntoma visible.

schema.sql declara pedidos.usuario_id dos veces (CREATE TABLE base + ALTER TABLE incremental) — pendiente desde v8.0, sin resolver en esta versión.

Colores hardcodeados puntuales fuera de las excepciones documentadas (SettingsPage, ReviewsCarousel, ConfirmDialog) — pendiente de evaluación desde v7.0.


## 11.3 Nuevos, detectados en v9.0

Medio — database.types.ts se editó a mano para reflejar mensaje_alerta_expira_en, en vez de regenerarse con supabase gen types typescript --linked como indica el procedimiento estándar del proyecto desde v7.0. Funciona (build y typecheck de los tres paquetes pasaron), pero puede haber diferencias de formato respecto a lo que generaría el CLI real. Correr el comando una vez para confirmar. Ver sección 6.

Medio — el hallazgo de la sección 7.5 (policy documentada pero no aplicada) motiva auditar de la misma forma — comparando pg_policies contra rls.sql, tabla por tabla — el resto de las tablas con RLS habilitado (productos, admins, clientes), en vez de asumir que están sincronizadas porque el archivo fuente las documenta. Se verificó puntualmente pedidos durante el trabajo de esta versión (las tres policies esperadas estaban presentes), pero no el resto.

Bajo — CustomersPage (sección 5.16) asume que existe una policy de SELECT para administradores sobre la tabla clientes. No se confirmó explícitamente contra pg_policies en esta versión — a diferencia de pedidos, que sí se verificó como parte del hallazgo de la sección 7.5. Confirmar antes de considerar la página en uso normal, dado el precedente inmediato de la misma sección.

Bajo — el script puntual .codex/tmp_fix_orders.sql.ps1 (una migración PowerShell ya ejecutada contra shared/schema.sql, rls.sql y rpc.sql en una tarea previa) se incluyó tal cual en el primer commit del repositorio, por decisión explícita del usuario, como registro histórico del cambio. No contiene credenciales ni datos sensibles. Queda como criterio a mantener hacia adelante: decidir caso por caso si scripts de este tipo se suman al repo o se excluyen, en vez de aplicar una regla automática.

Medio — sigue sin confirmarse contra pg_policies la policy de SELECT para administradores sobre la tabla clientes (señalada como pendiente desde v9.0, sección 11.3). No se atendió en esta versión — se agregó funcionalidad nueva sobre CustomersPage (exportación a Excel) sin resolver primero esta auditoría, algo a tener en cuenta dado el precedente de la sección 7.5 de v9.0.


# 12. Resumen Ejecutivo de Decisiones

v9.0 no introduce un cambio de modelo de negocio como v8.0 (autenticación de clientes) — es una versión de consolidación sobre esa base, con dos decisiones que vale la pena destacar por su naturaleza.

La primera es de infraestructura: el vencimiento del mensaje de alerta (sección 7.6) se resolvió con un cron job real en Supabase (pg_cron) en vez de dejarlo librado a que algún cliente tuviera la tienda abierta en el navegador en el momento exacto del vencimiento. Es la primera vez que el proyecto incorpora un job programado del lado de la base de datos, en vez de resolver toda la lógica temporal desde el frontend — un patrón de infraestructura nuevo que probablemente se reutilice en futuras versiones para casos similares.

La segunda, más importante en términos de proceso que de producto, es el hallazgo de la sección 7.5. Una policy de RLS documentada correctamente en rls.sql desde v8.0 nunca llegó a ejecutarse contra la base real, y la funcionalidad afectada (historial de pedidos en Mi Cuenta) estuvo rota desde su lanzamiento sin que ningún mecanismo del proyecto lo detectara — se descubrió recién al desarrollar una funcionalidad nueva sobre esa misma superficie. Esto no es un problema de código: es la manifestación concreta del pendiente estructural señalado desde el cierre de v7.0 (ausencia de tests automatizados), que hasta esta versión se documentaba como una preocupación teórica y ahora tiene un caso real asociado. La sección 11.3 registra la auditoría pendiente sobre el resto de las tablas como consecuencia directa de este hallazgo.

Como en versiones anteriores, todo el trabajo se verificó manualmente — contra la base real de producción para los cambios de schema y RLS, y en el navegador para cada pieza de frontend — sin que exista todavía ninguna suite de tests automatizados que hubiera podido detectar el hallazgo de la sección 7.5 antes de que un síntoma visible lo forzara.

v11.0 suma dos frentes de trabajo de naturaleza distinta. El primero es funcionalidad puntual y acotada: exportación a Excel en CustomersPage (sección 5.16) y un reordenamiento menor del menú del admin — ninguno de los dos toca lógica de negocio ni esquema de base de datos. El segundo es el más significativo de esta versión: la puesta en producción real del proyecto, hasta ahora inexistente. Se creó el repositorio Git (con una revisión deliberada de qué credenciales podían filtrarse por vía indirecta — los .env.example llevaban las keys reales de Supabase pegadas, no placeholders, algo que no se hubiera detectado sin una revisión manual antes del primer commit) y se configuraron dos instancias de Vercel sobre el mismo monorepo, una por aplicación. Esto cierra un pendiente que figuraba en el documento de arquitectura desde v2.0, y convierte la separación entre client y admin, hasta ahora solo una decisión de código, también en una decisión de infraestructura real.


# 13. Normalización Responsive del Admin — Formato Desktop (nuevo en v10.0)

Se inició, en tareas divididas por page, la normalización del backoffice (aplicación admin) a un formato adaptativo. El trabajo se ejecutó con Claude (asistente de desarrollo vía chat, iterando archivo por archivo con VS Code), no con Codex. El alcance de esta primera etapa se limitó explícitamente al formato desktop: no se introdujo ningún cambio de comportamiento mobile, y los breakpoints mobile ya existentes (mayormente @media max-width: 640px) se dejaron intactos en todas las pages tratadas.

El criterio general fue normalizar, no rediseñar: no se inventaron patrones visuales nuevos, sino que se llevaron los valores fijos ya existentes en cada .module.css (max-width, paddings, gaps, font-size, y filas flex/grid sin wrap) a un formato fluido, replicando el mismo tratamiento en cada page para mantener consistencia entre ellas.


## 13.1 Convención adoptada

Ancho de página (.page): sin límite superior. Se reemplazó max-width fijo (por ejemplo 64rem, 90rem, 72rem, 100rem, según la page) por width: 100%, para que el contenido pueda seguir estirándose indefinidamente en monitores anchos, en vez de detenerse en un techo arbitrario y dejar espacio vacío a los costados.

Paddings y gaps de layout (contenedores de formularios, cards, secciones): valores rem fijos reemplazados por clamp(mínimo, valor fluido en vw, máximo), para que acompañen el viewport dentro de un rango acotado sin crecer sin límite (a diferencia de .page, acá sí se mantiene un techo, porque son detalles de espaciado/tipografía, no el contenedor principal).

Filas flex sin wrap: se agregó flex-wrap: wrap a los contenedores flex que agrupaban varios elementos en una sola fila (headers, barras de filtros, barras de selección múltiple, stats, filas de fila de datos), que antes se comprimían o desbordaban en viewports intermedios entre el breakpoint mobile y el ancho de escritorio cómodo.

Elementos flex sin piso mínimo: se agregó min-width a elementos con flex: 1 que se aplastaban antes de llegar a ceder su lugar a un salto de línea (inputs dentro de filas, tarjetas de estadísticas, columnas de nombre/cliente).

Grids de columnas fijas: donde el número de columnas estaba hardcodeado (por ejemplo grid-template-columns: 1fr 1fr, o repeat(2, minmax(0, 1fr))), se reemplazó por repeat(auto-fit, minmax(piso, 1fr)) para que el propio grid decida cuántas columnas entran según el espacio disponible, sin depender de un breakpoint manual adicional.


## 13.2 Pages normalizadas en esta etapa

SettingsPage — .page sin límite; clamp en paddings/gaps/font-size de fieldsets, inputs y filas; grid de .fila y .filaFieldsets pasado de 1fr 1fr fijo a repeat(auto-fit, minmax(18rem, 1fr)); flex-wrap y min-width agregados en .redRow y .sucursalRow, que se comprimían en la franja intermedia de viewport.

ProductsPage — .page sin límite; flex-wrap en .header, .headerBtns, .filtros, .stats, .barraSeleccion y .acciones; min-width agregado a .busquedaWrap y .statItem.

PanelsPage — flex-wrap en .header, .headerBtns, .barraSeleccion y .acciones; adicionalmente, las columnas del grid de filas (definidas como constantes en PanelsPage.tsx, no en el CSS) se llevaron de anchos rem fijos a minmax(piso, ancho ideal), único caso de esta etapa donde el ajuste tocó el .tsx en vez de limitarse al .module.css, por decisión explícita del usuario para esta page puntual.

OrdersPage — el archivo ya venía parcialmente alineado con el criterio; se completó agregando flex-wrap y min-width a .resumen (fila principal de cada pedido) y flex-wrap a .transiciones (botones de cambio de estado), que quedaban sin cubrir.

LoginPage — sin cambios estructurales; se aplicó clamp a los paddings de .panelMarca y .panelForm por consistencia. El max-width: 22rem de .logo y .form se mantuvo intacto de forma deliberada: es una restricción de diseño para un formulario centrado, no el mismo tipo de techo arbitrario corregido en el resto de las pages.

DashboardPage — .page sin límite; .pedidosGrid llevado de repeat(2, minmax(0, 1fr)) fijo a repeat(auto-fit, minmax(28rem, 1fr)); .pedidoRow ajustado de width: fit-content a width: 100% para que respete el ancho real de su columna de grid (un primer ajuste con un piso de minmax insuficiente, 20rem, provocó superposición y desborde de filas en ciertos anchos de viewport — se corrigió recalculando el piso real necesario por el contenido de la fila, 28rem, y sacando el fit-content).

CustomersPage — flex-wrap agregado a .cliente (fila principal de cada cliente) y a .stats, que quedaban sin cubrir; .campoEmail ya venía correctamente resuelto con min-width: 0 y no se modificó.

CategoriesPage — .page sin límite; flex-wrap en .header, .headerBtns, .stats y .barraSeleccion; min-width agregado a .statItem. Esta page tiene una particularidad: el número de columnas de la grilla de categorías (.grid/.columna) no se resuelve en CSS sino con lógica JavaScript en el componente (useState + useEffect con un listener de resize, 3 breakpoints fijos por window.innerWidth, y reparto round-robin de categorías en arrays por columna). Por decisión explícita del usuario, esa lógica se dejó intacta en esta etapa — el ajuste se limitó a lo que es CSS puro. Migrar ese sistema a un grid CSS fluido (repeat(auto-fit, minmax(...))) queda pendiente como una tarea de mayor alcance, que tocaría lógica del componente y no solo su hoja de estilos — ver sección 14.


## 13.3 Nota sobre selects nativos

Se detectó, durante la revisión visual de ProductsPage, que el listado desplegable de un <select> HTML nativo (el selector de categorías) se renderiza con el tamaño de fuente y alto de fila del sistema operativo/navegador, no con el font-size definido en el .module.css del proyecto — el <select> cerrado sí respeta el estilo del proyecto, pero su listado de opciones abierto no es estilizable con CSS estándar. No se tomó ninguna acción al respecto en esta etapa, porque reemplazar el <select> nativo por un componente de dropdown custom es una funcionalidad nueva, no una normalización de algo ya existente. Queda anotado como posible mejora futura si se decide migrar a un dropdown custom — ver sección 14.


# 14. Puntos Pendientes de la Normalización Responsive (nuevo en v10.0)

Continuar la normalización desktop sobre las pages y components todavía no tratados en esta etapa (CategoriesPage y PanelsPage ya tocadas parcialmente; components propios de admin/src/components/ aún sin revisar).

Formato mobile del admin: no se introdujo ningún cambio en esta etapa; queda como una etapa separada a futuro, una vez terminada la normalización desktop.

CategoriesPage — evaluar migrar el sistema de columnas manejado por JavaScript (useState/useEffect con listener de resize y breakpoints fijos) a un grid CSS fluido con repeat(auto-fit, minmax(...)), consistente con el resto de las pages. Implica tocar lógica del componente, no solo su .module.css — ver sección 13.2.

Selects nativos (<select>) — el listado de opciones desplegado no respeta el tamaño de fuente del proyecto por ser un elemento no estilizable con CSS estándar. Evaluar si conviene migrar a un dropdown custom en algún momento — ver sección 13.3.


# 15. Despliegue en Producción (nuevo en v11.0)

Primer despliegue real del proyecto, hasta ahora inexistente (pendiente documentado desde v2.0). Se cubren en esta sección tanto la puesta en Git como la configuración de las dos instancias de Vercel.


## 15.1 Repositorio Git

Se creó un único repositorio (monorepo, sin dividir client/admin/shared en repos separados) conectado a GitHub. Antes del primer commit se realizó una revisión manual de qué archivos podían filtrar información sensible, más allá de lo que el .gitignore ya cubría por convención (node_modules, dist, .env, .env.local, archivos de sistema): se detectó que ambos admin/.env.example y client/.env.example tenían la URL y la ANON_KEY reales de Supabase pegadas en vez de placeholders — un archivo .env.example no está excluido por convención en ningún .gitignore estándar, por lo que se hubiera subido tal cual de no mediar esa revisión. Se reemplazaron por placeholders antes de comitear. También se agregó supabase/.temp (carpeta de cache local que genera el CLI de Supabase) al .gitignore, tras detectar que se había colado en el primer git add pese a no aportar nada versionable.

La ANON_KEY de Supabase, a diferencia de una service_role key, está pensada para exponerse públicamente (el control de acceso real lo hace RLS) — su presencia en un .env.example no era una vulnerabilidad crítica en sí misma, pero se corrigió de todas formas por buena práctica y porque, dado el pendiente ya documentado de auditar RLS tabla por tabla (sección 11.3 de v9.0 y v11.0), no correspondía asumir que cada policy estuviera efectivamente cerrada.


## 15.2 Doble instancia en Vercel

Se crearon dos proyectos de Vercel apuntando al mismo repositorio de GitHub, diferenciados únicamente por su Root Directory (admin y client respectivamente). Vercel detecta el campo workspaces del package.json raíz y el package-lock.json único del monorepo, e instala las dependencias desde la raíz antes de ejecutar el build acotado a la subcarpeta correspondiente — @grow/shared se resuelve igual que en desarrollo local (alias @shared apuntando a ../shared/src en cada vite.config.ts), sin necesidad de publicarlo como paquete aparte.

Ambos proyectos comparten Build Command (npm run build) y Output Directory (dist), pero tienen conjuntos de variables de entorno independientes (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) cargadas desde el dashboard de cada proyecto — nunca desde el repositorio. Un detalle operativo a tener en cuenta hacia adelante: las variables de entorno solo se inyectan en el momento del build, por lo que agregarlas después de un deploy ya hecho no actualiza ese deploy — hace falta un redeploy manual explícito, algo que ocurrió en la puesta en marcha de la instancia admin (el primer deploy salió sin las variables cargadas y mostró el estado de error ya contemplado por el proyecto — "No se pudo cargar el panel" — hasta el redeploy posterior).


## 15.3 Rewrites de SPA

Se agregó un vercel.json en admin/ y otro en client/ (idénticos entre sí), con un rewrite que redirige cualquier ruta a index.html:

{ "rewrites": [ { "source": "/(.*)", "destination": "/index.html" } ] }

Sin este rewrite, recargar el navegador en cualquier ruta que no sea la raíz (por ejemplo /clientes en el admin) devuelve 404 de Vercel, porque busca un archivo físico en esa ruta antes de que React Router pueda tomar el control del lado del cliente.


# 16. Keep-Alive de Supabase (nuevo en v12.0)

El proyecto quedó finalizado y funcional pero, al momento de esta sección, todavía sin uso real: se encuentra en etapa de venta. En el plan free de Supabase, la base de datos se pausa automáticamente tras 7 días sin ningún tipo de tráfico (queries, auth o llamadas a la API). Para evitar que esto ocurra mientras el proyecto no tiene usuarios activos, se implementó un mecanismo de ping periódico automatizado, sin necesidad de pasar a un plan pago ni de mantener el proyecto con cambios constantes.


## 16.1 Workflow de GitHub Actions

Se agregó el archivo .github/workflows/keep-alive.yml al repositorio de Grow (github.com/tolezfederico-netizen/grow), sin tocar client/, admin/ ni shared/. El workflow corre con un cron programado cada 3 días a las 09:00 UTC (margen de seguridad frente al límite de 7 días de Supabase) y además admite ejecución manual mediante workflow_dispatch desde la pestaña Actions de GitHub.

El job hace un curl de solo lectura contra el endpoint REST raíz de Supabase (/rest/v1/), autenticado con la anon key — no con la service_role key, que no se usa en este mecanismo por ser innecesaria y más riesgosa si se filtrara. La URL del proyecto (SUPABASE_URL) y la anon key (SUPABASE_ANON_KEY) se cargaron como repository secrets de GitHub, no hardcodeadas en el YAML.

Un primer intento falló (anotación de error "No event triggers defined in 'on'"), causado por un bug conocido de YAML: la clave on: sin comillas puede interpretarse como el valor booleano true en lugar de como el nombre del campo, por lo que GitHub no reconocía el disparador del workflow. Se corrigió escribiendo la clave entre comillas ("on":), tras lo cual el workflow corrió con éxito.

Este mecanismo no requiere mantenimiento posterior: corre en la infraestructura de GitHub Actions de forma independiente del estado de Vercel o de la máquina del usuario. Si el proyecto se vende o pasa a un plan pago de Supabase, alcanza con eliminar el archivo o desactivar el workflow.

Grow — Documento de Arquitectura v12.0 — Agosto 2026


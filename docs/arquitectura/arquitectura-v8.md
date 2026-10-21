
# GROW

Plataforma Modular de Ventas para Growshops

Documento de Arquitectura y Decisiones Técnicas

Versión 8.0 — Autenticación de clientes en la tienda pública, vínculo pedido↔cliente y página "Mi cuenta"

Agosto 2026


# 1. Introducción y Filosofía del Proyecto

Sin cambios respecto a v7.0 en el principio rector del proyecto: modularidad y genericidad, pago único sin modelo de suscripción, y ningún dato de negocio hardcodeado salvo las dos excepciones ya documentadas (colores del tema visual y el contenido de ReviewsCarousel).


## 1.1 — 1.2 Modelo de negocio y multi-tenancy

Actualización respecto a v7.0 — hasta esta versión, cada instancia de Supabase de un negocio tenía un único usuario administrador en auth.users. Desde v8.0 esto cambia de forma deliberada: la misma instancia de auth.users aloja dos tipos de usuario — administradores (allowlist en la tabla admins, típicamente uno solo por negocio, sin cambios de fondo ahí) y clientes finales registrados en la tienda pública (perfil en la tabla clientes, potencialmente muchos). Ambos tipos conviven en el mismo pool de autenticación de Supabase, diferenciados por su presencia o ausencia en la tabla admins. Ver sección 7 para el detalle de schema y políticas, y sección 4.10 para el detalle de la aplicación en client.


## 1.3 Estado del proyecto (v8.0)

Esta versión, a diferencia de v7.0 (puramente estructural, sin funcionalidad nueva visible), incorpora la primera funcionalidad de cara al usuario final que no existía en ninguna versión anterior: la posibilidad de que un cliente de la tienda pública se registre, inicie sesión, y tenga una cuenta persistente — en contraste con el checkout como invitado, que existía desde el origen del proyecto y se mantiene intacto como flujo alternativo, no reemplazado.

El trabajo de esta versión tuvo dos frentes. El primero, ya iniciado antes del arranque formal de v8.0, dejó armada y validada la base de autenticación: las tablas admins y clientes, el trigger de alta automática de perfil, el AuthContext de client, las páginas de login/registro, y el endurecimiento de ProtectedRoute en admin para expulsar a cualquier cuenta autenticada que no sea administrador (antes, cualquier auth.users válido —incluyendo un cliente— podía entrar al backoffice). El segundo frente, ejecutado en esta versión, cerró todo lo que había quedado pendiente de ese trabajo previo: el header sin distinguir sesión, el vínculo entre un pedido y la cuenta que lo generó, la precarga de datos del checkout, y la página "Mi cuenta".

Ambos frentes se ejecutaron con Codex, en general con tareas divididas en pasos pequeños y verificables (primero el cambio de base de datos contra producción, después el frontend que depende de él), siguiendo la misma lógica de reducir superficie de riesgo por tarea que ya se documentaba en v7.0 para cambios de mayor alcance.


## 1.4 Novedades respecto a v7.0

- Base de datos: nuevas tablas admins y clientes en auth.users compartido; función is_admin(); trigger handle_new_cliente de alta automática de perfil al registrarse. Ver sección 7.3.
- Base de datos: nueva columna pedidos.usuario_id (nullable, FK a auth.users, ON DELETE SET NULL) y nuevas políticas RLS que permiten a un cliente autenticado leer sus propios pedidos y los items de esos pedidos. Ver sección 7.4.
- Base de datos: crear_pedido_completo modificada para aceptar un parámetro opcional p_usuario_id, vinculando el pedido a la cuenta del cliente cuando hay sesión activa en el momento de la compra. Ver sección 7.4.2.
- Client: sistema de autenticación completo — AuthContext, LoginPage, RegisterPage, TerminosCondicionesPage, y en esta versión ProtectedRoute y MiCuentaPage nuevas. Ver sección 4.10.
- Client: client/src/components/ suma una sexta subcarpeta de dominio, auth/, con ProtectedRoute — la primera adición a la convención de subcarpetas establecida en v7.0. Ver sección 2.1.
- Client: HeaderTop.tsx incorpora un botón unificado de cuenta ("Mi Cuenta" / nombre del cliente logueado) con dropdown, reemplazando el estado sin ninguna noción de sesión que tenía hasta v7.0. Ver sección 4.10.3.
- Client: ResumePage precarga nombre, teléfono y email del cliente logueado al entrar al checkout, sin dejar de ser editable ni de soportar compra como invitado. Ver sección 4.10.4.
- Admin: ProtectedRoute ahora verifica rol vía esAdmin (contra el RPC is_admin()) además de sesión válida, cerrando una falla de seguridad donde cualquier cuenta de auth.users —incluyendo un cliente recién registrado— podía entrar al backoffice. Ver sección 5.15.

# 2. Estructura del Monorepo

Sin cambios a nivel de paquetes respecto a v7.0. Se actualiza el árbol de client/src/components/ (nueva subcarpeta auth/) y client/src/pages/ (tres páginas nuevas de v8.0: TerminosCondicionesPage ya documentada como existente desde antes de esta versión, y MiCuentaPage nueva en esta versión).


## 2.1 Árbol de archivos relevantes (actualizado en v8.0)

Esta sección reemplaza la 2.1 de v7.0 únicamente en lo referido a client/src/components/, client/src/pages/ y client/src/context/, y a las tablas de shared/schema.sql. El resto del árbol no cambió.

/client/src

/components

/layout    -> Header, HeaderTop, HeaderNav, CategoryDropdown,

Footer, AlertaBanner, WhatsappFloatButton, ScrollToTop

/common    -> LoadingState, ErrorState, ErrorBoundary

/product   -> ProductCard, CategoryCard, ArticulosSidebar, FeaturedCarousel

/cart      -> CartDrawer, CartItemRow

/home      -> Banner, ReviewsCarousel/ReviewsCarousel

/auth      -> ProtectedRoute (*, nuevo en v8.0)

/hooks       -> usePaneles.ts, useSucursales.ts,

useConfiguracionTienda.ts, useModalAccesible.ts

/context     -> CartContext.tsx, AuthContext.tsx (*)

/pages       -> HomePage, ProductsPage, ResumePage (*), ProductDetailPage,

LoginPage (*), RegisterPage (*), TerminosCondicionesPage (*),

MiCuentaPage (*, nuevo en v8.0)

/utils       -> redesSociales.tsx

App.tsx + main.tsx

/admin/src   -> sin cambios de estructura; ProtectedRoute.tsx modificado (*)

(ver seccion 5.15)

/shared/src

schema.sql (*) -- suma admins, clientes, pedidos.usuario_id

rls.sql    (*) -- suma policies de admins, clientes, y lectura propia

sobre pedidos y pedido_items

rpc.sql    (*) -- crear_pedido_completo acepta p_usuario_id

(*) Creado, modificado o regenerado en v8.0.


## 2.2 — 2.3 Aislamiento client/admin y stack

Sin cambios respecto a v7.0. El vínculo nuevo entre pedidos y auth.users no introduce ningún import cruzado entre client y admin: cada aplicación sigue consultando y actualizando la base a través de sus propias políticas RLS, sin dependencia directa entre los dos frontends.


# 3. Stack Tecnológico

Sin cambios respecto a v7.0.


# 4. Aplicación Client (Tienda Pública)

Las pages y componentes ya documentados en v7.0 mantienen su comportamiento sin cambios, salvo HeaderTop.tsx y ResumePage.tsx, ambos actualizados en esta versión (secciones 4.10.3 y 4.10.4). El cambio central de v8.0 en client es la sección 4.10, íntegramente nueva.


## 4.10 Autenticación de clientes (nuevo en v8.0)

Suma la capacidad de que la aplicación sostenga usuarios distintos del admin — clientes finales registrados en la tienda pública — sin romper la lógica de checkout como invitado ya existente ni el aislamiento client/admin documentado en la sección 2.2.


### 4.10.1 AuthContext y formularios de acceso

client/src/context/AuthContext.tsx expone session, loading, login, signUp (recibe nombre/apellido/telefono vía user metadata de Supabase Auth, consumidos por el trigger handle_new_cliente — ver sección 7.3.2) y logout. LoginPage.tsx y RegisterPage.tsx son formularios controlados con manejo de componente desmontado (ref montado) y validación de campo por campo, patrón que en esta versión se replicó también en MiCuentaPage (sección 4.10.2) y ResumePage (sección 4.10.4).

TerminosCondicionesPage.tsx existe como page estática con el texto legal, enlazada desde HeaderNav.tsx. Se tomó la decisión de producto explícita de que el registro no exige aceptación de un checkbox de términos — la página queda como referencia informativa, no como paso bloqueante del formulario de RegisterPage. Se documenta como decisión deliberada, no como pendiente.


### 4.10.2 MiCuentaPage (nuevo en v8.0)

Página protegida en /mi-cuenta, accesible únicamente con sesión activa a través del componente nuevo client/src/components/auth/ProtectedRoute.tsx (primera pieza de la subcarpeta auth/ — ver sección 2.1). Mientras se resuelve la sesión inicial (loading === true) no redirige; si no hay sesión, redirige a /login con <Navigate replace />; si hay sesión, renderiza el contenido.

La página tiene dos secciones independientes entre sí en cuanto a manejo de error — una falla en una no debe romper la otra:

- Perfil editable — trae nombre, apellido, teléfono y email desde la tabla clientes filtrando por session.user.id. El email se muestra de solo lectura (cambiarlo requeriría un flujo de confirmación sobre auth.users, fuera de alcance de esta versión). Nombre, apellido y teléfono son editables y se guardan con un UPDATE directo sobre clientes, habilitado por la policy "Actualización del propio perfil" (sección 7.3.1).
- Historial de pedidos, de solo lectura — trae los pedidos del cliente (usuario_id = session.user.id) y los items de esos pedidos, reutilizando mapearPedido, mapearPedidoItem y formatEstadoPedido de @shared, las mismas funciones que ya usa admin/src/pages/OrdersPage.tsx, para no introducir una nomenclatura de estados distinta entre las dos aplicaciones. Muestra por pedido: fecha, estado, y los productos comprados (nombre y cantidad). No expone ninguna acción sobre el pedido — no se cancela ni se edita nada desde esta vista.
Nota — un dato queda documentado como deuda menor, no como bug bloqueante (ver sección 11.3): el botón de cuenta del header (sección 4.10.3) muestra el nombre leído de auth.users.user_metadata, cargado una única vez al momento del registro. Si el cliente edita su nombre desde MiCuentaPage, ese cambio impacta la tabla clientes (y por lo tanto el propio MiCuentaPage y el historial de pedidos futuros), pero no se propaga a user_metadata — el header seguiría mostrando el nombre viejo hasta un nuevo signUp. No se resolvió en esta versión por no haber sido parte del alcance pedido; queda registrado para una futura versión.


### 4.10.3 Header con estado de sesión

client/src/components/layout/HeaderTop.tsx incorpora un único botón de cuenta dentro de .botones (mismo contenedor de Info/Ayuda/Carrito), con dropdown por hover en desktop y por click en touch, replicando exactamente el patrón ya usado para el dropdown de Ayuda (portal, posición calculada por getBoundingClientRect, cierre con delay, listener de click-afuera y de resize).

El texto del botón depende del estado: mientras loading es true no se renderiza (evita parpadeo); sin sesión muestra "Mi Cuenta"; con sesión muestra el nombre de pila leído de user_metadata.nombre (con "Mi Cuenta" como fallback si viniera vacío — nunca el email ni el apellido). El contenido del dropdown también depende del estado: sin sesión, links a /login y /registro; con sesión, un link a /mi-cuenta y un botón "Cerrar sesión" que llama a logout(), deshabilitado mientras la promesa está en curso para evitar doble click, con manejo de componente desmontado.


### 4.10.4 Checkout: vínculo con la cuenta y precarga

ResumePage.tsx, al confirmar un pedido, envía siempre p_usuario_id a crear_pedido_completo: session.user.id si hay sesión activa, null si la compra es como invitado (ver sección 7.4.2 para el lado de base de datos). Además, si hay sesión, un efecto trae el perfil del cliente (misma consulta que usa MiCuentaPage) y precarga el formulario — nombre y apellido concatenados en el único campo "Nombre y Apellido" que tiene el formulario, más teléfono y email. La precarga ocurre una única vez por entrada con sesión activa y no pisa campos que el cliente ya haya editado a mano antes de que la consulta resuelva. Los campos permanecen editables en todos los casos: un cliente logueado puede modificar cualquiera de sus datos para un pedido puntual sin que eso afecte su perfil guardado.

Un pedido de invitado y un pedido de un cliente logueado que edita sus datos antes de confirmar se comportan igual del lado de cliente_nombre/cliente_telefono/cliente_email (texto libre, sin relación con clientes); la única diferencia estructural es si usuario_id queda null o con el id real de la cuenta.


## 4.11 Pages y componentes existentes

Sin cambios de comportamiento respecto a v7.0 fuera de lo documentado en 4.10.3 y 4.10.4.


# 5. Aplicación Admin (Backoffice)

Sin cambios funcionales en esta versión salvo lo documentado en 5.15. El resto del backoffice se mantiene igual que en v7.0.


## 5.15 Endurecimiento de ProtectedRoute (nuevo en v8.0)

Con la introducción de clientes como un segundo tipo de usuario en la misma instancia de auth.users (sección 1.2), dejó de ser válido asumir que cualquier sesión autenticada correspondía a un administrador. admin/src/context/AuthContext.tsx incorpora esAdmin, verificado contra el RPC is_admin() (sección 7.3.1). admin/src/components/ProtectedRoute.tsx ahora expulsa —con logout automático— a cualquier usuario autenticado que no sea admin, cerrando una falla de seguridad real: antes de este cambio, un cliente recién registrado en la tienda pública podía loguearse con las mismas credenciales en el backoffice y entrar, porque ProtectedRoute solo verificaba sesión válida, no rol.

Se identificó y corrigió, en el mismo trabajo, una race condition posterior al fix: loading en AuthContext solo se ponía en false una vez, en el montaje inicial; onAuthStateChange nunca lo volvía a tocar, así que tras el login, ProtectedRoute evaluaba esAdmin con su valor inicial (false) antes de que el RPC respondiera, expulsando de forma intermitente a administradores legítimos. Se corrigió poniendo loading en true mientras corre la verificación de admin, y se aplicó preventivamente el mismo resguardo en client (donde no había síntoma, por no tener client ninguna verificación async encadenada al login en ese momento).


# 6. Paquete Shared

Sin cambios en tipos ni utilidades puras respecto a v7.0. mapearPedido, mapearPedidoItem y formatEstadoPedido, ya existentes para consumo de admin, se reutilizan sin modificación desde MiCuentaPage.tsx en client (sección 4.10.2) — es la primera vez que una utilidad de @shared pensada originalmente para admin se consume también desde client en un flujo de UI, reforzando el criterio ya documentado en v7.0 (sección 5.14.1) de que shared/ es una capa de dominio agnóstica, no específica de una aplicación.

shared/src/supabase/database.types.ts se regeneró en esta versión para reflejar pedidos.usuario_id, siguiendo la lección operativa dejada en v7.0 (sección 6.4): la regeneración se aplicó en el mismo momento que el ALTER TABLE contra producción, no como paso posterior.


# 7. Base de Datos (Supabase / Postgres)

Esta versión suma dos tablas nuevas, una columna nueva sobre una tabla existente, y varias políticas RLS nuevas. Se documenta también un cambio de modelo de negocio respecto a v7.0 (sección 1.2).


## 7.3 Tablas admins y clientes (nuevo en v8.0)


### 7.3.1 admins

Allowlist 1:1 con auth.users. Definida en schema.sql; políticas, la función is_admin() y su seed en rls.sql. Es la tabla contra la que ProtectedRoute de admin verifica rol (sección 5.15).


### 7.3.2 clientes

Perfil 1:1 con auth.users (nombre, apellido, email, telefono). Definida en schema.sql; políticas de lectura y actualización del propio perfil ("Lectura del propio perfil", "Actualización del propio perfil", ambas con auth.uid() = id) y trigger de alta automática handle_new_cliente en rls.sql, que consume la metadata enviada por signUp (nombre/apellido/telefono) para crear la fila de clientes al momento del registro.

Nota — las sentencias CREATE TABLE de ambas tablas se reorganizaron de rls.sql a schema.sql, para respetar el orden de inicialización documentado desde v7.0 (schema.sql → rpc.sql → rls.sql). Fue un cambio de organización del repositorio únicamente — las tablas ya existían en la base real de producción antes de esta reorganización, no se tocó ningún dato.


## 7.4 Vínculo pedido↔cliente (nuevo en v8.0)

Se agregó, como cambio incremental contra la base real en producción (nunca recreando la tabla completa — pedidos ya tenía datos cargados), la columna:

ALTER TABLE pedidos ADD COLUMN usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

Nullable de forma deliberada: el checkout como invitado sigue existiendo y sigue sin usuario_id. ON DELETE SET NULL en vez de CASCADE, para que borrar una cuenta de cliente no borre su historial de pedidos, solo desvincule al dueño.

Nota — shared/schema.sql quedó con la columna usuario_id declarada dos veces: una vez dentro de la definición base de CREATE TABLE pedidos (para que el schema completo refleje la estructura real si algún día se usa para levantar una instancia nueva desde cero) y otra vez como este ALTER TABLE incremental, pensado para aplicarse contra una base ya poblada. Esto significa que, tal como está hoy, un CREATE TABLE + ALTER TABLE corridos en secuencia sobre una instancia nueva fallaría en el segundo paso (columna duplicada). No afectó a esta versión —la base real de producción no tenía la columna, así que el ALTER TABLE era exactamente lo que correspondía correr—, pero queda como deuda técnica menor a prolijar en shared/schema.sql (ver sección 11.3).

Se agregaron dos políticas RLS nuevas de solo lectura para el propio dueño del pedido, ambas TO authenticated:

- Lectura de pedidos propios para clientes — sobre pedidos, USING (auth.uid() = usuario_id).
- Lectura de items de pedidos propios para clientes — sobre pedido_items, vía EXISTS contra pedidos.usuario_id = auth.uid() (pedido_items no tiene columna propia de usuario_id).
Ninguna de las dos habilita UPDATE ni DELETE para clientes — un cliente puede ver su historial pero no modificar ni cancelar pedidos directamente vía RLS; esa capacidad sigue siendo exclusiva de admin, sin cambios respecto al trigger de validación de transiciones documentado en v7.0 (sección 7.2).


### 7.4.2 crear_pedido_completo

Se agregó el parámetro p_usuario_id uuid DEFAULT NULL al final de la firma, para no romper la posición de los parámetros existentes ni la compatibilidad con llamadas ya en caché del navegador durante el rollout. El INSERT INTO pedidos incluye usuario_id; el jsonb_build_object del RETURN final incluye 'usuario_id'. El resto de la función —validación de productos/variantes, cálculo de v_total, inserción de pedido_items— no se modificó.

Verificado contra la base real: un pedido creado sin sesión activa queda con usuario_id en NULL; un pedido creado con sesión activa queda con el auth.users.id correcto, confirmado por consulta directa en el SQL Editor comparando contra auth.users.email.


# 8. Auditoría de Calidad

No se ejecutó una auditoría dedicada en esta versión. Los pendientes identificados en la auditoría de v7.0 que seguían sin resolver al cierre de v7.0 se mantienen sin cambios — ver sección 11.


# 9. Archivos SQL del Proyecto

Sin cambios de ubicación respecto a v7.0: shared/schema.sql, shared/rls.sql, shared/rpc.sql, en ese mismo orden de inicialización. schema.sql incorpora en esta versión las tablas admins y clientes y la columna pedidos.usuario_id (con la duplicación documentada en la nota de la sección 7.4).


# 10. Variables de Entorno y Secrets

Sin cambios respecto a v7.0.


# 11. Puntos Pendientes para Próximas Etapas

Se retiran de esta lista los cinco puntos resueltos en v8.0 (sección 11.1) y se mantienen sin cambios los pendientes de versiones anteriores que siguen sin atenderse (sección 11.2), a los que se suman dos hallazgos nuevos, ambos de severidad baja/media, detectados como efecto colateral del trabajo de esta versión (sección 11.3).


## 11.1 Ya resueltos (retirados de esta lista en v8.0)

- Header sin distinguir sesión iniciada — resuelto, sección 4.10.3.
- ResumePage sin precarga de datos de cliente logueado — resuelto, sección 4.10.4.
- pedidos sin vínculo a clientes (sin usuario_id ni FK) — resuelto, sección 7.4.
- No existía página de "Mi cuenta" en client — resuelto, sección 4.10.2.
- Falla de seguridad: login en admin no verificaba rol, solo sesión válida — resuelto, sección 5.15.

## 11.2 Pendientes que persisten de versiones anteriores

- Fetch de configuracion_tienda — usePaneles.ts sigue sin migrarse a useConfiguracionTienda (pendiente desde v7.0, sección 4.9.2).
- Verificar un dominio propio en Resend para notificar por email a clientes reales (pendiente desde v6.0/v7.0).
- Conectar CategoryCard y el campo es_card a una vista real — pendiente desde v4.0.
- Extraer a un hook compartido la lógica de fetch + cálculo de precioMinimo por variantes, duplicada entre ProductsPage y FeaturedCarousel — pendiente desde v4.0.
- Migrar los alert() nativos restantes al notify() de ConfirmContext — pendiente desde v4.0.
- Despliegue en Vercel de client y admin como proyectos separados — pendiente desde v2.0.
- Sin ninguna suite de tests automatizados en ningún paquete — pendiente estructural desde la auditoría de v7.0 (sección 8), agravado por la superficie nueva de esta versión (auth, RLS de clientes, vínculo de pedidos) verificada íntegramente a mano.
- Colores hardcodeados puntuales fuera de las excepciones documentadas (SettingsPage, ReviewsCarousel, ConfirmDialog) — pendiente de evaluación desde v7.0.

## 11.3 Nuevos, detectados como efecto colateral del trabajo de v8.0

- Medio — schema.sql declara pedidos.usuario_id dos veces (CREATE TABLE base + ALTER TABLE incremental). No es un problema para la base actual, pero rompería una instalación desde cero que ejecutara ambos fragmentos en secuencia. Ver nota en sección 7.4.
- Bajo/Medio — el nombre mostrado en el botón de cuenta del header se lee de auth.users.user_metadata.nombre, cargado una única vez en el registro. Editar el perfil desde MiCuentaPage actualiza clientes pero no ese metadata, por lo que el header puede quedar desincronizado del nombre real del cliente hasta un futuro signUp. Ver nota en sección 4.10.2.

# 12. Resumen Ejecutivo de Decisiones

v8.0 es la primera versión de este documento que introduce funcionalidad nueva de cara al usuario final desde que existe el checkout como invitado: la posibilidad de tener una cuenta persistente en la tienda pública. La decisión de arquitectura más importante de esta versión —y la más silenciosa, porque no se ve en ninguna pantalla— es que administradores y clientes conviven en la misma instancia de auth.users de Supabase, diferenciados por su presencia en la tabla admins en vez de por instancias separadas. Esa decisión es lo que permitió, sin infraestructura adicional, endurecer ProtectedRoute en admin (sección 5.15) apenas se detectó que un cliente podía entrar al backoffice con las mismas credenciales.

La segunda decisión relevante fue explícitamente de negocio, no técnica: vincular pedidos a clientes vía usuario_id (sección 7.4) en vez de dejar el registro como una mera conveniencia de checkout sin trazabilidad. Esa decisión es la que habilitó, en la misma versión, que MiCuentaPage pudiera mostrar historial de compras real desde el primer momento, en vez de quedar como una página de perfil sin contenido hasta una hipotética versión futura.

Como en v7.0, el trabajo se verificó manualmente en cada paso —contra la base real de producción para los cambios de schema, y en el navegador para cada pieza de frontend— sin que exista todavía ninguna suite de tests automatizados que respalde esta superficie nueva. Es el mismo pendiente estructural señalado al cierre de v7.0, ahora con más código sensible (RLS de clientes, el vínculo pedido↔cliente, el trigger de alta de perfil) dependiendo del mismo método manual.

*Grow — Documento de Arquitectura v8.0 — Agosto 2026*


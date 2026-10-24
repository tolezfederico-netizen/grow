# Auditoría funcional y de producto — 2026-10-23

> **Estado (24/10/2026):** los hallazgos de esta auditoría se convirtieron en el plan de la sección 16 de `guia-auditoria-decisiones-2026-10.pdf`. Qué está resuelto y qué falta: `roadmap-funcionalidades.md`, sección "Estado del plan". Este documento queda como registro de la auditoría tal como se hizo.

Alcance: `client/`, `admin/`, `shared/`, `supabase/`, `vercel.json` y workflow de GitHub, contrastados con [arquitectura-v13.md](../arquitectura/arquitectura-v13.md). No se modificó ningún archivo del proyecto. `npm run typecheck` pasa en los tres paquetes y `build:client` / `build:admin` compilan (el admin con un aviso de chunk de 1,27 MB).

Limitaciones:

- **No hubo acceso a la base de producción, al dashboard de Supabase, a Vercel ni a Resend.** Todo lo que depende de su estado real está marcado **[no verificable]**.
- El `.docx` (`Grow_Arquitectura_v13.docx`) **no está en el repositorio**; se usó `arquitectura-v13.md`, que según [README.md](../arquitectura/README.md) es la fuente del Word.
- Lo legal es **orientación, no asesoramiento legal**. Antes de vender conviene que lo revise un abogado.

Severidad: **alta** = bloquea vender o expone al dueño a un problema real; **media** = afecta la operación o la conversión; **baja** = mejora o deuda.

## Resumen de los hallazgos principales

| # | Hallazgo | Severidad |
|---|---|---|
| R1 | Las reseñas fijas son de un negocio real (nombres, fotos, detalles del local) y se muestran en cualquier tienda | Alta |
| P1 | El dueño no se entera de un pedido nuevo salvo que abra el admin | Alta |
| A1 | Editar un producto borra y recrea sus variantes: rompe historial, carritos y puede dejar el producto sin variantes | Alta |
| L1 | Faltan botón de arrepentimiento, datos del proveedor y política de privacidad; los Términos nombran a otro sitio | Alta |
| O1 | El plan free de Supabase no tiene backups automáticos y no hay backup propio | Alta |

---

## 1. Documento vs código

| # | Doc (v13) | Código real | Evidencia | Severidad |
|---|---|---|---|---|
| D1 | §4.3: sello "Compra Protegida" en la ficha | También en el catálogo y en el checkout | `client/src/pages/ProductsPage.tsx:163`, `client/src/pages/ResumePage.tsx:375`, `client/src/pages/ProductDetailPage.tsx:227` | Baja |
| D2 | §4.1: `CarritoFlotante` en "inicio y fichas" | `startsWith("/producto")` también incluye `/productos` (catálogo) | `client/src/App.tsx:71-72` | Baja |
| D3 | §5.4: grupos Hoy / Ayer / Este mes / Más antiguos | Hay además "Esta semana" | `admin/src/pages/OrdersPage.tsx:49` | Baja |
| D4 | §1.2 y §12: reseñas como "decisión de producto" genérica; los textos fijos "Grow" son los únicos | Las reseñas describen un local concreto ("tienen tarjeta", "abren hasta las 20:30", "el muchacho que atiende") y los Términos nombran `www.growshop.com.ar` y "GROWSHOP": viola el principio de genericidad y no figura entre las excepciones | `client/src/components/home/ReviewsCarousel/ReviewsCarousel.tsx:13-27`, `client/src/pages/TerminosCondicionesPage.tsx:12-15,25` | Alta (ver R1, L1) |
| D5 | §7.5: `clientes` tiene CHECK de largos y teléfono; §7.2: instancia nueva = `schema → rpc → rls` | El CHECK `clientes_largos_check` solo está en `docs/auditoria/correcciones.sql`, no en `shared/*.sql`: una instancia nueva no lo tiene | `docs/auditoria/correcciones.sql:240-241`; ausente en `shared/schema.sql` y `shared/rls.sql` | Media |
| D6 | §7.5: bucket con 5 MB y solo webp/jpeg/png | En `shared/` el bloque está comentado; solo se aplicó en producción vía C7. Una instancia nueva queda sin límites | `shared/schema.sql:315-322` (comentado), `docs/auditoria/correcciones.sql:264-270` | Media |
| D7 | §7.1: `pedido_items` guarda snapshot de nombre y precio | No guarda el nombre de la variante: admin, Mi Cuenta y el email lo leen en vivo de `producto_variantes`. Combinado con A1, el historial pierde la variante | `shared/schema.sql:131-142`; `supabase/functions/enviar-notificacion-pedido/index.ts:175`; `admin/src/pages/OrdersPage.tsx:179` | Alta (ver A1) |
| D8 | §7.5 tabla: admin "Lee, inserta, actualiza" `configuracion_tienda` | Coincide, pero `rls.sql` crea además una policy de lectura de admin redundante | `shared/rls.sql:202-205` | Baja |
| D9 | §4.4 (8–10 dígitos) y §7.3 (8–15) | Coincide con el código, pero el client y la RPC no validan lo mismo; ninguno normaliza (0, 15, código de área). Ver P5 | `client/src/pages/ResumePage.tsx:105`, `shared/rpc.sql:56` | Media |
| D10 | §3.4: el keep-alive mantiene viva la base | El `curl` va a `/rest/v1/` (raíz de PostgREST), que no consulta ninguna tabla. **[no verificable]** si Supabase lo cuenta como actividad; conviene que consulte una tabla pública (p. ej. `configuracion_tienda?select=nombre_tienda`) | `.github/workflows/keep-alive.yml:15-18` | Baja |
| D11 | §1 "verificado contra `pg_policies`", §7.6 Auth (confirmación de email, Site URL), cron `jobid 1`, secrets de Resend | **[no verificable]** desde el repo | `shared/rpc.sql:197` | — |
| D12 | README: existe `Grow_Arquitectura_v13.docx` | No está versionado | `docs/arquitectura/` | Baja |

Coinciden con el documento: rutas (`client/src/App.tsx:35-69`), headers de Vercel (`client/vercel.json`, `admin/vercel.json`), matriz de estados (`shared/schema.sql:284-307` y `admin/src/pages/OrdersPage.tsx:19-25`), RPC (`shared/rpc.sql:27-167`), Edge Function (`supabase/functions/enviar-notificacion-pedido/index.ts`), `verify_jwt = false` (`supabase/config.toml`), hooks y `usePaneles`.

---

## 2. Funcionalidades existentes

### 2.1 Client

| Funcionalidad | ¿Funciona de punta a punta? | Valor | Observaciones |
|---|---|---|---|
| Catálogo, filtros, búsqueda | Sí | Alto | Sin orden explícito (`ProductsPage.tsx:92`, no hay `.order`), sin paginación |
| Ficha de producto | Sí | Alto | Una sola imagen; compartir sin vista previa (ver S1) |
| Carrito + checkout invitado | Sí | Alto | Ver C1–C5 |
| Cuentas de cliente + Mi Cuenta | Sí, sin recuperar contraseña | Medio | Ver C6, L3 |
| Banner de locales con mapa | Sí | Alto | Horario único sin días (ver C9) |
| AlertaBanner con vencimiento | Sí | Medio | Cron cada minuto redundante con el filtro del client (sobrediseño leve) |
| Reseñas | Sí (datos fijos) | Negativo hoy | Ver R1 |
| Paneles de navegación con cards | Sí | Medio | Sobrediseñado para un growshop chico (ver 2.3) |

**C1 — Carrito volátil y "Ver Producto" abre otra pestaña (media).** El carrito vive en memoria (`client/src/context/CartContext.tsx:125`). Al recargar se pierde, y como "Ver Producto" abre la ficha en una pestaña nueva (`client/src/components/product/ProductCard.tsx:114`), lo que se agrega ahí queda en **otro carrito**. Recomendación: persistir en `localStorage` (ids y cantidades, re-precios al cargar) y abrir la ficha en la misma pestaña.

**C2 — Total mostrado vs total guardado (media).** El carrito congela el precio al agregar (`ProductCard.tsx:55,67`); la RPC cobra el precio del catálogo al confirmar (`shared/rpc.sql:117,122`). Si el dueño cambia un precio en el medio, el modal muestra un total y se registra otro, y la pantalla de éxito no muestra el total real (`ResumePage.tsx:162-178`). Recomendación: mostrar el total que devuelve la RPC o refrescar precios al entrar a `/resumen`.

**C3 — Stock agotado entre carrito y confirmación (baja).** Está cubierto: la RPC rechaza `sin_stock`, pausados y variantes pausadas con el nombre del producto (`shared/rpc.sql:95-115`) y el modal muestra el mensaje. Faltan dos cosas: el carrito no marca ni quita el item (el cliente tiene que adivinar cuál es) y un producto borrado da "Producto no encontrado." sin nombre (`rpc.sql:93`). Recomendación: devolver el `producto_id` del item rechazado y marcarlo en el carrito.

**C4 — Pedido duplicado (baja).** El doble clic está cubierto (`enviando` deshabilita el botón, `ConfirmarPedidoModal.tsx:101`). No hay clave de idempotencia: si la respuesta se pierde por la red y el cliente reintenta, entra dos veces. El freno anti-spam (3 por teléfono cada 10 min, `rpc.sql:74-78`) permite duplicados. Recomendación: generar un `id` de intento en el client y hacer UNIQUE en la base.

**C5 — Confirmación pobre (media).** Tras confirmar solo dice "Te vamos a contactar a la brevedad" (`ResumePage.tsx:166`): sin número de pedido, sin dirección ni horario de retiro, sin email. El `TODO` de notificación sigue abierto (`ResumePage.tsx:151-152`). Recomendación: mostrar `#id` corto, local, horario y enviar email de recibido (ver P1).

**C6 — Sin recuperar contraseña (media).** No hay `resetPasswordForEmail` en el client (`client/src/context/AuthContext.tsx:48-74`). Un cliente que olvida la contraseña pierde el acceso a su historial. El login muestra el mensaje crudo de Supabase, en inglés (`client/src/pages/LoginPage.tsx:41-47`).

**C7 — Producto con variantes todas pausadas (baja).** La ficha muestra "—" y el botón "Agregar" no hace nada, sin aviso (`ProductDetailPage.tsx:72-74,87`). Las variantes no tienen estado `sin_stock` (`shared/schema.sql:87`): para marcar sin stock un talle hay que pausarlo y desaparece.

**C8 — Cantidad sin tope en la ficha (baja).** `sumarCantidad` no tiene máximo (`ProductDetailPage.tsx:80-82`); la RPC rechaza más de 999 recién al confirmar.

**C9 — Horario de atención (media).** `horario_apertura` / `horario_cierre` son dos textos (`shared/schema.sql:163-164`): no se pueden expresar días distintos, feriados ni horarios por sucursal, que es justo lo que el cliente necesita para ir a retirar.

**C10 — WhatsApp de la tienda sin código de país (media).** El botón flotante y el header arman `wa.me/<dígitos del teléfono>` tal cual se cargó (`client/src/components/layout/WhatsappFloatButton.tsx:15`, `HeaderNav.tsx:99`, `HeaderTop.tsx:1107`). Si el dueño carga "11 2345-6789", el link va a un número inexistente. El admin, en cambio, antepone `54` (ver P5). Recomendación: guardar el teléfono en formato internacional validado en Configuración.

**C11 — Accesibilidad del modal de confirmación (baja).** `ConfirmarPedidoModal` cierra con Escape pero no atrapa el foco (no usa `useModalAccesible`, `client/src/components/common/ConfirmarPedidoModal.tsx:25-40`).

### 2.2 Admin

| Funcionalidad | ¿Funciona? | Valor | Observaciones |
|---|---|---|---|
| Dashboard | Sí | Medio | Cuenta pedidos, no plata (ver 3, reportes) |
| Pedidos + notificación WhatsApp/email | Sí | Alto | Ver P1–P6 |
| Productos | Sí, con riesgo | Alto | Ver A1–A3 |
| Categorías | Sí | Alto | Errores intermedios no chequeados (`CategoriesPage.tsx:122-146`) |
| Paneles | Sí | Medio | Sobrediseñado (2.3) |
| Clientes + Excel | Sí | Medio | Límite de filas (A4) |
| Configuración | Sí | Alto | Teléfono sin formato (C10) |

**P1 — Sin aviso de pedido nuevo (alta).** Nada avisa al dueño: no hay email, push, sonido ni suscripción realtime (no hay `channel`/`subscribe` en `admin/src`); la lista de pedidos se carga una vez (`OrdersPage.tsx:151-206`). La etiqueta "Sin atender" (`OrdersPage.tsx:35,78-80`) solo la ve quien ya entró. En un negocio sin e-commerce, el dueño no va a tener el admin abierto: el pedido se enfría. Recomendación: Database Webhook / trigger con `pg_net` sobre `INSERT` en `pedidos` que llame a una Edge Function y mande email (y opcionalmente WhatsApp/Telegram) al dueño; además, realtime en `OrdersPage`.

**P2 — Cancelación sin motivo ni aviso (media).** Cancelar solo pide confirmación (`OrdersPage.tsx:245-265`); no guarda motivo y la Edge Function solo admite `confirmado` y `listo_para_retirar` (`index.ts:10`). El cliente se entera si llama. Recomendación: columna `motivo_cancelacion` y notificación de cancelación.

**P3 — Pedido sin atender / no retirado (media).** No hay vencimiento: un `listo_para_retirar` que nadie busca queda abierto para siempre y sigue apareciendo (`OrdersPage.tsx:33,164-166`). Recomendación: recordatorio al cliente a las 48 h y cancelación sugerida a los N días (configurable).

**P4 — Búsqueda de pedidos solo por nombre (baja).** `OrdersPage.tsx:214-218` no busca por teléfono, email ni número de pedido; justo lo que el cliente dice en el mostrador.

**P5 — Teléfono mal cargado (media).** El cliente escribe 8 a 10 dígitos sin normalizar (`ResumePage.tsx:105,319`); el admin abre `wa.me/54<teléfono>` (`OrdersPage.tsx:306,522`, `CustomersPage.tsx:144`). Para celulares argentinos WhatsApp usa el formato `54 9 <área> <número>`; sin el 9, y con números cargados con 0 o 15, el link puede abrir un chat inexistente. **[no verificable]** sin probar con números reales; probarlo antes de vender. Recomendación: pedir código de área y número por separado, normalizar a E.164 (`549…`) en la RPC.

**P6 — Límite de filas de la API (media, escala).** Supabase devuelve como máximo 1000 filas por defecto. "Ver pedidos más antiguos" pide **todos** los `pedido_items` sin filtro (`OrdersPage.tsx:177-186`), y Clientes pide todos los clientes y todos los pedidos (`admin/src/pages/CustomersPage.tsx:218-228`): pasado el límite los totales y el Excel quedan truncados sin aviso. Con pocas ventas no pasa; con un año de operación sí. Recomendación: paginar o agregar en SQL (vista/RPC).

**A1 — Editar un producto borra y recrea sus variantes (alta).** Al guardar un producto con variantes se hace `DELETE` de todas y se insertan de nuevo con ids nuevos (`admin/src/components/ProductForm.tsx:120-127`). Consecuencias:
1. `pedido_items.variante_id` pasa a `NULL` en todo el historial (`ON DELETE SET NULL`, `shared/schema.sql:135`) y, como el nombre de la variante no tiene snapshot (D7), los pedidos viejos, Mi Cuenta y los emails pierden "qué talle/litros" se vendió.
2. Cualquier carrito abierto con ese producto falla al confirmar ("Variante inválida", `rpc.sql:110-111`).
3. No es atómico: si el insert falla (p. ej. una variante con precio vacío → `precio > 0`, `schema.sql:86`), el producto queda sin variantes y desaparece de la venta.
Recomendación: `upsert` por id + borrar solo las quitadas, o una RPC transaccional; agregar `nombre_variante` a `pedido_items`.

**A2 — Alta de producto: id por nombre y pasos sin control (media).** Tras insertar, el id del producto nuevo se busca por nombre (`ProductForm.tsx:145`) aunque ya está en `nuevo.id`; con dos productos de igual nombre (no hay UNIQUE) falla y el producto queda creado sin categorías. Los `delete`/`insert` de categorías no chequean error (`ProductForm.tsx:152-157`).

**A3 — Precio base 0 (baja).** `precio_base` no tiene CHECK `> 0` (`shared/schema.sql:29-34`, a diferencia de variantes en `:86`) y el formulario acepta "0" (`ProductForm.tsx:195`); el client muestra "—" (`ProductCard.tsx:46`).

**A4 — Imágenes huérfanas (baja).** Ya listado en v13 §12: al reemplazar imagen o borrar producto no se borra el archivo del bucket.

**A5 — Rendimiento (baja).** `client/src/assets/logo.png` pesa 720 KB (aparece en header y banner); el bundle del admin es de 1,27 MB porque `exceljs` no se carga bajo demanda (salida de `npm run build:admin`).

### 2.3 Lo que sobra o está sobrediseñado

- **Paneles de navegación** (3 tablas, cards con imágenes de productos, tope de 4 cards, orden fijo o al azar en huecos — `client/src/hooks/usePaneles.ts`, `admin/src/pages/PanelsPage.tsx` 524 líneas, `PanelItemsEditor`, `PanelItemForm`, `ProductoImagenSelector`). Para un growshop con 5–15 categorías, un menú de categorías con orden manual alcanza; el orden aleatorio hace que el menú cambie entre visitas. No borrar (ya está hecho), pero no invertir más ahí y ofrecer un modo simple por defecto.
- **"Compra Protegida"** en tres pantallas (ver R2): no aporta y genera riesgo.
- **Compartir "Instagram"** solo copia el link (`ProductDetailPage.tsx:137-140`): el rótulo promete algo que no hace.
- **Cron cada minuto** para limpiar el alerta: el client ya lo oculta (`AlertaBanner`); alcanza con el filtro.
- **Animación de vuelo al carrito** y tope de 10 destacados: inocuos; no requieren trabajo.

---

## 3. Funcionalidades que faltan (hipótesis contrastadas)

| Hipótesis | Veredicto | Evidencia |
|---|---|---|
| Aviso al dueño de pedido nuevo | **Confirmada, prioritaria** | `ResumePage.tsx:151` (TODO); sin realtime en el admin |
| Email de confirmación al cliente al crear el pedido | **Confirmada** | Solo se envía al confirmar/listo y manualmente (`OrdersPage.tsx:319-337`) |
| Stock numérico | **Parcial**: útil, no urgente | Solo estado `sin_stock` manual (`schema.sql:37`); el riesgo de vender lo que no hay se mitiga porque el dueño confirma cada pedido. Recomendado como opcional por producto, con descuento al **confirmar** (no al crear) |
| Carrito persistente | **Confirmada** | `CartContext.tsx:125` + C1 |
| Observaciones / fecha de retiro | **Confirmada** | `pedidos` no tiene columnas para eso (`schema.sql:99-115`); hoy se coordina por WhatsApp. Sucursal de retiro también falta, y hay multi-sucursal |
| Motivo de cancelación | **Confirmada** | P2 |
| Varias imágenes por producto | **Confirmada, media** | Una sola `imagen_url` (`schema.sql:22`) |
| Reportes de ventas | **Confirmada** | El Dashboard cuenta pedidos, no montos ni productos más vendidos (`admin/src/pages/DashboardPage.tsx:59-62`) |
| SEO | **Confirmada** | SPA sin SSR, `<title>Grow</title>` fijo (`client/index.html:13`), sin meta description, Open Graph, `robots.txt` ni `sitemap.xml` (`client/public/` solo tiene favicon y avatares). Los links compartidos por WhatsApp no muestran producto ni foto |
| Analytics | **Confirmada** | No hay ninguno; la CSP (`client/vercel.json`) bloquearía scripts de terceros: elegir uno sin cookies o Vercel Analytics y ajustar la CSP |
| Backups | **Confirmada, alta** | Plan free sin backups automáticos (ver O1) |

Otras que propongo:

- **Recuperación de contraseña** y **baja de cuenta** (C6, L3).
- **Sucursal de retiro** en el pedido (hay sucursales, pero el pedido no dice dónde retirar).
- **Página de estado del pedido** por link (`/pedido/:id?token=`) para invitados, que reduce consultas por WhatsApp.
- **Datos de transferencia** (alias/CBU) en Configuración para mostrar al confirmar, como paso previo a una pasarela (ver [pasarela-de-pago.md](pasarela-de-pago.md)).
- **Lista de precios / edición masiva de precios** (inflación: el dueño ajusta precios seguido; hoy es producto por producto).
- **Reseñas reales** (Google Place ID o carga desde el admin) en lugar de las fijas.

---

## 4. Riesgos

> Orientación general basada en normativa pública, consultada el 2026-10-23. **No es asesoramiento legal.**

**R1 — Reseñas fijas de un negocio real (alta).** `ReviewsCarousel.tsx:13-27` contiene 10 reseñas con nombre y apellido de personas, avatares (`client/public/1.jpg…10.jpg`), un promedio 4,8 y un total de 232 fijos, y detalles de un local concreto. Desplegado para otro growshop:
- Es publicidad que puede inducir a error sobre la reputación del comercio (régimen de lealtad comercial, [DNU 274/2019](https://www.consejosalta.org.ar/wp-content/uploads/DECRETO-274.pdf), que prohíbe la publicidad engañosa; y deber de información veraz de la Ley 24.240).
- Usa nombre e imagen de terceros sin consentimiento (Ley 25.326; derecho a la imagen del Código Civil y Comercial). Si se copiaron de Google, además el texto es de sus autores.
- Viola la genericidad del propio proyecto (D4).
Recomendación: sacar el componente o vaciarlo hasta tener reseñas reales del negocio que compra (cargadas por el admin con autorización, o un enlace a su perfil de Google).

**R2 — Sello "Compra Protegida" (media).** Aparece en catálogo, ficha y checkout (D1) con el texto "Tus datos cuidados durante toda la compra". No hay pago online, ni garantía, ni programa de protección detrás; "Compra Protegida" es además el nombre de un programa de Mercado Pago/Mercado Libre, lo que puede confundir. Recomendación: reemplazar por información verificable ("Retirás y pagás en el local", "Sin cargo hasta que confirmemos tu pedido") o quitarlo.

**L1 — Requisitos de venta a distancia (alta).** Aunque el pago y la entrega sean en el local, el pedido se arma y acepta por Internet:
- **Botón de arrepentimiento**: la [Resolución SCI 424/2020](https://www.argentina.gob.ar/normativa/nacional/norma-342869/texto) obliga a quienes venden por sitios web a un enlace "Botón de arrepentimiento" de acceso directo desde la página de inicio, sin registro previo, y a informar un código de revocación dentro de 24 h. El derecho de fondo es el art. 34 de la Ley 24.240 (10 días corridos desde la entrega o la celebración, lo último). Si el pago y la entrega son presenciales, puede discutirse si es "venta a distancia"; con una pasarela de pago, aplica sin duda. Hoy no existe (no hay rastro en `client/src`). Recomendación: implementarlo igual (formulario simple + código + email), es barato.
- **Datos del proveedor**: la [Resolución 270/2020](https://www.argentina.gob.ar/normativa/nacional/norma-341933/texto), que incorpora la Res. GMC 37/2019 del Mercosur ([texto en InfoLEG](https://servicios.infoleg.gob.ar/infolegInternet/anexos/340000-344999/341933/norma.htm)), exige mostrar nombre comercial y razón social, número de identificación tributaria (CUIT), domicilio físico y electrónico y medio de atención. `configuracion_tienda` no tiene razón social ni CUIT (`schema.sql:157-180`).
- **Data Fiscal (Formulario 960/D de ARCA)**: guías del sector indican que los sitios que venden a consumidor final deben exhibir el QR ([ejemplo de guía](https://ayuda.tiendanube.com/arca/como-agregar-el-codigo-de-data-fiscal-de-arca)); no encontré la norma oficial en esta consulta, verificar con el contador. La CSP actual bloquearía su script (`client/vercel.json`): conviene mostrarlo como imagen/enlace.
- **Términos y condiciones**: el texto actual nombra a otro sitio (`TerminosCondicionesPage.tsx:12`), habla de "compras online" y "entrega de los productos" (`:25`) que no existen, y no menciona retiro, precios, cancelación, arrepentimiento ni datos del proveedor. Recomendación: plantilla por instancia, con los datos de `configuracion_tienda`.

**L2 — Rubro y edad (media).** No hay aviso de edad ni restricción. Puntos a definir con un abogado:
- La [Ley 23.737](https://sherloc.unodc.org/cld/uploads/res/document/ley-23737-regimen-penal-de-estupefacientes_html/Ley_23737_regimen-penal-de-estupefacientes.pdf) (art. 12) castiga a quien "preconizare o difundiere públicamente" el uso de estupefacientes. El contenido de catálogo, descripciones y reseñas debe ser neutro (cultivo, jardinería, uso medicinal dentro de la Ley 27.350). Hay una reseña que habla de "parafernalia" (`ReviewsCarousel.tsx:23`).
- Productos de tabaco (papelillos, filtros) tienen restricción de venta a menores. Recomendación: confirmación "+18" en el checkout y validarlo al retirar.
- Los términos de Mercado Pago listan la parafernalia de drogas entre los bienes prohibidos según notas de prensa ([Canal26, 2025](https://www.canal26.com/general/2025/07/12/mercado-pago-podra-cerrar-cuentas-que-realicen-compras-prohibidas-que-productos-estan-vetados/)); relevante para la pasarela (ver [pasarela-de-pago.md](pasarela-de-pago.md)).

**L3 — Datos personales (media).** El sistema guarda nombre, teléfono y email de clientes y compradores invitados.
- La [AAIP](https://www.argentina.gob.ar/node/53779) indica que, antes de recolectar, hay que informar finalidad, destinatarios, identidad y domicilio del responsable y los derechos de acceso, rectificación y supresión, en un lugar visible (Res. AAIP 14/2018). No hay política de privacidad ni aviso en el checkout (`ResumePage.tsx:272-358`) ni en el registro.
- **Inscripción de la base**: la misma página dice que deben inscribirse las bases públicas y las privadas "destinadas a proporcionar informes" (art. 21, Ley 25.326); si una base de clientes propia entra o no, conviene confirmarlo, y muchos comercios la inscriben igual vía TAD.
- **Supresión**: no hay forma de borrar la cuenta (no hay policy de DELETE en `clientes`, `shared/rls.sql:382-386`) ni de anonimizar pedidos de invitados.
- **Exportación a Excel** de todos los clientes (`CustomersPage.tsx:288-299`): el archivo sale del sistema sin control; recomendar uso interno y avisarlo en la política.
- Subencargados: Supabase, Vercel y Resend procesan datos fuera del país; debe figurar en la política.

**O1 — Backups (alta).** Según la [documentación de Supabase](https://supabase.com/docs/guides/platform/backups), los backups diarios automáticos son de los planes pagos; para el free recomiendan exportar con `supabase db dump` y guardar copias fuera. No hay nada de eso en el repo (`.github/workflows/` solo tiene el keep-alive), y Storage no entra en el backup de base. Si se borra o corrompe la base, el negocio pierde pedidos, clientes y catálogo. Recomendación: workflow semanal de `pg_dump` cifrado a almacenamiento del dueño, o vender con Supabase Pro.

**O2 — Dependencia de la cuenta del desarrollador (media).** Cada instancia (Supabase, Vercel, Resend, GitHub secrets) se crea por negocio; si quedan a nombre del desarrollador, el cliente "compró" algo que no controla, y si quedan a nombre del cliente, el desarrollador pierde acceso para mantener. Definir en el contrato quién es titular de cada cuenta.

**O3 — Email sandbox (alta, ya conocido).** Con `RESEND_FROM` por defecto (`index.ts:5`), los emails solo llegan a la casilla de la cuenta de Resend. Pendiente "antes de vender" de v13 §12.

---

## 5. Orden sugerido

1. Antes de mostrar la demo a un cliente: R1, R2, Términos (L1) y O3.
2. Antes de la primera venta: P1, A1, L1 (arrepentimiento + datos del proveedor + privacidad), O1, C5, P5/C10.
3. Primeras semanas con datos reales: C1, C2, C6, P2, P3, SEO básico, reportes.

El detalle por fase está en [roadmap-funcionalidades.md](roadmap-funcionalidades.md).

## Fuentes (consultadas el 2026-10-23)

- Resolución SCI 424/2020, texto oficial: https://www.argentina.gob.ar/normativa/nacional/norma-342869/texto
- Resolución 270/2020 (Res. GMC 37/19): https://www.argentina.gob.ar/normativa/nacional/norma-341933/texto · https://servicios.infoleg.gob.ar/infolegInternet/anexos/340000-344999/341933/norma.htm
- Ley 24.240 art. 34 (comentario): https://www.marval.com/Publicacion/en-los-contratos-electronicos-el-consumidor-tiene-la-facultad-de-revocarlo-por-la-misma-via-12734
- DNU 274/2019 (lealtad comercial): https://www.consejosalta.org.ar/wp-content/uploads/DECRETO-274.pdf · https://www.marval.com/publicacion/nuevo-regimen-de-lealtad-comercial-en-la-argentina-13349
- AAIP, obligaciones de responsables de bases: https://www.argentina.gob.ar/node/53779 · inscripción por TAD: https://www.argentina.gob.ar/sites/default/files/instructivo_tad_inscripcionymodificacion_basesprivadas_3.pdf
- Ley 23.737: https://sherloc.unodc.org/cld/uploads/res/document/ley-23737-regimen-penal-de-estupefacientes_html/Ley_23737_regimen-penal-de-estupefacientes.pdf
- Data Fiscal (guía de terceros): https://ayuda.tiendanube.com/arca/como-agregar-el-codigo-de-data-fiscal-de-arca
- Supabase backups: https://supabase.com/docs/guides/platform/backups · Database Webhooks: https://supabase.com/docs/guides/database/webhooks

# Informe de auditoría — fase 1

**Fecha:** 24 de octubre de 2026  
**Alcance:** commits 716167f..438c463 (inclusive). Auditoría local de solo lectura; el estado de producción se toma del contexto provisto.

## 1. Resumen ejecutivo

La fase incorpora correctamente el snapshot de variantes, una RPC transaccional protegida por RLS, optimización de imágenes, paginación y textos legales dinámicos.  
npm run typecheck, npm run build:client y npm run build:admin terminan correctamente; el build del admin advierte un chunk de 1,28 MB.  
No encontré una vulnerabilidad que permita a un cliente no admin guardar productos mediante guardar_producto.  
Antes de desplegar, conviene resolver la compatibilidad temporal de teléfonos y evitar productos marcados con variantes pero sin opciones.  
La paginación puede mezclar resultados cuando cambian filtros durante una carga; el modal de confirmación también puede mostrar un total distinto al que la base registra.  
La reserva depende de que el comprador envíe el WhatsApp; el aviso automático al dueño (tarea 1.7) sigue fuera de alcance.  
Los textos de privacidad son borradores: necesitan un proceso real para solicitudes de supresión y una descripción más concreta de proveedores y retención.  
No consulté producción ni verifiqué Vercel, Supabase, Resend o dispositivos móviles.

## 2. Hallazgos

### Severidad alta

No encontré hallazgos confirmados de severidad alta en el código local revisado.

### Severidad media

#### 1. La RPC permite guardar un producto con variantes pero sin ninguna opción

- **Tipo:** error.
- **Archivo y línea:** admin/src/components/ProductForm.tsx:151-153, 232-247; shared/rpc.sql:222-223, 256-293.
- **Qué pasa:** si el administrador activa “Tiene variantes” y guarda sin agregar opciones, el formulario envía un array vacío. La RPC acepta el array vacío, elimina las variantes existentes del producto y lo deja con tiene_variantes = true. La tienda entonces no puede ofrecer ninguna variante ni agregar ese producto a una reserva.
- **Recomendación:** rechazar el guardado cuando tiene_variantes sea verdadero y no haya al menos una variante, tanto en el formulario como en la RPC.

#### 2. El despliegue deja una ventana con enlaces de WhatsApp incorrectos y sesiones viejas incompatibles

- **Tipo:** riesgo.
- **Archivo y línea:** client/src/pages/ResumePage.tsx:49, 152; client/src/components/layout/HeaderNav.tsx:99; client/src/components/layout/WhatsappFloatButton.tsx:15; shared/src/utils/telefono.ts:10, 38-47, 68-70; shared/migraciones/2026-10-23-telefonos-normalizados.sql:6-14, 99-101.
- **Qué pasa:** la nueva página de checkout acepta el teléfono del local solo si ya tiene formato 549…; los enlaces del encabezado simplemente quitan signos y no agregan el prefijo. Entre el deploy y la migración, un teléfono del local que aún esté en el formato anterior no abrirá WhatsApp correctamente y checkout caerá en el camino “sin teléfono válido”. Después de migrar, una pestaña antigua que siga enviando el teléfono del comprador con 10 dígitos será rechazada por la RPC estricta. El CHECK de clientes permite todavía teléfonos de 8 a 15 dígitos, así que una sesión vieja también podría crear un perfil no normalizado.
- **Recomendación:** mantener compatibilidad temporal con ambos formatos en los enlaces y en la RPC, normalizando a 549… al guardar; retirar esa compatibilidad después de confirmar que las dos apps están desplegadas y las sesiones viejas ya no operan. Si no se agrega esa transición, limitar el intervalo entre deploy y migración y considerar que las pestañas abiertas siguen siendo clientes viejos.

#### 3. Cambiar un filtro mientras carga “Ver más” puede mezclar productos

- **Tipo:** riesgo.
- **Archivo y línea:** client/src/pages/ProductsPage.tsx:61-109, 170-181.
- **Qué pasa:** las consultas no tienen cancelación ni identificador de petición. Si se cambia búsqueda, categoría o panel mientras carga la página siguiente, una respuesta anterior puede sobrescribir el resultado nuevo o agregarse a él. Además, range usa offset: si se inserta o elimina un producto entre páginas, el desplazamiento puede repetir u omitir una fila aunque el orden por fecha e id sea estable.
- **Recomendación:** asociar cada carga a los filtros vigentes y descartar respuestas obsoletas; deduplicar por id. Si el catálogo puede cambiar mientras se pagina, usar paginación por cursor o congelar el conjunto durante esa sesión.

#### 4. El total que se confirma puede diferir del que guarda la base

- **Tipo:** riesgo.
- **Archivo y línea:** client/src/components/common/ConfirmarPedidoModal.tsx:74-95; client/src/pages/ResumePage.tsx:147-180, 473; shared/rpc.sql:90-145; client/src/pages/TerminosCondicionesPage.tsx:47-52.
- **Qué pasa:** el modal muestra el total y subtotales guardados en el carrito. La RPC vuelve a leer los precios actuales del catálogo y guarda ese total; el mensaje de WhatsApp usa el valor devuelto por la base. Si un precio cambia después de agregar el producto al carrito, la persona confirma un monto y recibe una reserva con otro. Los Términos dicen que se respeta el precio al hacer la reserva.
- **Recomendación:** recalcular y mostrar los precios del servidor antes de la confirmación final, o detener el flujo y pedir una nueva aceptación si el total cambió.

#### 5. El aviso al dueño depende de que el comprador envíe el mensaje

- **Tipo:** riesgo operativo; la notificación automática de la tarea 1.7 está explícitamente fuera del alcance de esta fase.
- **Archivo y línea:** client/src/pages/ResumePage.tsx:218-235; tarea 1.7 de docs/auditoria/guia-auditoria-decisiones-2026-10.pdf, p. 31.
- **Qué pasa:** con teléfono local válido, se prepara WhatsApp, pero el comprador todavía debe enviarlo. Si no lo hace, la reserva queda guardada sin un aviso al dueño. Si falta un teléfono local válido, la pantalla dice “Te vamos a contactar a la brevedad”, aunque no hay un aviso automático al dueño que inicie ese contacto.
- **Recomendación:** mientras 1.7 siga pendiente, hacer explícito que el comprador debe enviar el mensaje y evitar prometer contacto cuando no existe un canal operativo. Antes de ofrecer el flujo como automático, implementar y verificar el aviso al dueño.

### Severidad baja

#### 6. La ficha no aplica el respaldo de imagen al agregar al carrito

- **Tipo:** error de presentación.
- **Archivo y línea:** client/src/pages/ProductDetailPage.tsx:91, 101.
- **Qué pasa:** al agregar desde la ficha se guarda solo imagen_miniatura_url. Esa columna es nullable y la migración deja en NULL las imágenes antiguas o no generadas. En ese caso el carrito muestra el placeholder aunque imagen_url tenga una imagen grande. Catálogo, búsqueda y Mi Cuenta sí usan el respaldo.
- **Recomendación:** pasar imagen_miniatura_url ?? imagen_url al carrito en ambos caminos.

#### 7. La validación del teléfono comprueba largo, no que el código de área exista

- **Tipo:** mejora.
- **Archivo y línea:** shared/src/utils/telefono.ts:19-47; shared/migraciones/2026-10-23-telefonos-normalizados.sql:22-40.
- **Qué pasa:** la lista de códigos cortos se usa para separar el número al editarlo, pero armarTelefonoAR acepta cualquier código de 2 a 4 dígitos si la suma da 10. Por eso valores como 1231231231, mencionados en la vista previa provista, pueden normalizarse a 549… aunque no sean números válidos. No verifiqué la lista completa contra la fuente oficial de ENACOM.
- **Recomendación:** sí vale la pena validar el código de área contra una lista mantenida desde una fuente autorizada y mostrar un error claro. Mantener aparte el tratamiento de datos históricos inválidos: no convertirlos en teléfonos “válidos” solo porque tienen 10 dígitos.

#### 8. La política de privacidad promete una gestión de supresión que no está operativizada

- **Tipo:** mejora; revisar con el dueño antes de publicar el texto definitivo.
- **Archivo y línea:** client/src/pages/PoliticaPrivacidadPage.tsx:57-86; shared/rls.sql:374-395.
- **Qué pasa:** la política dice que después los datos “los borramos o anonimizamos” y permite pedir su eliminación, pero no hay una opción de baja/anonimización en el panel ni una policy de borrado de perfiles. La tienda podría atenderlo manualmente, pero el procedimiento y el plazo no están definidos en el sistema. Además, identifica proveedores solo como “proveedores de servicios en la nube” y no da un período concreto de retención, aunque la guía §15.4 pide completar esos datos.
- **Recomendación:** definir un proceso manual verificable para solicitudes de supresión, la retención de reservas y perfiles, y nombrar los proveedores y transferencias pertinentes al personalizar cada instancia.

#### 9. El borrado de imágenes confía en una coincidencia de ruta, no en el origen de la URL

- **Tipo:** riesgo de baja probabilidad.
- **Archivo y línea:** shared/src/utils/rutaEnBucket.ts:7-13; admin/src/components/ProductForm.tsx:26-31, 165-170; admin/src/pages/ProductsPage.tsx:187-199.
- **Qué pasa:** la función busca la marca de ruta del bucket en cualquier parte de la URL y no valida el host. Si una URL guardada viniera de otro dominio pero contuviera esa ruta, el admin intentaría borrar esa ruta del bucket actual. En el flujo normal, las URLs las genera Supabase; si falla la limpieza, el archivo queda huérfano y el error solo se registra en consola.
- **Recomendación:** analizar la URL y confirmar que su origen coincide con el proyecto Supabase actual antes de borrar. Para fallos de limpieza, registrar una señal visible o una cola de reintento.

#### 10. guardar_producto no rechaza ids repetidos y conserva variantes al pasar a producto simple

- **Tipo:** mejora.
- **Archivo y línea:** shared/rpc.sql:255-293; admin/src/components/ProductForm.tsx:205.
- **Qué pasa:** si el array repite un id existente, la RPC actualiza la misma variante varias veces y gana el último valor; no crea dos filas con ese id, pero acepta silenciosamente el payload duplicado. Cuando tiene_variantes pasa a falso, la rama de sincronización no corre y quedan filas de variantes asociadas a un producto simple. El formulario las oculta, pero quedan datos obsoletos.
- **Recomendación:** rechazar ids repetidos y decidir explícitamente qué hacer al pasar a producto simple. Si se eliminan las variantes, el snapshot de nombre de los items históricos mantiene su información.

#### 11. Los errores de teléfono no están asociados a los campos para lectores de pantalla

- **Tipo:** mejora de accesibilidad.
- **Archivo y línea:** client/src/components/common/CampoTelefono.tsx:26-56.
- **Qué pasa:** ambos inputs tienen aria-label, pero el mensaje de error no tiene id relacionado mediante aria-describedby y los campos no exponen aria-invalid. La indicación es visible, pero un lector de pantalla puede no asociarla a los campos.
- **Recomendación:** asignar id al error y conectar ambos inputs con aria-describedby y aria-invalid.

## 3. Revisión del plan de despliegue

El orden “push → esperar Vercel → migración de teléfonos” tiene una razón válida: evita que la RPC nueva rechace los formularios viejos que todavía mandan 10 dígitos. No lo consideraría completamente seguro sin resolver la transición descrita en el hallazgo 2. El teléfono del local y los links de WhatsApp también deben tolerar el valor antiguo durante ese intervalo, y “esperar Vercel” debe significar confirmar el deploy exitoso de client y admin, no solo que se inició.

La migración está dentro de BEGIN/COMMIT; si se ejecuta entera y falla, el DISABLE TRIGGER también revierte. DISABLE/ENABLE afecta solo al trigger de timestamp, no al de transición de estado. Aun así, ALTER TABLE requiere un lock exclusivo y el UPDATE puede bloquear escrituras durante la transacción: conviene correrla con poco tráfico. ENABLE TRIGGER lo deja habilitado sin importar su estado anterior, así que hay que confirmar que estuviera habilitado antes.

Tras migrar, revisar el resultado de teléfonos no normalizados. El contexto indica que quedan 11649865 y sesdfsdf; no deben ofrecer links de WhatsApp funcionales y conviene decidir si se conservan como reservas de prueba o se corrigen manualmente. La lógica actual normaliza por largo y no valida códigos de área.

El admin publicado previo a la fase todavía sincroniza variantes borrando y recreando filas. El snapshot de nombre_variante preserva el dato en la base, pero el admin viejo consulta la relación viva (versión base 716167f, admin/src/pages/OrdersPage.tsx:179) y no lee el snapshot; hasta que se despliegue el nuevo admin, después de editar variantes puede mostrar el nombre como vacío. La migración de snapshot no pierde ese dato, pero conviene evitar editar productos con variantes desde el admin viejo durante la transición.

Según el estado provisto, la Edge Function ya está desplegada con los textos y el snapshot de esta fase. La migración de teléfonos no requiere cambiarla. El paso “Edge Function” es una verificación de versión, no un redeploy obligatorio; si el código desplegado no coincide con el commit, asegurar primero que ya existan la columna nombre_variante y sus datos.

## 4. Lo que no pude verificar

- No consulté la base, las funciones, políticas, datos o logs de producción ni los dashboards de Supabase, Vercel o Resend, por la restricción indicada. El estado de producción del informe proviene del contexto del pedido.
- No ejecuté SQL ni comprobé las migraciones contra un PostgreSQL local; su idempotencia y permisos se evaluaron leyendo los scripts. El estado de triggers previo a la migración tampoco se puede confirmar desde el repo.
- No probé el flujo en iOS Safari, Android Chrome ni visualmente a 375, 1000 o 1366 px. La revisión responsive es estática.
- No verifiqué la lista de códigos de área contra ENACOM ni probé números reales.
- No hice pruebas manuales de upload/eliminación con HEIC, archivos de resolución extrema o un navegador sin encoder WebP. El código sí tiene fallback a JPEG cuando WebP no está disponible; createImageBitmap puede fallar en HEIC y el formulario informa el error.
- No verifiqué el envío real de emails ni el comportamiento de Resend, las versiones efectivamente desplegadas, las miniaturas creadas en producción ni la vista previa de teléfonos; tomo esos datos del contexto.
- La guía legal es orientación general, no asesoramiento legal. El texto definitivo debe revisarse con el titular y su asesor.

## 5. Opinión general sobre la implementación

La decisión técnica de guardar productos, variantes y categorías en una RPC transaccional es adecuada. SECURITY INVOKER, el chequeo de is_admin() y las políticas RLS forman una defensa coherente; la variante ajena al producto se rechaza y un usuario autenticado no admin no puede escribir. La columna de snapshot permite conservar el nombre de una variante cuando su fila se elimina, y las migraciones de columnas son aditivas e idempotentes en el flujo normal. La carga de dos tamaños, el cache-control con nombre único y las columnas mínimas de catálogo también son decisiones acertadas.

Yo endurecería primero el borde de entrada: cantidad mínima de variantes, duplicados, teléfonos realmente válidos y compatibilidad temporal de datos. Para paginar, descartaría respuestas obsoletas y usaría un cursor si el catálogo cambia con frecuencia. Mantendría explícito que la reserva se confirma con el precio que el servidor vuelve a leer, para que la persona no acepte otro monto sin verlo.

En legal, no discuto el modelo de reserva; sí dejaría los textos como borrador hasta completar el responsable, retención y procedimiento de derechos. La guía §5.2 fundamenta “Datos protegidos” también en backups cifrados, mientras que la tarea 1.12 y esos backups no están implementados. La etiqueta no promete backups de forma explícita, pero esa parte de su fundamento debe revisarse con el dueño. También conviene nombrar proveedores y precisar qué significa “borrar o anonimizar”.

El client y admin siguen aislados, shared/ permanece sin React, las reseñas son genéricas según la excepción acordada y no encontré colores hardcodeados en los CSS Modules revisados. No vi duplicación o imports sin uso que bloqueen la compilación; la auditoría no incluyó un linter. El build del admin pasa, pero conserva el chunk grande (1,28 MB), que sería una mejora de carga separable de esta fase.

## 6. Seguimiento (agregado el 24/10/2026, no forma parte del informe original)

| Hallazgo | Estado |
|---|---|
| 1. Producto con variantes sin ninguna | Corregido en `5753526` (formulario y `guardar_producto`); migración aplicada y probada |
| 2. Ventana de despliegue de teléfonos | Corregido en `5753526`: `crear_pedido_completo` acepta 10 dígitos y los completa con `549` (dentro de la migración de teléfonos, todavía no aplicada) |
| 3. "Ver más" mezcla resultados al cambiar filtros | Corregido en `5753526`; probado |
| 4. Total del modal distinto del de la base | Pendiente: tarea 2.1 de la fase 2 |
| 5. Aviso al dueño depende del comprador | Pendiente: tarea 1.7 |
| 6. Imagen de la ficha al carrito | No aplica: el mapper ya resuelve la miniatura con respaldo a la grande |
| 7. Validar códigos de área | Pendiente, sin decidir: requiere la lista oficial completa de ENACOM |
| 8. Proceso de supresión y retención en la privacidad | Pendiente: revisión de los textos legales y tarea 2.6 |
| 9. Borrado de imágenes sin validar el origen | Corregido en `5753526` (`rutaEnBucket` exige `SUPABASE_URL`); probado |
| 10. Ids repetidos y variantes al pasar a simple | Corregido en `5753526`; migración aplicada y probada |
| 11. Accesibilidad del error de teléfono | Corregido en `5753526`; probado |

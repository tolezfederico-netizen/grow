# Auditoría de la fase 1 — instrucciones para un agente revisor (Codex)

> Este documento es el pedido completo. Leelo entero antes de empezar.

## Tu rol

Sos un revisor externo. Otro agente (Claude Code) implementó, junto con el dueño del proyecto, las tareas de la **fase 1** del plan de trabajo. Tu trabajo es **auditar lo hecho**: encontrar errores, riesgos, inconsistencias y oportunidades de mejora, y dar tu opinión fundada sobre si las decisiones de implementación fueron adecuadas.

**Reglas:**

- **Solo lectura.** La única excepción es el informe final, que guardás en `docs/auditoria/informe-auditoria-codex-fase1.md` (es el único archivo que podés crear). No modifiques código, no hagas commits, no corras migraciones ni nada contra la base de producción ni contra Supabase, Vercel o Resend. Si querés probar algo, que sea local y sin efectos (por ejemplo `npm run typecheck`, `npm run build:client`, `npm run build:admin`).
- **Las decisiones de producto ya están tomadas** (sección 5 de la guía). No las discutas salvo que encuentres un hecho concreto que las contradiga; en ese caso, señalalo como "punto a revisar con el dueño", no como error.
- **Distinguí con claridad** entre: error (algo que no funciona o rompe una regla), riesgo (puede fallar en ciertas condiciones), mejora (funciona, pero se puede hacer mejor) y opinión (criterio discutible). Cada hallazgo con archivo y línea.
- Si algo no lo pudiste verificar (por ejemplo, porque depende de producción), decilo explícitamente.

## Qué leer primero (en este orden)

1. `CLAUDE.md` — reglas del proyecto (genericidad, aislamiento client/admin, `shared/` sin React, cambios de base solo incrementales, regeneración de tipos, etc.).
2. `docs/arquitectura/arquitectura-v13.md` — estado actual del sistema (ya actualizado con todo lo de esta fase).
3. `docs/auditoria/guia-auditoria-decisiones-2026-10.pdf` — secciones **5** (decisiones tomadas), **15** (orientación legal), **16** (plan de trabajo; la fase 1 son las tareas 1.1 a 1.13) y **17** (preguntas abiertas).
4. `docs/auditoria/auditoria-funcional-2026-10.md` — hallazgos que motivaron las tareas.

> Nota: trabajás directamente sobre la carpeta del proyecto. Algunos documentos de `docs/` y `CLAUDE.md` están sin commitear: leelos tal como están en la carpeta.

## Alcance: los commits a revisar

Todo lo que está entre `716167f` (exclusivo) y `438c463` (inclusive). Para ver el diff completo:

```bash
git log --format="%h %s" 716167f..438c463
git diff 716167f..438c463
```

| Commit | Tarea | Resumen |
|---|---|---|
| `498ac85` | 1.1 | Reseñas de ejemplo genéricas y avatares SVG ilustrados (`AvatarIlustrado`) que usan solo colores del tema |
| `3828b0d` | 1.2 | Se quita "Compra Protegida"; sello "Datos protegidos" en el checkout con link a la política de privacidad |
| `a8d6f8a` | 1.4 | RPC `guardar_producto` (SECURITY INVOKER) que guarda producto, variantes por id y categorías en una transacción; `pedido_items.nombre_variante` como snapshot |
| `f370d7d` | 1.10 | Términos reescritos con el modelo de reserva, página `/politica-de-privacidad`, `PaginaLegal`, datos legales del proveedor (`razon_social`, `cuit`, `domicilio_legal`) |
| `8928bc6` | 1.13 | CHECK de `clientes` y límites del bucket llevados a `shared/*.sql`; keep-alive que consulta una tabla |
| `7872ddf` | 1.8 | Compresión WebP en el admin (1000 px y 400 px), `imagen_miniatura_url`, caché de un año, borrado de imágenes huérfanas |
| `07de6f0` | 1.9 | Paginación del catálogo (24 por página), columnas justas, miniaturas y lazy loading, caché compartida de hooks, logo WebP |
| `d6ea189` | 1.3 | Lenguaje de "reserva" en tienda, admin, WhatsApp y emails; etiquetas de estado Nueva/Confirmada/Lista para retirar/Retirada/Cancelada |
| `438c463` | 1.5 + 1.6 | Teléfonos `549` + área + número en dos campos y normalización; WhatsApp del comprador al local con número de reserva y pantalla de éxito |

Tareas de la fase 1 que **no** se hicieron (fuera de alcance): 1.7 (email automático al dueño), 1.11 (Cloudflare Pages), 1.12 (backups). La pregunta 5 de la sección 17 (casilla "+18") quedó sin responder.

## Estado de producción (no lo cambies; tenelo en cuenta)

- **Migraciones aplicadas** en la base de producción: `shared/migraciones/2026-10-23-variantes-snapshot.sql`, `2026-10-23-datos-proveedor.sql` y `2026-10-23-imagen-miniatura.sql`.
- **Migración NO aplicada todavía:** `2026-10-23-telefonos-normalizados.sql`. Se va a correr **después** del push, porque la tienda publicada todavía manda teléfonos de 10 dígitos. Revisá especialmente si ese orden y el período de transición son seguros.
- **Código no desplegado:** ninguno de estos commits está pusheado; Vercel sigue sirviendo la versión anterior de la tienda y el admin. La base ya tiene los cambios de las tres migraciones aplicadas, así que conviene revisar la **compatibilidad entre el front viejo y la base nueva** (por ejemplo, el admin publicado todavía guarda productos borrando y recreando variantes, y no conoce `imagen_miniatura_url` ni `guardar_producto`).
- **Edge Function** `enviar-notificacion-pedido`: desplegada con todos los cambios de esta fase (textos de reserva de la 1.3, `nombre_variante` de la 1.4 y número de reserva en mayúsculas en el asunto de la 1.6).
- **Operaciones de datos hechas a mano:** se generaron las miniaturas de los 62 productos existentes desde el navegador con la misma función del admin; se crearon y borraron productos de prueba; se creó una reserva de prueba (`#8E79E3FD`), que quedó cancelada y con borrado lógico.
- `database.types.ts` se regeneró con el CLI de Supabase después de cada migración aplicada.
- **Vista previa de la migración de teléfonos** (`2026-10-23-telefonos-vista-previa.sql`, ya corrida en producción): casi todos los teléfonos son de 10 dígitos y se normalizan a `549…`; dos no se pueden normalizar (`11649865` y `sesdfsdf`, reservas de prueba viejas) y quedan como están; varios datos de prueba se normalizan aunque su código de área no existe (por ejemplo `1231231231` o `6262621515`), porque ni la migración ni los formularios validan el código de área contra el plan de numeración, solo su largo. Opiná si vale la pena validarlo.

## Qué revisar (checklist)

### General
- [ ] ¿Se respetan las reglas de `CLAUDE.md`? En particular: ningún dato de un negocio en el código, sin imports cruzados client/admin, `shared/` sin React ni hooks, colores solo por variables, CSS Modules.
- [ ] ¿`npm run typecheck`, `npm run build:client` y `npm run build:admin` pasan?
- [ ] ¿El código nuevo sigue el estilo del existente (nombres en español, comentarios, estructura)?
- [ ] ¿Quedó código muerto, imports sin usar o duplicación evitable?

### Base de datos y seguridad
- [ ] `guardar_producto` (`shared/rpc.sql`): es SECURITY INVOKER y confía en RLS. ¿Es correcto? ¿Hay forma de que un no-admin la use para algo indebido? ¿La sincronización por id cubre todos los casos (variante ajena, ids repetidos en el array, producto sin variantes que tenía variantes)?
- [ ] `crear_pedido_completo`: validación del teléfono `^549[0-9]{10}$`, snapshot de `nombre_variante`, mensajes. ¿Algún caso que rompa?
- [ ] Migraciones de `shared/migraciones/`: ¿son realmente idempotentes e incrementales? ¿El `BEGIN/COMMIT` y el `DISABLE/ENABLE TRIGGER` de la migración de teléfonos son seguros? ¿La función `pg_temp.normalizar_telefono_ar` normaliza bien (0, 15, 54 sin 9, números sin código de área)?
- [ ] ¿`schema.sql`, `rpc.sql` y `rls.sql` permiten crear una instancia nueva desde cero con todo lo de esta fase (orden `schema → rpc → rls`)? Por ejemplo: el bucket ahora se crea en `rls.sql` con `ON CONFLICT`; el CHECK de `clientes` está en el `CREATE TABLE`.
- [ ] Storage: el admin borra archivos con `rutaEnBucket`. ¿Puede llegar a borrar algo que no debería? ¿Qué pasa si falla a mitad de camino?

### Tienda (client)
- [ ] Caché compartida de `usePaneles`, `useConfiguracionTienda` y `useSucursales` (promesa a nivel de módulo). ¿Problemas con sesiones, reintentos, StrictMode o datos viejos?
- [ ] Paginación de `ProductsPage` con `range` y `count: 'exact'`. ¿Orden estable? ¿Qué pasa al cambiar filtros mientras se carga "Ver más"? ¿Se puede duplicar o perder un producto?
- [ ] Imágenes: miniatura con respaldo a la grande, `loading="lazy"`, `width/height`. ¿Algún lugar quedó sin cubrir o con layout roto?
- [ ] Checkout (`ResumePage`): la ventana de WhatsApp se abre durante el clic, antes de la RPC, y se redirige después. ¿Funciona en móviles (iOS Safari, Android Chrome)? ¿Queda una pestaña en blanco en algún caso? ¿Hay una alternativa mejor?
- [ ] `CampoTelefono` y `shared/src/utils/telefono.ts`: separación por códigos de área de 2 y 3 dígitos. ¿La lista de códigos es correcta y completa según el plan de numeración de ENACOM? ¿Algún número real argentino que se normalice mal?
- [ ] Páginas legales (`TerminosCondicionesPage`, `PoliticaPrivacidadPage`): ¿son coherentes con el modelo de reserva y con la sección 15 de la guía? ¿Prometen algo que el sistema no cumple (por ejemplo, backups que todavía no existen)? Son un borrador que el dueño va a revisar: marcá lo que convenga cambiar.
- [ ] Coherencia del lenguaje: ¿queda algún "pedido", "compra" o "pago" visible para el comprador o el dueño?

### Admin
- [ ] `ProductForm`: compresión (`admin/src/utils/comprimirImagen.ts`), subida, borrado de huérfanas y llamada a `guardar_producto`. ¿Manejo de errores correcto? ¿Qué pasa con imágenes muy grandes, HEIC o navegadores sin WebP?
- [ ] `SettingsPage`: datos legales y teléfono en dos campos. ¿Validaciones correctas? ¿El payload manda columnas que no existen?
- [ ] `OrdersPage` y `CustomersPage`: links de WhatsApp sin el `54` fijo, número de reserva visible.

### Accesibilidad y responsive
- [ ] Los componentes nuevos (`CampoTelefono`, `PaginaLegal`, `AvatarIlustrado`, sección "Datos legales", pantalla de éxito) a 375 px, ~1000 px y 1366 px; etiquetas y `aria-*`.

## Formato de la respuesta

Entregá un informe en Markdown con:

1. **Resumen ejecutivo** (5 a 10 líneas): estado general y los 3 a 5 puntos más importantes.
2. **Hallazgos**, ordenados por severidad (alta, media, baja). Para cada uno:
   - Tipo: error, riesgo, mejora u opinión.
   - Archivo y línea (o commit).
   - Qué pasa y en qué condiciones (un caso concreto si es posible).
   - Recomendación concreta.
3. **Revisión del plan de despliegue**: ¿es seguro el orden "push → esperar Vercel → migración de teléfonos → Edge Function"? ¿Falta algún paso?
4. **Lo que no pudiste verificar** y por qué.
5. **Opinión general** sobre las decisiones de implementación (no de producto): qué harías distinto y por qué.

Escribí el informe en español y guardalo en `docs/auditoria/informe-auditoria-codex-fase1.md`. Al terminar, respondé con el resumen ejecutivo y la ruta del archivo.

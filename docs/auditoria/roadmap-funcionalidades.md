# Roadmap de funcionalidades — 2026-10-23

Derivado de [auditoria-funcional-2026-10.md](auditoria-funcional-2026-10.md) (los códigos entre paréntesis remiten a sus hallazgos). Impacto y esfuerzo son relativos: **esfuerzo** S = horas, M = 1–3 días, L = una semana o más, para una persona que ya conoce el código.

Toda columna nueva sigue las reglas del proyecto: `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, regenerar `database.types.ts`, actualizar tipos y mappers de `shared/`, y trasladar el cambio a `shared/*.sql`.

## Estado del plan (al 24/10/2026)

El plan que se está ejecutando es el de la **sección 16 de [guia-auditoria-decisiones-2026-10.pdf](guia-auditoria-decisiones-2026-10.pdf)**, que reordenó y renumeró este roadmap después de las decisiones de su sección 5. El PDF es una foto al 23/10/2026 y no se edita: el avance se lleva acá. Las tablas de más abajo conservan la numeración original de este documento como referencia.

### Fase 1 (numeración del PDF)

| # | Tarea | Estado | Commit / nota |
|---|---|---|---|
| 1.1 | Reseñas de ejemplo genéricas | Hecha | `498ac85` |
| 1.2 | "Datos protegidos" | Hecha | `3828b0d` |
| 1.3 | Lenguaje de reserva | Hecha | `d6ea189` (etiquetas recomendadas en la pregunta 1 de la sección 17) |
| 1.4 | Variantes sin borrado + snapshot del nombre | Hecha | `a8d6f8a`, ajustes en `5753526`; migraciones aplicadas |
| 1.5 | Teléfonos normalizados | Hecha, **migración pendiente** | `438c463`, ajuste en `5753526`; correr `shared/migraciones/2026-10-23-telefonos-normalizados.sql` después del push (dos campos, pregunta 2) |
| 1.6 | Reserva con WhatsApp del comprador | Hecha | `438c463`; falta probar en un navegador común y en el celular que WhatsApp se abra solo |
| 1.7 | Email automático al dueño | **Pendiente** | Necesita dominio verificado en Resend |
| 1.8 | Pipeline de imágenes | Hecha | `7872ddf`; miniaturas de los 62 productos existentes generadas |
| 1.9 | Tienda liviana | Hecha | `07de6f0` |
| 1.10 | Términos y política de privacidad | Hecha, **textos en borrador** | `f370d7d`; el dueño revisa y redacta el texto definitivo |
| 1.11 | Migración a Cloudflare Pages | **Pendiente** | Necesita la cuenta de Cloudflare del dueño |
| 1.12 | Backups | **Pendiente** | Necesita R2, Drive y claves `age`; definir retención (pregunta 3) |
| 1.13 | SQL al día | Hecha | `8928bc6`; verificado contra producción |

Ninguno de estos commits está desplegado todavía: ver los pasos en `docs/arquitectura/arquitectura-v13.md` §12.1.

Preguntas abiertas de la sección 17: respondidas la 1 (etiquetas) y la 2 (teléfono en dos campos); pendientes la 3, 4, 5 ("+18"), 6, 7 y 8.

### Fases 2 y 3

Sin empezar. Para la fase 2, la tarea 2.1 (carrito persistente con re-precio y total de la base) resuelve además un hallazgo diferido de la auditoría externa de la fase 1 (`informe-auditoria-codex-fase1.md`, hallazgo 4).

## Fase 1 — Antes de vender

Lo que bloquea mostrar o entregar el producto sin riesgo para el dueño ni para el desarrollador.

| # | Funcionalidad / corrección | Impacto | Esfuerzo | Dependencias | Notas |
|---|---|---|---|---|---|
| 1.1 | Quitar o vaciar las reseñas fijas; dejar el componente listo para reseñas reales (R1) | Alto (legal y de confianza) | S | Decisión de producto | Opción posterior: tabla `resenas` editable o enlace al perfil de Google |
| 1.2 | Reemplazar "Compra Protegida" por mensajes verificables (R2) | Medio | S | — | Solo texto y CSS |
| 1.3 | Términos y condiciones por instancia + política de privacidad + datos del proveedor (razón social, CUIT, domicilio) en el footer (L1, L3) | Alto | M | Columnas nuevas en `configuracion_tienda`; textos revisados por un abogado | Sacar `www.growshop.com.ar` |
| 1.4 | Botón de arrepentimiento en la home: formulario sin registro, código de revocación y email (L1) | Alto (legal) | M | Tabla `solicitudes_arrepentimiento`, Edge Function de email, 1.6 | Barato y evita sanciones |
| 1.5 | Aviso al dueño de pedido nuevo: trigger/Database Webhook `AFTER INSERT` → Edge Function → email al dueño; realtime en `OrdersPage` (P1) | Muy alto | M | 1.6; email del dueño en `configuracion_tienda` | La función llamada por `pg_net` usa un secret propio, no JWT |
| 1.6 | Dominio propio en Resend, SMTP propio en Supabase, template en español, `RESEND_FROM` (O3) | Muy alto | S–M | Dominio por negocio | Ya pendiente en v13 §12 |
| 1.7 | Email "pedido recibido" al cliente con número, local, horario (C5) | Alto | S | 1.5, 1.6 | Reutiliza la Edge Function |
| 1.8 | Editar variantes sin borrarlas (upsert por id) y snapshot `nombre_variante` en `pedido_items` (A1, D7) | Alto | M | Migración + backfill desde `producto_variantes` | Hacerlo con RPC transaccional |
| 1.9 | Teléfono normalizado (área + número → `549…`) en checkout, registro, RPC y Configuración; probar links de WhatsApp reales (P5, C10) | Alto | M | — | Migrar los teléfonos existentes |
| 1.10 | Backup semanal de la base (GitHub Action con `pg_dump` cifrado) o plan Pro (O1) | Alto | S–M | Decisión de plan | Incluir Storage o documentar re-subida |
| 1.11 | Aviso +18 y revisión de contenido del rubro (L2) | Medio | S | Decisión de producto / legal | |
| 1.12 | Llevar `clientes_largos_check` y límites del bucket a `shared/*.sql` (D5, D6) | Medio | S | — | Para que la próxima instancia nazca igual que producción |

## Fase 2 — Primeras ventas

Lo que mejora la conversión y la operación cuando ya hay pedidos reales.

| # | Funcionalidad | Impacto | Esfuerzo | Dependencias | Notas |
|---|---|---|---|---|---|
| 2.1 | Carrito persistente en `localStorage` con re-precio al cargar; ficha en la misma pestaña (C1, C2) | Alto | S–M | — | Mostrar el total que devuelve la RPC |
| 2.2 | Sucursal de retiro + observaciones + fecha/franja de retiro opcional en el pedido | Alto | M | Columnas en `pedidos`, RPC, admin, emails | Hoy se coordina a mano por WhatsApp |
| 2.3 | Motivo de cancelación y aviso al cliente (P2) | Medio | S–M | 1.6 | Columna `motivo_cancelacion`; ampliar estados de la Edge Function |
| 2.4 | Recordatorio y vencimiento de pedidos no retirados (P3) | Medio | M | pg_cron, 1.6 | Días configurables |
| 2.5 | Recuperar contraseña y mensajes de login en español (C6) | Medio | S | 1.6 (SMTP) | Página `/recuperar` |
| 2.6 | Baja de cuenta y anonimización (L3) | Medio (legal) | M | RPC SECURITY DEFINER | Conservar pedidos sin datos personales |
| 2.7 | Pago por transferencia con comprobante / pago en el local explícito ([pasarela-de-pago.md](pasarela-de-pago.md) §6) | Alto | M | Alias/CBU en configuración, bucket privado | Antes que Mercado Pago |
| 2.8 | SEO básico: meta por ruta, Open Graph para compartir, `robots.txt`, `sitemap.xml` generado desde la base | Medio | M | Edge Function o función de Vercel para OG | Ver nota SEO abajo |
| 2.9 | Reportes: ventas por período, ticket promedio, productos más vendidos, cancelaciones | Medio | M | Vista o RPC agregada | Resuelve también P6 en el Dashboard |
| 2.10 | Búsqueda de pedidos por teléfono, email y número (P4) | Medio | S | — | |
| 2.11 | Horarios por día y por sucursal (C9) | Medio | M | `jsonb` de horarios | |
| 2.12 | Analytics sin cookies (Vercel Analytics, Plausible o similar) | Medio | S | Ajuste de CSP | Mencionarlo en la política de privacidad |
| 2.13 | Página de estado del pedido para invitados (`/pedido/:id` con token) | Medio | M | Columna `token_publico`, RPC de lectura | Base para la pasarela |
| 2.14 | Edición masiva de precios (porcentaje por categoría) | Alto para el dueño | M | RPC admin | Contexto inflacionario |

## Fase 3 — Escala

| # | Funcionalidad | Impacto | Esfuerzo | Dependencias | Notas |
|---|---|---|---|---|---|
| 3.1 | Mercado Pago Checkout Pro ([pasarela-de-pago.md](pasarela-de-pago.md)) | Alto si el rubro lo permite | L | 1.4, 2.13, 2.7; validación de rubro con MP | Riesgo de cuenta por parafernalia |
| 3.2 | Stock numérico opcional por producto/variante, descontado al confirmar | Medio | M–L | 1.8 | Útil con muchas ventas; hoy alcanza `sin_stock` |
| 3.3 | Varias imágenes por producto (tabla `producto_imagenes`) | Medio | M | Limpieza de huérfanas (A4) | |
| 3.4 | `sin_stock` para variantes (C7) | Medio | S | CHECK + RPC + client | |
| 3.5 | Paginación y agregados en SQL en Pedidos y Clientes (P6) | Medio | M | — | Necesario pasado ~1000 pedidos |
| 3.6 | Reseñas reales (tabla moderada por el admin o Google Place) | Medio | M | 1.1 | |
| 3.7 | Idempotencia del checkout (clave de intento) (C4) | Bajo | S | — | |
| 3.8 | Optimizaciones: logo comprimido, `exceljs` lazy, imágenes con tamaño (A5) | Bajo | S | — | |
| 3.9 | Simplificar paneles (modo "solo categorías") | Bajo | M | — | No invertir más en el modo avanzado |
| 3.10 | Etapa mobile del admin | Medio | M | — | Ya pendiente en v13 |

## Nota sobre SEO en una SPA de Vite

Sin SSR, Google indexa el contenido renderizado por JavaScript pero con menos garantías, y WhatsApp/Facebook **no ejecutan JavaScript**: al compartir una ficha se ve "Grow" sin foto. Opciones, de menor a mayor esfuerzo:

1. `index.html` con título, descripción y Open Graph genéricos de la tienda (requiere generar el HTML por instancia en el build o servirlo dinámico).
2. Una función de Vercel (o Edge Function) en `/producto/:id` que responda HTML con las meta del producto y cargue la SPA; los bots ven las meta y las personas la app.
3. Prerender de las rutas públicas en el build.

Para un growshop local pesa más la ficha de Google Business del local que el SEO del sitio; la opción 2 alcanza.

## Orden sugerido en una línea

1.1 → 1.2 → 1.6 → 1.5 → 1.7 → 1.8 → 1.9 → 1.3 → 1.4 → 1.10 → 1.11 → 1.12 → 2.1 → 2.7 → 2.2 → 2.3 → 2.5 → el resto de la fase 2 según lo que pidan los primeros clientes → fase 3.

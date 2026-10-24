# Pasarela de pago — análisis y plan de integración

Fecha de consulta de todas las fuentes: **2026-10-23**. Esto es un análisis previo: no se implementó nada. Lo legal y tributario es orientación, no asesoramiento.

## 1. Punto de partida

Hoy no hay cobro online: el pedido entra como `pendiente`, el dueño lo confirma, avisa por WhatsApp o email y el cliente paga al retirar ([arquitectura-v13.md](../arquitectura/arquitectura-v13.md) §1.1, §5.4). Piezas que una pasarela puede reutilizar:

- `crear_pedido_completo` ya calcula el total con precios del catálogo (`shared/rpc.sql:81-133`): el monto a cobrar sale de la base, nunca del navegador.
- La matriz de estados vive en un trigger (`shared/schema.sql:284-307`).
- Ya hay una Edge Function con verificación manual (`supabase/functions/enviar-notificacion-pedido/index.ts`, `verify_jwt = false` en `supabase/config.toml`).
- Cada negocio tiene su propia instancia de Supabase: el token del vendedor se guarda por instancia sin `tenant_id`.

Lo que falta: el comprador invitado **no puede leer su pedido** (`shared/rls.sql:145-160`, solo admin y dueño autenticado), así que hace falta un token público por pedido para que la página de retorno muestre el resultado.

## 2. ¿Conviene una pasarela? Riesgo del rubro

Antes de cualquier código: según notas de prensa que citan los Términos y Condiciones de Mercado Pago, entre los bienes prohibidos figuran "estupefacientes y sustancias prohibidas (incluyendo parafernalia y contenido que promueva el consumo de drogas)", con sanciones que van del bloqueo de la cuenta a la eliminación del usuario ([Canal26, 2025](https://www.canal26.com/general/2025/07/12/mercado-pago-podra-cerrar-cuentas-que-realicen-compras-prohibidas-que-productos-estan-vetados/)). No pude leer el texto oficial vigente en esta consulta. Un growshop vende sustratos, fertilizantes e iluminación (sin problema) pero también pipas, picadores, papelillos y bongs: **una parte del catálogo puede violar las reglas del procesador** y poner en riesgo la cuenta del negocio y la plata retenida.

Recomendación: (1) que cada dueño confirme por escrito con Mercado Pago (o el procesador elegido) que su rubro y catálogo están aceptados; (2) ofrecer la pasarela como **opcional** por instancia y, si se usa, poder marcar productos como "solo pago en el local"; (3) empezar por transferencia con comprobante (§6), que no depende de un tercero.

## 3. Mercado Pago: requisitos, comisiones y plazos

Según la [página oficial de Checkout de Mercado Pago Argentina](https://www.mercadopago.com.ar/herramientas-para-vender/check-out):

| Plazo de acreditación | Comisión |
|---|---|
| Al instante | 6,29 % + IVA |
| 10 días | 4,39 % + IVA |
| 18 días | 3,39 % + IVA |
| 35 días | 1,49 % + IVA |

- "Los costos pueden variar de acuerdo a los impuestos provinciales" (retenciones de IIBB e IVA según la condición fiscal del vendedor).
- Cuenta de Mercado Pago gratuita; el comprador no necesita cuenta. Para ofrecer 3 o 6 cuotas hay que activar "Cuota Simple" (con costo para el vendedor).
- Se paga solo por venta aprobada. El plazo se elige desde la cuenta del vendedor.
- Requisitos operativos: credenciales de producción de la aplicación (panel "Tus integraciones"), cuenta verificada a nombre del negocio, y facturar las ventas como cualquier venta (ARCA) — confirmar con el contador del negocio.

Fuentes de terceros coinciden con esos valores ([Shopify](https://www.shopify.com/es/blog/mercado-pago-metodos-de-pago)) y otras citan cifras distintas ([guiadebancos](https://www.guiadebancos.com/ar/blog/comisiones-mercado-pago-latam-2026)): **verificar en la cuenta del vendedor** antes de cotizar.

### Alternativas en Argentina

No relevé sus tarifas en esta consulta; todas requieren revisar su política de rubros igual que Mercado Pago.

- **MODO** (botón de pago de los bancos): costo por transacción en general menor; menor alcance que MP.
- **Payway** (ex Decidir, Prisma) y **Getnet** (Santander): adquirentes con API para tarjetas; más trámite comercial, mejor para volumen.
- **Ualá Bis**, **Naranja X**: links de pago y QR simples, sin API de webhooks tan madura.
- **Transferencia** (alias/CBU) con comprobante: sin comisión; ver §6.

Para el modelo de Grow (instancia por negocio, poca venta online al principio) Mercado Pago es el de menor fricción **si el rubro lo admite**.

## 4. Diseño de la integración con Mercado Pago (Checkout Pro)

Checkout Pro redirige al comprador a Mercado Pago, que cobra y vuelve a la tienda. No se manejan datos de tarjeta en Grow.

### 4.1 Flujo

```
Client /resumen ──rpc crear_pedido_completo(p_metodo_pago='mercadopago')──▶ pedido en 'pendiente_pago' + token_publico
     │
     └─▶ Edge Function mp-crear-preferencia (pedido_id, token_publico)
              lee pedido e items con service_role, crea preferencia en MP
              guarda mp_preference_id, devuelve init_point
     │
     └─▶ redirect a Mercado Pago ──▶ el comprador paga
                                       │
     MP ──POST──▶ Edge Function mp-webhook ── valida firma, consulta /v1/payments/{id},
                                               RPC registrar_pago_mp (idempotente)
                                               pendiente_pago → pendiente (pagado)
     │
     back_url ──▶ /pedido/:id?t=token  (lee estado por RPC; nunca confía en los query params de MP)
```

### 4.2 Base de datos (cambios incrementales)

```sql
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS metodo_pago text NOT NULL DEFAULT 'en_local'
  CHECK (metodo_pago IN ('en_local', 'transferencia', 'mercadopago'));
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS estado_pago text NOT NULL DEFAULT 'no_aplica'
  CHECK (estado_pago IN ('no_aplica', 'pendiente', 'aprobado', 'rechazado', 'reembolsado', 'en_revision'));
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS token_publico uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS mp_preference_id text;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS mp_payment_id text UNIQUE;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pagado_en timestamptz;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS monto_pagado numeric;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pago_expira_en timestamptz;

-- Registro de notificaciones: auditoría e idempotencia
CREATE TABLE IF NOT EXISTS pagos_eventos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor    text NOT NULL DEFAULT 'mercadopago',
  request_id   text UNIQUE,              -- x-request-id
  payment_id   text,
  pedido_id    uuid REFERENCES pedidos(id) ON DELETE SET NULL,
  estado       text,
  payload      jsonb NOT NULL,
  recibido_en  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE pagos_eventos ENABLE ROW LEVEL SECURITY;  -- sin policies: solo service_role
```

- El estado del pedido se amplía con **`pendiente_pago`** (agregarlo al CHECK `pedidos_estado_check`, a `ESTADOS_PEDIDO` en `shared/src/constants`, a los tipos, mappers, `formatEstadoPedido`, `iconoEstado` y los colores del admin).
- `validar_transicion_pedido` (`shared/schema.sql:284-301`) suma:
  - `pendiente_pago → pendiente` (pago aprobado; también podría ir directo a `confirmado` si el dueño lo prefiere — decisión de producto).
  - `pendiente_pago → cancelado` (rechazado, vencido o cancelado por el admin).
  - Restringir `pendiente_pago → pendiente` a la función de pago: chequear dentro del trigger que el pedido tenga `estado_pago = 'aprobado'` en `NEW`, así el admin no puede "aprobar" un pago a mano desde la tabla.
- `crear_pedido_completo` recibe `p_metodo_pago` (default `'en_local'`, compatible con el client actual); si es `mercadopago`, inserta con `estado = 'pendiente_pago'`, `estado_pago = 'pendiente'` y `pago_expira_en = now() + interval '30 minutes'`, y devuelve `token_publico`.
- RPC `registrar_pago_mp(p_pedido_id, p_payment_id, p_estado, p_monto)`: SECURITY DEFINER, `EXECUTE` solo para `service_role`. Bloquea la fila (`SELECT … FOR UPDATE`), ignora si `mp_payment_id` ya está registrado con el mismo estado, valida monto = `total`, y aplica la transición.
- RPC `estado_pedido_publico(p_id, p_token)` para la página de retorno: devuelve estado, total e items sin datos de contacto.
- pg_cron: cancela `pendiente_pago` vencidos (y libera el pedido). Si después llega un pago aprobado de un pedido ya cancelado, marcar `estado_pago = 'en_revision'` para que el dueño reembolse o reactive.
- Los pedidos `pendiente_pago` no deberían avisarle al dueño como pedido nuevo (P1 de la auditoría): avisar recién al pasar a `pendiente`.

### 4.3 Edge Function `mp-crear-preferencia`

- `verify_jwt = false`; recibe `pedido_id` y `token_publico`; la comparación del token es la autorización (el comprador puede ser invitado).
- Lee el pedido y sus items con la **service_role** (variable automática del runtime; hoy el proyecto no la usa en ningún lado — documentarlo como cambio de política).
- Rechaza si el pedido no está en `pendiente_pago` o venció.
- Crea la preferencia (`POST https://api.mercadopago.com/checkout/preferences`, o el SDK) con: `items` desde `pedido_items` (título, cantidad, `unit_price`, `currency_id: 'ARS'`), `external_reference = pedido_id`, `notification_url` = URL de `mp-webhook`, `back_urls` (success/failure/pending → `/pedido/:id?t=…`), `auto_return = 'approved'`, `expiration_date_to` = `pago_expira_en`, `payer.email`. La [guía de preferencias](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/create-payment-preference) indica crear una preferencia por pedido y guardar su `id`.
- Header `X-Idempotency-Key = pedido_id` para no duplicar la preferencia si el client reintenta.
- Guarda `mp_preference_id` y devuelve `init_point`.

### 4.4 Edge Function `mp-webhook`

Según la [documentación de notificaciones de Checkout Pro](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/payment-notifications):

- La firma llega en el header `x-signature` con formato `ts=…,v1=…`; el secreto se obtiene en "Tus integraciones → Webhooks → Configurar notificaciones". Los SDK oficiales validan con HMAC usando `x-signature`, `x-request-id`, el `data.id` del query string y el secreto.
- Hay que responder **200/201 dentro de 22 segundos**; si no, Mercado Pago reintenta (la página indica cada 15 minutos y un esquema que se extiende hasta 96 h).
- El evento relevante es `payment` (`action` `payment.created` / `payment.updated`); el detalle se obtiene con `GET /v1/payments/{id}`.

Pasos:

1. Leer `x-signature` y `x-request-id`; parsear `ts` y `v1`.
2. Armar el manifest y calcular HMAC-SHA256 hex con el secreto. El template que usan los SDK es `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` (con `data.id` en minúsculas si es alfanumérico). **La página consultada no publica el template literal** (está en la pestaña "sin SDK"); verificarlo contra la documentación vigente o el código del SDK oficial antes de implementar.
3. Comparar en tiempo constante; rechazar con 401 si no coincide o si `ts` es muy viejo (p. ej. > 5 min) para frenar replays.
4. Insertar en `pagos_eventos` con `request_id` UNIQUE: si ya existe, responder 200 sin procesar (idempotencia ante reintentos).
5. Responder rápido: si el procesamiento puede tardar, guardar el evento y procesarlo después (pg_cron o `EdgeRuntime.waitUntil`).
6. **Nunca confiar en el body**: consultar `GET /v1/payments/{id}` con `MP_ACCESS_TOKEN`, y validar `external_reference` = un pedido existente, `transaction_amount` = `total`, `currency_id = 'ARS'`, `status`.
7. Llamar a `registrar_pago_mp`. `approved` → pago aprobado; `rejected`/`cancelled` → `rechazado` (el pedido sigue en `pendiente_pago` hasta vencer, para que el comprador reintente); `refunded`/`charged_back` → `reembolsado` y aviso al dueño.
8. Las notificaciones pueden llegar fuera de orden o repetidas: la RPC solo avanza estados, nunca retrocede.

### 4.5 Client y admin

- Checkout: selector de método (en el local / transferencia / Mercado Pago, según lo que habilite el dueño en Configuración). Con MP, tras la RPC llamar a `mp-crear-preferencia` y redirigir a `init_point`.
- Nueva ruta pública `/pedido/:id` que consulta `estado_pedido_publico` (polling corto mientras esté `pendiente_pago`).
- CSP: con redirect no hace falta tocar `script-src`; `connect-src` solo va a Supabase. Si en el futuro se usa el Wallet Brick embebido, agregar `https://sdk.mercadopago.com` y los frames de MP. `Permissions-Policy: payment=()` no afecta un redirect.
- Admin: badge de estado de pago, filtro "pendiente de pago", link al pago en MP, acción "reembolsar" (vía otra Edge Function con `POST /v1/payments/{id}/refunds`) — necesaria para el botón de arrepentimiento con pago online.
- Emails: "pago recibido" al cliente y aviso al dueño.

### 4.6 Token por instancia y proceso de deploy

- Cada negocio crea **su propia** cuenta y aplicación en Mercado Pago (el dinero va directo al dueño; Grow no intermedia, coherente con el pago único y sin `tenant_id`).
- Secrets por instancia, solo del lado servidor:
  ```
  supabase secrets set MP_ACCESS_TOKEN=APP_USR-... MP_WEBHOOK_SECRET=... PUBLIC_SITE_URL=https://tienda...
  ```
  Nunca como `VITE_*` (quedarían en el JS público). La public key no es necesaria con Checkout Pro por redirect.
- Checklist de alta de instancia (agregar a v13 §1.3 y §11):
  1. El dueño crea la aplicación en "Tus integraciones" y genera credenciales de **prueba**; probar con usuarios de prueba.
  2. Configurar el webhook apuntando a `https://<proyecto>.supabase.co/functions/v1/mp-webhook`, evento `payment`, y copiar el secreto.
  3. `supabase secrets set …` y `supabase functions deploy mp-crear-preferencia mp-webhook` (con `verify_jwt = false` en `config.toml` para ambas).
  4. Pasar a credenciales de **producción** y repetir el `secrets set`; un pago real chico y su reembolso.
- Rotación: si el token se filtra, el dueño lo regenera en MP y se repite `secrets set` (sin redeploy del front). Documentar quién tiene acceso a la cuenta (el dueño) y que el desarrollador opera con credenciales que el dueño puede revocar.
- Alternativa a evaluar si Grow crece: OAuth de Mercado Pago (modelo marketplace) para no manipular tokens del dueño; no se justifica con el modelo actual.

### 4.7 Esfuerzo estimado

| Pieza | Esfuerzo |
|---|---|
| Migración SQL, estados, RPCs, cron | 1–2 días |
| Dos Edge Functions + pruebas con credenciales de test | 2–3 días |
| Client (selector, redirect, página de estado) | 1–2 días |
| Admin (estado de pago, filtro, reembolso) | 1–2 días |
| Documentación y checklist de deploy | 0,5 día |

Total: alrededor de **una a dos semanas**, después de resolver el riesgo de rubro (§2) y la página de estado del pedido (roadmap 2.13).

## 5. Implicancias legales al cobrar online

- Con cobro online la venta es claramente "a distancia": aplica el derecho de revocación del art. 34 de la Ley 24.240 y el botón de arrepentimiento de la [Res. SCI 424/2020](https://www.argentina.gob.ar/normativa/nacional/norma-342869/texto) — hay que poder devolver el dinero.
- Información del proveedor (razón social, CUIT, domicilio) exigida por la [Res. 270/2020](https://www.argentina.gob.ar/normativa/nacional/norma-341933/texto).
- Facturación electrónica de cada venta: lo maneja el negocio con su sistema actual; Grow no factura.

## 6. Alternativa sin pasarela: pago en el local o transferencia con comprobante

Recomendada como primer paso (roadmap 2.7): resuelve "señar" pedidos sin comisión ni riesgo de rubro.

- **Pago en el local** (lo que existe hoy): hacerlo explícito en el checkout y en los emails ("Pagás al retirar: efectivo, débito, crédito…", medios cargados en Configuración).
- **Transferencia**:
  - Configuración: `alias`, `cbu`, `titular` y `banco` en `configuracion_tienda`; flag para habilitarla.
  - Checkout: método `transferencia` → la RPC crea el pedido en `pendiente_pago` con `estado_pago = 'pendiente'`; la pantalla de éxito muestra alias, monto exacto y número de pedido (para la referencia de la transferencia).
  - Comprobante: subida opcional a un bucket **privado** `comprobantes` (PDF/JPG/PNG, 5 MB). Como el comprador puede ser invitado, la subida pasa por una Edge Function que valida `pedido_id + token_publico` y devuelve una signed upload URL; lectura solo para admins.
  - Admin: botón "Marcar pago recibido" (RPC que pone `estado_pago = 'aprobado'` y pasa a `pendiente` o `confirmado`), con vista del comprobante.
  - Vencimiento con pg_cron igual que MP (p. ej. 24 h) y aviso al cliente.
  - El dueño verifica la acreditación en su banco: no hay conciliación automática (es la limitación principal).
- Esfuerzo: 3–5 días; reutiliza las mismas columnas y el estado `pendiente_pago`, así que deja el terreno listo para Mercado Pago.

## Fuentes (consultadas el 2026-10-23)

- Mercado Pago, Checkout (costos y plazos): https://www.mercadopago.com.ar/herramientas-para-vender/check-out
- Mercado Pago, notificaciones de pago de Checkout Pro: https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/payment-notifications
- Mercado Pago, Webhooks (Checkout Pro): https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/notifications/webhooks
- Mercado Pago, crear preferencia: https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/create-payment-preference
- Bienes prohibidos (nota de prensa sobre los T&C de MP): https://www.canal26.com/general/2025/07/12/mercado-pago-podra-cerrar-cuentas-que-realicen-compras-prohibidas-que-productos-estan-vetados/
- Comisiones según terceros: https://www.shopify.com/es/blog/mercado-pago-metodos-de-pago · https://www.guiadebancos.com/ar/blog/comisiones-mercado-pago-latam-2026
- Supabase Database Webhooks / pg_net: https://supabase.com/docs/guides/database/webhooks · https://supabase.com/docs/guides/database/extensions/pg_net
- Res. SCI 424/2020: https://www.argentina.gob.ar/normativa/nacional/norma-342869/texto
- Res. 270/2020: https://www.argentina.gob.ar/normativa/nacional/norma-341933/texto

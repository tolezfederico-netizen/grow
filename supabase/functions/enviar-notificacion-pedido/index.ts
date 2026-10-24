import { createClient } from '@supabase/supabase-js'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
// Remitente por instancia; sin dominio propio en Resend, solo funciona el sandbox.
const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'onboarding@resend.dev'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

// Solo estos estados disparan notificación desde el admin.
const ESTADOS_NOTIFICABLES = ['confirmado', 'listo_para_retirar'] as const
type EstadoNotificable = typeof ESTADOS_NOTIFICABLES[number]

interface Payload {
  pedido_id: string
  estado: EstadoNotificable
}

interface ItemEmail {
  nombre_producto: string
  nombre_variante: string | null
  cantidad: number
  precio_unitario: number
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function responder(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatearPrecio(monto: number): string {
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(monto)
  } catch {
    const entero = Math.round(monto).toString()
    const conPuntos = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    return `$ ${conPuntos}`
  }
}

function esPayloadValido(body: unknown): body is Payload {
  if (typeof body !== 'object' || body === null) return false
  const b = body as Record<string, unknown>
  return (
    typeof b.pedido_id === 'string' &&
    /^[0-9a-f-]{36}$/i.test(b.pedido_id) &&
    (ESTADOS_NOTIFICABLES as readonly unknown[]).includes(b.estado)
  )
}

function armarHtmlEmail(datos: {
  clienteNombre: string
  nombreTienda: string
  estado: EstadoNotificable
  items: ItemEmail[]
  total: number
}): string {
  const saludo = datos.estado === 'confirmado'
    ? 'Tu reserva fue confirmada'
    : 'Tu reserva ya está lista para retirar'

  const cierre = datos.estado === 'confirmado'
    ? 'Te contactamos pronto para coordinar el retiro.'
    : 'Te esperamos en el local.'

  const itemsHtml = datos.items.map(i => {
    const nombreVariante = i.nombre_variante ? ` - ${escaparHtml(i.nombre_variante)}` : ''
    const subtotal = formatearPrecio(i.cantidad * i.precio_unitario)
    return `<tr><td style="padding: 4px 8px;">${i.cantidad}x</td><td style="padding: 4px 8px;">${escaparHtml(i.nombre_producto)}${nombreVariante}</td><td style="padding: 4px 8px; text-align: right;">${subtotal}</td></tr>`
  }).join('\n        ')

  return `
        <h2>Hola, ${escaparHtml(datos.clienteNombre)}</h2>
        <p><strong>${saludo}</strong></p>

        <table style="border-collapse: collapse; width: 100%; max-width: 400px;">
          <thead>
            <tr style="border-bottom: 1px solid #d1d5db;">
              <th style="padding: 4px 8px; text-align: left;">Cant</th>
              <th style="padding: 4px 8px; text-align: left;">Producto</th>
              <th style="padding: 4px 8px; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
        ${itemsHtml}
          </tbody>
          <tfoot>
            <tr style="border-top: 1px solid #d1d5db;">
              <td colspan="2" style="padding: 4px 8px; font-weight: 600;">Total</td>
              <td style="padding: 4px 8px; text-align: right; font-weight: 600;">${formatearPrecio(datos.total)}</td>
            </tr>
          </tfoot>
        </table>

        <p>${cierre}</p>
        <hr />
        <p style="color: #6b7280; font-size: 0.875rem;">${escaparHtml(datos.nombreTienda)} — Gracias por tu reserva</p>
      `
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return responder(405, { error: 'Method not allowed' })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return responder(401, { error: 'No autorizado' })
  }

  // Cliente con el token de quien llama: todas las lecturas pasan por RLS.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return responder(401, { error: 'Token inválido o expirado' })
  }

  // Cualquiera puede registrarse como cliente: estar logueado no alcanza.
  const { data: esAdmin, error: adminError } = await supabase.rpc('is_admin')
  if (adminError || esAdmin !== true) {
    return responder(403, { error: 'No autorizado' })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return responder(400, { error: 'Body inválido' })
  }

  if (!esPayloadValido(body)) {
    return responder(400, { error: 'Faltan campos requeridos' })
  }

  if (!RESEND_API_KEY) {
    return responder(500, { error: 'Resend no está configurado' })
  }

  // El contenido del email sale de la base, nunca del body.
  const [pedidoRes, itemsRes, configRes] = await Promise.all([
    supabase
      .from('pedidos')
      .select('id, cliente_nombre, cliente_email, estado, total')
      .eq('id', body.pedido_id)
      .maybeSingle(),
    supabase
      .from('pedido_items')
      .select('nombre_producto, nombre_variante, cantidad, precio_unitario')
      .eq('pedido_id', body.pedido_id),
    supabase
      .from('configuracion_tienda')
      .select('nombre_tienda')
      .maybeSingle(),
  ])

  if (pedidoRes.error || itemsRes.error) {
    console.error('[enviar-notificacion-pedido]', pedidoRes.error ?? itemsRes.error)
    return responder(500, { error: 'No se pudo leer el pedido' })
  }

  const pedido = pedidoRes.data
  if (!pedido) {
    return responder(404, { error: 'Pedido no encontrado' })
  }

  // El admin cambia el estado antes de notificar: si no coincide, no se envía.
  if (pedido.estado !== body.estado) {
    return responder(409, { error: 'El estado del pedido no coincide' })
  }

  const items: ItemEmail[] = (itemsRes.data ?? []).map(i => ({
    nombre_producto: i.nombre_producto,
    nombre_variante: i.nombre_variante ?? null,
    cantidad: i.cantidad,
    precio_unitario: Number(i.precio_unitario),
  }))

  const nombreTienda = configRes.data?.nombre_tienda ?? ''

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: nombreTienda ? `${nombreTienda} <${RESEND_FROM}>` : RESEND_FROM,
      to: [pedido.cliente_email],
      subject: `${body.estado === 'confirmado' ? 'Reserva confirmada' : 'Reserva lista para retirar'} — #${pedido.id.slice(0, 8).toUpperCase()}`,
      html: armarHtmlEmail({
        clienteNombre: pedido.cliente_nombre,
        nombreTienda,
        estado: body.estado,
        items,
        total: Number(pedido.total),
      }),
    }),
  })

  if (!res.ok) {
    console.error('[enviar-notificacion-pedido] Resend', res.status, await res.text())
    return responder(502, { success: false, error: 'El proveedor de email rechazó el envío' })
  }

  return responder(200, { success: true })
})

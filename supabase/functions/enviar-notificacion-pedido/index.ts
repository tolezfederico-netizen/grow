import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

interface PayloadItem {
  nombre_producto: string
  nombre_variante: string | null
  cantidad: number
  precio_unitario: number
}

interface Payload {
  cliente_email: string
  cliente_nombre: string
  pedido_id: string
  estado: string
  items: PayloadItem[]
  total: number
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

function armarHtmlEmail(body: Payload): string {
  const saludo = body.estado === 'confirmado'
    ? 'Tu pedido fue confirmado'
    : body.estado === 'listo_para_retirar'
    ? 'Tu pedido ya está listo para retirar'
    : `Tu pedido fue actualizado a "${body.estado}"`

  const cierre = body.estado === 'confirmado'
    ? 'Te contactamos pronto para coordinar el retiro.'
    : body.estado === 'listo_para_retirar'
    ? 'Te esperamos en el local.'
    : 'Gracias por tu compra.'

  const itemsHtml = body.items.map(i => {
    const nombreVariante = i.nombre_variante ? ` - ${i.nombre_variante}` : ''
    const subtotal = formatearPrecio(i.cantidad * i.precio_unitario)
    return `<tr><td style="padding: 4px 8px;">${i.cantidad}x</td><td style="padding: 4px 8px;">${i.nombre_producto}${nombreVariante}</td><td style="padding: 4px 8px; text-align: right;">${subtotal}</td></tr>`
  }).join('\n        ')

  return `
        <h2>Hola, ${body.cliente_nombre}</h2>
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
              <td style="padding: 4px 8px; text-align: right; font-weight: 600;">${formatearPrecio(body.total)}</td>
            </tr>
          </tfoot>
        </table>

        <p>${cierre}</p>
        <hr />
        <p style="color: #6b7280; font-size: 0.875rem;">Grow — Gracias por tu compra</p>
      `
}

serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Token inválido o expirado' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  let body: Payload
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Body inválido' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  if (!body.cliente_email || !body.cliente_nombre || !body.pedido_id || !body.estado) {
    return new Response(JSON.stringify({ error: 'Faltan campos requeridos' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  if (!Array.isArray(body.items) || body.items.length === 0 || typeof body.total !== 'number') {
    return new Response(JSON.stringify({ error: 'Faltan campos requeridos' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'Resend no está configurado' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to: [body.cliente_email],
      subject: `Pedido ${body.estado} — #${body.pedido_id.slice(0, 8)}`,
      html: armarHtmlEmail(body),
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    return new Response(JSON.stringify({ success: false, error: errText }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
})

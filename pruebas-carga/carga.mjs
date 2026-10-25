// Prueba de carga de la tienda contra una instancia de Supabase de PRUEBA.
//
// Simula usuarios que recorren la tienda como el client real (mismas consultas
// a PostgREST que hace cada página) y una parte de ellos reserva con la RPC
// crear_pedido_completo. Sin dependencias: Node 18+ (fetch nativo).
//
// Uso:  node pruebas-carga/carga.mjs --usuarios 50 --segundos 60 [--reservan 0.3] [--sin-pausas]
// Lee SUPABASE_URL y ANON_KEY de pruebas-carga/.env (no versionado).
// NUNCA apuntarlo a producción: crea reservas reales.

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = dirname(fileURLToPath(import.meta.url))

// ── Configuración ────────────────────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync(join(dir, '.env'), 'utf8')
    .split(/\r?\n/)
    .filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const URL_BASE = env.SUPABASE_URL
const KEY = env.ANON_KEY
if (!URL_BASE || !KEY) throw new Error('Faltan SUPABASE_URL o ANON_KEY en pruebas-carga/.env')
// Freno de seguridad: si coincide con la base que usa la tienda local, es producción
try {
  const urlTienda = readFileSync(join(dir, '..', 'client', '.env.local'), 'utf8').match(/VITE_SUPABASE_URL=(.+)/)?.[1].trim()
  if (urlTienda && urlTienda.replace(/\/$/, '') === URL_BASE.replace(/\/$/, '')) {
    throw new Error('SUPABASE_URL es la misma base que usa la tienda (producción): abortado')
  }
} catch (e) {
  if (e.code !== 'ENOENT') throw e
}

const args = process.argv.slice(2)
const arg = (nombre, def) => {
  const i = args.indexOf(`--${nombre}`)
  return i >= 0 ? Number(args[i + 1]) : def
}
const USUARIOS = arg('usuarios', 10)
const SEGUNDOS = arg('segundos', 60)
const RESERVAN = arg('reservan', 0.3)
const SIN_PAUSAS = args.includes('--sin-pausas')
const RAMPA_MS = Math.min(15000, SEGUNDOS * 250) // los usuarios entran escalonados

const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
const COLS_LISTA = 'id,nombre,descripcion,imagen_url,imagen_miniatura_url,tiene_variantes,precio_base,estado'
const COLS_PANELES =
  'id,titulo,descripcion,orden,estado,creado_en,paneles_categoria_items(id,panel_id,categoria_id,nombre_visible,orden,es_card,categorias(nombre),paneles_categoria_items_productos(producto_id,orden,productos(imagen_url,imagen_miniatura_url)))'

// ── Métricas ─────────────────────────────────────────────────────────────────
const metricas = new Map() // nombre → { tiempos: [], errores: 0, detalleErrores: Map }
let reservasOk = 0
let reservasFallidas = 0
let antiSpam = 0

function registrar(nombre, ms, ok, detalle) {
  if (!metricas.has(nombre)) metricas.set(nombre, { tiempos: [], errores: 0, detalleErrores: new Map() })
  const m = metricas.get(nombre)
  m.tiempos.push(ms)
  if (!ok) {
    m.errores++
    m.detalleErrores.set(detalle, (m.detalleErrores.get(detalle) ?? 0) + 1)
  }
}

async function pedir(nombre, ruta, opciones = {}) {
  const inicio = performance.now()
  try {
    const res = await fetch(`${URL_BASE}${ruta}`, { headers: HEADERS, ...opciones })
    const cuerpo = await res.text()
    const ms = performance.now() - inicio
    registrar(nombre, ms, res.ok, `HTTP ${res.status} ${cuerpo.slice(0, 120)}`)
    return { ok: res.ok, status: res.status, datos: res.ok && cuerpo ? JSON.parse(cuerpo) : cuerpo }
  } catch (e) {
    registrar(nombre, performance.now() - inicio, false, e.cause?.code ?? e.message)
    return { ok: false, status: 0, datos: null }
  }
}

const pausa = (min, max) =>
  SIN_PAUSAS ? Promise.resolve() : new Promise(r => setTimeout(r, min + Math.random() * (max - min)))
const azar = lista => lista[Math.floor(Math.random() * lista.length)]

async function variantesDe(productos) {
  const ids = productos.filter(p => p.tiene_variantes).map(p => p.id)
  if (ids.length === 0) return []
  const r = await pedir(
    'variantes (lista)',
    `/rest/v1/producto_variantes?select=id,producto_id,nombre_variante,precio,estado&producto_id=in.(${ids.join(',')})&estado=eq.disponible`,
  )
  return r.ok ? r.datos : []
}

// ── Recorrido de un usuario ──────────────────────────────────────────────────
// Base al azar por corrida (8 dígitos) + secuencia: cada reserva usa un número distinto
const TELEFONO_BASE = 10000000 + Math.floor(Math.random() * 40000000)
let telefonoSecuencia = 0

async function sesion() {
  // 1. Entra a la tienda (carga completa): datos comunes + destacados
  const [, , , destacados] = await Promise.all([
    pedir('sucursales', '/rest/v1/sucursales?select=*&order=orden.asc'),
    pedir('configuracion', '/rest/v1/configuracion_tienda?select=*'),
    pedir('paneles', `/rest/v1/paneles_categoria?select=${COLS_PANELES}&estado=eq.activo&order=orden.asc`),
    pedir(
      'destacados',
      `/rest/v1/productos?select=${COLS_LISTA}&destacado=eq.true&estado=in.(disponible,sin_stock)&order=creado_en.desc`,
    ),
  ])
  if (destacados.ok) await variantesDe(destacados.datos)
  await pausa(2000, 6000)

  // 2. Catálogo: primera página y, a veces, la segunda
  const paginas = Math.random() < 0.4 ? 2 : 1
  let catalogo = []
  for (let p = 0; p < paginas; p++) {
    const r = await pedir(
      'catalogo (24)',
      `/rest/v1/productos?select=${COLS_LISTA}&estado=in.(disponible,sin_stock)&order=creado_en.desc,id.asc&offset=${p * 24}&limit=24`,
    )
    if (r.ok) {
      catalogo = catalogo.concat(r.datos)
      await variantesDe(r.datos)
    }
    await pausa(2000, 5000)
  }
  const disponibles = catalogo.filter(p => p.estado === 'disponible')
  if (disponibles.length === 0) return

  // 3. Mira de 1 a 3 fichas
  const vistos = []
  const fichas = 1 + Math.floor(Math.random() * 3)
  for (let i = 0; i < fichas; i++) {
    const producto = azar(disponibles)
    const [ficha, vars] = await Promise.all([
      pedir('ficha producto', `/rest/v1/productos?select=*&id=eq.${producto.id}`),
      pedir('ficha variantes', `/rest/v1/producto_variantes?select=*&producto_id=eq.${producto.id}&estado=eq.disponible`),
    ])
    if (ficha.ok && vars.ok) vistos.push({ producto, variantes: vars.datos })
    await pausa(3000, 8000)
  }

  // 4. Una parte reserva lo que vio
  if (Math.random() >= RESERVAN || vistos.length === 0) return
  const items = vistos
    .filter(v => !v.producto.tiene_variantes || v.variantes.length > 0)
    .map(v => ({
      producto_id: v.producto.id,
      variante_id: v.producto.tiene_variantes ? azar(v.variantes).id : null,
      cantidad: 1 + Math.floor(Math.random() * 2),
    }))
  if (items.length === 0) return
  // Teléfono único por reserva (549 + 11 + 8 dígitos) para no chocar con el anti-spam
  const telefono = `54911${TELEFONO_BASE + telefonoSecuencia++}`
  const r = await pedir('reserva (RPC)', '/rest/v1/rpc/crear_pedido_completo', {
    method: 'POST',
    body: JSON.stringify({
      p_cliente_nombre: 'Prueba Carga',
      p_cliente_telefono: telefono,
      p_cliente_email: 'prueba.carga@example.com',
      p_items: items,
    }),
  })
  if (r.ok) reservasOk++
  else {
    reservasFallidas++
    if (String(r.datos).includes('Demasiadas reservas')) antiSpam++
  }
}

async function usuario(fin) {
  let sesiones = 0
  while (performance.now() < fin) {
    await sesion()
    sesiones++
  }
  return sesiones
}

// ── Ejecución ────────────────────────────────────────────────────────────────
const percentil = (ordenados, p) => ordenados[Math.min(ordenados.length - 1, Math.floor((p / 100) * ordenados.length))]

console.log(
  `Prueba: ${USUARIOS} usuarios simultáneos, ${SEGUNDOS} s${SIN_PAUSAS ? ', SIN pausas (estrés)' : ''}, reservan ${RESERVAN * 100}% → ${URL_BASE}`,
)
const inicio = performance.now()
const fin = inicio + SEGUNDOS * 1000
const usuarios = []
for (let i = 0; i < USUARIOS; i++) {
  usuarios.push(new Promise(r => setTimeout(r, (i / USUARIOS) * RAMPA_MS)).then(() => usuario(fin)))
}
const sesiones = (await Promise.all(usuarios)).reduce((a, b) => a + b, 0)
const duracion = (performance.now() - inicio) / 1000

const filas = []
let totalPedidos = 0
let totalErrores = 0
for (const [nombre, m] of metricas) {
  const t = [...m.tiempos].sort((a, b) => a - b)
  totalPedidos += t.length
  totalErrores += m.errores
  filas.push({
    consulta: nombre,
    pedidos: t.length,
    errores: m.errores,
    'p50 ms': Math.round(percentil(t, 50)),
    'p95 ms': Math.round(percentil(t, 95)),
    'p99 ms': Math.round(percentil(t, 99)),
    'max ms': Math.round(t[t.length - 1]),
  })
}
console.table(filas)
const resumen = {
  usuarios: USUARIOS,
  segundos: Math.round(duracion),
  sinPausas: SIN_PAUSAS,
  sesionesCompletas: sesiones,
  pedidosHttp: totalPedidos,
  pedidosPorSegundo: Math.round(totalPedidos / duracion),
  errores: totalErrores,
  reservasOk,
  reservasFallidas,
  reservasFrenadasPorAntiSpam: antiSpam,
}
console.log(resumen)
for (const [nombre, m] of metricas) {
  for (const [detalle, n] of m.detalleErrores) console.log(`  error en ${nombre} (${n}x): ${detalle}`)
}

mkdirSync(join(dir, 'resultados'), { recursive: true })
const archivo = join(dir, 'resultados', `${new Date().toISOString().replace(/[:.]/g, '-')}-${USUARIOS}u.json`)
writeFileSync(archivo, JSON.stringify({ resumen, filas }, null, 2))
console.log(`Resultados guardados en ${archivo}`)

// Compresión de imágenes de producto en el navegador, antes de subirlas.
// Redimensiona al lado mayor pedido (sin agrandar) y baja la calidad WebP de a
// pasos hasta entrar en el peso objetivo. Si el navegador no sabe generar WebP
// (toBlob devuelve PNG), usa JPEG con fondo blanco, que el bucket también acepta.

export interface ImagenComprimida {
  blob: Blob
  extension: 'webp' | 'jpg'
}

const CALIDADES = [0.85, 0.78, 0.7, 0.62, 0.55, 0.48, 0.4]

function aBlob(canvas: HTMLCanvasElement, tipo: string, calidad: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, tipo, calidad))
}

export async function comprimirImagen(
  archivo: Blob,
  opciones: { ladoMaxPx: number; pesoMaxKB: number },
): Promise<ImagenComprimida> {
  const bitmap = await createImageBitmap(archivo)
  const escala = Math.min(1, opciones.ladoMaxPx / Math.max(bitmap.width, bitmap.height))
  const ancho = Math.max(1, Math.round(bitmap.width * escala))
  const alto = Math.max(1, Math.round(bitmap.height * escala))

  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('El navegador no permite procesar imágenes.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, ancho, alto)
  bitmap.close()

  const prueba = await aBlob(canvas, 'image/webp', CALIDADES[0])
  const soportaWebp = prueba?.type === 'image/webp'
  const tipo = soportaWebp ? 'image/webp' : 'image/jpeg'

  if (!soportaWebp) {
    // JPEG no tiene transparencia: se pinta fondo blanco debajo de la imagen
    ctx.globalCompositeOperation = 'destination-over'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, ancho, alto)
  }

  const pesoMax = opciones.pesoMaxKB * 1024
  let mejor: Blob | null = soportaWebp ? prueba : null
  for (const calidad of CALIDADES) {
    const blob = calidad === CALIDADES[0] && mejor ? mejor : await aBlob(canvas, tipo, calidad)
    if (!blob) continue
    mejor = blob
    if (blob.size <= pesoMax) break
  }

  if (!mejor) throw new Error('No se pudo comprimir la imagen.')
  return { blob: mejor, extension: soportaWebp ? 'webp' : 'jpg' }
}

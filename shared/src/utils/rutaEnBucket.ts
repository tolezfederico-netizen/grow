/**
 * Devuelve la ruta de un archivo dentro de un bucket público de Supabase a
 * partir de su URL pública (`…/storage/v1/object/public/<bucket>/<ruta>`).
 * Devuelve null si la URL no pertenece a ese bucket, para no intentar borrar
 * archivos ajenos.
 */
export function rutaEnBucket(url: string | null | undefined, bucket: string): string | null {
  if (!url) return null
  const marca = `/storage/v1/object/public/${bucket}/`
  const i = url.indexOf(marca)
  if (i === -1) return null
  const ruta = url.slice(i + marca.length).split('?')[0]
  return ruta ? decodeURIComponent(ruta) : null
}

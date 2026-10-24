/**
 * Devuelve la ruta de un archivo dentro de un bucket público de Supabase a
 * partir de su URL pública (`<origen>/storage/v1/object/public/<bucket>/<ruta>`).
 * Devuelve null si la URL no empieza con la URL de Supabase de la instancia
 * (`origenPermitido`) más la ruta pública del bucket, para no intentar borrar
 * archivos de otro proyecto o de otro bucket.
 */
export function rutaEnBucket(
  url: string | null | undefined,
  bucket: string,
  origenPermitido: string,
): string | null {
  if (!url) return null
  const prefijo = `${origenPermitido.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/`
  if (!url.startsWith(prefijo)) return null
  const ruta = url.slice(prefijo.length).split(/[?#]/)[0]
  return ruta ? decodeURIComponent(ruta) : null
}

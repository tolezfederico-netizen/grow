/**
 * Teléfonos argentinos en formato internacional para WhatsApp:
 * 549 + código de área (sin 0) + número (sin 15) = 13 dígitos.
 * Ej: área 11, número 12345678 → 5491112345678.
 *
 * Se cargan en dos campos (código de área y número) para evitar los errores
 * del 0 y el 15; si la persona los escribe igual, se quitan solos.
 */

export const TELEFONO_AR_REGEX = /^549\d{10}$/

/** Mensaje común para un teléfono mal cargado. */
export const TELEFONO_AR_AYUDA = 'Código de área sin 0 y número sin 15 (ej: 11 y 12345678).'

/**
 * Códigos de área de 2 y 3 dígitos (plan de numeración de ENACOM); el resto
 * son de 4. Como ningún código es prefijo de otro, alcanza para separar un
 * número guardado en sus dos campos. Si faltara alguno, el número igual es
 * válido: solo se mostraría partido distinto al editarlo.
 */
const CODIGOS_AREA_CORTOS = [
  '11',
  '220', '221', '223', '230', '236', '237', '249', '260', '261', '263', '264',
  '266', '280', '291', '294', '297', '298', '299', '336', '341', '342', '343',
  '345', '348', '351', '353', '358', '362', '364', '370', '376', '379', '380',
  '381', '383', '385', '387', '388',
]

export function esTelefonoAR(telefono: string | null | undefined): boolean {
  return !!telefono && TELEFONO_AR_REGEX.test(telefono)
}

/**
 * Arma el teléfono normalizado a partir de los dos campos. Quita lo que no sea
 * dígito, el 0 del área y el 15 del número. Devuelve null si no suma 10 dígitos
 * o el área no tiene entre 2 y 4.
 */
export function armarTelefonoAR(area: string, numero: string): string | null {
  const a = area.replace(/\D/g, '').replace(/^0+/, '')
  let n = numero.replace(/\D/g, '')
  if (n.startsWith('15') && a.length + n.length === 12) n = n.slice(2)
  if (a.length < 2 || a.length > 4 || a.length + n.length !== 10) return null
  return `549${a}${n}`
}

/** Separa un teléfono guardado en código de área y número, para editarlo. */
export function separarTelefonoAR(telefono: string | null | undefined): { area: string; numero: string } {
  // También acepta el formato anterior a la normalización (área + número, 10 dígitos)
  const digitos = (telefono ?? '').replace(/\D/g, '')
  const normalizado = /^\d{10}$/.test(digitos) && !digitos.startsWith('15') ? `549${digitos}` : digitos
  if (!esTelefonoAR(normalizado)) return { area: '', numero: '' }
  const resto = normalizado.slice(3)
  const corto = CODIGOS_AREA_CORTOS.find(c => resto.startsWith(c))
  const largo = corto ? corto.length : 4
  return { area: resto.slice(0, largo), numero: resto.slice(largo) }
}

/** Para mostrar: +54 9 11 1234-5678. Si no está normalizado, lo devuelve tal cual. */
export function formatTelefonoAR(telefono: string | null | undefined): string {
  if (!telefono) return ''
  if (!esTelefonoAR(telefono)) return telefono
  const { area, numero } = separarTelefonoAR(telefono)
  const corte = numero.length - 4
  return `+54 9 ${area} ${numero.slice(0, corte)}-${numero.slice(corte)}`
}

/** Link de WhatsApp a un teléfono normalizado (los dígitos van tal cual). */
export function linkWhatsapp(telefono: string, texto?: string): string {
  const base = `https://wa.me/${telefono.replace(/\D/g, '')}`
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base
}

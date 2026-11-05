// Dominio con al menos un punto y una terminación de letras; no acepta IP, correos, espacios ni esquemas raros.
const DOMAIN = /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?::\d+)?(?:[/?#]\S*)?$/i;

/**
 * Dirección a la que lleva lo escrito en "Página Web", o null si no es claramente una dirección web.
 * El campo es texto libre ("No tienen", "En construcción", un correo): solo se enlaza http o https, así que
 * nada puede abrir otro tipo de enlace (javascript:, data:, mailto:...).
 * shortcut: dos direcciones en un mismo campo ("a.co b.com") quedan como texto, no como enlaces.
 */
export function webUrl(value: string): string | null {
  const text = value.trim().replace(/^www:/i, "www."); // "www:sitio.com" es un error de tipeo frecuente
  if (/\s/.test(text)) return null;
  if (/^https?:\/\//i.test(text)) {
    try {
      return new URL(text).href;
    } catch {
      return null;
    }
  }
  return DOMAIN.test(text) ? `https://${text}` : null;
}

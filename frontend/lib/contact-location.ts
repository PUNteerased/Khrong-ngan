/** โรงเรียนอุดมดรุณี — 351 ถ.จรดวิถีถ่อง สุโขทัย */
export const UD_SCHOOL_URL = "https://ud.ac.th/"

export const DEFAULT_KIOSK_LAT = 17.0075
export const DEFAULT_KIOSK_LNG = 99.8260

export function buildKioskMapEmbedUrl(lat: number, lng: number, lang = "th"): string {
  return `https://maps.google.com/maps?q=${lat},${lng}&hl=${lang}&z=17&output=embed`
}

export function buildKioskMapOpenUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}

/** @deprecated use buildKioskMapEmbedUrl */
export const KIOSK_MAP_EMBED_URL = buildKioskMapEmbedUrl(
  DEFAULT_KIOSK_LAT,
  DEFAULT_KIOSK_LNG
)

/** @deprecated use buildKioskMapOpenUrl */
export const KIOSK_MAP_OPEN_URL = buildKioskMapOpenUrl(
  DEFAULT_KIOSK_LAT,
  DEFAULT_KIOSK_LNG
)

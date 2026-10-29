/** Drops Arabic tashkeel, superscript alef and tatweel. */
export const removeDiacritics = (s) => s.replace(/[ً-ٰٟـ]/g, '') // stops before the digits at U+0660

/** Turns Arabic-Indic (٠-٩) and Persian (۰-۹) digits into 0-9. */
export const westernDigits = (s) => s.replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 0xf)) // both ranges end in 0-9 (U+0660, U+06F0)

/**
 * Search-only normalization, so typing without diacritics or hamza still finds Arabic text.
 * Stored text is never changed; both sides of a comparison go through this.
 */
export function normalize(s) {
  return removeDiacritics(s.toLowerCase())
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
}

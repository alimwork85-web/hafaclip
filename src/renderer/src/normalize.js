/**
 * Search-only normalization, so typing without diacritics or hamza still finds Arabic text.
 * Stored text is never changed; both sides of a comparison go through this.
 */
export function normalize(s) {
  return s
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '') // tashkeel, superscript alef, tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
}

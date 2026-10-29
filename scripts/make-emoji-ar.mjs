// Builds src/renderer/src/emoji-ar.json: Arabic search words per emoji, from Unicode CLDR (unicode-org/cldr-json).
// Usage: node scripts/make-emoji-ar.mjs <annotations/ar/annotations.json> <annotationsDerived/ar/annotations.json>
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const emoji = require('emojibase-data/en/compact.json')
const [basePath, derivedPath] = process.argv.slice(2)
const words = {
  ...JSON.parse(readFileSync(derivedPath, 'utf8')).annotationsDerived.annotations,
  ...JSON.parse(readFileSync(basePath, 'utf8')).annotations.annotations
}

const out = {}
for (const e of emoji) {
  // CLDR keys often drop the U+FE0F variation selector that emojibase keeps.
  const w = words[e.unicode] ?? words[e.unicode.replaceAll('️', '')]
  if (w) out[e.hexcode] = [...new Set([...(w.tts ?? []), ...(w.default ?? [])])].join(' | ')
}
writeFileSync(new URL('../src/renderer/src/emoji-ar.json', import.meta.url), JSON.stringify(out))
console.log(`${Object.keys(out).length} of ${emoji.length} emoji have Arabic words`)

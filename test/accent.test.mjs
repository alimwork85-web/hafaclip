import { test } from 'node:test'
import assert from 'node:assert/strict'
import { accentShades, contrast } from '../src/main/accent.js'

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

test('every accent gives readable text in both themes', () => {
  for (const hex of ['0078d4ff', 'ffb900ff', '000000', 'ffffff', 'e81123', '00cc6a']) {
    const { light, dark } = accentShades(hex)
    assert.ok(contrast(rgb(light), [255, 255, 255]) >= 4.5, `${hex} light ${light}`)
    assert.ok(contrast(rgb(dark), [0x16, 0x18, 0x1f]) >= 4.5, `${hex} dark ${dark}`)
  }
})

test('an accent that already passes is kept as is', () => {
  assert.equal(accentShades('0f766eff').light, '#0f766e')
})

test('bad input gives null, so the CSS fallback applies', () => {
  assert.equal(accentShades(''), null)
  assert.equal(accentShades(undefined), null)
  assert.equal(accentShades('xyz'), null)
})

import { test } from 'node:test'
import assert from 'node:assert'
import { fixLayout } from '../src/renderer/src/layout.js'

test('Latin typed on the wrong layout becomes Arabic', () => {
  assert.equal(fixLayout('hgsghl ugd;l'), 'السلام عليكم')
  assert.equal(fixLayout('Hkh lk hgvdhq 2025'), 'أنا من الرياض 2025')
  assert.equal(fixLayout('bh'), 'لاا')
})

test('Arabic typed on the wrong layout becomes Latin', () => {
  assert.equal(fixLayout('اثممخ صخقمي'), 'hello world')
  assert.equal(fixLayout('لاخسف'), 'ghost')
})

// "b" types لا, which converts back as "gh", so the sentence avoids it.
test('converting back and forth returns the original lowercase text', () => {
  const text = 'the quick red fox jumps over the lazy dog'
  assert.equal(fixLayout(fixLayout(text)), text)
})

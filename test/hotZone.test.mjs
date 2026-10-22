import { test } from 'node:test'
import assert from 'node:assert'
import { isInHotZone } from '../src/renderer/src/hotZone.js'

test('left hot zone covers the middle of the left edge only', () => {
  assert.ok(isInHotZone(0, 500, 380, 1000))
  assert.ok(!isInHotZone(10, 500, 380, 1000))
  assert.ok(!isInHotZone(0, 50, 380, 1000))
  assert.ok(!isInHotZone(0, 950, 380, 1000))
})

test('right hot zone mirrors to the right edge', () => {
  assert.ok(isInHotZone(379, 500, 380, 1000, 'right'))
  assert.ok(!isInHotZone(0, 500, 380, 1000, 'right'))
  assert.ok(!isInHotZone(379, 50, 380, 1000, 'right'))
})

import { test } from 'node:test'
import assert from 'node:assert'
import { isInHotZone } from '../src/renderer/src/hotZone.js'

test('hot zone covers the middle of the edge only', () => {
  assert.ok(isInHotZone(0, 500, 1000))
  assert.ok(!isInHotZone(10, 500, 1000))
  assert.ok(!isInHotZone(0, 50, 1000))
  assert.ok(!isInHotZone(0, 950, 1000))
})

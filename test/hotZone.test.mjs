import { test } from 'node:test'
import assert from 'node:assert'
import { handleBackground, isInHotZone, panelGap } from '../src/renderer/src/hotZone.js'

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

test('hot zone follows handle length and thickness', () => {
  assert.ok(isInHotZone(0, 200, 380, 1000, 'left', 'long'))
  assert.ok(!isInHotZone(0, 350, 380, 1000, 'left', 'short'))
  assert.ok(isInHotZone(8, 500, 380, 1000, 'left', 'medium', 'thick'))
  assert.ok(!isInHotZone(8, 500, 380, 1000, 'left', 'medium', 'thin'))
})

test('handle is one colour, or two with the ends colour at top and bottom', () => {
  assert.equal(handleBackground('blue', 'same'), 'linear-gradient(#3b9eff, #5b6cf0)')
  assert.equal(handleBackground('blue', 'orange'), 'linear-gradient(#fdba74, #3b9eff 35%, #5b6cf0 65%, #fdba74)')
  assert.equal(handleBackground('nope'), 'linear-gradient(#7c8cff, #b07cff)')
})

test('"match" panel height follows the handle, never below half the screen', () => {
  assert.equal(panelGap('match', 'long'), '15vh') // 70% tall, like the handle
  assert.equal(panelGap('match', 'medium'), '25vh') // handle 40% → panel 50%
  assert.equal(panelGap('match', 'short'), '25vh')
  assert.equal(panelGap('small', 'long'), '25vh')
  assert.equal(panelGap(undefined), '12px')
})

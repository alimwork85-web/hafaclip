import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isNewer } from '../src/main/version.js'

test('a higher release is newer, whatever the part', () => {
  assert.equal(isNewer('v3.1.0', '3.0.2'), true)
  assert.equal(isNewer('4.0.0', '3.9.9'), true)
  assert.equal(isNewer('v3.0.10', '3.0.9'), true)
})

test('the same or an older release is not newer', () => {
  assert.equal(isNewer('v3.1.0', '3.1.0'), false)
  assert.equal(isNewer('3.0.2', '3.1.0'), false)
  assert.equal(isNewer('v3.1', '3.1.0'), false)
})

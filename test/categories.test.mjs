import { test } from 'node:test'
import assert from 'node:assert'
import { inCategory, isLink } from '../src/renderer/src/categories.js'

const text = (t) => ({ kind: 'text', text: t })
const files = (...f) => ({ kind: 'files', files: f })

test('files show under Files and under their media type', () => {
  const video = files('C:\\clips\\trip.MP4')
  assert.ok(inCategory(video, 'files'))
  assert.ok(inCategory(video, 'videos'))
  assert.ok(!inCategory(video, 'images'))
  assert.ok(inCategory(files('a.pdf'), 'documents'))
  assert.ok(inCategory(files('song.mp3'), 'audio'))
  assert.ok(inCategory({ kind: 'image' }, 'images'))
})

test('text splits into links and everything else', () => {
  assert.ok(isLink(' https://example.com/a?b=1 '))
  assert.ok(!isLink('see https://example.com'))
  assert.ok(inCategory(text('Hello there'), 'text'))
  assert.ok(inCategory(text('const x = foo(1);'), 'text'))
  assert.ok(!inCategory(text('https://x.io'), 'text'))
  assert.ok(inCategory(text('https://x.io'), 'links'))
})

test('a group shows wherever one of its parts belongs', () => {
  const g = { kind: 'group', parts: [{ kind: 'image' }, text('hi')] }
  assert.ok(inCategory(g, 'images'))
  assert.ok(inCategory(g, 'text'))
  assert.ok(!inCategory(g, 'videos'))
})

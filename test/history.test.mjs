import { test } from 'node:test'
import assert from 'node:assert'
import { addItem } from '../src/main/history.js'

const text = (t, extra = {}) => ({ id: t, kind: 'text', text: t, createdAt: 0, pinned: false, ...extra })

test('new items go on top', () => {
  const { items } = addItem([text('a')], text('b'))
  assert.deepStrictEqual(items.map((i) => i.text), ['b', 'a'])
})

test('a duplicate moves to the top and keeps its id', () => {
  const { items } = addItem([text('a'), text('b')], { ...text('b'), id: 'new' })
  assert.deepStrictEqual(items.map((i) => i.id), ['b', 'a'])
})

test('unpinned items are capped, pinned items are never dropped', () => {
  const start = [text('p', { pinned: true }), text('x'), text('y')]
  const { items, evicted } = addItem(start, text('z'), 2)
  assert.deepStrictEqual(items.map((i) => i.text), ['z', 'p', 'x'])
  assert.deepStrictEqual(evicted.map((i) => i.text), ['y'])
})

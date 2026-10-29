import { test } from 'node:test'
import assert from 'node:assert'
import { addItem, pruneItems } from '../src/main/history.js'

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

test('clearing history keeps pinned items', async () => {
  const { clearUnpinned } = await import('../src/main/history.js')
  const { items, evicted } = clearUnpinned([text('a', { pinned: true }), text('b'), text('c')])
  assert.deepStrictEqual(items.map((i) => i.text), ['a'])
  assert.deepStrictEqual(evicted.map((i) => i.text), ['b', 'c'])
})

test('merge groups items oldest first, keeps pin, and split restores them', async () => {
  const { mergeItems, splitItem } = await import('../src/main/history.js')
  const start = [text('c', { createdAt: 3 }), text('b', { createdAt: 2, pinned: true }), text('a', { createdAt: 1 })]
  const merged = mergeItems(start, ['c', 'a', 'b'], 'g', 9)
  assert.strictEqual(merged.length, 1)
  assert.deepStrictEqual(merged[0].parts.map((p) => p.text), ['a', 'b', 'c'])
  assert.strictEqual(merged[0].pinned, true)
  const split = splitItem(merged, 'g')
  assert.deepStrictEqual(split.map((i) => i.text), ['a', 'b', 'c'])
  assert.deepStrictEqual(split.map((i) => i.pinned), [false, true, false])
  const unpinned = splitItem([{ ...merged[0], pinned: false }], 'g')
  assert.ok(unpinned.every((i) => !i.pinned))
})

test('a part taken out of a group returns to its place by copy time', async () => {
  const { extractPart } = await import('../src/main/history.js')
  const g = { id: 'g', kind: 'group', createdAt: 9, pinned: false, name: 'Trip', parts: [text('a', { createdAt: 1 }), text('b', { createdAt: 4 }), text('c', { createdAt: 6 })] }
  const list = [g, text('x', { createdAt: 5 }), text('y', { createdAt: 2 })]
  const out = extractPart(list, 'g', 'b')
  assert.deepStrictEqual(out.map((i) => i.id), ['g', 'x', 'b', 'y'])
  assert.deepStrictEqual(out[0].parts.map((p) => p.id), ['a', 'c'])
  assert.strictEqual(out[0].name, 'Trip')
  assert.strictEqual(extractPart(list, 'g', 'nope'), list)
})

test('a group left with one part dissolves into that item', async () => {
  const { extractPart } = await import('../src/main/history.js')
  const g = { id: 'g', kind: 'group', createdAt: 9, pinned: true, parts: [text('a', { createdAt: 1, pinned: true }), text('b', { createdAt: 4 })] }
  const out = extractPart([g, text('x', { createdAt: 3 })], 'g', 'b')
  // The remaining part takes the group's place; the extracted one goes before older items.
  assert.deepStrictEqual(out.map((i) => i.id), ['b', 'a', 'x'])
  assert.ok(out.every((i) => i.kind === 'text'))
  assert.deepStrictEqual(out.map((i) => i.pinned), [false, true, false])
})

test('merging a group with another item flattens it', async () => {
  const { mergeItems } = await import('../src/main/history.js')
  const g = { id: 'g', kind: 'group', createdAt: 5, pinned: false, parts: [text('a', { createdAt: 1 }), text('b', { createdAt: 2 })] }
  const merged = mergeItems([text('c', { createdAt: 3 }), g], ['g', 'c'], 'h')
  assert.deepStrictEqual(merged[0].parts.map((p) => p.text), ['a', 'b', 'c'])
})

test('pruneItems keeps pinned items and drops unpinned ones past the limit or the age', () => {
  const day = 86400000
  const now = 100 * day
  const items = [text('new', { createdAt: now }), text('old pin', { createdAt: 0, pinned: true }), text('mid', { createdAt: now - 10 * day }), text('old', { createdAt: now - 40 * day })]
  assert.deepEqual(pruneItems(items, 2, 0, now).items.map((i) => i.id), ['new', 'old pin', 'mid'])
  assert.deepEqual(pruneItems(items, 1000, 30, now).items.map((i) => i.id), ['new', 'old pin', 'mid'])
  assert.deepEqual(pruneItems(items, 1000, 30, now).evicted.map((i) => i.id), ['old'])
  assert.equal(pruneItems(items, 1000, 0, now).evicted.length, 0)
})

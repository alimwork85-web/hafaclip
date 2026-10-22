/** Persists history to userData: items.json for the list, images/ for one PNG per image item. */
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { addItem, clearUnpinned } from './history'

export const imagesDir = () => join(app.getPath('userData'), 'images')
const indexFile = () => join(app.getPath('userData'), 'items.json')

let items = []
let saveTimer = null

export function loadItems() {
  mkdirSync(imagesDir(), { recursive: true })
  try {
    items = JSON.parse(readFileSync(indexFile(), 'utf8'))
  } catch (err) {
    // Keep a corrupt file aside instead of overwriting it on the next save.
    if (existsSync(indexFile())) renameSync(indexFile(), `${indexFile()}.corrupt-${Date.now()}`)
    items = []
  }
  return items
}

export const getItems = () => items

/** Writes pending changes now; called on quit so the last edit is never lost to the debounce. */
export function flush() {
  if (!saveTimer) return
  clearTimeout(saveTimer)
  saveTimer = null
  try {
    const tmp = `${indexFile()}.tmp`
    writeFileSync(tmp, JSON.stringify(items), 'utf8')
    renameSync(tmp, indexFile())
  } catch (err) {
    console.error('[store] save failed:', err)
  }
}

function save() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(flush, 300)
}

const removeImage = (item) => item.kind === 'image' && rmSync(join(imagesDir(), item.image), { force: true })

export function add(item) {
  const result = addItem(items, item)
  items = result.items
  result.evicted.forEach(removeImage)
  // A duplicate image reuses the stored file, so the freshly written one is not needed.
  if (!items.some((i) => i.id === item.id)) removeImage(item)
  save()
  return items
}

export const findItem = (id) => items.find((i) => i.id === id)

function update(next, evicted = []) {
  items = next
  evicted.forEach(removeImage)
  save()
  return items
}

/** Moves an item to the top, as if it had just been copied. */
export function touch(id) {
  const item = findItem(id)
  return item ? update([{ ...item, createdAt: Date.now() }, ...items.filter((i) => i !== item)]) : items
}

export const setPinned = (id, pinned) => update(items.map((i) => (i.id === id ? { ...i, pinned } : i)))

export const remove = (id) => update(items.filter((i) => i.id !== id), items.filter((i) => i.id === id))

export function clearHistory() {
  const result = clearUnpinned(items)
  return update(result.items, result.evicted)
}

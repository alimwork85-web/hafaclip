/** Persists history to userData: items.json for the list, images/ for one PNG per image item. */
import { app } from 'electron'
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { addItem, clearUnpinned, extractPart, HISTORY_LIMIT, mergeItems, pruneItems, splitItem } from './history'

export const imagesDir = () => join(app.getPath('userData'), 'images')
const indexFile = () => join(app.getPath('userData'), 'items.json')

let items = []
let saveTimer = null
let rules = { limit: HISTORY_LIMIT, maxAgeDays: 0 }

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
    // The installed app has no console, so keep a trace on disk too.
    try {
      appendFileSync(join(app.getPath('userData'), 'save-errors.log'), `${new Date().toISOString()} ${err.stack}\n`)
    } catch {}
  }
}

function save() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(flush, 300)
}

function removeImage(item) {
  if (item.kind === 'image') rmSync(join(imagesDir(), item.image), { force: true })
  else if (item.kind === 'group') item.parts.forEach(removeImage)
}

export function add(item) {
  const result = addItem(items, item, rules.limit)
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

/** Stores the text read from an image file (on the item itself or inside a group made since), used only by search. */
export function setImageText(image, text) {
  const withText = (i) => (i.kind === 'image' && i.image === image ? { ...i, ocrText: text } : i.kind === 'group' ? { ...i, parts: i.parts.map(withText) } : i)
  return update(items.map(withText))
}

/** Names a group (an empty name removes it); other items cannot be named. */
export function renameGroup(id, name) {
  const clean = name.trim().slice(0, 60)
  return update(
    items.map((i) => {
      if (i.id !== id || i.kind !== 'group') return i
      const { name: _old, ...rest } = i
      return clean ? { ...rest, name: clean } : rest
    })
  )
}

export const merge = (ids) => update(mergeItems(items, ids, randomUUID()))

export const split = (id) => update(splitItem(items, id))

export const extract = (id, partId) => update(extractPart(items, id, partId))

/** Drops unpinned items past the history limit or older than the auto-delete age. True when something was dropped. */
export function prune(next = rules) {
  rules = next
  const result = pruneItems(items, rules.limit, rules.maxAgeDays)
  if (result.evicted.length) update(result.items, result.evicted)
  return result.evicted.length > 0
}

export function clearHistory() {
  const result = clearUnpinned(items)
  return update(result.items, result.evicted)
}

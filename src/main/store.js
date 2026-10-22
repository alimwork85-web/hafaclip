/** Persists history to userData: items.json for the list, images/ for one PNG per image item. */
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { addItem } from './history'

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

function save() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      const tmp = `${indexFile()}.tmp`
      writeFileSync(tmp, JSON.stringify(items), 'utf8')
      renameSync(tmp, indexFile())
    } catch (err) {
      console.error('[store] save failed:', err)
    }
  }, 300)
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

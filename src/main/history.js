/** Pure history rules: newest first, duplicates move to the top, unpinned items capped, pinned items kept forever. */
export const HISTORY_LIMIT = 1000

export function signatureOf(item) {
  if (item.kind === 'text') return `text:${item.text}`
  if (item.kind === 'files') return `files:${item.files.join('|')}`
  return `image:${item.hash}`
}

/** Returns the new list plus the items dropped from it (so their image files can be deleted). */
export function addItem(items, item, limit = HISTORY_LIMIT) {
  const sig = signatureOf(item)
  const existing = items.find((i) => signatureOf(i) === sig)
  const rest = items.filter((i) => i !== existing)
  const fresh = existing ? { ...existing, createdAt: item.createdAt } : item
  const next = [fresh, ...rest]
  let unpinned = 0
  const kept = []
  const evicted = []
  for (const i of next) {
    if (i.pinned || ++unpinned <= limit) kept.push(i)
    else evicted.push(i)
  }
  return { items: kept, evicted }
}

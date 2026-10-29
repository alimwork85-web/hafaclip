/** Pure history rules: newest first, duplicates move to the top, unpinned items capped, pinned items kept forever. */
export const HISTORY_LIMIT = 1000

export function signatureOf(item) {
  if (item.kind === 'text') return `text:${item.text}`
  if (item.kind === 'files') return `files:${item.files.join('|')}`
  if (item.kind === 'group') return `group:${item.parts.map(signatureOf).join('\u0001')}`
  return `image:${item.hash}`
}

/** Returns the new list plus the items dropped from it (so their image files can be deleted). */
export function addItem(items, item, limit = HISTORY_LIMIT) {
  const sig = signatureOf(item)
  const existing = items.find((i) => signatureOf(i) === sig)
  const rest = items.filter((i) => i !== existing)
  const fresh = existing ? { ...existing, createdAt: item.createdAt } : item
  return pruneItems([fresh, ...rest], limit)
}

/** Keeps pinned items, plus the newest `limit` unpinned ones that are under `maxAgeDays` old (0 = no age limit). */
export function pruneItems(items, limit = HISTORY_LIMIT, maxAgeDays = 0, now = Date.now()) {
  const cutoff = maxAgeDays ? now - maxAgeDays * 86400000 : -Infinity
  let unpinned = 0
  const kept = []
  const evicted = []
  for (const i of items) {
    if (i.pinned || (i.createdAt >= cutoff && ++unpinned <= limit)) kept.push(i)
    else evicted.push(i)
  }
  return { items: kept, evicted }
}

/** "Clear history" keeps pinned items; everything else is dropped. */
export function clearUnpinned(items) {
  return { items: items.filter((i) => i.pinned), evicted: items.filter((i) => !i.pinned) }
}

/** Merges the selected items into one group (oldest first). Groups inside the selection are flattened. */
export function mergeItems(items, ids, id, now = Date.now()) {
  const selected = items.filter((i) => ids.includes(i.id))
  const parts = selected.flatMap((i) => (i.kind === 'group' ? i.parts : [i])).sort((a, b) => a.createdAt - b.createdAt)
  if (parts.length < 2) return items
  // A pinned item stays protected inside the group.
  const group = { id, kind: 'group', parts, createdAt: now, pinned: selected.some((i) => i.pinned) }
  return [group, ...items.filter((i) => !ids.includes(i.id))]
}

/** Replaces a group with its original items. Each keeps its own pin, unless the group was unpinned meanwhile. */
export function splitItem(items, id) {
  const group = items.find((i) => i.id === id && i.kind === 'group')
  if (!group) return items
  return [...group.parts.map((p) => ({ ...p, pinned: group.pinned && p.pinned })), ...items.filter((i) => i !== group)]
}

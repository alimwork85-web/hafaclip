import { useMemo, useState } from 'react'
import data from 'emojibase-data/en/compact.json'
import versions_ from 'emojibase-data/versions/emoji.json'

const GROUPS = [
  { id: 0, name: 'Smileys' },
  { id: 1, name: 'People' },
  { id: 3, name: 'Nature' },
  { id: 4, name: 'Food' },
  { id: 5, name: 'Travel' },
  { id: 6, name: 'Activities' },
  { id: 7, name: 'Objects' },
  { id: 8, name: 'Symbols' },
  { id: 9, name: 'Flags' }
]
/**
 * True when this machine's emoji font can draw the emoji. Missing single emoji draw as the same "tofu" box as an
 * unassigned code point; missing combined emoji fall back to several glyphs side by side, so they come out wider.
 */
function makeSupportCheck() {
  const ctx = Object.assign(document.createElement('canvas'), { width: 32, height: 32 }).getContext('2d', { willReadFrequently: true })
  ctx.font = '24px "Segoe UI Emoji"'
  ctx.textBaseline = 'top'
  const draw = (u) => {
    ctx.clearRect(0, 0, 32, 32)
    ctx.fillText(u, 0, 0)
    return ctx.getImageData(0, 0, 32, 32).data.join()
  }
  const tofu = draw('\u{10FFFD}')
  const maxWidth = ctx.measureText('😀').width * 1.5
  return (u) => ctx.measureText(u).width <= maxWidth && draw(u) !== tofu
}

/**
 * Newest emoji version this machine's font can draw. Drawing all ~1900 emoji takes seconds, so probe a few
 * samples per version instead, newest first.
 */
function newestSupportedVersion(byHex) {
  const isSupported = makeSupportCheck()
  const versions = Object.keys(versions_).map(Number).sort((a, b) => b - a)
  for (const v of versions) {
    const samples = versions_[v].map((hex) => byHex.get(hex)).filter(Boolean).slice(0, 3)
    if (samples.some((e) => isSupported(e.unicode))) return v
  }
  return 0
}

// Built on first use of the Emoji tab so it never delays app startup.
let catalog = null
function getCatalog() {
  if (catalog) return catalog
  const byHex = new Map(data.map((e) => [e.hexcode, e]))
  const versionOf = new Map(Object.entries(versions_).flatMap(([v, hexes]) => hexes.map((h) => [h, Number(v)])))
  const newest = newestSupportedVersion(byHex)
  const emoji = data
    .filter((e) => GROUPS.some((g) => g.id === e.group) && (versionOf.get(e.hexcode) ?? 0) <= newest)
    .sort((a, b) => a.order - b.order)
  const icon = Object.fromEntries(GROUPS.map((g) => [g.id, emoji.find((e) => e.group === g.id)?.unicode]))
  catalog = { emoji, icon }
  return catalog
}
const RECENT_KEY = 'recentEmoji'
const RECENT_MAX = 24

// Recent emoji are a per-device convenience; storage can be unavailable, so never let it break the panel.
function loadRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) ?? []
  } catch {
    return []
  }
}

export default function EmojiPanel({ onPick }) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState(0)
  const [recent, setRecent] = useState(loadRecent)
  const { emoji: EMOJI, icon: ICON } = getCatalog()

  const q = query.trim().toLowerCase()
  const shown = useMemo(
    () => (q ? EMOJI.filter((e) => e.label.includes(q) || e.tags?.some((t) => t.includes(q))) : EMOJI.filter((e) => e.group === group)),
    [q, group]
  )

  const pick = (emoji) => {
    const next = [emoji, ...recent.filter((r) => r !== emoji)].slice(0, RECENT_MAX)
    setRecent(next)
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
    onPick(emoji)
  }

  const button = (unicode, label) => (
    <button key={unicode} className="emoji" title={label} aria-label={label} onClick={() => pick(unicode)}>
      {unicode}
    </button>
  )

  return (
    <div className="emoji-panel">
      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Search emoji…"
          aria-label="Search emoji"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {!q && (
        <div className="emoji-groups" role="tablist" aria-label="Emoji categories">
          {GROUPS.map((g) => (
            <button key={g.id} role="tab" aria-selected={g.id === group} title={g.name} className={g.id === group ? 'active' : ''} onClick={() => setGroup(g.id)}>
              {ICON[g.id]}
            </button>
          ))}
        </div>
      )}
      <div className="emoji-scroll">
        {!q && recent.length > 0 && (
          <>
            <div className="group">Recent</div>
            <div className="emoji-grid">{recent.map((u) => button(u, 'Recent'))}</div>
          </>
        )}
        <div className="group">{q ? `${shown.length} results` : GROUPS.find((g) => g.id === group).name}</div>
        <div className="emoji-grid">{shown.map((e) => button(e.unicode, e.label))}</div>
      </div>
    </div>
  )
}

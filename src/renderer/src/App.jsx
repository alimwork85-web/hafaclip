import { useEffect, useRef, useState } from 'react'
import { HANDLE_COLORS, HANDLE_LENGTHS, HANDLE_THICKNESS, isInHotZone } from './hotZone'
import ItemCard from './ItemCard'
import EmojiPanel from './EmojiPanel'
import SettingsPanel from './SettingsPanel'
import TabStrip from './TabStrip'
import { CATEGORIES, inCategory } from './categories'

const matches = (item, q) => {
  if (item.kind === 'text') return item.text.toLowerCase().includes(q)
  if (item.kind === 'files') return item.files.some((f) => f.toLowerCase().includes(q))
  if (item.kind === 'group') return item.parts.some((p) => matches(p, q))
  return 'image'.includes(q)
}

export default function App() {
  const [expanded, setExpanded] = useState(false)
  const [settings, setSettings] = useState({ edge: 'left', handleLength: 'medium', handleThickness: 'medium', handleColor: 'purple' })
  const edge = settings.edge
  const [items, setItems] = useState([])
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [dropping, setDropping] = useState(false)
  const [selected, setSelected] = useState([])
  const [tab, setTab] = useState('all')
  // Set while one of our own cards is dragged, so dropping it back on the panel adds nothing.
  const draggingOut = useRef(false)
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  useEffect(
    () =>
      window.panel.onCursor((where) => {
        setExpanded(where === 'edge')
        if (where === 'away') setDropping(false)
      }),
    []
  )

  const onDragOver = (e) => {
    if (draggingOut.current) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDropping(true)
  }

  const onDrop = async (e) => {
    e.preventDefault()
    setDropping(false)
    if (draggingOut.current) return
    // A FileList cannot cross the context bridge; an array of File objects can.
    const r = await window.panel.drop(Array.from(e.dataTransfer.files), e.dataTransfer.getData('text/plain'))
    setToast(r.ok ? { text: 'Added', tone: 'ok' } : { text: r.error, tone: 'error' })
  }

  useEffect(() => {
    window.panel.getSettings().then(setSettings)
    window.panel.getItems().then(setItems)
    const offSettings = window.panel.onSettings(setSettings)
    const offItems = window.panel.onItems(setItems)
    return () => {
      offSettings()
      offItems()
    }
  }, [])

  useEffect(() => window.panel.setInteractive(expanded), [expanded])

  useEffect(() => {
    const onMove = (e) => {
      const s = settingsRef.current
      if (isInHotZone(e.clientX, e.clientY, window.innerWidth, window.innerHeight, s.edge, s.handleLength, s.handleThickness)) setExpanded(true)
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 1600)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!confirmClear) return
    const t = setTimeout(() => setConfirmClear(false), 3000)
    return () => clearTimeout(t)
  }, [confirmClear])

  const updateSettings = async (patch) => {
    // Moving to the other edge slides the window away from the cursor, so close the panel first.
    if (patch.edge && patch.edge !== edge) setExpanded(false)
    setSettings(await window.panel.updateSettings(patch))
  }

  const copy = async (item) => {
    const r = await window.panel.copyItem(item.id)
    setToast(r.ok ? { text: 'Copied', tone: 'ok' } : { text: r.error, tone: 'error' })
  }

  const paste = async (item) => {
    setExpanded(false)
    const r = await window.panel.pasteItem(item.id)
    if (!r.ok) {
      setExpanded(true)
      setToast({ text: r.error, tone: 'error' })
    }
  }

  const pasteEmoji = async (emoji) => {
    setExpanded(false)
    const r = await window.panel.pasteEmoji(emoji)
    if (!r.ok) setToast({ text: r.error, tone: 'error' })
  }

  const clear = () => {
    if (!confirmClear) return setConfirmClear(true)
    setConfirmClear(false)
    window.panel.clearHistory()
    setToast({ text: 'History cleared (pinned kept)', tone: 'ok' })
  }

  const q = query.trim().toLowerCase()
  const visible = items.filter((i) => inCategory(i, tab) && (!q || matches(i, q)))
  const pinned = visible.filter((i) => i.pinned)
  const recent = visible.filter((i) => !i.pinned)

  // Ctrl+click starts a selection; while one exists, plain clicks keep adding to it.
  const toggleSelect = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const merge = async () => {
    await window.panel.mergeItems(selected)
    setSelected([])
    setToast({ text: 'Merged', tone: 'ok' })
  }

  const card = (item) => (
    <ItemCard
      key={item.id}
      item={item}
      selected={selected.includes(item.id)}
      onClick={(e) => (e.ctrlKey || selected.length ? toggleSelect(item.id) : copy(item))}
      onSplit={() => window.panel.splitItem(item.id)}
      onPaste={() => paste(item)}
      onPin={() => window.panel.pinItem(item.id, !item.pinned)}
      onDelete={() => window.panel.deleteItem(item.id)}
      onDragOut={() => window.panel.startDrag(item.id)}
    />
  )

  return (
    <div className={`app edge-${edge}${expanded ? ' expanded' : ''}`}>
      <div
        className="handle"
        style={{
          '--handle-a': HANDLE_COLORS[settings.handleColor]?.[0],
          '--handle-b': HANDLE_COLORS[settings.handleColor]?.[1],
          '--handle-h': `${(HANDLE_LENGTHS[settings.handleLength] ?? 0.4) * 100}vh`,
          '--handle-w': `${HANDLE_THICKNESS[settings.handleThickness] ?? 5}px`
        }}
      />
      <aside
        className={`panel${dropping ? ' dropping' : ''}`}
        onMouseLeave={() => setExpanded(false)}
        onDragOver={onDragOver}
        onDragLeave={() => setDropping(false)}
        onDrop={onDrop}
        onDragStart={(e) => {
          // Native drags (images, files) cancel the HTML drag and never fire dragend, so only flag text drags.
          if (!e.defaultPrevented) draggingOut.current = true
        }}
        onDragEnd={() => {
          draggingOut.current = false
        }}
      >
        <header>
          <span className="dot" />
          <h1>Clipboard</h1>
          <button
            className={`gear${tab === 'settings' ? ' active' : ''}`}
            title="Settings"
            aria-label="Settings"
            aria-pressed={tab === 'settings'}
            onClick={() => setTab(tab === 'settings' ? 'all' : 'settings')}
          >
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </button>
        </header>
        <TabStrip tab={tab} onPick={setTab} />
        {tab === 'settings' ? (
          <SettingsPanel settings={settings} onChange={updateSettings} />
        ) : tab === 'emoji' ? (
          <EmojiPanel onPick={pasteEmoji} />
        ) : (
        <>
        {selected.length > 0 ? (
          <div className="toolbar selection-bar" role="toolbar" aria-label="Selection">
            <span>{selected.length} selected</span>
            <button className="primary" onClick={merge} disabled={selected.length < 2}>Merge</button>
            <button onClick={() => setSelected([])}>Cancel</button>
          </div>
        ) : (
        <div className="toolbar">
          <input
            className="search"
            type="search"
            placeholder="Search…"
            aria-label="Search history"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {/* Clear empties the whole history (not just this tab), so it depends on all items. */}
          <button
            className={`clear${confirmClear ? ' confirm' : ''}`}
            title="Delete all history except pinned items"
            onClick={clear}
            disabled={!items.some((i) => !i.pinned) && !confirmClear}
          >
            {confirmClear ? 'Confirm?' : 'Clear all'}
          </button>
        </div>
        )}
        {visible.length ? (
          <ul className="list">
            {pinned.length > 0 && <li className="group">Pinned</li>}
            {pinned.map(card)}
            {pinned.length > 0 && recent.length > 0 && <li className="group">Recent</li>}
            {recent.map(card)}
          </ul>
        ) : (
          <div className="empty">
            <p>{q ? 'No matches' : tab === 'all' ? 'Nothing here yet' : `No ${CATEGORIES.find((c) => c.id === tab)?.label.toLowerCase()} yet`}</p>
            <small>{q ? 'Try another word.' : 'Copied items will show up here.'}</small>
          </div>
        )}
        </>
        )}
        {toast && <div className={`toast ${toast.tone}`} role="status">{toast.text}</div>}
      </aside>
    </div>
  )
}

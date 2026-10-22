import { useEffect, useRef, useState } from 'react'
import { isInHotZone } from './hotZone'
import ItemCard from './ItemCard'

const matches = (item, q) => {
  if (item.kind === 'text') return item.text.toLowerCase().includes(q)
  if (item.kind === 'files') return item.files.some((f) => f.toLowerCase().includes(q))
  return 'image'.includes(q)
}

export default function App() {
  const [expanded, setExpanded] = useState(false)
  const [edge, setEdge] = useState('left')
  const [items, setItems] = useState([])
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [dropping, setDropping] = useState(false)
  // Set while one of our own cards is dragged, so dropping it back on the panel adds nothing.
  const draggingOut = useRef(false)
  const edgeRef = useRef(edge)
  edgeRef.current = edge

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
    window.panel.getSettings().then((s) => setEdge(s.edge))
    window.panel.getItems().then(setItems)
    return window.panel.onItems(setItems)
  }, [])

  useEffect(() => window.panel.setInteractive(expanded), [expanded])

  useEffect(() => {
    const onMove = (e) => {
      if (isInHotZone(e.clientX, e.clientY, window.innerWidth, window.innerHeight, edgeRef.current)) setExpanded(true)
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

  const chooseEdge = async (next) => {
    if (next === edge) return
    setExpanded(false)
    const s = await window.panel.updateSettings({ edge: next })
    setEdge(s.edge)
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

  const clear = () => {
    if (!confirmClear) return setConfirmClear(true)
    setConfirmClear(false)
    window.panel.clearHistory()
    setToast({ text: 'History cleared (pinned kept)', tone: 'ok' })
  }

  const q = query.trim().toLowerCase()
  const visible = q ? items.filter((i) => matches(i, q)) : items
  const pinned = visible.filter((i) => i.pinned)
  const recent = visible.filter((i) => !i.pinned)

  const card = (item) => (
    <ItemCard
      key={item.id}
      item={item}
      onCopy={() => copy(item)}
      onPaste={() => paste(item)}
      onPin={() => window.panel.pinItem(item.id, !item.pinned)}
      onDelete={() => window.panel.deleteItem(item.id)}
      onDragOut={() => window.panel.startDrag(item.id)}
    />
  )

  return (
    <div className={`app edge-${edge}${expanded ? ' expanded' : ''}`}>
      <div className="handle" />
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
          <div className="segmented" role="group" aria-label="Screen edge">
            {['left', 'right'].map((side) => (
              <button
                key={side}
                className={side === edge ? 'active' : ''}
                aria-pressed={side === edge}
                onClick={() => chooseEdge(side)}
              >
                {side === 'left' ? 'Left' : 'Right'}
              </button>
            ))}
          </div>
        </header>
        <div className="toolbar">
          <input
            className="search"
            type="search"
            placeholder="Search…"
            aria-label="Search history"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className={`clear${confirmClear ? ' confirm' : ''}`} onClick={clear} disabled={!recent.length && !confirmClear}>
            {confirmClear ? 'Confirm?' : 'Clear'}
          </button>
        </div>
        {visible.length ? (
          <ul className="list">
            {pinned.length > 0 && <li className="group">Pinned</li>}
            {pinned.map(card)}
            {pinned.length > 0 && recent.length > 0 && <li className="group">Recent</li>}
            {recent.map(card)}
          </ul>
        ) : (
          <div className="empty">
            <p>{q ? 'No matches' : 'Nothing here yet'}</p>
            <small>{q ? 'Try another word.' : 'Copied items will show up here.'}</small>
          </div>
        )}
        {toast && <div className={`toast ${toast.tone}`} role="status">{toast.text}</div>}
      </aside>
    </div>
  )
}

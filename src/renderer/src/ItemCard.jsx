import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const timeAgo = (ms) => {
  const s = Math.round((Date.now() - ms) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

const baseName = (p) => p.split(/[\\/]/).pop()

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)
const ICONS = {
  paste: 'M9 14l-4-4 4-4M5 10h11a4 4 0 0 1 4 4v4',
  pin: 'M12 17v5M9 3h6l-1 7 4 3v2H6v-2l4-3z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  split: 'M4 6h16M4 12h10M4 18h16M18 9l3 3-3 3',
  copy: 'M9 9h10v12H9zM5 15V3h10'
}

/** Text of an item when it can be dragged as plain text (text, or a group made only of text). */
const plainText = (item) =>
  item.kind === 'text' ? item.text : item.kind === 'group' && item.parts.every((p) => p.kind === 'text') ? item.parts.map((p) => p.text).join('\n') : null

const FILES_SHOWN = 3

function Preview({ item, expanded = false }) {
  if (item.kind === 'text') return <p className="card-text">{item.text}</p>
  if (item.kind === 'image')
    return <img className="card-image" src={`clip://image/${item.image}`} alt={`Image ${item.width}×${item.height}`} loading="lazy" />
  if (item.kind === 'files') {
    const shown = expanded ? item.files : item.files.slice(0, FILES_SHOWN)
    return (
      <ul className="card-files">
        {shown.map((f) => (
          <li key={f} title={f}>{baseName(f)}</li>
        ))}
        {shown.length < item.files.length && <li className="more">+{item.files.length - shown.length} more</li>}
      </ul>
    )
  }
  return (
    <div className="group-parts">
      {item.parts.slice(0, 3).map((p) => (
        <div key={p.id} className="part">
          <Preview item={p} />
        </div>
      ))}
      {item.parts.length > 3 && <div className="more">+{item.parts.length - 3} more</div>}
    </div>
  )
}

const label = (item) =>
  item.kind === 'group'
    ? `Group · ${item.parts.length} items`
    : item.kind === 'files'
      ? `${item.files.length} file${item.files.length > 1 ? 's' : ''}`
      : item.kind === 'image'
        ? `${item.width}×${item.height}`
        : `${item.text.length} chars`

export default function ItemCard({ item, selected, expanded, onToggleExpand, onCopiedPart, onClick, onPaste, onPin, onDelete, onSplit, onDragOut }) {
  // Buttons inside the card must not also trigger the card's own click action.
  const action = (fn) => (e) => {
    e.stopPropagation()
    fn()
  }
  // Text gets "More" only when it is actually cut off at 3 lines, so measure the rendered paragraph.
  const ref = useRef(null)
  const [clipped, setClipped] = useState(false)
  useLayoutEffect(() => {
    const p = ref.current?.querySelector(':scope > .card-text')
    if (p && !expanded) setClipped(p.scrollHeight > p.clientHeight + 1)
  }, [item.text, expanded])
  const expandable = (item.kind === 'text' && clipped) || (item.kind === 'files' && item.files.length > FILES_SHOWN)

  // Text cards are selectable, so a press-and-drag selects text; the grip in the footer drags the card instead.
  const isText = item.kind === 'text'
  const [selection, setSelection] = useState('')
  const selectionInside = () => {
    const s = window.getSelection()
    return s.rangeCount > 0 && ref.current?.contains(s.anchorNode) && ref.current.contains(s.focusNode) ? s.toString() : ''
  }
  useEffect(() => {
    if (!isText) return
    const onChange = () => setSelection(selectionInside())
    document.addEventListener('selectionchange', onChange)
    return () => document.removeEventListener('selectionchange', onChange)
  }, [isText])

  // The part is written to the clipboard, where the watcher picks it up as a new item of its own.
  const copySelection = async () => {
    try {
      await navigator.clipboard.writeText(selection)
    } catch {
      document.execCommand('copy')
    }
    window.getSelection().removeAllRanges()
    onCopiedPart()
  }

  const startDrag = (e) => {
    const text = plainText(item)
    if (text !== null) {
      e.dataTransfer.setData('text/plain', text)
      e.dataTransfer.effectAllowed = 'copy'
    } else {
      // Images and files need a native OS drag with real files.
      e.preventDefault()
      onDragOut()
    }
  }

  return (
    <li
      ref={ref}
      className={`card kind-${item.kind}${item.pinned ? ' pinned' : ''}${selected ? ' selected' : ''}${expanded ? ' expanded' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      title={isText ? 'Click to copy · select text to copy a part · Ctrl+click to select for merging' : 'Click to copy · Ctrl+click to select for merging · drag to drop it anywhere'}
      // Finishing a text selection also fires a click; that must not copy the whole card.
      onClick={(e) => !selectionInside() && onClick(e)}
      draggable={!isText}
      onDragStart={isText ? undefined : startDrag}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onPaste()
        else if (e.key === ' ') onClick(e)
      }}
    >
      <Preview item={item} expanded={expanded} />
      {expandable && (
        <button className="more-toggle" aria-expanded={expanded} onClick={action(onToggleExpand)}>
          {expanded ? 'Less' : 'More'}
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={expanded ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
          </svg>
        </button>
      )}
      {selection.trim() && (
        // mousedown is cancelled so pressing the button does not clear the selection first.
        <button className="copy-selection" onMouseDown={(e) => e.preventDefault()} onClick={action(copySelection)}>
          <Icon d={ICONS.copy} />
          Copy selection
        </button>
      )}
      <footer>
        {isText && (
          <span className="grip" draggable onDragStart={startDrag} title="Drag the text to another app" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
          </span>
        )}
        <span className="kind">{label(item)}</span>
        <span className="time">{timeAgo(item.createdAt)}</span>
        <div className="actions">
          <button title="Paste into the previous window" aria-label="Paste" onClick={action(onPaste)}><Icon d={ICONS.paste} /></button>
          {item.kind === 'group' && (
            <button title="Split back into separate items" aria-label="Split" onClick={action(onSplit)}><Icon d={ICONS.split} /></button>
          )}
          <button title={item.pinned ? 'Unpin' : 'Pin (kept forever)'} aria-label={item.pinned ? 'Unpin' : 'Pin'} aria-pressed={item.pinned} className={item.pinned ? 'on' : ''} onClick={action(onPin)}><Icon d={ICONS.pin} /></button>
          <button title="Delete" aria-label="Delete" className="danger" onClick={action(onDelete)}><Icon d={ICONS.trash} /></button>
        </div>
      </footer>
    </li>
  )
}

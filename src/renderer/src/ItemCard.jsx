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
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3'
}

export default function ItemCard({ item, onCopy, onPaste, onPin, onDelete }) {
  // Buttons inside the card must not also trigger the card's own copy action.
  const action = (fn) => (e) => {
    e.stopPropagation()
    fn()
  }
  return (
    <li
      className={`card kind-${item.kind}${item.pinned ? ' pinned' : ''}`}
      role="button"
      tabIndex={0}
      title="Click to copy"
      onClick={onCopy}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onPaste()
        else if (e.key === ' ') onCopy()
      }}
    >
      {item.kind === 'text' && <p className="card-text">{item.text}</p>}
      {item.kind === 'image' && (
        <img className="card-image" src={`clip://image/${item.image}`} alt={`Image ${item.width}×${item.height}`} loading="lazy" />
      )}
      {item.kind === 'files' && (
        <ul className="card-files">
          {item.files.slice(0, 4).map((f) => (
            <li key={f} title={f}>{baseName(f)}</li>
          ))}
          {item.files.length > 4 && <li className="more">+{item.files.length - 4} more</li>}
        </ul>
      )}
      <footer>
        <span className="kind">{item.kind === 'files' ? `${item.files.length} file${item.files.length > 1 ? 's' : ''}` : item.kind === 'image' ? `${item.width}×${item.height}` : `${item.text.length} chars`}</span>
        <span className="time">{timeAgo(item.createdAt)}</span>
        <div className="actions">
          <button title="Paste into the previous window" aria-label="Paste" onClick={action(onPaste)}><Icon d={ICONS.paste} /></button>
          <button title={item.pinned ? 'Unpin' : 'Pin (kept forever)'} aria-label={item.pinned ? 'Unpin' : 'Pin'} aria-pressed={item.pinned} className={item.pinned ? 'on' : ''} onClick={action(onPin)}><Icon d={ICONS.pin} /></button>
          <button title="Delete" aria-label="Delete" className="danger" onClick={action(onDelete)}><Icon d={ICONS.trash} /></button>
        </div>
      </footer>
    </li>
  )
}

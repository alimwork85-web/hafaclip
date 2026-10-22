const timeAgo = (ms) => {
  const s = Math.round((Date.now() - ms) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

const baseName = (p) => p.split(/[\\/]/).pop()

export default function ItemCard({ item }) {
  return (
    <li className={`card card-${item.kind}`}>
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
        <span>{timeAgo(item.createdAt)}</span>
      </footer>
    </li>
  )
}

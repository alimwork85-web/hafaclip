import { useEffect, useState } from 'react'
import { isInHotZone } from './hotZone'

export default function App() {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => window.panel.setInteractive(expanded), [expanded])

  useEffect(() => {
    const onMove = (e) => {
      if (isInHotZone(e.clientX, e.clientY, window.innerHeight)) setExpanded(true)
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <div className={expanded ? 'app expanded' : 'app'}>
      <div className="handle" />
      <aside className="panel" onMouseLeave={() => setExpanded(false)}>
        <header>
          <span className="dot" />
          <h1>Clipboard</h1>
        </header>
        <div className="empty">
          <p>Nothing here yet</p>
          <small>Copied items will show up here.</small>
        </div>
      </aside>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { isInHotZone } from './hotZone'

export default function App() {
  const [expanded, setExpanded] = useState(false)
  const [edge, setEdge] = useState('left')
  const edgeRef = useRef(edge)
  edgeRef.current = edge

  useEffect(() => {
    window.panel.getSettings().then((s) => setEdge(s.edge))
  }, [])

  useEffect(() => window.panel.setInteractive(expanded), [expanded])

  useEffect(() => {
    const onMove = (e) => {
      if (isInHotZone(e.clientX, e.clientY, window.innerWidth, window.innerHeight, edgeRef.current)) setExpanded(true)
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [])

  const chooseEdge = async (next) => {
    if (next === edge) return
    setExpanded(false)
    const s = await window.panel.updateSettings({ edge: next })
    setEdge(s.edge)
  }

  return (
    <div className={`app edge-${edge}${expanded ? ' expanded' : ''}`}>
      <div className="handle" />
      <aside className="panel" onMouseLeave={() => setExpanded(false)}>
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
        <div className="empty">
          <p>Nothing here yet</p>
          <small>Copied items will show up here.</small>
        </div>
      </aside>
    </div>
  )
}

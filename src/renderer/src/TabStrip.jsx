import { useEffect, useRef } from 'react'
import { CATEGORIES } from './categories'

/**
 * One row of tabs that scrolls sideways with the mouse wheel or by dragging when they don't fit.
 * `counts` maps a tab id to its number of items (tabs without a count, like Emoji, show none).
 */
export default function TabStrip({ tab, onPick, counts = {} }) {
  const ref = useRef(null)
  const drag = useRef(null)

  // Keep the chosen tab in view.
  useEffect(() => {
    ref.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [tab])

  // React's wheel listener is passive, so register our own to turn vertical wheel into sideways scroll.
  useEffect(() => {
    const el = ref.current
    const onWheel = (e) => {
      if (!e.deltaY) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <div
      ref={ref}
      className="tabs"
      role="tablist"
      aria-label="Categories"
      onPointerDown={(e) => (drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false })}
      onPointerMove={(e) => {
        if (!drag.current || !(e.buttons & 1)) return
        const dx = e.clientX - drag.current.x
        if (Math.abs(dx) > 4) drag.current.moved = true
        ref.current.scrollLeft = drag.current.left - dx
      }}
      onClickCapture={(e) => {
        // A drag that ends over a tab should not also select it.
        if (drag.current?.moved) e.stopPropagation()
        drag.current = null
      }}
    >
      {CATEGORIES.map((c) => {
        const name = c.title ?? c.label
        const named = counts[c.id] === undefined ? name : `${name} · ${counts[c.id]}`
        return (
        <button
          key={c.id}
          role="tab"
          aria-selected={tab === c.id}
          aria-label={named}
          title={named}
          className={tab === c.id ? 'active' : ''}
          onClick={() => onPick(c.id)}
        >
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={c.icon} />
          </svg>
          {/* Only the chosen tab shows its name; the others are icons with a tooltip. */}
          {tab === c.id && (
            <span>
              {c.label}
              {counts[c.id] !== undefined && <small className="count">{counts[c.id]}</small>}
            </span>
          )}
        </button>
        )
      })}
    </div>
  )
}

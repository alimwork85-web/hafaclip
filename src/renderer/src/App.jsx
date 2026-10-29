import { useEffect, useRef, useState } from 'react'
import { HANDLE_COLORS, HANDLE_LENGTHS, HANDLE_THICKNESS, isInHotZone, PANEL_WIDTHS } from './hotZone'
import ItemCard from './ItemCard'
import EmojiPanel from './EmojiPanel'
import SettingsPanel, { FONTS } from './SettingsPanel'
import TabStrip from './TabStrip'
import { CATEGORIES, inCategory } from './categories'
import { normalize } from './normalize'
import { resolveLang, t } from './i18n'
import { fixLayout } from './layout'

// `q` arrives already normalized.
const matches = (item, q) => {
  if (item.kind === 'text') return normalize(item.text).includes(q)
  if (item.kind === 'files') return item.files.some((f) => normalize(f).includes(q))
  if (item.kind === 'group') return item.parts.some((p) => matches(p, q))
  return 'image'.includes(q) || normalize(item.ocrText ?? '').includes(q)
}

export default function App() {
  const [expanded, setExpanded] = useState(false)
  const [settings, setSettings] = useState({ edge: 'left', handleLength: 'medium', handleThickness: 'medium', handleColor: 'purple' })
  const edge = settings.edge
  // navigator.language is Electron's app locale, the same one the main process uses for the tray.
  const lang = resolveLang(settings.language, navigator.language)
  const tr = (key, ...args) => t(lang, key, ...args)
  const [items, setItems] = useState([])
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [dropping, setDropping] = useState(false)
  const [selected, setSelected] = useState([])
  const [tab, setTab] = useState('all')
  // Only one card is opened with "More" at a time; opening another closes it.
  const [expandedId, setExpandedId] = useState(null)
  // Collapsing pinned items is a per-device view preference; storage may be unavailable, so default to open.
  const [pinnedOpen, setPinnedOpen] = useState(() => {
    try {
      return localStorage.getItem('pinnedOpen') !== 'false'
    } catch {
      return true
    }
  })
  const togglePinned = () => {
    setPinnedOpen(!pinnedOpen)
    try {
      localStorage.setItem('pinnedOpen', String(!pinnedOpen))
    } catch {
      /* ignore */
    }
  }
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
    setToast(r.ok ? { text: tr('added'), tone: 'ok' } : { text: tr(r.error), tone: 'error' })
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
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [lang])

  // Appearance settings live on <html>: theme and density as attributes, font, size and width as CSS variables.
  useEffect(() => {
    const root = document.documentElement
    const light = window.matchMedia('(prefers-color-scheme: light)')
    const apply = () => (root.dataset.theme = !settings.theme || settings.theme === 'system' ? (light.matches ? 'light' : 'dark') : settings.theme)
    apply()
    light.addEventListener('change', apply)
    return () => light.removeEventListener('change', apply)
  }, [settings.theme])
  useEffect(() => {
    const root = document.documentElement
    root.dataset.density = settings.density ?? 'comfortable'
    root.style.setProperty('--font', FONTS[settings.font] ?? FONTS.system)
    root.style.setProperty('--zoom', { small: 0.9, large: 1.12 }[settings.textSize] ?? 1)
    root.style.setProperty('--panel-w', `${PANEL_WIDTHS[settings.panelWidth] ?? PANEL_WIDTHS.medium}px`)
  }, [settings.density, settings.font, settings.textSize, settings.panelWidth])

  // Keyboard: Esc closes, Alt+1…9 pastes the numbered card, and typing anywhere in a list goes to the search box.
  const searchRef = useRef(null)
  const keys = useRef(null)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') return setExpanded(false)
      const { shown, paste, inList } = keys.current
      if (!inList) return
      // e.code for real keys; e.key as a fallback for input that comes without a scan code.
      const n = e.altKey && !e.ctrlKey && Number(/^Digit([1-9])$/.exec(e.code)?.[1] ?? (/^[1-9]$/.test(e.key) && e.key))
      if (n) {
        e.preventDefault()
        if (shown[n - 1]) paste(shown[n - 1])
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        // ↓ from search goes to the first card; ↑ from the first card goes back to search. Enter on a card pastes it.
        const cards = [...document.querySelectorAll('.list .card')]
        const i = cards.indexOf(document.activeElement)
        const next = e.target === searchRef.current ? (e.key === 'ArrowDown' ? cards[0] : null) : i < 0 ? null : e.key === 'ArrowDown' ? cards[i + 1] : (cards[i - 1] ?? searchRef.current)
        if (next) {
          e.preventDefault()
          next.focus()
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && !e.target.closest?.('input, textarea')) {
        searchRef.current?.focus() // focused during keydown, so this key's character lands in the box
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  // Opening (by shortcut or hover) puts the cursor in the search box; an old query is selected so typing replaces it.
  useEffect(() => {
    if (expanded && keys.current?.inList) {
      searchRef.current?.focus({ preventScroll: true })
      searchRef.current?.select()
    }
  }, [expanded])

  // Open once the cursor has stayed in the hot zone for the open delay (the main process covers a still cursor).
  const hoverSince = useRef(null)
  useEffect(() => {
    const onMove = (e) => {
      const s = settingsRef.current
      if (!isInHotZone(e.clientX, e.clientY, window.innerWidth, window.innerHeight, s.edge, s.handleLength, s.handleThickness)) return (hoverSince.current = null)
      hoverSince.current ??= Date.now()
      if (Date.now() - hoverSince.current >= (s.openDelay ?? 0)) setExpanded(true)
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
    setToast(r.ok ? { text: tr('copied'), tone: 'ok' } : { text: tr(r.error), tone: 'error' })
  }

  const paste = async (item) => {
    setExpanded(false)
    const r = await window.panel.pasteItem(item.id)
    if (!r.ok) {
      setExpanded(true)
      setToast({ text: tr(r.error), tone: 'error' })
    }
  }

  // The converted text is added as a new item, so the original stays as it was.
  const fixItemLayout = async (item) => {
    const r = await window.panel.drop([], fixLayout(item.text))
    setToast(r.ok ? { text: tr('layoutFixed'), tone: 'ok' } : { text: tr(r.error), tone: 'error' })
  }

  const pasteAs = async (item, convert) => {
    setExpanded(false)
    const r = await window.panel.pasteText(convert(item.text))
    if (!r.ok) {
      setExpanded(true)
      setToast({ text: tr(r.error), tone: 'error' })
    }
  }

  const pasteEmoji = async (emoji) => {
    setExpanded(false)
    const r = await window.panel.pasteEmoji(emoji)
    if (!r.ok) setToast({ text: tr(r.error), tone: 'error' })
  }

  const clear = () => {
    if (!confirmClear) return setConfirmClear(true)
    setConfirmClear(false)
    window.panel.clearHistory()
    setToast({ text: tr('cleared'), tone: 'ok' })
  }

  const q = normalize(query.trim())
  const visible = items.filter((i) => inCategory(i, tab) && (!q || matches(i, q)))
  const pinned = visible.filter((i) => i.pinned)
  const recent = visible.filter((i) => !i.pinned)
  // Cards in the order they show, for the Alt+1…9 numbers.
  const shown = [...(pinnedOpen ? pinned : []), ...recent]
  const inList = tab !== 'settings' && tab !== 'emoji' && !selected.length
  keys.current = { shown, paste, inList }
  // Items per tab (pinned included); while searching, the open tab shows "matches of total".
  const counts = Object.fromEntries(
    CATEGORIES.filter((c) => c.id !== 'emoji').map((c) => {
      const total = items.filter((i) => inCategory(i, c.id)).length
      return [c.id, q && c.id === tab ? tr('of', visible.length, total) : total]
    })
  )

  // Ctrl+click starts a selection; while one exists, plain clicks keep adding to it.
  const toggleSelect = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const merge = async () => {
    await window.panel.mergeItems(selected)
    setSelected([])
    setToast({ text: tr('merged'), tone: 'ok' })
  }

  const card = (item) => (
    <ItemCard
      key={item.id}
      number={inList && shown.indexOf(item) < 9 ? shown.indexOf(item) + 1 : 0}
      lang={lang}
      item={item}
      selected={selected.includes(item.id)}
      expanded={expandedId === item.id}
      onCopiedPart={() => setToast({ text: tr('copiedPart'), tone: 'ok' })}
      onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
      onClick={(e) => (e.ctrlKey || selected.length ? toggleSelect(item.id) : copy(item))}
      onSplit={() => window.panel.splitItem(item.id)}
      onFixLayout={() => fixItemLayout(item)}
      onPasteAs={(convert) => pasteAs(item, convert)}
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
        data-drop={tr('dropToAdd')}
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
          <h1>{tr('clipboard')}</h1>
          <button
            className={`gear${tab === 'settings' ? ' active' : ''}`}
            title={tr('settings')}
            aria-label={tr('settings')}
            aria-pressed={tab === 'settings'}
            onClick={() => setTab(tab === 'settings' ? 'all' : 'settings')}
          >
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </button>
        </header>
        <TabStrip lang={lang} tab={tab} onPick={setTab} counts={counts} />
        {tab === 'settings' ? (
          <SettingsPanel lang={lang} settings={settings} items={items} onChange={updateSettings} />
        ) : tab === 'emoji' ? (
          <EmojiPanel lang={lang} onPick={pasteEmoji} />
        ) : (
        <>
        {selected.length > 0 ? (
          <div className="toolbar selection-bar" role="toolbar" aria-label={tr('selection')}>
            <span>{tr('selected', selected.length)}</span>
            <button className="primary" onClick={merge} disabled={selected.length < 2}>{tr('merge')}</button>
            <button onClick={() => setSelected([])}>{tr('cancel')}</button>
          </div>
        ) : (
        <div className="toolbar">
          <input
            ref={searchRef}
            className="search"
            type="search"
            dir="auto"
            placeholder={tr('search')}
            aria-label={tr('searchHistory')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {/* Clear empties the whole history (not just this tab), so it depends on all items. */}
          <button
            className={`clear${confirmClear ? ' confirm' : ''}`}
            title={tr('clearTitle')}
            onClick={clear}
            disabled={!items.some((i) => !i.pinned) && !confirmClear}
          >
            {confirmClear ? tr('confirm') : tr('clearAll')}
          </button>
        </div>
        )}
        {visible.length ? (
          <ul className="list">
            {pinned.length > 0 && (
              <li className="group group-toggle">
                <button aria-expanded={pinnedOpen} title={pinnedOpen ? tr('hidePinned') : tr('showPinned')} onClick={togglePinned}>
                  <span>{tr('pinned')} · {pinned.length}</span>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              </li>
            )}
            {pinnedOpen && pinned.map(card)}
            {pinned.length > 0 && recent.length > 0 && <li className="group">{tr('recent')} · {recent.length}</li>}
            {recent.map(card)}
          </ul>
        ) : (
          <div className="empty">
            <p>{q ? tr('noMatches') : tab === 'all' ? tr('nothingYet') : tr('noneInTab', tr(`cat.${tab}`))}</p>
            <small>{q ? tr('tryAnother') : tr('willShow')}</small>
          </div>
        )}
        </>
        )}
        {toast && <div className={`toast ${toast.tone}`} role="status">{toast.text}</div>}
      </aside>
    </div>
  )
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { t } from './i18n'
import { removeDiacritics, westernDigits } from './normalize'

const timeAgo = (lang, ms) => {
  const s = Math.round((Date.now() - ms) / 1000)
  if (s < 60) return t(lang, 'now')
  if (s < 3600) return t(lang, 'minutes', Math.floor(s / 60))
  if (s < 86400) return t(lang, 'hours', Math.floor(s / 3600))
  return t(lang, 'days', Math.floor(s / 86400))
}

const baseName = (p) => p.split(/[\\/]/).pop()

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)
const ICONS = {
  paste: 'M9 14l-4-4 4-4M5 10h11a4 4 0 0 1 4 4v4',
  pin: 'M12 17v5M9 3h6l-1 7 4 3v2H6v-2l4-3z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  split: 'M4 6h16M4 12h10M4 18h16M18 9l3 3-3 3',
  copy: 'M9 9h10v12H9zM5 15V3h10',
  swap: 'M4 8h15l-4-4M20 16H5l4 4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  rename: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  extract: 'M14 4h6v6M20 4l-8 8M10 5H5v14h14v-5',
  hash: 'M4 9h16M4 15h16M10 3L8 21M16 3l-2 18',
  file: 'M14 3H6v18h12V7zM14 3v4h4',
  doc: 'M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h6',
  audio: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0a3 3 0 0 1 6 0M20 16a3 3 0 1 1-6 0a3 3 0 0 1 6 0',
  video: 'M3 6h13v12H3zM16 10l5-3v10l-5-3'
}

const FILE_TYPES = {
  audio: /\.(mp3|wav|flac|aac|m4a|ogg|opus|wma)$/i,
  video: /\.(mp4|mkv|avi|mov|webm|wmv|m4v|flv)$/i,
  doc: /\.(pdf|docx?|odt|rtf|txt|md|xlsx?|ods|csv|pptx?|odp)$/i
}
const fileIcon = (name) => ICONS[Object.keys(FILE_TYPES).find((k) => FILE_TYPES[k].test(name)) || 'file']

/** Text of an item when it can be dragged as plain text (text, or a group made only of text). */
const plainText = (item) =>
  item.kind === 'text' ? item.text : item.kind === 'group' && item.parts.every((p) => p.kind === 'text') ? item.parts.map((p) => p.text).join('\n') : null

const FILES_SHOWN = 3

// "Paste as" choices for text cards; each pastes a converted copy and leaves the item itself unchanged.
const PASTE_AS = { pasteWesternDigits: westernDigits, pasteNoDiacritics: removeDiacritics }

function Preview({ lang, item, expanded = false, onPastePart, onExtractPart }) {
  // dir="auto" takes the direction from the first strong letter, so Arabic and mixed text read correctly.
  if (item.kind === 'text') return <p className="card-text" dir="auto">{item.text}</p>
  if (item.kind === 'image')
    return <img className="card-image" src={`clip://image/${item.image}`} alt={t(lang, 'imageAlt', item.width, item.height)} loading="lazy" />
  if (item.kind === 'files') {
    const shown = expanded ? item.files : item.files.slice(0, FILES_SHOWN)
    return (
      <ul className="card-files">
        {shown.map((f) => (
          <li key={f} title={f} dir="auto"><Icon d={fileIcon(f)} /><span>{baseName(f)}</span></li>
        ))}
        {shown.length < item.files.length && <li className="more">{t(lang, 'moreN', item.files.length - shown.length)}</li>}
      </ul>
    )
  }
  const parts = expanded ? item.parts : item.parts.slice(0, 3)
  return (
    <div className="group-parts">
      {parts.map((p) => (
        <div key={p.id} className="part">
          <Preview lang={lang} item={p} />
          {onPastePart && (
            <span className="part-actions">
              <button className="part-paste" title={t(lang, 'pastePartTitle')} aria-label={t(lang, 'pastePart')} onClick={(e) => (e.stopPropagation(), onPastePart(p.id))}>
                <Icon d={ICONS.paste} />
              </button>
              <button className="part-paste" title={t(lang, 'extractPartTitle')} aria-label={t(lang, 'extractPart')} onClick={(e) => (e.stopPropagation(), onExtractPart(p.id))}>
                <Icon d={ICONS.extract} />
              </button>
            </span>
          )}
        </div>
      ))}
      {parts.length < item.parts.length && <div className="more">{t(lang, 'moreN', item.parts.length - parts.length)}</div>}
    </div>
  )
}

const label = (lang, item) =>
  item.kind === 'group'
    ? t(lang, 'groupLabel', item.parts.length)
    : item.kind === 'files'
      ? t(lang, 'filesLabel', item.files.length)
      : item.kind === 'image'
        ? `⁦${item.width}×${item.height}⁩` // left-to-right isolate: width stays first in the Arabic interface
        : t(lang, 'charsLabel', item.text.length)

export default function ItemCard({ lang, number, item, selected, dropTarget, expanded, fresh, onToggleExpand, onCopiedPart, onClick, onPaste, onPastePart, onExtractPart, onRename, groupsOn = true, slots = {}, onSetSlot, onPin, onDelete, onSplit, onDragOut, onFixLayout, onPasteAs }) {
  // Buttons inside the card must not also trigger the card's own click action.
  const action = (fn) => (e) => {
    e.stopPropagation()
    fn()
  }
  // Text gets "More" only when it is actually cut off at 3 lines, so measure the rendered paragraph.
  const ref = useRef(null)
  const [clipped, setClipped] = useState(false)

  // Delete: the card fades and collapses in 150ms, so the cards below slide up into its place.
  const remove = () => {
    const el = ref.current
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return onDelete()
    el.style.overflow = 'hidden'
    el.style.pointerEvents = 'none'
    const gap = getComputedStyle(el.parentElement).rowGap
    el.animate(
      [
        { height: `${el.offsetHeight}px`, opacity: 1 },
        { height: '0px', opacity: 0, paddingBlock: '0px', borderWidth: '0px', marginBlockEnd: `-${gap}` }
      ],
      { duration: 150, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' }
    ).finished.then(onDelete)
  }
  useLayoutEffect(() => {
    const p = ref.current?.querySelector(':scope > .card-text')
    // A few px of slack: the text-size zoom rounds heights, which must not read as cut-off text.
    if (p && !expanded) setClipped(p.scrollHeight - p.clientHeight > 4)
  }, [item.text, expanded])
  const expandable = (item.kind === 'text' && clipped) || (item.kind === 'files' && item.files.length > FILES_SHOWN) || (item.kind === 'group' && item.parts.length > 3)
  // Naming a group happens in place; null when not editing.
  const [naming, setNaming] = useState(null)
  // Closing the box also blurs it; this keeps that blur from saving again (or saving after Esc).
  const namingDone = useRef(false)
  const finishNaming = (save) => {
    if (namingDone.current) return
    namingDone.current = true
    if (save) onRename(naming)
    setNaming(null)
  }
  const startNaming = () => ((namingDone.current = false), setNaming(item.name ?? ''))

  // Text cards are selectable, so a press-and-drag selects text; the grip in the footer drags the card instead.
  const isText = item.kind === 'text'
  const [menuOpen, setMenuOpen] = useState(false)
  const [slotMenu, setSlotMenu] = useState(false)
  const slotMenuRef = useRef(null)
  const menuRef = useRef(null)
  // A menu folds away in 150ms, like a deleted card, before it leaves the page.
  const fold = (el, done) => {
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return done()
    el.style.pointerEvents = 'none'
    el.animate([{ height: `${el.offsetHeight}px` }, { height: '0px', opacity: 0, paddingBlock: '0px' }], { duration: 150, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' }).finished.then(done)
  }
  const closeMenu = () => fold(menuRef.current, () => setMenuOpen(false))
  const closeSlotMenu = () => fold(slotMenuRef.current, () => setSlotMenu(false))
  // "More"/"Less": the card's height eases from what it was before the click to its new height.
  const fromHeight = useRef(null)
  const toggleExpand = () => ((fromHeight.current = ref.current?.offsetHeight), onToggleExpand())
  useLayoutEffect(() => {
    const el = ref.current
    const from = fromHeight.current
    fromHeight.current = el?.offsetHeight
    if (!el || from == null || from === el.offsetHeight || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.animate([{ height: `${from}px`, overflow: 'hidden' }, { height: `${el.offsetHeight}px`, overflow: 'hidden' }], { duration: 200, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' })
  }, [expanded])
  // A card near the bottom of the list would open its number menu out of sight.
  useEffect(() => {
    if (slotMenu) slotMenuRef.current?.scrollIntoView({ block: 'nearest' })
  }, [slotMenu])
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
      data-id={item.id}
      className={`card kind-${item.kind}${item.pinned ? ' pinned' : ''}${selected ? ' selected' : ''}${dropTarget ? ' drop-target' : ''}${expanded ? ' expanded' : ''}${fresh ? ' fresh' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      title={t(lang, isText ? 'textCardTitle' : 'cardTitle')}
      // Finishing a text selection also fires a click; that must not copy the whole card.
      onClick={(e) => !selectionInside() && onClick(e)}
      onMouseLeave={() => (closeMenu(), closeSlotMenu())}
      draggable={!isText && naming === null}
      onDragStart={isText ? undefined : startDrag}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onPaste()
        else if (e.key === ' ') onClick(e)
      }}
    >
      {/* Pinned cards also carry a small pin, so they are told apart without relying on colour. */}
      {item.pinned && (
        <svg className="pin-mark" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={ICONS.pin} />
        </svg>
      )}
      {naming !== null ? (
        <input
          className="group-name-input"
          dir="auto"
          autoFocus
          maxLength={60}
          value={naming}
          placeholder={t(lang, 'groupNamePlaceholder')}
          aria-label={t(lang, 'renameGroup')}
          onChange={(e) => setNaming(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          // Keys stay in the box: Enter and Esc must not paste the card or close the panel.
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') finishNaming(true)
            else if (e.key === 'Escape') finishNaming(false)
          }}
          onBlur={() => finishNaming(true)}
        />
      ) : (
        item.name && <p className="group-name" dir="auto">{item.name}</p>
      )}
      <Preview lang={lang} item={item} expanded={expanded} onPastePart={item.kind === 'group' && groupsOn ? onPastePart : undefined} onExtractPart={onExtractPart} />
      {expandable && (
        <button className="more-toggle" aria-expanded={expanded} onClick={action(toggleExpand)}>
          {t(lang, expanded ? 'less' : 'more')}
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={expanded ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
          </svg>
        </button>
      )}
      {selection.trim() && (
        // mousedown is cancelled so pressing the button does not clear the selection first.
        <button className="copy-selection" onMouseDown={(e) => e.preventDefault()} onClick={action(copySelection)}>
          <Icon d={ICONS.copy} />
          {t(lang, 'copySelection')}
        </button>
      )}
      <footer>
        {isText && (
          <span className="grip" draggable onDragStart={startDrag} title={t(lang, 'dragText')} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
          </span>
        )}
        {number > 0 && <kbd className="number" title={t(lang, 'quickPaste', number)}>{number}</kbd>}
        {/* The program it was copied from, beside the size; bdi keeps a Latin name whole inside Arabic text. */}
        <span className="kind" title={item.app ?? undefined}>
          {item.app && (
            <>
              <bdi>{item.app.replace(/\.exe$/i, '')}</bdi> ·{' '}
            </>
          )}
          {label(lang, item)}
        </span>
        <span className="time">{timeAgo(lang, item.createdAt)}</span>
        <div className="actions">
          <button title={t(lang, 'pasteTitle')} aria-label={t(lang, 'paste')} onClick={action(onPaste)}><Icon d={ICONS.paste} /></button>
          {isText && (
            <button title={t(lang, 'pasteAs')} aria-label={t(lang, 'pasteAs')} aria-haspopup="menu" aria-expanded={menuOpen} onClick={action(() => (closeSlotMenu(), menuOpen ? closeMenu() : setMenuOpen(true)))}><Icon d={ICONS.more} /></button>
          )}
          {isText && (
            <button title={t(lang, 'fixLayoutTitle')} aria-label={t(lang, 'fixLayout')} onClick={action(onFixLayout)}><Icon d={ICONS.swap} /></button>
          )}
          {item.kind === 'group' && groupsOn && (
            <button title={t(lang, 'renameGroup')} aria-label={t(lang, 'renameGroup')} onClick={action(startNaming)}><Icon d={ICONS.rename} /></button>
          )}
          {item.kind === 'group' && (
            <button title={t(lang, 'splitTitle')} aria-label={t(lang, 'split')} onClick={action(onSplit)}><Icon d={ICONS.split} /></button>
          )}
          <button title={t(lang, 'slotTitle')} aria-label={t(lang, 'slotTitle')} aria-haspopup="menu" aria-expanded={slotMenu} className={item.slot ? 'on' : ''} onClick={action(() => (closeMenu(), slotMenu ? closeSlotMenu() : setSlotMenu(true)))}><Icon d={ICONS.hash} /></button>
          <button title={t(lang, item.pinned ? 'unpin' : 'pinTitle')} aria-label={t(lang, item.pinned ? 'unpin' : 'pin')} aria-pressed={item.pinned} className={item.pinned ? 'on' : ''} onClick={action(onPin)}><Icon d={ICONS.pin} /></button>
          <button title={t(lang, 'delete')} aria-label={t(lang, 'delete')} className="danger" onClick={action(remove)}><Icon d={ICONS.trash} /></button>
        </div>
      </footer>
      {slotMenu && (
        <div ref={slotMenuRef} className="paste-menu slot-menu" role="menu" aria-label={t(lang, 'slotTitle')} onAnimationEnd={(e) => e.target === e.currentTarget && e.target.scrollIntoView({ block: 'nearest' })}>
          <div className="slot-grid">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
              const holder = slots[n]
              const mine = holder?.id === item.id
              return (
                <button
                  key={n}
                  role="menuitemradio"
                  aria-checked={mine}
                  className={mine ? 'active' : holder ? 'taken' : ''}
                  title={mine ? t(lang, 'quickPaste', n) : holder ? t(lang, 'slotTaken', n, holder.name ?? holder.text?.replace(/\s+/g, ' ').slice(0, 40) ?? label(lang, holder)) : `Alt+${n}`}
                  onClick={action(() => (closeSlotMenu(), mine || onSetSlot(n)))}
                >
                  {n}
                </button>
              )
            })}
          </div>
          {item.slot && (
            <button role="menuitem" onClick={action(() => (closeSlotMenu(), onSetSlot(null)))}>
              {t(lang, 'slotRemove')}
            </button>
          )}
        </div>
      )}
      {menuOpen && (
        <div ref={menuRef} className="paste-menu" role="menu">
          {Object.entries(PASTE_AS).map(([key, fn]) => (
            // Greyed out when the conversion would change nothing in this text.
            <button key={key} role="menuitem" disabled={fn(item.text) === item.text} onClick={action(() => (closeMenu(), onPasteAs(fn)))}>
              {t(lang, key)}
            </button>
          ))}
        </div>
      )}
    </li>
  )
}

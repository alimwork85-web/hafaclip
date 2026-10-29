import { useEffect, useState } from 'react'
import { HANDLE_COLORS, handleBackground, PANEL_WIDTHS } from './hotZone'
import { t } from './i18n'
import { pruneItems } from '../../main/history'
import { version } from '../../../package.json'

const DELAYS = { 0: 'instant', 300: 'short', 600: 'long' }
// The font names show in their own font, so the choice previews itself.
export const FONTS = {
  system: "'Segoe UI Variable', 'Segoe UI', sans-serif",
  plex: "'IBM Plex Sans Arabic', 'Segoe UI', sans-serif",
  cairo: "'Cairo', 'Segoe UI', sans-serif",
  tajawal: "'Tajawal', 'Segoe UI', sans-serif"
}

function Choice({ lang, label, value, options, onPick, labelOf = (o) => t(lang, `opt.${o}`), styleOf }) {
  return (
    <div className="setting">
      <span className="setting-label">{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o} className={o === value ? 'active' : ''} aria-pressed={o === value} style={styleOf?.(o)} onClick={() => onPick(o)}>
            {labelOf(o)}
          </button>
        ))}
      </div>
    </div>
  )
}

/** "Control+Alt+E" from a key press, or null for keys a shortcut cannot use (or a lone modifier). */
function acceleratorOf(e) {
  const key = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : /^Digit\d$/.test(e.code) ? e.code.slice(5) : /^F\d{1,2}$/.test(e.code) || e.code === 'Space' ? e.code : null
  if (!key) return null
  return [e.ctrlKey && 'Control', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super', key].filter(Boolean).join('+')
}

function ShortcutSetting({ lang, shortcut }) {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!recording) return
    const onKey = async (e) => {
      e.preventDefault()
      e.stopPropagation() // Esc here cancels recording instead of closing the panel
      if (e.key === 'Escape') return setRecording(false)
      const accelerator = acceleratorOf(e)
      if (!accelerator) return
      setRecording(false)
      const r = await window.panel.setShortcut(accelerator)
      setError(r.ok ? '' : t(lang, r.error))
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [recording, lang])

  return (
    <>
      <div className="setting">
        <span className="setting-label">{t(lang, 'openWithKeyboard')}</span>
        <span className="keys">
          {recording ? (
            t(lang, 'pressKeys')
          ) : (
            <span className="keys-list" dir="ltr">
              {shortcut.split('+').map((k, i) => (
                <span key={k}>
                  {i > 0 && '+ '}
                  <kbd>{{ Control: 'Ctrl', Super: 'Win' }[k] ?? k}</kbd>
                </span>
              ))}
            </span>
          )}
          {!recording && <button onClick={() => (setError(''), setRecording(true))}>{t(lang, 'change')}</button>}
        </span>
      </div>
      {error && <p className="settings-note" role="alert">{error}</p>}
    </>
  )
}

export default function SettingsPanel({ lang, settings, items, onChange }) {
  // Lowering the history limit or turning on auto-delete removes items, so it takes a second click.
  const [pending, setPending] = useState(null)
  const pickHistoryRule = (key, value) => {
    const next = { historyLimit: settings.historyLimit, autoDeleteDays: settings.autoDeleteDays, [key]: value }
    const count = pruneItems(items, next.historyLimit, next.autoDeleteDays).evicted.length
    if (count && !(pending?.key === key && pending.value === value)) return setPending({ key, value, count })
    setPending(null)
    onChange({ [key]: value })
  }
  const choice = (key, options, extra) => (
    <Choice lang={lang} label={t(lang, key)} value={settings[key]} options={options} onPick={(v) => onChange({ [key]: v })} {...extra} />
  )
  const capture = { captureText: 'cat.text', captureImages: 'cat.images', captureFiles: 'cat.files' }
  const [ocrLanguages, setOcrLanguages] = useState(null)
  useEffect(() => {
    window.panel.ocrLanguages?.().then(setOcrLanguages)
  }, [])
  // Programs seen in the history plus the ignored ones (which no longer appear in it); a click toggles ignoring.
  const ignored = settings.ignoredApps ?? []
  const knownApps = [...new Set([...ignored, ...items.map((i) => i.app).filter(Boolean)])].sort()
  const toggleApp = (a) => onChange({ ignoredApps: ignored.includes(a) ? ignored.filter((x) => x !== a) : [...ignored, a] })

  return (
    <div className="settings">
      <div className="group">{t(lang, 'panel')}</div>
      {choice('language', ['system', 'en', 'ar'])}
      {choice('checkUpdates', [true, false], { labelOf: (o) => t(lang, o ? 'on' : 'off') })}
      <Choice lang={lang} label={t(lang, 'screenEdge')} value={settings.edge} options={['left', 'right']} onPick={(edge) => onChange({ edge })} />
      {settings.shortcut && <ShortcutSetting lang={lang} shortcut={settings.shortcut} />}
      {choice('openDelay', [0, 300, 600], { labelOf: (o) => t(lang, `opt.${DELAYS[o]}`) })}

      <div className="group">{t(lang, 'appearance')}</div>
      {choice('theme', ['light', 'dark', 'ocean', 'forest', 'sand'])}
      {choice('font', Object.keys(FONTS), { styleOf: (o) => ({ fontFamily: FONTS[o] }) })}
      {choice('textSize', ['small', 'medium', 'large'])}
      {choice('density', ['compact', 'comfortable'])}
      {choice('panelWidth', Object.keys(PANEL_WIDTHS))}
      {choice('panelHeight', ['large', 'medium', 'small'], { labelOf: (o) => t(lang, `height.${o}`) })}

      <div className="group">{t(lang, 'history')}</div>
      <Choice lang={lang} label={t(lang, 'historyLimit')} value={settings.historyLimit} options={[250, 500, 750, 1000]} labelOf={String} onPick={(v) => pickHistoryRule('historyLimit', v)} />
      <Choice
        lang={lang}
        label={t(lang, 'autoDelete')}
        value={settings.autoDeleteDays}
        options={[0, 30, 40]}
        labelOf={(o) => (o ? t(lang, 'nDays', o) : t(lang, 'off'))}
        onPick={(v) => pickHistoryRule('autoDeleteDays', v)}
      />
      {pending && <p className="settings-note" role="alert">{t(lang, 'removeWarn', pending.count)}</p>}
      <div className="setting">
        <span className="setting-label">{t(lang, 'capture')}</span>
        <div className="segmented" role="group" aria-label={t(lang, 'capture')}>
          {Object.entries(capture).map(([key, label]) => (
            <button key={key} className={settings[key] !== false ? 'active' : ''} aria-pressed={settings[key] !== false} onClick={() => onChange({ [key]: settings[key] === false })}>
              {t(lang, label)}
            </button>
          ))}
        </div>
      </div>
      {choice('searchImageText', [true, false], { labelOf: (o) => t(lang, o ? 'on' : 'off') })}
      {choice('groups', [true, false], { labelOf: (o) => t(lang, o ? 'on' : 'off') })}
      {settings.groups === false && <p className="settings-note info">{t(lang, 'groupsOffHint')}</p>}
      {settings.searchImageText !== false && ocrLanguages && !ocrLanguages.some((l) => l.startsWith('ar')) && <p className="settings-note info">{t(lang, 'ocrNoArabic')}</p>}
      <div className="setting">
        <span className="setting-label">{t(lang, 'ignoreApps')}</span>
        <div className="app-chips" role="group" aria-label={t(lang, 'ignoreApps')}>
          {knownApps.map((a) => (
            <button key={a} dir="ltr" className={ignored.includes(a) ? 'active' : ''} aria-pressed={ignored.includes(a)} onClick={() => toggleApp(a)}>
              {a.replace(/\.exe$/, '')}
            </button>
          ))}
        </div>
      </div>
      <p className="settings-note info">{t(lang, knownApps.length ? 'ignoreAppsHint' : 'ignoreAppsEmpty')}</p>
      <div className="setting">
        <span className="setting-label">{t(lang, 'dataFolder')}</span>
        <button className="link-button" onClick={() => window.panel.openDataFolder()}>{t(lang, 'openFolder')}</button>
      </div>
      <p className="settings-note info">{t(lang, 'dataFolderHint')}</p>

      <div className="group">{t(lang, 'edgeHandle')}</div>
      <Choice lang={lang} label={t(lang, 'length')} value={settings.handleLength} options={['short', 'medium', 'long']} onPick={(handleLength) => onChange({ handleLength })} />
      <Choice lang={lang} label={t(lang, 'thickness')} value={settings.handleThickness} options={['thin', 'medium', 'thick']} onPick={(handleThickness) => onChange({ handleThickness })} />
      <div className="setting">
        <span className="setting-label">{t(lang, 'color')}</span>
        <div className="swatches" role="radiogroup" aria-label={t(lang, 'handleColor')}>
          {Object.entries(HANDLE_COLORS).map(([name, [a, b]]) => (
            <button
              key={name}
              role="radio"
              aria-checked={settings.handleColor === name}
              aria-label={t(lang, `color.${name}`)}
              title={t(lang, `color.${name}`)}
              className={`swatch${settings.handleColor === name ? ' active' : ''}`}
              style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
              onClick={() => onChange({ handleColor: name })}
            />
          ))}
        </div>
      </div>
      {/* A second colour for the top and bottom of the handle; "same" keeps it one colour. */}
      <div className="setting">
        <span className="setting-label">{t(lang, 'handleEnds')}</span>
        <div className="swatches" role="radiogroup" aria-label={t(lang, 'handleEnds')}>
          {['same', ...Object.keys(HANDLE_COLORS)].map((name) => {
            const on = (settings.handleEndsColor ?? 'same') === name
            return (
              <button
                key={name}
                role="radio"
                aria-checked={on}
                aria-label={t(lang, name === 'same' ? 'sameColor' : `color.${name}`)}
                title={t(lang, name === 'same' ? 'sameColor' : `color.${name}`)}
                className={`swatch${name === 'same' ? ' same' : ''}${on ? ' active' : ''}`}
                style={{ background: handleBackground(name === 'same' ? settings.handleColor : name).replace('linear-gradient(', 'linear-gradient(135deg, ') }}
                onClick={() => onChange({ handleEndsColor: name })}
              />
            )
          })}
        </div>
      </div>

      <p className="about" dir="ltr">HafaClip {version} · Ali Alhumedi</p>
    </div>
  )
}

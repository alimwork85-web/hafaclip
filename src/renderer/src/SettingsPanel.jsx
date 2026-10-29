import { HANDLE_COLORS } from './hotZone'
import { t } from './i18n'

function Choice({ lang, label, value, options, onPick }) {
  return (
    <div className="setting">
      <span className="setting-label">{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o} className={o === value ? 'active' : ''} aria-pressed={o === value} onClick={() => onPick(o)}>
            {t(lang, `opt.${o}`)}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function SettingsPanel({ lang, settings, onChange }) {
  return (
    <div className="settings">
      <div className="group">{t(lang, 'panel')}</div>
      <Choice lang={lang} label={t(lang, 'language')} value={settings.language} options={['system', 'en', 'ar']} onPick={(language) => onChange({ language })} />
      <Choice lang={lang} label={t(lang, 'screenEdge')} value={settings.edge} options={['left', 'right']} onPick={(edge) => onChange({ edge })} />
      <div className="setting">
        <span className="setting-label">{t(lang, 'openWithKeyboard')}</span>
        <span className="keys" dir="ltr"><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>E</kbd></span>
      </div>

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
    </div>
  )
}

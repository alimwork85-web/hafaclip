import { HANDLE_COLORS } from './hotZone'

const cap = (s) => s[0].toUpperCase() + s.slice(1)

function Choice({ label, value, options, onPick }) {
  return (
    <div className="setting">
      <span className="setting-label">{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o} className={o === value ? 'active' : ''} aria-pressed={o === value} onClick={() => onPick(o)}>
            {cap(o)}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function SettingsPanel({ settings, onChange }) {
  return (
    <div className="settings">
      <div className="group">Panel</div>
      <Choice label="Screen edge" value={settings.edge} options={['left', 'right']} onPick={(edge) => onChange({ edge })} />
      <div className="setting">
        <span className="setting-label">Open with keyboard</span>
        <span className="keys"><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>E</kbd></span>
      </div>

      <div className="group">Edge handle</div>
      <Choice label="Length" value={settings.handleLength} options={['short', 'medium', 'long']} onPick={(handleLength) => onChange({ handleLength })} />
      <Choice label="Thickness" value={settings.handleThickness} options={['thin', 'medium', 'thick']} onPick={(handleThickness) => onChange({ handleThickness })} />
      <div className="setting">
        <span className="setting-label">Color</span>
        <div className="swatches" role="radiogroup" aria-label="Handle color">
          {Object.entries(HANDLE_COLORS).map(([name, [a, b]]) => (
            <button
              key={name}
              role="radio"
              aria-checked={settings.handleColor === name}
              aria-label={cap(name)}
              title={cap(name)}
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

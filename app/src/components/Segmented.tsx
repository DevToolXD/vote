import { sx } from '../css'

const SPRING = 'cubic-bezier(0.32,0.72,0,1)'

/** The iOS segmented control: a grey track, and a white thumb that slides to the chosen one. */
export function Segmented<T extends string>({ items, value, onChange, dark = false, label }: { items: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void; dark?: boolean; label: string }) {
  const n = items.length, idx = Math.max(0, items.findIndex(([k]) => k === value))
  return (
    <div role="tablist" aria-label={label} style={sx('position:relative;display:grid;height:36px;padding:2px;border-radius:10px;box-sizing:border-box;transition:background 300ms', { gridTemplateColumns: `repeat(${n},1fr)`, background: dark ? '#1c1c1e' : 'rgba(118,118,128,0.12)' })}>
      <span aria-hidden="true" style={sx(`position:absolute;top:2px;bottom:2px;left:2px;border-radius:8px;transition:transform 420ms ${SPRING},background 300ms;will-change:transform`, {
        width: `calc((100% - 4px) / ${n})`, transform: `translateX(${idx * 100}%)`, background: dark ? '#636366' : '#ffffff', boxShadow: dark ? 'none' : '0 3px 8px rgba(0,0,0,0.12),0 3px 1px rgba(0,0,0,0.04)',
      })} />
      {items.map(([k, l]) => (
        <button key={k} role="tab" aria-selected={k === value} onClick={() => onChange(k)}
          style={sx('position:relative;z-index:1;font-size:14px;line-height:18px;font-weight:600;letter-spacing:-0.1px;transition:color 250ms', { color: dark ? '#ffffff' : '#000000', opacity: 1 })}>
          {l}
        </button>
      ))}
    </div>
  )
}

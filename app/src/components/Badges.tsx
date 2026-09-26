import { useState } from 'react'
import { css, sx } from '../css'
import { hasPass } from '../backend/candidates'

type BadgeDef = { key: string; label: string; desc: string; bg: string; fg: string }

/** Badges for what someone owns (passes), shown on profiles under the bio, above the id. */
export function badgesOf(p: { pass2x?: boolean | number }): BadgeDef[] {
  const out: BadgeDef[] = []
  if (hasPass(p)) out.push({ key: 'pass2x', label: '×2', desc: '투표 2배권 · 한 사람에게 일주일에 두 번 투표할 수 있어요', bg: 'linear-gradient(135deg,#1b64da,#6a3cf0)', fg: '#ffffff' })
  return out
}

/** A row of badges; hovering (or tapping) one shows what it is. */
export function Badges({ person, style }: { person: { pass2x?: boolean | number }; style?: string }) {
  const list = badgesOf(person)
  const [open, setOpen] = useState<string | null>(null)
  if (!list.length) return null
  return (
    <span style={css('display:flex;flex-wrap:wrap;gap:6px;' + (style ?? ''))}>
      {list.map(b => (
        <span key={b.key} style={css('position:relative;display:inline-flex')}
          onMouseEnter={() => setOpen(b.key)} onMouseLeave={() => setOpen(o => (o === b.key ? null : o))}>
          <button type="button" className="pr-94" title={b.desc} aria-label={b.desc} onClick={() => setOpen(o => (o === b.key ? null : b.key))}
            style={sx('height:22px;min-width:30px;padding:0 8px;border-radius:9999px;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center', { background: b.bg, color: b.fg })}>{b.label}</button>
          {open === b.key && (
            <span role="tooltip" style={css('position:absolute;bottom:calc(100% + 6px);left:0;z-index:5;width:max-content;max-width:220px;padding:8px 10px;border-radius:10px;background:#191f28;color:#fff;font-size:12px;line-height:17px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,0.18);animation:fade 150ms ease both')}>{b.desc}</span>
          )}
        </span>
      ))}
    </span>
  )
}

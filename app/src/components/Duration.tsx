import { css } from '../css'

// 일 / 시간 / 분 / 초 input, shared by the chat 타임아웃 and the admin's 거래 정지.

/** "1일 2시간", "5분 20초", "40초": the largest units that aren't zero (at most `parts`). */
export function durationLabel(sec: number, parts = 4) {
  const units: [number, string][] = [[Math.floor(sec / 86400), '일'], [Math.floor(sec / 3600) % 24, '시간'], [Math.floor(sec / 60) % 60, '분'], [sec % 60, '초']]
  const first = units.findIndex(([n]) => n > 0)
  return units.slice(Math.max(0, first), Math.max(0, first) + parts).filter(([n]) => n > 0).map(([n, u]) => n + u).join(' ') || '0초'
}
/** Time left, to the second: two units at most. */
export const leftLabel = (ms: number) => durationLabel(Math.max(1, Math.ceil(ms / 1000)), 2)

export type Dhms = { d: string; h: string; m: string; s: string }
export const toDhms = (sec: number): Dhms => ({ d: String(Math.floor(sec / 86400) || ''), h: String(Math.floor(sec / 3600) % 24 || ''), m: String(Math.floor(sec / 60) % 60 || ''), s: String(sec % 60 || '') })
export const dhmsSeconds = (v: Dhms) => Number(v.d || 0) * 86400 + Number(v.h || 0) * 3600 + Number(v.m || 0) * 60 + Number(v.s || 0)

export function DurationInput({ value, onChange, maxDays, presets }: { value: Dhms; onChange: (v: Dhms) => void; maxDays: number; presets: [number, string][] }) {
  const field = (k: keyof Dhms, unit: string, max: number) => (
    <label data-g="l1" className="ring-within" style={css('flex:1;min-width:0;height:60px;border-radius:14px;background:#f2f4f6;padding:0 10px;display:flex;align-items:center;gap:4px')}>
      <input inputMode="numeric" aria-label={unit} value={value[k]} placeholder="0"
        onChange={e => { const n = e.target.value.replace(/[^0-9]/g, '').slice(0, 4); onChange({ ...value, [k]: n === '' ? '' : String(Math.min(max, Number(n))) }) }}
        style={css('flex:1;min-width:0;width:100%;border:0;outline:none;background:transparent;font:inherit;font-size:22px;font-weight:700;color:#191f28;text-align:right;font-variant-numeric:tabular-nums')} />
      <span style={css('flex:none;font-size:15px;font-weight:600;color:#6b7684')}>{unit}</span>
    </label>
  )
  return (
    <>
      <div style={css('display:flex;gap:6px')}>
        {field('d', '일', maxDays)}{field('h', '시간', 23)}{field('m', '분', 59)}{field('s', '초', 59)}
      </div>
      <div className="anim-list" style={css('padding-top:12px;display:flex;gap:6px;flex-wrap:wrap')}>
        {presets.map(([n, label]) => (
          <button key={label} type="button" className="pr-96" onClick={() => onChange(toDhms(n))} style={css('height:34px;padding:0 14px;border-radius:9999px;background:#f2f4f6;color:#4e5968;font-size:14px;font-weight:600')}>{label}</button>
        ))}
      </div>
    </>
  )
}

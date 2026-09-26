import { css } from '../css'

/** 9,999 → "9,999", 12,345 → "1.2만", 123,456 → "12만", 123,456,789 → "1.2억": fits any header. */
export function shortPoints(n: number) {
  const a = Math.abs(n), sign = n < 0 ? '-' : ''
  const one = (v: number) => (v < 10 ? (Math.floor(v * 10) / 10).toString() : Math.floor(v).toLocaleString())
  if (a < 10_000) return n.toLocaleString()
  if (a < 100_000_000) return sign + one(a / 10_000) + '만'
  return sign + one(a / 100_000_000) + '억'
}

/** "Ⓟ 1,234P" — my points, shown in the headers (abbreviated when large). */
export function PointsChip({ points, onClick }: { points: number; onClick?: () => void }) {
  return (
    <button className="pr-96" onClick={onClick} aria-label={`내 포인트 ${points.toLocaleString()}P`} style={css('height:32px;padding:0 12px 0 6px;border-radius:9999px;background:#fff4d6;color:#8a5a00;font-size:14px;font-weight:700;display:flex;align-items:center;gap:6px;font-variant-numeric:tabular-nums;white-space:nowrap;flex:none;transition:transform 150ms')}>
      <span style={css('width:20px;height:20px;border-radius:9999px;background:#ffc342;color:#5c3d00;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center')}>P</span>
      {shortPoints(points)}P
    </button>
  )
}

import { css } from '../css'

// Korean big-number units, every 10⁴ up to 정 (10⁴⁰).
const UNITS: [number, string][] = [[1e40, '정'], [1e36, '간'], [1e32, '구'], [1e28, '양'], [1e24, '자'], [1e20, '해'], [1e16, '경'], [1e12, '조'], [1e8, '억'], [1e4, '만']]
/** 9,999 → "9,999", 17,300 → "1.7만", 123,456 → "12만", 1.7×10⁴⁰ → "1.7정" (past 정 the count of 정 grows: "12,345정"). */
export function shortPoints(n: number) {
  const a = Math.abs(n), sign = n < 0 ? '-' : ''
  const u = UNITS.find(([v]) => a >= v)
  if (!u) return n.toLocaleString()
  const v = a / u[0]
  return sign + (v < 10 ? (Math.floor(v * 10) / 10).toString() : Math.floor(v).toLocaleString()) + u[1]
}

/** "1,234P" — my points as plain text in the headers; tap for 포인트 얻는 법. */
export function PointsChip({ points, onClick }: { points: number; onClick?: () => void }) {
  return (
    <button className="pr-96" onClick={onClick} aria-label={`내 포인트 ${points.toLocaleString()}P, 포인트 얻는 법 보기`} style={css('height:32px;padding:0 4px;color:#191f28;font-size:16px;font-weight:700;display:flex;align-items:center;font-variant-numeric:tabular-nums;white-space:nowrap;flex:none;transition:transform 150ms')}>
      {shortPoints(points)}P
    </button>
  )
}

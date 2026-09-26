import { css } from '../css'

/** "Ⓟ 1,234P" — my points, shown in the home and account headers. */
export function PointsChip({ points, onClick }: { points: number; onClick?: () => void }) {
  return (
    <button className="pr-96" onClick={onClick} aria-label={`내 포인트 ${points.toLocaleString()}P`} style={css('height:32px;padding:0 12px 0 6px;border-radius:9999px;background:#fff4d6;color:#8a5a00;font-size:14px;font-weight:700;display:flex;align-items:center;gap:6px;font-variant-numeric:tabular-nums;transition:transform 150ms')}>
      <span style={css('width:20px;height:20px;border-radius:9999px;background:#ffc342;color:#5c3d00;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center')}>P</span>
      {points.toLocaleString()}P
    </button>
  )
}

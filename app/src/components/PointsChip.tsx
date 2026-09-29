import { css } from '../css'

/** "1,234P" — my points as plain text in the headers; tap for 포인트 얻는 법. */
export function PointsChip({ points, onClick }: { points: number; onClick?: () => void }) {
  return (
    <button className="pr-96" onClick={onClick} aria-label={`내 포인트 ${points.toLocaleString()}P, 포인트 얻는 법 보기`} style={css('height:32px;padding:0 4px;color:#191f28;font-size:16px;font-weight:700;display:flex;align-items:center;font-variant-numeric:tabular-nums;white-space:nowrap;flex:none;transition:transform 150ms')}>
      {points.toLocaleString()}P
    </button>
  )
}

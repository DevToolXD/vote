import { css, sx } from '../css'
import type { AdminProgress } from '../backend/admin'

/** Full-screen blocker while an admin op runs, showing the three token checks per batch. */
export function AdminProgressOverlay({ label, p }: { label: string; p: AdminProgress }) {
  return (
    <div style={css('position:fixed;inset:0;z-index:500;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;padding:24px;animation:fade 200ms ease both')}>
      <div data-g="l4" role="status" aria-live="polite" style={css('width:100%;max-width:320px;background:#fff;border-radius:24px;padding:28px 24px;display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center')}>
        <span style={css('font-size:18px;font-weight:700;color:#191f28')}>{label} 중이에요</span>
        <div style={css('display:flex;gap:10px')}>
          {[1, 2, 3].map(i => (
            <span key={i} style={sx('width:40px;height:40px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;transition:background 200ms,color 200ms', { background: p.verified >= i ? '#3182f6' : '#f2f4f6', color: p.verified >= i ? '#fff' : '#b0b8c1' })}>
              {p.verified >= i ? '✓' : i}
            </span>
          ))}
        </div>
        <span style={css('font-size:14px;line-height:21px;color:#6b7684')}>
          보안 토큰 확인 {p.verified}/3{p.batches > 1 ? ` · 묶음 ${p.batch}/${p.batches}` : ''}
        </span>
      </div>
    </div>
  )
}

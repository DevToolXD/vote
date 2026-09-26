import { useState } from 'react'
import { css, sx } from '../css'
import type { Notice } from '../backend/notices'

const EASE = 'cubic-bezier(0.16,1,0.3,1)'

/** 공지: shown full-screen once to each signed-in person. */
export function NoticeScreen({ notice, onDone }: { notice: Notice; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const date = notice.createdAt ? notice.createdAt.toDate().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : ''
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="notice-title" style={css(`position:fixed;inset:0;z-index:350;display:flex;justify-content:center;background:#ffffff;animation:fade 240ms ease both`)}>
      <div data-g="app" style={css(`width:100%;max-width:430px;height:100%;display:flex;flex-direction:column;animation:listIn 480ms ${EASE} both`)}>
        <div style={css('flex:1;overflow-y:auto;padding:calc(56px + env(safe-area-inset-top)) 24px 24px;display:flex;flex-direction:column;gap:12px')}>
          <span style={css('align-self:flex-start;height:26px;padding:0 10px;border-radius:9999px;background:#e8f3ff;color:#1b64da;font-size:13px;font-weight:700;display:flex;align-items:center')}>공지</span>
          <h1 id="notice-title" style={css('margin:4px 0 0;font-size:26px;line-height:35px;font-weight:700;color:#191f28;word-break:keep-all')}>{notice.title}</h1>
          {date && <span style={css('font-size:13px;line-height:19.5px;color:#8b95a1')}>{date}</span>}
          <p style={css('margin:12px 0 0;font-size:17px;line-height:28px;color:#333d4b;white-space:pre-wrap;word-break:break-word')}>{notice.body}</p>
        </div>
        <div style={css('flex:none;padding:12px 20px calc(20px + env(safe-area-inset-bottom))')}>
          <span style={css('display:block;margin-bottom:10px;text-align:center;font-size:13px;color:#8b95a1')}>이 공지는 한 번만 볼 수 있어요</span>
          <button data-g="primary" className="pr-96" disabled={busy} onClick={async () => { setBusy(true); try { await onDone() } finally { setBusy(false) } }}
            style={sx(`width:100%;height:56px;border-radius:16px;background:#3182f6;color:#fff;font-size:17px;font-weight:600;transition:opacity 200ms ${EASE}`, { opacity: busy ? 0.5 : 1 })}>확인했어요</button>
        </div>
      </div>
    </div>
  )
}

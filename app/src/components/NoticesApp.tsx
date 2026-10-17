import { useEffect, useState } from 'react'
import type { Firestore } from 'firebase/firestore'
import { css, sx } from '../css'
import { loadNotices, type Notice } from '../backend/notices'

const EASE = 'cubic-bezier(0.22,1,0.36,1)'
const dateOf = (n: Notice) => (n.createdAt ? n.createdAt.toDate().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '')

/** 공지 (on every phone): every notice that was posted, newest first; a tap opens it. */
export function NoticesApp({ db, ids, loggedIn, onLogin, bare = false }: { db: Firestore | null; ids: string[]; loggedIn: boolean; onLogin: () => void; bare?: boolean }) {
  const [list, setList] = useState<Notice[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const key = ids.join()
  useEffect(() => {
    if (!db || !loggedIn) { setList([]); return }
    let live = true
    loadNotices(db, ids).then(l => { if (live) setList(l) })
    return () => { live = false }
  }, [db, key, loggedIn]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={css('flex:1;min-height:0;overflow-y:auto;background:#f2f4f6;padding:8px 16px calc(24px + env(safe-area-inset-bottom))')}>
      {!bare && <div style={css('padding:8px 4px 12px;font-size:28px;line-height:36px;font-weight:700;color:#191f28')}>공지</div>}
      {!loggedIn && (
        <div style={css('padding:40px 0;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px;font-size:15px;color:#6b7684')}>
          로그인하면 공지를 볼 수 있어요
          <button className="pr-96" onClick={onLogin} style={css('height:44px;padding:0 20px;border-radius:12px;background:#3182f6;color:#fff;font-size:15px;font-weight:600')}>로그인하기</button>
        </div>
      )}
      {loggedIn && list === null && <div style={css('padding:40px 0;text-align:center;font-size:15px;color:#8b95a1')}>불러오는 중이에요…</div>}
      {loggedIn && list?.length === 0 && <div style={css('padding:40px 0;text-align:center;font-size:15px;color:#8b95a1')}>아직 올라온 공지가 없어요</div>}
      <div className="anim-list" style={css('display:flex;flex-direction:column;gap:10px')}>
        {list?.map(n => {
          const on = open === n.id
          return (
            <button key={n.id} className="pr-98" onClick={() => setOpen(on ? null : n.id)} aria-expanded={on}
              style={css('text-align:left;padding:16px 18px;border-radius:18px;background:#fff;display:flex;flex-direction:column;gap:6px;width:100%')}>
              <span style={css('display:flex;align-items:center;gap:8px')}>
                <span style={css('flex:1;min-width:0;font-size:17px;line-height:25px;font-weight:700;color:#191f28;word-break:keep-all')}>{n.title}</span>
                {n.options?.length ? <span style={css('flex:none;height:22px;padding:0 8px;border-radius:9999px;background:#e8f3ff;color:#1b64da;font-size:12px;font-weight:700;display:flex;align-items:center')}>투표</span> : null}
                <svg width="10" height="16" viewBox="0 0 10 16" fill="none" stroke="#b0b8c1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={sx(`flex:none;transition:transform 240ms ${EASE}`, { transform: on ? 'rotate(90deg)' : 'none' })} aria-hidden="true"><path d="m2 2 6 6-6 6" /></svg>
              </span>
              <span style={css('font-size:13px;line-height:19px;color:#8b95a1')}>{dateOf(n)}</span>
              {on && <span style={css('margin-top:6px;font-size:16px;line-height:26px;color:#333d4b;white-space:pre-wrap;word-break:break-word')}>{n.body}{n.options?.length ? `\n\n투표 항목: ${n.options.join(' · ')}` : ''}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

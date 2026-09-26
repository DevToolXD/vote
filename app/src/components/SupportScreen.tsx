import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Firestore } from 'firebase/firestore'
import { css, sx } from '../css'
import { MAX_SUPPORT_TEXT, markSupportRead, sendSupport, subscribeSupportMessages, subscribeTicket, type SupportFrom, type SupportMessage, type Ticket } from '../backend/support'
import { restartSupport, signInForSupport } from '../backend/auth'
import { BackIcon } from './icons'
import { KeyboardUnderlay, PlaneIcon, useKeyboardSafeBox } from './MessagesScreen'

// 상담 (support chat) screens: the user side opens from 로그인 → 비밀번호를 잊었어요
// (no account needed — an anonymous login), the admin side from 관리 → 상담.

const EASE = 'cubic-bezier(0.16,1,0.3,1)'
const clock = (ms: number) => (ms ? new Date(ms).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' }) : '')
const field = 'height:52px;border:0;outline:none;border-radius:14px;background-color:#f2f4f6;padding:0 16px;font-size:17px;color:#191f28;min-width:0'

type RoomProps = {
  db: Firestore
  ticketUid: string
  /** Whose side this is: 'user' sends as the customer, 'admin' as 상담원. */
  as: SupportFrom
  title: string
  subtitle?: string
  exists: boolean
  /** Only for the first user message: creates the ticket with these. */
  profile?: { name: string; loginId: string }
  onBack: () => void
  onError: (msg: string, e: unknown) => void
  /** Admin tools under the header (account match, 비밀번호 초기화). */
  tools?: ReactNode
  intro?: ReactNode
  /** 상담 끝내기 has been pressed: no more messages. */
  closed?: boolean
  /** Button at the right of the header (admin: 상담 끝내기). */
  headerAction?: ReactNode
}

export function SupportRoom({ db, ticketUid, as, title, subtitle, exists, profile, onBack, onError, tools, intro, closed, headerAction }: RoomProps) {
  const [msgs, setMsgs] = useState<SupportMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const firstIds = useRef<Set<string> | null>(null)
  const box = useKeyboardSafeBox()

  useEffect(() => subscribeSupportMessages(db, ticketUid, rows => {
    if (!firstIds.current) firstIds.current = new Set(rows.map(r => r.id))
    setMsgs(rows)
  }), [db, ticketUid])
  useEffect(() => { if (exists) markSupportRead(db, ticketUid, as).catch(() => {}) }, [db, ticketUid, as, exists, msgs.length])
  useLayoutEffect(() => { const el = listRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: firstIds.current && msgs.length > firstIds.current.size ? 'smooth' : 'auto' }) }, [msgs, box.height])

  const send = async () => {
    const t = draft.trim()
    if (!t || sending) return
    setSending(true); setDraft('')
    try { await sendSupport(db, ticketUid, as, t, { exists, ...profile }) } catch (e) { setDraft(t); onError('보내지 못했어요', e) }
    setSending(false)
  }

  return (
    <>
    <KeyboardUnderlay z={249} />
    <div style={sx('position:fixed;left:0;right:0;z-index:250;display:flex;justify-content:center', { top: box.top, height: box.height })}>
      <div data-g="app" className="no-select" style={css(`width:100%;max-width:430px;height:100%;background:#ffffff;display:flex;flex-direction:column;animation:roomIn 360ms ${EASE} backwards`)}>
        <div style={css('flex:none;display:flex;align-items:center;gap:4px;padding:calc(4px + env(safe-area-inset-top)) 8px 4px')}>
          <button className="pr-dim" onClick={onBack} aria-label="뒤로" style={css('width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#191f28')}><BackIcon /></button>
          <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;padding-left:4px')}>
            <span style={css('font-size:17px;line-height:25.5px;font-weight:600;color:#191f28;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{title}</span>
            {subtitle && <span style={css('font-size:13px;line-height:19.5px;color:#6b7684')}>{subtitle}</span>}
          </span>
          {headerAction}
        </div>
        {tools}
        <div ref={listRef} style={css('flex:1;overflow-y:auto;overscroll-behavior:contain;padding:8px 16px 16px;display:flex;flex-direction:column;gap:4px')}>
          {intro}
          {msgs.map((m, i) => {
            const mine = m.from === as
            const next = msgs[i + 1]
            const isNew = !!firstIds.current && !firstIds.current.has(m.id)
            const lastOfRun = !next || next.from !== m.from
            return (
              <div key={m.id} style={sx('display:flex;flex-direction:column;gap:4px', { alignItems: mine ? 'flex-end' : 'flex-start', marginTop: i > 0 && msgs[i - 1].from !== m.from ? 12 : 0, animation: isNew ? `${mine ? 'msgInR' : 'msgInL'} 380ms ${EASE} both` : undefined })}>
                {!mine && (i === 0 || msgs[i - 1].from !== m.from) && <span style={css('font-size:13px;color:#4e5968;font-weight:500')}>{m.from === 'admin' ? '상담원' : title}</span>}
                <span style={sx('display:flex;align-items:flex-end;gap:6px;max-width:80%', { flexDirection: mine ? 'row-reverse' : 'row' })}>
                  <span style={sx('padding:10px 14px;border-radius:20px;font-size:15px;line-height:22px;white-space:pre-wrap;word-break:break-word', { background: mine ? '#3182f6' : '#f2f4f6', color: mine ? '#fff' : '#191f28', fontWeight: mine ? 500 : 400 })}>{m.text}</span>
                  {lastOfRun && <span style={css('flex:none;font-size:11px;color:#8b95a1')}>{clock(m.at?.toMillis() ?? 0)}</span>}
                </span>
              </div>
            )
          })}
        </div>
        {closed ? (
          <div style={css('flex:none;padding:14px 20px calc(14px + env(safe-area-inset-bottom));text-align:center;font-size:14px;line-height:21px;color:#6b7684;background:#f9fafb')}>
            상담이 끝났어요{as === 'user' ? ' · 더 궁금하면 로그인 화면의 "비밀번호를 잊었어요"로 새로 시작해주세요' : ''}
          </div>
        ) : (
          <div style={css('flex:none;padding:8px 12px calc(8px + env(safe-area-inset-bottom));display:flex;align-items:flex-end;gap:8px')}>
            <textarea className="box-focus" rows={1} value={draft} maxLength={MAX_SUPPORT_TEXT} placeholder={as === 'admin' ? '답변 보내기' : '궁금한 점을 적어주세요'}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }}
              style={css('flex:1;min-width:0;min-height:44px;max-height:120px;resize:none;border:0;outline:none;border-radius:22px;background-color:#f2f4f6;padding:11px 16px;font-size:17px;line-height:22px;color:#191f28;font-family:inherit')} />
            <button className="pr-94" onClick={send} disabled={!draft.trim() || sending} aria-label="보내기" style={sx(`width:44px;height:44px;flex:none;border-radius:9999px;background:#3182f6;display:flex;align-items:center;justify-content:center;transition:opacity 200ms ${EASE}`, { opacity: draft.trim() && !sending ? 1 : 0.3 })}>
              <PlaneIcon size={20} stroke="#fff" width={2.2} />
            </button>
          </div>
        )}
      </div>
    </div>
    </>
  )
}

/**
 * 로그인 → 비밀번호를 잊었어요: asks who they are once, then chats with 상담원. The 상담 stays
 * (계정 shows it) until 상담원 ends it; after that "비밀번호를 잊었어요" starts a new one,
 * while `resume` (from the 계정 card) reopens the ended one to read it.
 */
export function SupportFlow({ db, loginId, resume, onClose, onError }: { db: Firestore; loginId: string; resume?: boolean; onClose: () => void; onError: (msg: string, e: unknown) => void }) {
  const [uid, setUid] = useState<string | null>(null)
  const [ticket, setTicket] = useState<Ticket | null | undefined>(undefined)
  const [name, setName] = useState('')
  const [id, setId] = useState(loginId)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    try { localStorage.setItem('pv-support-used', '1') } catch { /* private mode */ }
    signInForSupport().then(u => setUid(u.uid)).catch(e => { onError('상담을 시작하지 못했어요', e); onClose() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => (uid ? subscribeTicket(db, uid, setTicket) : undefined), [db, uid])
  // The last 상담 was ended: a new one gets a fresh (anonymous) login, so a fresh ticket.
  const restarting = useRef(false)
  useEffect(() => {
    if (resume || !ticket?.closed || restarting.current) return
    restarting.current = true
    setTicket(undefined)
    restartSupport().then(u => setUid(u.uid)).catch(e => { onError('상담을 시작하지 못했어요', e); onClose() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.closed, resume])

  if (!uid || ticket === undefined) return null
  if (!ticket && !started) {
    const ok = name.trim().length >= 1 && /^[a-zA-Z0-9]{4,20}$/.test(id.trim())
    return (
      <div style={css('position:fixed;inset:0;z-index:250;display:flex;justify-content:center;background:#fff')}>
        <div data-g="app" style={css(`width:100%;max-width:430px;display:flex;flex-direction:column;animation:roomIn 360ms ${EASE} backwards`)}>
          <div style={css('padding:calc(4px + env(safe-area-inset-top)) 8px 4px')}>
            <button className="pr-dim" onClick={onClose} aria-label="뒤로" style={css('width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#191f28')}><BackIcon /></button>
          </div>
          <div className="anim-list" style={css('padding:8px 24px 24px;display:flex;flex-direction:column;gap:4px')}>
            <h1 style={css('margin:0;font-size:22px;line-height:31px;font-weight:700;color:#191f28')}>상담원에게 물어볼까요?</h1>
            <p style={css('margin:0;font-size:15px;line-height:22.5px;color:#6b7684')}>본인 확인이 되면 비밀번호를 다시 정할 수 있게 도와드려요</p>
          </div>
          <div className="anim-list" style={css('padding:0 24px;display:flex;flex-direction:column;gap:16px')}>
            <label style={css('display:flex;flex-direction:column;gap:8px')}><span style={css('font-size:13px;color:#6b7684;font-weight:500')}>이름 (실명)</span><input className="box-focus" value={name} maxLength={20} onChange={e => setName(e.target.value)} placeholder="예) 홍길동" style={css(field)} /></label>
            <label style={css('display:flex;flex-direction:column;gap:8px')}><span style={css('font-size:13px;color:#6b7684;font-weight:500')}>아이디</span><input className="box-focus" value={id} maxLength={20} autoCapitalize="off" onChange={e => setId(e.target.value)} placeholder="가입할 때 쓴 아이디" style={css(field)} /></label>
          </div>
          <div style={css('margin-top:auto;padding:20px 20px calc(20px + env(safe-area-inset-bottom))')}>
            <button data-g="primary" className="pr-96" disabled={!ok} onClick={() => setStarted(true)} style={sx(`width:100%;height:56px;border-radius:16px;background:#3182f6;color:#fff;font-size:17px;font-weight:600;transition:opacity 200ms ${EASE}`, { opacity: ok ? 1 : 0.3 })}>상담 시작하기</button>
          </div>
        </div>
      </div>
    )
  }
  return (
    <SupportRoom
      db={db} ticketUid={uid} as="user" title="상담원" subtitle="답변이 오면 여기에서 볼 수 있어요"
      exists={!!ticket} profile={{ name: name || ticket?.name || '', loginId: id || ticket?.loginId || '' }}
      onBack={onClose} onError={onError} closed={!!ticket?.closed}
      intro={
        <div style={css('align-self:center;margin:8px 0 12px;padding:10px 14px;border-radius:14px;background:#f9fafb;font-size:13px;line-height:19.5px;color:#6b7684;text-align:center;max-width:300px')}>
          {ticket ? `${ticket.name}님, 상담원이 확인하고 답변을 드릴게요` : '어떤 도움이 필요한지 적어주세요. 예) 비밀번호를 잊었어요'}
        </div>
      }
    />
  )
}

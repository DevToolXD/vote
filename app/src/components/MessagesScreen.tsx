import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Firestore } from 'firebase/firestore'
import { css, sx } from '../css'
import { MAX_GROUP, MAX_GROUP_NAME, MAX_TEXT, isUnread, markRead, subscribeMessages, type ChatRow, type MessageRow } from '../backend/messages'
import type { Person } from '../model'
import { Avatar } from './Avatar'
import { BackIcon, CloseIcon, SearchIcon } from './icons'
import { BottomSheet, Dialog } from './Overlays'

// Toss-style messages: grey-scale screens with blue500 as the only accent, lists on
// white (no cards), 16px grey bands between sections, 해요체 copy.

/** Instagram-style Direct paper plane. */
export const PlaneIcon = ({ size = 24, stroke = 'currentColor', width = 2 }: { size?: number; stroke?: string; width?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} strokeLinejoin="round" strokeLinecap="round"><path d="M22 3 9.218 10.083" /><path d="M11.698 20.334 22 3.001H2l7.218 7.083z" /></svg>
)
const ComposeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V12" /><path d="M18.4 3.6a2 2 0 0 1 2.9 2.9L12.5 15.3 9 16l.7-3.5z" /></svg>
)
const MenuIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
)
const BellOffIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b0b8c1" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-label="알림 꺼짐"><path d="M8.7 3.9A6 6 0 0 1 18 9c0 3.2.8 5.4 1.6 6.8M6.3 6.3A6 6 0 0 0 6 9c0 5-2 7-2 7h12M10.3 20a2 2 0 0 0 3.4 0M3 3l18 18" /></svg>
)

const band = <div data-g="gap" style={css('height:16px;background:#f2f4f6')} />
const title17 = 'font-size:17px;line-height:25.5px;font-weight:500;color:#333d4b'
const caption = 'font-size:13px;line-height:19.5px;color:#6b7684'

export function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} className="pr-96" onClick={onToggle} style={sx('width:50px;height:30px;border-radius:9999px;position:relative;flex:none;transition:background 200ms cubic-bezier(0.16,1,0.3,1)', { background: on ? '#3182f6' : '#e5e8eb' })}>
      <span style={sx('position:absolute;top:3px;width:24px;height:24px;border-radius:9999px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.12);transition:left 200ms cubic-bezier(0.16,1,0.3,1)', { left: on ? 23 : 3 })} />
    </button>
  )
}

function timeLabel(ms: number) {
  if (!ms) return ''
  const d = new Date(ms), now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return '어제'
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}
const clock = (ms: number) => (ms ? new Date(ms).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' }) : '')
const dayLabel = (ms: number) => new Date(ms).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })

export type ChatView = { title: string; people: Person[]; others: string[]; canSend: boolean; blockedReason: string }

/** Who's in a chat and whether I can send in it right now (mirrors firestore.rules' canSend). */
export function describeChat(c: ChatRow, me: string, byId: Map<string, Person>, myOff: boolean): ChatView {
  const others = c.members.filter(m => m !== me)
  const people = others.map(id => byId.get(id)).filter((p): p is Person => !!p)
  const names = others.map(id => byId.get(id)?.name ?? '(탈퇴한 사람)')
  const title = c.type === 'dm' ? names[0] ?? '(알 수 없음)' : c.name || names.join(', ')
  const dmPeer = c.type === 'dm' ? byId.get(others[0]) : undefined
  const blockedReason = myOff ? '메시지 받기를 켜면 보낼 수 있어요'
    : c.type === 'dm' && !dmPeer ? '탈퇴한 사람에게는 보낼 수 없어요'
      : dmPeer?.msgOff ? `${dmPeer.name}님이 메시지를 받지 않고 있어요` : ''
  return { title, people, others, canSend: !blockedReason, blockedReason }
}

function ChatAvatar({ people, size }: { people: Person[]; size: number }) {
  if (people.length <= 1) return <Avatar photo={people[0]?.photoCss} size={size} style={{ flex: 'none' }} />
  const s = Math.round(size * 0.66)
  return (
    <span style={sx('position:relative;flex:none', { width: size, height: size })}>
      <Avatar photo={people[0].photoCss} size={s} style={{ position: 'absolute', top: 0, left: 0 }} />
      <span style={sx('position:absolute;right:0;bottom:0;border-radius:9999px;background:#fff;padding:2px', { width: s + 4, height: s + 4 })}>
        <Avatar photo={people[1].photoCss} size={s} />
      </span>
    </span>
  )
}

// ---- 메시지 탭 -------------------------------------------------------------------

type ScreenProps = {
  loggedIn: boolean
  me?: Person
  chats: ChatRow[]
  byId: Map<string, Person>
  onLogin: () => void
  onOpen: (chatId: string) => void
  onNew: () => void
  onToggleOff: (off: boolean) => void
}

export function MessagesScreen({ loggedIn, me, chats, byId, onLogin, onOpen, onNew, onToggleOff }: ScreenProps) {
  if (!loggedIn || !me) {
    return (
      <div style={css('flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:48px 24px;text-align:center')}>
        <span style={css('font-size:48px;line-height:1;margin-bottom:16px')}>💬</span>
        <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>로그인하면 메시지를 보낼 수 있어요</span>
        <span style={css('font-size:15px;line-height:22.5px;color:#6b7684')}>1:1이나 단톡방에서 이야기해요</span>
        <button data-g="primary" className="pr-96" onClick={onLogin} style={css('margin-top:20px;height:48px;padding:0 24px;border-radius:14px;background:#3182f6;color:#fff;font-size:17px;font-weight:600')}>로그인하기</button>
      </div>
    )
  }
  const off = !!me.msgOff
  return (
    <div data-g="clear" style={css('flex:1;background:#ffffff;padding-bottom:24px')}>
      <div style={css('padding:24px 16px 20px 24px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px')}>
        <span style={css('display:flex;flex-direction:column;gap:4px')}>
          <h1 style={css('margin:0;font-size:22px;line-height:31px;font-weight:700;color:#191f28')}>메시지</h1>
          <span style={css('font-size:15px;line-height:22.5px;color:#6b7684')}>{off ? '메시지 받기가 꺼져 있어요' : '1:1이나 단톡방에서 이야기해요'}</span>
        </span>
        <button className="pr-94" onClick={onNew} disabled={off} aria-label="새 채팅" style={sx('width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#4e5968;flex:none', { opacity: off ? 0.3 : 1 })}><ComposeIcon /></button>
      </div>

      {chats.length === 0 ? (
        <div style={css('padding:40px 24px 48px;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center')}>
          <span style={css('font-size:40px;line-height:1;margin-bottom:12px')}>✉️</span>
          <span style={css('font-size:17px;line-height:25.5px;font-weight:600;color:#333d4b')}>아직 대화가 없어요</span>
          <span style={css('font-size:15px;line-height:22.5px;color:#6b7684')}>랭킹에서 프로필을 눌러 메시지를 보내보세요</span>
          {!off && <button className="pr-96" onClick={onNew} style={css('margin-top:16px;height:38px;padding:0 16px;border-radius:10px;background:#e8f3ff;color:#1b64da;font-size:15px;font-weight:600')}>새 채팅 시작하기</button>}
        </div>
      ) : (
        <div style={css('display:flex;flex-direction:column')}>
          {chats.map(c => {
            const v = describeChat(c, me.id, byId, off)
            const unread = isUnread(c, me.id)
            const muted = !!c.mutes?.[me.id]
            const who = c.last ? (c.last.uid === me.id ? '나: ' : c.type === 'group' ? `${byId.get(c.last.uid)?.name ?? '(탈퇴한 사람)'}: ` : '') : ''
            return (
              <button key={c.id} className="pr-dim" onClick={() => onOpen(c.id)} style={css('display:flex;align-items:center;gap:14px;padding:12px 20px 12px 24px;border-radius:12px;text-align:left;margin:0 4px')}>
                <ChatAvatar people={v.people} size={48} />
                <span style={css('flex:1;min-width:0;display:flex;flex-direction:column')}>
                  <span style={css('display:flex;align-items:center;gap:4px;min-width:0')}>
                    <span style={sx(title17 + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis', { fontWeight: unread ? 600 : 500, color: unread ? '#191f28' : '#333d4b' })}>{v.title}</span>
                    {c.type === 'group' && <span style={css('flex:none;font-size:15px;color:#8b95a1')}>{c.members.length}</span>}
                    {muted && <BellOffIcon />}
                  </span>
                  <span style={sx('font-size:15px;line-height:22.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis', { color: unread ? '#333d4b' : '#6b7684', fontWeight: unread ? 500 : 400 })}>{c.last ? who + c.last.text : '대화를 시작해보세요'}</span>
                </span>
                <span style={css('flex:none;align-self:stretch;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:8px')}>
                  <span style={css('font-size:13px;line-height:19.5px;color:#8b95a1')}>{timeLabel(c.last?.at?.toMillis() ?? 0)}</span>
                  <span style={sx('width:8px;height:8px;border-radius:9999px', { background: unread ? '#3182f6' : 'transparent' })} />
                </span>
              </button>
            )
          })}
        </div>
      )}

      {band}
      <div style={css('padding:16px 16px 16px 24px;display:flex;align-items:center;gap:12px')}>
        <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:2px')}>
          <span style={css(title17)}>메시지 받기</span>
          <span style={css(caption)}>{off ? '꺼두면 아무도 메시지를 보내거나 초대할 수 없고, 나도 보낼 수 없어요' : '끄면 새 채팅 목록에서도 보이지 않아요'}</span>
        </span>
        <Switch on={!off} onToggle={() => onToggleOff(!off)} label="메시지 받기" />
      </div>
    </div>
  )
}

// ---- 채팅방 -----------------------------------------------------------------------

type RoomProps = {
  db: Firestore
  chat: ChatRow
  me: Person
  byId: Map<string, Person>
  onBack: () => void
  onSend: (text: string) => Promise<boolean>
  onMute: (muted: boolean) => void
  onLeave: () => void
  onError: (msg: string, e: unknown) => void
}

export function ChatRoom({ db, chat, me, byId, onBack, onSend, onMute, onLeave, onError }: RoomProps) {
  const [msgs, setMsgs] = useState<MessageRow[] | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [menu, setMenu] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const v = describeChat(chat, me.id, byId, !!me.msgOff)

  useEffect(() => subscribeMessages(db, chat.id, setMsgs, e => onError('메시지를 불러오지 못했어요', e)), [db, chat.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // Opening the room (and every new message while it's open) marks it read.
  useEffect(() => { if (isUnread(chat, me.id)) markRead(db, me.id, chat.id).catch(() => {}) }, [db, chat, me.id])
  useLayoutEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight }, [msgs])

  const send = async () => {
    const t = draft.trim()
    if (!t || sending || !v.canSend) return
    setSending(true)
    if (await onSend(t)) setDraft('')
    setSending(false)
  }

  return (
    <div style={css('position:fixed;inset:0;z-index:200;display:flex;justify-content:center')}>
      <div data-g="app" style={css('width:100%;max-width:430px;height:100%;background:#ffffff;display:flex;flex-direction:column;animation:fade 180ms ease both;position:relative;overflow:hidden')}>
        <div style={css('flex:none;display:flex;align-items:center;gap:4px;padding:calc(4px + env(safe-area-inset-top)) 8px 4px')}>
          <button className="pr-dim" onClick={onBack} aria-label="뒤로" style={css('width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#191f28')}><BackIcon /></button>
          <span style={css('flex:1;min-width:0;display:flex;align-items:baseline;gap:6px;padding-left:4px')}>
            <span style={css('font-size:17px;line-height:25.5px;font-weight:600;color:#191f28;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{v.title}</span>
            {chat.type === 'group' && <span style={css('flex:none;font-size:15px;color:#8b95a1')}>{chat.members.length}</span>}
          </span>
          <button className="pr-dim" onClick={() => setMenu(true)} aria-label="채팅방 메뉴" style={css('width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#4e5968')}><MenuIcon /></button>
        </div>

        <div ref={listRef} style={css('flex:1;overflow-y:auto;padding:8px 16px 16px;display:flex;flex-direction:column;-webkit-overflow-scrolling:touch')}>
          {msgs === null ? null : msgs.length === 0 ? (
            <div style={css('margin:auto;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center')}>
              <ChatAvatar people={v.people} size={72} />
              <span style={css('margin-top:12px;font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>{v.title}</span>
              <span style={css('font-size:15px;line-height:22.5px;color:#6b7684')}>첫 메시지를 보내보세요</span>
            </div>
          ) : msgs.map((m, i) => {
            const mine = m.uid === me.id
            const prev = msgs[i - 1], next = msgs[i + 1]
            const at = m.at?.toMillis() ?? 0
            const newDay = !prev || new Date(prev.at?.toMillis() ?? 0).toDateString() !== new Date(at).toDateString()
            const firstOfRun = newDay || prev.uid !== m.uid
            const lastOfRun = !next || next.uid !== m.uid || clock(next.at?.toMillis() ?? 0) !== clock(at)
            const sender = byId.get(m.uid)
            return (
              <Fragment key={m.id}>
                {newDay && at > 0 && <div style={css('align-self:center;margin:16px 0 8px;font-size:13px;line-height:19.5px;color:#8b95a1')}>{dayLabel(at)}</div>}
                <div style={sx('display:flex;gap:8px;align-items:flex-end', { justifyContent: mine ? 'flex-end' : 'flex-start', marginTop: firstOfRun ? 12 : 4 })}>
                  {!mine && <span style={css('width:32px;flex:none;align-self:flex-start')}>{firstOfRun && <Avatar photo={sender?.photoCss} size={32} />}</span>}
                  <span style={sx('display:flex;flex-direction:column;gap:4px;max-width:74%', { alignItems: mine ? 'flex-end' : 'flex-start' })}>
                    {!mine && firstOfRun && chat.type === 'group' && <span style={css('font-size:13px;line-height:19.5px;color:#6b7684')}>{sender?.name ?? '(탈퇴한 사람)'}</span>}
                    <span style={sx('display:flex;align-items:flex-end;gap:6px', { flexDirection: mine ? 'row-reverse' : 'row' })}>
                      <span style={sx('padding:10px 14px;border-radius:20px;font-size:15px;line-height:22px;white-space:pre-wrap;word-break:break-word', { background: mine ? '#3182f6' : '#f2f4f6', color: mine ? '#ffffff' : '#191f28', fontWeight: mine ? 500 : 400 })}>{m.text}</span>
                      {lastOfRun && <span style={css('flex:none;font-size:11px;line-height:16px;color:#8b95a1;white-space:nowrap')}>{clock(at)}</span>}
                    </span>
                  </span>
                </div>
              </Fragment>
            )
          })}
        </div>

        <div style={css('flex:none;padding:8px 12px calc(8px + env(safe-area-inset-bottom))')}>
          {v.canSend ? (
            <div style={css('display:flex;align-items:flex-end;gap:8px')}>
              <textarea
                className="box-focus" rows={1} value={draft} maxLength={MAX_TEXT} placeholder="메시지 보내기"
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }}
                style={css('flex:1;min-width:0;min-height:44px;max-height:120px;resize:none;border:0;outline:none;border-radius:22px;background-color:#f2f4f6;padding:11px 16px;font-size:17px;line-height:22px;color:#191f28;font-family:inherit')}
              />
              <button className="pr-94" onClick={send} disabled={!draft.trim() || sending} aria-label="보내기" style={sx('width:44px;height:44px;flex:none;border-radius:9999px;background:#3182f6;display:flex;align-items:center;justify-content:center;transition:opacity 150ms', { opacity: draft.trim() && !sending ? 1 : 0.3 })}>
                <PlaneIcon size={20} stroke="#ffffff" width={2.2} />
              </button>
            </div>
          ) : (
            <div style={css('min-height:44px;display:flex;align-items:center;justify-content:center;padding:0 16px;border-radius:22px;background:#f2f4f6;font-size:15px;color:#6b7684;text-align:center')}>{v.blockedReason}</div>
          )}
        </div>

        {menu && (
          <ChatMenu chat={chat} me={me} byId={byId} onClose={() => setMenu(false)} onMute={onMute}
            onLeave={() => { setMenu(false); onLeave() }} />
        )}
      </div>
    </div>
  )
}

// ---- ≡ 채팅방 메뉴 ------------------------------------------------------------------

type MenuProps = { chat: ChatRow; me: Person; byId: Map<string, Person>; onClose: () => void; onMute: (muted: boolean) => void; onLeave: () => void }

/** KakaoTalk-style side panel: who's here, this chat's 알림, and 나가기 (asks twice). */
function ChatMenu({ chat, me, byId, onClose, onMute, onLeave }: MenuProps) {
  const [ask, setAsk] = useState<0 | 1 | 2>(0)
  const muted = !!chat.mutes?.[me.id]
  const members = [me.id, ...chat.members.filter(m => m !== me.id)]
  return (
    <>
      <div data-g="scrim" onClick={onClose} style={css('position:absolute;inset:0;z-index:10;background:rgba(0,0,0,0.2);animation:fade 200ms ease both')} />
      <div role="dialog" aria-label="채팅방 메뉴" data-g="l4" style={css('position:absolute;top:0;right:0;bottom:0;z-index:11;width:84%;max-width:340px;background:#ffffff;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);animation:slideInRight 320ms cubic-bezier(0.16,1,0.3,1) both')}>
        <div style={css('flex:none;padding:12px 12px 8px 24px;display:flex;align-items:center;justify-content:space-between')}>
          <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>채팅방 정보</span>
          <button className="pr-dim" onClick={onClose} aria-label="닫기" style={css('width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center')}><CloseIcon size={20} stroke="#4e5968" width={2.4} /></button>
        </div>
        <div style={css('flex:1;overflow-y:auto')}>
          <div style={css('padding:12px 24px 4px;' + caption)}>대화 상대 {chat.members.length}명</div>
          {members.map(id => {
            const p = byId.get(id)
            return (
              <div key={id} style={css('display:flex;align-items:center;gap:12px;padding:10px 24px')}>
                <Avatar frame={p?.frame} photo={p?.photoCss} size={40} style={{ flex: 'none' }} />
                <span style={css(title17 + ';flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{p?.name ?? '(탈퇴한 사람)'}</span>
                {id === me.id && <span style={css('flex:none;height:22px;padding:0 8px;border-radius:9999px;background:#f2f4f6;color:#6b7684;font-size:12px;font-weight:600;display:flex;align-items:center')}>나</span>}
                {id !== me.id && p?.msgOff && <span style={css('flex:none;font-size:13px;color:#8b95a1')}>메시지 꺼둠</span>}
              </div>
            )
          })}
          <div style={{ height: 12 }} />
          {band}
          <div style={css('padding:16px 16px 16px 24px;display:flex;align-items:center;gap:12px')}>
            <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:2px')}>
              <span style={css(title17)}>알림</span>
              <span style={css(caption)}>{muted ? '이 채팅방 알림을 받지 않아요' : '새 메시지가 오면 알려드려요'}</span>
            </span>
            <Switch on={!muted} onToggle={() => onMute(!muted)} label="이 채팅방 알림" />
          </div>
        </div>
        {chat.type === 'group' && (
          <button className="pr-dim" onClick={() => setAsk(1)} style={css('flex:none;margin:0 4px 8px;padding:16px 20px;border-radius:12px;text-align:left;font-size:17px;font-weight:500;color:#f04452')}>채팅방 나가기</button>
        )}
      </div>

      {ask === 1 && (
        <Dialog onScrim={() => setAsk(0)} gap={20}>
          <div style={css('padding:0 4px;display:flex;flex-direction:column;gap:8px')}>
            <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>채팅방을 나갈까요?</span>
            <span style={css('font-size:15px;line-height:22.5px;color:#4e5968')}>나가면 대화 목록에서 사라져요</span>
          </div>
          <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:8px')}>
            <button data-g="secondary" className="pr-96" onClick={() => setAsk(0)} style={css('height:54px;border-radius:16px;background:#f2f4f6;color:#4e5968;font-size:17px;font-weight:600')}>닫기</button>
            <button data-g="primary" className="pr-96" onClick={() => setAsk(2)} style={css('height:54px;border-radius:16px;background:#3182f6;color:#ffffff;font-size:17px;font-weight:600')}>나가기</button>
          </div>
        </Dialog>
      )}
      {ask === 2 && (
        <Dialog onScrim={() => setAsk(0)} gap={20}>
          <div style={css('padding:0 4px;display:flex;flex-direction:column;gap:8px')}>
            <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>정말 나갈까요?</span>
            <span style={css('font-size:15px;line-height:22.5px;color:#4e5968')}>나간 채팅방에는 다시 들어올 수 없고, 대화 내용도 볼 수 없어요</span>
          </div>
          <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:8px')}>
            <button data-g="secondary" className="pr-96" onClick={() => setAsk(0)} style={css('height:54px;border-radius:16px;background:#f2f4f6;color:#4e5968;font-size:17px;font-weight:600')}>닫기</button>
            <button className="pr-96" onClick={() => { setAsk(0); onLeave() }} style={css('height:54px;border-radius:16px;background:#f04452;color:#ffffff;font-size:17px;font-weight:600')}>나가기</button>
          </div>
        </Dialog>
      )}
    </>
  )
}

// ---- 새 채팅 -----------------------------------------------------------------------

type NewProps = { me: Person; all: Person[]; onClose: () => void; onCreate: (ids: string[], name: string) => Promise<void> }

/** Pick 1 person for a 1:1, or 2+ for a group. People with messages off aren't listed. */
export function NewChatSheet({ me, all, onClose, onCreate }: NewProps) {
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const candidates = useMemo(() => all.filter(p => p.id !== me.id && !p.msgOff), [all, me.id])
  const list = q.trim() ? candidates.filter(p => p.name.includes(q.trim())) : candidates
  const full = picked.length >= MAX_GROUP - 1
  const toggle = (id: string) => setPicked(ps => ps.includes(id) ? ps.filter(x => x !== id) : full ? ps : [...ps, id])
  const group = picked.length >= 2

  const create = async () => {
    if (!picked.length || busy) return
    setBusy(true)
    try { await onCreate(picked, name) } finally { setBusy(false) }
  }

  return (
    <BottomSheet onScrim={onClose} scrim="rgba(0,0,0,0.2)" sheetStyle="border-radius:28px 28px 0 0;padding:8px 0 calc(20px + env(safe-area-inset-bottom));animation:sheetUp 420ms cubic-bezier(0.16,1,0.3,1) both;height:86vh;display:flex;flex-direction:column">
      <div style={css('width:36px;height:4px;border-radius:2px;background:#e5e8eb;margin:0 auto')} />
      <div style={css('padding:20px 24px 16px;display:flex;flex-direction:column;gap:4px')}>
        <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>누구와 이야기할까요?</span>
        <span style={css('font-size:15px;line-height:22.5px;color:#6b7684')}>
          {picked.length === 0 ? '한 명을 고르면 1:1, 여러 명이면 단톡방이 돼요' : `${picked.length}명 골랐어요${full ? ` · 최대 ${MAX_GROUP - 1}명` : ''}`}
        </span>
      </div>
      <div style={css('padding:0 24px 8px;display:flex;flex-direction:column;gap:8px')}>
        <div className="ring-within" data-g="l1" style={css('height:48px;border-radius:14px;background:#f2f4f6;display:flex;align-items:center;gap:8px;padding:0 14px')}>
          <SearchIcon size={20} stroke="#8b95a1" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="이름으로 찾기" style={css('flex:1;min-width:0;border:0;background:transparent;font-size:17px;color:#191f28;outline:none')} />
        </div>
        {group && <input data-g="l1" className="box-focus" value={name} maxLength={MAX_GROUP_NAME} onChange={e => setName(e.target.value)} placeholder="단톡방 이름 (안 써도 돼요)" style={css('height:48px;border:0;outline:none;border-radius:14px;background-color:#f2f4f6;padding:0 14px;font-size:17px;color:#191f28;min-width:0')} />}
      </div>
      <div style={css('flex:1;overflow-y:auto;padding:4px 4px 0')}>
        {list.length === 0 && <div style={css('padding:32px 24px;text-align:center;font-size:15px;color:#6b7684')}>{candidates.length ? `‘${q.trim()}’ 이름을 찾지 못했어요` : '메시지를 받을 수 있는 사람이 없어요'}</div>}
        {list.map(p => {
          const on = picked.includes(p.id)
          return (
            <button key={p.id} className="pr-dim" role="checkbox" aria-checked={on} onClick={() => toggle(p.id)} style={sx('width:100%;display:flex;align-items:center;gap:14px;padding:10px 20px;border-radius:12px;text-align:left', { opacity: !on && full ? 0.3 : 1 })}>
              <Avatar frame={p.frame} photo={p.photoCss} size={40} style={{ flex: 'none' }} />
              <span style={css(title17 + ';flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{p.name}</span>
              <span style={sx('width:24px;height:24px;flex:none;border-radius:9999px;display:flex;align-items:center;justify-content:center;transition:background 150ms', { background: on ? '#3182f6' : '#e5e8eb' })}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              </span>
            </button>
          )
        })}
      </div>
      <div style={css('padding:12px 20px 0')}>
        <button data-g="primary" className="pr-96" disabled={!picked.length || busy} onClick={create} style={sx('width:100%;height:56px;border-radius:16px;background:#3182f6;color:#fff;font-size:17px;font-weight:600;transition:opacity 200ms', { opacity: picked.length && !busy ? 1 : 0.3 })}>
          {busy ? '만드는 중…' : group ? `${picked.length + 1}명 단톡방 만들기` : '대화하기'}
        </button>
      </div>
    </BottomSheet>
  )
}

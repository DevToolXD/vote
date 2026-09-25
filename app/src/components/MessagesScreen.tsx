import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Firestore } from 'firebase/firestore'
import { css, sx } from '../css'
import { MAX_GROUP, MAX_GROUP_NAME, MAX_TEXT, isUnread, markRead, subscribeMessages, type ChatRow, type MessageRow } from '../backend/messages'
import type { Person } from '../model'
import { Avatar } from './Avatar'
import { BackIcon, CloseIcon, SearchIcon } from './icons'
import { BottomSheet } from './Overlays'

/** Instagram-style Direct paper plane. */
export const PlaneIcon = ({ size = 24, stroke = 'currentColor', width = 2 }: { size?: number; stroke?: string; width?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} strokeLinejoin="round" strokeLinecap="round"><path d="M22 3 9.218 10.083" /><path d="M11.698 20.334 22 3.001H2l7.218 7.083z" /></svg>
)

const field = 'height:48px;border:0;border-radius:14px;background:#f2f4f6;padding:0 14px;font-size:16px;color:#191f28;min-width:0'

export function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={onToggle} style={sx('width:52px;height:32px;border-radius:9999px;position:relative;flex:none;transition:background 200ms', { background: on ? '#3182f6' : '#d1d6db' })}>
      <span style={sx('position:absolute;top:3px;width:26px;height:26px;border-radius:9999px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.2);transition:left 200ms cubic-bezier(0.22,1,0.36,1)', { left: on ? 23 : 3 })} />
    </button>
  )
}

function timeLabel(ms: number) {
  if (!ms) return ''
  const d = new Date(ms), now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export type ChatView = { title: string; people: Person[]; others: string[]; canSend: boolean; blockedReason: string }

/** Who's in a chat and whether I can send in it right now (mirrors firestore.rules' canSend). */
export function describeChat(c: ChatRow, me: string, byId: Map<string, Person>, myOff: boolean): ChatView {
  const others = c.members.filter(m => m !== me)
  const people = others.map(id => byId.get(id)).filter((p): p is Person => !!p)
  const names = others.map(id => byId.get(id)?.name ?? '(탈퇴한 사람)')
  const title = c.type === 'dm' ? names[0] ?? '(알 수 없음)' : c.name || names.join(', ')
  const dmPeer = c.type === 'dm' ? byId.get(others[0]) : undefined
  const blockedReason = myOff ? '메시지를 꺼 두어서 보낼 수 없어요'
    : c.type === 'dm' && !dmPeer ? '탈퇴한 사람이에요'
      : dmPeer?.msgOff ? `${dmPeer.name}님이 메시지를 꺼 두었어요` : ''
  return { title, people, others, canSend: !blockedReason, blockedReason }
}

function ChatAvatar({ people, size }: { people: Person[]; size: number }) {
  if (people.length <= 1) return <Avatar photo={people[0]?.photoCss} size={size} style={{ flex: 'none' }} />
  const s = Math.round(size * 0.68)
  return (
    <span style={sx('position:relative;flex:none', { width: size, height: size })}>
      <Avatar photo={people[0].photoCss} size={s} style={{ position: 'absolute', top: 0, left: 0 }} />
      <span style={sx('position:absolute;right:0;bottom:0;border-radius:9999px;background:#fff;padding:2px', { width: s + 4, height: s + 4 })}>
        <Avatar photo={people[1].photoCss} size={s} />
      </span>
    </span>
  )
}

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
      <div style={css('flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:48px 24px;text-align:center')}>
        <PlaneIcon size={48} stroke="#b0b8c1" width={1.6} />
        <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>로그인하면 메시지를 보낼 수 있어요</span>
        <button data-g="primary" className="pr-96" onClick={onLogin} style={css('height:48px;padding:0 24px;border-radius:14px;background:#3182f6;color:#fff;font-size:16px;font-weight:600')}>로그인하기</button>
      </div>
    )
  }
  const off = !!me.msgOff
  return (
    <div data-g="clear" style={css('flex:1;background:#ffffff;padding-bottom:24px')}>
      <div style={css('padding:24px 20px 12px 24px;display:flex;align-items:center;justify-content:space-between')}>
        <h1 style={css('margin:0;font-size:22px;line-height:31px;font-weight:700;color:#191f28')}>메시지</h1>
        <button className="pr-94" onClick={onNew} disabled={off} aria-label="새 채팅방 만들기" style={sx('height:40px;padding:0 14px;border-radius:12px;background:#e8f3ff;color:#1b64da;font-size:15px;font-weight:600;display:flex;align-items:center;gap:6px', { opacity: off ? 0.4 : 1 })}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          새 채팅
        </button>
      </div>

      <div data-g="l1" style={css('margin:0 20px 8px;padding:14px 16px;border-radius:16px;background:#f9fafb;display:flex;align-items:center;gap:12px')}>
        <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:2px')}>
          <span style={css('font-size:15px;font-weight:600;color:#191f28')}>메시지 받기</span>
          <span style={css('font-size:13px;line-height:19px;color:#6b7684')}>{off ? '꺼져 있어요. 아무도 메시지를 보내거나 채팅방에 초대할 수 없고, 나도 보낼 수 없어요' : '켜져 있어요. 끄면 초대 목록에서도 사라져요'}</span>
        </span>
        <Switch on={!off} onToggle={() => onToggleOff(!off)} label="메시지 받기" />
      </div>

      {chats.length === 0 ? (
        <div style={css('padding:56px 24px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center')}>
          <span style={css('font-size:17px;font-weight:600;color:#333d4b')}>아직 대화가 없어요</span>
          <span style={css('font-size:14px;line-height:21px;color:#8b95a1')}>랭킹에서 프로필을 눌러 메시지를 보내거나<br />새 채팅으로 단톡방을 만들어보세요</span>
        </div>
      ) : (
        <div style={css('display:flex;flex-direction:column;padding:4px 8px')}>
          {chats.map(c => {
            const v = describeChat(c, me.id, byId, off)
            const unread = isUnread(c, me.id)
            const preview = c.last ? (c.type === 'group' && c.last.uid !== me.id ? `${byId.get(c.last.uid)?.name ?? ''}: ` : c.last.uid === me.id ? '나: ' : '') + c.last.text : '대화를 시작해보세요'
            return (
              <button key={c.id} className="pr-dim" onClick={() => onOpen(c.id)} style={css('display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:16px;text-align:left')}>
                <ChatAvatar people={v.people} size={52} />
                <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:2px')}>
                  <span style={css('display:flex;align-items:center;gap:6px;min-width:0')}>
                    <span style={sx('font-size:16px;line-height:23px;color:#191f28;white-space:nowrap;overflow:hidden;text-overflow:ellipsis', { fontWeight: unread ? 700 : 600 })}>{v.title}</span>
                    {c.type === 'group' && <span style={css('flex:none;font-size:13px;color:#8b95a1')}>{c.members.length}</span>}
                  </span>
                  <span style={sx('font-size:14px;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis', { color: unread ? '#191f28' : '#8b95a1', fontWeight: unread ? 600 : 400 })}>{preview}</span>
                </span>
                <span style={css('flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:6px')}>
                  <span style={css('font-size:12px;color:#8b95a1')}>{timeLabel(c.last?.at?.toMillis() ?? 0)}</span>
                  <span style={sx('width:8px;height:8px;border-radius:9999px;background:#3182f6', { visibility: unread ? 'visible' : 'hidden' })} />
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

type RoomProps = {
  db: Firestore
  chat: ChatRow
  me: Person
  byId: Map<string, Person>
  onBack: () => void
  onSend: (text: string) => Promise<boolean>
  onLeave: () => void
  onError: (msg: string, e: unknown) => void
}

export function ChatRoom({ db, chat, me, byId, onBack, onSend, onLeave, onError }: RoomProps) {
  const [msgs, setMsgs] = useState<MessageRow[] | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
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
    <div style={css('position:fixed;inset:0;z-index:200;display:flex;justify-content:center;background:rgba(0,0,0,0.001)')}>
      <div data-g="app" style={css('width:100%;max-width:430px;height:100%;background:#ffffff;display:flex;flex-direction:column;animation:fade 180ms ease both')}>
        <div style={css('flex:none;display:flex;align-items:center;gap:8px;padding:calc(6px + env(safe-area-inset-top)) 12px 6px;box-shadow:0 0.5px 0 rgba(0,0,33,0.08)')}>
          <button className="pr-dim" onClick={onBack} aria-label="뒤로" style={css('width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#191f28')}><BackIcon /></button>
          <ChatAvatar people={v.people} size={36} />
          <span style={css('flex:1;min-width:0;display:flex;flex-direction:column')}>
            <span style={css('font-size:16px;line-height:22px;font-weight:700;color:#191f28;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{v.title}</span>
            {chat.type === 'group' && <span style={css('font-size:12px;color:#8b95a1')}>{chat.members.length}명</span>}
          </span>
          {chat.type === 'group' && (
            <button className="pr-96" onClick={onLeave} style={css('height:34px;padding:0 12px;border-radius:10px;background:#fff0f1;color:#e42939;font-size:14px;font-weight:600')}>나가기</button>
          )}
        </div>

        <div ref={listRef} style={css('flex:1;overflow-y:auto;padding:16px 12px;display:flex;flex-direction:column;gap:4px;-webkit-overflow-scrolling:touch')}>
          {msgs === null ? null : msgs.length === 0 ? (
            <div style={css('margin:auto;display:flex;flex-direction:column;align-items:center;gap:10px;color:#8b95a1;font-size:14px;text-align:center')}>
              <ChatAvatar people={v.people} size={72} />
              <span style={css('font-size:17px;font-weight:700;color:#191f28')}>{v.title}</span>
              첫 메시지를 보내보세요
            </div>
          ) : msgs.map((m, i) => {
            const mine = m.uid === me.id
            const prev = msgs[i - 1]
            const firstOfRun = !prev || prev.uid !== m.uid
            const sender = byId.get(m.uid)
            return (
              <div key={m.id} style={sx('display:flex;gap:8px;align-items:flex-end', { justifyContent: mine ? 'flex-end' : 'flex-start', marginTop: firstOfRun && i > 0 ? 10 : 0 })}>
                {!mine && <span style={css('width:28px;flex:none')}>{firstOfRun && <Avatar photo={sender?.photoCss} size={28} />}</span>}
                <span style={sx('display:flex;flex-direction:column;gap:3px;max-width:72%', { alignItems: mine ? 'flex-end' : 'flex-start' })}>
                  {!mine && firstOfRun && chat.type === 'group' && <span style={css('font-size:12px;color:#6b7684;padding-left:4px')}>{sender?.name ?? '(탈퇴한 사람)'}</span>}
                  <span style={sx('padding:9px 13px;border-radius:18px;font-size:15px;line-height:21px;white-space:pre-wrap;word-break:break-word', { background: mine ? '#3182f6' : '#f2f4f6', color: mine ? '#ffffff' : '#191f28' })}>{m.text}</span>
                </span>
              </div>
            )
          })}
        </div>

        <div style={css('flex:none;padding:8px 12px calc(8px + env(safe-area-inset-bottom));box-shadow:0 -0.5px 0 rgba(0,0,33,0.08)')}>
          {v.canSend ? (
            <div style={css('display:flex;align-items:flex-end;gap:8px')}>
              <textarea
                className="ring-focus" rows={1} value={draft} maxLength={MAX_TEXT} placeholder="메시지 보내기"
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }}
                style={css('flex:1;min-width:0;min-height:44px;max-height:120px;resize:none;border:0;outline:none;border-radius:22px;background:#f2f4f6;padding:11px 16px;font-size:16px;line-height:22px;color:#191f28;font-family:inherit')}
              />
              <button className="pr-94" onClick={send} disabled={!draft.trim() || sending} aria-label="보내기" style={sx('width:44px;height:44px;flex:none;border-radius:9999px;display:flex;align-items:center;justify-content:center;transition:opacity 150ms', { background: '#3182f6', opacity: draft.trim() && !sending ? 1 : 0.35 })}>
                <PlaneIcon size={20} stroke="#ffffff" width={2.2} />
              </button>
            </div>
          ) : (
            <div style={css('height:44px;display:flex;align-items:center;justify-content:center;border-radius:14px;background:#f9fafb;font-size:14px;color:#8b95a1')}>{v.blockedReason}</div>
          )}
        </div>
      </div>
    </div>
  )
}

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
    <BottomSheet onScrim={onClose} scrim="rgba(0,0,0,0.3)" sheetStyle="border-radius:28px 28px 0 0;padding:8px 0 calc(16px + env(safe-area-inset-bottom));animation:sheetUp 420ms cubic-bezier(0.22,1,0.36,1) both;height:86vh;display:flex;flex-direction:column">
      <div style={css('width:36px;height:4px;border-radius:2px;background:#e5e8eb;margin:0 auto')} />
      <div style={css('padding:16px 20px 12px 24px;display:flex;align-items:center;justify-content:space-between')}>
        <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>새 채팅</span>
        <button className="pr-94" onClick={onClose} aria-label="닫기" style={css('width:36px;height:36px;border-radius:9999px;background:#f2f4f6;display:flex;align-items:center;justify-content:center')}><CloseIcon size={16} stroke="#4e5968" width={2.6} /></button>
      </div>
      <div style={css('padding:0 20px 8px;display:flex;flex-direction:column;gap:8px')}>
        <div className="ring-within" data-g="l1" style={css('height:44px;border-radius:12px;background:#f2f4f6;display:flex;align-items:center;gap:8px;padding:0 12px')}>
          <SearchIcon size={18} stroke="#8b95a1" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="이름 검색" style={css('flex:1;min-width:0;border:0;background:transparent;font-size:16px;color:#191f28;outline:none')} />
        </div>
        {group && <input data-g="l1" className="ring-focus" value={name} maxLength={MAX_GROUP_NAME} onChange={e => setName(e.target.value)} placeholder="단톡방 이름 (선택)" style={css(field)} />}
        <span style={css('font-size:13px;line-height:19px;color:#8b95a1')}>
          {picked.length === 0 ? '한 명을 고르면 1:1, 여러 명을 고르면 단톡방이 돼요' : `${picked.length}명 선택 · ${group ? '단톡방' : '1:1 채팅'}${full ? ` (최대 ${MAX_GROUP - 1}명)` : ''}`}
        </span>
      </div>
      <div style={css('flex:1;overflow-y:auto;padding:0 8px')}>
        {list.length === 0 && <div style={css('padding:32px;text-align:center;font-size:14px;color:#8b95a1')}>{candidates.length ? '검색 결과가 없어요' : '메시지를 받을 수 있는 사람이 없어요'}</div>}
        {list.map(p => {
          const on = picked.includes(p.id)
          return (
            <button key={p.id} className="pr-dim" role="checkbox" aria-checked={on} onClick={() => toggle(p.id)} style={sx('width:100%;display:flex;align-items:center;gap:12px;padding:8px 12px;border-radius:14px;text-align:left', { opacity: !on && full ? 0.4 : 1 })}>
              <Avatar frame={p.frame} photo={p.photoCss} size={44} style={{ flex: 'none' }} />
              <span style={css('flex:1;min-width:0;font-size:16px;font-weight:600;color:#191f28;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{p.name}</span>
              <span style={sx('width:24px;height:24px;flex:none;border-radius:9999px;display:flex;align-items:center;justify-content:center;transition:background 150ms', { background: on ? '#3182f6' : '#ffffff', boxShadow: on ? 'none' : 'inset 0 0 0 1.5px #d1d6db' })}>
                {on && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
              </span>
            </button>
          )
        })}
      </div>
      <div style={css('padding:12px 20px 0')}>
        <button data-g="primary" className="pr-96" disabled={!picked.length || busy} onClick={create} style={sx('width:100%;height:56px;border-radius:16px;background:#3182f6;color:#fff;font-size:17px;font-weight:600;transition:opacity 200ms', { opacity: picked.length && !busy ? 1 : 0.4 })}>
          {busy ? '만드는 중…' : group ? `단톡방 만들기 (${picked.length + 1}명)` : '채팅하기'}
        </button>
      </div>
    </BottomSheet>
  )
}

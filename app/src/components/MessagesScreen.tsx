import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Firestore } from 'firebase/firestore'
import { css, sx } from '../css'
import { MEDALS } from '../data'
import { MAX_GROUP, MAX_GROUP_NAME, MAX_TEXT, isUnread, loadImage, markRead, subscribeMessages, type ChatRow, type MessageRow } from '../backend/messages'
import { MAX_GIFT, subscribeGift, type Gift } from '../backend/gifts'
import { saveImage } from '../saveImage'
import type { Person } from '../model'
import { Avatar } from './Avatar'
import { BackIcon, ChevronRight, CloseIcon, SearchIcon } from './icons'
import { BottomSheet, Dialog } from './Overlays'

// Toss-style messages: grey-scale screens with blue500 as the only accent, lists on
// white (no cards), 16px grey bands between sections, 해요체 copy. Motion is quick
// and springy (cubic-bezier(0.16,1,0.3,1)); see the keyframes at the end of styles.css.

const EASE = 'cubic-bezier(0.16,1,0.3,1)'

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
const PhotoIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="3.5" /><circle cx="8.5" cy="9.5" r="1.8" /><path d="m21 15.5-4.8-4.8a1.5 1.5 0 0 0-2.1 0L5 19.5" /></svg>
)
const PlusIcon = ({ color = 'currentColor' }: { color?: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
)
const BellOffIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b0b8c1" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-label="알림 꺼짐"><path d="M8.7 3.9A6 6 0 0 1 18 9c0 3.2.8 5.4 1.6 6.8M6.3 6.3A6 6 0 0 0 6 9c0 5-2 7-2 7h12M10.3 20a2 2 0 0 0 3.4 0M3 3l18 18" /></svg>
)

const band = <div data-g="gap" style={css('height:16px;background:#f2f4f6')} />
const title17 = 'font-size:17px;line-height:25.5px;font-weight:500;color:#333d4b'
const caption = 'font-size:13px;line-height:19.5px;color:#6b7684'

export function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} className="pr-96" onClick={onToggle} style={sx(`width:50px;height:30px;border-radius:9999px;position:relative;flex:none;transition:background 240ms ${EASE}`, { background: on ? '#3182f6' : '#e5e8eb' })}>
      <span style={sx(`position:absolute;top:3px;width:24px;height:24px;border-radius:9999px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.12);transition:left 320ms ${EASE}`, { left: on ? 23 : 3 })} />
    </button>
  )
}

/** Small "3위" chip next to names; gold/silver/bronze for the top three. */
function RankChip({ rank }: { rank?: number }) {
  if (!rank) return null
  const m = MEDALS[rank - 1]
  return <span style={sx('flex:none;height:18px;padding:0 6px;border-radius:9999px;font-size:11px;line-height:18px;font-weight:700;font-variant-numeric:tabular-nums', { background: m ? m[0] : '#f2f4f6', color: m ? m[1] : '#6b7684' })}>{rank}위</span>
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

function ChatAvatar({ people, size, photo }: { people: Person[]; size: number; photo?: string }) {
  if (photo) return <span style={sx('flex:none;border-radius:9999px;background-size:cover;background-position:center', { width: size, height: size, backgroundImage: `url(${photo})` })} />
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

// ---- chat backgrounds (per person, per chat — kept on this device) ----------------

const BGS: [string, string, string][] = [
  ['default', '기본', '#ffffff'],
  ['sky', '하늘', 'linear-gradient(180deg,#eef6ff,#dbeaff)'],
  ['mint', '민트', 'linear-gradient(180deg,#eefaf4,#d8f2e5)'],
  ['lavender', '라벤더', 'linear-gradient(180deg,#f6f2ff,#e6dcfe)'],
  ['peach', '복숭아', 'linear-gradient(180deg,#fff6f0,#ffe3d3)'],
  ['dusk', '노을', 'linear-gradient(180deg,#fff0f4,#e7ebff)'],
]
const bgKey = (chatId: string) => `vote.chatBg.${chatId}`
function loadBg(chatId: string) { try { return localStorage.getItem(bgKey(chatId)) || 'default' } catch { return 'default' } }
function saveBg(chatId: string, k: string) { try { localStorage.setItem(bgKey(chatId), k) } catch { /* private mode */ } }

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
      <div className="anim-list" style={css('flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:48px 24px;text-align:center')}>
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
      <div style={css('padding:24px 16px 20px 24px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;animation:listIn 420ms ' + EASE + ' both')}>
        <span style={css('display:flex;flex-direction:column;gap:4px')}>
          <h1 style={css('margin:0;font-size:22px;line-height:31px;font-weight:700;color:#191f28')}>메시지</h1>
          <span style={css('font-size:15px;line-height:22.5px;color:#6b7684')}>{off ? '메시지 받기가 꺼져 있어요' : '1:1이나 단톡방에서 이야기해요'}</span>
        </span>
        <button className="pr-94" onClick={onNew} disabled={off} aria-label="새 채팅" style={sx('width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#4e5968;flex:none;transition:opacity 200ms', { opacity: off ? 0.3 : 1 })}><ComposeIcon /></button>
      </div>

      {chats.length === 0 ? (
        <div className="anim-list" style={css('padding:40px 24px 48px;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center')}>
          <span style={css('font-size:40px;line-height:1;margin-bottom:12px')}>✉️</span>
          <span style={css('font-size:17px;line-height:25.5px;font-weight:600;color:#333d4b')}>아직 대화가 없어요</span>
          <span style={css('font-size:15px;line-height:22.5px;color:#6b7684')}>랭킹에서 프로필을 눌러 메시지를 보내보세요</span>
          {!off && <button className="pr-96" onClick={onNew} style={css('margin-top:16px;height:38px;padding:0 16px;border-radius:10px;background:#e8f3ff;color:#1b64da;font-size:15px;font-weight:600')}>새 채팅 시작하기</button>}
        </div>
      ) : (
        <div className="anim-list" style={css('display:flex;flex-direction:column')}>
          {chats.map(c => {
            const v = describeChat(c, me.id, byId, off)
            const unread = isUnread(c, me.id)
            const muted = !!c.mutes?.[me.id]
            const lastText = c.last ? (c.last.text || '사진') : ''
            const who = c.last ? (c.last.uid === me.id ? '나: ' : c.type === 'group' ? `${byId.get(c.last.uid)?.name ?? '(탈퇴한 사람)'}: ` : '') : ''
            return (
              <button key={c.id} className="pr-dim" onClick={() => onOpen(c.id)} style={css(`display:flex;align-items:center;gap:14px;padding:12px 20px 12px 24px;border-radius:12px;text-align:left;margin:0 4px;transition:background 200ms ${EASE}`)}>
                <ChatAvatar people={v.people} size={48} photo={c.photo} />
                <span style={css('flex:1;min-width:0;display:flex;flex-direction:column')}>
                  <span style={css('display:flex;align-items:center;gap:4px;min-width:0')}>
                    <span style={sx(title17 + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis', { fontWeight: unread ? 600 : 500, color: unread ? '#191f28' : '#333d4b' })}>{v.title}</span>
                    {c.type === 'group' && <span style={css('flex:none;font-size:15px;color:#8b95a1')}>{c.members.length}</span>}
                    {muted && <BellOffIcon />}
                  </span>
                  <span style={sx('font-size:15px;line-height:22.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis', { color: unread ? '#333d4b' : '#6b7684', fontWeight: unread ? 500 : 400 })}>{c.last ? who + lastText : '대화를 시작해보세요'}</span>
                </span>
                <span style={css('flex:none;align-self:stretch;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:8px')}>
                  <span style={css('font-size:13px;line-height:19.5px;color:#8b95a1')}>{timeLabel(c.last?.at?.toMillis() ?? 0)}</span>
                  {unread ? <span key="dot" style={css('width:8px;height:8px;border-radius:9999px;background:#3182f6;animation:dotPop 420ms ' + EASE + ' both')} /> : <span style={{ height: 8 }} />}
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

// ---- keyboard-safe full-screen layer ---------------------------------------------

/**
 * Pins the chat to the *visual* viewport and locks the page behind it, so opening
 * the keyboard doesn't scroll the page and show whatever is underneath (the
 * "screen tearing open" feeling on iPhone). The input stays right above the keyboard.
 */
export function useKeyboardSafeBox() {
  const [box, setBox] = useState(() => ({ top: 0, height: typeof window === 'undefined' ? 0 : (window.visualViewport?.height ?? window.innerHeight) }))
  useEffect(() => {
    const y = window.scrollY
    const b = document.body.style
    const prev = { position: b.position, top: b.top, width: b.width, overflow: b.overflow }
    Object.assign(b, { position: 'fixed', top: `-${y}px`, width: '100%', overflow: 'hidden' })
    const vv = window.visualViewport
    const update = () => setBox({ top: vv ? vv.offsetTop : 0, height: vv ? vv.height : window.innerHeight })
    update()
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      Object.assign(b, prev)
      window.scrollTo(0, y)
    }
  }, [])
  return box
}

// ---- 채팅방 -----------------------------------------------------------------------

type RoomProps = {
  db: Firestore
  chat: ChatRow
  me: Person
  all: Person[]
  byId: Map<string, Person>
  onBack: () => void
  onSend: (text: string) => Promise<boolean>
  onSendImage: (file: File) => Promise<boolean>
  myPoints: number
  onSendGift: (amount: number) => Promise<boolean>
  onClaimGift: (giftId: string) => void
  onCancelGift: (giftId: string) => void
  onToast: (msg: string) => void
  onMute: (muted: boolean) => void
  onLeave: () => void
  onInvite: (ids: string[]) => Promise<boolean>
  onGroupInfo: (patch: { photoFile?: File; name?: string }) => Promise<boolean>
  onOpenProfile: (uid: string) => void
  onError: (msg: string, e: unknown) => void
}

export function ChatRoom(p: RoomProps) {
  const { db, chat, me, byId, onBack, onSend, onSendImage, onError, onOpenProfile } = p
  const [msgs, setMsgs] = useState<MessageRow[] | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [menu, setMenu] = useState(false)
  const [viewer, setViewer] = useState<string | null>(null)
  const [bg, setBg] = useState(() => loadBg(chat.id))
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [attach, setAttach] = useState<'menu' | 'gift' | null>(null)
  const firstIds = useRef<Set<string> | null>(null)
  const box = useKeyboardSafeBox()
  const v = describeChat(chat, me.id, byId, !!me.msgOff)
  const bgCss = (BGS.find(b => b[0] === bg) ?? BGS[0])[2]
  const tinted = bg !== 'default'

  useEffect(() => subscribeMessages(db, chat.id, rows => {
    if (!firstIds.current) firstIds.current = new Set(rows.map(r => r.id))
    setMsgs(rows)
  }, e => onError('메시지를 불러오지 못했어요', e)), [db, chat.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // Opening the room (and every new message while it's open) marks it read.
  useEffect(() => { if (isUnread(chat, me.id)) markRead(db, me.id, chat.id).catch(() => {}) }, [db, chat, me.id])
  const toBottom = (smooth = false) => { const el = listRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }) }
  useLayoutEffect(() => {
    const last = msgs?.[msgs.length - 1]
    toBottom(!!last && last.uid !== me.id && firstIds.current !== null && !firstIds.current.has(last.id))
  }, [msgs]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { toBottom() }, [box.height])
  // Auto-grow the input up to ~5 lines.
  useLayoutEffect(() => { const t = inputRef.current; if (t) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px' } }, [draft])

  const send = async () => {
    const t = draft.trim()
    if (!t || sending || !v.canSend) return
    setSending(true)
    setDraft('')
    if (!(await onSend(t))) setDraft(t)
    setSending(false)
  }
  const pickPhoto = async (f: File) => {
    setSending(true)
    await onSendImage(f)
    setSending(false)
  }

  return (
    <div style={sx('position:fixed;left:0;right:0;z-index:200;display:flex;justify-content:center', { top: box.top, height: box.height })}>
      <div data-g="app" style={css(`width:100%;max-width:430px;height:100%;display:flex;flex-direction:column;position:relative;overflow:hidden;background:#ffffff;animation:roomIn 360ms ${EASE} both`)}>
        <div style={sx('flex:none;display:flex;align-items:center;gap:4px;padding:4px 8px;position:relative;z-index:2', { paddingTop: box.top ? 4 : 'calc(4px + env(safe-area-inset-top))', background: tinted ? 'rgba(255,255,255,0.72)' : '#ffffff', backdropFilter: tinted ? 'blur(12px)' : undefined })}>
          <button className="pr-dim" onClick={onBack} aria-label="뒤로" style={css('width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#191f28')}><BackIcon /></button>
          <button className="pr-dim" onClick={() => (chat.type === 'dm' && v.people[0] ? onOpenProfile(v.people[0].id) : setMenu(true))} style={css('flex:1;min-width:0;display:flex;align-items:center;gap:10px;padding:4px;border-radius:12px;text-align:left')}>
            <ChatAvatar people={v.people} size={32} photo={chat.photo} />
            <span style={css('min-width:0;display:flex;align-items:baseline;gap:6px')}>
              <span style={css('font-size:17px;line-height:25.5px;font-weight:600;color:#191f28;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{v.title}</span>
              {chat.type === 'group' && <span style={css('flex:none;font-size:15px;color:#8b95a1')}>{chat.members.length}</span>}
            </span>
          </button>
          <button className="pr-dim" onClick={() => setMenu(true)} aria-label="채팅방 메뉴" style={css('width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#4e5968')}><MenuIcon /></button>
        </div>

        <div ref={listRef} style={sx('flex:1;overflow-y:auto;overscroll-behavior:contain;padding:8px 16px 16px;display:flex;flex-direction:column;-webkit-overflow-scrolling:touch;transition:background 400ms ease', { background: bgCss })}>
          {msgs === null ? null : msgs.length === 0 ? (
            <div className="anim-list" style={css('margin:auto;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center')}>
              <ChatAvatar people={v.people} size={72} photo={chat.photo} />
              <span style={css('margin-top:12px;font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>{v.title}</span>
              <span style={css('font-size:15px;line-height:22.5px;color:#6b7684')}>첫 메시지를 보내보세요</span>
            </div>
          ) : msgs.map((m, i) => {
            const mine = m.uid === me.id
            const prev = msgs[i - 1], next = msgs[i + 1]
            const at = m.at?.toMillis() ?? 0
            const newDay = !prev || new Date(prev.at?.toMillis() ?? 0).toDateString() !== new Date(at).toDateString()
            const isNew = !!firstIds.current && !firstIds.current.has(m.id)
            const dayRow = newDay && at > 0 && <div style={css('align-self:center;margin:16px 0 8px;font-size:13px;line-height:19.5px;color:#8b95a1')}>{dayLabel(at)}</div>
            if (m.kind === 'system') {
              return (
                <Fragment key={m.id}>
                  {dayRow}
                  <div data-anim style={sx('align-self:center;margin:12px 0 4px;padding:4px 12px;border-radius:9999px;font-size:13px;line-height:19.5px;color:#6b7684;text-align:center', { background: tinted ? 'rgba(255,255,255,0.7)' : '#f2f4f6', animation: isNew ? `listIn 420ms ${EASE} both` : undefined })}>{m.text}</div>
                </Fragment>
              )
            }
            // A new run (avatar + name again) when the sender changes or a minute has passed.
            const firstOfRun = newDay || prev.uid !== m.uid || prev.kind === 'system' || at - (prev.at?.toMillis() ?? 0) > 60_000
            const lastOfRun = !next || next.uid !== m.uid || next.kind === 'system' || (next.at?.toMillis() ?? 0) - at > 60_000 || clock(next.at?.toMillis() ?? 0) !== clock(at)
            const sender = byId.get(m.uid)
            // KakaoTalk-style unread count: members (other than the sender) who haven't opened the chat since this message.
            const unreadBy = chat.members.filter(u => u !== m.uid && (chat.reads?.[u]?.toMillis() ?? 0) < at).length
            const bubble = m.kind === 'gift' && m.giftId
              ? <GiftBubble db={db} giftId={m.giftId} me={me.id} byId={byId} onClaim={p.onClaimGift} onCancel={p.onCancelGift} />
              : m.kind === 'image'
              ? <ImageBubble db={db} chatId={chat.id} msgId={m.id} onOpen={setViewer} />
              : <span style={sx('padding:10px 14px;border-radius:20px;font-size:15px;line-height:22px;white-space:pre-wrap;word-break:break-word', { background: mine ? '#3182f6' : tinted ? '#ffffff' : '#f2f4f6', color: mine ? '#ffffff' : '#191f28', fontWeight: mine ? 500 : 400 })}>{m.text}</span>
            return (
              <Fragment key={m.id}>
                {dayRow}
                <div data-anim style={sx('display:flex;gap:8px;align-items:flex-end', { justifyContent: mine ? 'flex-end' : 'flex-start', marginTop: firstOfRun ? 12 : 4, animation: isNew ? (mine ? 'msgSend 520ms cubic-bezier(0.25,0.9,0.3,1) both' : `msgInL 380ms ${EASE} both`) : undefined, transformOrigin: mine ? 'bottom right' : 'bottom left' })}>
                  {!mine && (
                    <span style={css('width:32px;flex:none;align-self:flex-start')}>
                      {firstOfRun && <button className="pr-94" onClick={() => sender && onOpenProfile(sender.id)} aria-label={`${sender?.name ?? ''} 프로필`} style={css('display:block;border-radius:9999px')}><Avatar frame={sender?.frame} photo={sender?.photoCss} size={32} /></button>}
                    </span>
                  )}
                  <span style={sx('display:flex;flex-direction:column;gap:4px;max-width:74%', { alignItems: mine ? 'flex-end' : 'flex-start' })}>
                    {!mine && firstOfRun && chat.type === 'group' && (
                      <button onClick={() => sender && onOpenProfile(sender.id)} style={css('display:flex;align-items:center;gap:4px;padding:0;text-align:left')}>
                        <span style={css('font-size:13px;line-height:19.5px;color:#4e5968;font-weight:500')}>{sender?.name ?? '(탈퇴한 사람)'}</span>
                        <RankChip rank={sender?.rank} />
                      </button>
                    )}
                    <span style={sx('display:flex;align-items:flex-end;gap:6px', { flexDirection: mine ? 'row-reverse' : 'row' })}>
                      {bubble}
                      {(lastOfRun || unreadBy > 0) && (
                        <span style={sx('flex:none;display:flex;flex-direction:column;gap:0', { alignItems: mine ? 'flex-end' : 'flex-start' })}>
                          {unreadBy > 0 && <span key={unreadBy} aria-label={`안 읽은 사람 ${unreadBy}명`} style={css(`font-size:11px;line-height:14px;font-weight:700;color:#f5a300;font-variant-numeric:tabular-nums;animation:dotPop 320ms ${EASE} both`)}>{unreadBy}</span>}
                          {lastOfRun && <span style={css('font-size:11px;line-height:16px;color:#8b95a1;white-space:nowrap')}>{clock(at)}</span>}
                        </span>
                      )}
                    </span>
                  </span>
                </div>
              </Fragment>
            )
          })}
        </div>

        <div style={sx('flex:none;padding:8px 12px', { paddingBottom: box.top || box.height < window.innerHeight - 80 ? 8 : 'calc(8px + env(safe-area-inset-bottom))', background: '#ffffff' })}>
          {v.canSend ? (
            <div style={css('display:flex;align-items:flex-end;gap:6px')}>
              <button className="pr-94" onClick={() => setAttach(a => (a ? null : 'menu'))} disabled={sending} aria-label="사진·포인트 선물" aria-expanded={!!attach} style={sx(`width:44px;height:44px;flex:none;border-radius:9999px;display:flex;align-items:center;justify-content:center;color:#4e5968;background:#f2f4f6;transition:transform 260ms ${EASE}`, { transform: attach ? 'rotate(45deg)' : 'none' })}><PlusIcon /></button>
              <input ref={fileRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) pickPhoto(f); e.target.value = '' }} style={css('display:none')} />
              <textarea
                ref={inputRef} className="box-focus" rows={1} value={draft} maxLength={MAX_TEXT} placeholder="메시지 보내기"
                onChange={e => setDraft(e.target.value)}
                onFocus={() => setTimeout(() => toBottom(true), 300)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }}
                style={css(`flex:1;min-width:0;min-height:44px;max-height:120px;resize:none;border:0;outline:none;border-radius:22px;background-color:#f2f4f6;padding:11px 16px;font-size:17px;line-height:22px;color:#191f28;font-family:inherit;transition:background-color 200ms ${EASE}`)}
              />
              <button className="pr-94" onPointerDown={e => e.preventDefault()} onMouseDown={e => e.preventDefault()} onClick={send} disabled={!draft.trim() || sending} aria-label="보내기" style={sx(`width:44px;height:44px;flex:none;border-radius:9999px;background:#3182f6;display:flex;align-items:center;justify-content:center;transition:opacity 200ms ${EASE},transform 200ms ${EASE}`, { opacity: draft.trim() && !sending ? 1 : 0.3, transform: draft.trim() ? 'scale(1)' : 'scale(0.92)' })}>
                <PlaneIcon size={20} stroke="#ffffff" width={2.2} />
              </button>
            </div>
          ) : (
            <div style={css('min-height:44px;display:flex;align-items:center;justify-content:center;padding:0 16px;border-radius:22px;background:#f2f4f6;font-size:15px;color:#6b7684;text-align:center')}>{v.blockedReason}</div>
          )}
        </div>

        {menu && (
          <ChatMenu {...p} bg={bg} onBg={k => { setBg(k); saveBg(chat.id, k) }} onClose={() => setMenu(false)}
            onLeave={() => { setMenu(false); p.onLeave() }}
            onOpenProfile={uid => { setMenu(false); onOpenProfile(uid) }} />
        )}
        {viewer && <ImageViewer src={viewer} onClose={() => setViewer(null)} onToast={p.onToast} />}
        {attach === 'menu' && (
          <BottomSheet onScrim={() => setAttach(null)} scrim="rgba(0,0,0,0.2)" sheetStyle={`border-radius:28px 28px 0 0;padding:8px 0 calc(20px + env(safe-area-inset-bottom));animation:sheetUp 380ms ${EASE} both`}>
            <div style={css('width:36px;height:4px;border-radius:2px;background:#e5e8eb;margin:0 auto')} />
            <div className="anim-list" style={css('padding:24px 24px 8px;display:grid;grid-template-columns:repeat(2,1fr);gap:12px')}>
              <button className="pr-96" onClick={() => { setAttach(null); fileRef.current?.click() }} style={css('display:flex;flex-direction:column;align-items:center;gap:10px;padding:18px 0;border-radius:20px;background:#f9fafb')}>
                <span style={css('width:56px;height:56px;border-radius:9999px;background:#e8f3ff;color:#3182f6;display:flex;align-items:center;justify-content:center')}><PhotoIcon /></span>
                <span style={css('font-size:15px;font-weight:600;color:#333d4b')}>사진</span>
              </button>
              <button className="pr-96" onClick={() => setAttach('gift')} style={css('display:flex;flex-direction:column;align-items:center;gap:10px;padding:18px 0;border-radius:20px;background:#f9fafb')}>
                <span style={css('width:56px;height:56px;border-radius:9999px;background:#fff4d6;display:flex;align-items:center;justify-content:center;font-size:28px')}>🎁</span>
                <span style={css('font-size:15px;font-weight:600;color:#333d4b')}>포인트 선물</span>
              </button>
            </div>
          </BottomSheet>
        )}
        {attach === 'gift' && (
          <GiftSheet
            points={p.myPoints} group={chat.type === 'group'} to={chat.type === 'dm' ? v.people[0]?.name : undefined}
            onClose={() => setAttach(null)}
            onSend={async n => { if (await p.onSendGift(n)) setAttach(null) }}
          />
        )}
      </div>
    </div>
  )
}

function ImageBubble({ db, chatId, msgId, onOpen }: { db: Firestore; chatId: string; msgId: string; onOpen: (src: string) => void }) {
  const [src, setSrc] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { let live = true; loadImage(db, chatId, msgId).then(s => { if (live) setSrc(s) }).catch(() => {}); return () => { live = false } }, [db, chatId, msgId])
  return (
    <button className="pr-96" onClick={() => src && onOpen(src)} aria-label="사진 크게 보기" style={css('display:block;padding:0;border-radius:18px;overflow:hidden;position:relative;min-width:120px;min-height:120px;background:#f2f4f6')}>
      {!loaded && <span className="skeleton" style={css('position:absolute;inset:0')} />}
      {src && <img src={src} alt="사진" onLoad={() => setLoaded(true)} style={sx(`display:block;max-width:220px;max-height:300px;object-fit:cover;transition:opacity 300ms ${EASE}`, { opacity: loaded ? 1 : 0 })} />}
    </button>
  )
}

function ImageViewer({ src, onClose, onToast }: { src: string; onClose: () => void; onToast: (msg: string) => void }) {
  const save = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try { if ((await saveImage(src)) === 'downloaded') onToast('사진을 저장했어요') }
    catch (err) { if ((err as Error)?.name !== 'AbortError') onToast('사진을 저장하지 못했어요') }
  }
  return (
    <div onClick={onClose} role="dialog" aria-label="사진" style={css('position:absolute;inset:0;z-index:20;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;animation:fade 200ms ease both')}>
      <img src={src} alt="사진" onClick={e => e.stopPropagation()} style={css(`max-width:100%;max-height:100%;object-fit:contain;animation:viewerIn 320ms ${EASE} both;-webkit-touch-callout:default`)} />
      <button onClick={onClose} aria-label="닫기" style={css('position:absolute;top:calc(12px + env(safe-area-inset-top));right:12px;width:44px;height:44px;border-radius:9999px;background:rgba(255,255,255,0.16);display:flex;align-items:center;justify-content:center')}><CloseIcon size={20} stroke="#fff" width={2.4} /></button>
      <button className="pr-96" onClick={save} style={css('position:absolute;left:50%;transform:translateX(-50%);bottom:calc(24px + env(safe-area-inset-bottom));height:48px;padding:0 20px;border-radius:9999px;background:rgba(255,255,255,0.18);color:#fff;font-size:16px;font-weight:600;display:flex;align-items:center;gap:8px;backdrop-filter:blur(8px)')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7 10.5l5 5 5-5" /><path d="M5 20h14" /></svg>
        저장
      </button>
    </div>
  )
}

/** Kakao-style gift card in the chat: 받기 / 취소하기 / who got it. */
function GiftBubble({ db, giftId, me, byId, onClaim, onCancel }: { db: Firestore; giftId: string; me: string; byId: Map<string, Person>; onClaim: (id: string) => void; onCancel: (id: string) => void }) {
  const [g, setG] = useState<Gift | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  useEffect(() => subscribeGift(db, giftId, setG), [db, giftId])
  useEffect(() => { setBusy(false) }, [g?.status])
  const amount = g ? g.amount.toLocaleString() + 'P' : ''
  const mine = g?.from === me
  const canTake = !!g && g.status === 'open' && !mine && (!g.to || g.to === me)
  const done = g?.status !== 'open'
  const status = !g ? '불러오는 중이에요' : g.status === 'claimed' ? (g.claimedBy === me ? '내가 받았어요' : `${byId.get(g.claimedBy ?? '')?.name ?? '누군가'}님이 받았어요`)
    : g.status === 'cancelled' ? '취소된 선물이에요'
    : mine ? (g.to ? '아직 받지 않았어요' : '먼저 받는 한 명이 가져가요') : g.to ? '나에게 온 선물이에요' : '먼저 받는 사람이 가져가요'
  return (
    <span style={sx(`width:228px;border-radius:20px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 0 0 1px rgba(0,0,33,0.06);transition:filter 300ms ${EASE}`, { filter: done ? 'saturate(0.35)' : 'none', background: '#ffffff' })}>
      <span style={css('padding:16px 16px 14px;background:linear-gradient(135deg,#fff1c2,#ffd66b);display:flex;align-items:center;gap:12px')}>
        <span style={css('font-size:34px;line-height:1')}>🎁</span>
        <span style={css('display:flex;flex-direction:column')}>
          <span style={css('font-size:13px;font-weight:600;color:#8a5a00')}>포인트 선물</span>
          <span style={css('font-size:22px;line-height:30px;font-weight:800;color:#5c3d00;font-variant-numeric:tabular-nums')}>{amount}</span>
        </span>
      </span>
      <span style={css('padding:10px 14px 12px;display:flex;flex-direction:column;gap:8px')}>
        <span style={css('font-size:13px;line-height:19px;color:#6b7684')}>{status}</span>
        {canTake && <button className="pr-96" disabled={busy} onClick={() => { setBusy(true); onClaim(giftId) }} style={sx('height:40px;border-radius:12px;background:#3182f6;color:#fff;font-size:15px;font-weight:600', { opacity: busy ? 0.5 : 1 })}>받기</button>}
        {g?.status === 'open' && mine && <button className="pr-96" disabled={busy} onClick={() => { setBusy(true); onCancel(giftId) }} style={sx('height:40px;border-radius:12px;background:#f2f4f6;color:#4e5968;font-size:15px;font-weight:600', { opacity: busy ? 0.5 : 1 })}>취소하기</button>}
      </span>
    </span>
  )
}

/** "얼마를 선물할까요?" */
function GiftSheet({ points, group, to, onClose, onSend }: { points: number; group: boolean; to?: string; onClose: () => void; onSend: (n: number) => Promise<void> }) {
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const n = Number(amount || 0)
  const ok = Number.isInteger(n) && n >= 1 && n <= Math.min(points, MAX_GIFT)
  const add = (k: number) => setAmount(String(Math.min(points, (Number(amount) || 0) + k)))
  return (
    <BottomSheet onScrim={onClose} scrim="rgba(0,0,0,0.2)" sheetStyle={`border-radius:28px 28px 0 0;padding:8px 0 calc(20px + env(safe-area-inset-bottom));animation:sheetUp 420ms ${EASE} both`}>
      <div style={css('width:36px;height:4px;border-radius:2px;background:#e5e8eb;margin:0 auto')} />
      <div style={css('padding:20px 24px 8px;display:flex;flex-direction:column;gap:4px')}>
        <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>얼마를 선물할까요?</span>
        <span style={css('font-size:15px;line-height:22.5px;color:#6b7684')}>{group ? '단톡방에서는 먼저 받는 한 명이 가져가요' : `${to ?? '상대'}님에게 보내요`} · 받기 전에는 취소할 수 있어요</span>
      </div>
      <div style={css('padding:16px 24px 0;display:flex;align-items:baseline;gap:6px')}>
        <input autoFocus inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="0"
          style={sx('flex:1;min-width:0;border:0;outline:none;background:transparent;font-size:34px;line-height:44px;font-weight:700;font-variant-numeric:tabular-nums', { color: amount && !ok ? '#f04452' : '#191f28' })} />
        <span style={css('font-size:26px;font-weight:700;color:#191f28')}>P</span>
      </div>
      <div style={sx('padding:4px 24px 0;font-size:13px', { color: amount && !ok ? '#f04452' : '#8b95a1' })}>{amount && n > points ? `포인트가 모자라요 · 내 포인트 ${points.toLocaleString()}P` : `내 포인트 ${points.toLocaleString()}P`}</div>
      <div className="anim-list" style={css('padding:16px 24px 0;display:flex;gap:6px;flex-wrap:wrap')}>
        {[10, 50, 100, 500].map(k => <button key={k} className="pr-96" onClick={() => add(k)} style={css('height:34px;padding:0 14px;border-radius:9999px;background:#f2f4f6;color:#4e5968;font-size:14px;font-weight:600')}>+{k}</button>)}
        <button className="pr-96" onClick={() => setAmount(String(Math.min(points, MAX_GIFT)))} style={css('height:34px;padding:0 14px;border-radius:9999px;background:#f2f4f6;color:#4e5968;font-size:14px;font-weight:600')}>전부</button>
      </div>
      <div style={css('padding:24px 20px 0')}>
        <button data-g="primary" className="pr-96" disabled={!ok || busy} onClick={async () => { setBusy(true); try { await onSend(n) } finally { setBusy(false) } }}
          style={sx(`width:100%;height:56px;border-radius:16px;background:#3182f6;color:#fff;font-size:17px;font-weight:600;transition:opacity 200ms ${EASE}`, { opacity: ok && !busy ? 1 : 0.3 })}>{ok ? `${n.toLocaleString()}P 선물하기` : '선물하기'}</button>
      </div>
    </BottomSheet>
  )
}

// ---- ≡ 채팅방 메뉴 ------------------------------------------------------------------

type MenuProps = RoomProps & { bg: string; onBg: (k: string) => void; onClose: () => void }

/** KakaoTalk-style side panel: who's here (tap for profile), invite, 알림, photo/name, background, 나가기 (asks twice). */
function ChatMenu({ chat, me, all, byId, bg, onBg, onClose, onMute, onLeave, onInvite, onGroupInfo, onOpenProfile }: MenuProps) {
  const [ask, setAsk] = useState<0 | 1 | 2>(0)
  const [sheet, setSheet] = useState<'invite' | 'bg' | 'name' | null>(null)
  const [nameDraft, setNameDraft] = useState(chat.name)
  const photoRef = useRef<HTMLInputElement>(null)
  const muted = !!chat.mutes?.[me.id]
  const members = [me.id, ...chat.members.filter(m => m !== me.id)]
  const group = chat.type === 'group'
  const row = (label: string, onClick: () => void, extra?: ReactNode, color = '#333d4b') => (
    <button className="pr-dim" onClick={onClick} style={css('width:calc(100% - 8px);margin:0 4px;display:flex;align-items:center;gap:12px;padding:14px 16px 14px 20px;border-radius:12px;text-align:left')}>
      <span style={sx('flex:1;font-size:17px;line-height:25.5px;font-weight:500', { color })}>{label}</span>
      {extra}<ChevronRight size={18} />
    </button>
  )
  return (
    <>
      <div data-g="scrim" onClick={onClose} style={css('position:absolute;inset:0;z-index:10;background:rgba(0,0,0,0.2);animation:fade 240ms ease both')} />
      <div role="dialog" aria-label="채팅방 메뉴" data-g="l4" style={css(`position:absolute;top:0;right:0;bottom:0;z-index:11;width:84%;max-width:340px;background:#ffffff;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);animation:slideInRight 380ms ${EASE} both`)}>
        <div style={css('flex:none;padding:12px 12px 8px 24px;display:flex;align-items:center;justify-content:space-between')}>
          <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>채팅방 정보</span>
          <button className="pr-dim" onClick={onClose} aria-label="닫기" style={css('width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center')}><CloseIcon size={20} stroke="#4e5968" width={2.4} /></button>
        </div>
        <div className="anim-list" style={css('flex:1;overflow-y:auto')}>
          <div style={css('padding:12px 24px 4px;' + caption)}>대화 상대 {chat.members.length}명</div>
          {group && chat.members.length < MAX_GROUP && (
            <button className="pr-dim" onClick={() => setSheet('invite')} style={css('width:calc(100% - 8px);margin:0 4px;display:flex;align-items:center;gap:12px;padding:10px 20px;border-radius:12px;text-align:left')}>
              <span style={css('width:40px;height:40px;border-radius:9999px;background:#e8f3ff;display:flex;align-items:center;justify-content:center;flex:none')}><PlusIcon color="#3182f6" /></span>
              <span style={css('font-size:17px;line-height:25.5px;font-weight:500;color:#1b64da')}>대화 상대 초대하기</span>
            </button>
          )}
          {members.map(id => {
            const p = byId.get(id)
            return (
              <button key={id} className="pr-dim" disabled={!p} onClick={() => p && onOpenProfile(id)} style={css('width:calc(100% - 8px);margin:0 4px;display:flex;align-items:center;gap:12px;padding:10px 20px;border-radius:12px;text-align:left')}>
                <Avatar frame={p?.frame} photo={p?.photoCss} size={40} style={{ flex: 'none' }} />
                <span style={css('flex:1;min-width:0;display:flex;align-items:center;gap:6px')}>
                  <span style={css(title17 + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{p?.name ?? '(탈퇴한 사람)'}</span>
                  <RankChip rank={p?.rank} />
                </span>
                {id === me.id && <span style={css('flex:none;height:22px;padding:0 8px;border-radius:9999px;background:#f2f4f6;color:#6b7684;font-size:12px;font-weight:600;display:flex;align-items:center')}>나</span>}
                {id !== me.id && p?.msgOff && <span style={css('flex:none;font-size:13px;color:#8b95a1')}>메시지 꺼둠</span>}
              </button>
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
          {row('배경', () => setSheet('bg'), <span style={css('font-size:15px;color:#8b95a1')}>{(BGS.find(b => b[0] === bg) ?? BGS[0])[1]}</span>)}
          {group && row('채팅방 사진', () => photoRef.current?.click(), chat.photo ? <ChatAvatar people={[]} size={28} photo={chat.photo} /> : undefined)}
          {group && row('채팅방 이름', () => { setNameDraft(chat.name); setSheet('name') }, <span style={css('font-size:15px;color:#8b95a1;max-width:110px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{chat.name || '없음'}</span>)}
          <input ref={photoRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) onGroupInfo({ photoFile: f }); e.target.value = '' }} style={css('display:none')} />
        </div>
        {group && (
          <button className="pr-dim" onClick={() => setAsk(1)} style={css('flex:none;margin:0 4px 8px;padding:16px 20px;border-radius:12px;text-align:left;font-size:17px;font-weight:500;color:#f04452')}>채팅방 나가기</button>
        )}
      </div>

      {sheet === 'invite' && (
        <PeopleSheet
          title="누구를 초대할까요?" all={all} exclude={chat.members} max={MAX_GROUP - chat.members.length}
          cta={n => `${n}명 초대하기`} onClose={() => setSheet(null)}
          onDone={async ids => { if (await onInvite(ids)) setSheet(null) }}
        />
      )}
      {sheet === 'bg' && (
        <BottomSheet onScrim={() => setSheet(null)} scrim="rgba(0,0,0,0.2)" sheetStyle={`border-radius:28px 28px 0 0;padding:8px 0 calc(20px + env(safe-area-inset-bottom));animation:sheetUp 420ms ${EASE} both`}>
          <div style={css('width:36px;height:4px;border-radius:2px;background:#e5e8eb;margin:0 auto')} />
          <div style={css('padding:20px 24px 16px;display:flex;flex-direction:column;gap:4px')}>
            <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>어떤 배경으로 할까요?</span>
            <span style={css('font-size:15px;line-height:22.5px;color:#6b7684')}>나에게만 보여요</span>
          </div>
          <div className="anim-list" style={css('padding:0 20px 8px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px')}>
            {BGS.map(([k, label, fill]) => (
              <button key={k} className="pr-96" onClick={() => { onBg(k); setSheet(null) }} style={css('display:flex;flex-direction:column;align-items:center;gap:6px;padding:0')}>
                <span style={sx(`width:100%;height:84px;border-radius:16px;transition:box-shadow 200ms ${EASE}`, { background: fill, boxShadow: bg === k ? 'inset 0 0 0 2px #3182f6' : 'inset 0 0 0 1px rgba(0,0,33,0.08)' })} />
                <span style={sx('font-size:13px;font-weight:600', { color: bg === k ? '#1b64da' : '#4e5968' })}>{label}</span>
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
      {sheet === 'name' && (
        <Dialog onScrim={() => setSheet(null)} gap={20}>
          <div style={css('padding:0 4px;display:flex;flex-direction:column;gap:12px')}>
            <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>채팅방 이름을 바꿀까요?</span>
            <input autoFocus className="box-focus" value={nameDraft} maxLength={MAX_GROUP_NAME} onChange={e => setNameDraft(e.target.value)} placeholder="채팅방 이름" style={css('height:48px;border:0;outline:none;border-radius:14px;background-color:#f2f4f6;padding:0 14px;font-size:17px;color:#191f28')} />
          </div>
          <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:8px')}>
            <button data-g="secondary" className="pr-96" onClick={() => setSheet(null)} style={css('height:54px;border-radius:16px;background:#f2f4f6;color:#4e5968;font-size:17px;font-weight:600')}>닫기</button>
            <button data-g="primary" className="pr-96" onClick={async () => { if (await onGroupInfo({ name: nameDraft.trim() })) setSheet(null) }} style={css('height:54px;border-radius:16px;background:#3182f6;color:#ffffff;font-size:17px;font-weight:600')}>바꾸기</button>
          </div>
        </Dialog>
      )}
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
            <span style={css('font-size:15px;line-height:22.5px;color:#4e5968')}>나간 채팅방에는 다시 초대받아야 들어올 수 있어요</span>
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

// ---- people picker (새 채팅 / 초대) --------------------------------------------------

type PeopleProps = {
  title: string
  all: Person[]
  exclude: string[]
  max: number
  cta: (n: number) => string
  withName?: boolean
  onClose: () => void
  onDone: (ids: string[], name: string) => Promise<void>
}

/** Pick people who accept messages; used for a new chat and for inviting into a group. */
function PeopleSheet({ title, all, exclude, max, cta, withName, onClose, onDone }: PeopleProps) {
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const candidates = useMemo(() => all.filter(p => !exclude.includes(p.id) && !p.msgOff), [all, exclude])
  const list = q.trim() ? candidates.filter(p => p.name.includes(q.trim()) || p.loginId?.includes(q.trim().toLowerCase())) : candidates
  const full = picked.length >= max
  const toggle = (id: string) => setPicked(ps => ps.includes(id) ? ps.filter(x => x !== id) : full ? ps : [...ps, id])

  const done = async () => {
    if (!picked.length || busy) return
    setBusy(true)
    try { await onDone(picked, name) } finally { setBusy(false) }
  }

  return (
    <BottomSheet onScrim={onClose} scrim="rgba(0,0,0,0.2)" sheetStyle={`border-radius:28px 28px 0 0;padding:8px 0 calc(20px + env(safe-area-inset-bottom));animation:sheetUp 420ms ${EASE} both;height:86vh;display:flex;flex-direction:column`}>
      <div style={css('width:36px;height:4px;border-radius:2px;background:#e5e8eb;margin:0 auto')} />
      <div style={css('padding:20px 24px 16px;display:flex;flex-direction:column;gap:4px')}>
        <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>{title}</span>
        <span style={css('font-size:15px;line-height:22.5px;color:#6b7684')}>
          {picked.length === 0 ? (withName ? '한 명을 고르면 1:1, 여러 명이면 단톡방이 돼요' : `최대 ${max}명까지 초대할 수 있어요`) : `${picked.length}명 골랐어요${full ? ` · 최대 ${max}명` : ''}`}
        </span>
      </div>
      <div style={css('padding:0 24px 8px;display:flex;flex-direction:column;gap:8px')}>
        <div className="ring-within" data-g="l1" style={css('height:48px;border-radius:14px;background:#f2f4f6;display:flex;align-items:center;gap:8px;padding:0 14px')}>
          <SearchIcon size={20} stroke="#8b95a1" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="이름이나 아이디로 찾기" style={css('flex:1;min-width:0;border:0;background:transparent;font-size:17px;color:#191f28;outline:none')} />
        </div>
        {withName && picked.length >= 2 && <input data-g="l1" className="box-focus" value={name} maxLength={MAX_GROUP_NAME} onChange={e => setName(e.target.value)} placeholder="단톡방 이름 (안 써도 돼요)" style={css(`height:48px;border:0;outline:none;border-radius:14px;background-color:#f2f4f6;padding:0 14px;font-size:17px;color:#191f28;min-width:0;animation:listIn 320ms ${EASE} both`)} />}
      </div>
      <div className="anim-list" style={css('flex:1;overflow-y:auto;padding:4px 4px 0')}>
        {list.length === 0 && <div style={css('padding:32px 24px;text-align:center;font-size:15px;color:#6b7684')}>{candidates.length ? `‘${q.trim()}’ 이름을 찾지 못했어요` : '메시지를 받을 수 있는 사람이 없어요'}</div>}
        {list.map(p => {
          const on = picked.includes(p.id)
          return (
            <button key={p.id} className="pr-dim" role="checkbox" aria-checked={on} onClick={() => toggle(p.id)} style={sx(`width:100%;display:flex;align-items:center;gap:14px;padding:10px 20px;border-radius:12px;text-align:left;transition:opacity 200ms ${EASE}`, { opacity: !on && full ? 0.3 : 1 })}>
              <Avatar frame={p.frame} photo={p.photoCss} size={40} style={{ flex: 'none' }} />
              <span style={css('flex:1;min-width:0;display:flex;align-items:center;gap:6px')}>
                <span style={css(title17 + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{p.name}</span>
                <RankChip rank={p.rank} />
              </span>
              <span style={sx(`width:24px;height:24px;flex:none;border-radius:9999px;display:flex;align-items:center;justify-content:center;transition:background 200ms ${EASE},transform 200ms ${EASE}`, { background: on ? '#3182f6' : '#e5e8eb', transform: on ? 'scale(1)' : 'scale(0.92)' })}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              </span>
            </button>
          )
        })}
      </div>
      <div style={css('padding:12px 20px 0')}>
        <button data-g="primary" className="pr-96" disabled={!picked.length || busy} onClick={done} style={sx(`width:100%;height:56px;border-radius:16px;background:#3182f6;color:#fff;font-size:17px;font-weight:600;transition:opacity 200ms ${EASE}`, { opacity: picked.length && !busy ? 1 : 0.3 })}>
          {busy ? '잠시만요…' : cta(picked.length)}
        </button>
      </div>
    </BottomSheet>
  )
}

type NewProps = { me: Person; all: Person[]; onClose: () => void; onCreate: (ids: string[], name: string) => Promise<void> }

/** 새 채팅: 1 person → 1:1, 2+ → group. People with messages off aren't listed. */
export function NewChatSheet({ me, all, onClose, onCreate }: NewProps) {
  return (
    <PeopleSheet
      title="누구와 이야기할까요?" all={all} exclude={[me.id]} max={MAX_GROUP - 1} withName
      cta={n => (n >= 2 ? `${n + 1}명 단톡방 만들기` : '대화하기')} onClose={onClose} onDone={onCreate}
    />
  )
}

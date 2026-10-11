import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Firestore } from 'firebase/firestore'
import { css, imageCss, sx } from '../css'
import { MEDALS } from '../data'
import { setChatMuted, HEARTBEAT_MS, MAX_GROUP, MAX_GROUP_NAME, MAX_TEXT, PAGE, isUnread, markGone, markHere, noteRead, postFooled, sendFakeGift, cancelScheduled, subscribeScheduled, type Scheduled, setChatTimeout, timedOutUntil, loadImage, loadOlderMessages, mergeMessages, subscribeMessages, type ChatRow, type MessageRow, type ReplyRef } from '../backend/messages'
import { MAX_GIFT, giftPrice, hasGift, itemLabel, subscribeGift, type Gift, type GiftKind } from '../backend/gifts'
import { PASSES } from './ShopScreen'
import { FRAMES, LEGENDARY, SKIN_SERIES, skinGeom } from '../data'
import { Nameplate } from './Nameplate'
import { TowerSkin } from './TowerSkin'
import { saveImage } from '../saveImage'
import { readView, watchView } from '../viewport'
import type { Person } from '../model'
import { Avatar } from './Avatar'
import { GroupPresence, PresenceText } from './Presence'
import { BackIcon, ChevronRight, CloseIcon, SearchIcon } from './icons'
import { BottomSheet, Dialog } from './Overlays'
import { DurationInput, dhmsSeconds, durationLabel, leftLabel, type Dhms } from './Duration'

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

const band = <div data-g="gap" style={css('height:16px;background:transparent')} />
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
/** iOS time stamp: the time today, (어제) for yesterday, the date for older days. */
const stamp = (ms: number) => {
  const d = new Date(ms)
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(ms).setHours(0, 0, 0, 0)) / 86_400_000)
  const time = d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })
  if (days === 0) return time
  if (days === 1) return `(어제) ${time}`
  return `${dayLabel(ms)} ${time}`
}
// iOS glass: the shared look of the round and pill buttons in both screens.
const GLASS_BG = 'background:rgba(255,255,255,0.78);-webkit-backdrop-filter:blur(24px) saturate(180%);backdrop-filter:blur(24px) saturate(180%);box-shadow:0 6px 20px rgba(0,0,0,0.10),inset 0 0 0 0.5px rgba(0,0,0,0.06)'
const GLASS_CIRCLE = `width:44px;height:44px;flex:none;border-radius:9999px;display:flex;align-items:center;justify-content:center;color:#000;${GLASS_BG}`
/** The little tail on the last bubble of a run, as iMessage draws it. */
function Tail({ mine, color }: { mine: boolean; color: string }) {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true" style={css(`position:absolute;bottom:0;${mine ? 'right:-6px' : 'left:-6px;transform:scaleX(-1)'};display:block`)}>
      <path d="M0 0C1 7 5 12 12 14H0Z" fill={color} />
    </svg>
  )
}

export type ChatView = { title: string; people: Person[]; others: string[]; canSend: boolean; blockedReason: string }

/** Who's in a chat and whether I can send in it right now (mirrors firestore.rules' canSend). */
/** "12분" / "3시간" / "1일" — time left, rounded (at least 1분). */

/** A member's name; "(탈퇴한 사람)" only once the people list has loaded and they're not in it. */
export const nameIn = (byId: Map<string, Person>, id: string) => byId.get(id)?.name ?? (byId.size ? '(탈퇴한 사람)' : '')

export function describeChat(c: ChatRow, me: string, byId: Map<string, Person>, myOff: boolean, now = Date.now()): ChatView {
  const others = c.members.filter(m => m !== me)
  const people = others.map(id => byId.get(id)).filter((p): p is Person => !!p)
  const names = others.map(id => nameIn(byId, id))
  const title = c.type === 'dm' ? names[0] ?? '(알 수 없음)' : c.name || names.join(', ')
  const dmPeer = c.type === 'dm' ? byId.get(others[0]) : undefined
  const until = timedOutUntil(c, me, now)
  const blockedReason = until ? `관리자가 타임아웃했어요 · ${leftLabel(until - now)} 뒤에 말할 수 있어요`
    : myOff ? '메시지 받기를 켜면 보낼 수 있어요'
    : c.type === 'dm' && !dmPeer && byId.size ? '탈퇴한 사람에게는 보낼 수 없어요'
      : dmPeer?.msgOff ? `${dmPeer.name}님이 메시지를 받지 않고 있어요` : ''
  return { title, people, others, canSend: !blockedReason, blockedReason }
}

function ChatAvatar({ people, size, photo }: { people: Person[]; size: number; photo?: string }) {
  const img = imageCss(photo)
  if (img !== 'none') return <span style={sx('flex:none;border-radius:9999px;background-size:cover;background-position:center', { width: size, height: size, backgroundImage: img })} />
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
  /** for 온라인 표시 next to 1:1 chats */
  db?: Firestore | null
  /** The bottom search bar shows (the app shows the tab bar too). */
  chromeOn?: boolean
  /** A drag, tap or scroll in the list: brings the bars back for a while. */
  onChrome?: () => void
}

export function MessagesScreen({ loggedIn, me, chats, byId, onLogin, onOpen, onNew, onToggleOff, db = null, chromeOn = true, onChrome }: ScreenProps) {
  const drag = useRef<{ x: number; y: number } | null>(null)
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
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(false)
  const [onlyUnread, setOnlyUnread] = useState(false)
  const needle = q.trim()
  const shown = chats.filter(c => (!onlyUnread || isUnread(c, me.id)) && (!needle || describeChat(c, me.id, byId, off).title.includes(needle)))
  const pinned = chats.slice(0, 3)
  return (
    <div data-g="clear"
      onPointerDown={e => { drag.current = { x: e.clientX, y: e.clientY }; onChrome?.() }}
      onPointerMove={e => { const d = drag.current; if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) { drag.current = null; onChrome?.() } }}
      onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}
      onWheel={e => { if (Math.abs(e.deltaY) > 4) onChrome?.() }}
      style={css('position:relative;flex:1;display:flex;flex-direction:column;min-height:100%;background:#ffffff;color:#000;padding-bottom:calc(var(--phone-bottom,0px))')}>
      {/* iOS Messages: glass 편집 · centred title · glass filter */}
      <div style={css('position:sticky;top:0;z-index:5;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;padding:calc(8px + env(safe-area-inset-top)) 16px 10px;background:rgba(255,255,255,0.82);-webkit-backdrop-filter:blur(24px) saturate(180%);backdrop-filter:blur(24px) saturate(180%)')}>
        <span style={css('justify-self:start')}>
          <button className="pr-94" onClick={() => setEditing(e => !e)} disabled={chats.length === 0} aria-pressed={editing} style={css(`height:44px;padding:0 18px;border-radius:9999px;font-size:17px;font-weight:600;color:#000;${GLASS_BG}`)}>{editing ? '완료' : '편집'}</button>
        </span>
        <h1 style={css('margin:0;font-size:17px;line-height:22px;font-weight:600;color:#000;text-align:center')}>메시지</h1>
        <span style={css('justify-self:end;display:flex;gap:8px')}>
          <button className="pr-94" onClick={() => setOnlyUnread(u => !u)} aria-pressed={onlyUnread} aria-label="안 읽은 대화만 보기" style={css(`${GLASS_CIRCLE};color:${onlyUnread ? '#007aff' : '#000'}`)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
          </button>
        </span>
      </div>
      {off && <div style={css('padding:0 20px 6px;font-size:13px;line-height:18px;color:#8e8e93')}>메시지 받기가 꺼져 있어요</div>}

      {chats.length === 0 ? (
        <div className="anim-list" style={css('padding:48px 24px;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center')}>
          <span style={css('font-size:17px;line-height:22px;font-weight:600;color:#000')}>아직 대화가 없어요</span>
          <span style={css('font-size:15px;line-height:20px;color:#8e8e93')}>랭킹에서 프로필을 눌러 메시지를 보내보세요</span>
          {!off && <button className="pr-96" onClick={onNew} style={css('margin-top:14px;height:36px;padding:0 16px;border-radius:18px;background:#007aff;color:#fff;font-size:15px;font-weight:600')}>새 채팅 시작하기</button>}
        </div>
      ) : (
        <>
          {/* the pinned people: round avatars in a row, names below */}
          {!needle && pinned.length > 0 && (
            <div style={css('display:flex;justify-content:space-evenly;padding:8px 12px 18px')}>
              {pinned.map(c => {
                const v = describeChat(c, me.id, byId, off)
                return (
                  <button key={c.id} className="pr-96" onClick={() => onOpen(c.id)} style={css('width:104px;display:flex;flex-direction:column;align-items:center;gap:8px;background:none;color:#000;font-family:inherit')}>
                    <ChatAvatar people={v.people} size={92} photo={c.photo} />
                    <span style={css('max-width:104px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;line-height:20px;color:#000')}>{v.title}</span>
                  </button>
                )
              })}
            </div>
          )}
          <div className="anim-list" style={css('display:flex;flex-direction:column')}>
            {shown.map((c, i) => {
              const v = describeChat(c, me.id, byId, off)
              const unread = isUnread(c, me.id)
              const muted = !!c.mutes?.[me.id]
              const lastText = c.last ? (c.last.text || '사진') : ''
              const who = c.last ? (c.last.uid === me.id ? '나: ' : c.type === 'group' ? `${nameIn(byId, c.last.uid)}: ` : '') : ''
              // 편집: a tap turns that chat's 알림 on or off instead of opening it
              const tap = () => { if (editing) { if (db) setChatMuted(db, me.id, c.id, !muted).catch(() => {}) } else onOpen(c.id) }
              return (
                <button key={c.id} className="pr-dim" onClick={tap} aria-pressed={editing ? !muted : undefined} style={css('position:relative;display:flex;align-items:center;gap:6px;padding:12px 16px 12px 20px;text-align:left;background:#fff;color:#000;width:100%')}>
                  <span aria-hidden="true" style={sx('flex:none;width:10px;height:10px;border-radius:9999px;background:#007aff', { opacity: unread ? 1 : 0 })} />
                  <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:3px')}>
                    <span style={css('display:flex;align-items:center;gap:6px;min-width:0')}>
                      <span style={sx('flex:1;min-width:0;font-size:17px;line-height:22px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis', { fontWeight: unread ? 700 : 600 })}>{v.title}</span>
                      {c.type === 'group' && <span style={css('flex:none;font-size:15px;color:#8e8e93')}>{c.members.length}</span>}
                      {muted && <BellOffIcon />}
                      <span style={css('flex:none;font-size:15px;line-height:20px;color:#8e8e93')}>{timeLabel(c.last?.at?.toMillis() ?? 0)}</span>
                      {!editing && <svg width="8" height="13" viewBox="0 0 8 13" fill="none" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={css('flex:none')}><path d="m1.5 1.5 5 5-5 5" /></svg>}
                    </span>
                    <span style={css('display:flex;align-items:center;gap:6px;min-width:0')}>
                      {c.type === 'dm' && v.people[0] && <PresenceText db={db} uid={v.people[0].id} size={13} />}
                      <span style={sx('flex:1;min-width:0;font-size:15px;line-height:20px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical', { fontWeight: unread ? 500 : 400, color: unread ? '#000' : '#8e8e93' })}>{c.last ? who + lastText : '대화를 시작해보세요'}</span>
                    </span>
                  </span>
                  {i < shown.length - 1 && <span aria-hidden="true" style={css('position:absolute;left:32px;right:0;bottom:0;height:0.5px;background:#e5e5ea')} />}
                </button>
              )
            })}
            {needle && shown.length === 0 && <span style={css('padding:32px;text-align:center;font-size:15px;color:#8e8e93')}>검색 결과가 없어요</span>}
          </div>
        </>
      )}

      <div style={css('height:16px')} />
      {/* settings row, grouped like iOS */}
      <div style={css('margin:0 16px 96px;padding:12px 16px;border-radius:12px;background:#f2f2f7;display:flex;align-items:center;gap:12px')}>
        <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:2px')}>
          <span style={css('font-size:17px;line-height:22px;color:#000')}>메시지 받기</span>
          <span style={css('font-size:13px;line-height:18px;color:#8e8e93')}>{off ? '꺼두면 아무도 메시지를 보내거나 초대할 수 없고, 나도 보낼 수 없어요' : '끄면 새 채팅 목록에서도 보이지 않아요'}</span>
        </span>
        <Switch on={!off} onToggle={() => onToggleOff(!off)} label="메시지 받기" />
      </div>

      {/* iOS 26 bottom bar: a glass search field and the compose button */}
      <div style={sx('z-index:4;padding:8px 16px calc(8px + env(safe-area-inset-bottom));display:flex;align-items:center;gap:10px;background:linear-gradient(180deg,rgba(255,255,255,0),#fff 40%);transition:transform 360ms ' + EASE + ',opacity 300ms ease', chromeOn
        ? { position: 'sticky', bottom: 0, marginTop: 'auto', transform: 'none', opacity: 1 }
        : { position: 'absolute', left: 0, right: 0, bottom: 0, transform: 'translateY(100%)', opacity: 0, pointerEvents: 'none' })}>
        <label style={css('flex:1;min-width:0;height:44px;display:flex;align-items:center;gap:8px;padding:0 14px;border-radius:9999px;background:rgba(255,255,255,0.72);-webkit-backdrop-filter:blur(24px) saturate(180%);backdrop-filter:blur(24px) saturate(180%);box-shadow:0 6px 20px rgba(0,0,0,0.12),inset 0 0 0 0.5px rgba(0,0,0,0.06);color:#8e8e93')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
          <input value={q} onChange={e => setQ(e.target.value.slice(0, 20))} placeholder="검색" aria-label="대화 검색" style={css('flex:1;min-width:0;border:0;outline:none;background:transparent;font-size:17px;color:#000;font-family:inherit')} />
          <svg width="18" height="20" viewBox="0 0 18 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="5.5" y="1.5" width="7" height="12" rx="3.5" fill="currentColor" stroke="none" /><path d="M2 10.5a7 7 0 0 0 14 0M9 17.5v3" /></svg>
        </label>
        <button className="pr-94" onClick={onNew} disabled={off} aria-label="새 채팅 쓰기" style={sx('width:44px;height:44px;flex:none;border-radius:9999px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.72);-webkit-backdrop-filter:blur(24px) saturate(180%);backdrop-filter:blur(24px) saturate(180%);box-shadow:0 6px 20px rgba(0,0,0,0.12);color:#007aff;transition:opacity 200ms', { opacity: off ? 0.3 : 1 })}><ComposeIcon /></button>
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
  const [box, setBox] = useState(() => { const v = readView(); return { top: v.top, height: v.height } })
  useEffect(() => {
    const y = window.scrollY
    const b = document.body.style
    const prev = { position: b.position, top: b.top, width: b.width, overflow: b.overflow }
    Object.assign(b, { position: 'fixed', top: `-${y}px`, width: '100%', overflow: 'hidden' })
    const update = () => {
      const v = readView()
      // iPhone sometimes leaves the page scrolled after the keyboard closes; the body is locked, so put it back.
      if (!v.inset && window.scrollY !== 0) window.scrollTo(0, 0)
      setBox(o => (o.top === v.top && o.height === v.height ? o : { top: v.top, height: v.height }))
    }
    const stop = watchView(update)
    return () => {
      stop()
      Object.assign(b, prev)
      window.scrollTo(0, y)
    }
  }, [])
  return box
}

/**
 * White layer under a full-screen chat, reaching below the screen: the iPhone keyboard
 * (and its ⌃⌄✓ bar) is see-through, so without it the screen underneath showed through.
 */
/** Drops any text selection the browser started (e.g. an iPhone long-press). */
function clearSelection() { try { window.getSelection()?.removeAllRanges() } catch { /* nothing selected */ } }

export function KeyboardUnderlay({ z }: { z: number }) {
  return <div aria-hidden="true" style={sx('position:fixed;left:0;right:0;top:0;height:200vh;background:#ffffff;pointer-events:none;animation:fade 160ms ease both', { zIndex: z })} />
}

// ---- 채팅방 -----------------------------------------------------------------------

type RoomProps = {
  /** The admin account: can put group members in 타임아웃. */
  canTimeout?: boolean
  db: Firestore
  chat: ChatRow
  me: Person
  all: Person[]
  byId: Map<string, Person>
  onBack: () => void
  onSend: (text: string, replyTo?: ReplyRef) => Promise<boolean>
  onSendImage: (file: File) => Promise<boolean>
  myPoints: number
  onSendGift: (amount: number) => Promise<boolean>
  /** 아이템 선물: sends an item (its price is held until someone takes it). */
  onSendItemGift: (kind: GiftKind, key: string) => Promise<boolean>
  /** 예약: send `text` (and/or an item gift, whose points are held now) at `at`. */
  onSchedule: (text: string, at: number, gift?: { kind: GiftKind; key: string }) => Promise<boolean>
  /** Owns the 페이크 선물 패스 (else the 페이크 선물 tile offers to buy it). */
  fakePass: boolean
  onBuyFakePass: () => void
  onClaimGift: (giftId: string) => Promise<unknown>
  onCancelGift: (giftId: string) => Promise<unknown>
  onToast: (msg: string) => void
  onMute: (muted: boolean) => void
  onLeave: () => void
  onInvite: (ids: string[]) => Promise<boolean>
  /** 1:1 only: start a 음성 통화 with the other person. */
  onCall?: (video: boolean) => void
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
  const [attach, setAttach] = useState<'menu' | 'gift' | 'item' | 'fake' | null>(null)
  // 아이템 선물 waits in the composer until 보내기 (or 예약).
  const [pendingGift, setPendingGift] = useState<{ kind: GiftKind; key: string } | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduledOpen, setScheduledOpen] = useState(false)
  const [scheduled, setScheduled] = useState<Scheduled[]>([])
  useEffect(() => subscribeScheduled(db, me.id, list => setScheduled(list.filter(x => x.chatId === chat.id))), [db, me.id, chat.id])
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const held = useRef(false)
  const [fooled, setFooled] = useState(false)
  // 답장: long-press (or right-click) a message for 답장/복사, or swipe it to the right.
  const [reply, setReply] = useState<ReplyRef | null>(null)
  const [actionFor, setActionFor] = useState<MessageRow | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const snippet = (m: MessageRow) => m.kind === 'image' ? '사진' : m.kind === 'gift' || m.kind === 'fake' ? m.text || '🎁 포인트 선물' : m.text
  const startReply = (m: MessageRow) => { setReply({ id: m.id, uid: m.uid, text: snippet(m).slice(0, 100) }); setActionFor(null); setTimeout(() => inputRef.current?.focus(), 50) }
  const jumpTo = (id: string) => {
    const el = listRef.current?.querySelector(`[data-mid="${id}"]`) as HTMLElement | null
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFlash(id); setTimeout(() => setFlash(f => (f === id ? null : f)), 1200)
  }
  // Long-pressing a message is ours (답장 · 복사 · 타임아웃): on iPhone it also started a
  // text selection that tinted the whole screen blue and showed 복사하기/찾아보기/번역.
  // No selecting in the room, except in the input box.
  useEffect(() => {
    const block = (e: Event) => {
      const t = e.target as Node | null
      const el = t && (t.nodeType === 1 ? (t as Element) : t.parentElement)
      if (!el?.closest?.('input, textarea')) e.preventDefault()
    }
    document.addEventListener('selectstart', block)
    return () => document.removeEventListener('selectstart', block)
  }, [])
  const press = useRef<{ id: string; x: number; y: number; timer?: ReturnType<typeof setTimeout>; dx: number } | null>(null)
  const [drag, setDrag] = useState<{ id: string; dx: number } | null>(null)
  const gestures = (m: MessageRow) => m.kind === 'system' ? {} : {
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); setActionFor(m) },
    onPointerDown: (e: React.PointerEvent) => {
      const timer = setTimeout(() => { press.current = null; setDrag(null); clearSelection(); try { navigator.vibrate?.(15) } catch { /* no vibration */ } setActionFor(m) }, 480)
      press.current = { id: m.id, x: e.clientX, y: e.clientY, timer, dx: 0 }
    },
    onPointerMove: (e: React.PointerEvent) => {
      const pr = press.current
      if (!pr || pr.id !== m.id) return
      const dx = e.clientX - pr.x, dy = e.clientY - pr.y
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearTimeout(pr.timer)
      if (Math.abs(dy) > 24 && Math.abs(dy) > Math.abs(dx)) { press.current = null; setDrag(null); return }
      if (dx > 0) { pr.dx = dx; setDrag({ id: m.id, dx: Math.min(dx, 72) }) }
    },
    onPointerUp: () => {
      const pr = press.current
      if (pr) { clearTimeout(pr.timer); if (pr.dx > 56) startReply(m) }
      press.current = null; setDrag(null)
    },
    onPointerCancel: () => { if (press.current) clearTimeout(press.current.timer); press.current = null; setDrag(null) },
  }
  const firstIds = useRef<Set<string> | null>(null)
  const box = useKeyboardSafeBox()
  // While I'm in 타임아웃 the composer counts down and comes back on its own.
  const [now, setNow] = useState(Date.now())
  const myTimeout = timedOutUntil(chat, me.id, now)
  useEffect(() => {
    if (!myTimeout) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    const end = setTimeout(() => setNow(Date.now()), myTimeout - Date.now() + 300)
    return () => { clearInterval(t); clearTimeout(end) }
  }, [myTimeout])
  const v = describeChat(chat, me.id, byId, !!me.msgOff, now)
  const [timeoutFor, setTimeoutFor] = useState<string | null>(null)
  const applyTimeout = async (target: string, ms: number, label: string) => {
    const name = byId.get(target)?.name ?? '(알 수 없음)'
    const notice = ms ? `${me.name}님이 ${name}님을 ${label} 동안 타임아웃했어요` : `${me.name}님이 ${name}님의 타임아웃을 풀었어요`
    setTimeoutFor(null)
    try { await setChatTimeout(db, me.id, chat.id, target, ms, notice); p.onToast(ms ? `${name}님을 ${label} 동안 타임아웃했어요` : `${name}님 타임아웃을 풀었어요`) }
    catch (e) { onError('타임아웃하지 못했어요', e) }
  }
  const adminHere = !!p.canTimeout && chat.type === 'group'
  const bgCss = (BGS.find(b => b[0] === bg) ?? BGS[0])[2]
  const tinted = bg !== 'default'

  // Only the latest page is live; older pages load (once) when you scroll up. What has
  // been shown stays, so the live window sliding forward never drops messages.
  const [hasOlder, setHasOlder] = useState(false)
  const loadingOlder = useRef(false)
  const keepFromBottom = useRef<number | null>(null)
  const settled = useRef(false)
  useEffect(() => subscribeMessages(db, chat.id, (rows, fromCache) => {
    // Everything up to the first answer from the server is history (no entry animation);
    // a cached first answer may be partial, so "older pages exist" is decided by the server's.
    if (!settled.current) {
      firstIds.current = new Set([...(firstIds.current ?? []), ...rows.map(r => r.id)])
      if (!fromCache) { settled.current = true; setHasOlder(rows.length >= PAGE) }
    }
    setMsgs(prev => mergeMessages(prev, rows))
  }, e => onError('메시지를 불러오지 못했어요', e)), [db, chat.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const loadOlder = async () => {
    const el = listRef.current, oldest = msgs?.[0]?.id
    if (!el || !oldest || loadingOlder.current || !hasOlder) return
    loadingOlder.current = true
    try {
      const rows = await loadOlderMessages(db, chat.id, oldest)
      rows.forEach(r => firstIds.current?.add(r.id)) // no entry animation for history
      keepFromBottom.current = el.scrollHeight - el.scrollTop
      if (rows.length < PAGE) setHasOlder(false)
      setMsgs(prev => mergeMessages(prev, rows))
    } catch (e) { onError('이전 메시지를 불러오지 못했어요', e) }
    loadingOlder.current = false
  }
  // Opening the room (and every new message while it's open) marks it read.
  // Read receipts: not one per message (each was delivered to everyone in the room, and
  // every delivery counts as a Firestore read). While the room is open on screen I'm
  // "here" — said once on entering, refreshed every HEARTBEAT_MS — and everything that
  // arrives meanwhile counts as read by me. Leaving or going to the background ends it.
  useEffect(() => {
    let beat: ReturnType<typeof setInterval> | undefined
    let here = false
    const enter = () => {
      if (here) return
      here = true
      markHere(db, me.id, chat.id).catch(() => {})
      beat = setInterval(() => markHere(db, me.id, chat.id).catch(() => {}), HEARTBEAT_MS)
    }
    const leave = () => {
      if (!here) return
      here = false
      clearInterval(beat)
      markGone(db, me.id, chat.id).catch(() => {})
    }
    const sync = () => (document.visibilityState === 'visible' ? enter() : leave())
    sync()
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('pagehide', leave)
    return () => { document.removeEventListener('visibilitychange', sync); window.removeEventListener('pagehide', leave); leave() }
  }, [db, chat.id, me.id])
  // Messages arriving while I'm here: read on this device (unread badge), nothing sent.
  useEffect(() => { if (chat.last && document.visibilityState === 'visible') noteRead(chat.id, chat.last.at?.toMillis() ?? Date.now()) }, [chat.id, chat.last?.at]) // eslint-disable-line react-hooks/exhaustive-deps
  const toBottom = (smooth = false) => { const el = listRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); nearBottom.current = true; setNewBelow(0) }
  // Follow new messages only while you're at the bottom; if you've scrolled up to read,
  // stay put and offer a "새 메시지" button instead of yanking the view down.
  const nearBottom = useRef(true)
  const [newBelow, setNewBelow] = useState(0)
  const lastId = useRef<string | null>(null)
  const onListScroll = () => {
    const el = listRef.current
    if (!el) return
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (nearBottom.current && newBelow) setNewBelow(0)
    if (el.scrollTop < 200) loadOlder()
  }
  useLayoutEffect(() => {
    if (!msgs) return
    // Older messages were put on top: keep what you were looking at in place.
    if (keepFromBottom.current != null) { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight - keepFromBottom.current; keepFromBottom.current = null }
    const prevLast = lastId.current
    lastId.current = msgs.length ? msgs[msgs.length - 1].id : null
    if (prevLast === null) { toBottom(); return }
    if (lastId.current === prevLast) return
    const added = Math.max(1, msgs.length - 1 - msgs.findIndex(m => m.id === prevLast))
    const last = msgs[msgs.length - 1]
    if (last.uid === me.id) toBottom()
    else if (nearBottom.current) toBottom(true)
    else setNewBelow(n => n + added)
  }, [msgs]) // eslint-disable-line react-hooks/exhaustive-deps
  // When the keyboard opens or closes the list changes size. iPhone Safari can leave the
  // old scroll position painted (the messages stuck at the top with a blank area below),
  // so re-apply the position now and once more after the keyboard animation ends.
  useEffect(() => {
    const fix = () => {
      const el = listRef.current
      if (!el) return
      if (nearBottom.current) toBottom()
      else el.scrollTop = Math.min(el.scrollTop, el.scrollHeight - el.clientHeight)
    }
    fix()
    const t = setTimeout(fix, 350)
    return () => clearTimeout(t)
  }, [box.height]) // eslint-disable-line react-hooks/exhaustive-deps
  const keepBottom = () => { if (nearBottom.current) toBottom() }
  // Auto-grow the input up to ~5 lines.
  useLayoutEffect(() => { const t = inputRef.current; if (t) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px' } }, [draft])

  // Text sends never block each other (typing fast and hitting 보내기 again must not drop a message).
  const send = async () => {
    if (held.current) { held.current = false; return } // that press opened 예약
    const t = draft.trim()
    const g = pendingGift
    if ((!t && !g) || !v.canSend) return
    if (g) {
      setPendingGift(null)
      if (!(await p.onSendItemGift(g.kind, g.key))) { setPendingGift(g); return }
    }
    if (!t) return
    setDraft('')
    const r = reply
    setReply(null)
    if (!(await onSend(t, r ?? undefined))) { setDraft(d => (d ? d : t)); setReply(r) }
  }
  const canSendNow = !!draft.trim() || !!pendingGift
  // 보내기 꾹 누르기 → 예약
  const pressStart = () => { held.current = false; clearTimeout(hold.current); if (canSendNow) hold.current = setTimeout(() => { held.current = true; setScheduleOpen(true) }, 500) }
  const pressEnd = () => clearTimeout(hold.current)
  const schedule = async (at: number) => {
    const t = draft.trim(), g = pendingGift
    if (!(await p.onSchedule(t, at, g ?? undefined))) return
    setDraft(''); setPendingGift(null); setReply(null); setScheduleOpen(false)
  }
  const [photoSending, setPhotoSending] = useState(false)
  const pickPhoto = async (f: File) => {
    setSending(true); setPhotoSending(true)
    requestAnimationFrame(() => toBottom(true))
    await onSendImage(f)
    setSending(false); setPhotoSending(false)
  }

  const lastMine = msgs?.slice().reverse().find(x => x.uid === me.id && x.kind !== 'system')?.id

  return (
    <>
    <KeyboardUnderlay z={199} />
    <div style={sx('position:fixed;left:0;right:0;z-index:200;display:flex;justify-content:center', { top: box.top, height: box.height })}>
        <div data-g="app" className="no-select" style={css(`width:100%;max-width:var(--app-w);height:100%;display:flex;flex-direction:column;position:relative;overflow:hidden;color:#000;background:#ffffff;animation:roomIn 360ms ${EASE} backwards`)}>
          {/* iOS Messages: round glass back, the contact centred with a name pill, glass call/menu */}
          {/* A slim bar: round glass back, a small name pill in the middle, glass call/menu */}
          <div style={{ ...css('flex:none;position:relative;z-index:2;display:flex;align-items:center;gap:8px;padding:0 12px 6px'), paddingTop: box.top ? 6 : 'calc(6px + env(safe-area-inset-top))' }}>
            <button className="pr-dim" onClick={onBack} aria-label="뒤로" style={css(GLASS_CIRCLE)}><BackIcon /></button>
            <button className="pr-dim" onClick={() => (chat.type === 'dm' && v.people[0] ? onOpenProfile(v.people[0].id) : setMenu(true))} style={css(`flex:1;min-width:0;display:flex;align-items:center;justify-content:center;gap:8px;height:48px;padding:0 14px 0 6px;border-radius:9999px;color:#000;${GLASS_BG}`)}>
              <ChatAvatar people={v.people} size={36} photo={chat.photo} />
              <span style={css('min-width:0;display:flex;flex-direction:column;align-items:flex-start')}>
                <span style={css('max-width:100%;display:flex;align-items:center;gap:4px;font-size:15px;line-height:19px;font-weight:600;color:#000')}>
                  <span style={css('min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{v.title}</span>
                  {chat.type === 'group' && <span style={css('flex:none;font-size:13px;color:#8e8e93')}>{chat.members.length}</span>}
                  <svg width="6" height="10" viewBox="0 0 8 13" fill="none" stroke="#8e8e93" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={css('flex:none')}><path d="m1.5 1.5 5 5-5 5" /></svg>
                </span>
                {chat.type === 'dm' && v.people[0] && <PresenceText db={db} uid={v.people[0].id} size={11} />}
                {chat.type === 'group' && <GroupPresence db={db} uids={chat.members.filter(m => m !== me.id)} />}
              </span>
            </button>
            {chat.type === 'dm' && p.onCall && v.people[0] && <>
              <button className="pr-dim" onClick={() => p.onCall?.(true)} aria-label="영상 통화" style={css(GLASS_CIRCLE)}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><rect x="2.5" y="6" width="13" height="12" rx="2.5" /><path d="m15.5 10.5 6-3.5v10l-6-3.5" /></svg>
              </button>
              <button className="pr-dim" onClick={() => p.onCall?.(false)} aria-label="음성 통화" style={css(GLASS_CIRCLE)}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M6.6 10.8a15.2 15.2 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z" /></svg>
              </button>
            </>}
            <button className="pr-dim" onClick={() => setMenu(true)} aria-label="채팅방 메뉴" style={css(GLASS_CIRCLE)}><MenuIcon /></button>
          </div>

        <div ref={listRef} onScroll={onListScroll} style={sx('flex:1;overflow-y:auto;overscroll-behavior:contain;padding:8px 16px 16px;display:flex;flex-direction:column;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 36px);mask-image:linear-gradient(180deg,transparent 0,#000 36px)', { background: bgCss })}>
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
            const longGap = !!prev && at - (prev.at?.toMillis() ?? 0) > 3_600_000
            const dayRow = (newDay || longGap) && at > 0 && <div style={css('align-self:center;margin:16px 0 8px;font-size:13px;line-height:18px;color:#8e8e93')}>{stamp(at)}</div>
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
            const bubble = m.kind === 'gift' && m.giftId
              ? <GiftBubble db={db} giftId={m.giftId} me={me.id} mine={me} byId={byId} onClaim={p.onClaimGift} onCancel={p.onCancelGift} onLoaded={keepBottom} />
              : m.kind === 'fake'
              ? <FakeGiftBubble msg={m} mine={mine} dm={chat.type === 'dm'} onTake={() => {
                  setFooled(true)
                  if (markFooled(m.id)) postFooled(db, me.id, chat.id, `${me.name}님이 ${nameIn(byId, m.uid)}님의 페이크 선물에 속았어요 🤣`).catch(() => {})
                }} />
              : m.kind === 'image'
              ? <ImageBubble db={db} chatId={chat.id} msgId={m.mediaId ?? m.id} onOpen={setViewer} onLoaded={keepBottom} />
              : <span style={sx('position:relative;padding:8px 14px 9px;border-radius:20px;font-size:17px;line-height:22px;white-space:pre-wrap;word-break:break-word;display:flex;flex-direction:column;gap:6px', { background: mine ? 'linear-gradient(180deg,#72d26f,#5fc75f)' : '#e9e9eb', color: mine ? '#ffffff' : '#000000', fontWeight: 400 })}>
                  {m.replyTo && (
                    <button onClick={() => jumpTo(m.replyTo!.id)} style={sx('display:flex;flex-direction:column;gap:1px;padding:6px 10px;border-radius:12px;text-align:left;max-width:100%;border-left:3px solid', { background: mine ? 'rgba(255,255,255,0.18)' : 'rgba(0,23,51,0.05)', borderLeftColor: mine ? 'rgba(255,255,255,0.7)' : '#3182f6' })}>
                      <span style={sx('font-size:12px;line-height:16px;font-weight:700', { color: mine ? 'rgba(255,255,255,0.9)' : '#1b64da' })}>{m.replyTo.uid === me.id ? '나' : nameIn(byId, m.replyTo.uid)}에게 답장</span>
                      <span style={sx('font-size:13px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px', { color: mine ? 'rgba(255,255,255,0.85)' : '#4e5968', fontWeight: 400 })}>{m.replyTo.text}</span>
                    </button>
                  )}
                  <span>{m.text}</span>
                  {lastOfRun && <Tail mine={mine} color={mine ? '#66cb66' : '#e9e9eb'} />}
                </span>
            return (
              <Fragment key={m.id}>
                {dayRow}
                <div data-anim data-mid={m.id} {...gestures(m)} style={sx('display:flex;gap:8px;align-items:flex-end;position:relative;touch-action:pan-y;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;border-radius:14px', { justifyContent: mine ? 'flex-end' : 'flex-start', marginTop: firstOfRun ? 12 : 4, transform: drag?.id === m.id ? `translateX(${drag.dx}px)` : undefined, transition: drag?.id === m.id ? 'none' : `transform 260ms ${EASE}, background 400ms ease`, background: flash === m.id ? 'rgba(49,130,246,0.12)' : undefined, animation: isNew ? (mine ? 'msgSend 520ms cubic-bezier(0.25,0.9,0.3,1) both' : `msgInL 380ms ${EASE} both`) : undefined, transformOrigin: mine ? 'bottom right' : 'bottom left' })}>
                  {drag?.id === m.id && (
                    <span aria-hidden="true" style={sx('position:absolute;left:-40px;top:50%;margin-top:-14px;width:28px;height:28px;border-radius:9999px;background:#f2f4f6;display:flex;align-items:center;justify-content:center;color:#4e5968', { opacity: Math.min(1, drag.dx / 56), transform: `scale(${drag.dx > 56 ? 1.1 : 0.9})`, transition: 'transform 120ms' })}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 6 6v5" /></svg>
                    </span>
                  )}
                  {!mine && (
                    <span style={css('width:32px;flex:none;align-self:flex-start')}>
                      {firstOfRun && <button className="pr-94" onClick={() => sender && onOpenProfile(sender.id)} aria-label={`${sender?.name ?? ''} 프로필`} style={css('display:block;border-radius:9999px')}><Avatar frame={sender?.frame} photo={sender?.photoCss} size={32} full /></button>}
                    </span>
                  )}
                  <span style={sx('display:flex;flex-direction:column;gap:4px;max-width:74%', { alignItems: mine ? 'flex-end' : 'flex-start' })}>
                    {!mine && firstOfRun && chat.type === 'group' && (
                      <button onClick={() => sender && onOpenProfile(sender.id)} style={css('display:flex;align-items:center;gap:4px;padding:0;text-align:left')}>
                        <span style={css('font-size:13px;line-height:19.5px;color:#4e5968;font-weight:500')}>{nameIn(byId, m.uid)}</span>
                        <RankChip rank={sender?.rank} />
                      </button>
                    )}
                    <span style={sx('display:flex;align-items:flex-end;gap:6px', { flexDirection: mine ? 'row-reverse' : 'row' })}>
                      {bubble}
                    </span>
                    {m.id === lastMine && <span style={css('font-size:13px;line-height:18px;color:#8e8e93;margin-top:2px')}>전송됨</span>}
                  </span>
                </div>
              </Fragment>
            )
          })}
          {photoSending && (
            <div style={css('display:flex;justify-content:flex-end;margin-top:8px;animation:msgInMine 260ms ease both')}>
              <span className="skeleton" style={css('width:160px;height:120px;border-radius:18px;display:flex;align-items:flex-end;justify-content:flex-end;padding:8px 10px;font-size:12px;font-weight:600;color:#6b7684')}>보내는 중…</span>
            </div>
          )}
        </div>
        {newBelow > 0 && (
          <button className="pr-96" onClick={() => toBottom(true)} style={css('position:absolute;left:50%;transform:translateX(-50%);bottom:calc(72px + env(safe-area-inset-bottom));z-index:3;height:36px;padding:0 14px;border-radius:9999px;background:#191f28;color:#fff;font-size:14px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,0.18);animation:toastDown 260ms cubic-bezier(0.16,1,0.3,1) both;display:flex;align-items:center;gap:6px')}>
            새 메시지 {newBelow > 1 ? newBelow : ''}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
          </button>
        )}

        <div style={sx('flex:none;padding:8px 12px', { paddingBottom: box.top || box.height < window.innerHeight - 80 ? 8 : 'calc(8px + env(safe-area-inset-bottom))', background: tinted ? '#ffffff' : 'transparent' })}>
          {reply && v.canSend && (
            <div style={css('display:flex;align-items:center;gap:10px;padding:8px 6px 10px 12px;margin-bottom:6px;border-radius:14px;background:#f9fafb;animation:toastDown 220ms cubic-bezier(0.16,1,0.3,1) both')}>
              <span style={css('width:3px;align-self:stretch;border-radius:2px;background:#3182f6;flex:none')} />
              <span style={css('flex:1;min-width:0;display:flex;flex-direction:column')}>
                <span style={css('font-size:13px;font-weight:700;color:#1b64da')}>{reply.uid === me.id ? '나' : nameIn(byId, reply.uid)}에게 답장</span>
                <span style={css('font-size:13px;color:#6b7684;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{reply.text}</span>
              </span>
              <button onClick={() => setReply(null)} aria-label="답장 취소" style={css('width:36px;height:36px;flex:none;border-radius:9999px;display:flex;align-items:center;justify-content:center')}><CloseIcon size={16} stroke="#8b95a1" width={2.6} /></button>
            </div>
          )}
          {scheduled.length > 0 && (
            <button className="pr-98" onClick={() => setScheduledOpen(true)} style={css('width:100%;display:flex;align-items:center;gap:8px;padding:8px 12px;margin-bottom:6px;border-radius:12px;background:#f2f7ff;font-size:13px;font-weight:600;color:#1b64da;text-align:left')}>
              <span style={css('font-size:15px')}>⏰</span>예약된 메시지 {scheduled.length}개 · 다음 {whenLabel(scheduled[0].at)}<span style={css('margin-left:auto;color:#8bb4f7')}>›</span>
            </button>
          )}
          {pendingGift && v.canSend && (
            <div style={css('display:flex;align-items:center;gap:10px;padding:8px 6px 8px 10px;margin-bottom:6px;border-radius:14px;background:linear-gradient(135deg,#e9fff3,#d2f7e3);box-shadow:inset 0 0 0 1px #b9f5d3;animation:toastDown 220ms cubic-bezier(0.16,1,0.3,1) both')}>
              <span style={css('width:44px;flex:none;display:flex;justify-content:center')}><GiftThumb kind={pendingGift.kind} k={pendingGift.key} /></span>
              <span style={css('flex:1;min-width:0;display:flex;flex-direction:column')}>
                <span style={css('font-size:12px;font-weight:700;color:#0a6b3a')}>{pendingGift.kind === 'pass' ? '🎟️ 패스 선물' : '🛍️ 아이템 선물'} · 보내기를 누르면 전송돼요</span>
                <span style={css('font-size:14px;font-weight:700;color:#063d22;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{itemLabel(pendingGift.kind, pendingGift.key)} · {giftPrice(pendingGift.kind, pendingGift.key).toLocaleString()}P</span>
              </span>
              <button onClick={() => setPendingGift(null)} aria-label="선물 빼기" style={css('width:36px;height:36px;flex:none;border-radius:9999px;display:flex;align-items:center;justify-content:center')}><CloseIcon size={16} stroke="#2f7a52" width={2.6} /></button>
            </div>
          )}
          {v.canSend ? (
            <div style={css('display:flex;align-items:center;gap:8px')}>
              <button className="pr-94" onClick={() => setAttach(a => (a ? null : 'menu'))} disabled={sending} aria-label="사진·포인트 선물" aria-expanded={!!attach} style={sx(`width:36px;height:36px;flex:none;border-radius:9999px;display:flex;align-items:center;justify-content:center;color:#000;background:#ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.12);transition:transform 260ms ${EASE}`, { transform: attach ? 'rotate(45deg)' : 'none' })}><PlusIcon /></button>
              <input ref={fileRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) pickPhoto(f); e.target.value = '' }} style={css('display:none')} />
              <span style={css('flex:1;min-width:0;display:flex;align-items:flex-end;gap:6px;min-height:36px;padding:2px 3px 2px 14px;border-radius:18px;background:#ffffff;box-shadow:inset 0 0 0 1px #d1d1d6')}>
                <textarea
                  ref={inputRef} className="box-focus" rows={1} value={draft} maxLength={MAX_TEXT} placeholder="메시지 보내기"
                  onChange={e => setDraft(e.target.value)}
                  onFocus={() => setTimeout(() => toBottom(true), 300)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }}
                  style={css('flex:1;min-width:0;min-height:32px;max-height:120px;resize:none;outline:none;border:0;background:transparent;padding:6px 0;font-size:17px;line-height:22px;color:#000;font-family:inherit')}
                />
                <button className="pr-94" title="꾹 누르면 예약 전송"
                  onPointerDown={e => { e.preventDefault(); pressStart() }} onPointerUp={pressEnd} onPointerLeave={pressEnd} onPointerCancel={pressEnd}
                  onMouseDown={e => e.preventDefault()} onContextMenu={e => e.preventDefault()} onClick={send} disabled={!canSendNow} aria-label="보내기 (꾹 누르면 예약)"
                  style={sx(`width:30px;height:30px;flex:none;border-radius:9999px;background:#34c759;display:flex;align-items:center;justify-content:center;transition:opacity 200ms ${EASE},transform 200ms ${EASE};-webkit-touch-callout:none;user-select:none`, { opacity: canSendNow ? 1 : 0.35, transform: canSendNow ? 'scale(1)' : 'scale(0.92)' })}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" /></svg>
                </button>
              </span>
            </div>
          ) : (
            <div style={css('min-height:44px;display:flex;align-items:center;justify-content:center;padding:0 16px;border-radius:22px;background:#f2f4f6;font-size:15px;color:#6b7684;text-align:center')}>{v.blockedReason}</div>
          )}
        </div>

        {menu && (
          <ChatMenu {...p} bg={bg} onBg={k => { setBg(k); saveBg(chat.id, k) }} onClose={() => setMenu(false)}
            onLeave={() => { setMenu(false); p.onLeave() }}
            onOpenProfile={uid => { setMenu(false); onOpenProfile(uid) }}
            onTimeoutPick={adminHere ? uid => { setMenu(false); setTimeoutFor(uid) } : undefined} />
        )}
        {actionFor && (
          <BottomSheet onScrim={() => setActionFor(null)} scrim="rgba(0,0,0,0.2)" sheetStyle={`border-radius:28px 28px 0 0;padding:8px 0 calc(16px + env(safe-area-inset-bottom));animation:sheetUp 320ms ${EASE} both`}>
            <div style={css('width:36px;height:4px;border-radius:2px;background:#e5e8eb;margin:0 auto 8px')} />
            <div style={css('margin:4px 24px 8px;padding:10px 14px;border-radius:14px;background:#f9fafb;font-size:14px;line-height:20px;color:#4e5968;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{snippet(actionFor)}</div>
            {v.canSend && <button className="pr-dim" onClick={() => startReply(actionFor)} style={css('width:calc(100% - 8px);margin:0 4px;padding:16px 20px;border-radius:12px;text-align:left;font-size:17px;font-weight:500;color:#333d4b')}>답장</button>}
            {(!actionFor.kind || actionFor.kind === 'text') && (
              <button className="pr-dim" onClick={async () => { try { await navigator.clipboard.writeText(actionFor.text); p.onToast('메시지를 복사했어요') } catch { p.onToast('복사하지 못했어요') } setActionFor(null) }} style={css('width:calc(100% - 8px);margin:0 4px;padding:16px 20px;border-radius:12px;text-align:left;font-size:17px;font-weight:500;color:#333d4b')}>복사</button>
            )}
            {adminHere && actionFor.uid !== me.id && chat.members.includes(actionFor.uid) && (
              <button className="pr-dim" onClick={() => { setTimeoutFor(actionFor.uid); setActionFor(null) }} style={css('width:calc(100% - 8px);margin:0 4px;padding:16px 20px;border-radius:12px;text-align:left;font-size:17px;font-weight:500;color:#f04452')}>{byId.get(actionFor.uid)?.name ?? ''}님 타임아웃</button>
            )}
          </BottomSheet>
        )}
        {timeoutFor && (
          <TimeoutSheet name={byId.get(timeoutFor)?.name ?? '(알 수 없음)'} left={timedOutUntil(chat, timeoutFor) ? timedOutUntil(chat, timeoutFor) - Date.now() : 0}
            onPick={(ms, label) => applyTimeout(timeoutFor, ms, label)} onClose={() => setTimeoutFor(null)} />
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
              <button className="pr-96" onClick={() => setAttach('item')} style={css('display:flex;flex-direction:column;align-items:center;gap:10px;padding:18px 0;border-radius:20px;background:#f9fafb')}>
                <span style={css('width:56px;height:56px;border-radius:9999px;background:#e5fbef;display:flex;align-items:center;justify-content:center;font-size:28px')}>🛍️</span>
                <span style={css('font-size:15px;font-weight:600;color:#333d4b')}>아이템 선물</span>
              </button>
              <button className="pr-96" onClick={() => { if (p.fakePass) setAttach('fake'); else { setAttach(null); p.onBuyFakePass() } }} style={css('position:relative;display:flex;flex-direction:column;align-items:center;gap:10px;padding:18px 0;border-radius:20px;background:#f4eeff')}>
                {!p.fakePass && <span style={css('position:absolute;top:8px;right:8px;padding:1px 7px;border-radius:9999px;background:#8b5cf6;color:#fff;font-size:11px;font-weight:700')}>패스</span>}
                <span style={css('width:56px;height:56px;border-radius:9999px;background:#8b5cf6;display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:0 6px 16px -6px rgba(139,92,246,0.7)')}>🎁</span>
                <span style={css('font-size:15px;font-weight:600;color:#7c3aed')}>페이크 선물</span>
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
        {scheduleOpen && <ScheduleSheet what={[pendingGift && itemLabel(pendingGift.kind, pendingGift.key) + ' 선물', draft.trim()].filter(Boolean).join(' + ')} onClose={() => setScheduleOpen(false)} onPick={schedule} />}
        {scheduledOpen && (
          <ScheduledSheet list={scheduled} onClose={() => setScheduledOpen(false)}
            onCancel={async it => {
              await cancelScheduled(db, me.id, it.id)
              if (it.giftId) await p.onCancelGift(it.giftId)
              p.onToast(it.giftId ? '예약을 취소했어요. 포인트가 돌아왔어요' : '예약을 취소했어요')
            }} />
        )}
        {attach === 'item' && (
          <ItemGiftSheet points={p.myPoints} group={chat.type === 'group'} to={chat.type === 'dm' ? v.people[0] : undefined}
            onClose={() => setAttach(null)}
            onSend={async (k, key) => { setPendingGift({ kind: k, key }); setAttach(null); setTimeout(() => inputRef.current?.focus(), 50) }} />
        )}
        {attach === 'fake' && (
          <GiftSheet fake
            points={MAX_GIFT} group={chat.type === 'group'} to={chat.type === 'dm' ? v.people[0]?.name : undefined}
            onClose={() => setAttach(null)}
            onSend={async n => {
              try { await sendFakeGift(db, me.id, chat.id, n); setAttach(null); p.onToast('페이크 선물을 보냈어요 😜') } catch { p.onToast('보내지 못했어요. 패스를 방금 샀다면 잠시 후 다시 보내주세요') }
            }}
          />
        )}
        {fooled && <FakeReveal onClose={() => setFooled(false)} />}
      </div>
    </div>
    </>
  )
}

function ImageBubble({ db, chatId, msgId, onOpen, onLoaded }: { db: Firestore; chatId: string; msgId: string; onOpen: (src: string) => void; onLoaded?: () => void }) {
  const [src, setSrc] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { let live = true; loadImage(db, chatId, msgId).then(s => { if (live) setSrc(s) }).catch(() => {}); return () => { live = false } }, [db, chatId, msgId])
  return (
    <button className="pr-96" onClick={() => src && onOpen(src)} aria-label="사진 크게 보기" style={css('display:block;padding:0;border-radius:18px;overflow:hidden;position:relative;min-width:120px;min-height:120px;background:#f2f4f6')}>
      {!loaded && <span className="skeleton" style={css('position:absolute;inset:0')} />}
      {src && <img src={src} alt="사진" onLoad={() => { setLoaded(true); onLoaded?.() }} style={sx(`display:block;max-width:220px;max-height:300px;object-fit:cover;transition:opacity 300ms ${EASE}`, { opacity: loaded ? 1 : 0 })} />}
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
function GiftBubble({ db, giftId, me, mine: meP, byId, onClaim, onCancel, onLoaded }: { db: Firestore; giftId: string; me: string; mine?: Person; byId: Map<string, Person>; onClaim: (id: string) => Promise<unknown>; onCancel: (id: string) => Promise<unknown>; onLoaded?: () => void }) {
  const [g, setG] = useState<Gift | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  // Listen only while it can still change; a taken or cancelled gift is final.
  const final = g?.status === 'claimed' || g?.status === 'cancelled'
  useEffect(() => (final ? undefined : subscribeGift(db, giftId, setG)), [db, giftId, final])
  useEffect(() => { if (g) onLoaded?.() }, [g?.status]) // eslint-disable-line react-hooks/exhaustive-deps
  const amount = g ? g.amount.toLocaleString() + 'P' : ''
  const mine = g?.from === me
  const item = g?.itemKind && g.itemKey ? { kind: g.itemKind, key: g.itemKey } : null
  const haveIt = !!item && hasGift(meP, item.kind, item.key)
  const canTake = !!g && g.status === 'open' && !mine && (!g.to || g.to === me) && !haveIt
  const done = g?.status !== 'open'
  const status = !g ? '불러오는 중이에요' : g.status === 'claimed' ? (g.claimedBy === me ? '내가 받았어요' : `${byId.get(g.claimedBy ?? '')?.name ?? '누군가'}님이 받았어요`)
    : g.status === 'cancelled' ? '취소된 선물이에요'
    : haveIt && !mine ? `이미 가지고 있는 ${item?.kind === 'pass' ? '패스' : '아이템'}라 받을 수 없어요`
    : mine ? (g.to ? '아직 받지 않았어요' : '먼저 받는 한 명이 가져가요') : g.to ? '나에게 온 선물이에요' : '먼저 받는 사람이 가져가요'
  return (
    <span style={sx(`width:228px;border-radius:20px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 0 0 1px rgba(0,0,33,0.06);transition:filter 300ms ${EASE}`, { filter: done ? 'saturate(0.35)' : 'none', background: '#ffffff' })}>
      {item ? (
        <span style={css('padding:14px 14px 12px;background:linear-gradient(135deg,#e9fff3,#b9f5d3);display:flex;flex-direction:column;gap:10px')}>
          <span style={css('display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:#0a6b3a')}>{item.kind === 'pass' ? '🎟️ 패스 선물' : '🛍️ 아이템 선물'}{LEGENDARY.has(item.key) && <span className="legend-tag" style={css('height:16px;padding:0 6px;border-radius:9999px;font-size:10px;font-weight:800;color:#1a0633;display:flex;align-items:center')}>레전드</span>}</span>
          <ItemPreview kind={item.kind} k={item.key} name={byId.get(g!.from)?.name ?? ''} />
          <span style={css('display:flex;justify-content:space-between;align-items:baseline')}>
            <span style={css('font-size:16px;font-weight:800;color:#063d22')}>{itemLabel(item.kind, item.key)}</span>
            <span style={css('font-size:12px;font-weight:600;color:#2f7a52;font-variant-numeric:tabular-nums')}>{g!.amount.toLocaleString()}P</span>
          </span>
        </span>
      ) : (
      <span style={css('padding:16px 16px 14px;background:linear-gradient(135deg,#fff1c2,#ffd66b);display:flex;align-items:center;gap:12px')}>
        <span style={css('font-size:34px;line-height:1')}>🎁</span>
        <span style={css('display:flex;flex-direction:column')}>
          <span style={css('font-size:13px;font-weight:600;color:#8a5a00')}>포인트 선물</span>
          <span style={css('font-size:22px;line-height:30px;font-weight:800;color:#5c3d00;font-variant-numeric:tabular-nums')}>{amount}</span>
        </span>
      </span>
      )}
      <span style={css('padding:10px 14px 12px;display:flex;flex-direction:column;gap:8px')}>
        <span style={css('font-size:13px;line-height:19px;color:#6b7684')}>{status}</span>
        {canTake && <button className="pr-96" disabled={busy} onClick={() => { setBusy(true); onClaim(giftId).finally(() => setBusy(false)) }} style={sx('height:40px;border-radius:12px;background:#3182f6;color:#fff;font-size:15px;font-weight:600', { opacity: busy ? 0.5 : 1 })}>받기</button>}
        {g?.status === 'open' && mine && <button className="pr-96" disabled={busy} onClick={() => { setBusy(true); onCancel(giftId).finally(() => setBusy(false)) }} style={sx('height:40px;border-radius:12px;background:#f2f4f6;color:#4e5968;font-size:15px;font-weight:600', { opacity: busy ? 0.5 : 1 })}>취소하기</button>}
      </span>
    </span>
  )
}

// 페이크 선물: whoever taps 받기 is told it once per message (remembered on the device).

function wasFooled(id: string) { try { return localStorage.getItem('pv-fooled-' + id) === '1' } catch { return false } }
function markFooled(id: string) { if (wasFooled(id)) return false; try { localStorage.setItem('pv-fooled-' + id, '1') } catch { /* private mode */ } return true }

/** Looks exactly like an open GiftBubble to others; the sender sees a 페이크 tag. */
function FakeGiftBubble({ msg, mine, dm, onTake }: { msg: MessageRow; mine: boolean; dm: boolean; onTake: () => void }) {
  const [done, setDone] = useState(() => wasFooled(msg.id))
  const status = mine ? '받기를 누르면 "페이크입니다!"가 떠요' : done ? '페이크였어요 😜' : dm ? '나에게 온 선물이에요' : '먼저 받는 사람이 가져가요'
  return (
    <span style={sx(`width:228px;border-radius:20px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 0 0 1px rgba(0,0,33,0.06);transition:filter 300ms ${EASE}`, { filter: done ? 'saturate(0.35)' : 'none', background: '#ffffff' })}>
      <span style={css('padding:16px 16px 14px;background:linear-gradient(135deg,#fff1c2,#ffd66b);display:flex;align-items:center;gap:12px;position:relative')}>
        <span style={css('font-size:34px;line-height:1')}>🎁</span>
        <span style={css('display:flex;flex-direction:column')}>
          <span style={css('font-size:13px;font-weight:600;color:#8a5a00')}>포인트 선물</span>
          <span style={css('font-size:22px;line-height:30px;font-weight:800;color:#5c3d00;font-variant-numeric:tabular-nums')}>{(msg.amount ?? 0).toLocaleString()}P</span>
        </span>
        {mine && <span style={css('position:absolute;top:10px;right:10px;padding:2px 8px;border-radius:9999px;background:#8b5cf6;color:#fff;font-size:11px;font-weight:700')}>페이크</span>}
      </span>
      <span style={css('padding:10px 14px 12px;display:flex;flex-direction:column;gap:8px')}>
        <span style={css('font-size:13px;line-height:19px;color:#6b7684')}>{status}</span>
        {!mine && !done && <button className="pr-96" onClick={() => { setDone(true); onTake() }} style={css('height:40px;border-radius:12px;background:#3182f6;color:#fff;font-size:15px;font-weight:600')}>받기</button>}
      </span>
    </span>
  )
}

/** "페이크입니다!" — full-screen pop, tap anywhere to close. */
function FakeReveal({ onClose }: { onClose: () => void }) {
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => { const t = setTimeout(() => close.current(), 2600); return () => clearTimeout(t) }, [])
  return (
    <div onClick={onClose} role="alert" style={css('position:absolute;inset:0;z-index:30;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(76,29,149,0.55);animation:fade 200ms ease both;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)')}>
      <span style={css('font-size:88px;line-height:1;animation:popIn 520ms cubic-bezier(0.34,1.56,0.64,1) both')}>🤡</span>
      <span style={css('padding:14px 26px;border-radius:9999px;background:#8b5cf6;color:#fff;font-size:30px;font-weight:800;box-shadow:0 18px 40px -12px rgba(76,29,149,0.8);animation:popIn 520ms 90ms cubic-bezier(0.34,1.56,0.64,1) both')}>페이크입니다!</span>
      <span style={css('font-size:15px;color:rgba(255,255,255,0.9);animation:fade 300ms 300ms ease both')}>포인트는 없어요 😜</span>
    </div>
  )
}

/** What the item looks like: a frame on an avatar, the 이름표 itself, or the bar skin. */
function ItemPreview({ kind, k, name }: { kind: GiftKind; k: string; name: string }) {
  if (kind === 'pass') {
    const x = PASSES.find(p => p.key === k)
    return x ? <span style={sx('align-self:stretch;border-radius:14px;padding:12px;display:flex;align-items:center;gap:10px;color:#fff', { background: x.bg })}><span style={css('font-size:22px;font-weight:800;min-width:30px;text-align:center')}>{x.icon}</span><span style={css('font-size:12px;line-height:17px;opacity:0.9')}>영구 · {x.desc}</span></span> : null
  }
  if (kind === 'set') {
    // the whole series: the 이름표 with the frame on it, and the 막대 if it has one
    const g = SKIN_SERIES.has(k) ? skinGeom(k, 56, false) : null
    return <span style={css('align-self:stretch;display:flex;align-items:center;gap:10px')}><span style={css('flex:1;min-width:0;height:48px')}><Nameplate kind={k} person={name || '이름'} sub="세트 선물" frame={k} style={{ width: '100%', height: 48 }} /></span>{g && <span style={css('position:relative;width:20px;height:56px;flex:none;margin-right:4px')}><TowerSkin g={g} /></span>}</span>
  }
  if (kind === 'frame') return <span style={css('align-self:center;width:64px;height:64px;margin:6px 0')}><Avatar frame={k} size={64} /></span>
  if (kind === 'plate') return <Nameplate kind={k} person={name || '이름'} sub="선물 받은 이름표" style={{ width: '100%', height: 48 }} />
  const g = skinGeom(k, 70, false)
  return <span style={css('align-self:center;position:relative;width:26px;height:70px;margin:12px 0 2px')}>{g && <TowerSkin g={g} />}</span>
}

/** 아이템 선물: pick a whole 세트 (every piece of a series) or a pass to give. */
function ItemGiftSheet({ points, group, to, onClose, onSend }: { points: number; group: boolean; to?: Person; onClose: () => void; onSend: (kind: GiftKind, key: string) => Promise<void> }) {
  const [kind, setKind] = useState<GiftKind>('set')
  const [pick, setPick] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const list: [string, string][] = kind === 'pass' ? PASSES.map(p => [p.key, p.title]) : FRAMES.filter(([k]) => k !== 'none')
  const has = (k: string) => hasGift(to, kind, k)
  const price = pick ? giftPrice(kind, pick) : 0
  const ok = !!pick && price <= points && !has(pick)
  return (
    <BottomSheet onScrim={onClose} scrim="rgba(0,0,0,0.2)" sheetStyle={`border-radius:28px 28px 0 0;padding:8px 0 calc(16px + env(safe-area-inset-bottom));animation:sheetUp 420ms ${EASE} both`}>
      <div style={css('width:36px;height:4px;border-radius:2px;background:#e5e8eb;margin:0 auto')} />
      <div style={css('padding:20px 24px 8px;display:flex;flex-direction:column;gap:4px')}>
        <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>어떤 아이템이나 패스를 선물할까요?</span>
        <span style={css('font-size:15px;line-height:22.5px;color:#6b7684')}>{group ? '단톡방에서는 먼저 받는 한 명이 가져가요' : `${to?.name ?? '상대'}님에게 보내요`} · 받기 전에 취소하면 포인트가 돌아와요</span>
      </div>
      <div style={css('padding:8px 24px 12px;display:flex;gap:6px')}>
        {(['set', 'pass'] as GiftKind[]).map(k => (
          <button key={k} className="pr-96" onClick={() => { setKind(k); setPick(null) }} style={sx('height:34px;padding:0 14px;border-radius:9999px;font-size:14px;font-weight:700', { background: kind === k ? '#191f28' : '#f2f4f6', color: kind === k ? '#fff' : '#4e5968' })}>{k === 'set' ? '세트' : '패스'}</button>
        ))}
      </div>
      <div className="anim-list" style={sx('padding:4px 24px 0;max-height:38vh;overflow-y:auto;display:grid;gap:8px', { gridTemplateColumns: '1fr' })}>
        {list.map(([k, l]) => {
          const on = pick === k, owned = has(k), legend = LEGENDARY.has(k)
          return (
            <button key={k} className="pr-96" disabled={owned} onClick={() => setPick(k)}
              style={sx('position:relative;border-radius:16px;padding:10px 8px 8px;display:flex;flex-direction:column;align-items:center;gap:6px;transition:box-shadow 150ms', { background: legend ? (k === 'matrix' ? '#021a0b' : k === 'korea' ? '#0d1b3d' : '#160538') : '#f9fafb', boxShadow: on ? 'inset 0 0 0 2px #3182f6' : 'none', opacity: owned ? 0.45 : 1 })}>
              {kind === 'set' && <ItemPreview kind="set" k={k} name={to?.name ?? l} />}
              {kind === 'pass' && <ItemPreview kind="pass" k={k} name="" />}
              <span style={sx('font-size:12px;font-weight:700', { color: legend ? '#fff' : '#333d4b' })}>{kind === 'set' ? `${l} 세트 · ${SKIN_SERIES.has(k) ? '프레임 + 이름표 + 막대 스킨' : '프레임 + 이름표'}` : l} {owned ? '· 이미 다 있음' : `· ${giftPrice(kind, k).toLocaleString()}P`}</span>
            </button>
          )
        })}
      </div>
      <div style={css('padding:14px 20px 0')}>
        <div style={sx('padding:0 4px 8px;font-size:13px', { color: pick && price > points ? '#f04452' : '#8b95a1' })}>{pick && price > points ? `포인트가 모자라요 · 내 포인트 ${points.toLocaleString()}P` : `내 포인트 ${points.toLocaleString()}P`}</div>
        <button data-g="primary" className="pr-96" disabled={!ok || busy} onClick={async () => { if (!pick) return; setBusy(true); try { await onSend(kind, pick) } finally { setBusy(false) } }}
          style={sx(`width:100%;height:56px;border-radius:16px;background:#3182f6;color:#fff;font-size:17px;font-weight:600;transition:opacity 200ms ${EASE}`, { opacity: ok && !busy ? 1 : 0.3 })}>{pick ? `${itemLabel(kind, pick)} 입력창에 올리기 · ${price.toLocaleString()}P` : '아이템을 골라주세요'}</button>
      </div>
    </BottomSheet>
  )
}

/** A small picture of a gift for the composer card. */
export function GiftThumb({ kind, k }: { kind: GiftKind; k: string }) {
  if (kind === 'set' || kind === 'frame') return <Avatar frame={k} size={36} full />
  if (kind === 'skin') { const g = skinGeom(k, 40, false); return <span style={css('position:relative;width:16px;height:40px')}>{g && <TowerSkin g={g} />}</span> }
  if (kind === 'pass') { const x = PASSES.find(p => p.key === k); return <span style={sx('width:36px;height:36px;border-radius:10px;color:#fff;font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center', { background: x?.bg ?? '#3182f6' })}>{x?.icon}</span> }
  return <span style={css('width:44px;height:26px;border-radius:8px;overflow:hidden')}><Nameplate kind={k} person=" " showAvatar={false} style={{ width: 44, height: 26 }} /></span>
}

/** "9월 29일 오후 3:05" (today / tomorrow shown as such). */
export function whenLabel(ms: number) {
  const d = new Date(ms), now = new Date(), tmr = new Date(Date.now() + 86400_000)
  const t = `${d.getHours() < 12 ? '오전' : '오후'} ${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`
  return d.toDateString() === now.toDateString() ? `오늘 ${t}` : d.toDateString() === tmr.toDateString() ? `내일 ${t}` : `${d.getMonth() + 1}월 ${d.getDate()}일 ${t}`
}
const toLocalInput = (ms: number) => { const d = new Date(ms); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }

/** 예약 전송: when should it go out? */
function ScheduleSheet({ what, onClose, onPick }: { what: string; onClose: () => void; onPick: (at: number) => Promise<void> }) {
  const at = (h: number, m = 0, addDay = 0) => { const d = new Date(); d.setDate(d.getDate() + addDay); d.setHours(h, m, 0, 0); return d.getTime() }
  const presets: [string, number][] = [
    ['10분 후', Date.now() + 10 * 60_000], ['1시간 후', Date.now() + 60 * 60_000],
    ...(at(21) > Date.now() + 60_000 ? [['오늘 밤 9시', at(21)] as [string, number]] : []),
    ['내일 아침 8시', at(8, 0, 1)],
  ]
  const [value, setValue] = useState(() => toLocalInput(Date.now() + 60 * 60_000))
  const [busy, setBusy] = useState(false)
  const picked = value ? new Date(value).getTime() : 0
  const ok = picked > Date.now() + 30_000 && picked < Date.now() + 365 * 86400_000
  const go = async (ms: number) => { setBusy(true); try { await onPick(ms) } finally { setBusy(false) } }
  return (
    <BottomSheet onScrim={onClose} scrim="rgba(0,0,0,0.2)" sheetStyle={`border-radius:28px 28px 0 0;padding:8px 0 calc(16px + env(safe-area-inset-bottom));animation:sheetUp 380ms ${EASE} both`}>
      <div style={css('width:36px;height:4px;border-radius:2px;background:#e5e8eb;margin:0 auto')} />
      <div style={css('padding:20px 24px 8px;display:flex;flex-direction:column;gap:4px')}>
        <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>⏰ 언제 보낼까요?</span>
        <span style={css('font-size:14px;line-height:21px;color:#6b7684;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{what || '메시지'} · 앱을 꺼 둬도 그 시간에 보내져요</span>
      </div>
      <div className="anim-list" style={css('padding:8px 20px 0;display:grid;grid-template-columns:1fr 1fr;gap:8px')}>
        {presets.map(([l, ms]) => (
          <button key={l} className="pr-96" disabled={busy} onClick={() => go(ms)} style={css('height:56px;border-radius:14px;background:#f2f7ff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px')}>
            <span style={css('font-size:15px;font-weight:700;color:#1b64da')}>{l}</span>
            <span style={css('font-size:12px;color:#6b7684')}>{whenLabel(ms)}</span>
          </button>
        ))}
      </div>
      <div style={css('padding:14px 20px 0;display:flex;flex-direction:column;gap:8px')}>
        <span style={css('font-size:13px;font-weight:600;color:#4e5968;padding:0 4px')}>직접 고르기</span>
        <input type="datetime-local" value={value} min={toLocalInput(Date.now() + 60_000)} onChange={e => setValue(e.target.value)} className="box-focus"
          style={css('height:50px;border:0;outline:none;border-radius:14px;background:#f2f4f6;padding:0 14px;font:inherit;font-size:16px;color:#191f28')} />
        <button data-g="primary" className="pr-96" disabled={!ok || busy} onClick={() => go(picked)}
          style={sx(`height:54px;border-radius:16px;background:#3182f6;color:#fff;font-size:16px;font-weight:700;transition:opacity 200ms ${EASE}`, { opacity: ok && !busy ? 1 : 0.35 })}>{ok ? `${whenLabel(picked)}에 보내기` : '지금보다 뒤의 시간을 골라주세요'}</button>
      </div>
    </BottomSheet>
  )
}

/** 예약된 메시지 in this chat: see and cancel. */
function ScheduledSheet({ list, onClose, onCancel }: { list: Scheduled[]; onClose: () => void; onCancel: (it: Scheduled) => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null)
  return (
    <BottomSheet onScrim={onClose} scrim="rgba(0,0,0,0.2)" sheetStyle={`border-radius:28px 28px 0 0;padding:8px 0 calc(16px + env(safe-area-inset-bottom));animation:sheetUp 380ms ${EASE} both`}>
      <div style={css('width:36px;height:4px;border-radius:2px;background:#e5e8eb;margin:0 auto')} />
      <div style={css('padding:20px 24px 8px;font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>예약된 메시지</div>
      <div className="anim-list" style={css('padding:0 16px;max-height:50vh;overflow-y:auto;display:flex;flex-direction:column;gap:6px')}>
        {list.length === 0 && <span style={css('padding:24px 8px;text-align:center;font-size:15px;color:#8b95a1')}>예약된 메시지가 없어요</span>}
        {list.map(it => (
          <div key={it.id} style={css('padding:12px 12px 12px 14px;border-radius:14px;background:#f9fafb;display:flex;align-items:center;gap:10px')}>
            <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:2px')}>
              <span style={css('font-size:13px;font-weight:700;color:#1b64da')}>⏰ {whenLabel(it.at)}</span>
              <span style={css('font-size:15px;color:#191f28;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{it.text}</span>
            </span>
            <button className="pr-96" disabled={busy === it.id} onClick={async () => { setBusy(it.id); try { await onCancel(it) } finally { setBusy(null) } }}
              style={css('flex:none;height:34px;padding:0 12px;border-radius:10px;background:#fff0f1;color:#e42939;font-size:14px;font-weight:700')}>취소</button>
          </div>
        ))}
      </div>
    </BottomSheet>
  )
}

/** "얼마를 선물할까요?" */
function GiftSheet({ points, group, to, fake, onClose, onSend }: { points: number; group: boolean; to?: string; fake?: boolean; onClose: () => void; onSend: (n: number) => Promise<void> }) {
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const n = Number(amount || 0)
  const ok = Number.isInteger(n) && n >= 1 && n <= Math.min(points, MAX_GIFT)
  const add = (k: number) => setAmount(String(Math.min(points, (Number(amount) || 0) + k)))
  return (
    <BottomSheet onScrim={onClose} scrim="rgba(0,0,0,0.2)" sheetStyle={`border-radius:28px 28px 0 0;padding:8px 0 calc(20px + env(safe-area-inset-bottom));animation:sheetUp 420ms ${EASE} both`}>
      <div style={css('width:36px;height:4px;border-radius:2px;background:#e5e8eb;margin:0 auto')} />
      <div style={css('padding:20px 24px 8px;display:flex;flex-direction:column;gap:4px')}>
        {fake && <span style={css('align-self:flex-start;margin-bottom:6px;padding:3px 10px;border-radius:9999px;background:#f4eeff;color:#7c3aed;font-size:13px;font-weight:700')}>페이크 선물</span>}
        <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>{fake ? '얼마짜리처럼 보일까요?' : '얼마를 선물할까요?'}</span>
        <span style={css('font-size:15px;line-height:22.5px;color:#6b7684')}>{fake ? '진짜 선물이랑 똑같이 보여요 · 포인트는 안 나가고, 받기를 누르면 "페이크입니다!"가 떠요' : <>{group ? '단톡방에서는 먼저 받는 한 명이 가져가요' : `${to ?? '상대'}님에게 보내요`} · 받기 전에는 취소할 수 있어요</>}</span>
      </div>
      <div style={css('padding:16px 24px 0;display:flex;align-items:baseline;gap:6px')}>
        <input inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, '').slice(0, 13))} placeholder="0"
          style={sx('flex:1;min-width:0;border:0;outline:none;background:transparent;font-size:34px;line-height:44px;font-weight:700;font-variant-numeric:tabular-nums', { color: amount && !ok ? '#f04452' : '#191f28' })} />
        <span style={css('font-size:26px;font-weight:700;color:#191f28')}>P</span>
      </div>
      {!fake && <div style={sx('padding:4px 24px 0;font-size:13px', { color: amount && !ok ? '#f04452' : '#8b95a1' })}>{amount && n > points ? `포인트가 모자라요 · 내 포인트 ${points.toLocaleString()}P` : `내 포인트 ${points.toLocaleString()}P`}</div>}
      <div className="anim-list" style={css('padding:16px 24px 0;display:flex;gap:6px;flex-wrap:wrap')}>
        {[10, 50, 100, 500].map(k => <button key={k} className="pr-96" onClick={() => add(k)} style={css('height:34px;padding:0 14px;border-radius:9999px;background:#f2f4f6;color:#4e5968;font-size:14px;font-weight:600')}>+{k}</button>)}
        <button className="pr-96" onClick={() => setAmount(String(Math.min(points, MAX_GIFT)))} style={css('height:34px;padding:0 14px;border-radius:9999px;background:#f2f4f6;color:#4e5968;font-size:14px;font-weight:600')}>전부</button>
      </div>
      <div style={css('padding:24px 20px 0')}>
        <button data-g="primary" className="pr-96" disabled={!ok || busy} onClick={async () => { setBusy(true); try { await onSend(n) } finally { setBusy(false) } }}
          style={sx(`width:100%;height:56px;border-radius:16px;color:#fff;font-size:17px;font-weight:600;transition:opacity 200ms ${EASE}`, { background: fake ? '#8b5cf6' : '#3182f6', opacity: ok && !busy ? 1 : 0.3 })}>{fake ? (ok ? `${n.toLocaleString()}P 페이크 선물 보내기` : '페이크 선물 보내기') : ok ? `${n.toLocaleString()}P 선물하기` : '선물하기'}</button>
      </div>
    </BottomSheet>
  )
}

// ---- ≡ 채팅방 메뉴 ------------------------------------------------------------------

type MenuProps = RoomProps & { bg: string; onBg: (k: string) => void; onClose: () => void; onTimeoutPick?: (uid: string) => void }

/** KakaoTalk-style side panel: who's here (tap for profile), invite, 알림, photo/name, background, 나가기 (asks twice). */
function ChatMenu({ chat, me, all, byId, bg, onBg, onClose, onMute, onLeave, onInvite, onGroupInfo, onOpenProfile, onTimeoutPick }: MenuProps) {
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
                <Avatar frame={p?.frame} photo={p?.photoCss} size={40} style={{ flex: 'none' }} full />
                <span style={css('flex:1;min-width:0;display:flex;align-items:center;gap:6px')}>
                  <span style={css(title17 + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{nameIn(byId, id)}</span>
                  <RankChip rank={p?.rank} />
                </span>
                {id === me.id && <span style={css('flex:none;height:22px;padding:0 8px;border-radius:9999px;background:#f2f4f6;color:#6b7684;font-size:12px;font-weight:600;display:flex;align-items:center')}>나</span>}
                {id !== me.id && p?.msgOff && <span style={css('flex:none;font-size:13px;color:#8b95a1')}>메시지 꺼둠</span>}
                {timedOutUntil(chat, id) > 0 && <span style={css('flex:none;height:22px;padding:0 8px;border-radius:9999px;background:#fff0f1;color:#e42939;font-size:12px;font-weight:600;display:flex;align-items:center')}>타임아웃 {leftLabel(timedOutUntil(chat, id) - Date.now())}</span>}
                {onTimeoutPick && id !== me.id && p && (
                  <span role="button" tabIndex={0} className="pr-96" onClick={e => { e.stopPropagation(); onTimeoutPick(id) }} aria-label={`${p.name}님 타임아웃`}
                    style={css('flex:none;width:32px;height:32px;border-radius:10px;background:#f2f4f6;color:#4e5968;display:flex;align-items:center;justify-content:center')}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9.5 2.5h5" /></svg>
                  </span>
                )}
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
          {picked.length === 0 ? (withName ? '한 명을 고르면 1:1, 여러 명이면 단톡방이 돼요' : (Number.isFinite(max) ? `최대 ${max}명까지 초대할 수 있어요` : '초대할 사람을 골라주세요')) : `${picked.length}명 골랐어요${full ? ` · 최대 ${max}명` : ''}`}
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

const TIMEOUT_PRESETS: [number, string][] = [[5 * 60, '5분'], [60 * 60, '1시간'], [86400, '1일'], [7 * 86400, '7일']]
const MAX_TIMEOUT_DAYS = 365

/** Admin: how long this person can't talk in the group (they can still read) — any 일 / 시간 / 분 / 초. */
function TimeoutSheet({ name, left, onPick, onClose }: { name: string; left: number; onPick: (ms: number, label: string) => void; onClose: () => void }) {
  const [v, setV] = useState<Dhms>({ d: '', h: '', m: '10', s: '' })
  const sec = dhmsSeconds(v)
  const ok = sec >= 1 && sec <= MAX_TIMEOUT_DAYS * 86400
  return (
    <BottomSheet onScrim={onClose} scrim="rgba(0,0,0,0.2)" sheetStyle={`border-radius:28px 28px 0 0;padding:8px 0 calc(16px + env(safe-area-inset-bottom));animation:sheetUp 360ms ${EASE} both`}>
      <div style={css('width:36px;height:4px;border-radius:2px;background:#e5e8eb;margin:0 auto')} />
      <div style={css('padding:20px 24px 12px;display:flex;flex-direction:column;gap:4px')}>
        <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>{name}님을 얼마나 타임아웃할까요?</span>
        <span style={css('font-size:15px;line-height:22.5px;color:#6b7684')}>{left > 0 ? `지금 타임아웃 중이에요 · ${leftLabel(left)} 남음. ` : ''}그동안 메시지를 읽을 수만 있고 보낼 수는 없어요. 채팅방에 누가 했는지 보여요</span>
      </div>
      <div style={css('padding:4px 20px 0')}>
        <DurationInput value={v} onChange={setV} maxDays={MAX_TIMEOUT_DAYS} presets={TIMEOUT_PRESETS} />
      </div>
      <div style={css('padding:16px 20px 0;display:flex;flex-direction:column;gap:8px')}>
        <button className="pr-96" disabled={!ok} onClick={() => onPick(sec * 1000, durationLabel(sec))}
          style={sx(`height:54px;border-radius:14px;background:#f04452;color:#fff;font-size:16px;font-weight:700;transition:opacity 200ms ${EASE}`, { opacity: ok ? 1 : 0.35 })}>
          {ok ? `${durationLabel(sec)} 타임아웃` : '시간을 정해주세요'}
        </button>
        {left > 0 && <button className="pr-96" onClick={() => onPick(0, '')} style={css('height:52px;border-radius:14px;background:#e8f3ff;color:#1b64da;font-size:16px;font-weight:700')}>타임아웃 풀기</button>}
      </div>
    </BottomSheet>
  )
}

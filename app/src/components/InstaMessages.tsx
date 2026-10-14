import { useEffect, useMemo, useRef, useState } from 'react'
import type { Firestore } from 'firebase/firestore'
import { css, imageCss } from '../css'
import { Avatar } from './Avatar'
import { fileToChatImage } from '../backend/image'
import { HEARTBEAT_MS, MAX_TEXT, isUnread, loadImage, markGone, markHere, mergeMessages, noteRead, openDm, sendImage, sendMessage, subscribeMessages, type ChatRow, type MessageRow } from '../backend/messages'
import type { Person } from '../model'
import { describeChat } from './MessagesScreen'

// 인스타그램's 메시지: the Instagram look (a list of conversations, bubbles, the round composer) on the
// app's own messages, the same chats, the same messages. What is said here shows in the 메시지 tab and
// the other way round.
type Props = {
  db: Firestore; me: Person; chats: ChatRow[]; byId: Map<string, Person>
  onBack: () => void; onToast: (msg: string) => void
}

const since = (t: number) => {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000))
  return m < 1 ? '방금' : m < 60 ? `${m}분` : m < 1440 ? `${Math.round(m / 60)}시간` : `${Math.round(m / 1440)}일`
}
const hhmm = (t: number) => { const d = new Date(t); return `${d.getHours() < 12 ? '오전' : '오후'} ${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}` }
const preview = (c: ChatRow, me: string) => {
  const l = c.last
  if (!l) return '대화를 시작해보세요'
  const t = l.text || ''
  return (l.uid === me ? '나: ' : '') + (t || '사진을 보냈어요')
}

/** The face of a chat: the person's own profile (photo and frame), the first one for a group. */
function Face({ c, me, byId, size }: { c: ChatRow; me: string; byId: Map<string, Person>; size: number }) {
  const v = describeChat(c, me, byId, false)
  const img = imageCss(c.photo)
  if (c.type === 'group' && img !== 'none') return <Avatar photo={img} size={size} style={{ flex: 'none' }} />
  const p = v.people[0]
  return <Avatar frame={p?.frame} photo={p?.photoCss} size={size} style={{ flex: 'none' }} />
}

const back = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
)

export function InstaMessages({ db, me, chats, byId, onBack, onToast }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [picking, setPicking] = useState(false)
  const chat = chats.find(c => c.id === open) ?? null

  const shown = useMemo(() => {
    const needle = q.trim()
    return chats.filter(c => !needle || describeChat(c, me.id, byId, false).title.includes(needle))
  }, [chats, q, byId, me.id])
  // people to start a conversation with (anyone who is not me and takes messages)
  const people = useMemo(() => {
    const needle = q.trim()
    return [...byId.values()].filter(p => !p.isMe && !p.msgOff && (!needle || p.name.includes(needle))).sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [byId, q])
  const start = async (id: string) => {
    try { setOpen(await openDm(db, me.id, id)); setPicking(false); setQ('') } catch { onToast('대화를 열지 못했어요. 상대가 메시지를 껐을 수 있어요') }
  }

  if (chat) return <Conversation key={chat.id} db={db} me={me} chat={chat} byId={byId} onBack={() => setOpen(null)} onToast={onToast} />

  return (
    <div style={css('position:absolute;inset:0;z-index:25;background:#fff;color:#000;display:flex;flex-direction:column')}>
      <header style={css('flex:none;display:flex;align-items:center;gap:6px;padding:calc(var(--phone-top,54px) - 30px) 12px 6px')}>
        <button aria-label="뒤로" className="pr-96" onClick={() => (picking ? (setPicking(false), setQ('')) : onBack())} style={css('display:flex;width:36px;height:36px;align-items:center;justify-content:center')}>{back}</button>
        <span style={css('flex:1;min-width:0;font-size:20px;font-weight:800;letter-spacing:-0.4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{picking ? '새 메시지' : me.name}</span>
        {!picking && (
          <button aria-label="새 메시지" className="pr-96" onClick={() => setPicking(true)} style={css('display:flex;width:36px;height:36px;align-items:center;justify-content:center')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h8" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
          </button>
        )}
      </header>
      <div style={css('flex:none;padding:6px 16px 8px')}>
        <label style={css('display:flex;align-items:center;gap:8px;height:38px;padding:0 12px;border-radius:12px;background:#efefef;color:#8e8e93')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="검색" aria-label="검색" style={css('flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:16px;color:#000')} />
        </label>
      </div>
      <div style={css('flex:1;min-height:0;overflow-y:auto;padding-bottom:110px')}>
        {picking ? (
          <>
            {people.length === 0 && <div style={css('padding:50px 24px;text-align:center;color:#8e8e93;font-size:14px')}>보낼 수 있는 사람이 없어요</div>}
            {people.map(p => (
              <button key={p.id} className="pr-96" onClick={() => start(p.id)} style={css('width:100%;display:flex;align-items:center;gap:14px;padding:8px 20px;text-align:left')}>
                <Avatar frame={p.frame} photo={p.photoCss} size={48} style={{ flex: 'none' }} />
                <span style={css('flex:1;min-width:0;font-size:15px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{p.name}</span>
              </button>
            ))}
          </>
        ) : (
          <>
            <div style={css('display:flex;justify-content:space-between;align-items:baseline;padding:6px 16px 8px')}>
              <b style={css('font-size:16px')}>메시지</b>
              <span style={css('font-size:13px;color:#8e8e93')}>{chats.length}개</span>
            </div>
            {chats.length === 0 && (
              <div style={css('padding:50px 28px;text-align:center;color:#8e8e93;font-size:15px;line-height:22px')}>아직 대화가 없어요.<br />위의 연필을 눌러 메시지를 보내보세요.</div>
            )}
            {shown.map(c => {
              const v = describeChat(c, me.id, byId, false)
              const unread = isUnread(c, me.id)
              const at = c.last?.at?.toMillis()
              return (
                <button key={c.id} className="pr-96" onClick={() => setOpen(c.id)} style={css('width:100%;display:flex;align-items:center;gap:14px;padding:10px 20px;text-align:left')}>
                  <Face c={c} me={me.id} byId={byId} size={56} />
                  <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:2px')}>
                    <span style={css('font-size:15px;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' + (unread ? 'font-weight:700' : 'font-weight:500'))}>{v.title}</span>
                    <span style={css('font-size:14px;line-height:19px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:' + (unread ? '#000' : '#8e8e93') + (unread ? ';font-weight:600' : ''))}>{preview(c, me.id)}{at ? ` · ${since(at)}` : ''}</span>
                  </span>
                  {unread && <span aria-label="안 읽음" style={css('flex:none;width:10px;height:10px;border-radius:9999px;background:#0095f6')} />}
                </button>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}

/** A photo message: loaded on demand (the image sits in its own record). */
function Photo({ db, chatId, m }: { db: Firestore; chatId: string; m: MessageRow }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let off = false
    loadImage(db, chatId, m.mediaId ?? m.id).then(s => { if (!off) setSrc(s) }).catch(() => {})
    return () => { off = true }
  }, [db, chatId, m.id, m.mediaId])
  return src
    ? <img src={src} alt="보낸 사진" style={css('display:block;max-width:220px;max-height:280px;border-radius:18px;object-fit:cover')} />
    : <span style={css('display:block;width:160px;height:160px;border-radius:18px;background:#efefef')} />
}

function Conversation({ db, me, chat, byId, onBack, onToast }: { db: Firestore; me: Person; chat: ChatRow; byId: Map<string, Person>; onBack: () => void; onToast: (m: string) => void }) {
  const [msgs, setMsgs] = useState<MessageRow[] | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const v = describeChat(chat, me.id, byId, !!me.msgOff)

  useEffect(() => subscribeMessages(db, chat.id, rows => setMsgs(prev => mergeMessages(prev, rows)), () => onToast('메시지를 불러오지 못했어요')), [db, chat.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // "here" while this is open (what comes in meanwhile counts as read), as the 메시지 tab's room does
  useEffect(() => {
    let beat: ReturnType<typeof setInterval> | undefined
    let here = false
    const enter = () => { if (here) return; here = true; markHere(db, me.id, chat.id).catch(() => {}); beat = setInterval(() => markHere(db, me.id, chat.id).catch(() => {}), HEARTBEAT_MS) }
    const leave = () => { if (!here) return; here = false; clearInterval(beat); markGone(db, me.id, chat.id).catch(() => {}) }
    const sync = () => (document.visibilityState === 'visible' ? enter() : leave())
    sync()
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('pagehide', leave)
    return () => { document.removeEventListener('visibilitychange', sync); window.removeEventListener('pagehide', leave); leave() }
  }, [db, chat.id, me.id])
  useEffect(() => { if (chat.last && document.visibilityState === 'visible') noteRead(chat.id, chat.last.at?.toMillis() ?? Date.now()) }, [chat.id, chat.last?.at]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight }, [msgs?.length])

  const send = async () => {
    const t = draft.trim()
    if (!t || busy) return
    setBusy(true)
    try { await sendMessage(db, me.id, chat.id, t.slice(0, MAX_TEXT)); setDraft('') } catch { onToast('보내지 못했어요') } finally { setBusy(false) }
  }
  const sendPhoto = async (f: File | undefined) => {
    if (!f) return
    setBusy(true)
    try { await sendImage(db, me.id, chat.id, await fileToChatImage(f)) } catch { onToast('사진을 보내지 못했어요') } finally { setBusy(false) }
  }

  const peer = v.people[0]
  const rows = msgs ?? []
  return (
    <div style={css('position:absolute;inset:0;z-index:25;background:#fff;color:#000;display:flex;flex-direction:column')}>
      <header style={css('flex:none;display:flex;align-items:center;gap:8px;padding:calc(var(--phone-top,54px) - 30px) 12px 8px;border-bottom:0.5px solid #dbdbdb')}>
        <button aria-label="뒤로" className="pr-96" onClick={onBack} style={css('display:flex;width:36px;height:36px;align-items:center;justify-content:center')}>{back}</button>
        <Face c={chat} me={me.id} byId={byId} size={34} />
        <span style={css('flex:1;min-width:0;display:flex;flex-direction:column')}>
          <b style={css('font-size:15px;line-height:19px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{v.title}</b>
          {chat.type === 'group' && <span style={css('font-size:12px;color:#8e8e93')}>{chat.members.length}명</span>}
        </span>
      </header>
      <div ref={listRef} style={css('flex:1;min-height:0;overflow-y:auto;padding:12px 12px 8px;display:flex;flex-direction:column;gap:3px')}>
        {chat.type === 'dm' && peer && (
          <div style={css('display:flex;flex-direction:column;align-items:center;gap:6px;padding:18px 0 22px')}>
            <Avatar frame={peer.frame} photo={peer.photoCss} size={84} />
            <b style={css('font-size:17px')}>{peer.name}</b>
          </div>
        )}
        {msgs === null && <span style={css('align-self:center;font-size:13px;color:#8e8e93;padding:20px')}>불러오는 중</span>}
        {rows.map((m, i) => {
          if (m.kind === 'system') return <span key={m.id} style={css('align-self:center;max-width:80%;text-align:center;font-size:12px;line-height:17px;color:#8e8e93;padding:8px 0')}>{m.text}</span>
          const mine = m.uid === me.id
          const prev = rows[i - 1], next = rows[i + 1]
          const first = !prev || prev.uid !== m.uid || prev.kind === 'system'
          const last = !next || next.uid !== m.uid || next.kind === 'system'
          const at = m.at?.toMillis()
          const sender = byId.get(m.uid)
          const gap = at && prev?.at && at - prev.at.toMillis() > 3_600_000
          const body = m.kind === 'image' ? <Photo db={db} chatId={chat.id} m={m} /> : (
            <span style={{ ...css('display:block;padding:8px 14px;border-radius:20px;font-size:15px;line-height:20px;white-space:pre-wrap;word-break:break-word'), ...(mine ? css('background:linear-gradient(135deg,#7a3cf0,#3a7bfd);color:#fff') : css('background:#efefef;color:#000')) }}>
              {m.kind === 'gift' || m.kind === 'fake' ? `🎁 ${m.text || '포인트 선물'}` : m.text}
            </span>
          )
          return (
            <div key={m.id}>
              {(gap || i === 0) && at && <div style={css('text-align:center;font-size:11px;color:#8e8e93;padding:10px 0 6px')}>{hhmm(at)}</div>}
              <div style={css('display:flex;align-items:flex-end;gap:8px;' + (mine ? 'justify-content:flex-end' : 'justify-content:flex-start') + (first ? ';margin-top:6px' : ''))}>
                {!mine && (
                  <span style={css('width:28px;flex:none;display:flex')}>
                    {last && <Avatar frame={sender?.frame} photo={sender?.photoCss} size={28} />}
                  </span>
                )}
                <span style={css('max-width:72%;display:flex;flex-direction:column;gap:2px;' + (mine ? 'align-items:flex-end' : 'align-items:flex-start'))}>
                  {!mine && chat.type === 'group' && first && <span style={css('font-size:11px;color:#8e8e93;padding-left:4px')}>{sender?.name ?? ''}</span>}
                  {body}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      {v.canSend ? (
        <div style={css('flex:none;display:flex;align-items:center;gap:8px;padding:8px 12px calc(var(--phone-bottom,34px) - 14px)')}>
          <label style={css('flex:1;min-width:0;display:flex;align-items:center;gap:6px;min-height:44px;padding:0 6px 0 16px;border-radius:22px;border:1px solid #dbdbdb;background:#fff')}>
            <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) send() }} maxLength={MAX_TEXT} placeholder="메시지 보내기..." aria-label="메시지" style={css('flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:16px;color:#000')} />
            {draft.trim()
              ? <button className="pr-96" disabled={busy} onClick={send} style={css('height:34px;padding:0 10px;font-size:15px;font-weight:700;color:#0095f6')}>보내기</button>
              : <button aria-label="사진 보내기" className="pr-96" disabled={busy} onClick={() => fileRef.current?.click()} style={css('display:flex;width:36px;height:36px;align-items:center;justify-content:center;color:#000')}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m4 17 5-4.5 3.5 3L15 13.5l5 4.5" /></svg>
              </button>}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { sendPhoto(e.target.files?.[0]); e.target.value = '' }} />
          </label>
        </div>
      ) : (
        <div style={css('flex:none;padding:12px 16px calc(var(--phone-bottom,34px) - 8px);text-align:center;font-size:13px;color:#8e8e93')}>{v.blockedReason}</div>
      )}
    </div>
  )
}

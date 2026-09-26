import type { User } from 'firebase/auth'
import { doc, updateDoc } from 'firebase/firestore'
import { useEffect, useMemo, useRef, useState } from 'react'
import { authErrorMessage, chooseNewPassword, logIn, logOut, needsNewPassword, onAuthChange, saveLoginId, savedLoginId, signUp } from './backend/auth'
import { deleteAccount, grantPoints, isAdminEmail, renameUser, resetPassword, setSeasonConfig, resetSeason, setSeasonName, subscribeSeason, type AdminProgress } from './backend/admin'
import { buyItem, buyPass, castVote, hasPass, claimAppBonus, equipItem, pointsOf, subscribeCandidates, subscribeMyVote, subscribeMyVotes, updateMyProfile, type CandidateRow } from './backend/candidates'
import { createGroup, inviteMembers, isUnread, leaveGroup, onMyReads, setReadsUser, openDm, sendImage, sendMessage, setChatMuted, setGroupInfo, setMessagesOff, subscribeMyChats, type ChatRow } from './backend/messages'
import { DEFAULT_NOTIFY, saveNotifySettings, subscribeNotifySettings, type NotifySettings as NotifyPrefs } from './backend/push'
import { DEFAULT_OWNED, DEFAULT_SEASON, PASS_PRICE, type MyVote, type Season, type WeekKind } from './backend/types'
import { deviceRegistered, disablePush, enablePush, pushErrorMessage, pushSupport, refreshPush } from './push'
import { fileToChatImage, fileToPhotoDataUrl } from './backend/image'
import { AccountScreen, type LoginForm, type SignupForm } from './components/AccountScreen'
import { AdminProgressOverlay, AdminScreen } from './components/AdminScreen'
import { BottomNav } from './components/BottomNav'
import { EditProfile } from './components/EditProfile'
import { GlassFilters } from './components/GlassFilters'
import { ShopScreen, type ShopTab } from './components/ShopScreen'
import { ChatRoom, MessagesScreen, NewChatSheet } from './components/MessagesScreen'
import { NotifySettings } from './components/NotifySettings'
import { MessageBanner, type Banner } from './components/MessageBanner'
import { SupportFlow, SupportRoom } from './components/SupportScreen'
import { closeTicket, linkTicket, sendSupport, subscribeLinkedTickets, subscribeTicket, subscribeTickets, type Ticket } from './backend/support'
import { markNoticeSeen, nextUnseenNotice, postNotice, subscribeNoticeIndex, type Notice } from './backend/notices'
import { NoticeScreen } from './components/NoticeScreen'
import { cancelGift, claimGift, sendGift } from './backend/gifts'
import { BuyDialog, Dialog, InstallSheet, ProfileSheet, RuleDialog, ThemeSheet, Toast, VoteSheet } from './components/Overlays'
import { RankScreen } from './components/RankScreen'
import { Reveal } from './components/Reveal'
import { css, sx } from './css'
import { BLUE, fmt, KIND_NAME, RED, SKIN_FILES, priceOf, type ItemKind, type Tab } from './data'
import { db as maybeDb, firebaseConfigured } from './firebase'
import { isInstalledApp } from './install'
import { buildPeople } from './model'
import { byRank } from './backend/rank'
import { BOARD_STALE_MS, photoOf, subscribeBoard, subscribeCandidate, type BoardRow } from './backend/board'

export type AppProps = {
  startTab?: Tab
  /** Open this chat on launch (from a notification tap). */
  startChat?: string | null
  /** Admin: open this 상담 on launch (from a notification tap). */
  startSupport?: string | null
  /** Swap vote colours to red = 추천, blue = 비추천. */
  swapPalette?: boolean
}

const db = maybeDb

type Buy = { kind: ItemKind; key: string; label: string; price: number }

const EMPTY_SIGNUP: SignupForm = { name: '', id: '', pw: '', pw2: '' }
const freshLogin = (): LoginForm => ({ id: savedLoginId(), pw: '', keep: true })
/** The TOP 3 reveal pops up for a week after a season ends — not for people joining later. */
const REVEAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

function loadTheme() {
  try { return localStorage.getItem('pv-theme') || 'default' } catch { return 'default' }
}

/** Real backend: Firebase Auth for accounts, Firestore for the live leaderboard/votes/shop. See app/README.md. */
export function App({ startTab = 'rank', startChat = null, startSupport = null, swapPalette = false }: AppProps) {
  const [tab, setTab] = useState<Tab>(startTab)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [sheet, setSheet] = useState<string | null>(null)
  const [profile, setProfile] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const [authUser, setAuthUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  // Leaderboard: the one-doc board (meta/board) plus my own candidate doc live; photos
  // are fetched per version. If the board is missing or stale (worker down), fall back
  // to listening to every candidate doc like before.
  const [board, setBoard] = useState<{ rows: BoardRow[] | null; at: number; server: boolean }>({ rows: null, at: 0, server: false })
  const [fallbackRows, setFallbackRows] = useState<CandidateRow[]>([])
  const [ownRow, setOwnRow] = useState<CandidateRow | null>(null)
  const [photoMap, setPhotoMap] = useState<Record<string, string>>({})
  const [votes, setVotes] = useState<Record<string, MyVote>>({})
  // Re-derives "추천 가능" once a minute so a 7-day wait ends without a reload.
  const [minute, setMinute] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setMinute(Date.now()), 60_000); return () => clearInterval(t) }, [])
  const [season, setSeason] = useState<Season>(DEFAULT_SEASON)

  const [, setPhotoBusy] = useState(false)
  const [bioDraft, setBioDraft] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [shopTab, setShopTab] = useState<ShopTab>('frame')
  const [passAsk, setPassAsk] = useState(false)
  const [buy, setBuy] = useState<Buy | null>(null)

  const [acctView, setAcctView] = useState<'login' | 'signup'>('login')
  const [login, setLogin] = useState<LoginForm>(freshLogin)
  const [signup, setSignup] = useState<SignupForm>(EMPTY_SIGNUP)
  const [nameAck, setNameAck] = useState(false)
  const [ruleOpen, setRuleOpen] = useState(false)
  const [ruleCheck, setRuleCheck] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const [theme, setTheme] = useState(loadTheme)
  const [themeOpen, setThemeOpen] = useState(false)
  const [revealOpen, setRevealOpen] = useState(false)
  const [installOpen, setInstallOpen] = useState(false)
  const [adminBusy, setAdminBusy] = useState<{ label: string; p: AdminProgress } | null>(null)
  const [sound, setSound] = useState(true)
  const [chats, setChats] = useState<ChatRow[]>([])
  const [chatId, setChatId] = useState<string | null>(startChat)
  const [notify, setNotify] = useState<NotifyPrefs>(DEFAULT_NOTIFY)
  const [pushOn, setPushOn] = useState(deviceRegistered)
  const [pushBusy, setPushBusy] = useState(false)
  // 상담 (forgot password): 'new' from 비밀번호를 잊었어요, 'resume' from the 계정 card.
  const [supportOpen, setSupportOpen] = useState<'new' | 'resume' | null>(null)
  const [anonUid, setAnonUid] = useState<string | null>(null)
  const [myTickets, setMyTickets] = useState<Ticket[]>([])
  const [linkedOpen, setLinkedOpen] = useState<string | null>(null)
  const [endAsk, setEndAsk] = useState(false)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [ticketId, setTicketId] = useState<string | null>(startSupport)
  const [mustChangePw, setMustChangePw] = useState(false)
  const [banner, setBanner] = useState<Banner | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [noticeIds, setNoticeIds] = useState<string[]>([])
  const seenLast = useRef<Map<string, number> | null>(null)
  const [newPw, setNewPw] = useState({ a: '', b: '', busy: false })
  const [newChatOpen, setNewChatOpen] = useState(false)

  const toastTimer = useRef<ReturnType<typeof setTimeout>>()
  const showToast = (msg: string) => {
    clearTimeout(toastTimer.current)
    setToast(msg)
    // Long enough to read: ~2s, plus a little per character for longer messages.
    toastTimer.current = setTimeout(() => setToast(''), Math.min(5000, 1800 + msg.length * 45))
  }
  /** Error toast that keeps the Firebase error code visible, so a screenshot is enough to diagnose it. */
  const failToast = (msg: string, e: unknown) => {
    const code = (e as { code?: string })?.code
    // Firebase's free daily limit is used up (it resets at 16:00 KST).
    if (code === 'resource-exhausted') return showToast(`${msg}. 오늘 서버 사용량이 다 찼어요. 오후 4시 이후에 다시 해주세요`)
    showToast(code ? `${msg} (${code})` : msg)
  }

  useEffect(() => { setTab(startTab) }, [startTab])

  // An anonymous login is only for 상담 (forgot password); the app treats it as signed out.
  useEffect(() => onAuthChange(u => { setAuthUser(u && !u.isAnonymous ? u : null); setAnonUid(u?.isAnonymous ? u.uid : null); setAuthReady(true) }), [])
  useEffect(() => (db ? subscribeBoard(db, (rows, at, fromCache) => setBoard(b => ({ rows, at, server: b.server || !fromCache }))) : undefined), [])
  useEffect(() => (db ? subscribeSeason(db, setSeason) : undefined), [])

  // 공지: signed-in people see each new notice full-screen, once.
  useEffect(() => (authUser && db ? subscribeNoticeIndex(db, setNoticeIds) : (setNoticeIds([]), setNotice(null), undefined)), [authUser])
  useEffect(() => {
    if (!authUser || !db || !noticeIds.length || notice) return
    let live = true
    nextUnseenNotice(db, authUser.uid, noticeIds).then(n => { if (live && n) setNotice(n) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, noticeIds])
  const closeNotice = async () => {
    if (!notice || !authUser || !db) return
    await markNoticeSeen(db, authUser.uid, notice.id).catch(e => failToast('저장하지 못했어요', e))
    const next = await nextUnseenNotice(db, authUser.uid, noticeIds.filter(id => id !== notice.id))
    setNotice(next)
  }

  // Logged in with an admin-issued one-time code → choose a new password first. Only
  // checked right after typing a password (or while still pending), not on every launch.
  const justLoggedIn = useRef(false)
  useEffect(() => {
    if (!authUser) { setMustChangePw(false); return }
    let pending = false
    try { pending = localStorage.getItem('pv-mustpw') === authUser.uid } catch { /* private mode */ }
    if (!justLoggedIn.current && !pending) return
    justLoggedIn.current = false
    needsNewPassword(authUser.uid).then(must => {
      setMustChangePw(must)
      try { if (must) localStorage.setItem('pv-mustpw', authUser.uid); else localStorage.removeItem('pv-mustpw') } catch { /* private mode */ }
    })
  }, [authUser])

  useEffect(() => {
    if (!authUser || !db) { setNotify(DEFAULT_NOTIFY); return }
    refreshPush(db, authUser.uid).then(() => setPushOn(deviceRegistered()))
    return subscribeNotifySettings(db, authUser.uid, setNotify)
  }, [authUser])

  useEffect(() => {
    if (!authUser) { setChats([]); setChatId(null); return }
    return db ? subscribeMyChats(db, authUser.uid, setChats, () => {}) : undefined
  }, [authUser])

  // My votes are read only where they're shown: all of them on 계정 (내 투표), otherwise
  // just the one person whose vote sheet or profile is open (1 read, not one per person).
  const voteFocus = sheet ?? profile
  useEffect(() => {
    if (!authUser || !db || tab !== 'acct') return
    return subscribeMyVotes(db, authUser.uid, setVotes)
  }, [authUser, tab])
  useEffect(() => {
    if (!authUser || !db || !voteFocus || tab === 'acct' || voteFocus === authUser.uid) return
    return subscribeMyVote(db, authUser.uid, voteFocus, one => setVotes(v => {
      const next = { ...v }
      if (one) next[voteFocus] = one; else delete next[voteFocus]
      return next
    }))
  }, [authUser, voteFocus, tab])
  useEffect(() => { if (!authUser) setVotes({}) }, [authUser])
  // Chats I mark read on this device update the unread badges right away.
  const [, setReadTick] = useState(0)
  useEffect(() => onMyReads(() => setReadTick(t => t + 1)), [])
  useEffect(() => setReadsUser(authUser?.uid ?? ''), [authUser])

  // Warm the skin images so towers appear together with the bar-grow animation.
  useEffect(() => {
    SKIN_FILES.forEach(f => { const i = new Image(); i.decoding = 'async'; i.src = `skins/${f}.png` })
    return () => clearTimeout(toastTimer.current)
  }, [])

  // Glass theme: pointer-following highlight on the hovered surface, throttled to one update per frame.
  useEffect(() => {
    if (theme !== 'glass') return
    let raf = 0
    const onMove = (e: PointerEvent) => {
      if (raf) return
      raf = requestAnimationFrame(() => { raf = 0 })
      const el = (e.target as Element | null)?.closest?.('[data-g]') as HTMLElement | null
      if (!el) return
      const r = el.getBoundingClientRect()
      if (!r.width) return
      el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%')
      el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%')
    }
    document.addEventListener('pointermove', onMove, { passive: true })
    return () => { document.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf) }
  }, [theme])

  const loggedIn = !!authUser
  // No board yet (first launch, or the worker hasn't written it) or a stale one: read the
  // candidates directly, so people never show up as "(탈퇴한 사람)" in the meantime.
  const boardFallback = !board.rows || (board.server && Date.now() - board.at > BOARD_STALE_MS)
  useEffect(() => (db && boardFallback ? subscribeCandidates(db, setFallbackRows) : undefined), [boardFallback])
  useEffect(() => { setOwnRow(null); return db && authUser ? subscribeCandidate(db, authUser.uid, setOwnRow) : undefined }, [authUser])
  useEffect(() => {
    if (boardFallback || !board.rows || !db) return
    let live = true
    for (const r of board.rows) {
      if (!r.pv || photoMap[r.id + '@' + r.pv] !== undefined) continue
      photoOf(db, r.id, r.pv).then(url => { if (live) setPhotoMap(m => ({ ...m, [r.id + '@' + r.pv]: url })) }).catch(() => {})
    }
    return () => { live = false }
  }, [board.rows, boardFallback]) // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo<CandidateRow[]>(() => {
    const base: CandidateRow[] = boardFallback ? fallbackRows
      : (board.rows ?? []).map(({ pv, ...r }) => ({ ...r, photoURL: pv ? photoMap[r.id + '@' + pv] ?? '' : '' }) as CandidateRow)
    // Until the list itself has loaded, show nothing rather than just me (everyone else would look deleted).
    if (!ownRow || !base.length) return base
    const merged = base.some(r => r.id === ownRow.id) ? base.map(r => (r.id === ownRow.id ? ownRow : r)) : [...base, ownRow]
    return merged.sort(byRank)
  }, [board.rows, boardFallback, fallbackRows, ownRow, photoMap])
  const all = useMemo(() => buildPeople(rows, votes, authUser?.uid ?? null, Date.now()), [rows, votes, authUser, minute]) // eslint-disable-line react-hooks/exhaustive-deps
  const me = authUser ? all.find(d => d.id === authUser.uid) : undefined
  const mine = all.filter(d => d.my && (d.my.ups > 0 || d.my.downs > 0 || d.inWeek))
  const points = me ? pointsOf(me) : 0
  const passActive = hasPass(me)
  const isAdmin = isAdminEmail(authUser?.email)
  const byId = useMemo(() => new Map(all.map(p => [p.id, p])), [all])
  const unreadChats = authUser ? chats.filter(c => isUnread(c, authUser.uid)).length : 0
  const openChat = chats.find(c => c.id === chatId)

  // Opening the chat a popup was about makes the popup go away.
  useEffect(() => { if (banner && chatId === banner.chatId) setBanner(null) }, [chatId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Message popup while the app is open: a new message from someone else in a chat
  // that isn't on screen (and isn't muted, and 새 메시지 알림 is on) drops in from the top.
  useEffect(() => {
    if (!authUser) { seenLast.current = null; return }
    const seen = seenLast.current
    const next = new Map<string, number>()
    let fresh: typeof chats[number] | undefined
    for (const c of chats) {
      const at = c.last?.at?.toMillis() ?? 0
      next.set(c.id, at)
      if (!seen || !c.last || c.last.uid === authUser.uid) continue
      if (at > (seen.get(c.id) ?? 0) && c.id !== chatId && !c.mutes?.[authUser.uid] && (!fresh || at > (fresh.last?.at?.toMillis() ?? 0))) fresh = c
    }
    seenLast.current = next
    if (!fresh || notify.notifyMsg === false) return
    const sender = byId.get(fresh.last!.uid)
    const others = fresh.members.filter(m => m !== authUser.uid)
    const groupTitle = fresh.name || others.map(id => byId.get(id)?.name ?? '').filter(Boolean).join(', ')
    const text = fresh.last!.text || '사진을 보냈어요'
    setBanner({
      key: fresh.id + ':' + (fresh.last!.at?.toMillis() ?? Date.now()),
      chatId: fresh.id,
      title: fresh.type === 'group' ? groupTitle || '단톡방' : sender?.name ?? '새 메시지',
      text: fresh.type === 'group' ? `${sender?.name ?? ''}: ${text}` : text,
      sender, photo: fresh.type === 'group' ? fresh.photo : undefined,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats])
  useEffect(() => { if (tab === 'admin' && !isAdmin && authReady) setTab('rank') }, [tab, isAdmin, authReady])
  useEffect(() => (isAdmin && db ? subscribeTickets(db, setTickets) : setTickets([])), [isAdmin])
  const openTicket = tickets.find(t => t.id === ticketId)
  const ticketAccount = openTicket ? all.find(p => p.loginId && p.loginId === openTicket.loginId) : undefined
  const unreadTickets = tickets.filter(t => t.last?.from === 'user' && !t.adminRead).length

  // My own 상담: the anonymous one (logged out), or ones 상담원 linked to my account after a
  // password reset. It stays on 계정 until 상담원 ends it (and I've seen that it ended).
  useEffect(() => {
    if (!db) return
    if (anonUid) return subscribeTicket(db, anonUid, t => setMyTickets(t ? [t] : []))
    // Only on a device that used 상담 (or opened from a 상담원 reply): nobody else has one.
    let used = false
    try { used = localStorage.getItem('pv-support-used') === '1' || new URLSearchParams(location.search).get('support') === 'mine' } catch { /* private mode */ }
    if (authUser && !isAdmin && used) return subscribeLinkedTickets(db, authUser.uid, setMyTickets)
    setMyTickets([])
  }, [anonUid, authUser, isAdmin])
  const myTicket = myTickets.filter(t => !t.closed || !t.userRead).sort((a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0))[0]
  const linkedTicket = linkedOpen ? myTickets.find(t => t.id === linkedOpen) : undefined
  const supportCard = myTicket && (
    <button className="pr-dim anim-list" onClick={() => (authUser ? setLinkedOpen(myTicket.id) : setSupportOpen('resume'))}
      style={css('width:calc(100% - 32px);margin:0 16px 12px;display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:16px;background:#f2f8ff;text-align:left')}>
      <span style={css('width:40px;height:40px;flex:none;border-radius:9999px;background:#3182f6;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px')}>💬</span>
      <span style={css('flex:1;min-width:0;display:flex;flex-direction:column')}>
        <span style={css('font-size:16px;line-height:24px;font-weight:600;color:#191f28')}>{myTicket.closed ? '상담이 끝났어요' : '상담원과 상담 중이에요'}</span>
        <span style={css('font-size:14px;line-height:21px;color:#4e5968;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{myTicket.last ? (myTicket.last.from === 'admin' ? '상담원: ' : '나: ') + myTicket.last.text : '눌러서 이어서 이야기해요'}</span>
      </span>
      {myTicket.last?.from === 'admin' && !myTicket.userRead && <span style={css('width:8px;height:8px;flex:none;border-radius:9999px;background:#f04452;animation:dotPop 420ms cubic-bezier(0.16,1,0.3,1) both')} />}
    </button>
  )

  // The login id, shown on my profile; older accounts get it saved on their entry too.
  const myLoginId = authUser?.email?.endsWith('@vote.local') ? authUser.email.slice(0, -'@vote.local'.length) : undefined
  useEffect(() => {
    if (me && !me.loginId && myLoginId) updateDoc(doc(db!, 'candidates', me.id), { loginId: myLoginId }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, me?.loginId, myLoginId])

  // 300P for opening the installed app (home-screen app or Galaxy app), once per account.
  const bonusTried = useRef(false)
  useEffect(() => {
    if (!me || me.appBonus || bonusTried.current || !isInstalledApp()) return
    bonusTried.current = true
    claimAppBonus(db!, me.id).then(() => showToast('앱으로 들어와서 300P를 받았어요')).catch(() => { bonusTried.current = false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me])

  // TOP 3 reveal: once per device, right after a season ends (the reset records the final podium).
  const podium = useMemo(() => {
    const top = season.last?.top
    if (!top || top.length < 3) return null
    return top.map(t => {
      const photo = all.find(p => p.id === t.id)?.photoURL
      return { name: t.name, frame: t.frame, photoCss: photo ? `url(${photo})` : 'none', scoreLabel: fmt(t.score) }
    })
  }, [season, all])
  useEffect(() => {
    if (!podium || !season.startedAt) return
    if (Date.now() - season.startedAt.toMillis() > REVEAL_WINDOW_MS) return
    const key = 'vote.revealSeen'
    try { if (Number(localStorage.getItem(key)) >= season.number) return; localStorage.setItem(key, String(season.number)) } catch { return }
    setRevealOpen(true)
  }, [podium, season])

  // The bio textarea keeps its own draft so typing stays instant; it's synced from Firestore only when the signed-in user changes, and written back (debounced) below.
  const lastMeId = useRef<string | null>(null)
  useEffect(() => {
    if (me && me.id !== lastMeId.current) { lastMeId.current = me.id; setBioDraft(me.bio) }
    if (!me) lastMeId.current = null
  }, [me])
  useEffect(() => {
    if (!authUser || !me || bioDraft === me.bio) return
    const t = setTimeout(() => { updateMyProfile(db!, authUser.uid, { bio: bioDraft }).catch(e => failToast('소개를 저장하지 못했어요', e)) }, 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bioDraft])

  const colors = swapPalette
    ? { up: RED, down: BLUE, downWeak: 'rgba(49,130,246,0.16)', downWeakFg: '#1b64da' }
    : { up: BLUE, down: RED, downWeak: 'rgba(244,67,54,0.16)', downWeakFg: '#d22030' }

  const go = (t: Tab) => {
    setTab(t); setSheet(null); setProfile(null); setEditOpen(false)
    window.scrollTo(0, 0)
  }

  /** kind = what this week's vote should become ('none' cancels it). */
  const vote = async (id: string, kind: WeekKind, count?: number) => {
    if (!authUser) return
    const d = all.find(x => x.id === id)
    if (!d) return
    setSheet(null)
    const was = d.weekKind
    try {
      await castVote(db!, authUser.uid, id, kind, count, season.number)
      const label = kind === 'up' ? '추천' : '비추천'
      showToast(count === 2 ? `${d.name}님을 한 번 더 ${label}했어요 (2배권)` : kind === 'none' ? `${d.name}님 투표를 취소했어요` : was !== 'none' ? `${d.name}님 투표를 ${label}으로 바꿨어요` : `${d.name}님을 ${label}했어요`)
    } catch (e) {
      if ((e as Error)?.message === 'vote-too-soon') showToast('이번 주에는 더 바꿀 수 없어요')
      else failToast('투표하지 못했어요. 다시 시도해주세요', e)
    }
  }

  const pickItem = (kind: ItemKind, key: string, label: string) => {
    if (!me) return
    if (me.owned[kind].includes(key)) {
      equipItem(db!, me.id, kind, key).catch(e => failToast('적용하지 못했어요', e))
    } else {
      setBuy({ kind, key, label, price: priceOf(kind, key) })
    }
  }

  const buyName = buy ? buy.label + (KIND_NAME[buy.kind] ? ' ' + KIND_NAME[buy.kind] : '') : ''
  const canBuy = !!buy && points >= buy.price
  const confirmBuy = async () => {
    if (!buy || !canBuy || !me) return
    try {
      await buyItem(db!, me.id, buy.kind, buy.key, buy.price)
      setBuy(null)
      showToast(buyName + ' 적용했어요')
    } catch (e) {
      failToast('구매하지 못했어요. 다시 시도해주세요', e)
    }
  }

  const doLogin = async () => {
    if (authBusy) return
    setAuthBusy(true)
    try {
      justLoggedIn.current = true
      await logIn(login.id.trim(), login.pw, login.keep)
      saveLoginId(login.id.trim())
      setLogin(freshLogin())
      showToast('로그인했어요')
    } catch (e) {
      showToast(authErrorMessage(e))
    } finally {
      setAuthBusy(false)
    }
  }

  const doLogout = async () => {
    // This device stops getting the old account's notifications.
    if (db) await disablePush(db)
    setPushOn(false)
    await logOut()
    setVotes({})
    showToast('로그아웃했어요')
  }

  const doSignup = async () => {
    if (authBusy) return
    setAuthBusy(true)
    try {
      await signUp(signup.name.trim(), signup.id.trim(), signup.pw)
      saveLoginId(signup.id.trim())
      setLogin(freshLogin())
      setAcctView('login')
      setSignup(EMPTY_SIGNUP)
      setNameAck(false)
      showToast('가입했어요. 환영해요!')
    } catch (e) {
      showToast(authErrorMessage(e))
    } finally {
      setAuthBusy(false)
    }
  }

  const sheetPerson = sheet != null ? all.find(d => d.id === sheet) : undefined
  const profilePerson = profile != null ? all.find(d => d.id === profile) : undefined

  const onPhoto = async (f: File) => {
    if (!authUser) return
    setPhotoBusy(true)
    try {
      const dataUrl = await fileToPhotoDataUrl(f)
      await updateMyProfile(db!, authUser.uid, { photoURL: dataUrl })
      showToast('프로필 사진을 바꿨어요')
    } catch (e) {
      failToast('사진을 처리하지 못했어요. 다른 사진으로 시도해주세요', e)
    } finally {
      setPhotoBusy(false)
    }
  }
  const onRemovePhoto = () => {
    if (!authUser) return
    updateMyProfile(db!, authUser.uid, { photoURL: '' }).catch(e => failToast('사진을 지우지 못했어요', e))
  }

  /** Runs an admin op behind the token-progress overlay; true if it finished. */
  const runAdmin = async (label: string, op: (onProgress: (p: AdminProgress) => void) => Promise<void>) => {
    setAdminBusy({ label, p: { batch: 1, batches: 1, verified: 0 } })
    try {
      await op(p => setAdminBusy({ label, p }))
      showToast(`${label}을 마쳤어요`)
      return true
    } catch (e) {
      failToast(`${label}에 실패했어요`, e)
      return false
    } finally {
      setAdminBusy(null)
    }
  }

  const startDm = async (other: string) => {
    if (!authUser) { go('acct'); return }
    try {
      const id = await openDm(db!, authUser.uid, other)
      setProfile(null); setTab('msg'); setChatId(id)
    } catch (e) {
      failToast('채팅방을 열지 못했어요', e)
    }
  }
  const createChat = async (ids: string[], name: string) => {
    if (!authUser) return
    try {
      const id = ids.length === 1 ? await openDm(db!, authUser.uid, ids[0]) : await createGroup(db!, authUser.uid, ids, name)
      setNewChatOpen(false); setChatId(id)
    } catch (e) {
      failToast('채팅방을 만들지 못했어요. 상대가 메시지를 껐을 수 있어요', e)
    }
  }
  const toggleMsgOff = (off: boolean) => {
    if (!authUser) return
    setMessagesOff(db!, authUser.uid, off)
      .then(() => showToast(off ? '메시지를 껐어요' : '메시지를 켰어요'))
      .catch(e => failToast('바꾸지 못했어요', e))
  }

  const togglePush = async (on: boolean) => {
    if (!authUser || !db) return
    setPushBusy(true)
    try {
      if (on) {
        await enablePush(db, authUser.uid)
        await saveNotifySettings(db, authUser.uid, { notify: true })
        showToast('알림을 켰어요')
      } else {
        await disablePush(db)
        showToast('이 기기의 알림을 껐어요')
      }
    } catch (e) {
      showToast(pushErrorMessage(e))
    } finally {
      setPushOn(deviceRegistered())
      setPushBusy(false)
    }
  }

  if (!firebaseConfigured) return <SetupNotice />
  if (!authReady) return <div data-g="app" style={css('width:100%;max-width:430px;min-height:100vh;background:#ffffff')} />

  return (
    <div data-theme={theme} style={css("min-height:100vh;display:flex;justify-content:center;font-family:'Toss Product Sans',Pretendard,'Apple SD Gothic Neo','Noto Sans KR',system-ui,sans-serif;color:#191f28;word-break:keep-all")}>
      <GlassFilters />
      <div data-g="app" style={css('width:100%;max-width:430px;min-height:100vh;background:#ffffff;position:relative;display:flex;flex-direction:column')}>
        <main style={css('flex:1;display:flex;flex-direction:column')}>
          {tab === 'shop' && (
            <ShopScreen
              loggedIn={loggedIn} name={me?.name ?? '내 이름'} bio={me ? bioDraft : ''} photoCss={me?.photoCss ?? 'none'}
              equipped={me ? { frame: me.frame, plate: me.plate, skin: me.skin } : { frame: 'none', plate: 'none', skin: 'none' }}
              owned={me?.owned ?? DEFAULT_OWNED} points={points} tab={shopTab} onTab={setShopTab}
              onPick={(k, key, l) => (me ? pickItem(k, key, l) : go('acct'))}
              passActive={passActive} onBuyPass={() => setPassAsk(true)} onLogin={() => go('acct')}
            />
          )}
          {tab === 'rank' && (
            <RankScreen
              all={all} query={query} onQuery={q => { setQuery(q); setPage(0) }}
              page={page} onPage={setPage} onOpenProfile={setProfile}
              seasonName={season.name} seasonEndsAt={season.endsAt?.toMillis()} points={me ? points : undefined}
              onPoints={() => go('shop')} onInstall={() => setInstallOpen(true)}
            />
          )}
          {tab === 'acct' && (
            <AccountScreen
              loggedIn={loggedIn}
              view={acctView}
              onView={setAcctView}
              login={login}
              onLoginField={patch => setLogin(s => ({ ...s, ...patch }))}
              onLogin={doLogin}
              onLogout={doLogout}
              signup={signup}
              onSignup={patch => setSignup(s => ({ ...s, ...patch }))}
              nameAck={nameAck}
              nameRef={nameRef}
              onNameFocus={el => { if (!nameAck) { el.blur(); setRuleOpen(true); setRuleCheck(false) } }}
              onSubmitSignup={doSignup}
              authBusy={authBusy}
              isAdmin={isAdmin}
              goAdmin={() => go('admin')}
              me={me ? { ...me, bio: bioDraft, loginId: me.loginId ?? myLoginId } : undefined}
              onPhoto={onPhoto}
              onRemovePhoto={onRemovePhoto}
              onBio={v => setBioDraft(v.slice(0, 60))}
              onGender={g => authUser && updateMyProfile(db!, authUser.uid, { gender: g }).catch(e => failToast('저장하지 못했어요', e))}
              points={points}
              mine={mine}
              onOpenVote={d => setSheet(d.id)}
              openEdit={() => setEditOpen(true)}
              openTheme={() => setThemeOpen(true)}
              goHome={() => go('rank')}
              onForgot={() => setSupportOpen('new')}
              supportSlot={supportCard}
              notifySlot={
                <NotifySettings
                  support={pushSupport()} on={pushOn && notify.notify} busy={pushBusy} settings={notify}
                  onToggle={togglePush}
                  onChange={patch => authUser && saveNotifySettings(db!, authUser.uid, patch).catch(e => failToast('저장하지 못했어요', e))}
                />
              }
            />
          )}
          {tab === 'msg' && (
            <MessagesScreen
              loggedIn={loggedIn} me={me} chats={chats} byId={byId}
              onLogin={() => go('acct')} onOpen={setChatId} onNew={() => setNewChatOpen(true)} onToggleOff={toggleMsgOff}
            />
          )}
          {tab === 'admin' && isAdmin && authUser && (
            <AdminScreen
              all={all}
              tickets={tickets}
              onOpenTicket={setTicketId}
              postNotice={async (t, b, p) => {
                const id = await postNotice(db!, authUser.uid, t, b, p)
                // You wrote it — no need to show it back to you full-screen.
                await markNoticeSeen(db!, authUser.uid, id).catch(() => {})
              }}
              setSeasonConfig={(e, r, p) => setSeasonConfig(db!, authUser.uid, e, r, p)}
              season={season}
              run={runAdmin}
              grantPoints={(t, n, p) => grantPoints(db!, authUser.uid, t, n, p)}
              setSeasonName={(n, p) => setSeasonName(db!, authUser.uid, n, p)}
              resetSeason={(n, p) => resetSeason(db!, authUser.uid, n, p)}
              renameUser={(t, n, p) => renameUser(db!, authUser.uid, t, n, p)}
              resetPassword={(t, p) => resetPassword(db!, authUser.uid, t, p)}
              deleteAccount={(t, p) => deleteAccount(db!, authUser.uid, t, p)}
              onLogout={doLogout}
            />
          )}
        </main>

        <BottomNav tab={tab === 'admin' && !isAdmin ? 'rank' : tab} onGo={go} isAdmin={isAdmin} unread={unreadChats} adminUnread={unreadTickets} />

        {sheetPerson && (
          <VoteSheet d={sheetPerson} loggedIn={loggedIn} colors={colors} onVote={(kind, n) => vote(sheetPerson.id, kind, n)} onClose={() => setSheet(null)} onLogin={() => go('acct')} pass={passActive} onShop={() => { setShopTab('pass'); go('shop') }} />
        )}
        {ruleOpen && (
          <RuleDialog
            checked={ruleCheck}
            onToggle={() => setRuleCheck(c => !c)}
            onNudge={() => showToast('규칙을 읽고 체크해주세요')}
            onConfirm={() => { setRuleOpen(false); setNameAck(true); requestAnimationFrame(() => nameRef.current?.focus()) }}
          />
        )}
        {themeOpen && (
          <ThemeSheet
            theme={theme}
            onClose={() => setThemeOpen(false)}
            onPick={(k, l) => {
              try { localStorage.setItem('pv-theme', k) } catch { /* private mode */ }
              setTheme(k); setThemeOpen(false); showToast(l + ' 테마로 바꿨어요')
            }}
          />
        )}
        {editOpen && me && (
          <EditProfile
            bio={bioDraft} photoCss={me.photoCss} equipped={{ frame: me.frame, plate: me.plate, skin: me.skin }} points={points}
            onShop={() => go('shop')} onClose={() => setEditOpen(false)}
            gender={me.gender} onPhoto={onPhoto} onBio={v => setBioDraft(v.slice(0, 60))}
            onGender={g => authUser && updateMyProfile(db!, authUser.uid, { gender: g }).catch(e => failToast('저장하지 못했어요', e))}
          />
        )}
        {buy && (
          <BuyDialog
            b={{
              title: buyName + '을 살까요?',
              desc: canBuy ? '사면 바로 내 프로필에 적용돼요' : '받은 추천이 더 쌓이면 살 수 있어요',
              price: buy.price.toLocaleString() + 'P',
              remain: (points - buy.price).toLocaleString() + 'P',
              can: canBuy,
              cta: canBuy ? buy.price.toLocaleString() + 'P로 사기' : '포인트가 부족해요',
            }}
            onClose={() => setBuy(null)}
            onConfirm={confirmBuy}
          />
        )}
        {passAsk && me && (
          <BuyDialog
            b={{
              title: '투표 2배권을 살까요?',
              desc: points >= PASS_PRICE ? '한 번 사면 계속, 한 사람에게 일주일에 두 번까지 투표할 수 있어요' : '포인트가 더 쌓이면 살 수 있어요',
              price: PASS_PRICE.toLocaleString() + 'P',
              remain: (points - PASS_PRICE).toLocaleString() + 'P',
              can: points >= PASS_PRICE,
              cta: points >= PASS_PRICE ? PASS_PRICE.toLocaleString() + 'P로 사기' : '포인트가 부족해요',
            }}
            onClose={() => setPassAsk(false)}
            onConfirm={async () => {
              if (points < PASS_PRICE) return
              try { await buyPass(db!, me.id); setPassAsk(false); showToast('투표 2배권을 샀어요. 이제 한 사람에게 일주일에 두 번 투표할 수 있어요') }
              catch (e) { failToast('사지 못했어요. 다시 시도해주세요', e) }
            }}
          />
        )}
        {revealOpen && podium && (
          <Reveal top={podium} seasonName={season.last!.name} sound={sound} onToggleSound={() => setSound(s => !s)} onClose={() => setRevealOpen(false)} />
        )}
        {newChatOpen && me && <NewChatSheet me={me} all={all} onClose={() => setNewChatOpen(false)} onCreate={createChat} />}
        {openChat && me && authUser && (
          <ChatRoom
            // A different chat (e.g. tapping a new-message banner while in a room) is a fresh
            // room: without the key the old room's messages stayed and mixed with the new ones.
            key={openChat.id}
            canTimeout={isAdmin}
            db={db!} chat={openChat} me={me} all={all} byId={byId}
            onOpenProfile={setProfile}
            myPoints={points}
            onToast={showToast}
            onSendGift={async amount => {
              try { await sendGift(db!, authUser.uid, openChat, amount); showToast(`${amount.toLocaleString()}P를 선물했어요`); return true } catch (e) { failToast('선물하지 못했어요', e); return false }
            }}
            onClaimGift={id => claimGift(db!, authUser.uid, id).then(() => showToast('선물을 받았어요')).catch(e => (e as Error)?.message === 'gift-gone' ? showToast('이미 다른 사람이 받았거나 취소된 선물이에요') : failToast('받지 못했어요', e))}
            onCancelGift={id => cancelGift(db!, authUser.uid, id).then(() => showToast('선물을 취소했어요. 포인트가 돌아왔어요')).catch(e => (e as Error)?.message === 'gift-gone' ? showToast('이미 받은 선물이라 취소할 수 없어요') : failToast('취소하지 못했어요', e))}
            onSendImage={async file => {
              try { await sendImage(db!, authUser.uid, openChat.id, await fileToChatImage(file)); return true } catch (e) { failToast('사진을 보내지 못했어요', e); return false }
            }}
            onInvite={async ids => {
              const names = ids.map(id => byId.get(id)?.name ?? '').filter(Boolean).join(', ')
              try { await inviteMembers(db!, authUser.uid, openChat.id, ids, `${me.name}님이 ${names}님을 초대했어요`); showToast('초대했어요'); return true } catch (e) { failToast('초대하지 못했어요. 상대가 메시지를 껐을 수 있어요', e); return false }
            }}
            onGroupInfo={async ({ photoFile, name }) => {
              try {
                if (photoFile) await setGroupInfo(db!, openChat.id, { photo: await fileToPhotoDataUrl(photoFile, 256, 0.8), name: openChat.name })
                else await setGroupInfo(db!, openChat.id, { name: name ?? '' })
                showToast(photoFile ? '채팅방 사진을 바꿨어요' : '채팅방 이름을 바꿨어요'); return true
              } catch (e) { failToast('바꾸지 못했어요', e); return false }
            }}
            onBack={() => setChatId(null)}
            onError={failToast}
            onSend={async (text, replyTo) => {
              try { await sendMessage(db!, authUser.uid, openChat.id, text, replyTo); return true } catch (e) { failToast('보내지 못했어요', e); return false }
            }}
            onMute={muted => {
              setChatMuted(db!, authUser.uid, openChat.id, muted)
                .then(() => showToast(muted ? '이 채팅방 알림을 껐어요' : '이 채팅방 알림을 켰어요'))
                .catch(e => failToast('바꾸지 못했어요', e))
            }}
            onLeave={async () => {
              try { await leaveGroup(db!, authUser.uid, openChat.id); setChatId(null); showToast('채팅방에서 나왔어요') } catch (e) { failToast('나가지 못했어요', e) }
            }}
          />
        )}
        {profilePerson && (
          // Above an open chat room too (tapping someone in a chat opens their profile).
          <div style={css('position:relative;z-index:300')}>
          <ProfileSheet
            d={profilePerson.isMe ? { ...profilePerson, bio: bioDraft, loginId: profilePerson.loginId ?? myLoginId } : profilePerson}
            onClose={() => setProfile(null)}
            canMessage={!profilePerson.msgOff && !me?.msgOff}
            onMessage={() => startDm(profilePerson.id)}
            onCta={() => {
              setProfile(null)
              // Vote right here (the vote sheet opens over the current tab, e.g. 랭킹).
              if (profilePerson.isMe) { setChatId(null); setTab('acct'); setEditOpen(true) } else setSheet(profilePerson.id)
            }}
          />
          </div>
        )}
        {supportOpen && db && (
          <SupportFlow db={db} loginId={login.id} resume={supportOpen === 'resume'} onClose={() => setSupportOpen(null)} onError={failToast} />
        )}
        {linkedTicket && authUser && db && (
          <SupportRoom
            db={db} ticketUid={linkedTicket.id} as="user" exists title="상담원" subtitle="상담원이 끝낼 때까지 여기에서 이어갈 수 있어요"
            closed={!!linkedTicket.closed} onBack={() => setLinkedOpen(null)} onError={failToast}
          />
        )}
        {openTicket && isAdmin && authUser && db && (
          <SupportRoom
            db={db} ticketUid={openTicket.id} as="admin" exists
            title={`${openTicket.name || '이름 없음'} @${openTicket.loginId || '?'}`}
            subtitle={ticketAccount ? `가입한 계정이 있어요 · ${ticketAccount.name}` : '이 아이디로 가입한 계정을 찾지 못했어요'}
            onBack={() => setTicketId(null)} onError={failToast} closed={!!openTicket.closed}
            headerAction={!openTicket.closed && (
              <button className="pr-96" onClick={() => setEndAsk(true)} style={css('flex:none;height:36px;padding:0 12px;margin-right:4px;border-radius:10px;background:#fff0f1;color:#e42939;font-size:14px;font-weight:600')}>상담 끝내기</button>
            )}
            tools={ticketAccount && !openTicket.closed && (
              <div style={css('flex:none;margin:0 16px 8px;padding:12px 14px;border-radius:14px;background:#f9fafb;display:flex;align-items:center;gap:10px')}>
                <span style={css('flex:1;min-width:0;font-size:13px;line-height:19.5px;color:#4e5968')}>본인이 맞으면 임시 비밀번호를 보내요. 그 번호로 로그인하면 새 비밀번호를 정해요</span>
                <button className="pr-96" onClick={async () => {
                  let code = ''
                  const ok = await runAdmin('비밀번호 초기화', async p => { code = await resetPassword(db, authUser.uid, ticketAccount.id, p) })
                  if (ok && code) await linkTicket(db, openTicket.id, ticketAccount.id).catch(() => {})
                  if (ok && code) await sendSupport(db, openTicket.id, 'admin', `임시 비밀번호는 ${code}이에요. 아이디 ${ticketAccount.loginId}와 이 번호로 로그인하면 새 비밀번호를 정할 수 있어요. 1분쯤 뒤에 로그인해주세요.`, { exists: true }).catch(e => failToast('안내를 보내지 못했어요', e))
                }} style={css('flex:none;height:36px;padding:0 12px;border-radius:10px;background:#e8f3ff;color:#1b64da;font-size:14px;font-weight:600')}>비밀번호 초기화</button>
              </div>
            )}
          />
        )}
        {endAsk && openTicket && db && (
          <Dialog onScrim={() => setEndAsk(false)} gap={20}>
            <div style={css('padding:0 4px;display:flex;flex-direction:column;gap:8px')}>
              <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>상담을 끝낼까요?</span>
              <span style={css('font-size:15px;line-height:22.5px;color:#4e5968')}>{openTicket.name || '이 사람'}님 계정 탭에서 상담이 사라지고, 더 이상 메시지를 보낼 수 없어요</span>
            </div>
            <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:8px')}>
              <button data-g="secondary" className="pr-96" onClick={() => setEndAsk(false)} style={css('height:54px;border-radius:16px;background:#f2f4f6;color:#4e5968;font-size:17px;font-weight:600')}>닫기</button>
              <button className="pr-96" onClick={() => { setEndAsk(false); closeTicket(db, openTicket.id).then(() => showToast('상담을 끝냈어요')).catch(e => failToast('상담을 끝내지 못했어요', e)) }}
                style={css('height:54px;border-radius:16px;background:#f04452;color:#ffffff;font-size:17px;font-weight:600')}>끝내기</button>
            </div>
          </Dialog>
        )}
        {mustChangePw && authUser && (
          <Dialog onScrim={() => {}} gap={20}>
            <div style={css('padding:0 4px;display:flex;flex-direction:column;gap:12px')}>
              <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>새 비밀번호를 정해주세요</span>
              <span style={css('font-size:15px;line-height:22.5px;color:#4e5968')}>임시 비밀번호로 로그인했어요. 앞으로 쓸 비밀번호를 적어주세요</span>
              <input type="password" autoComplete="new-password" className="box-focus" value={newPw.a} onChange={e => setNewPw(s => ({ ...s, a: e.target.value }))} placeholder="8자 이상" style={css('height:48px;border:0;outline:none;border-radius:14px;background-color:#f2f4f6;padding:0 14px;font-size:17px;color:#191f28')} />
              <input type="password" autoComplete="new-password" className="box-focus" value={newPw.b} onChange={e => setNewPw(s => ({ ...s, b: e.target.value }))} placeholder="한 번 더 입력" style={css('height:48px;border:0;outline:none;border-radius:14px;background-color:#f2f4f6;padding:0 14px;font-size:17px;color:#191f28')} />
              {newPw.b.length > 0 && newPw.a !== newPw.b && <span style={css('font-size:13px;color:#f04452;font-weight:600')}>비밀번호가 서로 달라요</span>}
            </div>
            <button data-g="primary" className="pr-96" disabled={newPw.a.length < 8 || newPw.a !== newPw.b || newPw.busy}
              onClick={async () => {
                setNewPw(s => ({ ...s, busy: true }))
                try { await chooseNewPassword(newPw.a); try { localStorage.removeItem('pv-mustpw') } catch { /* private mode */ } setMustChangePw(false); setNewPw({ a: '', b: '', busy: false }); showToast('새 비밀번호로 바꿨어요') }
                catch (e) { setNewPw(s => ({ ...s, busy: false })); failToast('바꾸지 못했어요', e) }
              }}
              style={sx('height:54px;border-radius:16px;background:#3182f6;color:#fff;font-size:17px;font-weight:600;transition:opacity 200ms', { opacity: newPw.a.length >= 8 && newPw.a === newPw.b && !newPw.busy ? 1 : 0.3 })}>바꾸기</button>
          </Dialog>
        )}
        {installOpen && <InstallSheet onClose={() => setInstallOpen(false)} onToast={showToast} />}
        {adminBusy && <AdminProgressOverlay label={adminBusy.label} p={adminBusy.p} />}
        {notice && authUser && !mustChangePw && <NoticeScreen notice={notice} onDone={closeNotice} />}
        {banner && <MessageBanner banner={banner} onDone={() => setBanner(null)} onOpen={id => { setProfile(null); setSheet(null); setTab('msg'); setChatId(id) }} />}
        {toast && <Toast msg={toast} />}
      </div>
      {/* Sheets and dialogs portal here (see Overlays.tsx) so they're never inside an animated screen. */}
      <div id="overlay-root" />
    </div>
  )
}

function SetupNotice() {
  return (
    <div style={css('min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px;background:#f2f4f6;font-family:Pretendard,system-ui,sans-serif')}>
      <div style={css('max-width:420px;display:flex;flex-direction:column;gap:12px;text-align:center')}>
        <span style={css('font-size:20px;font-weight:700;color:#191f28')}>Firebase 설정이 필요해요</span>
        <span style={css('font-size:15px;line-height:22.5px;color:#4e5968')}>
          이 앱은 로그인·투표·랭킹을 Firebase(Auth + Firestore)로 저장해요. 아직 <code>VITE_FIREBASE_*</code> 환경 변수가 설정되지 않아 화면을 열 수 없어요. <code>app/README.md</code>의 안내대로 Firebase 프로젝트를 연결해주세요.
        </span>
      </div>
    </div>
  )
}

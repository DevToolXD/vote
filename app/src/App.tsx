import type { User } from 'firebase/auth'
import { useEffect, useMemo, useRef, useState } from 'react'
import { authErrorMessage, logIn, logOut, onAuthChange, saveLoginId, savedLoginId, signUp } from './backend/auth'
import { deleteAccount, grantPoints, isAdminEmail, renameUser, resetSeason, setSeasonName, subscribeSeason, type AdminProgress } from './backend/admin'
import { buyItem, castVote, equipItem, pointsOf, subscribeCandidates, subscribeMyVotes, updateMyProfile, type CandidateRow } from './backend/candidates'
import { createGroup, isUnread, leaveGroup, openDm, sendMessage, setChatMuted, setMessagesOff, subscribeMyChats, type ChatRow } from './backend/messages'
import { DEFAULT_NOTIFY, saveNotifySettings, subscribeNotifySettings, type NotifySettings as NotifyPrefs } from './backend/push'
import { DEFAULT_SEASON, type MyVote, type Season } from './backend/types'
import { deviceRegistered, disablePush, enablePush, pushErrorMessage, pushSupport, refreshPush } from './push'
import { fileToPhotoDataUrl } from './backend/image'
import { AccountScreen, type LoginForm, type SignupForm } from './components/AccountScreen'
import { AdminProgressOverlay, AdminScreen } from './components/AdminScreen'
import { BottomNav } from './components/BottomNav'
import { EditProfile } from './components/EditProfile'
import { GlassFilters } from './components/GlassFilters'
import { HomeScreen } from './components/HomeScreen'
import { ChatRoom, MessagesScreen, NewChatSheet } from './components/MessagesScreen'
import { NotifySettings } from './components/NotifySettings'
import { BuyDialog, InstallSheet, ProfileSheet, RuleDialog, ThemeSheet, Toast, VoteSheet } from './components/Overlays'
import { RankScreen } from './components/RankScreen'
import { Reveal } from './components/Reveal'
import { css } from './css'
import { BLUE, fmt, KIND_NAME, RED, SKIN_FILES, priceOf, type ItemKind, type Tab } from './data'
import { db as maybeDb, firebaseConfigured } from './firebase'
import { buildPeople } from './model'

export type AppProps = {
  startTab?: Tab
  /** Open this chat on launch (from a notification tap). */
  startChat?: string | null
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
export function App({ startTab = 'home', startChat = null, swapPalette = false }: AppProps) {
  const [tab, setTab] = useState<Tab>(startTab)
  const [homeQuery, setHomeQuery] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [sheet, setSheet] = useState<string | null>(null)
  const [profile, setProfile] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const [authUser, setAuthUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [rows, setRows] = useState<CandidateRow[]>([])
  const [votes, setVotes] = useState<Record<string, MyVote>>({})
  // Re-derives "추천 가능" once a minute so a 7-day wait ends without a reload.
  const [minute, setMinute] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setMinute(Date.now()), 60_000); return () => clearInterval(t) }, [])
  const [season, setSeason] = useState<Season>(DEFAULT_SEASON)

  const [, setPhotoBusy] = useState(false)
  const [bioDraft, setBioDraft] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editTab, setEditTab] = useState<ItemKind>('frame')
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
  const [newChatOpen, setNewChatOpen] = useState(false)

  const toastTimer = useRef<ReturnType<typeof setTimeout>>()
  const showToast = (msg: string) => {
    clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(''), 2000)
  }
  /** Error toast that keeps the Firebase error code visible, so a screenshot is enough to diagnose it. */
  const failToast = (msg: string, e: unknown) => {
    const code = (e as { code?: string })?.code
    showToast(code ? `${msg} (${code})` : msg)
  }

  useEffect(() => { setTab(startTab) }, [startTab])

  useEffect(() => onAuthChange(u => { setAuthUser(u); setAuthReady(true) }), [])
  useEffect(() => (db ? subscribeCandidates(db, setRows) : undefined), [])
  useEffect(() => (db ? subscribeSeason(db, setSeason) : undefined), [])

  useEffect(() => {
    if (!authUser || !db) { setNotify(DEFAULT_NOTIFY); return }
    refreshPush(db, authUser.uid).then(() => setPushOn(deviceRegistered()))
    return subscribeNotifySettings(db, authUser.uid, setNotify)
  }, [authUser])

  useEffect(() => {
    if (!authUser) { setChats([]); setChatId(null); return }
    return db ? subscribeMyChats(db, authUser.uid, setChats, () => {}) : undefined
  }, [authUser])

  useEffect(() => {
    if (!authUser) { setVotes({}); return }
    return db ? subscribeMyVotes(db, authUser.uid, setVotes) : undefined
  }, [authUser])

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
  const all = useMemo(() => buildPeople(rows, votes, authUser?.uid ?? null, Date.now()), [rows, votes, authUser, minute]) // eslint-disable-line react-hooks/exhaustive-deps
  const me = authUser ? all.find(d => d.id === authUser.uid) : undefined
  const mine = all.filter(d => d.my && (d.my.ups > 0 || d.my.downs > 0 || !d.upReady || !d.downReady))
  const points = me ? pointsOf(me) : 0
  const isAdmin = isAdminEmail(authUser?.email)
  const byId = useMemo(() => new Map(all.map(p => [p.id, p])), [all])
  const unreadChats = authUser ? chats.filter(c => isUnread(c, authUser.uid)).length : 0
  const openChat = chats.find(c => c.id === chatId)
  useEffect(() => { if (tab === 'admin' && !isAdmin) setTab('home') }, [tab, isAdmin])

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

  const vote = async (id: string, kind: 'up' | 'down') => {
    if (!authUser) return
    const d = all.find(x => x.id === id)
    if (!d) return
    setSheet(null)
    try {
      await castVote(db!, authUser.uid, id, kind)
      showToast(kind === 'up' ? `${d.name}님을 추천했어요` : `${d.name}님을 비추천했어요`)
    } catch (e) {
      const m = (e as Error)?.message
      if (m === 'vote-too-soon') showToast(`${kind === 'up' ? '추천' : '비추천'}은 7일마다 한 번 할 수 있어요`)
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
          {tab === 'home' && (
            <HomeScreen
              all={all} loggedIn={loggedIn} query={homeQuery} onQuery={setHomeQuery} onPick={setSheet}
              goRank={() => go('rank')} goAccount={() => go('acct')} onInstall={() => setInstallOpen(true)} myCount={mine.length} seasonName={season.name}
            />
          )}
          {tab === 'rank' && (
            <RankScreen
              all={all} query={query} onQuery={q => { setQuery(q); setPage(0) }}
              page={page} onPage={setPage} onOpenProfile={setProfile}
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
              me={me ? { ...me, bio: bioDraft } : undefined}
              onPhoto={onPhoto}
              onRemovePhoto={onRemovePhoto}
              onBio={v => setBioDraft(v.slice(0, 60))}
              onGender={g => authUser && updateMyProfile(db!, authUser.uid, { gender: g }).catch(e => failToast('저장하지 못했어요', e))}
              points={points}
              mine={mine}
              onOpenVote={d => { setTab('home'); setSheet(d.id) }}
              openEdit={() => setEditOpen(true)}
              openTheme={() => setThemeOpen(true)}
              goHome={() => go('home')}
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
              season={season}
              run={runAdmin}
              grantPoints={(t, n, p) => grantPoints(db!, authUser.uid, t, n, p)}
              setSeasonName={(n, p) => setSeasonName(db!, authUser.uid, n, p)}
              resetSeason={(n, p) => resetSeason(db!, authUser.uid, n, p)}
              renameUser={(t, n, p) => renameUser(db!, authUser.uid, t, n, p)}
              deleteAccount={(t, p) => deleteAccount(db!, authUser.uid, t, p)}
              onLogout={doLogout}
            />
          )}
        </main>

        <BottomNav tab={tab === 'admin' && !isAdmin ? 'home' : tab} onGo={go} isAdmin={isAdmin} unread={unreadChats} />

        {sheetPerson && (
          <VoteSheet d={sheetPerson} loggedIn={loggedIn} colors={colors} onVote={kind => vote(sheetPerson.id, kind)} onClose={() => setSheet(null)} onLogin={() => go('acct')} />
        )}
        {profilePerson && (
          <ProfileSheet
            d={profilePerson.isMe ? { ...profilePerson, bio: bioDraft } : profilePerson}
            onClose={() => setProfile(null)}
            canMessage={!profilePerson.msgOff && !me?.msgOff}
            onMessage={() => startDm(profilePerson.id)}
            onCta={() => {
              setProfile(null)
              if (profilePerson.isMe) { setTab('acct'); setEditOpen(true) } else { setTab('home'); setSheet(profilePerson.id) }
            }}
          />
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
            name={me.name} bio={bioDraft} photoCss={me.photoCss} equipped={{ frame: me.frame, plate: me.plate, skin: me.skin }} owned={me.owned} points={points}
            tab={editTab} onTab={setEditTab} onPick={pickItem} onClose={() => setEditOpen(false)}
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
        {revealOpen && podium && (
          <Reveal top={podium} seasonName={season.last!.name} sound={sound} onToggleSound={() => setSound(s => !s)} onClose={() => setRevealOpen(false)} />
        )}
        {newChatOpen && me && <NewChatSheet me={me} all={all} onClose={() => setNewChatOpen(false)} onCreate={createChat} />}
        {openChat && me && authUser && (
          <ChatRoom
            db={db!} chat={openChat} me={me} byId={byId}
            onBack={() => setChatId(null)}
            onError={failToast}
            onSend={async text => {
              try { await sendMessage(db!, authUser.uid, openChat.id, text); return true } catch (e) { failToast('보내지 못했어요', e); return false }
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
        {installOpen && <InstallSheet onClose={() => setInstallOpen(false)} onToast={showToast} />}
        {adminBusy && <AdminProgressOverlay label={adminBusy.label} p={adminBusy.p} />}
        {toast && <Toast msg={toast} />}
      </div>
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

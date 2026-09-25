import type { User } from 'firebase/auth'
import { useEffect, useMemo, useRef, useState } from 'react'
import { authErrorMessage, logIn, logOut, onAuthChange, signUp } from './backend/auth'
import { buyItem, castVote, equipItem, subscribeCandidates, subscribeMyVotes, updateMyProfile, type CandidateRow } from './backend/candidates'
import { fileToPhotoDataUrl } from './backend/image'
import { AccountScreen, type LoginForm, type SignupForm } from './components/AccountScreen'
import { BottomNav } from './components/BottomNav'
import { EditProfile } from './components/EditProfile'
import { GlassFilters } from './components/GlassFilters'
import { HomeScreen } from './components/HomeScreen'
import { BuyDialog, ProfileSheet, RuleDialog, ThemeSheet, Toast, VoteSheet } from './components/Overlays'
import { RankScreen } from './components/RankScreen'
import { Reveal } from './components/Reveal'
import { css } from './css'
import { BLUE, KIND_NAME, RED, SKIN_FILES, priceOf, type ItemKind, type Tab, type Vote } from './data'
import { firebaseConfigured } from './firebase'
import { buildPeople } from './model'

export type AppProps = {
  startTab?: Tab
  /** Swap vote colours to red = 추천, blue = 비추천. */
  swapPalette?: boolean
}

type Buy = { kind: ItemKind; key: string; label: string; price: number }

const EMPTY_SIGNUP: SignupForm = { name: '', id: '', pw: '', pw2: '' }
const EMPTY_LOGIN: LoginForm = { id: '', pw: '' }

function loadTheme() {
  try { return localStorage.getItem('pv-theme') || 'default' } catch { return 'default' }
}

/** Real backend: Firebase Auth for accounts, Firestore for the live leaderboard/votes/shop. See app/README.md. */
export function App({ startTab = 'home', swapPalette = false }: AppProps) {
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
  const [votes, setVotes] = useState<Record<string, Vote>>({})

  const [, setPhotoBusy] = useState(false)
  const [bioDraft, setBioDraft] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editTab, setEditTab] = useState<ItemKind>('frame')
  const [buy, setBuy] = useState<Buy | null>(null)

  const [acctView, setAcctView] = useState<'login' | 'signup'>('login')
  const [login, setLogin] = useState<LoginForm>(EMPTY_LOGIN)
  const [signup, setSignup] = useState<SignupForm>(EMPTY_SIGNUP)
  const [nameAck, setNameAck] = useState(false)
  const [ruleOpen, setRuleOpen] = useState(false)
  const [ruleCheck, setRuleCheck] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const [theme, setTheme] = useState(loadTheme)
  const [themeOpen, setThemeOpen] = useState(false)
  const [revealOpen, setRevealOpen] = useState(false)
  const [sound, setSound] = useState(true)

  const toastTimer = useRef<ReturnType<typeof setTimeout>>()
  const showToast = (msg: string) => {
    clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(''), 2000)
  }

  useEffect(() => { setTab(startTab) }, [startTab])

  useEffect(() => onAuthChange(u => { setAuthUser(u); setAuthReady(true) }), [])
  useEffect(() => subscribeCandidates(setRows), [])
  useEffect(() => {
    if (!authUser) { setVotes({}); return }
    return subscribeMyVotes(authUser.uid, setVotes)
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
  const all = useMemo(() => buildPeople(rows, votes, authUser?.uid ?? null), [rows, votes, authUser])
  const me = authUser ? all.find(d => d.id === authUser.uid) : undefined
  const mine = all.filter(d => d.v !== 0)
  const points = me ? me.up - me.spent : 0

  // The bio textarea keeps its own draft so typing stays instant; it's synced from Firestore only when the signed-in user changes, and written back (debounced) below.
  const lastMeId = useRef<string | null>(null)
  useEffect(() => {
    if (me && me.id !== lastMeId.current) { lastMeId.current = me.id; setBioDraft(me.bio) }
    if (!me) lastMeId.current = null
  }, [me])
  useEffect(() => {
    if (!authUser || !me || bioDraft === me.bio) return
    const t = setTimeout(() => { updateMyProfile(authUser.uid, { bio: bioDraft }).catch(() => showToast('소개를 저장하지 못했어요')) }, 600)
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

  const vote = async (id: string, dir: 1 | -1) => {
    if (!authUser) return
    const d = all.find(x => x.id === id)
    if (!d) return
    setSheet(null)
    try {
      const next = await castVote(authUser.uid, id, dir)
      showToast(next === 0 ? `${d.name}님 투표를 취소했어요` : `${d.name}님에게 투표했어요`)
    } catch {
      showToast('투표하지 못했어요. 다시 시도해주세요')
    }
  }

  const pickItem = (kind: ItemKind, key: string, label: string) => {
    if (!me) return
    if (me.owned[kind].includes(key)) {
      equipItem(me.id, kind, key).catch(() => showToast('적용하지 못했어요'))
    } else {
      setBuy({ kind, key, label, price: priceOf(kind, key) })
    }
  }

  const buyName = buy ? buy.label + (KIND_NAME[buy.kind] ? ' ' + KIND_NAME[buy.kind] : '') : ''
  const canBuy = !!buy && points >= buy.price
  const confirmBuy = async () => {
    if (!buy || !canBuy || !me) return
    try {
      await buyItem(me.id, buy.kind, buy.key, buy.price)
      setBuy(null)
      showToast(buyName + ' 적용했어요')
    } catch {
      showToast('구매하지 못했어요. 다시 시도해주세요')
    }
  }

  const doLogin = async () => {
    if (authBusy) return
    setAuthBusy(true)
    try {
      await logIn(login.id.trim(), login.pw)
      setLogin(EMPTY_LOGIN)
      showToast('로그인했어요')
    } catch (e) {
      showToast(authErrorMessage(e))
    } finally {
      setAuthBusy(false)
    }
  }

  const doLogout = async () => {
    await logOut()
    setVotes({})
    showToast('로그아웃했어요')
  }

  const doSignup = async () => {
    if (authBusy) return
    setAuthBusy(true)
    try {
      await signUp(signup.name.trim(), signup.id.trim(), signup.pw)
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
      await updateMyProfile(authUser.uid, { photoURL: dataUrl })
      showToast('프로필 사진을 바꿨어요')
    } catch {
      showToast('사진을 처리하지 못했어요. 다른 사진으로 시도해주세요')
    } finally {
      setPhotoBusy(false)
    }
  }
  const onRemovePhoto = () => {
    if (!authUser) return
    updateMyProfile(authUser.uid, { photoURL: '' }).catch(() => showToast('사진을 지우지 못했어요'))
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
              goRank={() => go('rank')} goAccount={() => go('acct')} startReveal={() => setRevealOpen(true)} myCount={mine.length}
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
              me={me ? { ...me, bio: bioDraft } : undefined}
              onPhoto={onPhoto}
              onRemovePhoto={onRemovePhoto}
              onBio={v => setBioDraft(v.slice(0, 60))}
              onGender={g => authUser && updateMyProfile(authUser.uid, { gender: g }).catch(() => showToast('저장하지 못했어요'))}
              points={points}
              mine={mine}
              onCancelVote={d => vote(d.id, d.v as 1 | -1)}
              openEdit={() => setEditOpen(true)}
              openTheme={() => setThemeOpen(true)}
              goHome={() => go('home')}
            />
          )}
        </main>

        <BottomNav tab={tab} onGo={go} />

        {sheetPerson && (
          <VoteSheet d={sheetPerson} loggedIn={loggedIn} colors={colors} onVote={dir => vote(sheetPerson.id, dir)} onClose={() => setSheet(null)} onLogin={() => go('acct')} />
        )}
        {profilePerson && (
          <ProfileSheet
            d={profilePerson.isMe ? { ...profilePerson, bio: bioDraft } : profilePerson}
            onClose={() => setProfile(null)}
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
        {revealOpen && all.length >= 3 && (
          <Reveal top={all.slice(0, 3)} sound={sound} onToggleSound={() => setSound(s => !s)} onClose={() => setRevealOpen(false)} />
        )}
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

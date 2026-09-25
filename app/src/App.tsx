import { useEffect, useMemo, useRef, useState } from 'react'
import { AccountScreen, type SignupForm } from './components/AccountScreen'
import { BottomNav } from './components/BottomNav'
import { EditProfile } from './components/EditProfile'
import { GlassFilters } from './components/GlassFilters'
import { HomeScreen } from './components/HomeScreen'
import { BuyDialog, ProfileSheet, RuleDialog, ThemeSheet, Toast, VoteSheet } from './components/Overlays'
import { RankScreen } from './components/RankScreen'
import { Reveal } from './components/Reveal'
import { css } from './css'
import { BLUE, KIND_NAME, ME, RED, SKIN_FILES, priceOf, type ItemKind, type Tab, type Vote } from './data'
import { buildPeople } from './model'

export type AppProps = {
  /** Start signed in (preview option). */
  loggedIn?: boolean
  startTab?: Tab
  /** Swap vote colours to red = 추천, blue = 비추천. */
  swapPalette?: boolean
}

type Buy = { kind: ItemKind; key: string; label: string; price: number }

const EMPTY_SIGNUP: SignupForm = { name: '', id: '', pw: '', pw2: '' }

function loadTheme() {
  try { return localStorage.getItem('pv-theme') || 'default' } catch { return 'default' }
}

/** UI-only prototype: all data is mock and nothing is persisted except the theme. */
export function App({ loggedIn: initialLoggedIn = false, startTab = 'home', swapPalette = false }: AppProps) {
  const [tab, setTab] = useState<Tab>(startTab)
  const [loggedIn, setLoggedIn] = useState(initialLoggedIn)
  const [votes, setVotes] = useState<Record<number, Vote>>({})
  const [homeQuery, setHomeQuery] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [sheet, setSheet] = useState<number | null>(null)
  const [profile, setProfile] = useState<number | null>(null)
  const [toast, setToast] = useState('')

  const [photo, setPhoto] = useState<string | null>(null)
  const [bio, setBio] = useState('')
  const [gender, setGender] = useState('')
  const [equipped, setEquipped] = useState<Record<ItemKind, string>>({ frame: 'none', plate: 'none', skin: 'none' })
  const [owned, setOwned] = useState<Record<ItemKind, string[]>>({ frame: ['none'], plate: ['none'], skin: ['none'] })
  const [spent, setSpent] = useState(0)
  const [editOpen, setEditOpen] = useState(false)
  const [editTab, setEditTab] = useState<ItemKind>('frame')
  const [buy, setBuy] = useState<Buy | null>(null)

  const [acctView, setAcctView] = useState<'login' | 'signup'>('login')
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

  useEffect(() => { setLoggedIn(initialLoggedIn) }, [initialLoggedIn])
  useEffect(() => { setTab(startTab) }, [startTab])

  // Warm the skin images so towers appear together with the bar-grow animation.
  useEffect(() => {
    SKIN_FILES.forEach(f => { const i = new Image(); i.decoding = 'async'; i.src = `skins/${f}.png` })
    return () => clearTimeout(toastTimer.current)
  }, [])

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo) }, [photo])

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

  const all = useMemo(
    () => buildPeople(votes, { ...equipped, gender, bio, photo }),
    [votes, equipped, gender, bio, photo],
  )
  const me = all.find(d => d.name === ME)!
  const mine = all.filter(d => d.v !== 0)
  const points = me.upN - spent

  const colors = swapPalette
    ? { up: RED, down: BLUE, downWeak: 'rgba(49,130,246,0.16)', downWeakFg: '#1b64da' }
    : { up: BLUE, down: RED, downWeak: 'rgba(244,67,54,0.16)', downWeakFg: '#d22030' }

  const go = (t: Tab) => {
    setTab(t); setSheet(null); setProfile(null); setEditOpen(false)
    window.scrollTo(0, 0)
  }

  const vote = (id: number, dir: 1 | -1) => {
    const d = all.find(x => x.id === id)!
    const next: Vote = d.v === dir ? 0 : dir
    setVotes(v => ({ ...v, [id]: next }))
    setSheet(null)
    showToast(next === 0 ? `${d.name}님 투표를 취소했어요` : `${d.name}님에게 투표했어요`)
  }

  const pickItem = (kind: ItemKind, key: string, label: string) => {
    if (owned[kind].includes(key)) setEquipped(e => ({ ...e, [kind]: key }))
    else setBuy({ kind, key, label, price: priceOf(kind, key) })
  }

  const buyName = buy ? buy.label + (KIND_NAME[buy.kind] ? ' ' + KIND_NAME[buy.kind] : '') : ''
  const canBuy = !!buy && points >= buy.price
  const confirmBuy = () => {
    if (!buy || !canBuy) return
    setSpent(s => s + buy.price)
    setOwned(o => ({ ...o, [buy.kind]: [...o[buy.kind], buy.key] }))
    setEquipped(e => ({ ...e, [buy.kind]: buy.key }))
    setBuy(null)
    showToast(buyName + ' 적용했어요')
  }

  const sheetPerson = sheet != null ? all.find(d => d.id === sheet) : undefined
  const profilePerson = profile != null ? all.find(d => d.id === profile) : undefined

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
              onLogin={() => { setLoggedIn(true); showToast('로그인했어요') }}
              onLogout={() => { setLoggedIn(false); setVotes({}); showToast('로그아웃했어요') }}
              signup={signup}
              onSignup={patch => setSignup(s => ({ ...s, ...patch }))}
              nameAck={nameAck}
              nameRef={nameRef}
              onNameFocus={el => { if (!nameAck) { el.blur(); setRuleOpen(true); setRuleCheck(false) } }}
              onSubmitSignup={() => { setLoggedIn(true); setAcctView('login'); setSignup(EMPTY_SIGNUP); showToast('가입했어요. 환영해요!') }}
              me={me}
              onPhoto={f => { setPhoto(URL.createObjectURL(f)); showToast('프로필 사진을 바꿨어요') }}
              onRemovePhoto={() => setPhoto(null)}
              onBio={setBio}
              onGender={setGender}
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
            d={profilePerson}
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
        {editOpen && (
          <EditProfile
            name={ME} bio={bio} photoCss={me.photoCss} equipped={equipped} owned={owned} points={points}
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
        {revealOpen && (
          <Reveal top={all.slice(0, 3)} sound={sound} onToggleSound={() => setSound(s => !s)} onClose={() => setRevealOpen(false)} />
        )}
        {toast && <Toast msg={toast} />}
      </div>
    </div>
  )
}

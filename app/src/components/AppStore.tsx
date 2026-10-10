import { useState, type ReactNode } from 'react'
import type { Firestore } from 'firebase/firestore'
import { css } from '../css'
import { APP_DESC, APP_NAME, STORE_APPS, isInstalled, setInstalled, type OpenableApp, type PhoneState, type StoreApp } from '../backend/phone'
import { AppIcon } from './PhoneIcons'

// 앱스토어, after the iOS App Store: large titles with the profile circle, category chips, feature
// cards, app rows with 받기 / 열기, an app page as a sheet, and the floating glass tab bar
// (투데이 · 게임 · 앱 · 검색; there is no Arcade here). Colours are the iOS tokens from styles.css.

const FONT = "-apple-system,BlinkMacSystemFont,system-ui,sans-serif"

type StoreTab = 'today' | 'game' | 'app' | 'search'

const META: Record<StoreApp, { sub: string; caption: string; headline: string; art: [string, string]; cat: '상점' | '투자' | '게임'; game?: boolean }> = {
  shop: { sub: '프레임, 이름표, 막대 스킨', caption: '꾸미기', headline: '나만의 이름표를 골라보세요', art: ['#ff7a93', '#e8234f'], cat: '상점' },
  market: { sub: '우리 동네 아이템 직거래', caption: '새로운 앱', headline: '가진 아이템을 사고팔아요', art: ['#ffb347', '#ff6f0f'], cat: '상점' },
  coin: { sub: '실제 시세로 즐기는 코인 거래', caption: '오늘의 게임', headline: '포인트로 코인에 투자해요', art: ['#4f86f0', '#1b3fa8'], cat: '투자', game: true },
  stock: { sub: '국내·해외 주식 실시간 시세', caption: '새로운 앱', headline: '1포인트 = 1원으로 주식 투자', art: ['#3a3a3f', '#0c0c0e'], cat: '투자' },
  block: { sub: '블록을 놓아 줄을 지워요', caption: '오늘의 게임', headline: '블록을 맞춰 줄을 지워보세요', art: ['#3a4a86', '#161d3e'], cat: '게임', game: true },
}

type Ctx = {
  db: Firestore | null
  uid: string | null
  phone: PhoneState
  onOpen: (app: OpenableApp) => void
  onLogin: () => void
  onToast: (msg: string) => void
  detail: (app: StoreApp) => void
}

const chevron = (
  <svg width="9" height="15" viewBox="0 0 9 15" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginLeft: 8, color: 'var(--ios-sec)' }}><path d="m1.5 1.5 6 6-6 6" /></svg>
)

/** 받기 / 열기 (or 로그인 when signed out), the way the App Store draws it. */
function Get({ app, ctx, glass = false }: { app: StoreApp; ctx: Ctx; glass?: boolean }) {
  const { db, uid, phone } = ctx
  const have = isInstalled(phone, app)
  const label = !uid ? '로그인' : have ? '열기' : '받기'
  const tap = () => {
    if (!uid) ctx.onLogin()
    else if (have) ctx.onOpen(app)
    else if (db) setInstalled(db, uid, app, true).catch(() => ctx.onToast('받지 못했어요'))
  }
  return (
    <button className="pr-96" onClick={e => { e.stopPropagation(); tap() }} style={css(`flex:none;height:30px;min-width:72px;padding:0 18px;border-radius:15px;font-family:${FONT};font-size:15px;font-weight:700;background:${glass ? 'rgba(255,255,255,0.3)' : 'rgba(120,120,128,0.14)'};color:${glass ? '#fff' : 'var(--ios-blue)'};${glass ? '-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)' : ''}`)}>{label}</button>
  )
}

function Row({ app, ctx, last }: { app: StoreApp; ctx: Ctx; last: boolean }) {
  return (
    <div onClick={() => ctx.detail(app)} style={css('position:relative;display:flex;align-items:center;gap:14px;padding:12px 0;cursor:pointer')}>
      <AppIcon app={app} size={60} />
      <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:2px')}>
        <span style={css('font-size:17px;line-height:22px;letter-spacing:-0.41px;color:var(--ios-label);white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{APP_NAME[app]}</span>
        <span style={css('font-size:15px;line-height:20px;color:var(--ios-sec);white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{META[app].sub}</span>
      </span>
      <span style={css('flex:none;display:flex;flex-direction:column;align-items:center;gap:3px')}>
        <Get app={app} ctx={ctx} />
        <span style={css('font-size:11px;line-height:13px;color:var(--ios-sec)')}>앱 내 구매</span>
      </span>
      {!last && <span style={css('position:absolute;left:74px;right:0;bottom:0;height:0.33px;background:var(--ios-sep)')} />}
    </div>
  )
}

function Head({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={css('padding:30px 0 4px;display:flex;flex-direction:column;gap:2px')}>
      <span style={css('display:flex;align-items:center;font-size:22px;line-height:28px;font-weight:700;letter-spacing:0.35px;color:var(--ios-label)')}>{title}{chevron}</span>
      {sub && <span style={css('font-size:15px;line-height:20px;color:var(--ios-sec)')}>{sub}</span>}
    </div>
  )
}

function Section({ title, sub, apps, ctx }: { title: string; sub?: string; apps: StoreApp[]; ctx: Ctx }) {
  if (!apps.length) return null
  return (
    <>
      <Head title={title} sub={sub} />
      {apps.map((a, i) => <Row key={a} app={a} ctx={ctx} last={i === apps.length - 1} />)}
    </>
  )
}

/** A big feature card: caption, headline, art, and the app bar along the bottom. */
function Feature({ app, ctx }: { app: StoreApp; ctx: Ctx }) {
  const m = META[app]
  return (
    <div onClick={() => ctx.detail(app)} style={css('padding-top:26px;cursor:pointer')}>
      <span style={css('display:block;font-size:13px;line-height:18px;font-weight:600;color:var(--ios-blue)')}>{m.caption}</span>
      <span style={css('display:block;font-size:22px;line-height:28px;font-weight:700;letter-spacing:0.35px;color:var(--ios-label)')}>{APP_NAME[app]}</span>
      <span style={css('display:block;font-size:17px;line-height:22px;color:var(--ios-sec);margin-bottom:12px')}>{m.headline}</span>
      <div style={css(`position:relative;height:300px;border-radius:20px;overflow:hidden;background:linear-gradient(160deg,${m.art[0]},${m.art[1]});isolation:isolate`)}>
        <span aria-hidden="true" style={css('position:absolute;left:-40px;top:-50px;width:210px;height:210px;border-radius:9999px;background:rgba(255,255,255,0.2)')} />
        <span aria-hidden="true" style={css('position:absolute;right:-60px;top:70px;width:230px;height:230px;border-radius:9999px;background:rgba(255,255,255,0.14)')} />
        <span style={css('position:absolute;left:50%;top:44px;margin-left:-62px;transform:rotate(-7deg);filter:drop-shadow(0 10px 18px rgba(0,0,0,0.25))')}><AppIcon app={app} size={124} /></span>
        <div style={css('position:absolute;left:0;right:0;bottom:0;display:flex;align-items:center;gap:12px;padding:12px 14px;background:rgba(20,22,30,0.34);-webkit-backdrop-filter:blur(22px) saturate(160%);backdrop-filter:blur(22px) saturate(160%)')}>
          <AppIcon app={app} size={48} />
          <span style={css('flex:1;min-width:0;display:flex;flex-direction:column')}>
            <span style={css('font-size:15px;line-height:20px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{APP_NAME[app]}</span>
            <span style={css('font-size:13px;line-height:18px;color:rgba(255,255,255,0.75);white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{m.sub}</span>
          </span>
          <span style={css('flex:none;display:flex;flex-direction:column;align-items:center;gap:3px')}>
            <Get app={app} ctx={ctx} glass />
            <span style={css('font-size:11px;line-height:13px;color:rgba(255,255,255,0.75)')}>앱 내 구매</span>
          </span>
        </div>
      </div>
    </div>
  )
}

/** The big title with the profile circle on the right. */
function Title({ title, caption }: { title: string; caption?: string }) {
  return (
    <div style={css('display:flex;align-items:flex-end;justify-content:space-between;padding:6px 0 0')}>
      <span style={css('display:flex;flex-direction:column')}>
        {caption && <span style={css('font-size:13px;line-height:18px;font-weight:600;color:var(--ios-sec)')}>{caption}</span>}
        <span style={css('font-size:34px;line-height:41px;font-weight:700;letter-spacing:0.37px;color:var(--ios-label)')}>{title}</span>
      </span>
      <span aria-hidden="true" style={css('flex:none;width:44px;height:44px;border-radius:9999px;background:var(--ios-card);box-shadow:inset 0 0 0 0.5px var(--ios-sep);display:flex;align-items:center;justify-content:center;color:var(--ios-sec)')}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8.5" r="4" /><path d="M4 20c0-3.6 3.6-5.5 8-5.5s8 1.9 8 5.5z" /></svg>
      </span>
    </div>
  )
}

const CHIP_ICON: Record<'상점' | '투자', ReactNode> = {
  상점: <AppIcon app="shop" size={26} />,
  투자: <AppIcon app="coin" size={26} />,
}

function Chips({ value, onPick }: { value: '상점' | '투자' | null; onPick: (c: '상점' | '투자' | null) => void }) {
  return (
    <div style={css('display:flex;gap:12px;overflow-x:auto;padding:18px 20px 6px;margin:0 -20px;scrollbar-width:none')}>
      {(['상점', '투자'] as const).map(c => (
        <button key={c} className="pr-96" onClick={() => onPick(value === c ? null : c)} aria-pressed={value === c} style={css(`flex:none;height:44px;display:flex;align-items:center;gap:10px;padding:0 18px 0 12px;border-radius:22px;background:var(--ios-card);box-shadow:0 1px 8px rgba(0,0,0,0.1),inset 0 0 0 ${value === c ? 2 : 0}px var(--ios-blue);font-family:${FONT};font-size:17px;font-weight:600;color:var(--ios-label)`)}>
          {CHIP_ICON[c]}{c}
        </button>
      ))}
    </div>
  )
}

const Search = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
)

const TABS: { key: StoreTab; label: string; icon: ReactNode }[] = [
  { key: 'today', label: '투데이', icon: <><rect x="5" y="3.2" width="14" height="17.6" rx="3.4" /><rect x="8.2" y="7.2" width="7.6" height="9.6" rx="1.8" /></> },
  { key: 'game', label: '게임', icon: <><path d="M14.8 4.3c3 .1 5 2 5.2 5-1.5 3.7-4.2 6.4-7.8 8l-3.2-3.2c1.6-3.6 4.2-6.3 5.8-9.8z" /><circle cx="15" cy="9.2" r="1.3" /><path d="M7.4 14.3 4.6 15l-.4 4.3 4.3-.4.8-2.8" /></> },
  { key: 'app', label: '앱', icon: <><path d="m12 3.8 8.5 4.4-8.5 4.4-8.5-4.4z" /><path d="m3.5 12 8.5 4.4 8.5-4.4M3.5 15.8 12 20.2l8.5-4.4" /></> },
  { key: 'search', label: '검색', icon: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></> },
]

/** The app's own page, as a sheet: icon, name, 받기 / 열기, what it does, and 삭제 for one I have. */
function Page({ app, ctx, onClose }: { app: StoreApp; ctx: Ctx; onClose: () => void }) {
  const { db, uid, phone } = ctx
  const have = isInstalled(phone, app)
  return (
    <div onClick={onClose} style={css('position:absolute;inset:0;z-index:6;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(0,0,0,0.35);animation:fade 200ms ease both')}>
      <div onClick={e => e.stopPropagation()} style={css(`position:relative;padding:26px 20px calc(var(--phone-bottom) + 12px);border-radius:38px 38px 0 0;background:var(--ios-bg);animation:sheetUp 380ms cubic-bezier(0.32,0.72,0,1) both;font-family:${FONT}`)}>
        <button className="pr-96" onClick={onClose} aria-label="닫기" style={css('position:absolute;top:16px;right:16px;width:32px;height:32px;border-radius:9999px;background:rgba(120,120,128,0.2);color:var(--ios-sec);display:flex;align-items:center;justify-content:center')}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="m2 2 10 10M12 2 2 12" /></svg>
        </button>
        <div style={css('display:flex;align-items:center;gap:16px')}>
          <AppIcon app={app} size={96} />
          <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:2px')}>
            <span style={css('font-size:22px;line-height:28px;font-weight:700;color:var(--ios-label)')}>{APP_NAME[app]}</span>
            <span style={css('font-size:15px;line-height:20px;color:var(--ios-sec)')}>{META[app].sub}</span>
            <span style={css('margin-top:8px;display:flex;align-items:center;gap:10px')}>
              <Get app={app} ctx={ctx} />
              <span style={css('font-size:11px;color:var(--ios-sec)')}>앱 내 구매</span>
            </span>
          </span>
        </div>
        <span style={css('display:block;margin-top:22px;font-size:15px;line-height:22px;color:var(--ios-label)')}>{APP_DESC[app]}. 포인트로 이용하고, 앱스토어에서 받거나 지울 수 있어요.</span>
        {uid && have && db && (
          <button className="pr-96" onClick={() => { setInstalled(db, uid, app, false).then(onClose).catch(() => ctx.onToast('지우지 못했어요')) }} style={css('width:100%;height:50px;margin-top:22px;border-radius:14px;background:var(--ios-card);color:var(--ios-red);font-family:inherit;font-size:17px')}>앱 삭제</button>
        )}
      </div>
    </div>
  )
}

/** 앱스토어. */
export function AppStore({ db, uid, phone, onOpen, onLogin, onToast }: Omit<Ctx, 'detail'>) {
  const [tab, setTab] = useState<StoreTab>('today')
  const [chip, setChip] = useState<'상점' | '투자' | null>(null)
  const [q, setQ] = useState('')
  const [page, setPage] = useState<StoreApp | null>(null)
  const ctx: Ctx = { db, uid, phone, onOpen, onLogin, onToast, detail: setPage }

  const visible = STORE_APPS.filter(a => phone.catalog[a] !== false)
  const games = visible.filter(a => META[a].game)
  const inChip = visible.filter(a => !chip || META[a].cat === chip)
  const found = visible.filter(a => `${APP_NAME[a]} ${META[a].sub} ${META[a].cat}`.includes(q.trim()))
  const date = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })
  const empty = <span style={css('display:block;padding:48px 0;text-align:center;font-size:15px;color:var(--ios-sec)')}>아직 받을 수 있는 앱이 없어요</span>

  return (
    <div style={css(`position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;padding-top:var(--phone-top);box-sizing:border-box;border-radius:var(--phone-r);overflow:hidden;background:var(--ios-bg);color:var(--ios-label);font-family:${FONT};animation:fade 240ms ease both`)}>
      <div style={css('flex:1;min-height:0;overflow-y:auto;padding:0 20px 120px')}>
        {tab === 'today' && (
          <>
            <Title title="투데이" caption={date} />
            {!visible.length && empty}
            {(['block', 'stock', 'market', 'coin', 'shop'] as StoreApp[]).filter(a => visible.includes(a)).map(a => <Feature key={a} app={a} ctx={ctx} />)}
            <Section title="지금 써봐야 할 앱" apps={visible} ctx={ctx} />
          </>
        )}
        {tab === 'game' && (
          <>
            <Title title="게임" />
            {games[0] ? <Feature app={games[0]} ctx={ctx} /> : empty}
            <Section title="오늘은 이 게임" sub="포인트로 즐기는 시뮬레이션" apps={games} ctx={ctx} />
          </>
        )}
        {tab === 'app' && (
          <>
            <Title title="앱" />
            <Chips value={chip} onPick={setChip} />
            {inChip[0] ? <Feature app={inChip[0]} ctx={ctx} /> : empty}
            <Section title="지금 써봐야 할 앱" apps={inChip} ctx={ctx} />
          </>
        )}
        {tab === 'search' && (
          <>
            <Title title="검색" />
            <label style={css('margin-top:16px;height:44px;display:flex;align-items:center;gap:10px;padding:0 16px;border-radius:22px;background:var(--ios-card);box-shadow:0 1px 10px rgba(0,0,0,0.08);color:var(--ios-sec)')}>
              <Search />
              <input value={q} onChange={e => setQ(e.target.value.slice(0, 20))} placeholder="게임, 앱, 스토리 등" aria-label="앱 검색" style={css(`flex:1;min-width:0;border:0;outline:none;background:transparent;font-family:${FONT};font-size:17px;color:var(--ios-label)`)} />
              <svg width="18" height="22" viewBox="0 0 18 22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><rect x="5.5" y="1.5" width="7" height="12" rx="3.5" fill="currentColor" stroke="none" /><path d="M2 10.5a7 7 0 0 0 14 0M9 17.5v3" /></svg>
            </label>
            {q.trim() ? (
              found.length ? <div style={css('padding-top:14px')}>{found.map((a, i) => <Row key={a} app={a} ctx={ctx} last={i === found.length - 1} />)}</div>
                : <span style={css('display:block;padding:48px 0;text-align:center;font-size:15px;color:var(--ios-sec)')}>“{q.trim()}” 검색 결과가 없어요</span>
            ) : (
              <>
                <Section title="추천 앱과 게임" apps={visible} ctx={ctx} />
                <Head title="둘러보기" />
                <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:12px;padding-top:6px')}>
                  {([['상점', '#7aa7f0', '#4f86e0'], ['투자', '#f5b46b', '#ec8a3a']] as const).map(([name, a, b]) => (
                    <button key={name} className="pr-96" onClick={() => { setChip(name); setTab('app') }} style={css(`height:112px;border-radius:20px;padding:14px;text-align:left;background:linear-gradient(160deg,${a},${b});color:#fff;font-family:${FONT};font-size:17px;font-weight:700;display:flex;align-items:flex-end`)}>{name}</button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* floating glass tab bar */}
      <div role="tablist" style={css('position:absolute;z-index:4;left:16px;right:16px;bottom:calc(var(--phone-bottom) - 8px);height:62px;padding:5px;box-sizing:border-box;display:flex;border-radius:31px;background:rgba(255,255,255,0.74);-webkit-backdrop-filter:blur(30px) saturate(180%);backdrop-filter:blur(30px) saturate(180%);box-shadow:0 4px 22px rgba(0,0,0,0.12),inset 0 0 0 0.5px rgba(255,255,255,0.8)')}>
        {TABS.map(t => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} aria-label={t.label} className="pr-96" onClick={() => setTab(t.key)} style={css(`flex:1;border-radius:26px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-family:${FONT};font-size:11px;line-height:13px;font-weight:600;background:${tab === t.key ? 'rgba(120,120,128,0.16)' : 'none'};color:${tab === t.key ? '#007aff' : '#000'};transition:background 200ms,color 200ms`)}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{t.icon}</svg>
            {t.label}
          </button>
        ))}
      </div>

      {page && <Page app={page} ctx={ctx} onClose={() => setPage(null)} />}
    </div>
  )
}

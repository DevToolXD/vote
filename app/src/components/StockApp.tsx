import { useEffect, useMemo, useState } from 'react'
import type { Firestore } from 'firebase/firestore'
import { css } from '../css'
import { MIN_BUY, buyCoin, floor8, sellCoin, watchWallet, type Wallet } from '../backend/coins'
import {
  fmtCap, fmtPct, fmtSigned, fmtStock, fmtVolume, stateLabel,
  watchStockDaily, watchStockInfo, watchStockList, watchStockLive, watchStockSpark, watchStockStatus, watchStockToday,
  type Daily, type Sample, type StockFacts, type StockLive, type StockMeta, type StockStatus,
} from '../backend/stocks'

// 주식, after Apple's Stocks app: black, a list of symbol + small line + price + a change pill, and
// a sheet for each stock with the chart, the numbers and (for stocks, not indices) 매수 / 판매.
// Prices are in points: 1P = 1원 (US stocks are converted with the live USD/KRW rate).

const FONT = "-apple-system,BlinkMacSystemFont,system-ui,'Apple SD Gothic Neo','Noto Sans KR',sans-serif"
const UP = '#30d158', DOWN = '#ff453a', BLUE = '#0a84ff'
const CARD = '#1c1c1e', CARD2 = '#2c2c2e', SEC = 'rgba(235,235,245,0.6)', SEP = 'rgba(84,84,88,0.6)'

type Filter = 'all' | 'KR' | 'US' | 'IX' | 'mine'
type Mode = 'pct' | 'won' | 'cap'
type Sort = 'basic' | 'up' | 'down' | 'price' | 'name'
type Range = '1d' | '1m' | '6m' | '1y' | '5y'

const tone = (n: number) => (n < 0 ? DOWN : UP)
/** Shares: up to 4 decimals (the wallet keeps 8). */
const fmtShares = (q: number) => q.toLocaleString(undefined, { maximumFractionDigits: 4 })
const titleOf = (s: StockMeta) => (s.market === 'KR' || s.market === 'IX' ? (s.market === 'KR' ? s.name : s.ticker) : s.ticker)
const subOf = (s: StockMeta) => (s.market === 'KR' ? s.ticker : s.market === 'IX' ? s.name : s.name)

/** The small line: closes (the live price last), coloured by the day's change. */
function Spark({ values, up, w = 92, h = 36 }: { values: number[]; up: boolean; w?: number; h?: number }) {
  if (values.length < 2) return <svg width={w} height={h} aria-hidden="true"><path d={`M0 ${h - 2}H${w}`} stroke={SEC} strokeWidth="1.5" strokeDasharray="3 3" fill="none" /></svg>
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, 3 + (1 - (v - lo) / span) * (h - 8)])
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')
  const c = up ? UP : DOWN
  return (
    <svg width={w} height={h} aria-hidden="true">
      <path d={`${line}L${w} ${h}L0 ${h}Z`} fill={c} opacity="0.14" />
      <path d={line} fill="none" stroke={c} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

const RANGES: [Range, string, number][] = [['1d', '1일', 0], ['1m', '1개월', 22], ['6m', '6개월', 126], ['1y', '1년', 252], ['5y', '5년', 99999]]

function series(range: Range, daily: Daily | null, today: Sample[], price: number | undefined): Sample[] {
  const now = Date.now()
  let out: Sample[]
  if (range === '1d') out = today.slice()
  else {
    const n = RANGES.find(r => r[0] === range)![2]
    out = daily ? daily.v.map((v, i) => ({ t: (daily.d[i] ?? 0) * 86_400_000, v })).slice(-n) : []
  }
  if (price) out.push({ t: now, v: price })
  if (out.length > 280) { const step = Math.ceil(out.length / 280); out = out.filter((_, i) => i % step === 0 || i === out.length - 1) }
  return out
}

const fmtTime = (t: number, range: Range) => {
  const d = new Date(t)
  return range === '1d' ? `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` : range === '5y' ? `${d.getFullYear()}년` : range === '1y' ? `${d.getFullYear() % 100}.${d.getMonth() + 1}` : `${d.getMonth() + 1}월 ${d.getDate()}일`
}

/** The area chart with grid lines and the price labels on the right; drag along it to read a value. */
function Chart({ data, range, index, prev, onHover }: { data: Sample[]; range: Range; index: boolean; prev?: number; onHover: (i: number | null) => void }) {
  const [hov, setHov] = useState<number | null>(null)
  const W = 340, H = 226, PW = 262, top = 10, bot = 190
  if (data.length < 2) return <div style={css(`height:${H}px;display:flex;align-items:center;justify-content:center;color:${SEC};font-size:15px`)}>그래프를 그릴 데이터가 아직 없어요</div>
  const vs = data.map(d => d.v)
  const showPrev = range === '1d' && !!prev
  const lo = Math.min(...vs, ...(showPrev ? [prev!] : [])), hi = Math.max(...vs, ...(showPrev ? [prev!] : [])), pad = (hi - lo || hi * 0.02 || 1) * 0.08
  const a = lo - pad, b = hi + pad
  const X = (i: number) => (i / (data.length - 1)) * PW
  const Y = (v: number) => top + (1 - (v - a) / (b - a)) * (bot - top)
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(d.v).toFixed(1)}`).join('')
  const c = tone(vs[vs.length - 1] - vs[0])
  const gid = `sg${range}`
  const labels = [0.2, 0.5, 0.8].map(f => b - f * (b - a))
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * W
    const i = Math.max(0, Math.min(data.length - 1, Math.round((x / PW) * (data.length - 1))))
    setHov(i); onHover(i)
  }
  const end = () => { setHov(null); onHover(null) }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', touchAction: 'pan-y', userSelect: 'none' }} onPointerDown={move} onPointerMove={e => { if (e.buttons || e.pointerType === 'touch') move(e) }} onPointerUp={end} onPointerLeave={end} onPointerCancel={end}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c} stopOpacity="0.4" /><stop offset="1" stopColor={c} stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3].map(k => <line key={k} x1={(PW / 3) * k} x2={(PW / 3) * k} y1={top} y2={bot} stroke={SEP} strokeWidth="0.6" opacity="0.7" />)}
      {labels.map((v, k) => <g key={k}><line x1="0" x2={W} y1={Y(v)} y2={Y(v)} stroke={SEP} strokeWidth="0.6" opacity="0.7" /><text x={W - 4} y={Y(v) - 6} textAnchor="end" fill="#fff" fontSize="14" fontWeight="700">{fmtStock(v, index)}</text></g>)}
      <line x1="0" x2={W} y1={bot} y2={bot} stroke={SEP} strokeWidth="1" />
      {showPrev && <line x1="0" x2={PW} y1={Y(prev!)} y2={Y(prev!)} stroke="#8e8e93" strokeWidth="1" strokeDasharray="4 4" />}
      <path d={`${line}L${X(data.length - 1)} ${bot}L0 ${bot}Z`} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={c} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {[0, 0.5, 1].map(f => { const i = Math.round(f * (data.length - 1)); return <text key={f} x={Math.min(PW - 2, Math.max(2, X(i)))} y={bot + 22} textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'} fill="#fff" fontSize="13" fontWeight="700">{fmtTime(data[i].t, range)}</text> })}
      {hov != null && <g><line x1={X(hov)} x2={X(hov)} y1={top} y2={bot} stroke="#fff" strokeWidth="1" opacity="0.7" /><circle cx={X(hov)} cy={Y(data[hov].v)} r="5" fill={c} stroke="#fff" strokeWidth="2" /></g>}
    </svg>
  )
}

type Ctx = { db: Firestore | null; uid: string | null; points: number; onLogin: () => void; onToast: (m: string) => void }

/** The sheet for one stock. */
function Detail({ s, price, chg, facts, live, holding, strip, onPick, onClose, ctx }: {
  s: StockMeta; price: number | undefined; chg: number; facts?: StockFacts; live: StockLive
  holding?: { q: number; c: number }; strip: { s: StockMeta; price?: number; chg: number; spark: number[] }[]
  onPick: (sym: string) => void; onClose: () => void; ctx: Ctx
}) {
  const { db, uid, points } = ctx
  const index = s.market === 'IX'
  const [daily, setDaily] = useState<Daily | null>(null)
  const [today, setToday] = useState<Sample[]>([])
  const [pick, setPick] = useState<Range | null>(null)
  const [hov, setHov] = useState<number | null>(null)
  const [mode, setMode] = useState<'buy' | 'sell' | null>(null)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { setDaily(null); setToday([]); setPick(null); setHov(null); setMode(null); setAmount('') }, [s.sym])
  useEffect(() => (db ? watchStockDaily(db, s.sym, setDaily) : undefined), [db, s.sym])
  useEffect(() => (db ? watchStockToday(db, s.sym, setToday) : undefined), [db, s.sym])
  const range: Range = pick ?? (today.length >= 8 ? '1d' : '1m')
  const data = useMemo(() => series(range, daily, today, price), [range, daily, today, price])
  const first = data[0]?.v
  const shown = hov != null && data[hov] ? data[hov].v : price
  const change = hov != null && data[hov] && first ? (data[hov].v - first) / first : range === '1d' ? chg : data.length > 1 && first ? (data[data.length - 1].v - first) / first : chg
  const state = stateLabel(live?.st?.[s.market === 'IX' ? (s.sym.includes('KS') || s.sym.includes('KQ') ? 'KR' : 'US') : s.market])

  const n = Number(amount.replace(/,/g, '')) || 0
  const sellQty = holding ? floor8(n >= 100 ? holding.q : holding.q * (n / 100)) : 0
  const canBuy = n >= MIN_BUY && n <= points && !!price
  const canSell = !!holding && sellQty > 0 && !!price
  const evalNow = holding && price ? holding.q * price : 0
  const submit = async () => {
    if (busy || !db || !uid) return
    setBusy(true)
    try {
      const r = mode === 'buy' ? await buyCoin(db, uid, s.sym, n) : await sellCoin(db, uid, s.sym, sellQty)
      if (r.status === 'done') {
        ctx.onToast(mode === 'buy' ? `${s.name} ${fmtShares(r.qty ?? 0)}주를 ${fmtStock(r.price)}P에 샀어요` : `${s.name}을 팔아서 ${(r.points ?? 0).toLocaleString()}P를 받았어요`)
        setMode(null); setAmount('')
      } else if (r.status === 'failed') ctx.onToast(r.reason === 'not-enough' ? '가진 주식보다 많이 팔 수 없어요' : '체결하지 못했어요')
      else { ctx.onToast('주문을 넣었어요. 시세가 들어오면 체결돼요'); setMode(null); setAmount('') }
    } catch (e) {
      const code = (e as { code?: string; message?: string }).code ?? (e as Error).message ?? ''
      ctx.onToast(`주문하지 못했어요 (${code.slice(0, 40)})`)
    } finally { setBusy(false) }
  }
  const chip = (label: string, v: string) => <button key={label} className="pr-96" onClick={() => setAmount(v)} style={css(`flex:1;height:36px;border-radius:10px;background:${CARD2};color:#fff;font-family:${FONT};font-size:15px;font-weight:600`)}>{label}</button>
  const facts2: [string, string][] = facts ? [['시가', fmtStock(facts.o, index)], ['전일 종가', fmtStock(facts.pc, index)], ['고가', fmtStock(facts.h, index)], ['거래량', fmtVolume(facts.v)], ['저가', fmtStock(facts.l, index)], ['시가총액', fmtCap(facts.cap)], ['52주 최고', fmtStock(facts.hi, index)], ['52주 최저', fmtStock(facts.lo, index)]] : []

  return (
    <div style={css('position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;background:#000;animation:fade 200ms ease both')}>
      {/* the other stocks stay visible above the sheet */}
      <div style={css('flex:none;height:104px;display:flex;gap:28px;overflow-x:auto;padding:14px 20px 0;scrollbar-width:none')}>
        {strip.map(x => (
          <button key={x.s.sym} className="pr-96" onClick={() => onPick(x.s.sym)} style={css(`flex:none;display:flex;gap:10px;align-items:flex-start;background:none;color:#fff;text-align:left;font-family:${FONT}`)}>
            <span style={css('display:flex;flex-direction:column')}>
              <span style={css('font-size:19px;line-height:24px;font-weight:700;max-width:96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{titleOf(x.s)}</span>
              <span style={css('font-size:21px;line-height:26px;font-weight:700')}>{fmtStock(x.price, x.s.market === 'IX')}</span>
              <span style={css(`font-size:19px;line-height:24px;font-weight:700;color:${tone(x.chg)}`)}>{fmtPct(x.chg)}</span>
            </span>
            <Spark values={x.spark} up={x.chg >= 0} w={72} h={34} />
          </button>
        ))}
      </div>
      <div style={css(`flex:1;min-height:0;display:flex;flex-direction:column;border-radius:38px 38px 0 0;background:${CARD};animation:sheetUp 380ms cubic-bezier(0.32,0.72,0,1) both;overflow:hidden`)}>
        <span aria-hidden="true" style={css('flex:none;align-self:center;width:36px;height:5px;margin-top:8px;border-radius:3px;background:rgba(235,235,245,0.3)')} />
        <div style={css('flex:1;min-height:0;overflow-y:auto;padding:12px 20px calc(24px + var(--phone-bottom))')}>
          <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:14px')}>
            <button className="pr-96" onClick={onClose} aria-label="닫기" style={css(`width:48px;height:48px;border-radius:9999px;background:${CARD2};box-shadow:inset 0 0 0 1px ${SEP};color:#fff;display:flex;align-items:center;justify-content:center`)}>
              <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="m2 2 10 10M12 2 2 12" /></svg>
            </button>
            {!index && <span style={css(`height:40px;padding:0 16px;border-radius:20px;background:${CARD2};box-shadow:inset 0 0 0 1px ${SEP};display:flex;align-items:center;font-size:15px;font-weight:600;color:#fff`)}>{uid ? `${points.toLocaleString()}P` : '로그인 필요'}</span>}
          </div>
          <div style={css('font-size:32px;line-height:38px;font-weight:800;letter-spacing:0.2px')}>{titleOf(s)}</div>
          <div style={css(`font-size:17px;line-height:22px;font-weight:600;color:${SEC}`)}>{subOf(s)}</div>
          <div style={css(`height:0.5px;background:${SEP};margin:14px 0`)} />
          <div style={css('display:flex;align-items:baseline;gap:12px;flex-wrap:wrap')}>
            <span style={css('font-size:28px;line-height:34px;font-weight:800;font-variant-numeric:tabular-nums')}>{fmtStock(shown, index)}{index ? '' : <span style={css(`font-size:17px;font-weight:700;color:${SEC}`)}> P</span>}</span>
            <span style={css(`font-size:19px;font-weight:700;color:${tone(change)};font-variant-numeric:tabular-nums`)}>{fmtPct(change)}</span>
          </div>
          <div style={css(`font-size:15px;line-height:20px;color:${SEC};margin-top:2px`)}>{hov != null && data[hov] ? fmtTime(data[hov].t, range) : `${state}${index ? '' : ' · 1P = 1원'}`}</div>
          <div style={css(`height:0.5px;background:${SEP};margin:14px 0 10px`)} />
          <div style={css('display:flex;justify-content:space-between')}>
            {RANGES.map(([k, label]) => (
              <button key={k} className="pr-96" onClick={() => setPick(k)} style={css(`height:40px;padding:0 14px;border-radius:20px;font-family:${FONT};font-size:17px;font-weight:700;background:${range === k ? CARD2 : 'none'};color:#fff`)}>{label}</button>
            ))}
          </div>
          <div style={css('margin-top:8px')}><Chart data={data} range={range} index={index} prev={facts?.pc} onHover={setHov} /></div>

          {facts && (
            <div style={css('display:grid;grid-template-columns:1fr 1fr;column-gap:24px;margin-top:6px')}>
              {facts2.map(([k, v]) => (
                <div key={k} style={css(`display:flex;justify-content:space-between;align-items:baseline;padding:11px 0;border-bottom:0.5px solid ${SEP}`)}>
                  <span style={css(`font-size:15px;color:${SEC}`)}>{k}</span>
                  <span style={css('font-size:17px;font-weight:600;font-variant-numeric:tabular-nums')}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {index ? (
            <span style={css(`display:block;margin-top:18px;font-size:14px;line-height:20px;color:${SEC}`)}>지수는 사고팔 수 없고 보기만 해요</span>
          ) : (
            <div style={css('margin-top:22px;display:flex;flex-direction:column;gap:12px')}>
              {holding && holding.q > 0 && (
                <div style={css(`padding:14px 16px;border-radius:16px;background:${CARD2};display:flex;flex-direction:column;gap:8px;font-variant-numeric:tabular-nums`)}>
                  <span style={css('display:flex;justify-content:space-between;font-size:15px')}><span style={{ color: SEC }}>보유</span><span style={css('font-weight:600')}>{fmtShares(holding.q)}주</span></span>
                  <span style={css('display:flex;justify-content:space-between;font-size:15px')}><span style={{ color: SEC }}>평가금액</span><span style={css('font-weight:600')}>{Math.round(evalNow).toLocaleString()}P</span></span>
                  {holding.c > 0 && <span style={css('display:flex;justify-content:space-between;font-size:15px')}><span style={{ color: SEC }}>수익</span><span style={css(`font-weight:700;color:${tone(evalNow - holding.c)}`)}>{fmtSigned(Math.round(evalNow - holding.c))}P ({fmtPct((evalNow - holding.c) / holding.c)})</span></span>}
                </div>
              )}
              {mode ? (
                <div style={css('display:flex;flex-direction:column;gap:10px')}>
                  <span style={css('font-size:15px;font-weight:600')}>{mode === 'buy' ? `몇 포인트어치 살까요? (쓸 수 있는 포인트 ${points.toLocaleString()}P)` : '얼마나 팔까요?'}</span>
                  <div style={css(`display:flex;align-items:center;gap:8px;height:52px;padding:0 16px;border-radius:14px;background:${CARD2}`)}>
                    <input inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, '').slice(0, 15))} placeholder={mode === 'buy' ? `${MIN_BUY}P 이상` : '0'} aria-label={mode === 'buy' ? '살 포인트' : '팔 퍼센트'} style={css(`flex:1;min-width:0;border:0;outline:none;background:transparent;font-family:${FONT};font-size:20px;font-weight:700;color:#fff;font-variant-numeric:tabular-nums`)} />
                    <span style={css(`font-size:17px;font-weight:600;color:${SEC}`)}>{mode === 'buy' ? 'P' : '%'}</span>
                  </div>
                  <div style={css('display:flex;gap:6px')}>
                    {mode === 'buy' ? [chip('10%', String(Math.floor(points * 0.1))), chip('25%', String(Math.floor(points * 0.25))), chip('50%', String(Math.floor(points * 0.5))), chip('최대', String(points))] : [chip('25%', '25'), chip('50%', '50'), chip('75%', '75'), chip('전부', '100')]}
                  </div>
                  <span style={css(`font-size:14px;color:${SEC};font-variant-numeric:tabular-nums`)}>{mode === 'buy' ? (price && n ? `약 ${fmtShares(floor8(n / price))}주` : ' ') : (price && sellQty ? `${fmtShares(sellQty)}주 → 약 ${Math.floor(sellQty * price).toLocaleString()}P` : ' ')}</span>
                  <div style={css('display:grid;grid-template-columns:1fr 2fr;gap:8px')}>
                    <button className="pr-96" onClick={() => { setMode(null); setAmount('') }} style={css(`height:54px;border-radius:16px;background:${CARD2};color:#fff;font-family:${FONT};font-size:17px;font-weight:600`)}>취소</button>
                    <button className="pr-96" disabled={busy || !(mode === 'buy' ? canBuy : canSell)} onClick={submit} style={{ ...css(`height:54px;border-radius:16px;color:#fff;font-family:${FONT};font-size:17px;font-weight:700;transition:opacity 200ms`), background: mode === 'buy' ? UP : DOWN, opacity: busy || !(mode === 'buy' ? canBuy : canSell) ? 0.4 : 1 }}>{busy ? '체결 중…' : mode === 'buy' ? '매수하기' : '판매하기'}</button>
                  </div>
                </div>
              ) : (
                <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:8px')}>
                  <button className="pr-96" onClick={() => (uid ? (setMode('sell'), setAmount('100')) : ctx.onLogin())} disabled={!!uid && !(holding && holding.q > 0)} style={{ ...css(`height:54px;border-radius:16px;color:#fff;font-family:${FONT};font-size:17px;font-weight:700;transition:opacity 200ms`), background: DOWN, opacity: uid && !(holding && holding.q > 0) ? 0.4 : 1 }}>판매</button>
                  <button className="pr-96" onClick={() => (uid ? (setMode('buy'), setAmount('')) : ctx.onLogin())} disabled={!price} style={{ ...css(`height:54px;border-radius:16px;color:#fff;font-family:${FONT};font-size:17px;font-weight:700;transition:opacity 200ms`), background: UP, opacity: price ? 1 : 0.4 }}>{uid ? '매수' : '로그인하고 사기'}</button>
                </div>
              )}
            </div>
          )}
          <div style={css(`margin-top:22px;font-size:13px;line-height:19px;color:${SEC}`)}>시세는 Yahoo Finance 기준이고 몇 분 늦을 수 있어요. 해외 주식은 지금 환율{live?.fx ? `(1달러 = ${Math.round(live.fx).toLocaleString()}원)` : ''}로 바꿔요.</div>
        </div>
      </div>
    </div>
  )
}

const FILTERS: [Filter, string][] = [['all', '전체'], ['KR', '국내'], ['US', '해외'], ['IX', '지수'], ['mine', '보유']]
const SORTS: [Sort, string][] = [['basic', '기본'], ['up', '변동률 높은 순'], ['down', '변동률 낮은 순'], ['price', '가격 높은 순'], ['name', '이름 순']]

/** The 주식 app. */
export function StockApp({ db, uid, points, onLogin, onToast }: Ctx) {
  const [list, setList] = useState<StockMeta[]>([])
  const [live, setLive] = useState<StockLive>(null)
  const [spark, setSpark] = useState<Record<string, number[]>>({})
  const [info, setInfo] = useState<Record<string, StockFacts>>({})
  const [wallet, setWallet] = useState<Wallet>({})
  const [sel, setSel] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [mode, setMode] = useState<Mode>('pct')
  const [sort, setSort] = useState<Sort>('basic')
  const [menu, setMenu] = useState(false)
  const [searching, setSearching] = useState(false)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<StockStatus>(null)
  const [waited, setWaited] = useState(false)
  useEffect(() => {
    if (!db) return
    const stops = [watchStockList(db, setList), watchStockLive(db, setLive), watchStockSpark(db, setSpark), watchStockInfo(db, setInfo), watchStockStatus(db, setStatus)]
    return () => stops.forEach(s => s())
  }, [db])
  useEffect(() => (db && uid ? watchWallet(db, uid, setWallet) : undefined), [db, uid])
  useEffect(() => { const t = setTimeout(() => setWaited(true), 6000); return () => clearTimeout(t) }, [])

  const price = (sym: string) => live?.p?.[sym]
  const chgOf = (sym: string) => live?.chg?.[sym] ?? 0
  const lineOf = (sym: string) => { const s = spark[sym] ?? []; const p = price(sym); return p ? [...s, p] : s }
  const mine = (sym: string) => (wallet[sym]?.q ?? 0) > 0
  const rows = useMemo(() => {
    let r = list.filter(s => (filter === 'all' || (filter === 'mine' ? mine(s.sym) : s.market === filter)) && price(s.sym) != null)
    const t = q.trim().toLowerCase()
    if (t) r = r.filter(s => s.name.toLowerCase().includes(t) || s.ticker.toLowerCase().includes(t))
    const by = (f: (s: StockMeta) => number) => [...r].sort((a, b) => f(b) - f(a))
    if (sort === 'up') r = by(s => chgOf(s.sym))
    else if (sort === 'down') r = by(s => -chgOf(s.sym))
    else if (sort === 'price') r = by(s => price(s.sym) ?? 0)
    else if (sort === 'name') r = [...r].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    else r = [...r].sort((a, b) => (a.market === 'IX' ? 0 : 1) - (b.market === 'IX' ? 0 : 1) || a.rank - b.rank)
    return r
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, live, filter, q, sort, wallet])

  const cur = sel ? list.find(s => s.sym === sel) : undefined
  const strip = useMemo(() => [...list].sort((a, b) => (a.market === 'IX' ? 0 : 1) - (b.market === 'IX' ? 0 : 1) || a.rank - b.rank).filter(s => price(s.sym) != null).slice(0, 12).map(s => ({ s, price: price(s.sym), chg: chgOf(s.sym), spark: lineOf(s.sym) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, live, spark])
  const today = new Date()
  const states = live?.st ? `국내 ${stateLabel(live.st.KR)} · 해외 ${stateLabel(live.st.US)}` : ''
  const pillText = (s: StockMeta) => {
    const p = price(s.sym) ?? 0, c = chgOf(s.sym)
    if (mode === 'cap') return s.market === 'IX' ? '--' : fmtCap(info[s.sym]?.cap)
    if (mode === 'won') return fmtSigned(Math.round((p - p / (1 + c)) * 100) / 100, s.market === 'IX')
    return fmtPct(c)
  }
  const btn = (label: string, on: boolean, f: () => void) => <button key={label} className="pr-96" onClick={f} style={css(`flex:none;height:36px;padding:0 16px;border-radius:18px;font-family:${FONT};font-size:16px;font-weight:600;background:${on ? CARD2 : 'none'};color:${on ? '#fff' : SEC}`)}>{label}</button>

  return (
    <div style={css(`position:relative;height:calc(100% + var(--phone-bottom));margin-bottom:calc(-1 * var(--phone-bottom));display:flex;flex-direction:column;background:#000;color:#fff;font-family:${FONT};overflow:hidden`)}>
      <div style={css('flex:1;min-height:0;overflow-y:auto;padding:4px 20px calc(28px + var(--phone-bottom))')}>
        <div style={css('display:flex;align-items:flex-start;justify-content:space-between;padding-top:4px')}>
          <span style={css('display:flex;flex-direction:column;font-size:34px;line-height:40px;font-weight:800;letter-spacing:0.3px')}>
            <span>주식</span>
            <span style={css(`color:${SEC}`)}>{today.getMonth() + 1}월 {today.getDate()}일</span>
          </span>
          <span style={css(`flex:none;position:relative;display:flex;height:50px;border-radius:25px;background:${CARD};box-shadow:inset 0 0 0 1px ${SEP}`)}>
            <button className="pr-96" onClick={() => { setSearching(s => !s); setQ('') }} aria-label="검색" style={css('width:70px;display:flex;align-items:center;justify-content:center;color:#fff')}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
            </button>
            <button className="pr-96" onClick={() => setMenu(m => !m)} aria-label="정렬" style={css('width:70px;display:flex;align-items:center;justify-content:center;color:#fff')}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2.3" /><circle cx="12" cy="12" r="2.3" /><circle cx="19" cy="12" r="2.3" /></svg>
            </button>
            {menu && (
              <span role="menu" style={css(`position:absolute;z-index:5;top:58px;right:0;width:200px;border-radius:16px;background:${CARD2};box-shadow:0 8px 28px rgba(0,0,0,0.5);overflow:hidden;animation:fade 140ms ease both`)}>
                {SORTS.map(([k, label]) => (
                  <button key={k} role="menuitem" className="pr-96" onClick={() => { setSort(k); setMenu(false) }} style={css(`width:100%;height:44px;padding:0 16px;display:flex;align-items:center;justify-content:space-between;font-family:${FONT};font-size:16px;color:#fff;border-bottom:0.5px solid ${SEP}`)}>{label}{sort === k && <span style={{ color: BLUE }}>✓</span>}</button>
                ))}
                {([['pct', '변동률 보기'], ['won', '변동 금액 보기'], ['cap', '시가총액 보기']] as [Mode, string][]).map(([k, label]) => (
                  <button key={k} role="menuitem" className="pr-96" onClick={() => { setMode(k); setMenu(false) }} style={css(`width:100%;height:44px;padding:0 16px;display:flex;align-items:center;justify-content:space-between;font-family:${FONT};font-size:16px;color:#fff;border-bottom:0.5px solid ${SEP}`)}>{label}{mode === k && <span style={{ color: BLUE }}>✓</span>}</button>
                ))}
              </span>
            )}
          </span>
        </div>
        {searching && (
          <div style={css(`margin-top:14px;height:40px;display:flex;align-items:center;gap:8px;padding:0 14px;border-radius:12px;background:${CARD}`)}>
            <input value={q} onChange={e => setQ(e.target.value.slice(0, 20))} placeholder="종목 이름이나 코드" aria-label="종목 검색" style={css(`flex:1;min-width:0;border:0;outline:none;background:transparent;font-family:${FONT};font-size:17px;color:#fff`)} />
            <button className="pr-96" onClick={() => { setSearching(false); setQ('') }} style={css(`color:${BLUE};font-family:${FONT};font-size:16px`)}>취소</button>
          </div>
        )}
        <div style={css('display:flex;gap:4px;margin:14px -8px 6px;overflow-x:auto;scrollbar-width:none')}>
          {FILTERS.map(([k, label]) => btn(label, filter === k, () => setFilter(k)))}
        </div>
        {!rows.length ? (
          <div style={css(`padding:64px 0;text-align:center;font-size:16px;line-height:24px;color:${SEC}`)}>
            {list.length && live ? (filter === 'mine' ? '가진 주식이 없어요' : '찾는 종목이 없어요')
              : status && !status.ok ? <>시세를 가져오지 못했어요<br /><span style={css(`font-size:14px;color:${SEC}`)}>{status.msg}</span><br /><span style={css(`font-size:14px;color:${SEC}`)}>잠시 뒤에 다시 열어보세요. 자동으로 계속 다시 시도해요</span></>
              : waited ? <>시세를 받아오는 중이에요<br /><span style={css(`font-size:14px;color:${SEC}`)}>처음에는 1~2분 걸릴 수 있어요</span></>
              : '시세를 불러오는 중이에요…'}
          </div>
        ) : rows.map(s => {
          const p = price(s.sym), c = chgOf(s.sym), ix = s.market === 'IX'
          return (
            <button key={s.sym} className="pr-dim" onClick={() => setSel(s.sym)} style={css(`width:100%;display:flex;align-items:center;gap:8px;padding:12px 0;border-bottom:0.5px solid ${SEP};background:none;color:#fff;text-align:left;font-family:${FONT}`)}>
              <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:1px')}>
                <span style={css('display:flex;align-items:center;gap:6px;font-size:21px;line-height:26px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{titleOf(s)}{mine(s.sym) && <span aria-label="보유" style={css(`flex:none;width:7px;height:7px;border-radius:9999px;background:${BLUE}`)} />}</span>
                <span style={css(`font-size:15px;line-height:20px;font-weight:600;color:${SEC};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>{subOf(s)}</span>
              </span>
              <Spark values={lineOf(s.sym)} up={c >= 0} />
              <span style={css('flex:none;width:104px;display:flex;flex-direction:column;align-items:flex-end;gap:4px')}>
                <span style={css('font-size:20px;line-height:24px;font-weight:700;font-variant-numeric:tabular-nums')}>{fmtStock(p, ix)}</span>
                <span onClick={e => { e.stopPropagation(); setMode(m => (m === 'pct' ? 'won' : m === 'won' ? 'cap' : 'pct')) }} role="button" aria-label="표시 바꾸기" style={css(`min-width:84px;height:30px;padding:0 8px;box-sizing:border-box;border-radius:8px;display:flex;align-items:center;justify-content:center;background:${mode === 'cap' ? '#48484a' : tone(c)};font-size:16px;font-weight:700;font-variant-numeric:tabular-nums`)}>{pillText(s)}</span>
              </span>
            </button>
          )
        })}
        <div style={css(`margin-top:22px;font-size:13px;line-height:19px;color:${SEC}`)}>
          {states && <div>{states}</div>}
          <div>1포인트 = 1원 · 시세는 Yahoo Finance 기준이고 몇 분 늦을 수 있어요</div>
        </div>
      </div>
      {cur && (
        <Detail key="detail" s={cur} price={price(cur.sym)} chg={chgOf(cur.sym)} facts={info[cur.sym]} live={live} holding={wallet[cur.sym]} strip={strip} onPick={setSel} onClose={() => setSel(null)} ctx={{ db, uid, points, onLogin, onToast }} />
      )}
    </div>
  )
}

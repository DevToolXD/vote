import { useEffect, useRef, useState } from 'react'
import type { Firestore } from 'firebase/firestore'
import { css, sx } from '../css'
import { BottomSheet } from './Overlays'
import { COINS, MIN_BUY, buyCoin, fmtPrice, fmtQty, floor8, sellCoin, watchHistory, watchLive, watchTrades, watchWallet, type CoinSym, type Live, type Point, type Trade, type Wallet } from '../backend/coins'

// 코인 탭: made-up coins with random prices, bought and sold with points.
// Korean convention: up = red, down = blue.
const UP = '#f04452', DOWN = '#3182f6', FLAT = '#8b95a1'
const EASE = 'cubic-bezier(0.22,1,0.36,1)'
const tone = (d: number) => (d > 0 ? UP : d < 0 ? DOWN : FLAT)
const pct = (d: number) => `${d > 0 ? '+' : ''}${(d * 100).toFixed(2)}%`
const signed = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n).toLocaleString()}`

type Props = {
  db: Firestore | null
  uid: string | null
  points: number
  onLogin: () => void
  onToast: (msg: string) => void
}

function CoinIcon({ sym, size = 40 }: { sym: CoinSym; size?: number }) {
  const c = COINS.find(x => x.sym === sym)!
  return (
    <span aria-hidden="true" style={sx('flex:none;border-radius:9999px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800', { width: size, height: size, background: c.color, fontSize: size * 0.48 })}>{c.mark}</span>
  )
}

/** Price line (red when it ended up, blue when down) with a drag-to-read cursor. */
function Chart({ data, height = 180, interactive = true }: { data: number[]; height?: number; interactive?: boolean }) {
  const W = 340
  const [cur, setCur] = useState<number | null>(null)
  const box = useRef<SVGSVGElement>(null)
  if (data.length < 2) return <div style={sx('display:flex;align-items:center;justify-content:center;color:#8b95a1;font-size:14px', { height })}>가격을 모으는 중이에요</div>
  const min = Math.min(...data), max = Math.max(...data), span = max - min || max * 0.01 || 1
  const x = (i: number) => (i / (data.length - 1)) * W
  const y = (v: number) => 8 + (1 - (v - min) / span) * (height - 16)
  const line = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const color = tone(data[data.length - 1] - data[0])
  const gid = `cg${color.slice(1)}`
  const pick = (clientX: number) => {
    const r = box.current?.getBoundingClientRect()
    if (!r) return
    setCur(Math.max(0, Math.min(data.length - 1, Math.round(((clientX - r.left) / r.width) * (data.length - 1)))))
  }
  return (
    <div style={css('position:relative')}>
      <svg ref={box} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" width="100%" height={height} style={css('display:block;touch-action:pan-y')}
        onPointerDown={interactive ? e => pick(e.clientX) : undefined} onPointerMove={interactive ? e => (e.buttons || e.pointerType === 'touch') && pick(e.clientX) : undefined}
        onPointerLeave={() => setCur(null)} onPointerUp={() => setCur(null)}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.18" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line}L${W},${height}L0,${height}Z`} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {cur != null && <line x1={x(cur)} x2={x(cur)} y1="0" y2={height} stroke="#b0b8c1" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="3 3" />}
      </svg>
      {cur != null && (
        <span style={sx('position:absolute;top:-6px;transform:translateX(-50%);padding:4px 8px;border-radius:8px;background:#191f28;color:#fff;font-size:12px;font-weight:600;white-space:nowrap;pointer-events:none', { left: `${Math.min(85, Math.max(15, (cur / (data.length - 1)) * 100))}%` })}>
          {fmtPrice(data[cur])}P
        </span>
      )}
    </div>
  )
}

/** Tiny line for the list. */
function Spark({ data }: { data: number[] }) {
  if (data.length < 2) return <span style={{ width: 56 }} />
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1
  const d = data.map((v, i) => `${i ? 'L' : 'M'}${((i / (data.length - 1)) * 56).toFixed(1)},${(2 + (1 - (v - min) / span) * 24).toFixed(1)}`).join('')
  return <svg width="56" height="28" viewBox="0 0 56 28" style={css('flex:none')}><path d={d} fill="none" stroke={tone(data[data.length - 1] - data[0])} strokeWidth="1.6" strokeLinejoin="round" /></svg>
}

/** Chart ranges, in price samples (one every 15 s): 1 h = 240, 6 h = 1440, 24 h = 5760. */
const RANGES: [string, number][] = [['1시간', 240], ['6시간', 1440], ['하루', 5760]]
/** Longer series are thinned to about this many points so the chart stays light. */
const MAX_POINTS = 400

export function CoinScreen({ db, uid, points, onLogin, onToast }: Props) {
  const [live, setLive] = useState<Live>(null)
  const [hist, setHist] = useState<Point[]>([])
  const [wallet, setWallet] = useState<Wallet>({})
  const [open, setOpen] = useState<CoinSym | null>(null)
  const [mineOpen, setMineOpen] = useState(false)
  useEffect(() => (db ? watchLive(db, setLive) : undefined), [db])
  useEffect(() => (db ? watchHistory(db, 5760, setHist) : undefined), [db])
  useEffect(() => { setWallet({}); return db && uid ? watchWallet(db, uid, setWallet) : undefined }, [db, uid])

  const price = (s: CoinSym) => live?.p?.[s] ?? hist[hist.length - 1]?.p?.[s]
  const series = (s: CoinSym, samples: number) => {
    const raw = hist.slice(-samples).map(h => h.p?.[s]).filter((v): v is number => typeof v === 'number')
    const step = Math.max(1, Math.ceil(raw.length / MAX_POINTS))
    const out = raw.filter((_, i) => i % step === 0)
    const p = live?.p?.[s]
    if (p != null) out.push(p)
    return out
  }
  const dayChange = (s: CoinSym) => {
    const first = hist[0]?.p?.[s], p = price(s)
    return first && p ? (p - first) / first : 0
  }

  let evalSum = 0, costSum = 0
  for (const c of COINS) {
    const h = wallet[c.sym], p = price(c.sym)
    if (h && p) { evalSum += h.q * p; costSum += h.c }
  }
  const pl = evalSum - costSum

  if (!uid) {
    return (
      <div className="anim-list" style={css('flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:48px 24px;text-align:center')}>
        <span style={css('font-size:48px')}>🪙</span>
        <span style={css('margin-top:12px;font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>포인트로 코인을 사고팔아요</span>
        <span style={css('font-size:15px;line-height:22.5px;color:#6b7684')}>로그인하면 바로 시작할 수 있어요</span>
        <button className="pr-96" onClick={onLogin} style={css('margin-top:16px;height:44px;padding:0 20px;border-radius:12px;background:#3182f6;color:#fff;font-size:16px;font-weight:600')}>로그인하기</button>
      </div>
    )
  }

  return (
    <div className="anim-list" style={css('display:flex;flex-direction:column;width:100%;min-width:0;overflow-x:hidden')}>
      <div style={css('padding:24px 24px 4px')}>
        <h1 style={css('margin:0;font-size:22px;line-height:31px;font-weight:700;color:#191f28')}>코인</h1>
        <div style={css('font-size:15px;line-height:22.5px;color:#6b7684')}>가상 코인이라 실제 시세와는 상관없어요</div>
      </div>

      <button data-g="l1" className="pr-96" onClick={() => setMineOpen(true)} aria-label="내 코인 보기" style={css('margin:16px 20px 8px;padding:20px;border-radius:20px;background:#f9fafb;display:flex;flex-direction:column;gap:12px;text-align:left;width:calc(100% - 40px)')}>
        <div style={css('display:flex;flex-direction:column;gap:2px')}>
          <span style={css('display:flex;align-items:center;gap:4px;font-size:14px;color:#6b7684')}>내 코인 평가금액 <span aria-hidden="true">›</span></span>
          <span style={css('font-size:26px;line-height:34px;font-weight:700;color:#191f28;font-variant-numeric:tabular-nums')}>{Math.round(evalSum).toLocaleString()}P</span>
          {costSum > 0 && <span style={sx('font-size:15px;font-weight:600;font-variant-numeric:tabular-nums', { color: tone(pl) })}>{signed(pl)}P ({pct(pl / costSum)})</span>}
        </div>
        <div style={css('height:1px;background:#eef0f3')} />
        <div style={css('display:flex;justify-content:space-between;font-size:15px')}>
          <span style={{ color: '#6b7684' }}>쓸 수 있는 포인트</span>
          <span style={css('font-weight:700;color:#191f28;font-variant-numeric:tabular-nums')}>{points.toLocaleString()}P</span>
        </div>
      </button>

      <div style={css('padding:16px 24px 4px;font-size:17px;font-weight:700;color:#191f28')}>코인 시세</div>
      {/* highest price first; 정후교 대천재 코인 is not in this list */}
      {COINS.filter(c => c.sym !== 'JEONG').sort((x, y) => (price(y.sym) ?? 0) - (price(x.sym) ?? 0)).map(c => {
        const p = price(c.sym), ch = dayChange(c.sym), h = wallet[c.sym]
        return (
          <button key={c.sym} className="pr-dim" onClick={() => setOpen(c.sym)} style={css(`display:flex;align-items:center;gap:14px;padding:12px 20px 12px 24px;margin:0 4px;border-radius:12px;text-align:left;transition:background 200ms ${EASE}`)}>
            <CoinIcon sym={c.sym} />
            <span style={css('flex:1;min-width:0;display:flex;flex-direction:column')}>
              <span style={css('font-size:17px;line-height:25.5px;font-weight:600;color:#191f28')}>{c.name}</span>
              <span style={css('font-size:13px;line-height:19.5px;color:#8b95a1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{h ? `${fmtQty(h.q)} ${c.sym} 보유` : c.sym}</span>
            </span>
            <Spark data={series(c.sym, 240)} />
            <span style={css('flex:none;min-width:88px;display:flex;flex-direction:column;align-items:flex-end;font-variant-numeric:tabular-nums')}>
              <span style={css('font-size:16px;line-height:24px;font-weight:600;color:#191f28')}>{fmtPrice(p)}P</span>
              <span style={sx('font-size:13px;line-height:19.5px;font-weight:600', { color: tone(ch) })}>{pct(ch)}</span>
            </span>
          </button>
        )
      })}
      <div style={css('padding:16px 24px 24px;font-size:13px;line-height:19.5px;color:#8b95a1')}>
        가격은 몇 초마다 무작위로 움직여요. 사고팔 때는 그 순간의 가격으로 체결되고, 오르든 내리든 포인트로 돌아와요.
      </div>

      {mineOpen && (
        <BottomSheet onScrim={() => setMineOpen(false)} scrim="rgba(0,0,0,0.25)" sheetStyle={`border-radius:28px 28px 0 0;padding:8px 0 calc(20px + env(safe-area-inset-bottom));animation:sheetUp 420ms ${EASE} both`}>
          <div style={css('width:36px;height:4px;border-radius:2px;background:#e5e8eb;margin:0 auto')} />
          <div style={css('padding:18px 24px 8px;display:flex;flex-direction:column;gap:2px')}>
            <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>내 코인</span>
            <span style={css('font-size:15px;color:#6b7684;font-variant-numeric:tabular-nums')}>평가금액 {Math.round(evalSum).toLocaleString()}P{costSum > 0 ? ` · ${signed(pl)}P (${pct(pl / costSum)})` : ''}</span>
          </div>
          {COINS.filter(c => (wallet[c.sym]?.q ?? 0) > 0).length === 0 ? (
            <span style={css('display:block;padding:24px;font-size:15px;color:#8b95a1;text-align:center')}>가진 코인이 없어요</span>
          ) : COINS.filter(c => (wallet[c.sym]?.q ?? 0) > 0).map(c => {
            const h = wallet[c.sym]!, p = price(c.sym) ?? 0, ev = h.q * p, gain = h.c > 0 ? (ev - h.c) / h.c : 0
            return (
              <button key={c.sym} className="pr-dim" onClick={() => { setMineOpen(false); setOpen(c.sym) }} style={css('display:flex;align-items:center;gap:14px;padding:12px 24px;width:100%;text-align:left')}>
                <CoinIcon sym={c.sym} />
                <span style={css('flex:1;min-width:0;display:flex;flex-direction:column')}>
                  <span style={css('font-size:16px;font-weight:600;color:#191f28')}>{c.name}</span>
                  <span style={css('font-size:13px;color:#8b95a1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums')}>{fmtQty(h.q)} {c.sym}</span>
                </span>
                <span style={css('flex:none;display:flex;flex-direction:column;align-items:flex-end;font-variant-numeric:tabular-nums')}>
                  <span style={css('font-size:16px;font-weight:600;color:#191f28')}>{Math.round(ev).toLocaleString()}P</span>
                  {h.c > 0 && <span style={sx('font-size:13px;font-weight:600', { color: tone(gain) })}>{pct(gain)}</span>}
                </span>
              </button>
            )
          })}
        </BottomSheet>
      )}
      {open && db && (
        <CoinSheet
          sym={open} db={db} uid={uid} points={points} price={price(open)} wallet={wallet} onToast={onToast}
          series={m => series(open, m)} change={dayChange(open)} onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}

function CoinSheet({ sym, db, uid, points, price, wallet, series, change, onToast, onClose }: {
  sym: CoinSym; db: Firestore; uid: string; points: number; price: number | undefined; wallet: Wallet
  series: (minutes: number) => number[]; change: number; onToast: (m: string) => void; onClose: () => void
}) {
  const c = COINS.find(x => x.sym === sym)!
  const [range, setRange] = useState(60)
  const [trades, setTrades] = useState<Trade[] | null>(null)
  useEffect(() => watchTrades(db, sym, setTrades), [db, sym])
  const [mode, setMode] = useState<'buy' | 'sell' | null>(null)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const h = wallet[sym]
  const evalNow = h && price ? h.q * price : 0
  const data = series(range)

  const n = Number(amount.replace(/,/g, '')) || 0
  // buy: n points; sell: n percent of what's held
  const sellQty = h ? floor8(n >= 100 ? h.q : h.q * (n / 100)) : 0
  const canBuy = n >= MIN_BUY && n <= points && !!price
  const canSell = !!h && sellQty > 0 && !!price

  const submit = async () => {
    if (busy) return
    setBusy(true)
    try {
      const r = mode === 'buy' ? await buyCoin(db, uid, sym, n) : await sellCoin(db, uid, sym, sellQty)
      if (r.status === 'done') {
        onToast(mode === 'buy' ? `${c.name} ${fmtQty(r.qty ?? 0)}개를 ${fmtPrice(r.price)}P에 샀어요` : `${c.name}을 팔아서 ${(r.points ?? 0).toLocaleString()}P를 받았어요`)
        setMode(null); setAmount('')
      } else if (r.status === 'failed') onToast(r.reason === 'not-enough' ? '가진 코인보다 많이 팔 수 없어요' : '체결하지 못했어요')
      else { onToast('주문을 넣었어요. 잠시 뒤에 체결돼요'); setMode(null); setAmount('') }
    } catch (e) {
      // the reason is shown so it can be reported exactly (e.g. permission-denied)
      const code = (e as { code?: string; message?: string }).code ?? (e as Error).message ?? ''
      onToast(`주문하지 못했어요 (${code.slice(0, 40)})`)
    } finally {
      setBusy(false)
    }
  }

  const chip = (label: string, v: string) => (
    <button key={label} className="pr-96" onClick={() => setAmount(v)} style={css('flex:1;height:36px;border-radius:10px;background:#f2f4f6;color:#4e5968;font-size:14px;font-weight:600')}>{label}</button>
  )

  return (
    <BottomSheet onScrim={onClose} scrim="rgba(0,0,0,0.25)" sheetStyle={`border-radius:28px 28px 0 0;padding:8px 0 calc(20px + env(safe-area-inset-bottom));animation:sheetUp 420ms ${EASE} both`}>
      <div style={css('width:36px;height:4px;border-radius:2px;background:#e5e8eb;margin:0 auto')} />
      <div style={css('padding:18px 24px 8px;display:flex;align-items:center;gap:12px')}>
        <CoinIcon sym={sym} size={36} />
        <span style={css('flex:1;min-width:0;display:flex;flex-direction:column')}>
          <span style={css('font-size:15px;color:#6b7684')}>{c.name} · {sym}</span>
          <span style={css('font-size:26px;line-height:34px;font-weight:700;color:#191f28;font-variant-numeric:tabular-nums')}>{fmtPrice(price)}P</span>
        </span>
        <span style={sx('font-size:15px;font-weight:700;font-variant-numeric:tabular-nums', { color: tone(change) })}>{pct(change)}</span>
      </div>
      <div style={css('padding:8px 16px 0')}><Chart data={data} /></div>
      <div style={css('margin:8px 24px 0;padding:4px;border-radius:12px;background:#f2f4f6;display:grid;grid-template-columns:repeat(3,1fr);gap:4px')}>
        {RANGES.map(([l, m]) => (
          <button key={m} onClick={() => setRange(m)} style={sx('height:32px;border-radius:9px;font-size:14px;font-weight:600;transition:background 200ms,color 200ms', { background: range === m ? '#fff' : 'transparent', color: range === m ? '#191f28' : '#6b7684', boxShadow: range === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' })}>{l}</button>
        ))}
      </div>

      <div style={css('margin:16px 24px 0;padding:16px;border-radius:16px;background:#f9fafb;display:flex;flex-direction:column;gap:8px;font-size:15px;font-variant-numeric:tabular-nums')}>
        <span style={css('display:flex;justify-content:space-between')}><span style={{ color: '#6b7684' }}>보유 수량</span><span style={css('font-weight:600;color:#191f28')}>{h ? `${fmtQty(h.q)} ${sym}` : '없어요'}</span></span>
        {h && <span style={css('display:flex;justify-content:space-between')}><span style={{ color: '#6b7684' }}>평가금액</span><span style={css('font-weight:600;color:#191f28')}>{Math.round(evalNow).toLocaleString()}P</span></span>}
        {h && h.c > 0 && <span style={css('display:flex;justify-content:space-between')}><span style={{ color: '#6b7684' }}>수익</span><span style={sx('font-weight:700', { color: tone(evalNow - h.c) })}>{signed(evalNow - h.c)}P ({pct((evalNow - h.c) / h.c)})</span></span>}
      </div>

      <div style={css('margin:20px 24px 0;display:flex;flex-direction:column;gap:4px')}>
        <span style={css('font-size:17px;line-height:25.5px;font-weight:700;color:#191f28')}>최근 거래</span>
        {trades == null ? null : trades.length === 0 ? (
          <span style={css('padding:12px 0;font-size:15px;color:#8b95a1')}>아직 거래가 없어요</span>
        ) : trades.slice(0, 20).map(t => (
          <div key={t.id} style={css('display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f2f4f6')}>
            <span style={sx('flex:none;width:44px;height:24px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff', { background: t.side === 'buy' ? UP : DOWN })}>{t.side === 'buy' ? '샀어요' : '팔았어요'}</span>
            <span style={css('flex:1;min-width:0;display:flex;flex-direction:column')}>
              <span style={css('font-size:15px;font-weight:600;color:#191f28;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{t.name}</span>
              <span style={css('font-size:13px;color:#8b95a1;font-variant-numeric:tabular-nums')}>{fmtQty(t.qty)} {sym} · @{fmtPrice(t.price)}P</span>
            </span>
            <span style={css('flex:none;font-size:15px;font-weight:600;color:#191f28;font-variant-numeric:tabular-nums')}>{t.points.toLocaleString()}P</span>
          </div>
        ))}
      </div>
      {mode ? (
        <div style={css('margin:16px 24px 0;display:flex;flex-direction:column;gap:10px')}>
          <span style={css('font-size:15px;font-weight:600;color:#191f28')}>{mode === 'buy' ? `몇 포인트어치 살까요? (쓸 수 있는 포인트 ${points.toLocaleString()}P)` : '얼마나 팔까요?'}</span>
          <div style={css('display:flex;align-items:center;gap:8px;height:52px;padding:0 16px;border-radius:14px;background:#f2f4f6')}>
            <input inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, '').slice(0, 15))} placeholder={mode === 'buy' ? `${MIN_BUY}P 이상` : '0'} autoFocus
              style={css('flex:1;min-width:0;border:0;outline:none;background:transparent;font-size:20px;font-weight:700;color:#191f28;font-variant-numeric:tabular-nums')} />
            <span style={css('font-size:17px;font-weight:600;color:#6b7684')}>{mode === 'buy' ? 'P' : '%'}</span>
          </div>
          <div style={css('display:flex;gap:6px')}>
            {mode === 'buy'
              ? [chip('10%', String(Math.floor(points * 0.1))), chip('25%', String(Math.floor(points * 0.25))), chip('50%', String(Math.floor(points * 0.5))), chip('최대', String(points))]
              : [chip('25%', '25'), chip('50%', '50'), chip('75%', '75'), chip('전부', '100')]}
          </div>
          <span style={css('font-size:14px;color:#6b7684;font-variant-numeric:tabular-nums')}>
            {mode === 'buy'
              ? (price && n ? `약 ${fmtQty(floor8(n / price))} ${sym}` : ' ')
              : (price && sellQty ? `${fmtQty(sellQty)} ${sym} → 약 ${Math.floor(sellQty * price).toLocaleString()}P` : ' ')}
          </span>
          <div style={css('display:grid;grid-template-columns:1fr 2fr;gap:8px')}>
            <button data-g="secondary" className="pr-96" onClick={() => { setMode(null); setAmount('') }} style={css('height:56px;border-radius:16px;background:#f2f4f6;color:#4e5968;font-size:17px;font-weight:600')}>취소</button>
            <button className="pr-96" disabled={busy || !(mode === 'buy' ? canBuy : canSell)} onClick={submit}
              style={sx('height:56px;border-radius:16px;color:#fff;font-size:17px;font-weight:600;transition:opacity 200ms', { background: mode === 'buy' ? UP : DOWN, opacity: busy || !(mode === 'buy' ? canBuy : canSell) ? 0.4 : 1 })}>
              {busy ? '체결 중…' : mode === 'buy' ? '구매하기' : '판매하기'}
            </button>
          </div>
        </div>
      ) : (
        <div style={css('margin:16px 24px 0;display:grid;grid-template-columns:1fr 1fr;gap:8px')}>
          <button className="pr-96" onClick={() => { setMode('sell'); setAmount('100') }} disabled={!h} style={sx('height:56px;border-radius:16px;color:#fff;font-size:17px;font-weight:600;transition:opacity 200ms', { background: DOWN, opacity: h ? 1 : 0.4 })}>판매</button>
          <button className="pr-96" onClick={() => { setMode('buy'); setAmount('') }} style={css(`height:56px;border-radius:16px;background:${UP};color:#fff;font-size:17px;font-weight:600`)}>구매</button>
        </div>
      )}
    </BottomSheet>
  )
}

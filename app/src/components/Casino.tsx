import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { css, sx } from '../css'
import type { Bet } from '../backend/gamble'
import { shortPoints } from './PointsChip'

type Props = {
  points: number
  onBet: (amount: number) => Promise<Bet | null>
  onClose: () => void
}

type Round = { pick: number; bet: Bet; faces: ('win' | 'lose')[] }

/** Digits of a whole number, even past 2^53 (1.7e40 → "17000…"). */
const digits = (n: number) => (Number.isInteger(n) ? BigInt(n).toString() : String(Math.floor(n)))
const GOLD = '#ffd66b'
const CARDS = [0, 1, 2, 3]

/**
 * 몰래 도박장 (long-press 정후교 on the ranking): pick one of four face-down cards with a bet on
 * it; two cards in four are ×2. The server decides (backend/gamble.ts) — the cards only show it.
 */
export function Casino({ points, onBet, onClose }: Props) {
  const [amount, setAmount] = useState(0)
  const [busy, setBusy] = useState<number | null>(null)
  const [round, setRound] = useState<Round | null>(null)
  const [log, setLog] = useState<{ d: number; key: number }[]>([])
  useEffect(() => { if (amount > points) setAmount(points) }, [points, amount])

  const add = (n: number) => setAmount(a => Math.min(points, a + n))
  const ok = amount >= 1 && amount <= points && busy === null && !round
  const pickCard = async (i: number) => {
    if (!ok) return
    setBusy(i)
    try {
      const bet = await onBet(amount)
      if (!bet) return
      // the other three faces hold the rest: two ×2 in all, so one more in a win, both in a loss
      const others = CARDS.filter(x => x !== i).sort(() => Math.random() - 0.5).slice(0, bet.won ? 1 : 2)
      const faces = CARDS.map(x => (x === i ? (bet.won ? 'win' : 'lose') : others.includes(x) ? 'win' : 'lose')) as Round['faces']
      setRound({ pick: i, bet, faces })
      setLog(l => [{ d: bet.won ? bet.amount : -bet.amount, key: Date.now() }, ...l].slice(0, 8))
    } finally {
      setBusy(null)
    }
  }

  return createPortal(
    <div style={css('position:fixed;inset:0;z-index:300;display:flex;justify-content:center;background:rgba(0,0,0,0.6);animation:fade 200ms ease both')}>
      <div style={css('position:relative;width:100%;max-width:var(--app-w);height:100%;overflow-y:auto;color:#fff;background:radial-gradient(120% 60% at 50% 0%,#3a0d4d 0%,#16051f 45%,#07020b 100%);animation:popIn 320ms cubic-bezier(0.22,1,0.36,1) both')}>
        {/* neon sign lights */}
        <div aria-hidden="true" style={css('position:absolute;left:0;right:0;top:0;height:6px;background:repeating-linear-gradient(90deg,#ffd66b 0 6px,transparent 6px 18px);opacity:0.8;animation:csBulbs 0.8s steps(2) infinite')} />
        <div style={css('height:56px;padding:0 8px;display:flex;align-items:center')}>
          <button className="pr-dim" onClick={onClose} aria-label="나가기" style={css('width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px')}>✕</button>
          <span style={css('flex:1;text-align:center;font-size:13px;color:rgba(255,255,255,0.55);margin-right:44px')}>🤫 아무한테도 말하지 마</span>
        </div>

        <div style={css('padding:4px 24px 0;text-align:center;display:flex;flex-direction:column;gap:6px')}>
          <span style={css(`font-size:34px;line-height:42px;font-weight:900;letter-spacing:-0.5px;color:${GOLD};text-shadow:0 0 8px rgba(255,214,107,0.9),0 0 22px rgba(255,120,200,0.7);animation:csNeon 2.4s ease-in-out infinite`)}>🎰 몰래 도박장</span>
          <span style={css('font-size:15px;line-height:22px;color:rgba(255,255,255,0.72)')}>카드 4장 중 2장이 <b style={css(`color:${GOLD}`)}>2배</b>. 금액 정하고 카드를 골라</span>
        </div>

        <div style={css('margin:20px 24px 0;padding:14px 18px;border-radius:18px;background:rgba(255,255,255,0.07);box-shadow:inset 0 0 0 1px rgba(255,214,107,0.25);display:flex;align-items:baseline;gap:8px')}>
          <span style={css('font-size:14px;color:rgba(255,255,255,0.6)')}>내 포인트</span>
          <span style={css(`margin-left:auto;font-size:22px;font-weight:800;color:${GOLD};font-variant-numeric:tabular-nums`)}>{shortPoints(points)}P</span>
        </div>

        {/* the cards */}
        <div style={css('display:flex;justify-content:center;gap:10px;padding:24px 16px 8px;perspective:800px')}>
          {CARDS.map(i => {
            const face = round?.faces[i]
            const mine = round?.pick === i
            return (
              <button
                key={i} onClick={() => pickCard(i)} disabled={!ok} aria-label={`${i + 1}번 카드`}
                style={sx('position:relative;width:76px;height:110px;padding:0;border-radius:14px;transform-style:preserve-3d;transition:transform 600ms cubic-bezier(0.22,1,0.36,1)', {
                  transform: `${face ? 'rotateY(180deg)' : 'none'} ${mine ? 'translateY(-8px)' : ''}`,
                  animation: busy === i ? 'csShake 0.35s ease-in-out infinite' : undefined,
                  transitionDelay: round && !mine ? '350ms' : '0ms',
                })}
              >
                {/* back */}
                <span style={css(`position:absolute;inset:0;border-radius:14px;backface-visibility:hidden;-webkit-backface-visibility:hidden;background:repeating-linear-gradient(45deg,#7a1fa2 0 8px,#5a137a 8px 16px);box-shadow:inset 0 0 0 3px ${GOLD},0 8px 20px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;font-size:38px;font-weight:900;color:${GOLD};text-shadow:0 0 10px rgba(255,214,107,0.8)`)}>?</span>
                {/* face */}
                <span style={sx('position:absolute;inset:0;border-radius:14px;backface-visibility:hidden;-webkit-backface-visibility:hidden;transform:rotateY(180deg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-weight:900', {
                  background: face === 'win' ? 'linear-gradient(160deg,#fff4c2,#ffc93c)' : 'linear-gradient(160deg,#3b3b46,#1c1c24)',
                  color: face === 'win' ? '#6b3b00' : '#9aa0ab',
                  boxShadow: mine ? (face === 'win' ? '0 0 0 3px #fff,0 0 28px rgba(255,214,107,0.95)' : '0 0 0 3px #ff4d6d') : 'none',
                  filter: round && !mine ? 'saturate(0.5) brightness(0.7)' : 'none',
                })}>
                  <span style={css('font-size:30px')}>{face === 'win' ? '💰' : '💀'}</span>
                  <span style={css('font-size:20px')}>{face === 'win' ? '×2' : '꽝'}</span>
                </span>
              </button>
            )
          })}
        </div>

        <div style={css('min-height:64px;padding:8px 24px 0;text-align:center')}>
          {round ? (
            <div style={css('display:flex;flex-direction:column;gap:10px;align-items:center;animation:popIn 300ms 450ms both')}>
              <span style={sx('font-size:22px;font-weight:900', { color: round.bet.won ? GOLD : '#ff6b81', textShadow: round.bet.won ? '0 0 12px rgba(255,214,107,0.9)' : 'none' })}>
                {round.bet.won ? `🎉 2배! ${shortPoints(round.bet.amount * 2)}P 받았다` : `💸 ${shortPoints(round.bet.amount)}P 날렸다`}
              </span>
              <button className="pr-96" onClick={() => setRound(null)} style={css(`height:44px;padding:0 22px;border-radius:12px;background:${GOLD};color:#3a1d00;font-size:16px;font-weight:800`)}>한 판 더</button>
            </div>
          ) : (
            <span style={css('font-size:14px;color:rgba(255,255,255,0.55)')}>{busy !== null ? '두근두근…' : points < 1 ? '포인트가 없어요' : amount < 1 ? '먼저 얼마 걸지 정해' : `${shortPoints(amount)}P 걸고 카드를 골라`}</span>
          )}
        </div>

        {/* the bet */}
        <div style={css('margin:16px 24px 0;display:flex;flex-direction:column;gap:10px')}>
          <label style={css('height:56px;padding:0 16px;border-radius:16px;background:rgba(255,255,255,0.08);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.12);display:flex;align-items:center;gap:8px')}>
            <input
              inputMode="numeric" placeholder="걸 포인트" disabled={!!round || busy !== null}
              value={amount ? digits(amount) : ''}
              onChange={e => { const v = e.target.value.replace(/\D/g, ''); setAmount(v ? Math.min(points, Number(v)) : 0) }}
              style={css('flex:1;min-width:0;height:100%;background:transparent;border:none;outline:none;color:#fff;font-size:20px;font-weight:700;font-variant-numeric:tabular-nums')}
            />
            <span style={css('font-size:18px;font-weight:700;color:rgba(255,255,255,0.6)')}>P</span>
          </label>
          <div style={css('display:flex;gap:6px;flex-wrap:wrap')}>
            {([['+100', () => add(100)], ['+1,000', () => add(1000)], ['+1만', () => add(10_000)], ['절반', () => setAmount(Math.floor(points / 2))], ['올인', () => setAmount(points)], ['0', () => setAmount(0)]] as [string, () => void][]).map(([l, f]) => (
              <button key={l} className="pr-96" disabled={!!round || busy !== null} onClick={f} style={sx('flex:1 0 auto;height:38px;padding:0 10px;border-radius:10px;font-size:14px;font-weight:700', { background: l === '올인' ? 'linear-gradient(135deg,#ff3d7f,#ff9a3d)' : 'rgba(255,255,255,0.1)', color: '#fff' })}>{l}</button>
            ))}
          </div>
        </div>

        {log.length > 0 && (
          <div style={css('margin:20px 24px 0;display:flex;flex-direction:column;gap:8px')}>
            <span style={css('font-size:13px;color:rgba(255,255,255,0.5)')}>이번 판 기록</span>
            <div style={css('display:flex;gap:6px;flex-wrap:wrap')}>
              {log.map(e => (
                <span key={e.key} style={sx('padding:4px 10px;border-radius:9999px;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums', { background: e.d > 0 ? 'rgba(255,214,107,0.18)' : 'rgba(255,77,109,0.16)', color: e.d > 0 ? GOLD : '#ff8095' })}>{e.d > 0 ? '+' : '-'}{shortPoints(Math.abs(e.d))}P</span>
              ))}
            </div>
          </div>
        )}
        <div style={css('padding:28px 24px calc(28px + env(safe-area-inset-bottom));text-align:center;font-size:12px;line-height:18px;color:rgba(255,255,255,0.35)')}>진짜 돈은 안 걸려요 · 앱 포인트로만 하는 게임이에요<br />건 금액에 제한 없음 · 2번 중 1번꼴로 2배</div>
      </div>
    </div>,
    document.getElementById('overlay-root') ?? document.body,
  )
}

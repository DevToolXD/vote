import { useEffect, useState } from 'react'
import type { Firestore } from 'firebase/firestore'
import { css, sx } from '../css'
import { priceOf, type ItemKind } from '../data'
import { bankMove, openBank, watchBank, watchBankLog, type BankDoc, type BankKind, type BankLog } from '../backend/bank'
import BANK from '../shared/bank.json'
import { BottomSheet } from './Overlays'

// 은행: a Toss-style bank. The savings (연 50%, interest every week), the loan (연 10%, up to the limit
// that the credit grade sets) and the grade, which is worked out from the points, the savings and the
// items the person has now (the worker updates it every 15 minutes).

const EASE = 'cubic-bezier(0.22,1,0.36,1)'
const BLUE = '#3182f6', INK = '#191f28', SUB = '#6b7684', MUTE = '#8b95a1', CARD = '#ffffff', PAGE = '#f2f4f6'
const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR')
const DAY = 86_400_000

type Props = {
  db: Firestore
  uid: string | null
  owned: Record<ItemKind, string[]> | null
  points: number
  onLogin: () => void
  onToast: (msg: string) => void
}

const itemsValue = (owned: Record<ItemKind, string[]>) => (['frame', 'plate', 'skin'] as ItemKind[]).reduce((n, kind) => n + owned[kind].reduce((m, k) => m + priceOf(kind, k), 0), 0)
const gradeColor = (g: number) => (g <= 3 ? BLUE : g <= 6 ? '#00b493' : g <= 8 ? '#ff8a00' : '#f04452')
const LABEL: Record<BankLog['kind'], string> = { in: '넣기', out: '빼기', borrow: '빌리기', repay: '갚기', 'int-dep': '이자 (예금)', 'int-loan': '이자 (대출)' }
/** Points coming into my wallet (+) or leaving it (−) for a log line. The interest on a loan is owed, not paid. */
const SIGN: Record<BankLog['kind'], 1 | -1> = { in: -1, out: 1, borrow: 1, repay: -1, 'int-dep': 1, 'int-loan': -1 }

export function BankApp({ db, uid, owned, points, onLogin, onToast }: Props) {
  const [bank, setBank] = useState<BankDoc | null | undefined>(undefined) // undefined: still loading
  const [log, setLog] = useState<BankLog[]>([])
  const [sheet, setSheet] = useState<BankKind | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { if (!uid) return; return watchBank(db, uid, setBank) }, [db, uid])
  useEffect(() => { if (!uid) return; return watchBankLog(db, uid, setLog) }, [db, uid])
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t) }, [])

  if (!uid) {
    return (
      <div style={css(`min-height:100%;box-sizing:border-box;background:${PAGE};padding:24px 20px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;color:${INK}`)}>
        <span style={css(`font-size:20px;font-weight:700`)}>로그인하면 은행을 쓸 수 있어요</span>
        <span style={css(`font-size:15px;color:${SUB}`)}>포인트를 넣어 두면 매주 이자가 붙어요</span>
        <button className="pr-96" onClick={onLogin} style={css(`margin-top:16px;height:52px;padding:0 28px;border-radius:14px;background:${BLUE};color:#fff;font-size:17px;font-weight:700`)}>로그인하기</button>
      </div>
    )
  }

  const page = (children: React.ReactNode) => (
    <div style={css(`min-height:100%;box-sizing:border-box;background:${PAGE};padding:12px 16px 32px;display:flex;flex-direction:column;gap:12px;color:${INK};font-family:inherit`)}>
      <h1 style={css(`margin:4px 4px 4px;font-size:26px;line-height:34px;font-weight:700;letter-spacing:-0.3px`)}>은행</h1>
      {children}
    </div>
  )

  if (bank === undefined) return page(<div style={css(`height:180px;border-radius:20px;background:${CARD}`)} />)

  // no account yet: explain it and open one
  if (bank === null) {
    return page(
      <div style={css(`border-radius:20px;background:${CARD};padding:24px 22px;display:flex;flex-direction:column;gap:14px`)}>
        <span style={css(`font-size:22px;line-height:30px;font-weight:700`)}>은행 통장을 만들어요</span>
        <Point title="넣어 둔 포인트에 이자가 붙어요" text="연 50%, 매주 한 번씩 붙어요" />
        <Point title="돈이 필요하면 빌릴 수 있어요" text="연 10%. 한도는 신용등급에 따라 달라요" />
        <Point title="신용등급은 지금 가진 돈으로 매겨요" text="포인트, 예금, 아이템을 함께 봐요" />
        <button className="pr-96" onClick={async () => { try { await openBank(db, uid); onToast('통장을 만들었어요') } catch { onToast('통장을 만들지 못했어요') } }} style={css(`height:56px;border-radius:16px;background:${BLUE};color:#fff;font-size:17px;font-weight:700`)}>통장 만들기</button>
      </div>
    )
  }

  const loan = bank.loan, dep = bank.dep
  const available = Math.max(0, bank.limit - loan)
  // simple interest: a week is the yearly rate ÷ 52 of what was put in, not of the interest
  const weekly = Math.round(bank.depBase * BANK.deposit.annual / BANK.deposit.weeks)
  const itemValue = owned ? itemsValue(owned) : 0
  const netWorth = points + dep + itemValue - loan
  const left = bank.nextAt - now
  const nextLabel = dep === 0 && loan === 0 ? '' : left <= 0 ? '곧 붙어요' : `${Math.ceil(left / DAY)}일 뒤`
  const pct = bank.limit > 0 ? Math.min(100, (loan / bank.limit) * 100) : 0

  return page(
    <>
      {/* my account: the savings, with the interest */}
      <section style={css(`border-radius:20px;background:${CARD};padding:22px 22px 20px;display:flex;flex-direction:column;gap:6px`)}>
        <span style={css(`font-size:15px;font-weight:600;color:${SUB}`)}>내 통장</span>
        <span style={css(`font-size:36px;line-height:44px;font-weight:700;letter-spacing:-0.6px;font-variant-numeric:tabular-nums`)}>{fmt(dep)}<span style={css('font-size:22px;margin-left:3px;color:' + SUB)}>P</span></span>
        <span style={css(`font-size:14px;line-height:20px;color:${MUTE}`)}>연 50% · 넣은 돈에 매주 이자가 붙어요{nextLabel && ` · 다음 이자 ${nextLabel}`}</span>
        {dep > 0 && <span style={css(`font-size:14px;color:${BLUE};font-weight:600`)}>이번 주 예상 이자 +{fmt(weekly)}P</span>}
        <div style={css('display:flex;gap:8px;margin-top:14px')}>
          <Btn primary onClick={() => setSheet('in')}>넣기</Btn>
          <Btn onClick={() => setSheet('out')} disabled={dep <= 0}>빼기</Btn>
        </div>
      </section>

      {/* the loan */}
      <section style={css(`border-radius:20px;background:${CARD};padding:22px 22px 20px;display:flex;flex-direction:column;gap:6px`)}>
        <span style={css(`font-size:15px;font-weight:600;color:${SUB}`)}>대출</span>
        <span style={css(`font-size:30px;line-height:38px;font-weight:700;letter-spacing:-0.5px;font-variant-numeric:tabular-nums`)}>{fmt(loan)}<span style={css('font-size:20px;margin-left:3px;color:' + SUB)}>P</span></span>
        <span style={css(`font-size:14px;line-height:20px;color:${MUTE}`)}>
          {bank.grade === 0 ? '신용등급을 계산하고 있어요' : `연 10% · 한도 ${fmt(bank.limit)}P 중 ${fmt(available)}P 남았어요`}
        </span>
        <div style={css(`height:8px;border-radius:4px;background:${PAGE};overflow:hidden;margin-top:6px`)}>
          <div style={sx(`height:100%;border-radius:4px;background:${BLUE};transition:width 400ms ${EASE}`, { width: `${pct}%` })} />
        </div>
        <div style={css('display:flex;gap:8px;margin-top:14px')}>
          <Btn primary onClick={() => setSheet('borrow')} disabled={available <= 0}>빌리기</Btn>
          <Btn onClick={() => setSheet('repay')} disabled={loan <= 0}>갚기</Btn>
        </div>
      </section>

      {/* the credit grade, from what the person has now */}
      <section style={css(`border-radius:20px;background:${CARD};padding:22px 22px 20px;display:flex;flex-direction:column;gap:14px`)}>
        <div style={css('display:flex;align-items:center;justify-content:space-between')}>
          <span style={css(`font-size:17px;font-weight:700`)}>신용등급</span>
          <span style={css(`height:30px;padding:0 12px;border-radius:9999px;display:flex;align-items:center;background:${bank.grade ? gradeColor(bank.grade) : PAGE};color:${bank.grade ? '#fff' : SUB};font-size:15px;font-weight:700`)}>{bank.grade ? `${bank.grade}등급` : '계산 중'}</span>
        </div>
        <span style={css(`font-size:14px;line-height:21px;color:${SUB}`)}>지금 가진 포인트, 예금, 아이템으로 매겨요. 순자산이 많을수록 높은 등급이고, 한도는 순자산의 일정 비율이에요.</span>
        <Row label="보유 포인트" value={`${fmt(points)}P`} />
        <Row label="예금" value={`${fmt(dep)}P`} />
        <Row label="아이템" value={`${fmt(itemValue)}P`} />
        <Row label="대출" value={`−${fmt(loan)}P`} />
        <div style={css(`height:1px;background:${PAGE}`)} />
        <Row label="순자산" value={`${fmt(netWorth)}P`} strong />
        <span style={css(`font-size:13px;color:${MUTE}`)}>15분마다 다시 계산해요{bank.gradeAt ? ` · 마지막 계산 ${new Date(bank.gradeAt).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })}` : ''}</span>
      </section>

      {/* the last moves */}
      <span style={css(`margin:10px 4px 0;font-size:18px;font-weight:700`)}>거래내역</span>
      <section style={css(`border-radius:20px;background:${CARD};overflow:hidden`)}>
        {log.length === 0 && <div style={css(`padding:28px 22px;font-size:15px;color:${MUTE};text-align:center`)}>아직 거래가 없어요</div>}
        {log.map((r, i) => {
          const plus = SIGN[r.kind] > 0
          return (
            <div key={r.id} style={css(`display:flex;align-items:center;gap:12px;padding:16px 22px;${i < log.length - 1 ? `border-bottom:0.5px solid ${PAGE}` : ''}`)}>
              <span aria-hidden="true" style={css(`width:36px;height:36px;border-radius:9999px;flex:none;display:flex;align-items:center;justify-content:center;background:${plus ? '#e8f3ff' : PAGE};color:${plus ? BLUE : SUB};font-size:18px;font-weight:700`)}>{plus ? '+' : '−'}</span>
              <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:2px')}>
                <span style={css(`font-size:16px;font-weight:600`)}>{LABEL[r.kind]}</span>
                <span style={css(`font-size:13px;color:${MUTE}`)}>{new Date(r.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              </span>
              <span style={sx('font-size:16px;font-weight:700;font-variant-numeric:tabular-nums', { color: plus ? BLUE : INK })}>{plus ? '+' : '−'}{fmt(r.amount)}P</span>
            </div>
          )
        })}
      </section>

      {sheet && (
        <MoveSheet
          kind={sheet}
          max={sheet === 'in' ? points : sheet === 'out' ? dep : sheet === 'borrow' ? available : Math.min(points, loan)}
          points={points} available={available} loan={loan}
          onClose={() => setSheet(null)}
          onGo={async n => {
            try { await bankMove(db, uid, sheet, n); onToast(`${LABEL[sheet]} ${fmt(n)}P 했어요`); setSheet(null) }
            catch { onToast('처리하지 못했어요. 잠시 뒤에 다시 해봐요') }
          }}
        />
      )}
    </>
  )
}

function Point({ title, text }: { title: string; text: string }) {
  return (
    <span style={css(`display:flex;flex-direction:column;gap:2px`)}>
      <span style={css(`font-size:16px;font-weight:600`)}>{title}</span>
      <span style={css(`font-size:14px;color:${SUB}`)}>{text}</span>
    </span>
  )
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <span style={css(`display:flex;justify-content:space-between;font-size:15px;${strong ? 'font-weight:700' : ''}`)}>
      <span style={css(`color:${SUB}`)}>{label}</span>
      <span style={css(`font-variant-numeric:tabular-nums`)}>{value}</span>
    </span>
  )
}

function Btn({ children, onClick, primary = false, disabled = false }: { children: React.ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <button className="pr-96" onClick={onClick} disabled={disabled} style={sx(`flex:1;height:52px;border-radius:14px;font-size:16px;font-weight:700;transition:opacity 200ms`, { background: primary ? BLUE : PAGE, color: primary ? '#fff' : '#333d4b', opacity: disabled ? 0.4 : 1 })}>{children}</button>
  )
}

/** The amount sheet: a number, quick amounts, the most I can, and the one button. */
function MoveSheet({ kind, max, points, available, loan, onClose, onGo }: { kind: BankKind; max: number; points: number; available: number; loan: number; onClose: () => void; onGo: (n: number) => Promise<void> }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const n = Number(text) || 0
  const over = n > max
  const title = { in: '넣을 금액', out: '뺄 금액', borrow: '빌릴 금액', repay: '갚을 금액' }[kind]
  const desc = {
    in: `내 포인트 ${fmt(points)}P에서 통장으로 넣어요`,
    out: `통장에서 내 포인트로 돌려받아요 (이자부터 먼저 빠져요)`,
    borrow: `한도 안에서 빌리면 포인트로 바로 들어와요 (남은 한도 ${fmt(available)}P)`,
    repay: `내 포인트로 대출을 갚아요 (대출 ${fmt(loan)}P)`,
  }[kind]
  const cta = { in: '넣기', out: '빼기', borrow: '빌리기', repay: '갚기' }[kind]
  const chips: [string, number][] = [['1,000P', 1000], ['5,000P', 5000], ['최대', max]]
  return (
    <BottomSheet onScrim={onClose} scrim="rgba(0,0,0,0.25)" sheetStyle={`border-radius:28px 28px 0 0;padding:8px 0 calc(20px + env(safe-area-inset-bottom));animation:sheetUp 420ms ${EASE} both;background:#fff`}>
      <div style={css('width:36px;height:4px;border-radius:2px;background:#e5e8eb;margin:0 auto')} />
      <div style={css(`padding:18px 22px 4px;display:flex;flex-direction:column;gap:4px;color:${INK}`)}>
        <span style={css('font-size:20px;font-weight:700')}>{title}</span>
        <span style={css(`font-size:14px;color:${SUB}`)}>{desc}</span>
      </div>
      <div style={css(`margin:14px 22px 0;display:flex;align-items:baseline;gap:6px;border-bottom:2px solid ${over ? '#f04452' : INK};padding:6px 0`)}>
        <input inputMode="numeric" autoFocus value={text ? fmt(n) : ''} placeholder="0" onChange={e => setText(e.target.value.replace(/[^0-9]/g, '').slice(0, 12))} aria-label={title}
          style={css(`flex:1;min-width:0;border:0;outline:none;background:transparent;font-size:34px;font-weight:700;color:${INK};font-variant-numeric:tabular-nums;font-family:inherit`)} />
        <span style={css(`font-size:22px;font-weight:700;color:${SUB}`)}>P</span>
      </div>
      <div style={css(`margin:8px 22px 0;min-height:20px;font-size:13px;color:${over ? '#f04452' : MUTE}`)}>{over ? `최대 ${fmt(max)}P까지 할 수 있어요` : `최대 ${fmt(max)}P`}</div>
      <div style={css('margin:10px 22px 0;display:flex;gap:8px')}>
        {chips.map(([label, v]) => (
          <button key={label} className="pr-96" onClick={() => setText(String(Math.max(0, Math.floor(v))))} disabled={v <= 0} style={css(`flex:1;height:38px;border-radius:12px;background:${PAGE};color:#4e5968;font-size:14px;font-weight:600;opacity:${v <= 0 ? 0.4 : 1}`)}>{label}</button>
        ))}
      </div>
      <div style={css('margin:20px 22px 0')}>
        <button className="pr-96" disabled={busy || n < 1 || over} onClick={async () => { setBusy(true); try { await onGo(n) } finally { setBusy(false) } }}
          style={css(`width:100%;height:56px;border-radius:16px;background:${BLUE};color:#fff;font-size:17px;font-weight:700;opacity:${busy || n < 1 || over ? 0.4 : 1};transition:opacity 200ms`)}>
          {cta}
        </button>
      </div>
    </BottomSheet>
  )
}

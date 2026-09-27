import { useEffect, useState } from 'react'
import { css, sx } from '../css'
import { rtdb } from '../firebase'
import { describe, dismissAlert, subscribeAlerts, subscribeFeed, subscribeLedger, type Alert, type LedgerRow } from '../backend/ledger'
import type { Person } from '../model'
import { BottomSheet } from './Overlays'

const EASE = 'cubic-bezier(0.22,1,0.36,1)'
const when = (ms: number) => {
  const d = new Date(ms), now = new Date()
  const t = `${d.getHours() < 12 ? '오전' : '오후'} ${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`
  return d.toDateString() === now.toDateString() ? t : `${d.getMonth() + 1}월 ${d.getDate()}일 ${t}`
}
const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toLocaleString() + 'P'

function Row({ r, nameOf, who }: { r: LedgerRow; nameOf: (id: string) => string; who?: string }) {
  const { icon, text } = describe(r, nameOf)
  return (
    <div style={css('padding:12px 0;display:flex;align-items:center;gap:12px')}>
      <span style={css('width:40px;height:40px;flex:none;border-radius:9999px;background:#f2f4f6;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800;color:#4e5968')}>{icon}</span>
      <span style={css('flex:1;min-width:0;display:flex;flex-direction:column')}>
        <span style={css('font-size:15px;line-height:22px;font-weight:600;color:#191f28;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{who ? <><b>{who}</b> · </> : null}{text}</span>
        <span style={css('font-size:13px;line-height:19px;color:#8b95a1')}>{when(r.at)}</span>
      </span>
      <span style={sx('flex:none;font-size:15px;font-weight:700;font-variant-numeric:tabular-nums', { color: r.d > 0 ? '#1b64da' : '#f04452' })}>{signed(r.d)}</span>
    </div>
  )
}

/** Someone's 거래 내역 (mine, or anyone's for the admin), live. */
export function LedgerSheet({ uid, title, byId, onClose }: { uid: string; title: string; byId: Map<string, Person>; onClose: () => void }) {
  const [list, setList] = useState<LedgerRow[] | null>(null)
  useEffect(() => (rtdb ? subscribeLedger(rtdb, uid, setList) : undefined), [uid])
  const nameOf = (id: string) => byId.get(id)?.name ?? ''
  return (
    <BottomSheet onScrim={onClose} scrim="rgba(0,0,0,0.2)" sheetStyle={`border-radius:28px 28px 0 0;padding:8px 0 calc(16px + env(safe-area-inset-bottom));animation:sheetUp 380ms ${EASE} both`}>
      <div style={css('width:36px;height:4px;border-radius:2px;background:#e5e8eb;margin:0 auto')} />
      <div style={css('padding:20px 24px 8px;display:flex;flex-direction:column;gap:2px')}>
        <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>{title}</span>
        <span style={css('font-size:13px;color:#8b95a1')}>최근 100건까지 보여요</span>
      </div>
      <div className="anim-list" style={css('padding:0 24px;min-height:120px')}>
        {list === null && <div style={css('padding:32px 0;text-align:center;font-size:15px;color:#8b95a1')}>불러오는 중이에요…</div>}
        {list?.length === 0 && <div style={css('padding:32px 0;text-align:center;font-size:15px;color:#8b95a1')}>아직 거래 내역이 없어요</div>}
        {list?.map(r => <Row key={r.id} r={r} nameOf={nameOf} />)}
      </div>
    </BottomSheet>
  )
}

/** 관리: 수상한 포인트 증가 (with how much and from what) and everyone's latest 거래 내역. */
export function AdminLedger({ all }: { all: Person[] }) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [feed, setFeed] = useState<LedgerRow[] | null>(null)
  const [showFeed, setShowFeed] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const byId = new Map(all.map(p => [p.id, p]))
  const nameOf = (id: string) => byId.get(id)?.name ?? ''
  useEffect(() => (rtdb ? subscribeAlerts(rtdb, setAlerts) : undefined), [])
  useEffect(() => (rtdb && showFeed ? subscribeFeed(rtdb, setFeed) : undefined), [showFeed])
  const mins = (ms: number) => Math.max(1, Math.round(ms / 60_000))
  return (
    <>
      <section style={css('padding:24px 24px;display:flex;flex-direction:column;gap:12px')}>
        <span style={css('font-size:17px;line-height:25.5px;font-weight:700;color:#191f28;display:flex;align-items:center;gap:8px')}>
          수상한 포인트 증가
          {alerts.length > 0 && <span style={css('height:22px;padding:0 8px;border-radius:9999px;background:#f04452;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center')}>{alerts.length}</span>}
        </span>
        <span style={css('font-size:13px;line-height:19.5px;color:#6b7684')}>1시간 안에 1,000P 넘게 늘었거나 추천을 20개 넘게 받은 사람이에요. 관리자 지급·시즌 보상은 빼고 세요</span>
        {alerts.length === 0 && <span style={css('padding:14px 16px;border-radius:16px;background:#f9fafb;font-size:15px;color:#6b7684')}>지금은 없어요 👍</span>}
        {alerts.map(a => (
          <div key={a.uid} data-g="l1" style={css('padding:14px 16px;border-radius:16px;background:#fff5f6;box-shadow:inset 0 0 0 1px #ffd9dd;display:flex;flex-direction:column;gap:8px')}>
            <span style={css('display:flex;align-items:baseline;gap:8px')}>
              <span style={css('font-size:16px;font-weight:700;color:#191f28')}>{nameOf(a.uid) || '(탈퇴한 사람)'}</span>
              <span style={css('margin-left:auto;font-size:20px;font-weight:800;color:#e42939;font-variant-numeric:tabular-nums')}>+{a.gain.toLocaleString()}P</span>
            </span>
            <span style={css('font-size:13px;line-height:19px;color:#6b7684')}>{mins(a.at - a.since)}분 동안 · 지금 {a.points.toLocaleString()}P · {when(a.at)}</span>
            <span style={css('display:flex;gap:6px;flex-wrap:wrap')}>
              {([['추천', a.votes], ['선물 받음', a.gifts], ['기타', a.other]] as [string, number][]).filter(([, n]) => n > 0).map(([k, n]) => (
                <span key={k} style={css('height:24px;padding:0 9px;border-radius:9999px;background:#ffffff;color:#4e5968;font-size:12px;font-weight:600;display:flex;align-items:center')}>{k} +{n.toLocaleString()}</span>
              ))}
            </span>
            <span style={css('display:flex;gap:8px')}>
              <button className="pr-96" onClick={() => setOpen(a.uid)} style={css('flex:1;height:40px;border-radius:12px;background:#ffffff;color:#333d4b;font-size:14px;font-weight:600')}>거래 내역 보기</button>
              <button className="pr-96" onClick={() => rtdb && dismissAlert(rtdb, a.uid)} style={css('flex:1;height:40px;border-radius:12px;background:#f2f4f6;color:#4e5968;font-size:14px;font-weight:600')}>확인했어요</button>
            </span>
          </div>
        ))}
      </section>
      <div data-g="gap" style={css('height:16px;background:#f2f4f6')} />
      <section style={css('padding:24px 24px;display:flex;flex-direction:column;gap:4px')}>
        <span style={css('display:flex;justify-content:space-between;align-items:center;font-size:17px;line-height:25.5px;font-weight:700;color:#191f28')}>전체 거래 내역
          <button className="pr-dim" onClick={() => setShowFeed(s => !s)} style={css('height:32px;padding:0 10px;border-radius:8px;background:#f2f4f6;font-size:13px;font-weight:600;color:#333d4b')}>{showFeed ? '닫기' : '보기'}</button>
        </span>
        <span style={css('font-size:13px;line-height:19.5px;color:#6b7684')}>모든 사람의 포인트 변동, 최근 100건. 사람별 내역은 아래 사람 관리에서 볼 수 있어요</span>
        {showFeed && feed === null && <span style={css('padding:16px 0;font-size:15px;color:#8b95a1')}>불러오는 중이에요…</span>}
        {showFeed && feed?.length === 0 && <span style={css('padding:16px 0;font-size:15px;color:#8b95a1')}>아직 없어요</span>}
        {showFeed && feed?.map(r => <button key={r.id} onClick={() => r.u && setOpen(r.u)} style={css('text-align:left')}><Row r={r} nameOf={nameOf} who={nameOf(r.u ?? '') || '(탈퇴한 사람)'} /></button>)}
      </section>
      {open && <LedgerSheet uid={open} title={`${nameOf(open) || '(탈퇴한 사람)'}님의 거래 내역`} byId={byId} onClose={() => setOpen(null)} />}
    </>
  )
}

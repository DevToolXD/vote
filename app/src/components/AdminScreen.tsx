import { useEffect, useState } from 'react'
import { css, sx } from '../css'
import { AdminLedger, LedgerSheet } from './LedgerViews'
import { DurationInput, dhmsSeconds, durationLabel, leftLabel, type Dhms } from './Duration'
import { TRADE_BAN_FOREVER, type AdminProgress } from '../backend/admin'
import { ITEM_KIND, itemName } from '../backend/ledger'
import { hasFakePass, hasPass } from '../backend/candidates'

type RevokeKind = 'frame' | 'plate' | 'skin' | 'pass2x' | 'passFake'
import { pointsOf } from '../backend/candidates'
import type { Ticket } from '../backend/support'
import type { IpDoc, IpOp } from '../backend/ip'
import { DEFAULT_REWARDS, rewardNotice, type Rewards } from '../backend/rewards'
import type { PollResult } from '../backend/notices'
import type { Season } from '../backend/types'
import type { Person } from '../model'
import { Avatar } from './Avatar'
import { SearchIcon } from './icons'
import { Dialog } from './Overlays'
import { shortPoints } from './PointsChip'

type Props = {
  all: Person[]
  tickets: Ticket[]
  onOpenTicket: (id: string) => void
  postNotice: (title: string, body: string, onProgress: (p: AdminProgress) => void, options?: string[]) => Promise<void>
  /** 공지 투표 results (latest polls). */
  loadPolls: () => Promise<PollResult[]>
  season: Season
  /** Runs one admin operation; resolves when done, rejects with the Firebase error. */
  run: (label: string, op: (onProgress: (p: AdminProgress) => void) => Promise<void>) => Promise<boolean>
  grantPoints: (target: string, amount: number, onProgress: (p: AdminProgress) => void) => Promise<void>
  /** 거래 정지 until (ms; 0 lifts it). */
  setTradeBan: (target: string, until: number, onProgress: (p: AdminProgress) => void) => Promise<void>
  /** 수거: an item (frame/plate/skin + key) or a pass (pass2x/passFake). */
  revokeItem: (target: string, kind: RevokeKind, key: string, onProgress: (p: AdminProgress) => void) => Promise<void>
  setSeasonName: (name: string, onProgress: (p: AdminProgress) => void) => Promise<void>
  resetSeason: (name: string, onProgress: (p: AdminProgress) => void) => Promise<void>
  setSeasonConfig: (endsAt: number, rewards: Rewards, onProgress: (p: AdminProgress) => void) => Promise<void>
  renameUser: (target: string, name: string, onProgress: (p: AdminProgress) => void) => Promise<void>
  deleteAccount: (target: string, onProgress: (p: AdminProgress) => void) => Promise<void>
  /** Issues a one-time password (resolves with it); the worker applies it within a minute. */
  resetPassword: (target: string, onProgress: (p: AdminProgress) => void) => Promise<string>
  ipTools: IpTools
  onLogout: () => void
}

type IpTools = {
  /** This device's address (never blocked from here, so the admin can't lock themselves out). */
  mine: string | null
  lastOf: (uid: string) => Promise<string | null>
  read: (ip: string) => Promise<IpDoc | null>
  blocked: () => Promise<{ ip: string; uid?: string }[]>
  set: (ip: string, op: IpOp, onProgress: (p: AdminProgress) => void) => Promise<void>
}

const sectionTitle = 'font-size:17px;line-height:25.5px;font-weight:700;color:#191f28'
const hint = 'font-size:13px;line-height:19.5px;color:#6b7684'
const field = 'height:48px;border:0;border-radius:14px;background:#f2f4f6;padding:0 14px;font-size:16px;color:#191f28;min-width:0'
const gap = <div data-g="gap" style={css('height:16px;background:#f2f4f6')} />

type Confirm = { title: string; desc: string; cta: string; danger?: boolean; go: () => void }

export function AdminScreen({ all, tickets, onOpenTicket, postNotice, loadPolls, setSeasonConfig, season, run, grantPoints, setTradeBan, revokeItem, setSeasonName, resetSeason, renameUser, deleteAccount, resetPassword, ipTools, onLogout }: Props) {
  const [issued, setIssued] = useState<{ name: string; loginId?: string; code: string } | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [notice, setNotice] = useState({ title: '', body: '' })
  const [poll, setPoll] = useState<string[] | null>(null)
  const pollOpts = (poll ?? []).map(o => o.trim()).filter(Boolean)
  const pollOk = !poll || pollOpts.length >= 2
  const [polls, setPolls] = useState<PollResult[] | null>(null)
  const [pollsBusy, setPollsBusy] = useState(false)
  const curRewards = season.rewards ?? DEFAULT_REWARDS
  const curEnds = season.endsAt ? season.endsAt.toMillis() : 0
  const toLocalInput = (ms: number) => { if (!ms) return ''; const d = new Date(ms); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }
  const [cfg, setCfg] = useState(() => ({ ends: toLocalInput(curEnds), ...Object.fromEntries(Object.entries(curRewards).map(([k, v]) => [k, String(v)])) } as Record<string, string>))
  const cfgRewards: Rewards = { first: Number(cfg.first), second: Number(cfg.second), third: Number(cfg.third), top6: Number(cfg.top6), participant: Number(cfg.participant) }
  const cfgEnds = cfg.ends ? new Date(cfg.ends).getTime() : 0
  const cfgOk = Object.values(cfgRewards).every(n => Number.isInteger(n) && n >= 0 && n <= 100000) && (!cfgEnds || cfgEnds > Date.now())
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [rename, setRename] = useState('')
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [ledgerOf, setLedgerOf] = useState<string | null>(null)
  const [ban, setBan] = useState<Dhms>({ d: '1', h: '', m: '', s: '' })
  const banSec = dhmsSeconds(ban)

  const person = all.find(p => p.id === picked)
  const list = (q.trim() ? all.filter(p => p.name.includes(q.trim())) : all).slice(0, 30)
  const amt = Number(amount)
  const amountOk = amount.trim() !== '' && Number.isSafeInteger(amt) && amt !== 0
  const renameOk = !!person && rename.trim().length >= 1 && rename.trim().length <= 20 && rename.trim() !== person.name
  const nameOk = nameDraft.trim().length >= 1 && nameDraft.trim().length <= 20

  return (
    <div data-g="clear" style={css('flex:1;background:#ffffff;padding-bottom:32px')}>
      <div style={css('padding:32px 24px 20px;display:flex;flex-direction:column;gap:4px')}>
        <h1 style={css('margin:0;font-size:22px;line-height:31px;font-weight:700;color:#191f28')}>관리자</h1>
        <p style={css('margin:0;font-size:15px;line-height:22.5px;color:#6b7684')}>모든 작업은 1회용 보안 토큰 3개를 발급·확인한 뒤에 실행돼요</p>
      </div>

      {gap}
      <AdminLedger all={all} />
      {all.some(p => (p.tradeBan ?? 0) > Date.now()) && (
        <>
          {gap}
          <section style={css('padding:24px 24px;display:flex;flex-direction:column;gap:10px')}>
            <span style={css(sectionTitle)}>거래 정지된 사람</span>
            {all.filter(p => (p.tradeBan ?? 0) > Date.now()).map(p => (
              <div key={p.id} data-g="l1" style={css('padding:12px 14px;border-radius:14px;background:#f9fafb;display:flex;align-items:center;gap:10px')}>
                <span style={css('flex:1;min-width:0;display:flex;flex-direction:column')}>
                  <span style={css('font-size:15px;font-weight:700;color:#191f28')}>{p.name}</span>
                  <span style={css('font-size:13px;color:#e42939')}>{p.tradeBan! >= TRADE_BAN_FOREVER ? '영구 정지' : `${leftLabel(p.tradeBan! - Date.now())} 남음`}</span>
                </span>
                <button className="pr-96" onClick={() => setConfirm({ title: `${p.name}님 거래 정지를 풀까요?`, desc: '바로 다시 선물을 주고받고 아이템·패스를 살 수 있어요.', cta: '풀기', go: () => { run('거래 정지 풀기', pr => setTradeBan(p.id, 0, pr)) } })}
                  style={css('flex:none;height:36px;padding:0 14px;border-radius:10px;background:#e8f3ff;color:#1b64da;font-size:14px;font-weight:700')}>풀기</button>
              </div>
            ))}
          </section>
        </>
      )}

      {gap}
      <IpSection tools={ipTools} all={all} run={run} setConfirm={setConfirm} />

      {gap}
      <section style={css('padding:24px 24px;display:flex;flex-direction:column;gap:12px')}>
        <span style={css(sectionTitle)}>공지사항</span>
        <input data-g="l1" className="ring-focus" value={notice.title} maxLength={40} onChange={e => setNotice(n => ({ ...n, title: e.target.value }))} placeholder="제목 (40자까지)" style={css(field)} />
        <textarea data-g="l1" className="ring-focus" value={notice.body} maxLength={2000} rows={4} onChange={e => setNotice(n => ({ ...n, body: e.target.value }))} placeholder="내용" style={css('resize:vertical;min-height:100px;border:0;border-radius:14px;background:#f2f4f6;padding:12px 14px;font:inherit;font-size:16px;line-height:24px;color:#191f28;outline:none')} />
        {poll ? (
          <div style={css('display:flex;flex-direction:column;gap:8px')}>
            <span style={css('display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:600;color:#333d4b')}>투표 항목
              <button className="pr-dim" onClick={() => setPoll(null)} style={css('height:28px;padding:0 8px;border-radius:8px;font-size:13px;color:#6b7684')}>투표 빼기</button>
            </span>
            {poll.map((o, i) => (
              <input key={i} data-g="l1" className="ring-focus" value={o} maxLength={40} placeholder={`항목 ${i + 1}`}
                onChange={e => setPoll(ps => ps!.map((x, j) => (j === i ? e.target.value : x)))} style={css(field)} />
            ))}
            {poll.length < 6 && <button className="pr-dim" onClick={() => setPoll(ps => [...ps!, ''])} style={css('align-self:flex-start;height:32px;padding:0 10px;border-radius:8px;font-size:14px;font-weight:600;color:#3182f6')}>+ 항목 추가</button>}
          </div>
        ) : (
          <button className="pr-dim" onClick={() => setPoll(['', ''])} style={css('align-self:flex-start;height:36px;padding:0 12px;border-radius:10px;background:#f2f4f6;font-size:14px;font-weight:600;color:#333d4b')}>+ 투표 넣기</button>
        )}
        <button data-g="primary" className="pr-96" disabled={!notice.title.trim() || !notice.body.trim() || !pollOk}
          onClick={() => setConfirm({
            title: poll ? '투표가 있는 공지를 보낼까요?' : '이 공지를 보낼까요?',
            desc: `“${notice.title.trim()}” — 로그인한 모든 사람에게 앱을 열 때 화면 전체로 한 번 보여요.${poll ? ` 항목 ${pollOpts.length}개 중 하나를 골라 투표해요.` : ''} 보낸 공지는 고칠 수 없어요.`,
            cta: '보내기',
            go: async () => { if (await run('공지 보내기', p => postNotice(notice.title, notice.body, p, poll ? pollOpts : undefined))) { setNotice({ title: '', body: '' }); setPoll(null) } },
          })}
          style={sx('height:48px;border-radius:14px;background:#3182f6;color:#fff;font-size:15px;font-weight:600;transition:opacity 200ms', { opacity: notice.title.trim() && notice.body.trim() && pollOk ? 1 : 0.4 })}>공지 보내기</button>
        <span style={css(hint)}>로그인한 사람만, 한 번만 볼 수 있어요</span>
      </section>
      {gap}
      <section style={css('padding:24px 24px;display:flex;flex-direction:column;gap:12px')}>
        <span style={css('display:flex;justify-content:space-between;align-items:center;' + sectionTitle)}>공지 투표 결과
          <button className="pr-dim" disabled={pollsBusy} onClick={async () => { setPollsBusy(true); try { setPolls(await loadPolls()) } finally { setPollsBusy(false) } }}
            style={css('height:32px;padding:0 10px;border-radius:8px;background:#f2f4f6;font-size:13px;font-weight:600;color:#333d4b')}>{pollsBusy ? '불러오는 중…' : polls ? '새로고침' : '결과 보기'}</button>
        </span>
        {polls && polls.length === 0 && <span style={css(hint)}>아직 투표가 있는 공지가 없어요</span>}
        {polls?.map(p => {
          const total = p.counts.reduce((a, b) => a + b, 0)
          return (
            <div key={p.id} data-g="l1" style={css('padding:14px 16px;border-radius:16px;background:#f9fafb;display:flex;flex-direction:column;gap:8px')}>
              <span style={css('font-size:15px;font-weight:700;color:#191f28')}>{p.title} <span style={css('font-size:13px;font-weight:500;color:#8b95a1')}>· {total}명</span></span>
              {p.options.map((o, i) => {
                const pct = total ? Math.round(p.counts[i] / total * 100) : 0
                return (
                  <div key={i} style={css('display:flex;flex-direction:column;gap:4px')}>
                    <span style={css('display:flex;justify-content:space-between;font-size:14px;color:#333d4b')}><span>{o}</span><span style={css('font-weight:600;font-variant-numeric:tabular-nums')}>{p.counts[i]}명 · {pct}%</span></span>
                    <span style={css('height:6px;border-radius:3px;background:#e5e8eb;overflow:hidden')}><span style={sx('display:block;height:100%;background:#3182f6;border-radius:3px;transition:width 400ms', { width: pct + '%' })} /></span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </section>
      {gap}
      <section style={css('padding:24px 0 12px;display:flex;flex-direction:column;gap:4px')}>
        <span style={css('padding:0 24px;' + sectionTitle)}>상담 {tickets.filter(t => t.last?.from === 'user' && !t.adminRead).length ? <span style={css('color:#3182f6')}>· 새 메시지 {tickets.filter(t => t.last?.from === 'user' && !t.adminRead).length}</span> : null}</span>
        {tickets.length === 0 && <span style={css('padding:4px 24px 8px;' + hint)}>아직 상담이 없어요</span>}
        <div className="anim-list">
          {[...tickets.filter(t => !t.closed), ...tickets.filter(t => t.closed)].slice(0, 20).map(t => {
            const unread = t.last?.from === 'user' && !t.adminRead && !t.closed
            return (
              <button key={t.id} className="pr-dim" onClick={() => onOpenTicket(t.id)} style={css('width:calc(100% - 8px);margin:0 4px;display:flex;align-items:center;gap:12px;padding:12px 20px;border-radius:12px;text-align:left')}>
                <span style={css('flex:1;min-width:0;display:flex;flex-direction:column')}>
                  <span style={sx('font-size:17px;line-height:25.5px;color:#191f28', { fontWeight: unread ? 600 : 500 })}>{t.name || '이름 없음'} <span style={css('font-size:13px;color:#8b95a1;font-weight:400')}>@{t.loginId || '?'}</span>{t.closed && <span style={css('margin-left:6px;padding:2px 6px;border-radius:6px;background:#f2f4f6;font-size:12px;color:#8b95a1;font-weight:600')}>끝남</span>}</span>
                  <span style={css('font-size:15px;line-height:22.5px;color:#6b7684;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{t.last ? (t.last.from === 'admin' ? '나: ' : '') + t.last.text : ''}</span>
                </span>
                {unread && <span style={css('width:8px;height:8px;border-radius:9999px;background:#3182f6;flex:none;animation:dotPop 420ms cubic-bezier(0.16,1,0.3,1) both')} />}
              </button>
            )
          })}
        </div>
      </section>
      {gap}
      <section style={css('padding:24px 24px;display:flex;flex-direction:column;gap:12px')}>
        <span style={css(sectionTitle)}>시즌</span>
        <div data-g="l1" style={css('padding:16px;border-radius:16px;background:#f9fafb;display:flex;justify-content:space-between;align-items:center')}>
          <span style={css('display:flex;flex-direction:column;gap:2px')}>
            <span style={css('font-size:13px;color:#6b7684')}>지금 시즌</span>
            <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>{season.name}</span>
          </span>
          <span style={css('font-size:13px;font-weight:600;color:#4e5968')}>{season.number}번째 시즌</span>
        </div>
        <div style={css('display:flex;gap:8px')}>
          <input data-g="l1" className="ring-focus" value={nameDraft} onChange={e => setNameDraft(e.target.value.slice(0, 20))} placeholder="새 시즌 이름 (20자까지)" style={sx(field, { flex: 1 })} />
          <button data-g="secondary" className="pr-96" disabled={!nameOk} onClick={async () => { if (await run('시즌 이름 변경', p => setSeasonName(nameDraft.trim(), p))) setNameDraft('') }}
            style={sx('height:48px;padding:0 16px;border-radius:14px;background:#f2f4f6;color:#333d4b;font-size:15px;font-weight:600;flex:none;transition:opacity 200ms', { opacity: nameOk ? 1 : 0.4 })}>이름 바꾸기</button>
        </div>
        <button data-g="secondary" className="pr-96" disabled={!nameOk}
          onClick={() => setConfirm({
            title: '시즌을 초기화할까요?',
            desc: `모든 점수와 투표가 0이 되고 '${nameDraft.trim()}' 시즌이 시작돼요. 모은 포인트는 그대로 남고, 순위 보상이 더해져요. 되돌릴 수 없어요.`,
            cta: '초기화하기', danger: true,
            go: async () => { if (await run('시즌 초기화', p => resetSeason(nameDraft.trim(), p))) setNameDraft('') },
          })}
          style={sx('height:48px;border-radius:14px;background:#fff0f1;color:#e42939;font-size:15px;font-weight:600;transition:opacity 200ms', { opacity: nameOk ? 1 : 0.4 })}>
          위 이름으로 새 시즌 시작하기 (초기화)
        </button>
        <span style={css(hint)}>이름만 바꾸면 점수는 그대로예요. 초기화는 새 시즌 이름을 먼저 적어야 할 수 있어요</span>
      </section>

      <section style={css('padding:0 24px 24px;display:flex;flex-direction:column;gap:12px')}>
        <span style={css(sectionTitle)}>시즌 끝나는 날짜 · 보상</span>
        <label style={css('display:flex;flex-direction:column;gap:6px')}>
          <span style={css(hint)}>끝나는 날짜 (비우면 직접 끝낼 때까지 계속돼요)</span>
          <input data-g="l1" className="ring-focus" type="datetime-local" value={cfg.ends} onChange={e => setCfg(c => ({ ...c, ends: e.target.value }))} style={css(field)} />
        </label>
        <div style={css('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px')}>
          {([['first', '🥇 1등'], ['second', '🥈 2등'], ['third', '🥉 3등'], ['top6', '4~6등'], ['participant', '참여한 모든 사람']] as const).map(([k, label]) => (
            <label key={k} style={css('display:flex;flex-direction:column;gap:6px')}>
              <span style={css(hint)}>{label}</span>
              <span style={css('display:flex;align-items:center;gap:6px')}>
                <input data-g="l1" className="ring-focus" inputMode="numeric" value={cfg[k]} onChange={e => setCfg(c => ({ ...c, [k]: e.target.value.replace(/[^0-9]/g, '') }))} style={sx(field, { flex: 1 })} />
                <span style={css('font-size:15px;color:#4e5968')}>P</span>
              </span>
            </label>
          ))}
        </div>
        <button data-g="primary" className="pr-96" disabled={!cfgOk}
          onClick={() => setConfirm({
            title: '시즌 설정을 저장할까요?',
            desc: `${cfgEnds ? new Date(cfgEnds).toLocaleString('ko-KR') + '에 자동으로 끝나고' : '끝나는 날짜 없이'} 보상은 1등 ${cfgRewards.first}P · 2등 ${cfgRewards.second}P · 3등 ${cfgRewards.third}P · 4~6등 ${cfgRewards.top6}P · 참여 ${cfgRewards.participant}P예요.`,
            cta: '저장하기',
            go: () => { run('시즌 설정', p => setSeasonConfig(cfgEnds, cfgRewards, p)) },
          })}
          style={sx('height:48px;border-radius:14px;background:#3182f6;color:#fff;font-size:15px;font-weight:600;transition:opacity 200ms', { opacity: cfgOk ? 1 : 0.4 })}>저장하기</button>
        <button data-g="secondary" className="pr-96"
          onClick={() => {
            const n = rewardNotice(season.name, curRewards, curEnds || null)
            setConfirm({ title: '보상 공지를 보낼까요?', desc: `지금 저장된 설정으로 “${n.title}” 공지를 보내요. 로그인한 모든 사람에게 한 번 보여요.`, cta: '공지하기', go: () => { run('보상 공지', p => postNotice(n.title, n.body, p)) } })
          }}
          style={css('height:48px;border-radius:14px;background:#e8f3ff;color:#1b64da;font-size:15px;font-weight:600')}>보상 공지하기</button>
        <span style={css(hint)}>끝나는 시각이 되면 보상을 자동으로 주고, 점수를 0으로 되돌리고, 다음 시즌을 시작해요. 직접 새 시즌을 시작해도 같은 보상을 줘요.</span>
      </section>

      {gap}
      <section style={css('padding:24px 24px 12px;display:flex;flex-direction:column;gap:12px')}>
        <span style={css(sectionTitle)}>사람 관리</span>
        <label data-g="l1" className="ring-within" style={css('height:48px;border-radius:14px;background:#f2f4f6;padding:0 8px 0 14px;display:flex;align-items:center;gap:8px')}>
          <SearchIcon size={20} stroke="#8b95a1" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="이름으로 찾기" style={css('flex:1;min-width:0;height:100%;border:0;background:transparent;font-size:16px;color:#191f28')} />
        </label>
      </section>
      <div style={css('max-height:320px;overflow-y:auto;padding:0 12px')}>
        {list.length === 0 && <div style={css('padding:24px;text-align:center;font-size:15px;color:#6b7684')}>아직 가입한 사람이 없어요</div>}
        {list.map(p => {
          const on = p.id === picked
          return (
            <button key={p.id} className="pr-dim" onClick={() => { setPicked(on ? null : p.id); setRename('') }}
              style={sx('width:100%;text-align:left;padding:10px 12px;display:flex;align-items:center;gap:12px;border-radius:14px;transition:background 150ms', { background: on ? '#e8f3ff' : 'transparent' })}>
              <Avatar frame={p.frame} photo={p.photoCss} size={36} />
              <span style={css('flex:1;min-width:0;display:flex;flex-direction:column')}>
                <span style={sx('font-size:16px;line-height:23px;font-weight:600', { color: on ? '#1b64da' : '#333d4b' })}>{p.name}</span>
                <span style={css('font-size:13px;color:#6b7684;font-variant-numeric:tabular-nums')}>{p.rank}위 · {p.scoreLabel}점 · {shortPoints(pointsOf(p))}P</span>
              </span>
              {on && <span style={css('width:22px;height:22px;border-radius:9999px;background:#3182f6;color:#fff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center')}>✓</span>}
            </button>
          )
        })}
      </div>

      {person && (
        <section style={css('padding:16px 24px 8px;display:flex;flex-direction:column;gap:12px')}>
          <span style={css('display:flex;justify-content:space-between;align-items:center;font-size:15px;font-weight:700;color:#191f28')}>{person.name}님에게
            <button className="pr-dim" onClick={() => setLedgerOf(person.id)} style={css('height:32px;padding:0 10px;border-radius:8px;background:#f2f4f6;font-size:13px;font-weight:600;color:#333d4b')}>거래 내역</button>
          </span>
          <div style={css('display:flex;gap:6px;flex-wrap:wrap')}>
            {[100, 500, 1000, -100].map(v => (
              <button key={v} className="pr-96" onClick={() => setAmount(String(v))} style={css('height:32px;padding:0 12px;border-radius:9999px;background:#f2f4f6;color:#4e5968;font-size:14px;font-weight:600')}>{v > 0 ? `+${v}` : v}</button>
            ))}
          </div>
          <div style={css('display:flex;gap:8px')}>
            <input data-g="l1" className="ring-focus" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d-]/g, ''))} placeholder="포인트 (빼려면 -)" style={sx(field, { flex: 1 })} />
            <button data-g="primary" className="pr-96" disabled={!amountOk}
              onClick={() => setConfirm({
                title: `${person.name}님에게 ${amt > 0 ? '+' : ''}${amt.toLocaleString()}P를 줄까요?`,
                desc: `지금 ${pointsOf(person).toLocaleString()}P → ${(pointsOf(person) + amt).toLocaleString()}P가 돼요.`,
                cta: amt > 0 ? '지급하기' : '차감하기',
                go: async () => { if (await run('포인트 지급', p => grantPoints(person.id, amt, p))) setAmount('') },
              })}
              style={sx('height:48px;padding:0 18px;border-radius:14px;background:#3182f6;color:#fff;font-size:15px;font-weight:600;flex:none;transition:opacity 200ms', { opacity: amountOk ? 1 : 0.4 })}>지급</button>
          </div>
          <div style={css('display:flex;gap:8px')}>
            <input data-g="l1" className="ring-focus" value={rename} maxLength={20} onChange={e => setRename(e.target.value)} placeholder="새 이름" style={sx(field, { flex: 1 })} />
            <button data-g="primary" className="pr-96" disabled={!renameOk}
              onClick={() => setConfirm({
                title: `이름을 ${rename.trim()}(으)로 바꿀까요?`,
                desc: `${person.name} → ${rename.trim()}. 아이디와 점수, 포인트는 그대로예요.`,
                cta: '바꾸기',
                go: async () => { if (await run('이름 변경', p => renameUser(person.id, rename.trim(), p))) setRename('') },
              })}
              style={sx('height:48px;padding:0 18px;border-radius:14px;background:#3182f6;color:#fff;font-size:15px;font-weight:600;flex:none;transition:opacity 200ms', { opacity: renameOk ? 1 : 0.4 })}>변경</button>
          </div>
          {!person.isMe && <PersonIp key={person.id} uid={person.id} name={person.name} tools={ipTools} all={all} run={run} setConfirm={setConfirm} />}
          {!person.isMe && (
            <div data-g="l1" style={css('padding:16px;border-radius:16px;background:#f9fafb;display:flex;flex-direction:column;gap:10px')}>
              <span style={css('display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;color:#191f28')}>거래 정지
                {(person.tradeBan ?? 0) > Date.now() && <span style={css('height:22px;padding:0 8px;border-radius:9999px;background:#fff0f1;color:#e42939;font-size:12px;font-weight:700;display:flex;align-items:center')}>{person.tradeBan! >= TRADE_BAN_FOREVER ? '영구 정지 중' : `정지 중 · ${leftLabel(person.tradeBan! - Date.now())} 남음`}</span>}
              </span>
              {(person.tradeBan ?? 0) > Date.now() && <button className="pr-96" onClick={() => { run('거래 정지 풀기', p => setTradeBan(person.id, 0, p)) }} style={css('height:44px;border-radius:12px;background:#e8f3ff;color:#1b64da;font-size:15px;font-weight:700')}>거래 정지 풀기</button>}
              <span style={css(hint)}>그동안 포인트 선물을 주고받거나 아이템·패스를 살 수 없어요 (보낸 선물 취소는 돼요)</span>
              <DurationInput value={ban} onChange={setBan} maxDays={3650} presets={[[3600, '1시간'], [86400, '1일'], [7 * 86400, '7일'], [30 * 86400, '30일']]} />
              <div style={css('display:flex;gap:8px')}>
                <button className="pr-96" disabled={banSec < 1}
                  onClick={() => setConfirm({ title: `${person.name}님을 ${durationLabel(banSec)} 동안 거래 정지할까요?`, desc: '포인트 선물을 보내거나 받을 수 없게 돼요. 언제든 풀 수 있어요.', cta: '거래 정지', danger: true,
                    go: () => { run('거래 정지', p => setTradeBan(person.id, Date.now() + banSec * 1000, p)) } })}
                  style={sx('flex:1;height:44px;border-radius:12px;background:#f04452;color:#fff;font-size:15px;font-weight:700;transition:opacity 200ms', { opacity: banSec >= 1 ? 1 : 0.4 })}>{banSec >= 1 ? `${durationLabel(banSec)} 정지` : '기간을 정해주세요'}</button>
                <button className="pr-96"
                  onClick={() => setConfirm({ title: `${person.name}님을 영구 거래 정지할까요?`, desc: '풀기 전까지 포인트 선물을 보내거나 받을 수 없어요.', cta: '영구 정지', danger: true,
                    go: () => { run('거래 정지', p => setTradeBan(person.id, TRADE_BAN_FOREVER, p)) } })}
                  style={css('flex:none;height:44px;padding:0 14px;border-radius:12px;background:#fff0f1;color:#e42939;font-size:15px;font-weight:700')}>영구</button>
              </div>
            </div>
          )}
          {(() => {
            const owned: [RevokeKind, string, string][] = [
              ...(hasPass(person) ? [['pass2x', '', '투표 2배권'] as [RevokeKind, string, string]] : []),
              ...(hasFakePass(person) ? [['passFake', '', '페이크 선물 패스'] as [RevokeKind, string, string]] : []),
              ...(['frame', 'plate', 'skin'] as const).flatMap(k => (person.owned?.[k] ?? []).filter(key => key !== 'none').map(key => [k, key, `${ITEM_KIND[k]} ${itemName(k, key)}`] as [RevokeKind, string, string])),
            ]
            return (
              <div data-g="l1" style={css('padding:16px;border-radius:16px;background:#f9fafb;display:flex;flex-direction:column;gap:10px')}>
                <span style={css('font-size:15px;font-weight:700;color:#191f28')}>아이템·패스 수거</span>
                <span style={css(hint)}>누르면 가져가요. 쓰고 있던 아이템은 기본으로 바뀌고, 포인트는 돌려주지 않아요</span>
                {owned.length === 0 ? <span style={css('font-size:14px;color:#8b95a1')}>가진 아이템·패스가 없어요</span> : (
                  <span style={css('display:flex;gap:6px;flex-wrap:wrap')}>
                    {owned.map(([kind, key, label]) => (
                      <button key={kind + key} className="pr-96" onClick={() => setConfirm({ title: `${person.name}님의 ${label}을(를) 수거할까요?`, desc: '포인트는 돌려주지 않아요. 다시 사야 쓸 수 있어요.', cta: '수거하기', danger: true, go: () => { run('수거', p => revokeItem(person.id, kind, key, p)) } })}
                        style={css('height:34px;padding:0 12px;border-radius:9999px;background:#ffffff;box-shadow:inset 0 0 0 1px #e5e8eb;color:#333d4b;font-size:14px;font-weight:600;display:flex;align-items:center;gap:6px')}>{label}<span style={css('color:#e42939;font-weight:800')}>✕</span></button>
                    ))}
                  </span>
                )}
              </div>
            )
          })()}
          {!person.isMe && <button className="pr-96"
            onClick={() => setConfirm({
              title: `${person.name}님 비밀번호를 초기화할까요?`,
              desc: '8자리 임시 비밀번호를 만들어요. 1분쯤 뒤부터 아이디와 그 번호로 로그인하면 새 비밀번호를 정하게 돼요. 지금 비밀번호는 더 이상 안 돼요.',
              cta: '초기화하기',
              go: async () => {
                let code = ''
                if (await run('비밀번호 초기화', async p => { code = await resetPassword(person.id, p) }) && code) setIssued({ name: person.name, loginId: person.loginId, code })
              },
            })}
            style={css('height:44px;border-radius:14px;background:#f2f4f6;color:#333d4b;font-size:15px;font-weight:600')}>비밀번호 초기화</button>}
          {!person.isMe && <button className="pr-96"
            onClick={() => setConfirm({
              title: `${person.name}님 계정을 삭제할까요?`,
              desc: '랭킹에서 사라지고, 이 사람이 남긴 투표는 모두 취소돼요. 같은 아이디로는 다시 가입할 수 없어요. 되돌릴 수 없어요.',
              cta: '삭제하기', danger: true,
              go: async () => { if (await run('계정 삭제', p => deleteAccount(person.id, p))) setPicked(null) },
            })}
            style={css('height:44px;border-radius:14px;background:#fff0f1;color:#e42939;font-size:15px;font-weight:600')}>계정 삭제</button>}
        </section>
      )}

      {gap}
      <button className="pr-dim" onClick={onLogout} style={css('width:100%;text-align:left;padding:16px 24px;font-size:17px;font-weight:500;color:#4e5968;border-radius:12px')}>로그아웃</button>

      {issued && (
        <Dialog onScrim={() => setIssued(null)} gap={20}>
          <div style={css('padding:0 4px;display:flex;flex-direction:column;gap:8px')}>
            <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>{issued.name}님 임시 비밀번호예요</span>
            <button className="pr-96" onClick={() => navigator.clipboard?.writeText(issued.code).catch(() => {})} aria-label="복사하기"
              style={css('margin:8px 0 4px;padding:14px;border-radius:16px;background:#f2f4f6;font-size:30px;line-height:38px;font-weight:700;letter-spacing:4px;color:#191f28;font-variant-numeric:tabular-nums')}>{issued.code}</button>
            <span style={css('font-size:15px;line-height:22.5px;color:#4e5968')}>{issued.loginId ? `아이디 ${issued.loginId}와 ` : ''}이 번호로 1분쯤 뒤에 로그인하면 새 비밀번호를 정해요. 번호를 누르면 복사돼요</span>
          </div>
          <button data-g="primary" className="pr-96" onClick={() => setIssued(null)} style={css('height:54px;border-radius:16px;background:#3182f6;color:#ffffff;font-size:17px;font-weight:600')}>확인</button>
        </Dialog>
      )}
      {confirm && (
        <Dialog onScrim={() => setConfirm(null)} gap={20}>
          <div style={css('padding:0 4px;display:flex;flex-direction:column;gap:8px')}>
            <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>{confirm.title}</span>
            <span style={css('font-size:15px;line-height:22.5px;color:#4e5968')}>{confirm.desc}</span>
          </div>
          <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:8px')}>
            <button data-g="secondary" className="pr-96" onClick={() => setConfirm(null)} style={css('height:54px;border-radius:16px;background:#f2f4f6;color:#4e5968;font-size:17px;font-weight:600')}>닫기</button>
            <button className="pr-96" onClick={() => { const c = confirm; setConfirm(null); c.go() }}
              style={sx('height:54px;border-radius:16px;color:#ffffff;font-size:17px;font-weight:600', { background: confirm.danger ? '#f04452' : '#3182f6' })}>{confirm.cta}</button>
          </div>
        </Dialog>
      )}
      {ledgerOf && <LedgerSheet uid={ledgerOf} title={`${all.find(p => p.id === ledgerOf)?.name ?? ''}님의 거래 내역`} byId={new Map(all.map(p => [p.id, p]))} onClose={() => setLedgerOf(null)} />}
    </div>
  )
}

/** Full-screen blocker while an admin op runs, showing the three token checks per batch. */
export function AdminProgressOverlay({ label, p }: { label: string; p: AdminProgress }) {
  return (
    <div style={css('position:fixed;inset:0;z-index:500;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;padding:24px;animation:fade 200ms ease both')}>
      <div data-g="l4" role="status" aria-live="polite" style={css('width:100%;max-width:320px;background:#fff;border-radius:24px;padding:28px 24px;display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center')}>
        <span style={css('font-size:18px;font-weight:700;color:#191f28')}>{label} 중이에요</span>
        <div style={css('display:flex;gap:10px')}>
          {[1, 2, 3].map(i => (
            <span key={i} style={sx('width:40px;height:40px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;transition:background 200ms,color 200ms', { background: p.verified >= i ? '#3182f6' : '#f2f4f6', color: p.verified >= i ? '#fff' : '#b0b8c1' })}>
              {p.verified >= i ? '✓' : i}
            </span>
          ))}
        </div>
        <span style={css('font-size:14px;line-height:21px;color:#6b7684')}>
          보안 토큰 확인 {p.verified}/3{p.batches > 1 ? ` · 묶음 ${p.batch}/${p.batches}` : ''}
        </span>
      </div>
    </div>
  )
}

type IpProps = { tools: IpTools; all: Person[]; run: Props['run']; setConfirm: (c: Confirm) => void }

/** One address: who made an account on it, whether it's blocked, and the buttons. */
function IpControl({ ip, tools, all, run, setConfirm, onChange }: IpProps & { ip: string; onChange?: () => void }) {
  const [d, setD] = useState<IpDoc | null | undefined>(undefined)
  const [tick, setTick] = useState(0)
  useEffect(() => { let on = true; setD(undefined); tools.read(ip).then(x => on && setD(x), () => on && setD(null)); return () => { on = false } }, [ip, tick]) // eslint-disable-line react-hooks/exhaustive-deps
  const owner = d?.uid ? all.find(p => p.id === d.uid)?.name ?? '탈퇴한 계정' : null
  const mine = ip === tools.mine
  const go = (label: string, op: IpOp) => run(label, p => tools.set(ip, op, p)).then(ok => { if (ok) { setTick(t => t + 1); onChange?.() } })
  const chip = 'height:22px;padding:0 8px;border-radius:9999px;font-size:12px;font-weight:700;display:flex;align-items:center'
  const btn = 'flex:1;height:40px;border-radius:12px;font-size:14px;font-weight:700'
  return (
    <div style={css('display:flex;flex-direction:column;gap:8px')}>
      <span style={css('display:flex;align-items:center;gap:6px;flex-wrap:wrap')}>
        <span style={css('font-size:15px;font-weight:700;color:#191f28;font-variant-numeric:tabular-nums;word-break:break-all')}>{ip}</span>
        {mine && <span style={css(chip + ';background:#e8f3ff;color:#1b64da')}>지금 내 IP</span>}
        {d?.blocked && <span style={css(chip + ';background:#fff0f1;color:#e42939')}>차단 중</span>}
      </span>
      <span style={css(hint)}>{d === undefined ? '확인하는 중…' : owner ? `이 IP에서 만든 계정: ${owner} · 새 계정을 못 만들어요` : '이 IP로 만든 계정이 없어요 · 계정을 하나 만들 수 있어요'}</span>
      {d !== undefined && (
        <span style={css('display:flex;gap:6px')}>
          {d?.blocked
            ? <button className="pr-96" onClick={() => setConfirm({ title: `${ip} 차단을 풀까요?`, desc: '이 IP로 접속하는 사람이 다시 앱을 쓸 수 있어요.', cta: '차단 풀기', go: () => { go('IP 차단 풀기', 'unblock') } })} style={css(btn + ';background:#e8f3ff;color:#1b64da')}>차단 풀기</button>
            : <button className="pr-96" disabled={mine} onClick={() => setConfirm({ title: `${ip}를 차단할까요?`, desc: '이 IP로 접속하는 사람은 앱이 계속 로딩만 돼요. 언제든 풀 수 있어요.', cta: '차단', danger: true, go: () => { go('IP 차단', 'block') } })} style={sx(btn + ';background:#f04452;color:#fff', { opacity: mine ? 0.4 : 1 })}>IP 차단</button>}
          {owner && <button className="pr-96" onClick={() => setConfirm({ title: '가입 제한을 풀까요?', desc: `${ip}에서 계정을 하나 더 만들 수 있게 돼요 (학교·집 와이파이를 같이 쓰는 친구 등).`, cta: '풀기', go: () => { go('가입 제한 풀기', 'release') } })} style={css(btn + ';background:#f2f4f6;color:#333d4b')}>가입 제한 풀기</button>}
        </span>
      )}
    </div>
  )
}

/** 관리자 → IP 관리: blocked addresses, and looking one up. */
function IpSection(p: IpProps) {
  const [list, setList] = useState<{ ip: string; uid?: string }[] | null>(null)
  const [tick, setTick] = useState(0)
  const [q, setQ] = useState('')
  const [shown, setShown] = useState<string | null>(null)
  useEffect(() => { p.tools.blocked().then(setList, () => setList([])) }, [tick]) // eslint-disable-line react-hooks/exhaustive-deps
  const addr = q.trim()
  const ok = /^[0-9a-fA-F.:]{3,45}$/.test(addr)
  const refresh = () => setTick(t => t + 1)
  return (
    <section style={css('padding:24px 24px;display:flex;flex-direction:column;gap:12px')}>
      <span style={css(sectionTitle)}>IP 관리</span>
      <span style={css(hint)}>한 IP에서는 계정을 하나만 만들 수 있어요. 차단한 IP로 접속하면 앱이 계속 로딩만 돼요. VPN이나 다른 인터넷으로는 피할 수 있어요</span>
      <div style={css('display:flex;gap:8px')}>
        <input data-g="l1" className="ring-focus" inputMode="decimal" value={q} onChange={e => setQ(e.target.value)} placeholder="IP 주소 (예: 1.2.3.4)" style={sx(field, { flex: 1 })} />
        <button data-g="primary" className="pr-96" disabled={!ok} onClick={() => setShown(addr)} style={sx('height:48px;padding:0 18px;border-radius:14px;background:#3182f6;color:#fff;font-size:15px;font-weight:600;flex:none', { opacity: ok ? 1 : 0.4 })}>조회</button>
      </div>
      {shown && <div data-g="l1" style={css('padding:14px;border-radius:14px;background:#f9fafb')}><IpControl key={shown} ip={shown} {...p} onChange={refresh} /></div>}
      <span style={css('font-size:15px;font-weight:700;color:#191f28;margin-top:4px')}>차단한 IP{list ? ` ${list.length}개` : ''}</span>
      {list === null ? <span style={css(hint)}>불러오는 중…</span> : list.length === 0 ? <span style={css(hint)}>차단한 IP가 없어요</span> : list.map(b => (
        <div key={b.ip} data-g="l1" style={css('padding:12px 14px;border-radius:14px;background:#f9fafb;display:flex;align-items:center;gap:10px')}>
          <span style={css('flex:1;min-width:0;display:flex;flex-direction:column')}>
            <span style={css('font-size:15px;font-weight:700;color:#191f28;word-break:break-all')}>{b.ip}</span>
            <span style={css('font-size:13px;color:#6b7684')}>{b.uid ? ownerOf(p.all, b.uid) : '만든 계정 없음'}</span>
          </span>
          <button className="pr-96" onClick={() => p.setConfirm({ title: `${b.ip} 차단을 풀까요?`, desc: '이 IP로 접속하는 사람이 다시 앱을 쓸 수 있어요.', cta: '차단 풀기', go: () => { p.run('IP 차단 풀기', pr => p.tools.set(b.ip, 'unblock', pr)).then(ok => { if (ok) refresh() }) } })}
            style={css('flex:none;height:36px;padding:0 14px;border-radius:10px;background:#e8f3ff;color:#1b64da;font-size:14px;font-weight:700')}>풀기</button>
        </div>
      ))}
    </section>
  )
}
const ownerOf = (people: Person[], uid: string) => `${people.find(x => x.id === uid)?.name ?? '탈퇴한 계정'}의 IP`

/** In someone's admin panel: the address they last used the app from. */
function PersonIp({ uid, name, ...p }: IpProps & { uid: string; name: string }) {
  const [ip, setIp] = useState<string | null | undefined>(undefined)
  useEffect(() => { let on = true; p.tools.lastOf(uid).then(x => on && setIp(x), () => on && setIp(null)); return () => { on = false } }, [uid]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div data-g="l1" style={css('padding:16px;border-radius:16px;background:#f9fafb;display:flex;flex-direction:column;gap:10px')}>
      <span style={css('font-size:15px;font-weight:700;color:#191f28')}>접속 IP</span>
      {ip === undefined ? <span style={css(hint)}>확인하는 중…</span> : ip === null ? <span style={css(hint)}>{name}님이 이 기능이 생긴 뒤로 아직 접속하지 않았어요</span> : <IpControl ip={ip} {...p} />}
    </div>
  )
}

import { useState } from 'react'
import { css, sx } from '../css'
import type { AdminProgress } from '../backend/admin'
import { pointsOf } from '../backend/candidates'
import type { Ticket } from '../backend/support'
import type { Season } from '../backend/types'
import type { Person } from '../model'
import { Avatar } from './Avatar'
import { SearchIcon } from './icons'
import { Dialog } from './Overlays'

type Props = {
  all: Person[]
  tickets: Ticket[]
  onOpenTicket: (id: string) => void
  postNotice: (title: string, body: string, onProgress: (p: AdminProgress) => void) => Promise<void>
  season: Season
  /** Runs one admin operation; resolves when done, rejects with the Firebase error. */
  run: (label: string, op: (onProgress: (p: AdminProgress) => void) => Promise<void>) => Promise<boolean>
  grantPoints: (target: string, amount: number, onProgress: (p: AdminProgress) => void) => Promise<void>
  setSeasonName: (name: string, onProgress: (p: AdminProgress) => void) => Promise<void>
  resetSeason: (name: string, onProgress: (p: AdminProgress) => void) => Promise<void>
  renameUser: (target: string, name: string, onProgress: (p: AdminProgress) => void) => Promise<void>
  deleteAccount: (target: string, onProgress: (p: AdminProgress) => void) => Promise<void>
  onLogout: () => void
}

const sectionTitle = 'font-size:17px;line-height:25.5px;font-weight:700;color:#191f28'
const hint = 'font-size:13px;line-height:19.5px;color:#6b7684'
const field = 'height:48px;border:0;border-radius:14px;background:#f2f4f6;padding:0 14px;font-size:16px;color:#191f28;min-width:0'
const gap = <div data-g="gap" style={css('height:16px;background:#f2f4f6')} />

type Confirm = { title: string; desc: string; cta: string; danger?: boolean; go: () => void }

export function AdminScreen({ all, tickets, onOpenTicket, postNotice, season, run, grantPoints, setSeasonName, resetSeason, renameUser, deleteAccount, onLogout }: Props) {
  const [nameDraft, setNameDraft] = useState('')
  const [notice, setNotice] = useState({ title: '', body: '' })
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [rename, setRename] = useState('')
  const [confirm, setConfirm] = useState<Confirm | null>(null)

  const person = all.find(p => p.id === picked)
  const list = (q.trim() ? all.filter(p => p.name.includes(q.trim())) : all).slice(0, 30)
  const amt = Number(amount)
  const amountOk = amount.trim() !== '' && Number.isInteger(amt) && amt !== 0 && Math.abs(amt) <= 1_000_000
  const renameOk = !!person && rename.trim().length >= 1 && rename.trim().length <= 20 && rename.trim() !== person.name
  const nameOk = nameDraft.trim().length >= 1 && nameDraft.trim().length <= 20

  return (
    <div data-g="clear" style={css('flex:1;background:#ffffff;padding-bottom:32px')}>
      <div style={css('padding:32px 24px 20px;display:flex;flex-direction:column;gap:4px')}>
        <h1 style={css('margin:0;font-size:22px;line-height:31px;font-weight:700;color:#191f28')}>관리자</h1>
        <p style={css('margin:0;font-size:15px;line-height:22.5px;color:#6b7684')}>모든 작업은 1회용 보안 토큰 3개를 발급·확인한 뒤에 실행돼요</p>
      </div>

      {gap}
      <section style={css('padding:24px 24px;display:flex;flex-direction:column;gap:12px')}>
        <span style={css(sectionTitle)}>공지사항</span>
        <input data-g="l1" className="ring-focus" value={notice.title} maxLength={40} onChange={e => setNotice(n => ({ ...n, title: e.target.value }))} placeholder="제목 (40자까지)" style={css(field)} />
        <textarea data-g="l1" className="ring-focus" value={notice.body} maxLength={2000} rows={4} onChange={e => setNotice(n => ({ ...n, body: e.target.value }))} placeholder="내용" style={css('resize:vertical;min-height:100px;border:0;border-radius:14px;background:#f2f4f6;padding:12px 14px;font:inherit;font-size:16px;line-height:24px;color:#191f28;outline:none')} />
        <button data-g="primary" className="pr-96" disabled={!notice.title.trim() || !notice.body.trim()}
          onClick={() => setConfirm({
            title: '이 공지를 보낼까요?',
            desc: `“${notice.title.trim()}” — 로그인한 모든 사람에게 앱을 열 때 화면 전체로 한 번 보여요. 보낸 공지는 고칠 수 없어요.`,
            cta: '보내기',
            go: async () => { if (await run('공지 보내기', p => postNotice(notice.title, notice.body, p))) setNotice({ title: '', body: '' }) },
          })}
          style={sx('height:48px;border-radius:14px;background:#3182f6;color:#fff;font-size:15px;font-weight:600;transition:opacity 200ms', { opacity: notice.title.trim() && notice.body.trim() ? 1 : 0.4 })}>공지 보내기</button>
        <span style={css(hint)}>로그인한 사람만, 한 번만 볼 수 있어요</span>
      </section>
      {gap}
      <section style={css('padding:24px 0 12px;display:flex;flex-direction:column;gap:4px')}>
        <span style={css('padding:0 24px;' + sectionTitle)}>상담 {tickets.filter(t => t.last?.from === 'user' && !t.adminRead).length ? <span style={css('color:#3182f6')}>· 새 메시지 {tickets.filter(t => t.last?.from === 'user' && !t.adminRead).length}</span> : null}</span>
        {tickets.length === 0 && <span style={css('padding:4px 24px 8px;' + hint)}>아직 상담이 없어요</span>}
        <div className="anim-list">
          {tickets.slice(0, 20).map(t => {
            const unread = t.last?.from === 'user' && !t.adminRead
            return (
              <button key={t.id} className="pr-dim" onClick={() => onOpenTicket(t.id)} style={css('width:calc(100% - 8px);margin:0 4px;display:flex;align-items:center;gap:12px;padding:12px 20px;border-radius:12px;text-align:left')}>
                <span style={css('flex:1;min-width:0;display:flex;flex-direction:column')}>
                  <span style={sx('font-size:17px;line-height:25.5px;color:#191f28', { fontWeight: unread ? 600 : 500 })}>{t.name || '이름 없음'} <span style={css('font-size:13px;color:#8b95a1;font-weight:400')}>@{t.loginId || '?'}</span></span>
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
            desc: `모든 점수와 투표가 0이 되고 '${nameDraft.trim()}' 시즌이 시작돼요. 이번 시즌 받은 추천 수는 각자 포인트로 옮겨져요. 되돌릴 수 없어요.`,
            cta: '초기화하기', danger: true,
            go: async () => { if (await run('시즌 초기화', p => resetSeason(nameDraft.trim(), p))) setNameDraft('') },
          })}
          style={sx('height:48px;border-radius:14px;background:#fff0f1;color:#e42939;font-size:15px;font-weight:600;transition:opacity 200ms', { opacity: nameOk ? 1 : 0.4 })}>
          위 이름으로 새 시즌 시작하기 (초기화)
        </button>
        <span style={css(hint)}>이름만 바꾸면 점수는 그대로예요. 초기화는 새 시즌 이름을 먼저 적어야 할 수 있어요</span>
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
                <span style={css('font-size:13px;color:#6b7684;font-variant-numeric:tabular-nums')}>{p.rank}위 · {p.scoreLabel}점 · {pointsOf(p).toLocaleString()}P</span>
              </span>
              {on && <span style={css('width:22px;height:22px;border-radius:9999px;background:#3182f6;color:#fff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center')}>✓</span>}
            </button>
          )
        })}
      </div>

      {person && (
        <section style={css('padding:16px 24px 8px;display:flex;flex-direction:column;gap:12px')}>
          <span style={css('font-size:15px;font-weight:700;color:#191f28')}>{person.name}님에게</span>
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

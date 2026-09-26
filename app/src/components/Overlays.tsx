import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { css, sx } from '../css'
import { BANNERS, MEDALS, THEMES } from '../data'
import { APK_URL, canPromptInstall, detectPlatform, isIosSafari, onInstallPromptChange, promptInstall } from '../install'
import type { Person } from '../model'
import type { WeekKind } from '../backend/types'
import { Segmented } from './AccountScreen'
import { Avatar } from './Avatar'
import { CloseIcon } from './icons'
import { PlateBanner } from './Nameplate'

const handle = <div style={css('width:36px;height:4px;border-radius:2px;background:#e5e8eb;margin:0 auto')} />
const bigBtn = 'height:56px;border-radius:16px;font-size:17px;font-weight:600'

/**
 * The part of the screen the on-screen keyboard covers (iPhone keeps the page
 * height and draws the keyboard over it), plus the visible height — so sheets
 * and dialogs can sit above the keyboard instead of behind it.
 */
export function useVisibleViewport() {
  const read = () => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    return vv ? { inset: Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)), top: vv.offsetTop, height: vv.height } : { inset: 0, top: 0, height: typeof window !== 'undefined' ? window.innerHeight : 800 }
  }
  const [v, setV] = useState(read)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const u = () => setV(read())
    vv.addEventListener('resize', u); vv.addEventListener('scroll', u)
    return () => { vv.removeEventListener('resize', u); vv.removeEventListener('scroll', u) }
  }, [])
  return v
}

/**
 * Sheets and dialogs render at the page root: inside an animated screen (e.g. the
 * chat room, whose entry animation leaves a transform) position:fixed would be
 * relative to that screen and clipped by it, which put the 선물 sheet behind the keyboard.
 */
const toRoot = (node: ReactNode) => createPortal(node, document.getElementById('overlay-root') ?? document.body)

/** Dimmed scrim + bottom sheet shell, centred to the app column; rides above the keyboard. */
export function BottomSheet({ onScrim, scrim, sheetStyle, children }: { onScrim: () => void; scrim: string; sheetStyle: string; children: ReactNode }) {
  const vp = useVisibleViewport()
  return toRoot(
    <>
      <div data-g="scrim" onClick={onScrim} style={sx('position:fixed;inset:0;z-index:260;animation:fade 200ms ease both', { background: scrim })} />
      <div style={sx('position:fixed;left:0;right:0;z-index:261;display:flex;justify-content:center;pointer-events:none;transition:bottom 220ms cubic-bezier(0.16,1,0.3,1)', { bottom: vp.inset })}>
        <div data-g="l4" style={sx('width:100%;max-width:430px;background:#ffffff;pointer-events:auto;overflow-y:auto;overscroll-behavior:contain;' + sheetStyle, { maxHeight: vp.height - 16 })}>{children}</div>
      </div>
    </>
  )
}

/** Centred modal dialog (real-name rule, purchase, admin confirmations). */
export function Dialog({ onScrim, labelledBy, gap, children }: { onScrim: () => void; labelledBy?: string; gap: number; children: ReactNode }) {
  const vp = useVisibleViewport()
  return toRoot(
    <>
      <div data-g="scrim" onClick={onScrim} style={css('position:fixed;inset:0;z-index:300;background:rgba(0,0,0,0.4);animation:fade 200ms ease both')} />
      <div style={sx('position:fixed;left:0;right:0;z-index:301;display:flex;align-items:center;justify-content:center;padding:24px;pointer-events:none;transition:top 220ms,height 220ms', { top: vp.top, height: vp.height })}>
        <div role="dialog" aria-modal="true" aria-labelledby={labelledBy} data-g="l4" style={sx('width:100%;max-width:340px;background:#ffffff;border-radius:24px;padding:28px 20px 20px;pointer-events:auto;display:flex;flex-direction:column;animation:popIn 360ms cubic-bezier(0.34,1.4,0.64,1) both', { gap })}>
          {children}
        </div>
      </div>
    </>
  )
}

type VoteColors = { up: string; down: string; downWeak: string; downWeakFg: string }

export function VoteSheet({ d, loggedIn, colors, onVote, onClose, onLogin }: { d: Person; loggedIn: boolean; colors: VoteColors; onVote: (kind: WeekKind) => void; onClose: () => void; onLogin: () => void }) {
  const sub = !d.inWeek ? '일주일에 한 번 추천이나 비추천을 할 수 있어요. 7일 안에는 바꾸거나 취소할 수 있어요'
    : d.weekKind === 'none' ? `이번 주 투표를 취소했어요. ${d.weekLeft} 안에 다시 고를 수 있어요`
    : `이번 주에 ${d.weekKind === 'up' ? '추천' : '비추천'}했어요. ${d.weekLeft} 안에는 바꾸거나 취소할 수 있어요`
  const upOn = d.weekKind === 'up', downOn = d.weekKind === 'down'
  return (
    <BottomSheet onScrim={onClose} scrim="rgba(0,0,0,0.2)" sheetStyle="border-radius:28px 28px 0 0;padding:8px 0 calc(20px + env(safe-area-inset-bottom));animation:sheetUp 400ms cubic-bezier(0.16,1,0.3,1) both">
      {handle}
      {!loggedIn ? (
        <>
          <div style={css('padding:24px 24px 0;display:flex;flex-direction:column;gap:4px')}>
            <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>로그인하면 투표할 수 있어요</span>
            <span style={css('font-size:15px;line-height:22.5px;font-weight:500;color:#6b7684')}>{d.name}님에게 추천이나 비추천을 남겨보세요</span>
          </div>
          <div style={css('padding:24px 20px 0;display:grid;grid-template-columns:1fr 1fr;gap:8px')}>
            <button data-g="secondary" className="pr-96" onClick={onClose} style={css(bigBtn + ';background:#f2f4f6;color:#4e5968;transition:transform 150ms')}>닫기</button>
            <button data-g="primary" className="pr-96" onClick={onLogin} style={css(bigBtn + ';background:#3182f6;color:#ffffff;transition:transform 150ms')}>로그인하기</button>
          </div>
        </>
      ) : (
        <>
          <div style={css('padding:24px 24px 0;display:flex;flex-direction:column;gap:4px')}>
            <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>{d.inWeek && d.weekKind !== 'none' ? `${d.name}님 투표를 바꿀까요?` : `${d.name}님에게 투표할까요?`}</span>
            <span style={css('font-size:15px;line-height:22.5px;font-weight:500;color:#6b7684')}>{sub}</span>
          </div>
          <div style={css('padding:20px 24px 0;display:flex;flex-direction:column;gap:8px')}>
            <div style={css('display:flex;justify-content:space-between;font-size:15px;font-weight:600;font-variant-numeric:tabular-nums')}>
              <span style={{ color: colors.up }}>추천 {d.upLabel}</span>
              <span style={{ color: colors.down }}>비추천 {d.downLabel}</span>
            </div>
            <div style={css('height:8px;border-radius:4px;overflow:hidden;display:flex;gap:2px')}>
              <span style={sx('height:100%;border-radius:4px;transition:width 400ms cubic-bezier(0.22,1,0.36,1)', { width: (d.upN + d.downN ? Math.round(d.upN / (d.upN + d.downN) * 100) : 50) + '%', background: colors.up })} />
              <span style={sx('height:100%;border-radius:4px;flex:1', { background: colors.down })} />
            </div>
          </div>
          <div style={css('padding:24px 20px 0;display:grid;grid-template-columns:1fr 1fr;gap:8px')}>
            <button className="pr-96" aria-pressed={downOn} onClick={() => onVote(downOn ? 'none' : 'down')} style={sx(bigBtn + ';transition:transform 150ms,background 200ms', downOn ? { background: colors.down, color: '#ffffff' } : { background: colors.downWeak, color: colors.downWeakFg })}>{downOn ? '✓ 비추천 · 취소' : upOn ? '비추천으로 바꾸기' : '비추천'}</button>
            <button className="pr-96" aria-pressed={upOn} onClick={() => onVote(upOn ? 'none' : 'up')} style={sx(bigBtn + ';transition:transform 150ms,background 200ms', upOn ? { background: '#f2f4f6', color: colors.up, boxShadow: `inset 0 0 0 2px ${colors.up}` } : { background: colors.up, color: '#ffffff' })}>{upOn ? '✓ 추천 · 취소' : downOn ? '추천으로 바꾸기' : '추천'}</button>
          </div>
        </>
      )}
    </BottomSheet>
  )
}

export function ProfileSheet({ d, onClose, onCta, onMessage, canMessage }: { d: Person; onClose: () => void; onCta: () => void; onMessage: () => void; canMessage: boolean }) {
  const medal = MEDALS[d.rank - 1]
  const stat = (k: string, v: string) => (
    <div data-g="l1" style={css('padding:14px 16px;border-radius:16px;background:#f9fafb;display:flex;flex-direction:column;gap:2px')}>
      <span style={css('font-size:12px;color:#6b7684')}>{k}</span>
      <span style={css('font-size:17px;font-weight:700;color:#191f28;font-variant-numeric:tabular-nums')}>{v}</span>
    </div>
  )
  return (
    <BottomSheet onScrim={onClose} scrim="rgba(0,0,0,0.32)" sheetStyle="border-radius:28px 28px 0 0;overflow:hidden;padding-bottom:calc(20px + env(safe-area-inset-bottom));animation:sheetUp 420ms cubic-bezier(0.22,1,0.36,1) both">
      <PlateBanner kind={d.plate} fallback={BANNERS[d.frame] || BANNERS.none} name={d.name} sub={d.bio || '아직 소개가 없어요'} height={136}>
        <div style={css('position:absolute;top:8px;left:50%;margin-left:-18px;width:36px;height:4px;border-radius:2px;background:rgba(255,255,255,0.7)')} />
        <button className="pr-94" onClick={onClose} aria-label="닫기" style={css('position:absolute;top:12px;right:12px;width:36px;height:36px;border-radius:9999px;background:rgba(0,0,0,0.28);display:flex;align-items:center;justify-content:center')}><CloseIcon size={18} stroke="#fff" width={2.6} /></button>
      </PlateBanner>
      <div style={css('position:relative;padding:0 24px')}>
        <div data-g="clear" style={css('position:absolute;top:-52px;left:18px;width:104px;height:104px;border-radius:9999px;background:#ffffff;display:flex;align-items:center;justify-content:center')}>
          <span style={css('width:88px;height:88px')}><Avatar frame={d.frame} photo={d.photoCss} size={88} /></span>
        </div>
        <div style={css('display:flex;justify-content:flex-end;align-items:center;gap:8px;padding-top:12px;min-height:52px')}>
          {d.loginId && <span style={css('margin-right:auto;margin-left:110px;font-size:15px;line-height:22.5px;font-weight:500;color:#6b7684;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0')}>@{d.loginId}</span>}
          <span style={sx('height:30px;padding:0 12px;border-radius:9999px;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums', { background: medal ? medal[0] : '#f2f4f6', color: medal ? medal[1] : '#4e5968' })}>{d.rank}위</span>
        </div>
        <div style={css('margin-top:4px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px')}>
          {stat('점수', d.scoreLabel)}{stat('추천', d.upLabel)}{stat('비추천', d.downLabel)}
        </div>
        <div style={css('margin-top:20px;display:flex;gap:8px')}>
          {!d.isMe && (
            <button data-g="secondary" className="pr-96" onClick={onMessage} disabled={!canMessage} aria-label="메시지 보내기" style={sx('height:56px;padding:0 18px;border-radius:16px;background:#e8f3ff;color:#1b64da;font-size:16px;font-weight:600;display:flex;align-items:center;gap:6px;flex:none;transition:transform 150ms', { opacity: canMessage ? 1 : 0.45 })}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"><path d="M22 3 9.218 10.083" /><path d="M11.698 20.334 22 3.001H2l7.218 7.083z" /></svg>
              {d.msgOff ? '메시지 꺼둠' : '메시지'}
            </button>
          )}
          <button data-g="primary" className="pr-96" onClick={onCta} style={css('flex:1;min-width:0;height:56px;border-radius:16px;background:#3182f6;color:#ffffff;font-size:17px;font-weight:600;transition:transform 150ms')}>{d.isMe ? '내 프로필 꾸미기' : '투표하기'}</button>
        </div>
      </div>
    </BottomSheet>
  )
}

export function RuleDialog({ checked, onToggle, onConfirm, onNudge }: { checked: boolean; onToggle: () => void; onConfirm: () => void; onNudge: () => void }) {
  return (
    <Dialog onScrim={onNudge} labelledBy="rule-title" gap={20}>
      <div style={css('padding:0 4px;display:flex;flex-direction:column;gap:12px')}>
        <span style={css('width:44px;height:44px;border-radius:9999px;background:#fff0f1;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:#f04452')}>!</span>
        <span id="rule-title" style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>반드시 본인 실명으로<br />적어주세요</span>
        <span style={css('font-size:15px;line-height:22.5px;color:#4e5968')}>닉네임이나 가명으로는 가입할 수 없어요. 실명이 아니면 투표가 무효 처리돼요.</span>
      </div>
      <button onClick={onToggle} role="checkbox" aria-checked={checked} style={sx('display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:14px;text-align:left;transition:background 200ms,box-shadow 200ms', { background: checked ? '#e8f3ff' : '#f9fafb', boxShadow: checked ? 'inset 0 0 0 1.5px #3182f6' : 'none' })}>
        <span style={sx('width:24px;height:24px;border-radius:7px;flex:none;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:#ffffff;transition:background 200ms,box-shadow 200ms', { background: checked ? '#3182f6' : '#ffffff', boxShadow: checked ? 'none' : 'inset 0 0 0 2px #d1d6db' })}>{checked ? '✓' : ''}</span>
        <span style={css('font-size:15px;line-height:22.5px;font-weight:600;color:#191f28')}>위 규칙을 읽고 이해했어요</span>
      </button>
      <button data-g="primary" className="pr-96" onClick={() => checked && onConfirm()} disabled={!checked} style={sx('height:54px;border-radius:16px;background:#3182f6;color:#ffffff;font-size:17px;font-weight:600;transition:transform 150ms,opacity 200ms', { opacity: checked ? 1 : 0.4 })}>확인</button>
    </Dialog>
  )
}

export type BuyState = { title: string; desc: string; price: string; remain: string; can: boolean; cta: string }

export function BuyDialog({ b, onClose, onConfirm }: { b: BuyState; onClose: () => void; onConfirm: () => void }) {
  return (
    <Dialog onScrim={onClose} gap={20}>
      <div style={css('padding:0 4px;display:flex;flex-direction:column;gap:8px')}>
        <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>{b.title}</span>
        <span style={css('font-size:15px;line-height:22.5px;color:#4e5968')}>{b.desc}</span>
      </div>
      <div data-g="l1" style={css('padding:14px 16px;border-radius:14px;background:#f9fafb;display:flex;flex-direction:column;gap:8px;font-size:15px;font-variant-numeric:tabular-nums')}>
        <span style={css('display:flex;justify-content:space-between')}><span style={{ color: '#6b7684' }}>가격</span><span style={css('font-weight:700;color:#191f28')}>{b.price}</span></span>
        <span style={css('display:flex;justify-content:space-between')}><span style={{ color: '#6b7684' }}>사고 남는 포인트</span><span style={{ fontWeight: 700, color: b.can ? '#191f28' : '#f04452' }}>{b.remain}</span></span>
      </div>
      <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:8px')}>
        <button data-g="secondary" className="pr-96" onClick={onClose} style={css('height:54px;border-radius:16px;background:#f2f4f6;color:#4e5968;font-size:17px;font-weight:600')}>닫기</button>
        <button data-g="primary" className="pr-96" onClick={() => b.can && onConfirm()} disabled={!b.can} style={sx('height:54px;border-radius:16px;background:#3182f6;color:#ffffff;font-size:16px;font-weight:600;transition:opacity 200ms', { opacity: b.can ? 1 : 0.4 })}>{b.cta}</button>
      </div>
    </Dialog>
  )
}

export function ThemeSheet({ theme, onPick, onClose }: { theme: string; onPick: (k: string, label: string) => void; onClose: () => void }) {
  return (
    <BottomSheet onScrim={onClose} scrim="rgba(0,0,0,0.25)" sheetStyle="border-radius:28px 28px 0 0;padding:8px 0 calc(24px + env(safe-area-inset-bottom));animation:sheetUp 420ms cubic-bezier(0.22,1,0.36,1) both">
      {handle}
      <div style={css('padding:20px 24px 16px;display:flex;flex-direction:column;gap:4px')}>
        <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>테마</span>
        <span style={css('font-size:15px;line-height:22.5px;color:#6b7684')}>앱 전체의 재질과 분위기를 바꿔요</span>
      </div>
      <div style={css('padding:0 20px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px')}>
        {THEMES.map(([k, l]) => {
          const on = theme === k
          return (
            <button key={k} data-g="l2" className="pr-97" onClick={() => onPick(k, l)} aria-pressed={on} style={sx('position:relative;padding:8px;border-radius:20px;display:flex;flex-direction:column;gap:10px;text-align:left;transition:transform 200ms cubic-bezier(0.34,1.4,0.64,1),box-shadow 200ms;background:#ffffff', { boxShadow: on ? '0 0 0 2px #3182f6' : '0 0 0 1px #e5e8eb' })}>
              {k === 'default' ? (
                <span style={css('display:flex;flex-direction:column;gap:6px;height:112px;border-radius:14px;background:#f2f4f6;padding:12px')}>
                  <span style={css('height:28px;border-radius:8px;background:#ffffff')} />
                  <span style={css('height:28px;border-radius:8px;background:#ffffff')} />
                  <span data-g="primary" style={css('margin-top:auto;align-self:flex-end;width:56px;height:18px;border-radius:6px;background:#3182f6')} />
                </span>
              ) : (
                <span style={css('position:relative;display:block;height:112px;border-radius:14px;overflow:hidden;background:radial-gradient(70% 60% at 10% 10%,#ffd8c4,rgba(255,216,196,0) 70%),radial-gradient(60% 60% at 95% 30%,#d9d2ff,rgba(217,210,255,0) 70%),radial-gradient(70% 60% at 30% 100%,#c7efe3,rgba(199,239,227,0) 70%),#eef1f6')}>
                  <span style={css('position:absolute;left:12px;right:12px;top:14px;height:36px;border-radius:12px;background:rgba(255,255,255,0.42);-webkit-backdrop-filter:blur(8px) saturate(170%);backdrop-filter:blur(8px) saturate(170%);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.7),inset 0 1px 0 #fff,0 8px 18px -10px rgba(30,40,90,0.3)')} />
                  <span style={css('position:absolute;left:24px;right:24px;bottom:12px;height:28px;border-radius:9999px;background:rgba(255,255,255,0.5);-webkit-backdrop-filter:blur(10px) saturate(180%);backdrop-filter:blur(10px) saturate(180%);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.8),inset 0 1px 0 #fff,0 10px 20px -10px rgba(30,40,90,0.35)')} />
                </span>
              )}
              <span style={css('padding:0 6px 4px;display:flex;align-items:center;justify-content:space-between')}>
                <span style={css('font-size:15px;font-weight:700;color:#191f28')}>{l}</span>
                {on && <span data-g="primary" style={css('width:20px;height:20px;border-radius:9999px;background:#3182f6;color:#ffffff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800')}>✓</span>}
              </span>
            </button>
          )
        })}
      </div>
    </BottomSheet>
  )
}

type Device = 'ios' | 'android'

/** Numbered how-to list used on both install tabs. */
function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol style={css('margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:14px')}>
      {items.map((it, i) => (
        <li key={i} style={css('display:flex;gap:12px;align-items:flex-start')}>
          <span style={css('width:24px;height:24px;flex:none;border-radius:9999px;background:#e8f3ff;color:#1b64da;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:1px')}>{i + 1}</span>
          <span style={css('font-size:15px;line-height:24px;color:#333d4b')}>{it}</span>
        </li>
      ))}
    </ol>
  )
}

const ShareGlyph = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#3182f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-3px', margin: '0 2px' }}><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" /><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" /></svg>
)

const DotsGlyph = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="#3182f6" style={{ verticalAlign: '-3px', margin: '0 2px' }}><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
)

/** "앱 설치하기": iPhone → Safari's 홈 화면에 추가, Galaxy/Android → download the APK (or Chrome's own install prompt). */
export function InstallSheet({ onClose, onToast }: { onClose: () => void; onToast: (msg: string) => void }) {
  const [device, setDevice] = useState<Device>(detectPlatform() === 'ios' ? 'ios' : 'android')
  const [canPrompt, setCanPrompt] = useState(canPromptInstall())
  useEffect(() => onInstallPromptChange(() => setCanPrompt(canPromptInstall())), [])
  const inIosNonSafari = detectPlatform() === 'ios' && !isIosSafari()

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(location.href); onToast('주소를 복사했어요. Safari에 붙여넣어 열어주세요') } catch { onToast('주소를 복사하지 못했어요') }
  }

  return (
    <BottomSheet onScrim={onClose} scrim="rgba(0,0,0,0.25)" sheetStyle="border-radius:28px 28px 0 0;padding:8px 0 calc(24px + env(safe-area-inset-bottom));animation:sheetUp 420ms cubic-bezier(0.22,1,0.36,1) both;max-height:92vh;overflow-y:auto">
      {handle}
      <div style={css('padding:20px 24px 16px;display:flex;flex-direction:column;gap:4px')}>
        <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>앱으로 설치할까요?</span>
        <span style={css('font-size:15px;line-height:22.5px;color:#6b7684')}>홈 화면 아이콘으로 바로 열 수 있어요. 무료예요</span>
      </div>
      <div style={css('padding:0 24px 20px')}>
        <Segmented<Device> options={['ios', 'android']} labels={['아이폰', '갤럭시']} value={device} onPick={setDevice} />
      </div>

      {device === 'ios' ? (
        <div style={css('padding:0 24px;display:flex;flex-direction:column;gap:20px')}>
          {inIosNonSafari && (
            <div data-g="l1" style={css('padding:14px 16px;border-radius:14px;background:#fff8e6;display:flex;flex-direction:column;gap:10px')}>
              <span style={css('font-size:14px;line-height:21px;color:#8a5a00')}>지금 앱 안의 브라우저로 열려 있어요. 아이폰은 <b>Safari</b>에서만 설치할 수 있어요</span>
              <button data-g="secondary" className="pr-96" onClick={copyLink} style={css('align-self:flex-start;height:34px;padding:0 12px;border-radius:10px;background:#ffffff;color:#8a5a00;font-size:14px;font-weight:600')}>주소 복사하기</button>
            </div>
          )}
          <Steps items={[
            <>Safari로 이 페이지를 열어요</>,
            <>화면 아래 주소창 오른쪽의 점 세 개 버튼<DotsGlyph />을 눌러요</>,
            <><b>공유</b><ShareGlyph />를 눌러요</>,
            <>메뉴를 아래로 내려 <b>홈 화면에 추가</b>를 눌러요 (안 보이면 <b>더 보기</b>)</>,
            <><b>웹 앱으로 열기</b>는 켠 채로, 오른쪽 위 <b>추가</b>를 누르면 끝이에요</>,
          ]} />
          <button data-g="primary" className="pr-96" onClick={onClose} style={css(bigBtn + ';margin-top:4px;background:#3182f6;color:#ffffff;transition:transform 150ms')}>확인</button>
        </div>
      ) : (
        <div style={css('padding:0 24px;display:flex;flex-direction:column;gap:20px')}>
          <a data-g="primary" className="pr-96" href={APK_URL} style={css(bigBtn + ';display:flex;align-items:center;justify-content:center;gap:8px;background:#3182f6;color:#ffffff;text-decoration:none;transition:transform 150ms')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7 10.5l5 5 5-5" /><path d="M5 20h14" /></svg>
            설치 파일(APK) 받기
          </a>
          <Steps items={[
            <>받은 <b>popular-vote.apk</b> 파일을 눌러 열어요</>,
            <><b>출처를 알 수 없는 앱</b> 안내가 뜨면 <b>설정</b> → <b>이 출처 허용</b>을 켜요</>,
            <><b>설치</b>를 누르면 끝이에요</>,
          ]} />
          <details style={css('border-radius:14px;background:#f9fafb;padding:14px 16px')}>
            <summary style={css('font-size:15px;font-weight:600;color:#333d4b;cursor:pointer')}>설치가 막히면 이렇게 해보세요</summary>
            <div style={css('margin-top:10px;display:flex;flex-direction:column;gap:8px;font-size:14px;line-height:21px;color:#4e5968')}>
              <span>• <b>Chrome</b>이 "유해할 수 있는 파일"이라고 하면 <b>다운로드</b>(또는 <b>무시하고 다운로드</b>)를 눌러요</span>
              <span>• <b>Play 프로텍트</b> 경고가 뜨면 <b>세부정보 더보기</b> → <b>무시하고 설치</b>를 눌러요</span>
              <span>• 삼성 <b>자동 차단</b>이 켜져 있으면 설정 → 보안 및 개인정보 보호 → <b>자동 차단</b>을 잠시 꺼요</span>
              <span>• 백신 앱(V3 등)이 막으면 그 앱에서 이 파일을 <b>허용</b>해요</span>
              <span>• 예전에 받은 앱이 있는데 "앱이 설치되지 않았어요"가 뜨면, 예전 앱을 한 번 지우고 다시 설치해요 (서명이 바뀌어서 딱 한 번만 필요해요)</span>
            </div>
          </details>
          <span style={css('font-size:13px;line-height:19.5px;color:#8b95a1')}>스토어 밖에서 받는 앱이라 안내가 떠요. 앱 화면은 이 사이트를 그대로 보여줘서, 업데이트도 자동으로 반영돼요. 막는 프로그램이 있으면 아래 <b>홈 화면에 추가</b>로도 똑같이 쓸 수 있어요</span>
          {canPrompt ? (
            <button data-g="secondary" className="pr-96" onClick={async () => { if (await promptInstall()) onClose() }} style={css('height:48px;border-radius:14px;background:#f2f4f6;color:#4e5968;font-size:15px;font-weight:600')}>
              파일 없이 홈 화면에 바로 추가하기
            </button>
          ) : (
            <span style={css('font-size:13px;line-height:19.5px;color:#8b95a1')}>파일 없이 쓰려면 Chrome 메뉴(⋮) → <b>홈 화면에 추가</b>(또는 <b>앱 설치</b>)를 눌러요. 알림도 똑같이 받을 수 있어요</span>
          )}
        </div>
      )}
    </BottomSheet>
  )
}

export function Toast({ msg }: { msg: string }) {
  return (
    <div role="status" aria-live="polite" style={css('position:fixed;left:0;right:0;top:calc(12px + env(safe-area-inset-top));z-index:400;display:flex;justify-content:center;pointer-events:none;padding:0 20px')}>
      <div data-g="l3" key={msg} style={css('max-width:375px;padding:12px 20px;border-radius:22px;background:#ffffff;box-shadow:0 4px 24px rgba(0,27,55,0.14);font-size:15px;line-height:22.5px;font-weight:600;color:rgba(0,12,30,0.8);text-align:center;animation:toastDown 320ms cubic-bezier(0.16,1,0.3,1) both')}>{msg}</div>
    </div>
  )
}

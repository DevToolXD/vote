import { useState } from 'react'
import { css } from '../css'
import type { Rewards } from '../backend/rewards'
import { BottomSheet } from './Overlays'
import { shortPoints } from './PointsChip'

const handle = <div style={css('width:36px;height:4px;border-radius:2px;background:#e5e8eb;margin:0 auto')} />
const bigBtn = 'height:56px;border-radius:16px;font-size:17px;font-weight:600;transition:transform 150ms'

/** Who checks 친구 초대 and pays the 500P (by hand, after a message). */
export const INVITE_ADMIN = '정후교'
export const INVITE_POINTS = 500

type EarnProps = {
  rewards: Rewards
  /** Already got the 300P for opening the installed app. */
  appBonus: boolean
  onInstall: () => void
  /** Opens a chat with 정후교 (undefined when they aren't on the board). */
  onMessageAdmin?: () => void
}

function Row({ icon, title, body, action }: { icon: string; title: string; body: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div style={css('display:flex;gap:14px;align-items:flex-start;padding:14px 0')}>
      <span aria-hidden="true" style={css('width:40px;height:40px;flex:none;border-radius:12px;background:#f2f4f6;display:flex;align-items:center;justify-content:center;font-size:20px')}>{icon}</span>
      <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:2px')}>
        <span style={css('font-size:16px;line-height:24px;font-weight:700;color:#191f28')}>{title}</span>
        <span style={css('font-size:14px;line-height:21px;color:#6b7684;white-space:pre-line')}>{body}</span>
        {action && (
          <button data-g="secondary" className="pr-96" onClick={action.onClick} style={css('align-self:flex-start;margin-top:8px;height:34px;padding:0 12px;border-radius:10px;background:#e8f3ff;color:#1b64da;font-size:14px;font-weight:600')}>{action.label}</button>
        )}
      </span>
    </div>
  )
}

/** The list of ways to get points (used in the sheet and in the first-login guide). */
export function EarnList({ rewards: r, appBonus, onInstall, onMessageAdmin }: EarnProps) {
  return (
    <div style={css('display:flex;flex-direction:column')}>
      <Row icon="🗳️" title="투표 받기 · 한 표에 10P" body={'누가 나한테 추천이든 비추천이든 투표하면 10P를 받아요.\n투표가 취소돼도 받은 포인트는 그대로예요'} />
      <Row
        icon="💌" title={`친구 초대 · ${INVITE_POINTS}P`}
        body={`친구를 초대해서 가입시키고, ${INVITE_ADMIN}에게 메시지로 인증받으면 ${INVITE_POINTS}P를 드려요`}
        action={onMessageAdmin ? { label: `${INVITE_ADMIN}에게 메시지 보내기`, onClick: onMessageAdmin } : undefined}
      />
      <Row
        icon="📲" title="앱 설치 · 300P" body={appBonus ? '이미 받았어요' : '홈 화면에 설치한 앱으로 들어오면 한 번 300P를 받아요'}
        action={appBonus ? undefined : { label: '설치 방법 보기', onClick: onInstall }}
      />
      <Row icon="🏆" title="시즌 보상" body={`시즌이 끝나면 순위대로 받아요\n1등 ${r.first.toLocaleString()}P · 2등 ${r.second.toLocaleString()}P · 3등 ${r.third.toLocaleString()}P · 4~6등 ${r.top6.toLocaleString()}P\n투표를 받거나 한 사람은 모두 ${r.participant.toLocaleString()}P`} />
      <Row icon="🎁" title="선물 받기" body="친구가 채팅에서 포인트를 선물하면 받을 수 있어요" />
    </div>
  )
}

/** 포인트 얻는 법 — opened by tapping my points. */
export function EarnSheet({ points, onClose, ...p }: EarnProps & { points: number; onClose: () => void }) {
  return (
    <BottomSheet onScrim={onClose} scrim="rgba(0,0,0,0.25)" sheetStyle="border-radius:28px 28px 0 0;padding:8px 0 calc(24px + env(safe-area-inset-bottom));animation:sheetUp 420ms cubic-bezier(0.22,1,0.36,1) both;max-height:92vh;overflow-y:auto">
      {handle}
      <div style={css('padding:20px 24px 4px;display:flex;flex-direction:column;gap:4px')}>
        <span style={css('font-size:15px;line-height:22px;color:#6b7684')}>내 포인트</span>
        <span style={css('font-size:28px;line-height:36px;font-weight:800;color:#191f28;font-variant-numeric:tabular-nums')}>{shortPoints(points)}P</span>
        {points >= 10_000 && <span style={css('font-size:13px;line-height:19px;color:#8b95a1;font-variant-numeric:tabular-nums;word-break:break-all')}>{points.toLocaleString()}P</span>}
      </div>
      <div style={css('padding:12px 24px 0')}>
        <span style={css('font-size:18px;line-height:27px;font-weight:700;color:#191f28')}>포인트 얻는 법</span>
        <EarnList {...p} />
      </div>
      <div style={css('padding:8px 24px 0')}>
        <button data-g="primary" className="pr-96" onClick={onClose} style={css(bigBtn + ';width:100%;background:#3182f6;color:#ffffff')}>확인</button>
      </div>
    </BottomSheet>
  )
}

const STEPS: { icon: string; title: string; body: string }[] = [
  { icon: '📊', title: '랭킹', body: '추천에서 비추천을 뺀 점수로 순위가 매겨져요.\n이름을 누르면 그 사람에게 투표할 수 있어요' },
  { icon: '🗳️', title: '투표', body: '한 사람에게 일주일에 한 번 추천이나 비추천을 할 수 있어요.\n7일 안에는 바꾸거나 취소할 수 있어요' },
  { icon: '🛍️', title: '상점', body: '포인트로 세트(프레임 + 이름표, 레전드는 막대 스킨까지)를 사서 나를 꾸며요. 당근마켓에선 하나씩 사고팔 수 있어요' },
  { icon: '💬', title: '메시지', body: '친구와 1:1, 단톡으로 이야기하고 포인트나 아이템을 선물해요' },
]

/** First-login guide: how the app works, then how to get points. */
export function WelcomeGuide({ name, onClose, ...p }: EarnProps & { name: string; onClose: () => void }) {
  const [step, setStep] = useState<0 | 1>(0)
  return (
    <BottomSheet onScrim={() => {}} scrim="rgba(0,0,0,0.35)" sheetStyle="border-radius:28px 28px 0 0;padding:8px 0 calc(24px + env(safe-area-inset-bottom));animation:sheetUp 420ms cubic-bezier(0.22,1,0.36,1) both;max-height:92vh;overflow-y:auto">
      {handle}
      <div style={css('padding:20px 24px 4px;display:flex;flex-direction:column;gap:4px')}>
        <span style={css('font-size:13px;font-weight:600;color:#3182f6')}>{step + 1} / 2</span>
        <span style={css('font-size:22px;line-height:31px;font-weight:700;color:#191f28')}>{step === 0 ? `${name}님, 반가워요 👋` : '포인트 얻는 법'}</span>
        <span style={css('font-size:15px;line-height:22.5px;color:#6b7684')}>{step === 0 ? '이렇게 쓰면 돼요' : '모은 포인트는 상점에서 써요. 화면 위 포인트를 누르면 언제든 다시 볼 수 있어요'}</span>
      </div>
      <div style={css('padding:4px 24px 0')}>
        {step === 0 ? STEPS.map(s => <Row key={s.title} {...s} />) : <EarnList {...p} />}
      </div>
      <div style={css('padding:12px 24px 0;display:flex;gap:8px')}>
        {step === 1 && <button data-g="secondary" className="pr-96" onClick={() => setStep(0)} style={css(bigBtn + ';flex:1;background:#f2f4f6;color:#4e5968')}>이전</button>}
        <button data-g="primary" className="pr-96" onClick={() => (step === 0 ? setStep(1) : onClose())} style={css(bigBtn + ';flex:2;background:#3182f6;color:#ffffff')}>{step === 0 ? '다음' : '시작하기'}</button>
      </div>
    </BottomSheet>
  )
}

const seenKey = (uid: string) => 'guide-seen:' + uid
export function guideSeen(uid: string) {
  try { return localStorage.getItem(seenKey(uid)) === '1' } catch { return true }
}
export function markGuideSeen(uid: string) {
  try { localStorage.setItem(seenKey(uid), '1') } catch { /* private mode: show again next time */ }
}

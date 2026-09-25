import { css } from '../css'
import type { NotifySettings as Settings } from '../backend/push'
import type { PushSupport } from '../push'
import { Switch } from './MessagesScreen'

const title17 = 'font-size:17px;line-height:25.5px;font-weight:500;color:#333d4b'
const caption = 'font-size:13px;line-height:19.5px;color:#6b7684'

type Props = {
  support: PushSupport
  /** This device is registered and 알림 is on. */
  on: boolean
  busy: boolean
  settings: Settings
  onToggle: (on: boolean) => void
  onChange: (patch: Partial<Settings>) => void
}

/** 계정 → 알림: master switch for this device, plus what to be told about. */
export function NotifySettings({ support, on, busy, settings, onToggle, onChange }: Props) {
  const row = (label: string, desc: string, value: boolean, set: () => void, disabled = false) => (
    <div style={css('padding:14px 16px 14px 24px;display:flex;align-items:center;gap:12px')}>
      <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:2px')}>
        <span style={css(title17)}>{label}</span>
        <span style={css(caption)}>{desc}</span>
      </span>
      <span style={{ opacity: disabled ? 0.3 : 1, pointerEvents: disabled ? 'none' : 'auto' }}><Switch on={value} onToggle={set} label={label} /></span>
    </div>
  )
  return (
    <>
      <div style={css('padding:24px 24px 4px;font-size:17px;line-height:25.5px;font-weight:700;color:#191f28')}>알림</div>
      {support === 'ios-install' || support === 'none' ? (
        <div style={css('padding:8px 24px 20px;' + caption + ';font-size:15px;line-height:22.5px')}>
          {support === 'ios-install'
            ? '아이폰은 홈 화면에 추가한 앱에서 알림을 받을 수 있어요. 홈 → 앱 설치하기에서 추가해보세요'
            : '이 브라우저에서는 알림을 받을 수 없어요'}
        </div>
      ) : (
        <>
          {row('알림 받기', busy ? '설정하는 중이에요' : on ? '이 기기로 알림을 보내드려요' : '켜면 새 메시지와 받은 투표를 알려드려요', on, () => !busy && onToggle(!on), busy)}
          {row('새 메시지', '채팅방별로도 끌 수 있어요', on && settings.notifyMsg, () => onChange({ notifyMsg: !settings.notifyMsg }), !on)}
          {row('받은 추천·비추천', '누가 했는지는 알려드리지 않아요', on && settings.notifyVote, () => onChange({ notifyVote: !settings.notifyVote }), !on)}
        </>
      )}
    </>
  )
}

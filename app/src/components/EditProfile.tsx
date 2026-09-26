import { css } from '../css'
import type { ItemKind } from '../data'
import { Segmented } from './AccountScreen'
import { Avatar } from './Avatar'
import { BackIcon } from './icons'

type Props = {
  bio: string
  photoCss: string
  equipped: Record<ItemKind, string>
  points: number
  /** Frames, nameplates and bar skins are in the 상점 tab. */
  onShop: () => void
  onClose: () => void
  gender: string
  onPhoto: (f: File) => void
  onBio: (bio: string) => void
  onGender: (g: string) => void
}

/** Full-screen editor for photo, bio and gender. */
export function EditProfile({ bio, photoCss, equipped, points, onShop, onClose, gender, onPhoto, onBio, onGender }: Props) {
  return (
    <div style={css('position:fixed;inset:0;z-index:150;display:flex;justify-content:center;background:rgba(0,0,0,0.2);animation:fade 200ms ease both')}>
      <div data-g="app" style={css('width:100%;max-width:430px;height:100%;overflow-y:auto;background:#ffffff;animation:sheetUp 420ms cubic-bezier(0.22,1,0.36,1) both')}>
        <div data-g="head" style={css('position:sticky;top:0;z-index:5;height:56px;padding:0 16px 0 8px;display:flex;align-items:center;gap:4px;background:#ffffff')}>
          <button className="pr-dim" onClick={onClose} aria-label="닫기" style={css('width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#191f28')}><BackIcon /></button>
          <span style={css('flex:1;font-size:17px;font-weight:700;color:#191f28')}>프로필 편집</span>
          <span style={css('height:32px;padding:0 12px;border-radius:9999px;background:#fff4d6;color:#8a5a00;font-size:14px;font-weight:700;display:flex;align-items:center;gap:5px;font-variant-numeric:tabular-nums')}>
            <span style={css('width:16px;height:16px;border-radius:9999px;background:#ffc342;color:#5c3d00;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center')}>P</span>{points.toLocaleString()}P
          </span>
        </div>
        <div style={css('padding:8px 24px 20px;display:flex;flex-direction:column;gap:20px')}>
          <label style={css('align-self:center;position:relative;width:96px;height:96px;cursor:pointer;margin:8px')}>
            <Avatar frame={equipped.frame} photo={photoCss} size={96} />
            <span style={css('position:absolute;right:-4px;bottom:-4px;width:32px;height:32px;border-radius:9999px;background:#191f28;box-shadow:0 0 0 3px #fff;display:flex;align-items:center;justify-content:center')}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.4-2h4.6l1.4 2h1.8A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z" /><circle cx="12" cy="13" r="3.5" /></svg>
            </span>
            <input type="file" accept="image/*" aria-label="프로필 사진 바꾸기" onChange={e => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.target.value = '' }} style={css('position:absolute;width:1px;height:1px;opacity:0;pointer-events:none')} />
          </label>
          <label style={css('display:flex;flex-direction:column;gap:8px')}>
            <span style={css('display:flex;justify-content:space-between;font-size:13px;line-height:19.5px;font-weight:500;color:#6b7684')}><span>소개</span><span style={css('font-variant-numeric:tabular-nums')}>{bio.length}/60</span></span>
            <textarea data-g="l1" className="ring-focus" value={bio} onChange={e => onBio(e.target.value.slice(0, 60))} maxLength={60} rows={2} placeholder="자신을 더 잘 알 수 있게 써주세요" style={css('resize:none;border:0;border-radius:14px;background:#f2f4f6;padding:14px 16px;font:inherit;font-size:16px;line-height:24px;color:#191f28;outline:none')} />
          </label>
          <div style={css('display:flex;flex-direction:column;gap:8px')}>
            <span style={css('font-size:13px;line-height:19.5px;font-weight:500;color:#6b7684')}>성별</span>
            <Segmented options={['남자', '여자', '비공개']} value={gender || '비공개'} onPick={g => onGender(g === '비공개' ? '' : g)} />
          </div>
        </div>
        <div data-g="gap" style={css('height:16px;background:#f2f4f6')} />
        <button className="pr-dim" onClick={onShop} style={css('width:100%;display:flex;align-items:center;gap:12px;padding:18px 24px;text-align:left')}>
          <span style={css('flex:1;display:flex;flex-direction:column;gap:2px')}>
            <span style={css('font-size:17px;line-height:25.5px;font-weight:600;color:#191f28')}>프레임 · 이름표 · 막대 스킨</span>
            <span style={css('font-size:13px;line-height:19.5px;color:#6b7684')}>상점에서 사고 바꿔 낄 수 있어요</span>
          </span>
          <span style={css('font-size:15px;font-weight:600;color:#3182f6')}>상점 가기</span>
        </button>
      </div>
    </div>
  )
}

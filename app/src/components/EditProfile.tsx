import { css, sx } from '../css'
import { FRAMES, SKINS, priceOf, skinGeom, type ItemKind } from '../data'
import { Segmented } from './AccountScreen'
import { Avatar } from './Avatar'
import { BackIcon, LockIcon } from './icons'
import { Nameplate } from './Nameplate'
import { TowerSkin } from './TowerSkin'

type Props = {
  name: string
  bio: string
  photoCss: string
  equipped: Record<ItemKind, string>
  owned: Record<ItemKind, string[]>
  points: number
  tab: ItemKind
  onTab: (t: ItemKind) => void
  /** Equips an owned item or opens the purchase dialog for a locked one. */
  onPick: (kind: ItemKind, key: string, label: string) => void
  onClose: () => void
  gender: string
  onPhoto: (f: File) => void
  onBio: (bio: string) => void
  onGender: (g: string) => void
}

const check = (size: number, style: string) => (
  <span style={sx(`position:absolute;z-index:3;border-radius:9999px;background:#3182f6;color:#ffffff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;${style}`, { width: size, height: size })}>✓</span>
)
const tile = 'position:relative;border-radius:16px;display:flex;flex-direction:column;align-items:center'

/** Full-screen editor + point shop for frame, nameplate and bar skin. */
export function EditProfile({ name, bio, photoCss, equipped, owned, points, tab, onTab, onPick, onClose, gender, onPhoto, onBio, onGender }: Props) {
  const item = (kind: ItemKind, k: string) => ({ on: equipped[kind] === k, locked: !owned[kind].includes(k), price: priceOf(kind, k) + 'P' })
  const priceTag = (price: string) => (
    <span style={css('position:absolute;top:8px;left:8px;z-index:3;height:20px;padding:0 7px;border-radius:9999px;background:#191f28;color:#ffffff;font-size:11px;font-weight:700;display:flex;align-items:center;gap:3px;font-variant-numeric:tabular-nums')}><LockIcon size={9} />{price}</span>
  )
  const tileColors = (on: boolean) => ({ background: on ? '#e8f3ff' : '#f9fafb', boxShadow: on ? 'inset 0 0 0 1.5px #3182f6' : 'none' })
  const tileFg = (on: boolean) => (on ? '#1b64da' : '#4e5968')

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
        <div style={css('padding:20px 24px 8px;display:flex;flex-direction:column;gap:12px')}>
          <span style={css('font-size:17px;line-height:25.5px;font-weight:700;color:#191f28')}>꾸미기</span>
          <div style={{ height: 60 }}>
            <Nameplate kind={equipped.plate} person={name} sub={bio || '소개를 적으면 이름표에 보여요'} frame={equipped.frame} photo={photoCss} style={{ width: '100%', height: 60 }} />
          </div>
          <span style={css('font-size:13px;line-height:19.5px;color:#6b7684')}>받은 추천 1개가 1P예요. 포인트로 꾸미기 아이템을 살 수 있어요</span>
        </div>
        <div style={css('padding:8px 24px 16px')}>
          <Segmented<ItemKind> options={['frame', 'plate', 'skin']} labels={['프레임', '이름표', '막대 스킨']} value={tab} onPick={onTab} />
        </div>

        {tab === 'frame' && (
          <div style={css('display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:0 24px 32px')}>
            {FRAMES.map(([k, l]) => {
              const it = item('frame', k)
              return (
                <button key={k} className="pr-96" onClick={() => onPick('frame', k, l)} style={sx(tile + ';padding:22px 0 12px;gap:12px;transition:transform 150ms,background 200ms,box-shadow 200ms', tileColors(it.on))}>
                  <span style={css('width:52px;height:52px')}><Avatar frame={k} photo={photoCss} size={52} /></span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: tileFg(it.on) }}>{l}</span>
                  {it.locked && priceTag(it.price)}
                  {it.on && check(20, 'top:8px;right:8px')}
                </button>
              )
            })}
          </div>
        )}

        {tab === 'plate' && (
          <div style={css('display:flex;flex-direction:column;gap:8px;padding:0 24px 32px')}>
            {FRAMES.map(([k, l]) => {
              const it = item('plate', k)
              return (
                <button key={k} className="pr-98" onClick={() => onPick('plate', k, l + ' 이름표')} aria-pressed={it.on} style={sx('position:relative;display:block;width:100%;height:60px;padding:2px;border-radius:17px;transition:transform 300ms cubic-bezier(0.34,1.4,0.64,1),box-shadow 200ms', { boxShadow: it.on ? '0 0 0 2px #3182f6' : 'none' })}>
                  <Nameplate kind={k} person={name} sub={l + ' 이름표'} frame={equipped.frame} photo={photoCss} style={{ width: '100%', height: 56 }} />
                  {it.locked && (
                    <span style={css('position:absolute;top:50%;right:14px;margin-top:-12px;z-index:3;height:24px;padding:0 9px;border-radius:9999px;background:#191f28;color:#ffffff;box-shadow:0 0 0 2px rgba(255,255,255,0.9);font-size:12px;font-weight:700;display:flex;align-items:center;gap:4px;font-variant-numeric:tabular-nums')}><LockIcon size={10} />{it.price}</span>
                  )}
                  {it.on && check(22, 'top:50%;right:14px;margin-top:-11px;box-shadow:0 0 0 2px #ffffff')}
                </button>
              )
            })}
          </div>
        )}

        {tab === 'skin' && (
          <>
            <div style={css('padding:0 24px 8px;font-size:13px;line-height:19.5px;color:#6b7684')}>랭킹 그래프에서 내 막대가 이 모양으로 보여요. 마이너스면 거꾸로 뒤집혀요</div>
            <div style={css('display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:0 24px 32px')}>
              {SKINS.map(([k, l]) => {
                const it = item('skin', k), g = skinGeom(k, 132, false)
                return (
                  <button key={k} className="pr-97" onClick={() => onPick('skin', k, l)} aria-pressed={it.on} aria-label={`${l} 스킨`} style={sx(tile + ';height:200px;padding:12px 0 12px;justify-content:flex-end;gap:10px;transition:transform 300ms cubic-bezier(0.34,1.4,0.64,1),background 200ms,box-shadow 200ms', tileColors(it.on))}>
                    <span style={css('position:relative;width:32px;height:132px;flex:none')}>
                      {g ? <TowerSkin g={g} /> : <span style={css('position:absolute;left:2px;right:2px;bottom:0;height:86px;border:1.5px solid #191f28;border-radius:6px;background:#ffffff;box-sizing:border-box')} />}
                    </span>
                    <span style={css('width:44px;height:1px;background:#d1d6db;flex:none')} />
                    <span style={sx('font-size:13px;line-height:18px;font-weight:600;text-align:center;word-break:keep-all', { color: tileFg(it.on) })}>{l}</span>
                    {it.locked && priceTag(it.price)}
                    {it.on && check(20, 'top:8px;right:8px')}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

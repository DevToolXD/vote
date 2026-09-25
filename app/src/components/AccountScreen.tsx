import type { RefObject } from 'react'
import { css, sx } from '../css'
import type { Person } from '../model'
import { Avatar } from './Avatar'
import { BackIcon } from './icons'

export type SignupForm = { name: string; id: string; pw: string; pw2: string }

type Props = {
  loggedIn: boolean
  view: 'login' | 'signup'
  onView: (v: 'login' | 'signup') => void
  onLogin: () => void
  onLogout: () => void
  signup: SignupForm
  onSignup: (patch: Partial<SignupForm>) => void
  nameAck: boolean
  nameRef: RefObject<HTMLInputElement>
  onNameFocus: (el: HTMLInputElement) => void
  onSubmitSignup: () => void
  me: Person
  onPhoto: (f: File) => void
  onRemovePhoto: () => void
  onBio: (bio: string) => void
  onGender: (g: string) => void
  points: number
  mine: Person[]
  onCancelVote: (p: Person) => void
  openEdit: () => void
  openTheme: () => void
  goHome: () => void
}

const field = 'height:52px;border:0;border-radius:14px;background:#f2f4f6;padding:0 16px;font-size:17px;color:#191f28'
const fieldLabel = 'font-size:13px;line-height:19.5px;font-weight:500;color:#6b7684'
const primaryBtn = 'height:56px;border-radius:16px;background:#3182f6;color:#ffffff;font-size:17px;font-weight:600'

export function AccountScreen(p: Props) {
  return (
    <div data-g="clear" style={css('flex:1;background:#ffffff')}>
      <div style={css('height:56px;padding:6px 8px 0 12px;display:flex;justify-content:flex-end;align-items:center;gap:4px')}>
        {p.loggedIn && (
          <button data-g="secondary" className="pr-96" onClick={p.openEdit} style={css('height:36px;padding:0 12px;border-radius:10px;display:flex;align-items:center;gap:6px;background:#f2f4f6;color:#333d4b;font-size:14px;font-weight:600')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></svg>프로필 편집
          </button>
        )}
        <button className="pr-dim" onClick={p.openTheme} aria-label="테마 바꾸기" style={css('width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;color:#333d4b')}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="3.5" /><circle cx="9" cy="9.5" r="1.8" /><path d="m21 15.5-4.6-4.6a1.5 1.5 0 0 0-2.1 0L5 20" /></svg>
        </button>
      </div>
      {!p.loggedIn && (p.view === 'login' ? <LoginView {...p} /> : <SignupView {...p} />)}
      {p.loggedIn && <Profile {...p} />}
    </div>
  )
}

function LoginView({ onLogin, onView }: Props) {
  return (
    <>
      <div style={css('padding:8px 24px 24px;display:flex;flex-direction:column;gap:4px')}>
        <h1 style={css('margin:0;font-size:22px;line-height:31px;font-weight:700;color:#191f28')}>로그인하고<br />투표를 시작해요</h1>
        <p style={css('margin:0;font-size:15px;line-height:22.5px;font-weight:500;color:#6b7684')}>투표는 로그인한 회원만 할 수 있어요</p>
      </div>
      <div style={css('padding:8px 24px 0;display:flex;flex-direction:column;gap:20px')}>
        <label style={css('display:flex;flex-direction:column;gap:8px')}><span style={css(fieldLabel)}>아이디</span><input data-g="l1" className="ring-focus" type="text" autoComplete="username" placeholder="아이디 입력" style={css(field)} /></label>
        <label style={css('display:flex;flex-direction:column;gap:8px')}><span style={css(fieldLabel)}>비밀번호</span><input data-g="l1" className="ring-focus" type="password" autoComplete="current-password" placeholder="비밀번호 입력" style={css(field)} /></label>
      </div>
      <div style={css('padding:28px 24px 0;display:flex;flex-direction:column;gap:8px')}>
        <button data-g="primary" className="pr-96" onClick={onLogin} style={css(primaryBtn + ';transition:transform 150ms')}>로그인</button>
        <div style={css('margin:16px 0 32px;display:flex;justify-content:center;align-items:center;gap:4px;font-size:15px;color:#6b7684')}>
          아직 계정이 없나요?
          <button className="pr-blue" onClick={() => { onView('signup'); window.scrollTo(0, 0) }} style={css('height:36px;padding:0 6px;border-radius:8px;font-size:15px;font-weight:600;color:#2272eb')}>회원가입</button>
        </div>
      </div>
    </>
  )
}

function SignupView({ signup: s, onSignup, onView, nameAck, nameRef, onNameFocus, onSubmitSignup }: Props) {
  const pwOk = s.pw.length >= 8, match = s.pw2.length > 0 && s.pw2 === s.pw
  const cant = !(s.name.trim() && s.id.trim().length >= 4 && pwOk && match && nameAck)
  return (
    <>
      <div style={css('padding:0 12px')}>
        <button className="pr-dim" onClick={() => onView('login')} aria-label="뒤로" style={css('width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#191f28')}><BackIcon /></button>
      </div>
      <div style={css('padding:4px 24px 24px;display:flex;flex-direction:column;gap:4px')}>
        <h1 style={css('margin:0;font-size:22px;line-height:31px;font-weight:700;color:#191f28')}>회원가입</h1>
        <p style={css('margin:0;font-size:15px;line-height:22.5px;font-weight:500;color:#6b7684')}>투표에 참여할 계정을 만들어요</p>
      </div>
      <div style={css('padding:0 24px;display:flex;flex-direction:column;gap:20px')}>
        <label style={css('display:flex;flex-direction:column;gap:8px')}>
          <span style={css(fieldLabel)}>이름 (실명)</span>
          <input data-g="l1" className="ring-focus" ref={nameRef} type="text" autoComplete="name" placeholder="예) 홍길동" value={s.name} onFocus={e => onNameFocus(e.currentTarget)} onChange={e => onSignup({ name: e.target.value })} style={css(field)} />
          <span style={css('font-size:13px;line-height:19.5px;color:#8b95a1')}>본인 실명만 쓸 수 있어요</span>
        </label>
        <label style={css('display:flex;flex-direction:column;gap:8px')}>
          <span style={css(fieldLabel)}>아이디</span>
          <input data-g="l1" className="ring-focus" type="text" autoComplete="username" placeholder="영문, 숫자 4자 이상" value={s.id} onChange={e => onSignup({ id: e.target.value })} style={css(field)} />
        </label>
        <label style={css('display:flex;flex-direction:column;gap:8px')}>
          <span style={css(fieldLabel)}>비밀번호</span>
          <input data-g="l1" className="ring-focus" type="password" autoComplete="new-password" placeholder="8자 이상" value={s.pw} onChange={e => onSignup({ pw: e.target.value })} style={css(field)} />
          {s.pw.length > 0 && <span style={sx('font-size:13px;line-height:19.5px', { color: pwOk ? '#03b26c' : '#8b95a1' })}>{pwOk ? '✓ 사용할 수 있어요' : '8자 이상 입력해주세요'}</span>}
        </label>
        <label style={css('display:flex;flex-direction:column;gap:8px')}>
          <span style={css(fieldLabel)}>비밀번호 확인</span>
          <input data-g="l1" className="ring-focus" type="password" autoComplete="new-password" placeholder="비밀번호를 한 번 더 입력" value={s.pw2} onChange={e => onSignup({ pw2: e.target.value })} style={css(field)} />
          {s.pw2.length > 0 && <span style={sx('font-size:13px;line-height:19.5px;font-weight:600', { color: match ? '#03b26c' : '#f04452' })}>{match ? '✓ 비밀번호가 일치해요' : '비밀번호가 서로 달라요'}</span>}
        </label>
      </div>
      <div style={css('padding:28px 24px 32px;display:flex;flex-direction:column;gap:8px')}>
        <button data-g="primary" className="pr-96" onClick={() => !cant && onSubmitSignup()} disabled={cant} style={sx(primaryBtn + ';transition:transform 150ms,opacity 200ms', { opacity: cant ? 0.4 : 1 })}>가입하기</button>
      </div>
    </>
  )
}

function Profile({ me, onPhoto, onRemovePhoto, onBio, onGender, points, mine, onCancelVote, onLogout, goHome }: Props) {
  const hasPhoto = me.photoCss !== 'none'
  const sep = <div data-g="gap" style={css('height:16px;background:#f2f4f6')} />
  return (
    <>
      <div style={css('padding:24px;display:flex;align-items:center;gap:16px')}>
        <label style={css('position:relative;width:76px;height:76px;flex:none;cursor:pointer;margin:6px')}>
          <Avatar frame={me.frame} photo={me.photoCss} size={76} />
          <span style={css('position:absolute;right:-4px;bottom:-4px;width:28px;height:28px;border-radius:9999px;background:#191f28;box-shadow:0 0 0 3px #fff;display:flex;align-items:center;justify-content:center')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.4-2h4.6l1.4 2h1.8A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z" /><circle cx="12" cy="13" r="3.5" /></svg>
          </span>
          <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.target.value = '' }} style={css('position:absolute;width:1px;height:1px;opacity:0;pointer-events:none')} />
        </label>
        <span style={css('display:flex;flex-direction:column')}>
          <span style={css('display:flex;align-items:center;gap:6px')}>
            <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>{me.name}님</span>
            {me.gender && <span style={css('height:22px;padding:0 8px;border-radius:9999px;background:#f2f4f6;color:#4e5968;font-size:12px;font-weight:600;display:flex;align-items:center')}>{me.gender}</span>}
          </span>
          <span style={css('font-size:15px;line-height:22.5px;color:#6b7684')}>{me.rank}위 · {me.scoreLabel}점</span>
          {hasPhoto && <button data-g="secondary" className="pr-96" onClick={onRemovePhoto} style={css('align-self:flex-start;margin-top:4px;height:28px;padding:0 10px;border-radius:8px;background:#f2f4f6;color:#4e5968;font-size:13px;font-weight:600')}>사진 삭제</button>}
        </span>
      </div>
      <div style={css('padding:0 24px 24px;display:flex;flex-direction:column;gap:20px')}>
        <label style={css('display:flex;flex-direction:column;gap:8px')}>
          <span style={css('display:flex;justify-content:space-between;font-size:13px;line-height:19.5px;font-weight:500;color:#6b7684')}><span>소개</span><span style={css('font-variant-numeric:tabular-nums')}>{me.bio.length}/60</span></span>
          <textarea data-g="l1" className="ring-focus" value={me.bio} onChange={e => onBio(e.target.value.slice(0, 60))} maxLength={60} rows={2} placeholder="자신을 더 잘 알 수 있게 써주세요" style={css('resize:none;border:0;border-radius:14px;background:#f2f4f6;padding:14px 16px;font:inherit;font-size:16px;line-height:24px;color:#191f28;outline:none')} />
        </label>
        <div style={css('display:flex;flex-direction:column;gap:8px')}>
          <span style={css(fieldLabel)}>성별</span>
          <Segmented options={['남자', '여자', '비공개']} value={me.gender || '비공개'} onPick={g => onGender(g === '비공개' ? '' : g)} />
        </div>
      </div>
      {sep}
      <div style={{ height: 24 }} />
      <div style={css('padding:0 24px 24px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px')}>
        {[['투표', mine.length + '명'], ['순위', me.rank + '위'], ['포인트', points.toLocaleString() + 'P']].map(([k, v]) => (
          <div key={k} data-g="l1" style={css('background:#f9fafb;border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:2px')}>
            <span style={css('font-size:13px;line-height:19.5px;color:#6b7684')}>{k}</span>
            <span style={css('font-size:22px;line-height:31px;font-weight:700;color:#191f28')}>{v}</span>
          </div>
        ))}
      </div>
      {sep}
      <div style={css('padding:24px 24px 8px;font-size:17px;line-height:25.5px;font-weight:700;color:#191f28')}>내 투표</div>
      {mine.map(d => (
        <div key={d.id}>
          <div style={css('padding:14px 16px 14px 24px;display:flex;align-items:center;gap:12px')}>
            <span style={css('width:40px;height:40px;border-radius:9999px;background:#f2f4f6;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;color:#6b7684;flex:none')}>{d.name[0]}</span>
            <span style={css('flex:1;min-width:0;display:flex;flex-direction:column')}>
              <span style={css('display:flex;align-items:center;gap:6px')}>
                <span style={css('font-size:17px;line-height:25.5px;font-weight:500;color:#333d4b')}>{d.name}</span>
                <span style={css('height:22px;padding:0 8px;border-radius:9999px;font-size:12px;font-weight:600;display:flex;align-items:center;background:#03b26c;color:#ffffff')}>✓ 투표함</span>
              </span>
              <span style={css('font-size:13px;line-height:19.5px;color:#6b7684')}>{d.rank}위 · {d.scoreLabel}점</span>
            </span>
            <button data-g="secondary" className="pr-96" onClick={() => onCancelVote(d)} style={css('height:32px;padding:0 12px;border-radius:8px;background:#f2f4f6;color:#4e5968;font-size:13px;font-weight:600;transition:transform 150ms')}>취소</button>
          </div>
          <div style={css('height:0.5px;margin-left:24px;background:rgba(0,0,33,0.07)')} />
        </div>
      ))}
      {mine.length === 0 && (
        <div style={css('padding:40px 24px 48px;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center')}>
          <span style={css('font-size:40px;line-height:1;margin-bottom:12px')}>🗳️</span>
          <span style={css('font-size:17px;line-height:25.5px;font-weight:600;color:#333d4b')}>아직 투표한 후보가 없어요</span>
          <span style={css('font-size:15px;line-height:22.5px;color:#6b7684')}>홈에서 후보를 골라 투표해보세요</span>
          <button className="pr-96" onClick={goHome} style={css('margin-top:16px;height:38px;padding:0 16px;border-radius:10px;background:rgba(100,168,255,0.15);color:#2272eb;font-size:15px;font-weight:600;transition:transform 150ms')}>투표하러 가기</button>
        </div>
      )}
      {sep}
      <button className="pr-dim" onClick={onLogout} style={css('width:100%;text-align:left;padding:16px 24px;font-size:17px;font-weight:500;color:#4e5968;border-radius:12px')}>로그아웃</button>
      <div style={{ height: 24 }} />
    </>
  )
}

/** Grey track with a white pill on the selected option (gender picker, edit tabs). */
export function Segmented<T extends string>({ options, labels, value, onPick }: { options: T[]; labels?: string[]; value: T; onPick: (v: T) => void }) {
  return (
    <div style={css('display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:4px;border-radius:14px;background:#f2f4f6')}>
      {options.map((o, i) => {
        const on = o === value
        return (
          <button key={o} onClick={() => onPick(o)} style={sx('height:40px;border-radius:10px;font-size:15px;font-weight:600;transition:background 200ms,color 200ms,box-shadow 200ms', { background: on ? '#ffffff' : 'transparent', color: on ? '#191f28' : '#6b7684', boxShadow: on ? '0 1px 3px rgba(0,27,55,0.1)' : 'none' })}>
            {labels ? labels[i] : o}
          </button>
        )
      })}
    </div>
  )
}

import { useState, type ReactNode } from 'react'
import { css, sx } from '../css'
import { Avatar } from './Avatar'
import { AppIcon } from './PhoneIcons'
import { Segmented } from './Segmented'
import type { Person } from '../model'
import { BlockBlast } from './BlockBlast'
import { FlappyBird } from './FlappyBird'
import { DinoGame } from './DinoGame'

export type HomeTab = 'rank' | 'game' | 'notice'
const SUBS = [['rank', '랭킹'], ['game', '게임'], ['notice', '공지']] as const
type Game = 'block' | 'flappy' | 'dino'
const GAMES: [Game, string, string][] = [
  ['block', '블록 블라스트', '블록을 놓아 줄을 지워요. 가득 차면 끝나요'],
  ['flappy', '플래피 버드', '탭해서 날아 파이프 사이를 지나가요'],
  ['dino', '공룡 점프', '선인장과 새를 뛰어넘어요. 멀리 갈수록 빨라져요'],
]
const BG: Record<Game, string> = { block: 'linear-gradient(180deg,#4a6fc4 0%,#2f4f9f 55%,#2a4790 100%)', flappy: '#4ec0ca', dino: '#ffffff' }

/** 게임 tab: the three games as a list; one opens in place, with ‹ 게임 to come back. */
function Games({ onOpen }: { onOpen: (open: boolean) => void }) {
  const [game, setGame] = useState<Game | null>(null)
  const set = (g: Game | null) => { setGame(g); onOpen(g !== null) }
  if (game) {
    return (
      <div key={game} style={css('flex:1;min-height:0;display:flex;flex-direction:column;animation:pageIn 420ms cubic-bezier(0.32,0.72,0,1) both')}>
        <button className="pr-96" onClick={() => set(null)} aria-label="게임 목록" style={sx('flex:none;align-self:flex-start;height:40px;padding:0 14px 0 10px;display:flex;align-items:center;gap:2px;font-size:17px;font-weight:500;color:#007aff')}><svg width="12" height="20" viewBox="0 0 12 20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 2 2 10l8 8" /></svg>게임</button>
        <div data-phone-scroll style={sx('flex:1;min-height:0;display:flex;flex-direction:column;overflow-y:auto;position:relative;--phone-top:0px;--phone-bottom:0px', { background: BG[game] })}>
          {game === 'block' && <BlockBlast />}
          {game === 'flappy' && <FlappyBird />}
          {game === 'dino' && <DinoGame />}
        </div>
      </div>
    )
  }
  return (
    <div className="anim-list" style={css('padding:8px 16px 24px;display:flex;flex-direction:column;gap:10px;background:#f2f2f7;flex:1')}>
      {GAMES.map(([g, t, d]) => (
        <button key={g} className="pr-98" onClick={() => set(g)} style={css('display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:20px;background:#fff;text-align:left;width:100%')}>
          <AppIcon app={g} size={60} />
          <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:3px')}>
            <span style={css('font-size:17px;line-height:23px;font-weight:700;color:#1d1d1f')}>{t}</span>
            <span style={css('font-size:13px;line-height:18px;color:#6e6e73')}>{d}</span>
          </span>
          <span style={css('flex:none;height:30px;padding:0 14px;border-radius:9999px;background:#e8f1ff;color:#007aff;font-size:14px;font-weight:700;display:flex;align-items:center')}>열기</span>
        </button>
      ))}
    </div>
  )
}

/**
 * 홈 tab: 랭킹 · 게임 · 공지 under one title, the profile at the top right (it opens 계정).
 * The content is given in `rank` and `notice`; 게임 is here.
 */
export function HomeScreen({ sub, onSub, me, loggedIn, onProfile, rank, notice }: { sub: HomeTab; onSub: (t: HomeTab) => void; me?: Person; loggedIn: boolean; onProfile: () => void; rank: ReactNode; notice: ReactNode }) {
  const [playing, setPlaying] = useState(false)
  return (
    <div data-ios="" style={css('flex:1;min-height:0;display:flex;flex-direction:column;background:#fff')}>
      <header style={css('flex:none;padding:10px 20px 8px;display:flex;align-items:center;justify-content:space-between;gap:12px')}>
        <span style={css('font-size:30px;line-height:38px;font-weight:800;letter-spacing:-0.6px;color:#191f28')}>홈</span>
        <button className="pr-94" onClick={onProfile} aria-label={loggedIn ? '내 계정' : '로그인'} style={css('flex:none;display:flex;align-items:center;justify-content:center;min-width:40px;height:40px;border-radius:9999px')}>
          {loggedIn && me
            ? <span style={css('display:block;width:36px;height:36px')}><Avatar frame={me.frame} photo={me.photoCss} size={36} /></span>
            : <span style={css('height:34px;padding:0 14px;border-radius:9999px;background:#3182f6;color:#fff;font-size:14px;font-weight:700;display:flex;align-items:center')}>로그인</span>}
        </button>
      </header>
      {!(sub === 'game' && playing) && <div style={css('flex:none;padding:0 20px 10px')}><Segmented label="홈" items={SUBS} value={sub} onChange={t => { onSub(t); if (t !== 'game') setPlaying(false) }} /></div>}
      <div key={sub} style={css('flex:1;min-height:0;display:flex;flex-direction:column;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;animation:pageIn 380ms cubic-bezier(0.32,0.72,0,1) both')}>
        {sub === 'rank' && rank}
        {sub === 'game' && <Games onOpen={setPlaying} />}
        {sub === 'notice' && notice}
      </div>
    </div>
  )
}

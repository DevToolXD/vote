import { Countdown } from './Countdown'
import { css, sx } from '../css'
import { isInstalledApp } from '../install'
import type { Person } from '../model'
import { Avatar } from './Avatar'
import { ChevronRight, SearchIcon } from './icons'

type Props = {
  all: Person[]
  loggedIn: boolean
  query: string
  onQuery: (q: string) => void
  onPick: (id: string) => void
  goRank: () => void
  goAccount: () => void
  onInstall: () => void
  myCount: number
  seasonName: string
  /** When the season ends (ms), for the countdown; undefined = no end date. */
  seasonEndsAt?: number
}

export function HomeScreen({ all, loggedIn, query, onQuery, onPick, goRank, goAccount, onInstall, myCount, seasonName, seasonEndsAt }: Props) {
  const q = query.trim()
  // You can't vote for yourself, so you never appear in the pick list.
  const votable = all.filter(d => !d.isMe)
  const list = q ? votable.filter(d => d.name.includes(q)) : votable.slice(0, 5)
  return (
    <div data-g="clear" style={css('flex:1;background:#f2f4f6;padding-bottom:24px')}>
      <header data-g="head" style={css('position:sticky;top:0;z-index:20;height:56px;padding:0 12px 0 24px;display:flex;align-items:center;justify-content:space-between;background:#f2f4f6')}>
        <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>인기투표</span>
        <button className="pr-dim" onClick={goRank} aria-label="검색" style={css('width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#6b7684')}>
          <SearchIcon size={24} stroke="currentColor" />
        </button>
      </header>

      <div style={css('padding:12px 24px 24px')}>
        <div style={css('font-size:13px;line-height:19.5px;font-weight:700;color:#6b7684')}>시즌 {seasonName} · {seasonEndsAt ? <Countdown to={seasonEndsAt} /> : '실시간'}</div>
        <h1 style={css('margin:4px 0 0;font-size:26px;line-height:35px;font-weight:700;color:#191f28')}>{all.length ? <>지금 1위는<br />{all[0].name}님이에요</> : '아직 등록된 후보가 없어요'}</h1>
      </div>


      {!isInstalledApp() && (
        <button data-g="l2" className="pr-98" onClick={onInstall} style={css('width:calc(100% - 24px);margin:0 12px 12px;background:#ffffff;border-radius:24px;padding:18px 16px 18px 20px;display:flex;align-items:center;gap:14px;text-align:left;transition:transform 150ms')}>
          <img src="icons/icon-192.png" alt="" width={48} height={48} style={css('flex:none;border-radius:14px')} />
          <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:2px')}>
            <span style={css('font-size:17px;line-height:25.5px;font-weight:700;color:#191f28')}>앱 설치하기</span>
            <span style={css('font-size:13px;line-height:19.5px;color:#6b7684')}>아이폰·갤럭시 홈 화면에서 바로 열어요</span>
          </span>
          <ChevronRight />
        </button>
      )}

      <div data-g="l2" style={css('margin:0 12px;background:#ffffff;border-radius:24px;padding:20px 0 12px')}>
        <div style={css('padding:0 24px 12px;display:flex;flex-direction:column;gap:2px')}>
          <span style={css('font-size:17px;line-height:25.5px;font-weight:700;color:#191f28')}>누구에게 투표할까요?</span>
          <span style={css('font-size:13px;line-height:19.5px;color:#6b7684')}>지금 TOP 5 후보예요. 눌러서 추천이나 비추천을 남겨요</span>
        </div>
        <div style={css('padding:0 16px 8px')}>
          <label data-g="l1" className="ring-within" style={css('height:44px;border-radius:12px;background:#f2f4f6;padding:0 8px 0 12px;display:flex;align-items:center;gap:8px')}>
            <SearchIcon size={18} stroke="#8b95a1" />
            <input value={query} onChange={e => onQuery(e.target.value)} placeholder="이름으로 찾기" style={css('flex:1;min-width:0;height:100%;border:0;background:transparent;font-size:16px;color:#191f28')} />
          </label>
        </div>
        {list.map(t => (
          <button key={t.id} className="pr-dim" onClick={() => onPick(t.id)} style={css('width:100%;text-align:left;padding:10px 20px 10px 24px;display:flex;align-items:center;gap:14px;border-radius:12px;transition:background 150ms')}>
            <span style={css('width:40px;height:40px;flex:none;margin:4px')}><Avatar frame={t.frame} photo={t.photoCss} size={40} /></span>
            <span style={css('flex:1;min-width:0;display:flex;flex-direction:column')}>
              <span style={css('font-size:17px;line-height:25.5px;font-weight:500;color:#333d4b')}>{t.name}</span>
              <span style={css('font-size:13px;line-height:19.5px;color:#6b7684;font-variant-numeric:tabular-nums')}>{t.rank}위 · {t.scoreLabel}점</span>
            </span>
            {t.weekKind !== 'none'
              ? <span style={sx('height:24px;padding:0 10px;border-radius:9999px;font-size:12px;font-weight:600;display:flex;align-items:center', t.weekKind === 'up' ? { background: 'rgba(49,130,246,0.12)', color: '#1b64da' } : { background: 'rgba(240,68,82,0.12)', color: '#d22030' })}>{t.weekKind === 'up' ? '✓ 추천함' : '✓ 비추천함'}</span>
              : <span style={css('height:32px;padding:0 12px;border-radius:8px;font-size:13px;font-weight:600;display:flex;align-items:center;background:rgba(100,168,255,0.15);color:#2272eb')}>투표</span>}
          </button>
        ))}
        {q && list.length === 0 && <div style={css('padding:24px;text-align:center;font-size:15px;color:#6b7684')}>‘{query}’ 후보가 없어요</div>}
        {!q && votable.length === 0 && <div style={css('padding:24px;text-align:center;font-size:15px;color:#6b7684')}>아직 투표할 다른 후보가 없어요</div>}
        {!q && (
          <div style={css('padding:4px 16px 0')}>
            <button className="pr-dim" onClick={goRank} style={css('width:100%;height:48px;border-radius:12px;font-size:15px;font-weight:600;color:#4e5968;display:flex;align-items:center;justify-content:center;gap:4px')}>
              전체 순위 보기<ChevronRight size={16} stroke="currentColor" width={2.6} />
            </button>
          </div>
        )}
      </div>

      {loggedIn ? (
        <button data-g="l2" className="pr-98" onClick={goAccount} style={css('width:calc(100% - 24px);margin:12px 12px 0;background:#ffffff;border-radius:24px;padding:20px 16px 20px 24px;display:flex;align-items:center;gap:12px;text-align:left')}>
          <span style={css('flex:1;display:flex;flex-direction:column;gap:2px')}>
            <span style={css('font-size:15px;line-height:22.5px;font-weight:500;color:#6b7684')}>내 투표</span>
            <span style={css('font-size:20px;line-height:29px;font-weight:700;color:#191f28')}>{myCount ? `${myCount}명에게 투표했어요` : '아직 투표하지 않았어요'}</span>
          </span>
          <ChevronRight />
        </button>
      ) : (
        <div data-g="l2" style={css('margin:12px 12px 0;background:#ffffff;border-radius:24px;padding:24px;display:flex;flex-direction:column;gap:16px')}>
          <div style={css('display:flex;flex-direction:column;gap:4px')}>
            <span style={css('font-size:17px;line-height:25.5px;font-weight:700;color:#191f28')}>로그인하면 투표할 수 있어요</span>
            <span style={css('font-size:15px;line-height:22.5px;font-weight:500;color:#6b7684')}>후보마다 추천이나 비추천을 한 번씩 남길 수 있어요</span>
          </div>
          <button data-g="primary" className="pr-96" onClick={goAccount} style={css('height:48px;border-radius:14px;background:#3182f6;color:#ffffff;font-size:17px;font-weight:600;transition:transform 150ms')}>로그인하기</button>
        </div>
      )}
    </div>
  )
}

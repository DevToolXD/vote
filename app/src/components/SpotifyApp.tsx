import { memo, useEffect, useMemo, useState } from 'react'
import type { Firestore } from 'firebase/firestore'
import { css } from '../css'
import { addSong, removeSong, thumbOf, watchSongs, type Song } from '../backend/songs'
import type { Person } from '../model'
import { playMusic, toggleMusic, useMusic } from '../music'

// Spotify, after the real one: dark, a 홈 with what was added, 검색하기, and 내 라이브러리 with the songs you
// added (+ adds one from a YouTube link). There are no songs at first; each song is added once, by link.
// Playing happens in music.ts, so it goes on when you leave this screen (the circle shows it everywhere).

const BG = '#121212', CARD = '#1f1f1f', GREEN = '#1ed760', SEC = '#b3b3b3'
const FONT = "'Toss Product Sans',Pretendard,'Apple SD Gothic Neo','Noto Sans KR',system-ui,sans-serif"
type Tab = 'home' | 'search' | 'lib'
const SONG_POINTS = 10

type Props = { db: Firestore | null; uid: string | null; me?: Person; byId: Map<string, Person>; onLogin: () => void; onToast: (msg: string) => void }

const icons = {
  home: (on: boolean) => <svg width="26" height="26" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M4 11 12 4l8 7v8.5a.5.5 0 0 1-.5.5H15v-6H9v6H4.5a.5.5 0 0 1-.5-.5z" /></svg>,
  search: (on: boolean) => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on ? 3 : 2.2} strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></svg>,
  lib: (on: boolean) => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on ? 3 : 2.2} strokeLinecap="round" aria-hidden="true"><path d="M5 4v16M10 4v16" /><path d="m15 5 4 15" /></svg>,
}

function Bars() {
  // the little "playing" mark: three bars (transform only)
  return (
    <span aria-label="재생 중" style={css('display:inline-flex;align-items:flex-end;gap:2px;height:14px')}>
      {[0, 0.25, 0.5].map(d => <span key={d} style={css(`width:3px;height:100%;border-radius:1px;background:${GREEN};transform-origin:bottom;animation:spBar 0.9s ease-in-out ${d}s infinite alternate`)} />)}
    </span>
  )
}

const Thumb = ({ id, size, r = 6 }: { id: string; size: number; r?: number }) => (
  <img src={thumbOf(id)} alt="" loading="lazy" decoding="async" draggable={false} style={{ ...css('flex:none;object-fit:cover;background:#2a2a2a;display:block'), width: size, height: size, borderRadius: r }} />
)

/** A song in a list: its picture, title and who added it; the one playing is green. */
const Row = memo(function Row({ s, who, active, playing, onPlay, onMore, sub }: { s: Song; who: string; active: boolean; playing: boolean; onPlay: () => void; onMore?: () => void; sub?: string }) {
  return (
    <div style={css('display:flex;align-items:center;gap:12px;padding:6px 0;content-visibility:auto;contain-intrinsic-size:auto 68px')}>
      <button className="pr-dim" onClick={onPlay} aria-label={`${s.title} 재생`} style={css('flex:1;min-width:0;display:flex;align-items:center;gap:12px;text-align:left;color:#fff;background:none')}>
        <Thumb id={s.id} size={56} />
        <span style={css('flex:1;min-width:0;display:flex;flex-direction:column;gap:3px')}>
          <span style={css(`font-size:16px;line-height:20px;font-weight:600;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:${active ? GREEN : '#fff'}`)}>{s.title}</span>
          <span style={css(`display:flex;align-items:center;gap:6px;font-size:13px;line-height:17px;color:${SEC};white-space:nowrap;overflow:hidden`)}>
            {active && playing && <Bars />}
            <span style={css('overflow:hidden;text-overflow:ellipsis')}>{sub ?? `${who} · 들은 횟수 ${s.plays}회`}</span>
          </span>
        </span>
      </button>
      {onMore && <button className="pr-94" onClick={onMore} aria-label={`${s.title} 삭제`} style={css(`flex:none;width:40px;height:40px;display:flex;align-items:center;justify-content:center;color:${SEC};background:none`)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 7h15M9.5 7V5h5v2M6.5 7l.8 12h9.4l.8-12" /></svg>
      </button>}
    </div>
  )
})

export const SpotifyApp = memo(function SpotifyApp({ db, uid, me, byId, onLogin, onToast }: Props) {
  const [songs, setSongs] = useState<Song[] | null>(null)
  const [tab, setTab] = useState<Tab>('home')
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const music = useMusic()
  const nowId = music.queue[music.index]?.id
  const playing = music.status === 'playing' || music.status === 'loading'

  useEffect(() => (db && uid ? watchSongs(db, setSongs) : undefined), [db, uid])
  const who = (u: string) => byId.get(u)?.name ?? '알 수 없음'
  const mine = useMemo(() => (songs ?? []).filter(s => s.uid === uid), [songs, uid])
  const popular = useMemo(() => [...(songs ?? [])].filter(s => s.plays > 0).sort((a, b) => b.plays - a.plays).slice(0, 10), [songs])
  const found = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (songs ?? []).filter(s => !t || s.title.toLowerCase().includes(t) || who(s.uid).toLowerCase().includes(t))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songs, q, byId])

  if (!uid) {
    return (
      <div style={css(`height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;background:${BG};color:#fff;text-align:center;font-family:${FONT}`)}>
        <span style={css('font-size:24px;font-weight:800')}>Spotify</span>
        <span style={css(`font-size:14px;color:${SEC}`)}>로그인하면 음악을 듣고 추가할 수 있어요</span>
        <button className="pr-96" onClick={onLogin} style={css(`height:44px;padding:0 24px;border-radius:22px;background:${GREEN};color:#000;font-size:15px;font-weight:700`)}>로그인</button>
      </div>
    )
  }

  const play = (list: Song[], s: Song) => {
    if (s.id === nowId) toggleMusic()
    else playMusic(list, list.findIndex(x => x.id === s.id))
  }
  const add = async () => {
    if (!db || busy) return
    setBusy(true); setErr('')
    const r = await addSong(db, uid, link)
    setBusy(false)
    if (r.ok) { setAdding(false); setLink(''); onToast('음악을 추가했어요'); return }
    setErr(r.why === 'link' ? '유튜브 링크가 아니에요. 영상 주소를 그대로 붙여 넣어 주세요'
      : r.why === 'dup' ? (r.by && r.by === uid ? '내가 이미 추가한 곡이에요' : `이미 추가된 곡이에요${r.by ? ` (${who(r.by)}님)` : ''}`)
      : r.why === 'gone' ? '재생할 수 없는 영상이에요 (지워졌거나 퍼가기가 막혀 있어요)'
      : '추가하지 못했어요. 잠시 뒤에 다시 해보세요')
  }
  const drop = async (s: Song) => {
    if (!db || !window.confirm(`“${s.title}”을(를) 지울까요?\n지우면 다른 사람도 들을 수 없어요.`)) return
    try { await removeSong(db, s.id) } catch { onToast('지우지 못했어요') }
  }
  const listens = mine.reduce((n, s) => n + s.plays, 0)

  const avatar = (
    <span aria-hidden="true" style={css('flex:none;width:46px;height:46px;border-radius:9999px;background:#c8693e;color:#000;font-size:20px;font-weight:700;display:flex;align-items:center;justify-content:center')}>{(me?.name ?? '?').slice(0, 1)}</span>
  )
  const head = (title: string, right?: React.ReactNode) => (
    <header style={css('flex:none;display:flex;align-items:center;gap:12px;padding:8px 18px 10px')}>
      {avatar}
      <h1 style={css('flex:1;margin:0;font-size:26px;line-height:32px;font-weight:800;letter-spacing:-0.3px')}>{title}</h1>
      {right}
    </header>
  )
  const empty = (
    <div style={css(`padding:56px 28px;text-align:center;color:${SEC};font-size:15px;line-height:23px`)}>
      아직 음악이 없어요.<br />내 라이브러리의 <b style={css('color:#fff')}>＋</b>로 유튜브 링크를 추가해 보세요.
      <div><button className="pr-96" onClick={() => { setTab('lib'); setAdding(true) }} style={css(`margin-top:18px;height:42px;padding:0 22px;border-radius:21px;background:${GREEN};color:#000;font-size:15px;font-weight:700`)}>음악 추가하기</button></div>
    </div>
  )

  return (
    <div style={css(`position:relative;height:calc(100% + var(--phone-bottom));margin-bottom:calc(-1 * var(--phone-bottom));display:flex;flex-direction:column;background:${BG};color:#fff;font-family:${FONT};overflow:hidden;word-break:keep-all`)}>
      <div style={css('flex:1;min-height:0;display:flex;flex-direction:column')}>
        {tab === 'home' && (
          <>
            {head('홈')}
            <div style={css('flex:1;min-height:0;overflow-y:auto;padding:0 18px 24px')}>
              {songs === null ? <div style={css(`padding:40px;text-align:center;color:${SEC}`)}>불러오는 중</div> : songs.length === 0 ? empty : (
                <>
                  <h2 style={css('margin:10px 0 12px;font-size:22px;line-height:28px;font-weight:800')}>방금 추가된 곡</h2>
                  <div style={css('display:flex;gap:14px;margin:0 -18px;padding:0 18px 6px;overflow-x:auto;scrollbar-width:none')}>
                    {songs.slice(0, 12).map(s => (
                      <button key={s.id} className="pr-96" onClick={() => play(songs, s)} aria-label={`${s.title} 재생`} style={css('flex:none;width:140px;display:flex;flex-direction:column;gap:8px;text-align:left;color:#fff;background:none')}>
                        <Thumb id={s.id} size={140} r={8} />
                        <span style={css(`font-size:14px;line-height:18px;font-weight:600;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:${s.id === nowId ? GREEN : '#fff'}`)}>{s.title}</span>
                        <span style={css(`font-size:12px;color:${SEC};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>{who(s.uid)}</span>
                      </button>
                    ))}
                  </div>
                  {popular.length > 0 && (
                    <>
                      <h2 style={css('margin:22px 0 6px;font-size:22px;line-height:28px;font-weight:800')}>많이 들은 곡</h2>
                      {popular.map(s => <Row key={s.id} s={s} who={who(s.uid)} active={s.id === nowId} playing={playing} onPlay={() => play(popular, s)} />)}
                    </>
                  )}
                  <h2 style={css('margin:22px 0 6px;font-size:22px;line-height:28px;font-weight:800')}>모든 곡</h2>
                  {songs.map(s => <Row key={s.id} s={s} who={who(s.uid)} active={s.id === nowId} playing={playing} onPlay={() => play(songs, s)} />)}
                </>
              )}
            </div>
          </>
        )}

        {tab === 'search' && (
          <>
            {head('검색')}
            <div style={css('flex:none;padding:4px 18px 10px')}>
              <label style={css('display:flex;align-items:center;gap:10px;height:48px;padding:0 14px;border-radius:8px;background:#fff;color:#000')}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></svg>
                <input value={q} onChange={e => setQ(e.target.value.slice(0, 40))} placeholder="어떤 것을 듣고 싶으세요?" aria-label="곡 검색" style={css('flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:16px;font-weight:600;color:#000;font-family:inherit')} />
              </label>
            </div>
            <div style={css('flex:1;min-height:0;overflow-y:auto;padding:0 18px 24px')}>
              {songs !== null && songs.length === 0 ? empty : found.length === 0 ? <div style={css(`padding:44px;text-align:center;color:${SEC}`)}>찾는 곡이 없어요</div>
                : found.map(s => <Row key={s.id} s={s} who={who(s.uid)} active={s.id === nowId} playing={playing} onPlay={() => play(found, s)} />)}
            </div>
          </>
        )}

        {tab === 'lib' && (
          <>
            {head('내 라이브러리', (
              <button className="pr-94" onClick={() => { setAdding(true); setErr('') }} aria-label="음악 추가" style={css('flex:none;width:44px;height:44px;display:flex;align-items:center;justify-content:center;color:#fff;background:none')}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 4.5v15M4.5 12h15" /></svg>
              </button>
            ))}
            <div style={css('flex:1;min-height:0;overflow-y:auto;padding:0 18px 24px')}>
              <div style={css(`margin:2px 0 8px;padding:12px 14px;border-radius:10px;background:${CARD};font-size:13px;line-height:19px;color:${SEC}`)}>
                내가 추가한 곡을 다른 사람이 <b style={css('color:#fff')}>1분 이상</b> 들으면 {SONG_POINTS}포인트를 받아요.
                {mine.length > 0 && <div style={css('margin-top:4px;color:#fff;font-weight:600')}>내 곡 {mine.length}개 · 들은 횟수 {listens}회 · {(listens * SONG_POINTS).toLocaleString()}P</div>}
              </div>
              {songs === null ? <div style={css(`padding:40px;text-align:center;color:${SEC}`)}>불러오는 중</div> : mine.length === 0 ? (
                <div style={css(`padding:44px 24px;text-align:center;color:${SEC};font-size:15px;line-height:23px`)}>아직 추가한 곡이 없어요.<br />위의 ＋를 눌러 유튜브 링크를 붙여 넣어 보세요.</div>
              ) : mine.map(s => <Row key={s.id} s={s} who={who(s.uid)} active={s.id === nowId} playing={playing} onPlay={() => play(mine, s)} onMore={() => drop(s)} sub={`내가 추가한 곡 · 들은 횟수 ${s.plays}회`} />)}
            </div>
          </>
        )}
      </div>

      <nav aria-label="Spotify 메뉴" style={css(`flex:none;display:flex;justify-content:space-around;padding:8px 8px calc(var(--phone-bottom) - 8px);background:linear-gradient(180deg,rgba(18,18,18,0.92),${BG} 40%)`)}>
        {([['home', '홈'], ['search', '검색하기'], ['lib', '내 라이브러리']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} className="pr-96" onClick={() => setTab(k)} aria-current={tab === k ? 'page' : undefined} style={css(`flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:4px 0;background:none;color:${tab === k ? '#fff' : SEC};font-size:11px;line-height:14px;font-weight:600`)}>
            {icons[k](tab === k)}{l}
          </button>
        ))}
      </nav>

      {adding && (
        <div onClick={() => !busy && setAdding(false)} style={css('position:absolute;inset:0;z-index:20;background:rgba(0,0,0,0.6);display:flex;align-items:flex-end;animation:fade 160ms ease both')}>
          <div onClick={e => e.stopPropagation()} style={css(`width:100%;box-sizing:border-box;padding:20px 18px calc(var(--phone-bottom) + 6px);border-radius:18px 18px 0 0;background:#282828;display:flex;flex-direction:column;gap:12px;animation:sheetUp 320ms cubic-bezier(0.16,1,0.3,1) both`)}>
            <span style={css('font-size:18px;font-weight:800;text-align:center')}>유튜브 링크로 음악 추가</span>
            <input value={link} onChange={e => { setLink(e.target.value.slice(0, 300)); setErr('') }} onKeyDown={e => { if (e.key === 'Enter') add() }} inputMode="url" autoFocus placeholder="https://youtu.be/…" aria-label="유튜브 링크"
              style={css('height:48px;padding:0 14px;border:0;border-radius:8px;background:#3e3e3e;color:#fff;font-size:16px;outline:none;font-family:inherit')} />
            {err && <span role="alert" style={css('font-size:13px;line-height:18px;color:#ff6b6b')}>{err}</span>}
            <span style={css(`font-size:12px;line-height:17px;color:${SEC}`)}>같은 영상은 한 번만 추가할 수 있어요. 영상의 소리만 재생돼요.</span>
            <button className="pr-96" disabled={busy || !link.trim()} onClick={add} style={css(`height:48px;border-radius:24px;background:${GREEN};color:#000;font-size:16px;font-weight:700;opacity:${busy || !link.trim() ? 0.5 : 1}`)}>{busy ? '확인하는 중' : '추가하기'}</button>
          </div>
        </div>
      )}
    </div>
  )
})

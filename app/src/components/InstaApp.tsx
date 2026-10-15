import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Firestore } from 'firebase/firestore'
import { css } from '../css'
import { Avatar as ProfilePic } from './Avatar'
import { InstaMessages } from './InstaMessages'
import { isUnread, type ChatRow } from '../backend/messages'
import type { Person } from '../model'
import { addPost, addPostComment, countPostView, removePost, removePostComment, setPostLiked, shrinkPhoto, watchPostComments, watchPosts, type Post, type PostComment } from '../backend/posts'

// 인스타그램, laid out like the real one: 홈 (stories row + feed), 릴스 (one post per screen, swipe up),
// 검색 (a grid with the views), 메시지 (Instagram-style, on the app's own chats), 프로필 (my posts), and the
// floating bar. The account IS the app account: the name, the photo and the frame are the profile's own.
// Nothing is shown until someone posts. A heart is yours alone, a view counts after a few seconds, and
// anyone signed in can comment.
type Props = {
  db: Firestore | null; uid: string | null; me?: Person; chats: ChatRow[]; byId: Map<string, Person>; isAdmin?: boolean
  onLogin: () => void; onToast: (msg: string) => void; onProfile: () => void
}
type Tab = 'home' | 'reels' | 'search' | 'dm' | 'me'

const ago = (t: number) => {
  const m = Math.max(1, Math.round((Date.now() - t) / 60000))
  return m < 60 ? `${m}분 전` : m < 1440 ? `${Math.round(m / 60)}시간 전` : `${Math.round(m / 1440)}일 전`
}
const compact = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(1).replace(/\.0$/, '')}만` : n.toLocaleString())
const HUES = ['#f58529', '#dd2a7b', '#8134af', '#515bd4', '#0a84ff', '#34c759']
const hue = (s: string) => HUES[[...s].reduce((n, c) => n + c.charCodeAt(0), 0) % HUES.length]

const svg = (children: ReactNode, size = 26, fill = 'none') => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)
const I = {
  home: (on: boolean) => svg(<path d="M4 11 12 4l8 7v8.5a.5.5 0 0 1-.5.5H15v-6H9v6H4.5a.5.5 0 0 1-.5-.5z" />, 26, on ? 'currentColor' : 'none'),
  reels: (on: boolean, dark: boolean) => svg(<><rect x="3.5" y="3.5" width="17" height="17" rx="4.5" /><path d="m10 8.5 5.5 3.5-5.5 3.5z" fill={on ? (dark ? '#2a2a2c' : '#fff') : 'currentColor'} stroke="none" /></>, 26, on ? 'currentColor' : 'none'),
  send: () => svg(<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z" />),
  search: () => svg(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></>),
  heart: (on: boolean, size = 26) => <svg width={size} height={size} viewBox="0 0 24 24" fill={on ? '#ff3040' : 'none'} stroke={on ? '#ff3040' : 'currentColor'} strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.1A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1z" /></svg>,
  comment: (size = 26) => svg(<path d="M20.5 12a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1.1-4.2A8.5 8.5 0 1 1 20.5 12z" />, size),
  eye: () => svg(<><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>, 16),
  plus: () => svg(<path d="M12 4.5v15M4.5 12h15" />, 28),
  grid: () => svg(<><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>, 24, 'currentColor'),
}

/** A person's picture: their own profile (photo and frame) when they're in the app's people, else a letter. */
type Who = { byId: Map<string, Person> }
const nameOf = (who: Who, uid: string, fallback: string) => who.byId.get(uid)?.name ?? fallback
function Pic({ who, uid, name, size, ring = false }: { who: Who; uid?: string; name: string; size: number; ring?: boolean }) {
  const p = uid ? who.byId.get(uid) : undefined
  const n = p?.name ?? name
  const inner = p
    ? <ProfilePic frame={p.frame} photo={p.photoCss} size={size} style={{ flex: 'none' }} />
    : <span style={{ ...css('display:flex;align-items:center;justify-content:center;border-radius:9999px;color:#fff;font-weight:700;flex:none'), width: size, height: size, fontSize: size * 0.4, background: hue(n) }}>{n.slice(0, 1) || '?'}</span>
  if (!ring) return inner
  return <span style={{ ...css('display:flex;padding:2px;border-radius:9999px;background:linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5);flex:none'), width: size + 8, height: size + 8 }}><span style={css('display:flex;padding:2px;border-radius:9999px;background:#fff')}>{inner}</span></span>
}

/** A view counts once the post has been on screen for a while (not your own post; the rules allow one each). */
function useViewCount(db: Firestore | null, uid: string | null, post: Post | null, on: boolean, ms = 3000) {
  useEffect(() => {
    if (!on || !post || !db || !uid || post.uid === uid) return
    const t = setTimeout(() => { countPostView(db, post.id, uid).catch(() => { /* already counted, or offline */ }) }, ms)
    return () => clearTimeout(t)
  }, [on, post?.id, db, uid, ms])
}

function Comments({ db, post, uid, name, who, isAdmin, onToast }: { db: Firestore; post: Post; uid: string; name: string; who: Who; isAdmin: boolean; onToast: (m: string) => void }) {
  const [list, setList] = useState<PostComment[] | null>(null)
  const [text, setText] = useState('')
  useEffect(() => watchPostComments(db, post.id, setList), [db, post.id])
  const send = async () => {
    const t = text.trim()
    if (!t) return
    try { await addPostComment(db, post.id, { uid, name: name.slice(0, 30), text: t.slice(0, 300) }); setText('') } catch { onToast('댓글을 달지 못했어요') }
  }
  const drop = async (c: PostComment) => {
    if (!window.confirm('이 댓글을 지울까요?')) return
    try { await removePostComment(db, post.id, c.id) } catch { onToast('지우지 못했어요') }
  }
  return (
    <div style={css('padding:0 14px;display:flex;flex-direction:column;gap:10px')}>
      {list === null && <span style={css('font-size:13px;color:#8e8e93')}>불러오는 중</span>}
      {list?.length === 0 && <span style={css('font-size:13px;color:#8e8e93')}>아직 댓글이 없어요</span>}
      {list?.map(c => (
        <div key={c.id} style={css('display:flex;gap:10px;align-items:flex-start')}>
          <Pic who={who} uid={c.uid} name={c.name} size={28} />
          <span style={css('flex:1;min-width:0;font-size:14px;line-height:20px;word-break:break-word')}><b>{nameOf(who, c.uid, c.name)}</b> {c.text}</span>
          {(c.uid === uid || post.uid === uid || isAdmin) && <button aria-label="댓글 지우기" onClick={() => drop(c)} style={css('font-size:13px;color:#8e8e93;padding:0 2px')}>✕</button>}
        </div>
      ))}
      <div style={css('display:flex;gap:8px;align-items:center')}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send() }} maxLength={300} placeholder="댓글 달기..." aria-label="댓글 달기" style={css('flex:1;min-width:0;height:38px;padding:0 14px;border-radius:19px;border:0;background:#efefef;font-size:15px;outline:none')} />
        <button className="pr-96" disabled={!text.trim()} onClick={send} style={css('font-size:15px;font-weight:700;color:#0095f6;padding:0 4px')}>게시</button>
      </div>
    </div>
  )
}

export const InstaApp = memo(function InstaApp({ db, uid, me, chats, byId, isAdmin = false, onLogin, onToast, onProfile }: Props) {
  const name = me?.name ?? ''
  const who: Who = { byId }
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [tab, setTab] = useState<Tab>('home')
  const [detail, setDetail] = useState<string | null>(null)
  const [upload, setUpload] = useState(false)
  const [photo, setPhoto] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => (db && uid ? watchPosts(db, setPosts) : undefined), [db, uid])
  const open = posts?.find(p => p.id === detail) ?? null
  useViewCount(db, uid, open, !!open, 3000)

  const like = async (p: Post) => {
    if (!db || !uid) return
    try { await setPostLiked(db, p.id, uid, !p.likes.includes(uid)) } catch { onToast('하트를 누르지 못했어요') }
  }
  const pick = async (f: File | undefined) => {
    if (!f) return
    try { setPhoto(await shrinkPhoto(f)) } catch (e) { onToast(e instanceof Error ? e.message : '사진을 고르지 못했어요') }
  }
  const share = async () => {
    if (!db || !uid || !photo) return
    setBusy(true)
    try {
      await addPost(db, { uid, name: name.slice(0, 30), photo, caption: caption.trim().slice(0, 300) })
      setUpload(false); setPhoto(null); setCaption('')
      onToast('올렸어요')
    } catch (e) { console.warn('post', e); onToast(`올리지 못했어요 (${(e as { code?: string })?.code ?? (e instanceof Error ? e.message : '오류')})`) } finally { setBusy(false) }
  }
  const remove = async (p: Post) => {
    if (!db) return
    if (!window.confirm('이 게시물을 지울까요?\n지우면 다시 볼 수 없어요.')) return
    try { await removePost(db, p.id); setDetail(null) } catch { onToast('지우지 못했어요') }
  }

  if (!uid) {
    return (
      <div style={css('height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;background:#fff;text-align:center')}>
        <span style={css('font-size:22px;font-weight:800;color:#000')}>인스타그램</span>
        <span style={css('font-size:14px;color:#8e8e93')}>로그인하면 사진을 보고 올릴 수 있어요</span>
        <button className="pr-96" onClick={onLogin} style={css('height:40px;padding:0 20px;border-radius:20px;background:#0095f6;color:#fff;font-size:15px;font-weight:600')}>로그인</button>
      </div>
    )
  }

  const mine = (posts ?? []).filter(p => p.uid === uid)
  const authors = [...new Map((posts ?? []).filter(p => p.uid !== uid).map(p => [p.uid, p])).values()]
  const found = (posts ?? []).filter(p => !q.trim() || p.caption.includes(q.trim()) || p.name.includes(q.trim()))

  /** The like / comment row of a post (as a feed card shows it). */
  const actions = (p: Post, onComment: () => void, dark = false) => (
    <div style={css('display:flex;align-items:center;gap:16px;color:' + (dark ? '#fff' : '#000'))}>
      <button aria-label={p.likes.includes(uid) ? '하트 취소' : '하트'} aria-pressed={p.likes.includes(uid)} className="pr-96" onClick={() => like(p)} style={css('display:flex;align-items:center;gap:6px;font-size:14px;font-weight:600')}>{I.heart(p.likes.includes(uid))}{p.likes.length}</button>
      <button aria-label="댓글" className="pr-96" onClick={onComment} style={css('display:flex;align-items:center;font-size:14px')}>{I.comment()}</button>
      <span style={css('margin-left:auto;display:flex;align-items:center;gap:5px;font-size:13px;opacity:0.7')}>{I.eye()}{compact(p.views)}</span>
    </div>
  )

  const header = (title: ReactNode, left?: ReactNode) => (
    <header style={css('flex:none;display:flex;align-items:center;justify-content:space-between;padding:12px 16px 8px;background:#fff')}>
      <span style={css('width:44px;display:flex;color:#000')}>{left}</span>
      <span style={css('font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#000')}>{title}</span>
      <span style={css('width:44px')} />
    </header>
  )
  const plus = <button aria-label="올리기" className="pr-96" onClick={() => setUpload(true)} style={css('color:#000;display:flex')}>{I.plus()}</button>

  const empty = <div style={css('padding:70px 28px;text-align:center;color:#8e8e93;font-size:15px;line-height:22px')}>아직 올라온 사진이 없어요.<br />누군가 올리면 여기에 나와요.</div>

  // ---------------------------------------------------------------- tabs
  const homeView = (
    <>
      {header('Instagram', plus)}
      <div style={css('flex:1;min-height:0;overflow-y:auto;padding-bottom:110px;background:#fff;color:#000')}>
        <div style={css('display:flex;gap:14px;padding:16px 16px 12px;overflow-x:auto;scrollbar-width:none')}>
          <button aria-label="내 스토리: 사진 올리기" onClick={() => setUpload(true)} style={css('flex:none;display:flex;flex-direction:column;align-items:center;gap:5px;width:74px')}>
            <span style={css('position:relative;display:flex')}>
              <Pic who={who} uid={uid ?? undefined} name={name || '나'} size={66} />
              <span style={css('position:absolute;right:-2px;bottom:-2px;width:22px;height:22px;border-radius:9999px;background:#1c1c1e;color:#fff;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:15px;line-height:1')}>+</span>
            </span>
            <span style={css('font-size:12px;color:#555')}>내 스토리</span>
          </button>
          {authors.map(p => (
            <button key={p.uid} onClick={() => setDetail(p.id)} style={css('flex:none;display:flex;flex-direction:column;align-items:center;gap:5px;width:74px')}>
              <Pic who={who} uid={p.uid} name={p.name} size={62} ring />
              <span style={css('font-size:12px;color:#222;max-width:74px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{nameOf(who, p.uid, p.name)}</span>
            </button>
          ))}
        </div>
        {posts === null && <div style={css('padding:40px;text-align:center;color:#8e8e93;font-size:14px')}>불러오는 중</div>}
        {posts?.length === 0 && empty}
        {posts?.map(p => (
          <article key={p.id} style={css('flex:none;padding-bottom:12px;content-visibility:auto;contain-intrinsic-size:auto 560px')}>
            <div style={css('display:flex;align-items:center;gap:10px;padding:8px 14px')}>
              <Pic who={who} uid={p.uid} name={p.name} size={34} ring />
              <span style={css('flex:1;min-width:0;font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{nameOf(who, p.uid, p.name)}</span>
              <span style={css('font-size:12px;color:#8e8e93')}>{ago(p.at)}</span>
              {(p.uid === uid || isAdmin) && <button aria-label="이 게시물 지우기" onClick={() => remove(p)} style={css('font-size:14px;color:#8e8e93;padding:0 2px')}>✕</button>}
            </div>
            <button aria-label="사진 크게 보기" onClick={() => setDetail(p.id)} style={css('display:block;width:100%;padding:0')}>
              <img src={p.photo} alt="" loading="lazy" decoding="async" style={css('display:block;width:100%;aspect-ratio:1/1;object-fit:cover;background:#f2f2f2')} />
            </button>
            <div style={css('padding:10px 14px 0')}>{actions(p, () => setDetail(p.id))}</div>
            {p.caption && <p style={css('margin:8px 14px 0;font-size:14px;line-height:20px;white-space:pre-wrap;word-break:break-word')}><b>{nameOf(who, p.uid, p.name)}</b> {p.caption}</p>}
          </article>
        ))}
      </div>
    </>
  )

  const searchView = (
    <>
      <div style={css('flex:none;padding:12px 16px 8px;background:#fff')}>
        <label style={css('display:flex;align-items:center;gap:8px;height:40px;padding:0 12px;border-radius:12px;background:#efefef;color:#8e8e93')}>
          {I.search()}
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="검색" aria-label="검색" style={css('flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:16px;color:#000')} />
        </label>
      </div>
      <div style={css('flex:1;min-height:0;overflow-y:auto;padding-bottom:110px;background:#fff')}>
        {posts?.length === 0 && empty}
        <div style={css('display:grid;grid-template-columns:repeat(3,1fr);gap:2px')}>
          {found.map(p => (
            <button key={p.id} aria-label="게시물 열기" onClick={() => setDetail(p.id)} style={css('position:relative;display:block;aspect-ratio:3/4;overflow:hidden;background:#f2f2f2')}>
              <img src={p.photo} alt="" loading="lazy" decoding="async" style={css('width:100%;height:100%;object-fit:cover;display:block')} />
              <span style={css('position:absolute;left:6px;bottom:6px;display:flex;align-items:center;gap:4px;color:#fff;font-size:13px;font-weight:700;text-shadow:0 1px 3px rgba(0,0,0,0.6)')}>{I.eye()}{compact(p.views)}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )

  const meView = (
    <div style={css('flex:1;min-height:0;overflow-y:auto;padding-bottom:110px;background:#fff;color:#000')}>
      <header style={css('display:flex;align-items:center;justify-content:space-between;padding:12px 16px 6px')}>
        {plus}
        <span style={css('font-size:18px;font-weight:800')}>{name || '나'}</span>
        <span style={css('width:28px')} />
      </header>
      <div style={css('display:flex;align-items:center;gap:22px;padding:10px 18px')}>
        <Pic who={who} uid={uid ?? undefined} name={name || '나'} size={82} />
        <div style={css('flex:1;display:flex;justify-content:space-around;text-align:center')}>
          {([['게시물', mine.length], ['하트', mine.reduce((n, p) => n + p.likes.length, 0)], ['조회', mine.reduce((n, p) => n + p.views, 0)]] as const).map(([l, n]) => (
            <span key={l} style={css('display:flex;flex-direction:column;gap:2px')}><b style={css('font-size:18px')}>{compact(n)}</b><span style={css('font-size:13px')}>{l}</span></span>
          ))}
        </div>
      </div>
      <div style={css('display:flex;gap:8px;padding:6px 16px 14px')}>
        <button className="pr-96" onClick={onProfile} style={css('flex:1;height:36px;border-radius:10px;background:#efefef;font-size:14px;font-weight:700')}>프로필 편집</button>
        <button className="pr-96" onClick={() => setUpload(true)} style={css('flex:1;height:36px;border-radius:10px;background:#efefef;font-size:14px;font-weight:700')}>사진 올리기</button>
      </div>
      <div style={css('display:flex;justify-content:center;padding:10px 0;border-top:0.5px solid #dbdbdb;color:#000')}>{I.grid()}</div>
      {mine.length === 0 && <div style={css('padding:40px 24px;text-align:center;color:#8e8e93;font-size:14px')}>아직 올린 사진이 없어요</div>}
      <div style={css('display:grid;grid-template-columns:repeat(3,1fr);gap:2px')}>
        {mine.map(p => (
          <button key={p.id} aria-label="게시물 열기" onClick={() => setDetail(p.id)} style={css('display:block;aspect-ratio:1/1;overflow:hidden;background:#f2f2f2')}><img src={p.photo} alt="" loading="lazy" decoding="async" style={css('width:100%;height:100%;object-fit:cover;display:block')} /></button>
        ))}
      </div>
    </div>
  )

  const reelsView = (
    <div style={css('position:absolute;inset:0;background:#000;color:#fff')}>
      {(posts?.length ?? 0) === 0 ? (
        <div style={css('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:30px;color:#bbb;font-size:15px;line-height:22px')}>아직 올라온 릴스가 없어요.<br />누군가 올리면 여기에 나와요.</div>
      ) : (
        <div style={css('position:absolute;inset:0;overflow-y:scroll;scroll-snap-type:y mandatory')}>
          {posts?.map(p => <Reel key={p.id} db={db} uid={uid} who={who} post={p} onLike={() => like(p)} onComment={() => setDetail(p.id)} />)}
        </div>
      )}
      <div style={css('position:absolute;left:0;right:0;top:0;display:flex;justify-content:space-between;align-items:center;padding:calc(var(--phone-top,54px) - 34px) 16px 0;pointer-events:none;z-index:2')}>
        <button aria-label="올리기" onClick={() => setUpload(true)} style={css('pointer-events:auto;color:#fff;display:flex')}>{I.plus()}</button>
        <span style={css('font-size:20px;font-weight:800;text-shadow:0 1px 4px rgba(0,0,0,0.6)')}>릴스</span>
        <span style={css('width:28px')} />
      </div>
    </div>
  )

  const dark = tab === 'reels'
  const unreadDm = chats.some(c => isUnread(c, uid))
  const bar = (
    <nav aria-label="인스타그램 메뉴" style={css('position:absolute;left:14px;right:14px;z-index:15;bottom:calc(var(--phone-bottom,34px) - 14px);height:62px;border-radius:9999px;display:flex;align-items:center;justify-content:space-around;padding:0 8px;backdrop-filter:blur(22px) saturate(180%);-webkit-backdrop-filter:blur(22px) saturate(180%);box-shadow:0 8px 28px rgba(0,0,0,0.18),inset 0 0 0 0.5px rgba(0,0,0,0.06);' + (dark ? 'background:rgba(40,40,42,0.72);color:#fff' : 'background:rgba(250,250,252,0.82);color:#000'))}>
      {([['home', I.home(tab === 'home')], ['reels', I.reels(tab === 'reels', dark)], ['dm', I.send()], ['search', I.search()], ['me', <Pic key="a" who={who} uid={uid ?? undefined} name={name || '나'} size={28} />]] as [string, ReactNode][]).map(([k, icon]) => {
        const on = k === tab
        return (
          <button key={k} aria-label={{ home: '홈', reels: '릴스', dm: '메시지', search: '검색', me: '프로필' }[k]} aria-current={on ? 'page' : undefined}
            onClick={() => setTab(k as Tab)}
            style={{ ...css('position:relative;width:52px;height:46px;border-radius:9999px;display:flex;align-items:center;justify-content:center'), background: on ? (dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)') : 'transparent' }}>{icon}{k === 'dm' && unreadDm && <span aria-label="안 읽은 메시지" style={css('position:absolute;right:9px;top:7px;width:10px;height:10px;border-radius:9999px;background:#ff3040;border:2px solid #fff')} />}</button>
        )
      })}
    </nav>
  )

  return (
    <div style={css('position:relative;height:100%;display:flex;flex-direction:column;background:#fff;color:#000')}>
      {tab === 'home' && homeView}
      {tab === 'search' && searchView}
      {tab === 'me' && meView}
      {tab === 'reels' && reelsView}
      {tab === 'dm' && db && me && <InstaMessages db={db} me={me} chats={chats} byId={byId} onBack={() => setTab('home')} onToast={onToast} />}
      {bar}

      {open && db && (
        <div style={css('position:absolute;inset:0;z-index:30;background:#fff;display:flex;flex-direction:column')}>
          <header style={css('flex:none;display:flex;align-items:center;justify-content:space-between;padding:calc(var(--phone-top,54px) - 30px) 14px 8px;border-bottom:0.5px solid #dbdbdb')}>
            <button aria-label="닫기" onClick={() => setDetail(null)} style={css('font-size:28px;line-height:1;width:44px;text-align:left')}>‹</button>
            <span style={css('font-size:16px;font-weight:700')}>게시물</span>
            <span style={css('width:44px;text-align:right')}>{(open.uid === uid || isAdmin) && <button aria-label="이 게시물 지우기" onClick={() => remove(open)} style={css('font-size:15px;color:#8e8e93')}>✕</button>}</span>
          </header>
          <div style={css('flex:1;min-height:0;overflow-y:auto;padding-bottom:20px')}>
            <div style={css('display:flex;align-items:center;gap:10px;padding:10px 14px')}>
              <Pic who={who} uid={open.uid} name={open.name} size={34} ring />
              <span style={css('flex:1;font-size:14px;font-weight:700')}>{nameOf(who, open.uid, open.name)}</span>
              <span style={css('font-size:12px;color:#8e8e93')}>{ago(open.at)}</span>
            </div>
            <img src={open.photo} alt="" style={css('display:block;width:100%;max-height:70vh;object-fit:contain;background:#000')} />
            <div style={css('padding:12px 14px 0')}>{actions(open, () => undefined)}</div>
            {open.caption && <p style={css('margin:8px 14px 12px;font-size:14px;line-height:20px;white-space:pre-wrap;word-break:break-word')}><b>{nameOf(who, open.uid, open.name)}</b> {open.caption}</p>}
            <Comments db={db} post={open} uid={uid} name={name} who={who} isAdmin={isAdmin} onToast={onToast} />
          </div>
        </div>
      )}

      {upload && (
        <div onClick={() => !busy && setUpload(false)} style={css('position:absolute;inset:0;z-index:40;background:rgba(0,0,0,0.4);display:flex;align-items:flex-end')}>
          <div onClick={e => e.stopPropagation()} style={css('width:100%;background:#fff;border-radius:18px 18px 0 0;padding:16px;display:flex;flex-direction:column;gap:12px;box-sizing:border-box')}>
            <span style={css('font-size:16px;font-weight:700;text-align:center')}>새 게시물</span>
            <button onClick={() => fileRef.current?.click()} style={css('height:44px;border-radius:12px;background:#efefef;font-size:15px;font-weight:600')}>{photo ? '다른 사진 고르기' : '사진 고르기'}</button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => pick(e.target.files?.[0])} />
            {photo && <img src={photo} alt="" style={css('width:100%;max-height:240px;object-fit:contain;border-radius:12px;background:#f2f2f2')} />}
            <textarea value={caption} onChange={e => setCaption(e.target.value)} maxLength={300} placeholder="문구 쓰기..." style={css('min-height:60px;padding:10px;border-radius:12px;border:0;background:#efefef;font-size:15px;resize:none;outline:none')} />
            <button disabled={!photo || busy} onClick={share} style={css('height:46px;border-radius:12px;background:#0095f6;color:#fff;font-size:16px;font-weight:700;opacity:' + (!photo || busy ? 0.5 : 1))}>{busy ? '올리는 중' : '공유'}</button>
          </div>
        </div>
      )}
    </div>
  )
})

/** One reel: a post filling the screen. It's counted as viewed when it has been the one on screen for 3 seconds. */
function Reel({ db, uid, who, post, onLike, onComment }: { db: Firestore | null; uid: string; who: Who; post: Post; onLike: () => void; onComment: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setSeen(true); return }
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting && e.intersectionRatio > 0.6), { threshold: [0, 0.6, 1] })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useViewCount(db, uid, post, seen, 3000)
  const liked = post.likes.includes(uid)
  return (
    <div ref={ref} style={css('position:relative;height:100%;scroll-snap-align:start;scroll-snap-stop:always;overflow:hidden;background:#000')}>
      <img src={post.photo} alt="" loading="lazy" decoding="async" style={css('position:absolute;inset:0;width:100%;height:100%;object-fit:cover')} />
      <div style={css('position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0.35) 0%,rgba(0,0,0,0) 22%,rgba(0,0,0,0) 55%,rgba(0,0,0,0.65) 100%)')} />
      <div style={css('position:absolute;right:12px;bottom:130px;display:flex;flex-direction:column;align-items:center;gap:20px;color:#fff')}>
        <button aria-label={liked ? '하트 취소' : '하트'} aria-pressed={liked} onClick={onLike} style={css('display:flex;flex-direction:column;align-items:center;gap:3px;font-size:13px;font-weight:700')}>{I.heart(liked, 32)}{compact(post.likes.length)}</button>
        <button aria-label="댓글" onClick={onComment} style={css('display:flex;flex-direction:column;align-items:center;gap:3px;font-size:13px;font-weight:700')}>{I.comment(30)}</button>
        <span style={css('display:flex;flex-direction:column;align-items:center;gap:3px;font-size:13px;font-weight:700')}>{I.eye()}{compact(post.views)}</span>
      </div>
      <div style={css('position:absolute;left:14px;right:70px;bottom:104px;color:#fff;display:flex;flex-direction:column;gap:8px')}>
        <span style={css('display:flex;align-items:center;gap:10px;font-size:15px;font-weight:700')}><Pic who={who} uid={post.uid} name={post.name} size={34} ring />{nameOf(who, post.uid, post.name)}</span>
        {post.caption && <span style={css('font-size:14px;line-height:20px;white-space:pre-wrap;word-break:break-word;max-height:80px;overflow:hidden')}>{post.caption}</span>}
      </div>
    </div>
  )
}

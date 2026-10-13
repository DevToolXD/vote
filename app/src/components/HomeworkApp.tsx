import { useEffect, useRef, useState } from 'react'
import type { Firestore } from 'firebase/firestore'
import { css } from '../css'
import { addComment, addDocPost, countView, removeComment, removeDoc, setLiked, watchComments, watchDocs, type Comment, type Doc } from '../backend/homework'
import { shrinkPhoto } from '../backend/posts'

// 문서: a class's homework room. Each post is a photo with a title and a caption; hearts and comments
// under it. Only the author (or the admin) can take a post down, and the author or the commenter a comment.
type Props = { db: Firestore | null; uid: string | null; name: string; isAdmin?: boolean; onLogin: () => void; onToast: (msg: string) => void }

function ago(t: number) {
  const m = Math.max(1, Math.round((Date.now() - t) / 60000))
  return m < 60 ? `${m}분 전` : m < 1440 ? `${Math.round(m / 60)}시간 전` : `${Math.round(m / 1440)}일 전`
}

const Heart = ({ on }: { on: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={on ? '#ff3b5c' : 'none'} stroke={on ? '#ff3b5c' : '#1d1d1f'} strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20.5s-7.5-4.6-7.5-10.1A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1z" />
  </svg>
)

function Comments({ db, post, uid, name, isAdmin, onToast }: { db: Firestore; post: Doc; uid: string; name: string; isAdmin: boolean; onToast: (m: string) => void }) {
  const [list, setList] = useState<Comment[] | null>(null)
  const [text, setText] = useState('')
  useEffect(() => watchComments(db, post.id, setList), [db, post.id])
  const send = async () => {
    const t = text.trim()
    if (!t) return
    try { await addComment(db, post.id, { uid, name: name.slice(0, 30), text: t.slice(0, 300) }); setText('') } catch { onToast('댓글을 달지 못했어요') }
  }
  const drop = async (c: Comment) => {
    if (!window.confirm('이 댓글을 지울까요?')) return
    try { await removeComment(db, post.id, c.id) } catch { onToast('지우지 못했어요') }
  }
  return (
    <div style={css('padding:0 14px 6px;display:flex;flex-direction:column;gap:8px')}>
      {list === null && <span style={css('font-size:13px;color:#8e8e93')}>불러오는 중</span>}
      {list?.map(c => (
        <div key={c.id} style={css('display:flex;gap:8px;align-items:flex-start')}>
          <span style={css('flex:1;min-width:0;font-size:14px;line-height:20px;word-break:break-word')}><b>{c.name}</b> {c.text}</span>
          {(c.uid === uid || post.uid === uid || isAdmin) && <button aria-label="댓글 지우기" onClick={() => drop(c)} style={css('font-size:13px;color:#8e8e93;padding:0 2px')}>✕</button>}
        </div>
      ))}
      <div style={css('display:flex;gap:8px;align-items:center;margin-top:4px')}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send() }} maxLength={300} placeholder="댓글 달기" aria-label="댓글 달기" style={css('flex:1;min-width:0;height:36px;padding:0 12px;border-radius:18px;border:0;background:#f2f2f7;font-size:15px;outline:none')} />
        <button className="pr-96" disabled={!text.trim()} onClick={send} style={css('font-size:15px;font-weight:700;color:#0a84ff;padding:0 4px')}>게시</button>
      </div>
    </div>
  )
}

export function HomeworkApp({ db, uid, name, isAdmin = false, onLogin, onToast }: Props) {
  const [docs, setDocs] = useState<Doc[] | null>(null)
  const [sheet, setSheet] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [viewing, setViewing] = useState<Doc | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => (db && uid ? watchDocs(db, setDocs) : undefined), [db, uid])

  // a view counts when the photo stays open for 5 seconds (not your own post; once per person, the rules say so)
  useEffect(() => {
    if (!viewing || !db || !uid || viewing.uid === uid) return
    const t = setTimeout(() => { countView(db, viewing.id, uid).catch(() => { /* already counted, or offline: no change */ }) }, 5000)
    return () => clearTimeout(t)
  }, [viewing?.id, db, uid])

  const pick = async (f: File | undefined) => {
    if (!f) return
    try { setPhoto(await shrinkPhoto(f)) } catch (e) { onToast(e instanceof Error ? e.message : '사진을 고르지 못했어요') }
  }
  const share = async () => {
    if (!db || !uid || !photo || !title.trim()) return
    setBusy(true)
    try {
      await addDocPost(db, { uid, title: title.trim().slice(0, 60), photo, caption: caption.trim().slice(0, 300) })
      setSheet(false); setPhoto(null); setTitle(''); setCaption('')
      onToast('올렸어요')
    } catch { onToast('올리지 못했어요') } finally { setBusy(false) }
  }
  const toggleLike = async (d: Doc) => {
    if (!db || !uid) return
    const liked = d.likes.includes(uid)
    try { await setLiked(db, d.id, uid, !liked) } catch { onToast('하트를 누르지 못했어요') }
  }
  const remove = async (d: Doc) => {
    if (!db) return
    if (!window.confirm(`“${d.title}” 숙제를 지울까요?\n지우면 다시 볼 수 없어요.`)) return
    try { await removeDoc(db, d.id) } catch { onToast('지우지 못했어요') }
  }

  if (!uid) {
    return (
      <div style={css('height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;background:#f2f2f7;text-align:center')}>
        <span style={css('font-size:17px;font-weight:700;color:#000')}>문서</span>
        <span style={css('font-size:14px;color:#8e8e93')}>로그인하면 숙제를 올리고 볼 수 있어요</span>
        <button className="pr-96" onClick={onLogin} style={css('height:40px;padding:0 20px;border-radius:20px;background:#0a84ff;color:#fff;font-size:15px;font-weight:600')}>로그인</button>
      </div>
    )
  }

  return (
    <div style={css('position:relative;height:100%;display:flex;flex-direction:column;background:#f2f2f7;color:#000')}>
      <header style={css('flex:none;display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px;background:#ffffff;border-bottom:0.5px solid #dbdbdb')}>
        <span style={css('font-size:20px;font-weight:800;letter-spacing:-0.4px')}>문서 · 숙제 공유</span>
        <button aria-label="숙제 올리기" className="pr-96" onClick={() => setSheet(true)} style={css('height:30px;padding:0 12px;border-radius:15px;background:#0a84ff;color:#fff;font-size:14px;font-weight:700')}>올리기</button>
      </header>

      <div style={css('flex:1;min-height:0;overflow-y:auto;padding:12px 12px 24px;display:flex;flex-direction:column;gap:12px')}>
        {docs === null && <div style={css('padding:40px;text-align:center;color:#8e8e93;font-size:14px')}>불러오는 중</div>}
        {docs?.length === 0 && <div style={css('padding:60px 24px;text-align:center;color:#8e8e93;font-size:15px;line-height:22px')}>아직 올린 숙제가 없어요.<br />첫 숙제를 올려 보세요.</div>}
        {docs?.map(d => {
          const liked = d.likes.includes(uid)
          const expanded = open === d.id
          return (
            <article key={d.id} style={css('flex:none;background:#ffffff;border-radius:16px;overflow:hidden')}>
              <div style={css('display:flex;align-items:center;gap:10px;padding:12px 14px 8px')}>
                <span style={css('width:30px;height:30px;border-radius:9999px;background:#dbdbdb;color:#333;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center')}>?</span>
                <span style={css('flex:1;min-width:0;display:flex;flex-direction:column')}>
                  <span style={css('font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>익명</span>
                  <span style={css('font-size:12px;color:#8e8e93')}>{ago(d.at)}</span>
                </span>
                {(d.uid === uid || isAdmin) && <button aria-label="이 숙제 지우기" onClick={() => remove(d)} style={css('font-size:14px;color:#8e8e93;padding:0 4px')}>✕</button>}
              </div>
              <div style={css('padding:0 14px 8px;font-size:17px;font-weight:800;line-height:24px;word-break:break-word')}>{d.title}</div>
              <button aria-label="사진 크게 보기" onClick={() => setViewing(d)} style={css('display:block;width:100%;padding:0')}>
                <img src={d.photo} alt="" style={css('display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:#f2f2f2')} />
              </button>
              {d.caption && <p style={css('margin:10px 14px 0;font-size:14px;line-height:20px;white-space:pre-wrap;word-break:break-word')}>{d.caption}</p>}
              <div style={css('display:flex;align-items:center;gap:14px;padding:10px 12px 8px')}>
                <button aria-label={liked ? '하트 취소' : '하트'} aria-pressed={liked} className="pr-96" onClick={() => toggleLike(d)} style={css('display:flex;align-items:center;gap:5px;font-size:14px;font-weight:600')}>
                  <Heart on={liked} />{d.likes.length}
                </button>
                <span style={css('display:flex;align-items:center;gap:5px;font-size:14px;font-weight:600;color:#8e8e93')}>조회 {d.views}</span>
                <button aria-expanded={expanded} className="pr-96" onClick={() => setOpen(expanded ? null : d.id)} style={css('font-size:14px;font-weight:600;color:#1d1d1f')}>댓글 {expanded ? '접기' : '보기'}</button>
              </div>
              {expanded && db && <Comments db={db} post={d} uid={uid} name={name} isAdmin={isAdmin} onToast={onToast} />}
            </article>
          )
        })}
      </div>

      {viewing && (
        <div onClick={() => setViewing(null)} style={css('position:absolute;inset:0;z-index:20;background:rgba(0,0,0,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;box-sizing:border-box')}>
          <div onClick={e => e.stopPropagation()} style={css('width:100%;display:flex;flex-direction:column;gap:12px;align-items:center')}>
            <img src={viewing.photo} alt={viewing.title} style={css('max-width:100%;max-height:72vh;object-fit:contain;border-radius:8px')} />
            <span style={css('font-size:16px;font-weight:700;color:#fff;text-align:center;word-break:break-word')}>{viewing.title}</span>
            <span style={css('font-size:13px;color:rgba(255,255,255,0.7)')}>조회 {viewing.views}</span>
            <div style={css('display:flex;gap:10px')}>
              <a href={viewing.photo} download={`숙제-${viewing.id}.${viewing.photo.startsWith('data:image/png') ? 'png' : viewing.photo.startsWith('data:image/webp') ? 'webp' : 'jpg'}`} style={css('height:42px;padding:0 18px;border-radius:21px;background:#0a84ff;color:#fff;font-size:15px;font-weight:700;display:flex;align-items:center;text-decoration:none')}>다운로드</a>
              <button onClick={() => setViewing(null)} style={css('height:42px;padding:0 18px;border-radius:21px;background:rgba(255,255,255,0.18);color:#fff;font-size:15px;font-weight:600')}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {sheet && (
        <div onClick={() => !busy && setSheet(false)} style={css('position:absolute;inset:0;z-index:10;background:rgba(0,0,0,0.35);display:flex;align-items:flex-end')}>
          <div onClick={e => e.stopPropagation()} style={css('width:100%;background:#ffffff;border-radius:18px 18px 0 0;padding:16px;display:flex;flex-direction:column;gap:12px;box-sizing:border-box')}>
            <span style={css('font-size:16px;font-weight:700;text-align:center')}>숙제 올리기</span>
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={60} placeholder="제목" aria-label="제목" style={css('height:44px;padding:0 12px;border-radius:12px;border:0;background:#f2f2f7;font-size:16px;outline:none')} />
            <button onClick={() => fileRef.current?.click()} style={css('height:44px;border-radius:12px;background:#f2f2f7;font-size:15px;font-weight:600')}>{photo ? '다른 사진 고르기' : '사진 고르기'}</button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => pick(e.target.files?.[0])} />
            {photo && <img src={photo} alt="" style={css('width:100%;max-height:220px;object-fit:contain;border-radius:12px;background:#f2f2f7')} />}
            <textarea value={caption} onChange={e => setCaption(e.target.value)} maxLength={300} placeholder="설명 (선택)" style={css('min-height:56px;padding:10px;border-radius:12px;border:0;background:#f2f2f7;font-size:15px;resize:none;outline:none')} />
            <button disabled={!photo || !title.trim() || busy} onClick={share} style={css('height:46px;border-radius:12px;background:#0a84ff;color:#fff;font-size:16px;font-weight:700')}>{busy ? '올리는 중' : '올리기'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

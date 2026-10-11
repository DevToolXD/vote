import { useEffect, useRef, useState } from 'react'
import type { Firestore } from 'firebase/firestore'
import { css } from '../css'
import { addPost, removePost, shrinkPhoto, watchPosts, type Post } from '../backend/posts'

// 인스타그램: a feed of the photos people posted (nothing until someone posts), your own photos
// with ✕, a 올리기 sheet for a photo and a caption, and the messages (the 메시지 tab) at the top.
type Props = { db: Firestore | null; uid: string | null; name: string; onLogin: () => void; onToast: (msg: string) => void; onMessages: () => void }

function ago(t: number) {
  const m = Math.max(1, Math.round((Date.now() - t) / 60000))
  return m < 60 ? `${m}분 전` : m < 1440 ? `${Math.round(m / 60)}시간 전` : `${Math.round(m / 1440)}일 전`
}

export function InstaApp({ db, uid, name, onLogin, onToast, onMessages }: Props) {
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [sheet, setSheet] = useState(false)
  const [photo, setPhoto] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => (db && uid ? watchPosts(db, setPosts) : undefined), [db, uid])

  const pick = async (f: File | undefined) => {
    if (!f) return
    try { setPhoto(await shrinkPhoto(f)) } catch (e) { onToast(e instanceof Error ? e.message : '사진을 고르지 못했어요') }
  }
  const share = async () => {
    if (!db || !uid || !photo) return
    setBusy(true)
    try {
      await addPost(db, { uid, name: name.slice(0, 30), photo, caption: caption.trim().slice(0, 300) })
      setSheet(false); setPhoto(null); setCaption('')
      onToast('올렸어요')
    } catch { onToast('올리지 못했어요') } finally { setBusy(false) }
  }
  const remove = async (p: Post) => {
    if (!db) return
    try { await removePost(db, p.id) } catch { onToast('지우지 못했어요') }
  }

  if (!uid) {
    return (
      <div style={css('height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;background:#ffffff;text-align:center')}>
        <span style={css('font-size:17px;font-weight:700;color:#000')}>인스타그램</span>
        <span style={css('font-size:14px;color:#8e8e93')}>로그인하면 사진을 보고 올릴 수 있어요</span>
        <button className="pr-96" onClick={onLogin} style={css('height:40px;padding:0 20px;border-radius:20px;background:#0a84ff;color:#fff;font-size:15px;font-weight:600')}>로그인</button>
      </div>
    )
  }

  return (
    <div style={css('position:relative;height:100%;display:flex;flex-direction:column;background:#ffffff;color:#000')}>
      <header style={css('flex:none;display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px;border-bottom:0.5px solid #dbdbdb')}>
        <span style={css('font-size:20px;font-weight:800;letter-spacing:-0.4px')}>인스타그램</span>
        <span style={css('display:flex;gap:18px;align-items:center')}>
          <button aria-label="메시지" className="pr-96" onClick={onMessages} style={css('font-size:14px;font-weight:600;color:#0a84ff')}>메시지</button>
          <button aria-label="사진 올리기" className="pr-96" onClick={() => setSheet(true)} style={css('width:28px;height:28px;border-radius:9px;background:#000;color:#fff;font-size:20px;line-height:28px')}>+</button>
        </span>
      </header>

      <div style={css('flex:1;min-height:0;overflow-y:auto')}>
        {posts === null && <div style={css('padding:40px;text-align:center;color:#8e8e93;font-size:14px')}>불러오는 중</div>}
        {posts?.length === 0 && (
          <div style={css('padding:60px 24px;text-align:center;color:#8e8e93;font-size:15px;line-height:22px')}>아직 올린 사진이 없어요.<br />첫 사진을 올려 보세요.</div>
        )}
        {posts?.map(p => (
          <article key={p.id} style={css('border-bottom:0.5px solid #eee;padding-bottom:10px')}>
            <div style={css('display:flex;align-items:center;gap:10px;padding:10px 12px')}>
              <span style={css('width:30px;height:30px;border-radius:9999px;background:#dbdbdb;color:#333;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center')}>{p.name.slice(0, 1) || '?'}</span>
              <span style={css('flex:1;min-width:0;font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{p.name}</span>
              <span style={css('font-size:12px;color:#8e8e93')}>{ago(p.at)}</span>
              {p.uid === uid && <button aria-label="이 사진 지우기" onClick={() => remove(p)} style={css('font-size:14px;color:#8e8e93;padding:0 4px')}>✕</button>}
            </div>
            <img src={p.photo} alt="" style={css('display:block;width:100%;aspect-ratio:1/1;object-fit:cover;background:#f2f2f2')} />
            {p.caption && <p style={css('margin:8px 12px 0;font-size:14px;line-height:20px;white-space:pre-wrap;word-break:break-word')}><b>{p.name}</b> {p.caption}</p>}
          </article>
        ))}
      </div>

      {sheet && (
        <div onClick={() => !busy && setSheet(false)} style={css('position:absolute;inset:0;z-index:10;background:rgba(0,0,0,0.35);display:flex;align-items:flex-end')}>
          <div onClick={e => e.stopPropagation()} style={css('width:100%;background:#ffffff;border-radius:18px 18px 0 0;padding:16px;display:flex;flex-direction:column;gap:12px;box-sizing:border-box')}>
            <span style={css('font-size:16px;font-weight:700;text-align:center')}>새 게시물</span>
            <button onClick={() => fileRef.current?.click()} style={css('height:44px;border-radius:12px;background:#f2f2f7;font-size:15px;font-weight:600')}>{photo ? '다른 사진 고르기' : '사진 고르기'}</button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => pick(e.target.files?.[0])} />
            {photo && <img src={photo} alt="" style={css('width:100%;max-height:260px;object-fit:contain;border-radius:12px;background:#f2f2f2')} />}
            <textarea value={caption} onChange={e => setCaption(e.target.value)} maxLength={300} placeholder="문구 쓰기" style={css('min-height:64px;padding:10px;border-radius:12px;border:0;background:#f2f2f7;font-size:15px;resize:none;outline:none')} />
            <button disabled={!photo || busy} onClick={share} style={css('height:46px;border-radius:12px;background:#0a84ff;color:#fff;font-size:16px;font-weight:700;opacity:1')}>{busy ? '올리는 중' : '공유'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

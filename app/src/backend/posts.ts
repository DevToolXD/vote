import { Timestamp, addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDocs, increment, limit, onSnapshot, orderBy, query, serverTimestamp, startAfter, updateDoc, writeBatch, type Firestore, type Unsubscribe } from 'firebase/firestore'

// 인스타그램 posts: a photo, a caption, who posted it and when; `likes` is the uids who hearted it,
// `views` how many people kept it open for a few seconds. Comments are a sub-collection. Photos are
// stored in the document (a small JPEG under the 300 KB the rules allow), so only photos are posted.
export type Post = { id: string; uid: string; name: string; photo: string; caption: string; likes: string[]; views: number; comments: number; at: number }
export type PostComment = { id: string; uid: string; name: string; text: string; at: number }

const ms = (t: unknown) => (t as Timestamp | null)?.toMillis?.() ?? Date.now()

const toPost = (d: { id: string; data(): Record<string, unknown> }): Post => {
  const v = d.data() as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  return { id: d.id, uid: v.uid ?? '', name: v.name ?? '', photo: v.photo ?? '', caption: v.caption ?? '', likes: Array.isArray(v.likes) ? v.likes : [], views: v.views ?? 0, comments: Math.max(0, v.comments ?? 0), at: ms(v.at) }
}
/** The photos arrive a page at a time (each one carries its picture, so a long list is a lot of data): the newest page live... */
export const POSTS_PAGE = 12
export function watchPosts(db: Firestore, cb: (posts: Post[]) => void, page = POSTS_PAGE): Unsubscribe {
  return onSnapshot(query(collection(db, 'posts'), orderBy('at', 'desc'), limit(page)), snap => cb(snap.docs.map(toPost)), () => cb([]))
}
/** ...and older pages one at a time, as the list is scrolled towards its end (not live). */
export async function loadOlderPosts(db: Firestore, before: Post, page = POSTS_PAGE): Promise<Post[]> {
  const snap = await getDocs(query(collection(db, 'posts'), orderBy('at', 'desc'), startAfter(Timestamp.fromMillis(before.at)), limit(page)))
  return snap.docs.map(toPost)
}

export const addPost = (db: Firestore, p: { uid: string; name: string; photo: string; caption: string }) =>
  addDoc(collection(db, 'posts'), { ...p, likes: [], views: 0, comments: 0, at: serverTimestamp() })

export const removePost = (db: Firestore, id: string) => deleteDoc(doc(db, 'posts', id))

export const setPostLiked = (db: Firestore, id: string, uid: string, liked: boolean) =>
  updateDoc(doc(db, 'posts', id), { likes: liked ? arrayUnion(uid) : arrayRemove(uid) })

/** A view counts once per person: their view record and the +1 go in one batch (the rules check both). */
export const countPostView = (db: Firestore, id: string, uid: string) => {
  const batch = writeBatch(db)
  batch.set(doc(db, 'posts', id, 'views', uid), { at: serverTimestamp() })
  batch.update(doc(db, 'posts', id), { views: increment(1) })
  return batch.commit()
}

export function watchPostComments(db: Firestore, id: string, cb: (cs: PostComment[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db, 'posts', id, 'comments'), orderBy('at', 'asc'), limit(200)), snap => {
    cb(snap.docs.map(d => {
      const v = d.data()
      return { id: d.id, uid: v.uid ?? '', name: v.name ?? '', text: v.text ?? '', at: ms(v.at) }
    }))
  }, () => cb([]))
}

/** A comment and the post's comment count (+1) in one batch (the rules check the two together). */
export const addPostComment = (db: Firestore, id: string, p: { uid: string; name: string; text: string }) => {
  const batch = writeBatch(db)
  const c = doc(collection(db, 'posts', id, 'comments'))
  batch.set(c, { ...p, at: serverTimestamp() })
  batch.update(doc(db, 'posts', id), { comments: increment(1), lastComment: c.id })
  return batch.commit()
}

/** Removes a comment and takes one off the count (`counted`: the post's count is above 0 — a comment from before counting existed leaves it). */
export const removePostComment = (db: Firestore, id: string, cid: string, counted = true) => {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'posts', id, 'comments', cid))
  if (counted) batch.update(doc(db, 'posts', id), { comments: increment(-1), lastComment: cid })
  return batch.commit()
}

/** A picture from a file, made small to save data for everyone who scrolls past it: up to 800 px, about 100 KB of text at most (the rules allow 300 KB). */
export async function shrinkPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('사진을 읽지 못했어요')); i.src = url })
    // if the JPEG is still over ~100 KB of text, the picture is made smaller and tried again
    let side = Math.min(1, 800 / Math.max(img.width, img.height))
    for (let round = 0; round < 5; round++) {
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(img.width * side)); c.height = Math.max(1, Math.round(img.height * side))
      const ctx = c.getContext('2d')
      if (!ctx) throw new Error('사진을 만들지 못했어요')
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height)
      for (const q of [0.74, 0.62, 0.5, 0.4]) {
        const data = c.toDataURL('image/jpeg', q)
        if (data.length < 100_000) return data
      }
      side *= 0.8
    }
    throw new Error('사진이 너무 커요. 더 작은 사진을 골라 주세요')
  } finally { URL.revokeObjectURL(url) }
}

import { addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, type Firestore, type Timestamp, type Unsubscribe } from 'firebase/firestore'

// 인스타그램 posts: a photo, a caption, who posted it and when. Photos are stored in the document
// (as a small JPEG, under the 300 KB the rules allow), so only photos are posted.
export type Post = { id: string; uid: string; name: string; photo: string; caption: string; at: number }

export function watchPosts(db: Firestore, cb: (posts: Post[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db, 'posts'), orderBy('at', 'desc'), limit(40)), snap => {
    cb(snap.docs.map(d => {
      const v = d.data()
      return { id: d.id, uid: v.uid ?? '', name: v.name ?? '', photo: v.photo ?? '', caption: v.caption ?? '', at: ((v.at as Timestamp | null)?.toMillis?.()) ?? Date.now() }
    }))
  }, () => cb([]))
}

export const addPost = (db: Firestore, p: { uid: string; name: string; photo: string; caption: string }) =>
  addDoc(collection(db, 'posts'), { ...p, at: serverTimestamp() })

export const removePost = (db: Firestore, id: string) => deleteDoc(doc(db, 'posts', id))

/** A picture from a file, shrunk until its JPEG fits the rules (300 KB as base64 text, kept under 280 KB). */
export async function shrinkPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('사진을 읽지 못했어요')); i.src = url })
    const scale = Math.min(1, 1080 / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
    const ctx = c.getContext('2d')
    if (!ctx) throw new Error('사진을 만들지 못했어요')
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height)
    for (const q of [0.85, 0.7, 0.55, 0.4]) {
      const data = c.toDataURL('image/jpeg', q)
      if (data.length < 280_000) return data
    }
    throw new Error('사진이 너무 커요. 더 작은 사진을 골라 주세요')
  } finally { URL.revokeObjectURL(url) }
}

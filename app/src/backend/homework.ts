import { addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, type Firestore, type Timestamp, type Unsubscribe } from 'firebase/firestore'

// 문서 (숙제 공유방): a post is a photo with a title and a caption. `likes` is the list of the uids
// who hearted it (the rules let each person change only their own entry). Comments are a sub-collection.
export type Doc = { id: string; uid: string; title: string; photo: string; caption: string; likes: string[]; at: number }
export type Comment = { id: string; uid: string; name: string; text: string; at: number }

const ms = (t: unknown) => (t as Timestamp | null)?.toMillis?.() ?? Date.now()

export function watchDocs(db: Firestore, cb: (docs: Doc[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db, 'homework'), orderBy('at', 'desc'), limit(40)), snap => {
    cb(snap.docs.map(d => {
      const v = d.data()
      return { id: d.id, uid: v.uid ?? '', title: v.title ?? '', photo: v.photo ?? '', caption: v.caption ?? '', likes: Array.isArray(v.likes) ? v.likes : [], at: ms(v.at) }
    }))
  }, () => cb([]))
}

export const addDocPost = (db: Firestore, p: { uid: string; title: string; photo: string; caption: string }) =>
  addDoc(collection(db, 'homework'), { ...p, likes: [], at: serverTimestamp() })

export const removeDoc = (db: Firestore, id: string) => deleteDoc(doc(db, 'homework', id))

export const setLiked = (db: Firestore, id: string, uid: string, liked: boolean) =>
  updateDoc(doc(db, 'homework', id), { likes: liked ? arrayUnion(uid) : arrayRemove(uid) })

export function watchComments(db: Firestore, id: string, cb: (cs: Comment[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db, 'homework', id, 'comments'), orderBy('at', 'asc'), limit(200)), snap => {
    cb(snap.docs.map(d => {
      const v = d.data()
      return { id: d.id, uid: v.uid ?? '', name: v.name ?? '', text: v.text ?? '', at: ms(v.at) }
    }))
  }, () => cb([]))
}

export const addComment = (db: Firestore, id: string, p: { uid: string; name: string; text: string }) =>
  addDoc(collection(db, 'homework', id, 'comments'), { ...p, at: serverTimestamp() })

export const removeComment = (db: Firestore, id: string, cid: string) => deleteDoc(doc(db, 'homework', id, 'comments', cid))

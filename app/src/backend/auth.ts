import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { DEFAULT_OWNED } from './types'

/** Firebase Auth has no username concept, so a login id becomes `id@vote.local` under the hood. */
const idToEmail = (id: string) => `${id.trim().toLowerCase()}@vote.local`

export const ID_PATTERN = /^[a-zA-Z0-9]{4,20}$/

export function onAuthChange(cb: (user: User | null) => void) {
  if (!auth) { cb(null); return () => {} }
  return onAuthStateChanged(auth, cb)
}

/** Creates the auth account and its matching candidate/leaderboard doc (doc id == uid) in one go. */
export async function signUp(name: string, id: string, pw: string) {
  if (!auth || !db) throw new Error('firebase-not-configured')
  const cred = await createUserWithEmailAndPassword(auth, idToEmail(id), pw)
  await updateProfile(cred.user, { displayName: name })
  await setDoc(doc(db, 'candidates', cred.user.uid), {
    name,
    ownerUid: cred.user.uid,
    up: 0,
    down: 0,
    score: 0,
    gender: '',
    bio: '',
    frame: 'none',
    plate: 'none',
    skin: 'none',
    spent: 0,
    owned: DEFAULT_OWNED,
    createdAt: serverTimestamp(),
  })
  return cred.user
}

export async function logIn(id: string, pw: string) {
  if (!auth) throw new Error('firebase-not-configured')
  await signInWithEmailAndPassword(auth, idToEmail(id), pw)
}

export async function logOut() {
  if (!auth) return
  await signOut(auth)
}

/** Maps Firebase Auth error codes to the 해요체 copy the rest of the UI uses. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code || ''
  switch (code) {
    case 'auth/email-already-in-use': return '이미 사용 중인 아이디예요'
    case 'auth/weak-password': return '비밀번호가 너무 약해요. 6자 이상으로 해주세요'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return '아이디 또는 비밀번호가 올바르지 않아요'
    case 'auth/too-many-requests': return '시도가 많았어요. 잠시 후 다시 해주세요'
    case 'auth/network-request-failed': return '네트워크 연결을 확인해주세요'
    case 'firebase-not-configured': return '아직 서버 연결이 설정되지 않았어요'
    default: return '문제가 생겼어요. 잠시 후 다시 시도해주세요'
  }
}

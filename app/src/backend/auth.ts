import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  setPersistence,
  signInAnonymously,
  signOut,
  updatePassword,
  browserLocalPersistence,
  browserSessionPersistence,
  indexedDBLocalPersistence,
  updateProfile,
  type User,
} from 'firebase/auth'
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { isBanned } from './admin'
import { newCandidateDoc } from './candidateDoc'

/** Firebase Auth has no username concept, so a login id becomes `id@vote.local` under the hood. */
const idToEmail = (id: string) => `${id.trim().toLowerCase()}@vote.local`

export const ID_PATTERN = /^[a-zA-Z0-9]{4,20}$/

export function onAuthChange(cb: (user: User | null) => void) {
  if (!auth) { cb(null); return () => {} }
  return onAuthStateChanged(auth, cb)
}

/**
 * Makes sure the signed-in user has their candidates/{uid} leaderboard doc.
 * Sign-up is two steps (Auth account, then this doc), so if the second step ever
 * failed, the next sign-up or log-in with the same id repairs it instead of leaving
 * an account that can log in but never shows up.
 */
async function ensureCandidateDoc(user: User, name: string) {
  if (!db) throw new Error('firebase-not-configured')
  if (await isBanned(db, user.uid)) {
    await signOut(auth!)
    throw new Error('account-deleted')
  }
  const ref = doc(db, 'candidates', user.uid)
  const loginId = user.email?.endsWith('@vote.local') ? user.email.slice(0, -'@vote.local'.length) : undefined
  const snap = await getDoc(ref)
  if (!snap.exists()) { await setDoc(ref, newCandidateDoc(user.uid, name, loginId)); return }
  // Older accounts: add the login id so it shows on their profile.
  if (loginId && !snap.data().loginId) await updateDoc(ref, { loginId }).catch(() => {})
}

export async function signUp(name: string, id: string, pw: string) {
  if (!auth || !db) throw new Error('firebase-not-configured')
  await setPersistence(auth, indexedDBLocalPersistence).catch(() => setPersistence(auth!, browserLocalPersistence))
  let user: User
  try {
    user = (await createUserWithEmailAndPassword(auth, idToEmail(id), pw)).user
    await updateProfile(user, { displayName: name })
  } catch (e) {
    // Same id + same password as an earlier half-finished sign-up: finish it rather than refusing.
    if ((e as { code?: string })?.code !== 'auth/email-already-in-use') throw e
    try {
      user = (await signInWithEmailAndPassword(auth, idToEmail(id), pw)).user
    } catch {
      throw e
    }
    if (!user.displayName) await updateProfile(user, { displayName: name })
  }
  await ensureCandidateDoc(user, user.displayName || name)
  return user
}

/** `keep` = 로그인 상태 유지: survive closing the app; otherwise only until the tab/app closes. */
export async function logIn(id: string, pw: string, keep = true) {
  if (!auth) throw new Error('firebase-not-configured')
  if (keep) await setPersistence(auth, indexedDBLocalPersistence).catch(() => setPersistence(auth!, browserLocalPersistence))
  else await setPersistence(auth, browserSessionPersistence)
  const { user } = await signInWithEmailAndPassword(auth, idToEmail(id), pw)
  await ensureCandidateDoc(user, user.displayName || id.trim())
}

// The login id (never the password) is remembered on this device to prefill the form.
const SAVED_ID = 'vote.savedId'
export function savedLoginId() {
  try { return localStorage.getItem(SAVED_ID) ?? '' } catch { return '' }
}
export function saveLoginId(id: string) {
  try { if (id) localStorage.setItem(SAVED_ID, id); else localStorage.removeItem(SAVED_ID) } catch { /* private mode */ }
}

export async function logOut() {
  if (!auth) return
  await signOut(auth)
}

/** Maps Firebase Auth/Firestore error codes to the 해요체 copy the rest of the UI uses. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string; message?: string })?.code || (err as Error)?.message || ''
  switch (code) {
    case 'auth/email-already-in-use': return '이미 사용 중인 아이디예요'
    case 'auth/weak-password': return '비밀번호가 너무 약해요. 6자 이상으로 해주세요'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return '아이디 또는 비밀번호가 올바르지 않아요'
    case 'auth/too-many-requests': return '시도가 많았어요. 잠시 후 다시 해주세요'
    case 'auth/network-request-failed':
    case 'unavailable': return '네트워크 연결을 확인해주세요'
    case 'auth/configuration-not-found':
    case 'auth/operation-not-allowed': return '아직 로그인 기능이 켜지지 않았어요 (관리자 설정 필요)'
    case 'permission-denied': return '저장 권한이 없어요 (보안 규칙 확인 필요)'
    case 'firebase-not-configured': return '아직 서버 연결이 설정되지 않았어요'
    case 'account-deleted': return '관리자가 삭제한 계정이에요'
    // Keep the raw code visible so the next unexpected failure can be diagnosed from a screenshot.
    default: return `문제가 생겼어요. 잠시 후 다시 시도해주세요 (${code || 'unknown'})`
  }
}

/** For 상담 without an account: a throwaway anonymous login (not treated as signed in by the app). */
export async function signInForSupport() {
  if (!auth) throw new Error('firebase-not-configured')
  if (auth.currentUser) return auth.currentUser
  return (await signInAnonymously(auth)).user
}

/** A new anonymous login for a new 상담 (the previous one was ended by 상담원). */
export async function restartSupport() {
  if (!auth) throw new Error('firebase-not-configured')
  if (auth.currentUser?.isAnonymous) await signOut(auth)
  return (await signInAnonymously(auth)).user
}

/** After logging in with an admin-issued one-time code: is a new password required? */
export async function needsNewPassword(uid: string) {
  if (!db) return false
  try { return (await getDoc(doc(db, 'pwResets', uid))).data()?.status === 'done' } catch { return false }
}

/** Sets the password the person chose, then clears the reset. */
export async function chooseNewPassword(pw: string) {
  if (!auth?.currentUser || !db) throw new Error('not-signed-in')
  await updatePassword(auth.currentUser, pw)
  await deleteDoc(doc(db, 'pwResets', auth.currentUser.uid)).catch(() => {})
}

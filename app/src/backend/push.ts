import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, type Firestore, type Unsubscribe } from 'firebase/firestore'

// Push notification bookkeeping in Firestore. The sender
// (.github/scripts/send-notifications.mjs) reads these with the service account.

export type NotifySettings = { notify: boolean; notifyMsg: boolean; notifyVote: boolean }
export const DEFAULT_NOTIFY: NotifySettings = { notify: true, notifyMsg: true, notifyVote: true }
export type PushPlatform = 'web' | 'android'

export function subscribeNotifySettings(db: Firestore, uid: string, cb: (s: NotifySettings) => void): Unsubscribe {
  return onSnapshot(doc(db, 'settings', uid), snap => cb({ ...DEFAULT_NOTIFY, ...(snap.data() as Partial<NotifySettings> | undefined) }), () => cb(DEFAULT_NOTIFY))
}

export async function saveNotifySettings(db: Firestore, uid: string, patch: Partial<NotifySettings>) {
  await setDoc(doc(db, 'settings', uid), patch, { merge: true })
}

export async function savePushToken(db: Firestore, uid: string, token: string, platform: PushPlatform) {
  await setDoc(doc(db, 'pushTokens', token), { uid, token, platform, updatedAt: serverTimestamp() })
}

export async function removePushToken(db: Firestore, token: string) {
  await deleteDoc(doc(db, 'pushTokens', token))
}

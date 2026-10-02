import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, type Firestore, type Unsubscribe } from 'firebase/firestore'

// Push notification bookkeeping in Firestore. The sender
// (.github/scripts/send-notifications.mjs) reads these with the service account.

export type NotifySettings = { notify: boolean; notifyMsg: boolean; notifyVote: boolean; notifySound: boolean }
export const DEFAULT_NOTIFY: NotifySettings = { notify: true, notifyMsg: true, notifyVote: true, notifySound: true }
export type PushPlatform = 'web' | 'android'

// Only this person changes their settings, almost always from this device, so they're kept
// on the device and read from the server at most every 12 hours (not on every launch).
const REFRESH_MS = 12 * 60 * 60_000
const cacheKey = (uid: string) => 'pv-notify-' + uid
const watchers = new Map<string, Set<(s: NotifySettings) => void>>()
function cached(uid: string): { s: NotifySettings; at: number } | null {
  try { const c = JSON.parse(localStorage.getItem(cacheKey(uid)) ?? 'null'); return c?.s ? c : null } catch { return null }
}
function store(uid: string, s: NotifySettings, at: number) {
  try { localStorage.setItem(cacheKey(uid), JSON.stringify({ s, at })) } catch { /* private mode */ }
  watchers.get(uid)?.forEach(w => w(s))
}

export function subscribeNotifySettings(db: Firestore, uid: string, cb: (s: NotifySettings) => void): Unsubscribe {
  if (!watchers.has(uid)) watchers.set(uid, new Set())
  watchers.get(uid)!.add(cb)
  const c = cached(uid)
  if (c) cb(c.s)
  if (!c || Date.now() - c.at > REFRESH_MS) {
    getDoc(doc(db, 'settings', uid))
      .then(snap => store(uid, { ...DEFAULT_NOTIFY, ...(snap.data() as Partial<NotifySettings> | undefined) }, Date.now()))
      .catch(() => { if (!c) cb(DEFAULT_NOTIFY) })
  }
  return () => { watchers.get(uid)?.delete(cb) }
}

export async function saveNotifySettings(db: Firestore, uid: string, patch: Partial<NotifySettings>) {
  const before = cached(uid)
  store(uid, { ...DEFAULT_NOTIFY, ...before?.s, ...patch }, before?.at ?? 0)
  try { await setDoc(doc(db, 'settings', uid), patch, { merge: true }) } catch (e) { if (before) store(uid, before.s, before.at); throw e }
}

export async function savePushToken(db: Firestore, uid: string, token: string, platform: PushPlatform) {
  await setDoc(doc(db, 'pushTokens', token), { uid, token, platform, updatedAt: serverTimestamp() })
}

export async function removePushToken(db: Firestore, token: string) {
  await deleteDoc(doc(db, 'pushTokens', token))
}

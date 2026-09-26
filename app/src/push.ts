import type { Firestore } from 'firebase/firestore'
import { app } from './firebase'
import { removePushToken, savePushToken, type PushPlatform } from './backend/push'
import { isInstalledApp } from './install'

// Registers this device for push notifications.
//  - Galaxy app (Capacitor shell): native FCM via @capacitor/push-notifications.
//  - Browsers / home-screen apps: Web Push through Firebase Cloud Messaging. On
//    iPhone this only works in the app added to the home screen (iOS 16.4+).
// The token goes to pushTokens/{token}; the sender workflow does the rest.

export type PushSupport = 'native' | 'web' | 'ios-install' | 'none'

type Cap = { isNativePlatform?: () => boolean }
const capacitor = () => (window as unknown as { Capacitor?: Cap }).Capacitor
const isNative = () => !!capacitor()?.isNativePlatform?.()

export function pushSupport(): PushSupport {
  if (isNative()) return 'native'
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
  if (ios && !isInstalledApp()) return 'ios-install'
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) return 'web'
  return 'none'
}

const TOKEN_KEY = 'vote.pushToken', SAVED_AT = 'vote.pushTokenAt'
const savedToken = () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } }
const savedAt = () => { try { return Number(localStorage.getItem(SAVED_AT) || 0) } catch { return 0 } }
const remember = (t: string | null) => {
  try {
    if (t) { localStorage.setItem(TOKEN_KEY, t); localStorage.setItem(SAVED_AT, String(Date.now())) }
    else { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(SAVED_AT) }
  } catch { /* private mode */ }
}

/** Is this device currently registered (as far as this device knows)? */
export const deviceRegistered = () => !!savedToken()

async function webToken(): Promise<string> {
  if (Notification.permission === 'denied') throw new Error('push-permission-denied')
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('push-permission-denied')
  const reg = await navigator.serviceWorker.register('sw.js')
  await navigator.serviceWorker.ready
  const { getMessaging, getToken } = await import('firebase/messaging')
  // No vapidKey: Firebase's default Web Push key, so no extra console setup.
  return getToken(getMessaging(app!), { serviceWorkerRegistration: reg })
}

async function nativeToken(): Promise<string> {
  const { PushNotifications } = await import('@capacitor/push-notifications')
  let perm = await PushNotifications.checkPermissions()
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') perm = await PushNotifications.requestPermissions()
  if (perm.receive !== 'granted') throw new Error('push-permission-denied')
  // High importance = shows as a heads-up popup like a messenger app, with sound and vibration.
  await PushNotifications.createChannel({ id: 'messages', name: '메시지', description: '새 메시지', importance: 5, visibility: 1, vibration: true, lights: true }).catch(() => {})
  await PushNotifications.createChannel({ id: 'votes', name: '받은 투표', description: '받은 추천·비추천', importance: 4, visibility: 1, vibration: true }).catch(() => {})
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('push-register-timeout')), 15000)
    PushNotifications.addListener('registration', t => { clearTimeout(timer); resolve(t.value) })
    PushNotifications.addListener('registrationError', e => { clearTimeout(timer); reject(new Error('push-register-failed: ' + (e?.error ?? ''))) })
    PushNotifications.register().catch(e => { clearTimeout(timer); reject(e) })
  })
}

/**
 * Asks for permission (must run from a tap) and registers this device for `uid`.
 * `quiet` (app launch): skip the Firestore write when the token is unchanged and was
 * saved within a week — the worker holds every token in memory, so each write costs a read.
 */
export async function enablePush(db: Firestore, uid: string, quiet = false) {
  const support = pushSupport()
  if (support !== 'web' && support !== 'native') throw new Error('push-unsupported')
  const token = support === 'native' ? await nativeToken() : await webToken()
  const platform: PushPlatform = support === 'native' ? 'android' : 'web'
  const old = savedToken()
  if (quiet && old === token && Date.now() - savedAt() < 7 * 86_400_000) return
  if (old && old !== token) await removePushToken(db, old).catch(() => {})
  await savePushToken(db, uid, token, platform)
  remember(token)
}

/** Unregisters this device (e.g. on 알림 끄기 or logout). */
export async function disablePush(db: Firestore) {
  const token = savedToken()
  remember(null)
  if (token) await removePushToken(db, token).catch(() => {})
  if (pushSupport() === 'web') {
    try { const { getMessaging, deleteToken } = await import('firebase/messaging'); await deleteToken(getMessaging(app!)) } catch { /* not registered */ }
  }
}

/** Keeps the stored token fresh for a registered device (tokens can rotate). */
export async function refreshPush(db: Firestore, uid: string) {
  if (!deviceRegistered()) return
  const support = pushSupport()
  if (support === 'web' && Notification.permission !== 'granted') return
  try { await enablePush(db, uid, true) } catch { /* try again next launch */ }
}

export function pushErrorMessage(e: unknown) {
  const m = (e as Error)?.message ?? ''
  if (m.includes('permission-denied') || m.includes('permission-blocked')) return '알림 권한이 꺼져 있어요. 휴대폰 설정에서 이 앱의 알림을 허용해주세요'
  if (m.includes('unsupported')) return '이 브라우저에서는 알림을 받을 수 없어요'
  return '알림을 켜지 못했어요 (' + (m || 'unknown') + ')'
}

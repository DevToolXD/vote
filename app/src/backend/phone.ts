import { onValue, ref, set, type Unsubscribe } from 'firebase/database'
import type { Firestore } from 'firebase/firestore'
import { R } from './messages'

// 폰 (the 폰 tab): the apps on the home screen.
//   phone/catalog/{app}     true | false — the admin (관리) switches an app off for everyone; missing = on
//   phone/{uid}/apps/{app}  true | false — set from 앱스토어; missing = installed (the default)
// 관리 (admin only) and 앱스토어 are always there, so they are never stored.

export type StoreApp = 'shop' | 'market' | 'coin'
export type AppId = StoreApp | 'admin' | 'store'
/** Apps that open a screen (앱스토어 opens inside 폰 itself). */
export type OpenableApp = Exclude<AppId, 'store'>

export const STORE_APPS: StoreApp[] = ['shop', 'market', 'coin']
export const APP_NAME: Record<AppId, string> = { admin: '관리', store: '앱스토어', shop: '상점', market: '당근마켓', coin: '코인' }
/** 앱스토어 sections: 당근마켓 is filed under 상점. */
export const APP_GROUPS: { title: string; apps: StoreApp[] }[] = [
  { title: '상점', apps: ['shop', 'market'] },
  { title: '투자', apps: ['coin'] },
]
export const APP_DESC: Record<StoreApp, string> = {
  shop: '포인트로 프레임, 이름표, 막대 스킨을 사요',
  market: '가진 아이템을 사람들과 사고팔아요',
  coin: '실제 시세로 코인을 사고팔아요',
}

export type PhoneState = { mine: Partial<Record<StoreApp, boolean>>; catalog: Partial<Record<StoreApp, boolean>> }

/** The catalog (everyone) and my installs (when signed in), live. */
export function watchPhone(db: Firestore, uid: string | null, cb: (s: PhoneState) => void): Unsubscribe {
  let s: PhoneState = { mine: {}, catalog: {} }
  const stops: Unsubscribe[] = [onValue(ref(R(db), 'phone/catalog'), v => { s = { ...s, catalog: v.val() ?? {} }; cb(s) }, () => {})]
  if (uid) stops.push(onValue(ref(R(db), `phone/${uid}/apps`), v => { s = { ...s, mine: v.val() ?? {} }; cb(s) }, () => {}))
  cb(s)
  return () => stops.forEach(f => f())
}

/** Installed on my phone (the default is installed). */
export const isInstalled = (s: PhoneState, app: StoreApp) => s.mine[app] ?? true
/** On the home screen: installed, and not switched off for everyone. */
export const onHome = (s: PhoneState, app: StoreApp) => isInstalled(s, app) && s.catalog[app] !== false

export const setInstalled = (db: Firestore, uid: string, app: StoreApp, on: boolean) => set(ref(R(db), `phone/${uid}/apps/${app}`), on)
export const setCatalog = (db: Firestore, app: StoreApp, on: boolean) => set(ref(R(db), `phone/catalog/${app}`), on)

// Home-screen / APK install helpers for the "앱 설치하기" sheet.

/** Always the newest Android build — .github/workflows/android-apk.yml re-uploads it to this release. */
export const APK_URL = 'https://github.com/DevToolXD/vote/releases/download/android-latest/popular-vote.apk'

export type Platform = 'ios' | 'android' | 'other'

export function detectPlatform(): Platform {
  const ua = navigator.userAgent
  // iPadOS reports itself as a Mac; the touch points give it away.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'other'
}

/** Mobile Safari itself, not Chrome/Kakao/Naver/etc. on iOS — only Safari offers "홈 화면에 추가". */
export function isIosSafari() {
  const ua = navigator.userAgent
  return detectPlatform() === 'ios' && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\//i.test(ua)
}

/** Already running as the installed app (home-screen PWA or the Android APK). */
export function isInstalledApp() {
  return window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    'Capacitor' in window
}

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()

// Android Chrome fires this when the site is installable; keep it so a button can trigger the native dialog later.
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault()
  deferred = e as InstallPromptEvent
  listeners.forEach(l => l())
})

export const canPromptInstall = () => !!deferred
export function onInstallPromptChange(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb) } }

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const ev = deferred
  deferred = null
  await ev.prompt()
  listeners.forEach(l => l())
  return (await ev.userChoice).outcome === 'accepted'
}

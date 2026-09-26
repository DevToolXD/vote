import { initializeApp } from 'firebase/app'
import { connectDatabaseEmulator, getDatabase, goOffline, goOnline } from 'firebase/database'
import { browserLocalPersistence, browserSessionPersistence, connectAuthEmulator, indexedDBLocalPersistence, initializeAuth } from 'firebase/auth'
import { setChatDatabase } from './backend/messages'
import { connectFirestoreEmulator, disableNetwork, enableNetwork, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  // Chat lives in the Realtime Database (default instance, Singapore).
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || `https://${import.meta.env.VITE_FIREBASE_PROJECT_ID}-default-rtdb.asia-southeast1.firebasedatabase.app`,
}

/** True once all required VITE_FIREBASE_* build-time env vars are present. */
export const firebaseConfigured = Object.entries(config).every(([k, v]) => k === 'databaseURL' || Boolean(v))

export const app = firebaseConfigured ? initializeApp(config) : null
// Stay logged in across app restarts: IndexedDB first, localStorage where IndexedDB
// isn't available (some in-app browsers / WebViews). Session-only is listed too so
// a "로그인 상태 유지" off login is found again after a reload in the same tab.
export const auth = app ? initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence] }) : null
// On-device cache (IndexedDB): the app opens instantly from what it saw last, and a
// listener that reconnects within 30 minutes only downloads what changed — each doc
// Firestore sends counts toward the free daily read limit. Falls back to memory
// where IndexedDB isn't available.
export const db = app ? initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }) : null

export const rtdb = app ? getDatabase(app) : null
if (db && rtdb) setChatDatabase(db, rtdb)

// Local end-to-end testing only (VITE_USE_EMULATORS=1 at build time): talk to the Firebase emulators.
if (import.meta.env.VITE_USE_EMULATORS && auth && db && rtdb) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8181)
  connectDatabaseEmulator(rtdb, '127.0.0.1', 9000)
}

// In the background (another app, screen off) live updates would still arrive — and each
// changed doc counts as a read — though nobody is looking. After a minute out of sight the
// connection pauses; coming back resumes it and brings only what changed meanwhile (each
// doc once, however many times it changed). Writes made meanwhile wait and then go out.
if (db && typeof document !== 'undefined') {
  let pause: ReturnType<typeof setTimeout> | undefined
  let paused = false
  document.addEventListener('visibilitychange', () => {
    clearTimeout(pause)
    // (The Realtime Database connection too: the free plan allows 100 at once.)
    if (document.visibilityState === 'hidden') pause = setTimeout(() => { paused = true; disableNetwork(db!).catch(() => {}); if (rtdb) goOffline(rtdb) }, 60_000)
    else if (paused) { paused = false; enableNetwork(db!).catch(() => {}); if (rtdb) goOnline(rtdb) }
  })
}

import { initializeApp } from 'firebase/app'
import { browserLocalPersistence, browserSessionPersistence, connectAuthEmulator, indexedDBLocalPersistence, initializeAuth } from 'firebase/auth'
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/** True once all required VITE_FIREBASE_* build-time env vars are present. */
export const firebaseConfigured = Object.values(config).every(Boolean)

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

// Local end-to-end testing only (VITE_USE_EMULATORS=1 at build time): talk to the Firebase emulators.
if (import.meta.env.VITE_USE_EMULATORS && auth && db) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8181)
}

import { doc, getDoc, getDocs, collection, deleteField, onSnapshot, serverTimestamp, setDoc, type Firestore, type Unsubscribe } from 'firebase/firestore'
import { runAdminOp, type AdminProgress } from './admin'

// 중복 가입 방지 / IP 차단. Firebase can't see a visitor's address (no server code on the
// free plan), so the app asks a public "what's my IP" service and keeps:
//   ips/{ip}      { uid?: first account seen on it, blocked?: true }   — anyone can get one by id
//   userIps/{uid} { ip, at }                                          — last address, admin-only
// A claimed address can't make another account; a blocked one never gets past loading.
// It's a deterrent, not a wall: a VPN or other network gets around it.

export type IpDoc = { uid?: string; blocked?: boolean }

const IP_RE = /^[0-9a-fA-F.:]{3,45}$/
export const validIp = (ip: string) => IP_RE.test(ip)

let cached: Promise<string | null> | null = null

async function fetchIp(url: string, pick: (body: string) => string) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 5000)
  try {
    const r = await fetch(url, { cache: 'no-store', signal: ctl.signal })
    if (!r.ok) return null
    const ip = pick(await r.text()).trim()
    return validIp(ip) ? ip : null
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

/** This device's public IPv4 address (null when it can't be found). */
export function myIp(): Promise<string | null> {
  if (import.meta.env.VITE_USE_EMULATORS) {
    // local tests pick the address (each test browser gets its own otherwise)
    let ip: string | null = null
    try {
      ip = localStorage.getItem('test-ip')
      if (!ip) localStorage.setItem('test-ip', (ip = `10.${Math.random() * 256 | 0}.${Math.random() * 256 | 0}.${Math.random() * 256 | 0}`))
    } catch { /* */ }
    return Promise.resolve(ip && validIp(ip) ? ip : null)
  }
  cached ??= (async () =>
    (await fetchIp('https://api.ipify.org?format=json', b => JSON.parse(b).ip ?? ''))
    ?? (await fetchIp('https://ipv4.icanhazip.com', b => b)))()
  const p = cached
  // a failed lookup is tried again next time
  p.then(ip => { if (!ip && cached === p) cached = null })
  return p
}

export async function readIp(db: Firestore, ip: string): Promise<IpDoc | null> {
  const s = await getDoc(doc(db, 'ips', ip))
  return s.exists() ? (s.data() as IpDoc) : null
}

export function watchIp(db: Firestore, ip: string, cb: (d: IpDoc | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'ips', ip), s => cb(s.exists() ? (s.data() as IpDoc) : null), () => cb(null))
}

/**
 * Records the address as this account's last one. A visit claims an address nobody has
 * used yet; `signup` claims it even after the admin freed it (가입 제한 풀기) — a visit
 * never takes a freed address back.
 */
export async function recordIp(db: Firestore, uid: string, ip: string, current: IpDoc | null, signup = false) {
  const key = 'ip-seen'
  const claim = signup || current === null
  let seen = ''
  try { seen = localStorage.getItem(key) ?? '' } catch { /* */ }
  if (seen === uid + '|' + ip && !claim) return
  await setDoc(doc(db, 'userIps', uid), { ip, at: serverTimestamp() })
  if (claim) await setDoc(doc(db, 'ips', ip), { uid, at: serverTimestamp() }, { merge: true })
  try { localStorage.setItem(key, uid + '|' + ip) } catch { /* */ }
}

/** Admin: someone's last address. */
export async function lastIpOf(db: Firestore, uid: string): Promise<string | null> {
  const s = await getDoc(doc(db, 'userIps', uid))
  return s.exists() ? (s.data().ip as string) : null
}

/** Admin: every blocked address. */
export async function blockedIps(db: Firestore): Promise<{ ip: string; uid?: string }[]> {
  const s = await getDocs(collection(db, 'ips'))
  return s.docs.filter(d => d.data().blocked === true).map(d => ({ ip: d.id, uid: d.data().uid as string | undefined }))
}

export type IpOp = 'block' | 'unblock' | 'release'

/** Admin: 차단 / 차단 풀기 / 가입 제한 풀기 (lets one more account be made from it). */
export async function setIp(db: Firestore, adminUid: string, ip: string, op: IpOp, onProgress?: (p: AdminProgress) => void) {
  if (!validIp(ip)) throw new Error('invalid-ip')
  const patch = op === 'block' ? { blocked: true } : op === 'unblock' ? { blocked: deleteField() } : { uid: deleteField() }
  await runAdminOp(db, adminUid, 'ipSet', { ip, op }, [
    b => { b.set(doc(db, 'ips', ip), patch, { merge: true }); return 1 },
  ], onProgress)
}

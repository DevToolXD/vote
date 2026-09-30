import { arrayUnion, doc, getDoc, getDocs, collection, deleteField, onSnapshot, query, serverTimestamp, where, writeBatch, type Firestore, type Unsubscribe, type WriteBatch } from 'firebase/firestore'
import { runAdminOp, type AdminProgress } from './admin'

// 중복 가입 방지 / IP 차단. Firebase can't see a visitor's address (no server code on the
// free plan), so the app asks a public "what's my IP" service and keeps:
//   ips/{ip}      { uid?: first account seen on it, blocked?: true }   — anyone can get one by id
//   userIps/{uid} { ip, at, ips: [..], blocked?: true }               — admin-only
// A claimed address can't make another account. 접속 차단 (admin, from a profile) blocks the
// account and every address it used: they never get past loading.
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

/** userIps/{uid}: every address the account was used from (up to 20) and the admin's 접속 차단. */
export type Access = { ips: string[]; blocked: boolean; last?: string }
const MAX_IPS = 20

export function watchAccess(db: Firestore, uid: string, cb: (a: Access) => void): Unsubscribe {
  return onSnapshot(doc(db, 'userIps', uid), s => cb({ ips: (s.data()?.ips as string[] | undefined) ?? [], blocked: s.data()?.blocked === true, last: s.data()?.ip as string | undefined }), () => cb({ ips: [], blocked: false }))
}

/**
 * Adds the address to the account's list. A visit claims an address nobody has used yet;
 * `signup` claims it even after the admin freed it (가입 제한 풀기) — a visit never takes a
 * freed address back.
 */
export async function recordIp(db: Firestore, uid: string, ip: string, current: IpDoc | null, known: string[], signup = false, last?: string) {
  const room = known.includes(ip) || known.length < MAX_IPS
  // a claim needs the address in the account's own list (firestore.rules: claimsOwnIp)
  const claim = (signup || current === null) && room
  // already recorded (in the list, or as the last one once the list is full): nothing to write
  if ((known.includes(ip) || last === ip) && !claim) return
  const b = writeBatch(db)
  b.set(doc(db, 'userIps', uid), { ip, at: serverTimestamp(), ...(room ? { ips: arrayUnion(ip) } : {}) }, { merge: true })
  if (claim) b.set(doc(db, 'ips', ip), { uid, at: serverTimestamp() }, { merge: true })
  await b.commit()
}

/** Admin: the addresses someone used and whether they're blocked. */
export async function accessOf(db: Firestore, uid: string): Promise<Access> {
  const s = await getDoc(doc(db, 'userIps', uid))
  return { ips: (s.data()?.ips as string[] | undefined) ?? (s.data()?.ip ? [s.data()!.ip as string] : []), blocked: s.data()?.blocked === true }
}

/** Admin: everyone under 접속 차단. */
export async function blockedUsers(db: Firestore): Promise<string[]> {
  const s = await getDocs(query(collection(db, 'userIps'), where('blocked', '==', true)))
  return s.docs.map(d => d.id)
}

export type IpOp = 'block' | 'unblock' | 'release'

/**
 * Admin, from someone's profile: 접속 차단 / 차단 풀기 (the account and every address it used)
 * or 가입 제한 풀기 (its addresses can make one more account).
 */
export async function setAccess(db: Firestore, adminUid: string, target: string, op: IpOp, onProgress?: (p: AdminProgress) => void) {
  const { ips } = await accessOf(db, target)
  const list = ips.filter(validIp).slice(0, MAX_IPS)
  const patch = op === 'block' ? { blocked: true } : op === 'unblock' ? { blocked: deleteField() } : { uid: deleteField() }
  await runAdminOp(db, adminUid, 'ipSet', { target, ips: list, op }, [
    ...(op === 'release' ? [] : [(b: WriteBatch) => { b.set(doc(db, 'userIps', target), { blocked: patch.blocked }, { merge: true }); return 1 }]),
    ...list.map(ip => (b: WriteBatch) => { b.set(doc(db, 'ips', ip), patch, { merge: true }); return 1 }),
  ], onProgress)
}

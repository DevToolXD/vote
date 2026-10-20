// Read-only diagnostics: what happened to the admin's account deletions (deletions/*), the last admin lock, and recent bans.
import { call, getAccessToken, loadServiceAccount, notice, warn } from './lib/google.mjs'

const key = loadServiceAccount()
const root = `https://firestore.googleapis.com/v1/projects/${key.project_id}/databases/(default)/documents`
const H = { Authorization: `Bearer ${await getAccessToken(key)}` }
const plain = f => Object.fromEntries(Object.entries(f ?? {}).map(([k, v]) => [k, v.stringValue ?? v.timestampValue ?? v.integerValue ?? v.booleanValue ?? JSON.stringify(v).slice(0, 80)]))

const list = async (col, size = 50) => {
  const r = await call(`${root}/${col}?pageSize=${size}`, { headers: H })
  if (!r.ok) { warn(`${col}: ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`); return [] }
  return r.json.documents ?? []
}
const dels = await list('deletions')
notice(`deletions: ${dels.length} docs`)
for (const d of dels) notice(`deletion ${d.name.split('/').pop()} ${JSON.stringify(plain(d.fields))}`)
const lock = await call(`${root}/meta/adminLock`, { headers: H })
notice(`adminLock ${lock.ok ? JSON.stringify(plain(lock.json.fields)) : lock.status}`)
const banned = await list('banned', 20)
for (const b of banned) notice(`banned ${b.name.split('/').pop()} ${JSON.stringify(plain(b.fields))}`)
const tokens = await list('adminTokens', 20)
notice(`adminTokens (first 20): ${tokens.length}, used=${tokens.filter(t => t.fields?.used?.booleanValue).length}, actions=${[...new Set(tokens.map(t => t.fields?.action?.stringValue))].join(',')}`)

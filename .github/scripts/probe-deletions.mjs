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
for (const b of banned.slice(0,0)) notice(`banned ${b.name.split('/').pop()} ${JSON.stringify(plain(b.fields))}`)
const tokens = await list('adminTokens', 20)
notice(`adminTokens (first 20): ${tokens.length}, used=${tokens.filter(t => t.fields?.used?.booleanValue).length}, actions=${[...new Set(tokens.map(t => t.fields?.action?.stringValue))].join(',')}`)

// ---- what is still there for each deleted account? ----
const project = key.project_id
const rtdbUrl = `https://${project}-default-rtdb.asia-southeast1.firebasedatabase.app`
const rtToken = await getAccessToken(key, 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/firebase.database')
const rt = async path => (await call(`${rtdbUrl}/${path}.json`, { headers: { Authorization: `Bearer ${rtToken}` } })).json
const count = async (col, field, id) => {
  const r = await call(`${root}:runQuery`, { method: 'POST', headers: H, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: col, allDescendants: col === 'comments' }], where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: id } } }, limit: 50 } }) })
  return r.ok ? (r.json.filter(x => x.document).length) : `err${r.status}`
}
const ids = [...new Set([...dels.map(d => d.name.split('/').pop()), ...banned.map(b => b.name.split('/').pop())])]
const boardRt = await rt('board/rows')
const boardFs = await call(`${root}/meta/board`, { headers: H })
const fsRows = (boardFs.json?.fields?.rows?.arrayValue?.values ?? []).map(v => v.mapValue?.fields?.id?.stringValue)
warn(`board: RTDB rows ${Object.keys(boardRt ?? {}).length}, Firestore rows ${fsRows.length}`)
for (const id of ids.slice(0, 8)) {
  const cand = await call(`${root}/candidates/${id}`, { headers: H })
  const lk = await call(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`, { method: 'POST', headers: H, body: JSON.stringify({ localId: [id] }) })
  const parts = {
    candidate: cand.ok, rtBoardRow: !!(boardRt && boardRt[id]), fsBoardRow: fsRows.includes(id), authUser: !!lk.json?.users?.length,
    votesBy: await count('votes', 'uid', id), votesFor: await count('votes', 'candidateId', id), posts: await count('posts', 'uid', id), songs: await count('songs', 'uid', id),
    homework: await count('homework', 'uid', id), comments: await count('comments', 'uid', id),
    wallet: !!(await rt(`wallets/${id}`)), userChats: !!(await rt(`userChats/${id}`)), ledger: !!(await rt(`ledger/${id}`)),
  }
  warn(`leftovers ${id}: ${JSON.stringify(parts)}`)
}
const season = await call(`${root}/meta/season`, { headers: H })
warn(`season.last.top ids: ${JSON.stringify((season.json?.fields?.last?.mapValue?.fields?.top?.arrayValue?.values ?? []).map(v => v.mapValue?.fields?.id?.stringValue))}`)

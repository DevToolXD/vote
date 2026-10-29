// Read-only diagnostics (run by .github/workflows/probe.yml): how account deletions went and what is left of the deleted people.
// GitHub cuts long workflow messages, so the output goes out as several short annotations (at most 10 per step).
import { call, getAccessToken, loadServiceAccount, warn as warn1 } from './lib/google.mjs'

const key = loadServiceAccount()
const root = `https://firestore.googleapis.com/v1/projects/${key.project_id}/databases/(default)/documents`
const H = { Authorization: `Bearer ${await getAccessToken(key)}` }
const lines = []
const say = m => lines.push(m)
const plain = f => Object.fromEntries(Object.entries(f ?? {}).map(([k, v]) => [k, v.stringValue ?? v.timestampValue ?? v.integerValue ?? v.booleanValue ?? '…']))
const list = async (col, size = 300) => (await call(`${root}/${col}?pageSize=${size}`, { headers: H })).json?.documents ?? []
const count = async (col, field, id) => {
  const r = await call(`${root}:runQuery`, { method: 'POST', headers: H, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: col, allDescendants: col === 'comments' }], where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: id } } }, limit: 50 } }) })
  return r.ok ? r.json.filter(x => x.document).length : `error ${r.status}`
}

const dels = await list('deletions')
say(`deletions: ${dels.length}`)
for (const d of dels) {
  const f = plain(d.fields)
  const took = f.doneAt && f.at ? `${((Date.parse(f.doneAt) - Date.parse(f.at)) / 1000).toFixed(1)} s` : '?'
  say(`deletion ${d.name.split('/').pop().slice(0, 8)} ${f.status} took ${took}${f.error ? ' error: ' + f.error.slice(0, 80) : ''}${f.leftovers ? ' leftovers: ' + f.leftovers : ''} at ${f.at ?? '?'}`)
}
const smoke = await call(`${root}/meta/smokeDeletion`, { headers: H })
say(`smoke test deletion: ${smoke.json?.fields?.ms?.integerValue ?? '?'} ms (last run ${smoke.json?.fields?.at?.timestampValue ?? '?'})`)

const banned = await list('banned')
const open = banned.filter(b => !b.fields?.wiped?.booleanValue)
say(`banned: ${banned.length} accounts, ${open.length} without the clean-up mark`)
for (const b of banned.slice(0, 60)) {
  const id = b.name.split('/').pop()
  const v = await count('votes', 'uid', id)
  if (v || !b.fields?.wiped?.booleanValue) say(`banned ${id.slice(0, 8)}: wiped=${!!b.fields?.wiped?.booleanValue} login gone=${!!b.fields?.authDeleted?.booleanValue} votes left=${v}`)
}

const cg = await call(`${root}:runQuery`, { method: 'POST', headers: H, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'comments', allDescendants: true }], where: { fieldFilter: { field: { fieldPath: 'uid' }, op: 'EQUAL', value: { stringValue: 'nobody' } } }, limit: 1 } }) })
say(`comments index: ${cg.ok ? 'on' : 'off (' + (cg.json?.[0]?.error?.status ?? cg.status) + ')'}`)
for (const col of ['posts', 'homework']) {
  const r = await call(`${root}:runQuery`, { method: 'POST', headers: H, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: col }], select: { fields: [{ fieldPath: '__name__' }] } } }) })
  say(`${col}: ${r.ok ? r.json.filter(x => x.document).length : 'error ' + r.status} documents`)
}

const rtdbUrl = `https://${key.project_id}-default-rtdb.asia-southeast1.firebasedatabase.app`
const rtToken = await getAccessToken(key, 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/firebase.database')
const rt = async path => (await call(`${rtdbUrl}/${path}.json`, { headers: { Authorization: `Bearer ${rtToken}` } })).json
const rows = await rt('board/rows')
const fsBoard = await call(`${root}/meta/board`, { headers: H })
say(`board: live ${Object.keys(rows ?? {}).length} rows, stored ${(fsBoard.json?.fields?.rows?.arrayValue?.values ?? []).length} rows`)

// the output: short pieces, so that none is cut
const text = lines.join('\n')
const pieces = text.match(/[\s\S]{1,900}/g) ?? []
for (const p of pieces.slice(0, 10)) warn1(p.replace(/\n/g, '%0A'))
if (pieces.length > 10) warn1(`(${pieces.length - 10} more pieces were not shown)`)

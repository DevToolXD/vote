// Idempotent migration of vote docs to the current shape:
//   { season, ups, downs, weekAt, weekKind }  (one vote a week, changeable within the week)
// from any older shape:
//   v3 { season, ups, downs, lastUpAt, lastDownAt } — week = the later of the two

//   v1 { value: -1|0|1 }                       — before weekly voting
//   v2 { season, ups, lastUpAt, down, downSeason } — weekly 추천, one-time 비추천
// Candidate tallies already include these votes, so they're kept as this
// season's. Where the time of a past 비추천 isn't recorded, its doc's updatedAt
// stands in (starting its 7-day timer then). Runs with admin credentials.

import { call, fail, getAccessToken, loadServiceAccount, notice } from './lib/google.mjs'

const key = loadServiceAccount()
const root = `https://firestore.googleapis.com/v1/projects/${key.project_id}/databases/(default)/documents`
const headers = { Authorization: `Bearer ${await getAccessToken(key)}`, 'Content-Type': 'application/json' }

const season = await call(`${root}/meta/season`, { headers })
const cur = Number(season.ok ? season.json.fields?.number?.integerValue ?? 1 : 1)
const int = n => ({ integerValue: String(n) })
const time = t => (t ? { timestampValue: t } : { nullValue: null })

let pageToken = '', migrated = 0, seen = 0
do {
  const r = await call(`${root}/votes?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`, { headers })
  if (!r.ok) fail(`Listing votes failed (${r.status})`, r.json)
  for (const d of r.json.documents ?? []) {
    seen++
    const f = d.fields ?? {}
    if (f.weekKind) continue // already current
    const at = f.updatedAt?.timestampValue ?? new Date().toISOString()
    let fields, drop
    if (f.downs && (f.lastUpAt || f.lastDownAt)) {
      const up = f.lastUpAt?.timestampValue ?? null, down = f.lastDownAt?.timestampValue ?? null
      const latestUp = up && (!down || up >= down)
      fields = { weekAt: time(latestUp ? up : down), weekKind: { stringValue: up || down ? (latestUp ? 'up' : 'down') : 'none' } }
      drop = ['lastUpAt', 'lastDownAt']
    } else if (f.value) {
      const value = Number(f.value.integerValue ?? 0)
      fields = { season: int(cur), ups: int(value === 1 ? 1 : 0), downs: int(value === -1 ? 1 : 0), weekAt: time(value ? at : null), weekKind: { stringValue: value === 1 ? 'up' : value === -1 ? 'down' : 'none' } }
      drop = ['value']
    } else if (f.down) {
      const vSeason = Number(f.season?.integerValue ?? cur)
      const downed = f.down.booleanValue === true
      const downsThisSeason = downed && Number(f.downSeason?.integerValue ?? 0) === vSeason ? 1 : 0
      const upAt = f.lastUpAt?.timestampValue ?? null
      const latestUp = upAt && (!downed || upAt >= at)
      fields = { downs: int(downsThisSeason), weekAt: time(latestUp ? upAt : downed ? at : null), weekKind: { stringValue: latestUp ? 'up' : downed ? 'down' : 'none' } }
      drop = ['down', 'downSeason', 'lastUpAt']
    } else continue
    // Fields in the mask but not in the body get removed.
    const mask = [...Object.keys(fields), ...drop].map(k => `updateMask.fieldPaths=${k}`).join('&')
    const u = await call(`https://firestore.googleapis.com/v1/${d.name}?${mask}`, { method: 'PATCH', headers, body: JSON.stringify({ fields }) })
    if (!u.ok) fail(`Migrating ${d.name} failed (${u.status})`, u.json)
    migrated++
  }
  pageToken = r.json.nextPageToken ?? ''
} while (pageToken)

notice(`Votes: ${seen} checked, ${migrated} migrated (one vote a week, changeable within the week).`)

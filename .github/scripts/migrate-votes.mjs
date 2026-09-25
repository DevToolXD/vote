// Idempotent migration of vote docs to the current shape:
//   { season, ups, downs, lastUpAt, lastDownAt }  (추천 and 비추천 each every 7 days)
// from either older shape:
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
    if (f.downs) continue // already current
    const at = f.updatedAt?.timestampValue ?? new Date().toISOString()
    let fields, drop
    if (f.value) {
      const value = Number(f.value.integerValue ?? 0)
      fields = { season: int(cur), ups: int(value === 1 ? 1 : 0), downs: int(value === -1 ? 1 : 0), lastUpAt: time(value === 1 ? at : null), lastDownAt: time(value === -1 ? at : null) }
      drop = ['value']
    } else if (f.down) {
      const vSeason = Number(f.season?.integerValue ?? cur)
      const downed = f.down.booleanValue === true
      const downsThisSeason = downed && Number(f.downSeason?.integerValue ?? 0) === vSeason ? 1 : 0
      fields = { downs: int(downsThisSeason), lastDownAt: time(downed ? at : null) }
      drop = ['down', 'downSeason']
    } else continue
    // Fields in the mask but not in the body get removed.
    const mask = [...Object.keys(fields), ...drop].map(k => `updateMask.fieldPaths=${k}`).join('&')
    const u = await call(`https://firestore.googleapis.com/v1/${d.name}?${mask}`, { method: 'PATCH', headers, body: JSON.stringify({ fields }) })
    if (!u.ok) fail(`Migrating ${d.name} failed (${u.status})`, u.json)
    migrated++
  }
  pageToken = r.json.nextPageToken ?? ''
} while (pageToken)

notice(`Votes: ${seen} checked, ${migrated} migrated (추천·비추천 each every 7 days).`)

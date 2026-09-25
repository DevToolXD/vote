// One-time (idempotent) migration of vote docs from the old { value: -1|0|1 }
// shape to the weekly-추천 shape { season, ups, lastUpAt, down, downSeason }.
// The candidate tallies already include these votes, so they're marked as this
// season's: a recommendation becomes ups 1 (its 7-day timer starting at its last
// update), a not-recommend becomes the one-time 비추천. Runs with admin
// credentials (rules don't apply); docs already in the new shape are skipped.

import { call, fail, getAccessToken, loadServiceAccount, notice } from './lib/google.mjs'

const key = loadServiceAccount()
const root = `https://firestore.googleapis.com/v1/projects/${key.project_id}/databases/(default)/documents`
const headers = { Authorization: `Bearer ${await getAccessToken(key)}`, 'Content-Type': 'application/json' }

const season = await call(`${root}/meta/season`, { headers })
const cur = season.ok ? Number(season.json.fields?.number?.integerValue ?? 1) : 1

let pageToken = '', migrated = 0, seen = 0
do {
  const r = await call(`${root}/votes?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`, { headers })
  if (!r.ok) fail(`Listing votes failed (${r.status})`, r.json)
  for (const d of r.json.documents ?? []) {
    seen++
    const f = d.fields ?? {}
    if (!f.value || f.ups) continue
    const value = Number(f.value.integerValue ?? 0)
    const at = f.updatedAt?.timestampValue ?? new Date().toISOString()
    const fields = {
      season: { integerValue: String(cur) },
      ups: { integerValue: value === 1 ? '1' : '0' },
      lastUpAt: value === 1 ? { timestampValue: at } : { nullValue: null },
      down: { booleanValue: value === -1 },
      downSeason: { integerValue: value === -1 ? String(cur) : '0' },
    }
    const mask = [...Object.keys(fields), 'value'].map(k => `updateMask.fieldPaths=${k}`).join('&')
    // `value` is in the mask but not in the body, so it gets removed.
    const u = await call(`https://firestore.googleapis.com/v1/${d.name}?${mask}`, { method: 'PATCH', headers, body: JSON.stringify({ fields }) })
    if (!u.ok) fail(`Migrating ${d.name} failed (${u.status})`, u.json)
    migrated++
  }
  pageToken = r.json.nextPageToken ?? ''
} while (pageToken)

notice(`Votes: ${seen} checked, ${migrated} migrated to the weekly-추천 format.`)

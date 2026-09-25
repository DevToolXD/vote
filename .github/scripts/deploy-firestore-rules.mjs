// Deploys firestore.rules via the Firebase Rules REST API: create a ruleset,
// point the `cloud.firestore` release at it, then read it back and compare with
// the local file. Uses the raw API rather than `firebase deploy`, because the
// CLI's pre-flight check needs a broader IAM role than the default Admin SDK
// service account has.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { call, fail, getAccessToken, loadServiceAccount, notice } from './lib/google.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const rulesContent = fs.readFileSync(path.join(here, '..', '..', 'firestore.rules'), 'utf8')

const key = loadServiceAccount()
const projectId = key.project_id
const auth = { Authorization: `Bearer ${await getAccessToken(key)}`, 'Content-Type': 'application/json' }
const api = 'https://firebaserules.googleapis.com/v1'

const releaseName = `projects/${projectId}/releases/cloud.firestore`

// Hourly re-deploys (from the worker) skip when the live rules already match.
if (process.env.SKIP_IF_SAME) {
  const cur = await call(`${api}/${releaseName}`, { headers: auth })
  const curSet = cur.ok ? await call(`${api}/${cur.json.rulesetName}`, { headers: auth }) : null
  if (curSet?.json?.source?.files?.[0]?.content === rulesContent) {
    notice(`Firestore rules already up to date (${cur.json.rulesetName}).`)
    process.exit(0)
  }
}

const rs = await call(`${api}/projects/${projectId}/rulesets`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content: rulesContent }] } }),
})
if (!rs.ok) fail(`Creating ruleset failed (${rs.status}).`, rs.json)

let rel = await call(`${api}/${releaseName}`, {
  method: 'PATCH',
  headers: auth,
  body: JSON.stringify({ release: { name: releaseName, rulesetName: rs.json.name } }),
})
if (!rel.ok) {
  rel = await call(`${api}/projects/${projectId}/releases`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ name: releaseName, rulesetName: rs.json.name }),
  })
}
if (!rel.ok) fail(`Updating the release failed (${rel.status}).`, rel.json)

const live = await call(`${api}/${rel.json.rulesetName}`, { headers: auth })
if (live.json.source?.files?.[0]?.content !== rulesContent) {
  fail('Deployed, but the live ruleset content does not match firestore.rules.')
}
notice(`Firestore rules deployed and verified (${rel.json.rulesetName}).`)

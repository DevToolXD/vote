// Deploys firestore.rules to Firebase directly via the Firebase Rules REST API,
// authenticated as a service account (JWT bearer flow — no firebase-tools, no
// interactive `firebase login`). Run by .github/workflows/firestore-rules.yml
// whenever firestore.rules changes on main.
//
// Needs env FIREBASE_SERVICE_ACCOUNT: the full service account JSON (as a string).
// Generate one at:
//   https://console.firebase.google.com/project/<project>/settings/serviceaccounts/adminsdk
// and put its contents in the FIREBASE_SERVICE_ACCOUNT repository secret.

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const here = path.dirname(fileURLToPath(import.meta.url))
const rulesPath = path.join(here, '..', '..', 'firestore.rules')

function fail(msg, extra) {
  console.error('::error::' + msg, extra ?? '')
  process.exit(1)
}

const raw = process.env.FIREBASE_SERVICE_ACCOUNT
if (!raw) fail('FIREBASE_SERVICE_ACCOUNT env var is not set (add it as a repository secret).')

let key
try {
  key = JSON.parse(raw)
} catch {
  fail('FIREBASE_SERVICE_ACCOUNT is not valid JSON.')
}

const rulesContent = fs.readFileSync(rulesPath, 'utf8')
const projectId = key.project_id

const b64url = obj => Buffer.from(JSON.stringify(obj)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const unsigned = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url({
  iss: key.client_email,
  scope: 'https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/cloud-platform',
  aud: key.token_uri,
  exp: now + 3600,
  iat: now,
})}`
const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(key.private_key).toString('base64url')
const jwt = `${unsigned}.${signature}`

const tokenRes = await fetch(key.token_uri, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
})
const tokenJson = await tokenRes.json()
if (!tokenJson.access_token) fail('Could not get an access token.', tokenJson)
const auth = { Authorization: `Bearer ${tokenJson.access_token}`, 'Content-Type': 'application/json' }
console.log('Authenticated as', key.client_email)

const rsRes = await fetch(`https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content: rulesContent }] } }),
})
const rsJson = await rsRes.json()
if (!rsRes.ok) fail(`Creating ruleset failed (${rsRes.status}).`, rsJson)
console.log('Created ruleset:', rsJson.name)

const releaseName = `projects/${projectId}/releases/cloud.firestore`
let relRes = await fetch(`https://firebaserules.googleapis.com/v1/${releaseName}`, {
  method: 'PATCH',
  headers: auth,
  body: JSON.stringify({ release: { name: releaseName, rulesetName: rsJson.name } }),
})
let relJson = await relRes.json()
if (!relRes.ok) {
  console.log(`PATCH failed (${relRes.status}), trying to create the release instead.`, relJson)
  relRes = await fetch(`https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ name: releaseName, rulesetName: rsJson.name }),
  })
  relJson = await relRes.json()
}
if (!relRes.ok) fail(`Updating the release failed (${relRes.status}).`, relJson)
console.log('Release now points at the new ruleset:', relJson.rulesetName)

// Read the live rules back and diff against the local file, so a silent mismatch fails loudly.
const verifyRes = await fetch(`https://firebaserules.googleapis.com/v1/${relJson.rulesetName}`, { headers: auth })
const verifyJson = await verifyRes.json()
const live = verifyJson.source?.files?.[0]?.content
if (live !== rulesContent) fail('Deployed, but the live ruleset content does not match firestore.rules — investigate.')
console.log('Verified: live Firestore rules match firestore.rules exactly. ✅')

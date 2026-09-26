// Realtime Database for chat (messages, chat lists, presence): billed by bandwidth, not
// per document read, so a busy group chat no longer eats Firestore's 50,000 reads a day.
// Makes sure the project's default instance exists (asia-southeast1, closest to Korea;
// approved by the project owner) and deploys database.rules.json, then reads it back.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { call, fail, getAccessToken, loadServiceAccount, notice } from './lib/google.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const rules = fs.readFileSync(path.join(here, '..', '..', 'database.rules.json'), 'utf8')
const key = loadServiceAccount()
const project = key.project_id
const mgmt = { Authorization: `Bearer ${await getAccessToken(key)}`, 'Content-Type': 'application/json' }
const base = `https://firebasedatabase.googleapis.com/v1beta/projects/${project}/locations`

let list = await call(`${base}/-/instances`, { headers: mgmt })
if (list.status === 403 && JSON.stringify(list.json).includes('has not been used')) {
  // The management API is off in new projects: turn it on (Service Usage API), then wait for it.
  const en = await call(`https://serviceusage.googleapis.com/v1/projects/${project}/services/firebasedatabase.googleapis.com:enable`, { method: 'POST', headers: mgmt, body: '{}' })
  if (!en.ok) fail(`Turning on the Realtime Database Management API failed (${en.status}).`, en.json)
  notice('Turned on the Realtime Database Management API; waiting for it…')
  for (let i = 0; i < 20 && !list.ok; i++) { await new Promise(r => setTimeout(r, 15_000)); list = await call(`${base}/-/instances`, { headers: mgmt }) }
}
if (!list.ok) fail(`Listing Realtime Database instances failed (${list.status}).`, list.json)
let inst = (list.json.instances ?? []).find(i => i.type === 'DEFAULT_DATABASE')
if (!inst) {
  const c = await call(`${base}/asia-southeast1/instances?databaseId=${project}-default-rtdb`, { method: 'POST', headers: mgmt, body: JSON.stringify({ type: 'DEFAULT_DATABASE' }) })
  if (!c.ok) fail(`Creating the Realtime Database failed (${c.status}).`, c.json)
  inst = c.json
  notice(`Created the Realtime Database: ${inst.databaseUrl}`)
}
const url = inst.databaseUrl
notice(`Realtime Database: ${url} (${inst.state ?? 'ACTIVE'})`)

const token = await getAccessToken(key, 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/firebase.database')
const put = await call(`${url}/.settings/rules.json`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: rules })
if (!put.ok) fail(`Deploying database.rules.json failed (${put.status}).`, put.json)
const back = await call(`${url}/.settings/rules.json`, { headers: { Authorization: `Bearer ${token}` } })
if (!back.ok || JSON.stringify(back.json) !== JSON.stringify(JSON.parse(rules))) fail('The deployed Realtime Database rules differ from database.rules.json.', back.json)
notice('Realtime Database rules deployed and verified.')
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `url=${url}\n`)

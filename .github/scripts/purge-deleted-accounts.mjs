// Deletes the Firebase Auth login of every account the admin deleted in the app
// (banned/{uid}). The app can remove the leaderboard entry and block re-joining,
// but only admin credentials can delete another user's login.

import { call, fail, getAccessToken, loadServiceAccount, notice } from './lib/google.mjs'

const key = loadServiceAccount()
const projectId = key.project_id
const auth = { Authorization: `Bearer ${await getAccessToken(key)}`, 'Content-Type': 'application/json' }
const fsRoot = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`

const list = await call(`${fsRoot}/banned?pageSize=300`, { headers: auth })
if (!list.ok) fail(`Listing banned accounts failed (${list.status}).`, list.json)
const pending = (list.json.documents || []).filter(d => !d.fields?.authDeleted?.booleanValue).map(d => d.name.split('/').pop())
if (!pending.length) { notice('No deleted accounts waiting for login removal.'); process.exit(0) }

const del = await call(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:batchDelete`, {
  method: 'POST', headers: auth, body: JSON.stringify({ localIds: pending, force: true }),
})
if (!del.ok) fail(`Deleting logins failed (${del.status}).`, del.json)
const errored = new Set((del.json.errors || []).map(e => pending[e.index]))
for (const uid of pending.filter(u => !errored.has(u))) {
  await call(`${fsRoot}/banned/${uid}?updateMask.fieldPaths=authDeleted`, {
    method: 'PATCH', headers: auth, body: JSON.stringify({ fields: { authDeleted: { booleanValue: true } } }),
  })
}
if (errored.size) fail(`Could not delete ${errored.size} login(s): ${[...errored].join(', ')}`, del.json.errors)
notice(`Removed ${pending.length} deleted account login(s).`)

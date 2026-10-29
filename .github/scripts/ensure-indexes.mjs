// Makes a person's comments findable across every post and 문서 (a query over all `comments` subcollections by uid), which
// deleting an account needs. Firestore doesn't index a field across a collection group by default, so that query fails
// (FAILED_PRECONDITION) without this. Safe to run every time: it only changes the field's index settings when they're missing.
import { call, getAccessToken, loadServiceAccount, notice, warn } from './lib/google.mjs'

const key = loadServiceAccount()
const project = key.project_id
const H = { Authorization: `Bearer ${await getAccessToken(key)}`, 'Content-Type': 'application/json' }
const root = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`
const field = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/collectionGroups/comments/fields/uid`
const sleep = ms => new Promise(r => setTimeout(r, ms))

// The same query the deletion makes; it works once the index is there.
const works = async () => (await call(`${root}:runQuery`, { method: 'POST', headers: H, body: JSON.stringify({ structuredQuery: {
  from: [{ collectionId: 'comments', allDescendants: true }],
  where: { fieldFilter: { field: { fieldPath: 'uid' }, op: 'EQUAL', value: { stringValue: 'nobody' } } }, limit: 1,
} }) })).ok

if (await works()) notice('Comments are findable by person (index is on).')
else {
  const set = await call(`${field}?updateMask=indexConfig`, { method: 'PATCH', headers: H, body: JSON.stringify({ indexConfig: { indexes: [
    { queryScope: 'COLLECTION', fields: [{ fieldPath: 'uid', order: 'ASCENDING' }] },
    { queryScope: 'COLLECTION', fields: [{ fieldPath: 'uid', order: 'DESCENDING' }] },
    { queryScope: 'COLLECTION_GROUP', fields: [{ fieldPath: 'uid', order: 'ASCENDING' }] },
  ] } }) })
  if (!set.ok) warn(`Turning on the comments index failed (${set.status}): ${JSON.stringify(set.json).slice(0, 300)}`)
  for (let i = 0; i < 30 && !(await works()); i++) await sleep(5000)
  if (await works()) notice('Comments are findable by person now (index turned on).')
  else warn('The comments index is still building; deleting an account will fail until it is ready (it is retried).')
}

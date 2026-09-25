// End-to-end check of the live backend, run as two throwaway users over the
// same REST APIs the web SDK uses, so security rules are really enforced:
//   sign up → create leaderboard doc → vote for someone else → tally updated,
// plus the things that must be refused (self-vote, editing someone else's
// profile, inflating a tally). Every test doc and account is deleted at the end.

import { call, fail, getAccessToken, loadServiceAccount, notice, warn } from './lib/google.mjs'

const apiKey = process.env.FIREBASE_API_KEY
if (!apiKey) fail('FIREBASE_API_KEY env var is not set.')
const key = loadServiceAccount()
const projectId = key.project_id
const dbRoot = `projects/${projectId}/databases/(default)/documents`
const fsApi = 'https://firestore.googleapis.com/v1'

// JS value → Firestore REST value.
function fv(v) {
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return { integerValue: String(v) }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fv) } }
  return { mapValue: { fields: fields(v) } }
}
const fields = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fv(v)]))
const bearer = token => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' })

async function signUp(label) {
  const email = `smoketest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${label}@vote.local`
  const r = await call(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'smoke-test-pw-123', returnSecureToken: true }),
  })
  // Throw rather than fail(): process.exit would skip the cleanup in `finally`.
  if (!check(r.ok, `Test user ${label} signed up`, `Sign-up for test user ${label} failed (${r.status})`, r.json)) throw 0
  return { uid: r.json.localId, token: r.json.idToken, email }
}

async function signIn(email) {
  const r = await call(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'smoke-test-pw-123', returnSecureToken: true }),
  })
  if (!check(r.ok, `Signed in again as ${email}`, `Re-sign-in failed (${r.status})`, r.json)) throw 0
  return r.json.idToken
}
const withServerTime = (w, ...fieldsNow) => ({ ...w, updateTransforms: fieldsNow.map(f => ({ fieldPath: f, setToServerValue: 'REQUEST_TIME' })) })
const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('')

const candidate = (uid, name) => ({
  name, ownerUid: uid, up: 0, down: 0, score: 0, gender: '', bio: '', photoURL: '',
  frame: 'none', plate: 'none', skin: 'none', spent: 0,
  owned: { frame: ['none'], plate: ['none'], skin: ['none'] }, createdAt: new Date(),
})
const commit = (token, writes) => call(`${fsApi}/${dbRoot}:commit`, { method: 'POST', headers: bearer(token), body: JSON.stringify({ writes }) })
const update = (path, data, mask) => ({
  update: { name: `${dbRoot}/${path}`, fields: fields(data) },
  ...(mask ? { updateMask: { fieldPaths: mask } } : {}),
})

const users = []
const docs = []
let failed = null
const check = (cond, okMsg, badMsg, extra) => {
  if (cond) notice('✓ ' + okMsg)
  else { failed = badMsg; console.log('::error::' + badMsg + (extra ? ' ' + JSON.stringify(extra) : '')) }
  return cond
}

try {
  const a = await signUp('a'); users.push(a)
  const b = await signUp('b'); users.push(b)
  notice('✓ Sign-up works (Firebase Auth, Email/Password)')

  for (const [u, n] of [[a, 'Smoke A'], [b, 'Smoke B']]) {
    const r = await call(`${fsApi}/${dbRoot}/candidates?documentId=${u.uid}`, { method: 'POST', headers: bearer(u.token), body: JSON.stringify({ fields: fields(candidate(u.uid, n)) }) })
    docs.push(`candidates/${u.uid}`)
    if (!check(r.ok, `User can create their own leaderboard doc (${n})`, `Creating the leaderboard doc was refused (${r.status}) — sign-up would fail in the app`, r.json)) throw 0
  }

  // B recommends A: same two writes the app's castVote() transaction makes.
  const seasonDoc = await call(`${fsApi}/${dbRoot}/meta/season?key=${apiKey}`)
  const season = seasonDoc.ok ? Number(seasonDoc.json.fields?.number?.integerValue ?? 1) : 1
  const upVote = (voter, cand, ups) => withServerTime(update(`votes/${voter}_${cand}`, { uid: voter, candidateId: cand, season, ups, down: false, downSeason: 0 }), 'lastUpAt', 'updatedAt')
  docs.push(`votes/${b.uid}_${a.uid}`)
  const vote = await commit(b.token, [
    update(`candidates/${a.uid}`, { up: 1, down: 0, score: 1 }, ['up', 'down', 'score']),
    upVote(b.uid, a.uid, 1),
  ])
  if (!check(vote.ok, 'Voting for someone else works', `Voting was refused (${vote.status})`, vote.json)) throw 0
  const again = await commit(b.token, [
    update(`candidates/${a.uid}`, { up: 2, down: 0, score: 2 }, ['up', 'down', 'score']),
    upVote(b.uid, a.uid, 2),
  ])
  check(again.status === 403, 'A second 추천 within 7 days is refused', `A second 추천 within 7 days was NOT refused (${again.status})`)

  const readA = await call(`${fsApi}/${dbRoot}/candidates/${a.uid}?key=${apiKey}`)
  check(readA.ok && readA.json.fields?.up?.integerValue === '1' && readA.json.fields?.score?.integerValue === '1',
    'Leaderboard is publicly readable and shows the vote', 'Reading the tally back did not show the vote', readA.json)

  docs.push(`votes/${a.uid}_${a.uid}`)
  const selfVote = await commit(a.token, [update(`candidates/${a.uid}`, { up: 2, down: 0, score: 2 }, ['up', 'down', 'score']), upVote(a.uid, a.uid, 1)])
  check(selfVote.status === 403, 'Self-voting is refused', `Self-voting was NOT refused (${selfVote.status})`)

  const editOther = await commit(b.token, [update(`candidates/${a.uid}`, { bio: 'hacked' }, ['bio'])])
  check(editOther.status === 403, "Editing someone else's profile is refused", `Editing someone else's profile was NOT refused (${editOther.status})`)

  const inflate = await commit(b.token, [update(`candidates/${a.uid}`, { up: 50, down: 0, score: 50 }, ['up', 'down', 'score'])])
  check(inflate.status === 403, 'Inflating a tally is refused', `Inflating a tally was NOT refused (${inflate.status})`)

  const bump = await commit(b.token, [update(`candidates/${a.uid}`, { up: 2, down: 0, score: 2 }, ['up', 'down', 'score'])])
  check(bump.status === 403, 'A tally can’t move without a matching vote', `A tally moved without a vote (${bump.status})`)

  // ---- admin protocol on the live database: 3 single-use tokens, then one batch ----
  const payload = { target: a.uid, amount: 50 }
  const tokenDoc = (uid, seq) => ({ uid, action: 'grantPoints', payload, seq, used: false })
  const plain = await commit(b.token, [withServerTime(update(`adminTokens/${randomId()}`, tokenDoc(b.uid, 1)), 'createdAt')])
  check(plain.status === 403, 'Regular users can’t issue admin tokens', `A regular user issued an admin token (${plain.status})`)

  const adm = await signUp('admin'); users.push(adm)
  const setClaim = await call(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`, {
    method: 'POST', headers: bearer(await getAccessToken(key)), body: JSON.stringify({ localId: adm.uid, customAttributes: JSON.stringify({ admin: true }) }),
  })
  if (!check(setClaim.ok, 'Test admin got the admin claim', `Setting the admin claim failed (${setClaim.status})`, setClaim.json)) throw 0
  adm.token = await signIn(adm.email)

  const tokens = []
  for (const seq of [1, 2, 3]) {
    const id = randomId(); tokens.push(id); docs.push(`adminTokens/${id}`)
    const r = await commit(adm.token, [{ ...withServerTime(update(`adminTokens/${id}`, tokenDoc(adm.uid, seq)), 'createdAt'), currentDocument: { exists: false } }])
    const back = await call(`${fsApi}/${dbRoot}/adminTokens/${id}`, { headers: bearer(adm.token) })
    if (!check(r.ok && back.json.fields?.used?.booleanValue === false && back.json.fields?.seq?.integerValue === String(seq),
      `Admin token ${seq}/3 issued and verified`, `Admin token ${seq} failed (${r.status}/${back.status})`, r.json)) throw 0
  }
  docs.push('meta/adminLock')
  const grantWrites = () => [
    withServerTime(update('meta/adminLock', { by: adm.uid, action: 'grantPoints', payload, tokens }), 'at'),
    ...tokens.map(t => update(`adminTokens/${t}`, { used: true }, ['used'])),
    update(`candidates/${a.uid}`, { bonus: 50 }, ['bonus']),
  ]
  const grant = await commit(adm.token, grantWrites())
  if (!check(grant.ok, 'Admin grant with 3 tokens goes through', `Admin grant was refused (${grant.status})`, grant.json)) throw 0
  const aAfter = await call(`${fsApi}/${dbRoot}/candidates/${a.uid}?key=${apiKey}`)
  check(aAfter.json.fields?.bonus?.integerValue === '50', 'Granted points landed', 'Granted points missing', aAfter.json.fields?.bonus)
  const replay = await commit(adm.token, grantWrites())
  check(replay.status === 403, 'Replaying used tokens is refused', `Replaying used tokens was NOT refused (${replay.status})`)
} catch (e) {
  if (e !== 0) { failed = String(e); console.log('::error::Smoke test crashed: ' + e) }
} finally {
  // Admin credentials bypass security rules, which is what lets us remove docs the rules won't let users delete.
  const admin = bearer(await getAccessToken(key))
  const leftovers = []
  for (const d of docs) {
    const r = await call(`${fsApi}/${dbRoot}/${d}`, { method: 'DELETE', headers: admin })
    if (!r.ok && r.status !== 404) leftovers.push(`${d} (${r.status})`)
  }
  for (const u of users) {
    const r = await call(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: u.token }) })
    if (!r.ok) leftovers.push(`auth user ${u.uid} (${r.status})`)
  }
  if (leftovers.length) warn('Could not clean up: ' + leftovers.join(', '))
  else notice('✓ Test users and docs cleaned up')
}

if (failed) fail('Smoke test failed: ' + failed)
notice('All backend checks passed.')

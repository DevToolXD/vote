// Shared helpers for the Firebase CI scripts: service-account auth (JWT bearer
// flow, no firebase-tools) and GitHub Actions log annotations. Annotations show
// up in the run summary and via the check-runs API, not just in raw logs.

import crypto from 'crypto'

export function notice(msg) { console.log('::notice::' + msg) }
export function warn(msg) { console.log('::warning::' + msg) }
export function fail(msg, extra) {
  console.log('::error::' + msg + (extra ? ' ' + JSON.stringify(extra) : ''))
  process.exit(1)
}

/** Parses the FIREBASE_SERVICE_ACCOUNT secret (full service account JSON). */
export function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) fail('FIREBASE_SERVICE_ACCOUNT env var is not set (add it as a repository secret).')
  try {
    return JSON.parse(raw)
  } catch {
    fail('FIREBASE_SERVICE_ACCOUNT is not valid JSON.')
  }
}

export async function getAccessToken(key) {
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
  const res = await fetch(key.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
  })
  const json = await res.json()
  if (!json.access_token) fail('Could not get an access token for the service account.', json)
  return json.access_token
}

/** fetch() that returns { ok, status, json } and never throws on a non-JSON body. */
export async function call(url, init = {}) {
  const res = await fetch(url, init)
  const text = await res.text()
  let json
  try { json = text ? JSON.parse(text) : {} } catch { json = { raw: text.slice(0, 300) } }
  return { ok: res.ok, status: res.status, json }
}

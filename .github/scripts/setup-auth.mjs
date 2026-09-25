// Makes sure Firebase Authentication is ready for the app: Email/Password sign-in
// on, and the GitHub Pages domain in the authorized-domains list.
//
// It can't do the very first "Get started" click in the console. That step
// creates the Auth config, and the API that does it programmatically
// (identityPlatform:initializeAuth) upgrades the project to Identity Platform,
// which needs billing. If Auth was never started, this fails with a message
// saying exactly that.

import { call, fail, getAccessToken, loadServiceAccount, notice } from './lib/google.mjs'

const key = loadServiceAccount()
const projectId = key.project_id
const auth = { Authorization: `Bearer ${await getAccessToken(key)}`, 'Content-Type': 'application/json' }
const configUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`

const cfg = await call(configUrl, { headers: auth })
if (!cfg.ok) {
  if (JSON.stringify(cfg.json).includes('CONFIGURATION_NOT_FOUND')) {
    fail(`Firebase Authentication has never been started for ${projectId}. Open https://console.firebase.google.com/project/${projectId}/authentication and click "Get started" once, then re-run.`)
  }
  fail(`Reading the Auth config failed (${cfg.status}).`, cfg.json)
}

const pagesDomain = `${(process.env.GITHUB_REPOSITORY_OWNER || '').toLowerCase()}.github.io`
const email = cfg.json.signIn?.email || {}
const domains = cfg.json.authorizedDomains || []
const mask = []
const patch = {}
if (!email.enabled || !email.passwordRequired) {
  mask.push('signIn.email.enabled', 'signIn.email.passwordRequired')
  patch.signIn = { email: { enabled: true, passwordRequired: true } }
}
if (pagesDomain !== '.github.io' && !domains.includes(pagesDomain)) {
  mask.push('authorizedDomains')
  patch.authorizedDomains = [...domains, pagesDomain]
}

if (mask.length) {
  const up = await call(`${configUrl}?updateMask=${mask.join(',')}`, { method: 'PATCH', headers: auth, body: JSON.stringify(patch) })
  if (!up.ok) fail(`Updating the Auth config failed (${up.status}).`, up.json)
}

const after = (await call(configUrl, { headers: auth })).json
if (!after.signIn?.email?.enabled || !after.signIn?.email?.passwordRequired) fail('Email/Password sign-in is still not enabled after the update.')
notice(`Auth ready: Email/Password on; authorized domains = ${(after.authorizedDomains || []).join(', ')}`)

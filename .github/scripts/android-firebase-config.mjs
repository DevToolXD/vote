// Gets google-services.json for the Galaxy app (package io.github.devtoolxd.vote)
// so it can receive push notifications: registers the Android app in the
// Firebase project if it isn't yet, then downloads its config. Without it the
// APK still builds; it just can't get notifications (the workflow warns).

import fs from 'fs'
import { call, getAccessToken, loadServiceAccount, notice, warn } from './lib/google.mjs'

const PACKAGE = 'io.github.devtoolxd.vote'
const out = process.argv[2] || 'android/app/google-services.json'
const key = loadServiceAccount()
const base = `https://firebase.googleapis.com/v1beta1/projects/${key.project_id}`
const headers = { Authorization: `Bearer ${await getAccessToken(key)}`, 'Content-Type': 'application/json' }

const giveUp = (msg, r) => { warn(`${msg} (${r?.status ?? ''}) — the APK will build without push notifications. ${JSON.stringify(r?.json ?? '').slice(0, 300)}`); process.exit(0) }

const list = await call(`${base}/androidApps?pageSize=100`, { headers })
if (!list.ok) giveUp('Listing Firebase Android apps failed', list)
let app = (list.json.apps ?? []).find(a => a.packageName === PACKAGE)
if (!app) {
  const op = await call(`${base}/androidApps`, { method: 'POST', headers, body: JSON.stringify({ packageName: PACKAGE, displayName: '인기투표 (Android)' }) })
  if (!op.ok) giveUp('Registering the Android app in Firebase failed', op)
  let done = op.json
  for (let i = 0; i < 30 && !done.done; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const r = await call(`https://firebase.googleapis.com/v1beta1/${op.json.name}`, { headers })
    if (!r.ok) giveUp('Waiting for the Android app registration failed', r)
    done = r.json
  }
  if (!done.done || done.error) giveUp('Android app registration did not finish', { json: done })
  app = done.response
  notice(`Registered the Android app in Firebase (${app.appId}).`)
}
const cfg = await call(`${base}/androidApps/${app.appId}/config`, { headers })
if (!cfg.ok) giveUp('Downloading google-services.json failed', cfg)
fs.writeFileSync(out, Buffer.from(cfg.json.configFileContents, 'base64'))
notice(`google-services.json ready for ${PACKAGE} — push notifications enabled in the APK.`)

# 인기투표 (Popular Vote) — app

React + TypeScript + Vite build of `project/Popular Vote v2.dc.html` (Claude Design handoff), backed by **Firebase** (Auth + Firestore) so accounts, votes, the leaderboard and the point shop are real and shared across everyone who opens the site.

- Signing up creates a Firebase Auth account **and** a leaderboard entry for that person — every registered voter is also a candidate others can vote on (that's how the point shop, "받은 추천 1개가 1P", makes sense).
- Voting, the shop, and profile edits (bio/gender/frame/nameplate/bar skin) are stored in Firestore and update live for everyone.
- Login uses an "아이디" (username), not email — under the hood it's Firebase Auth email/password with `id@vote.local` as a synthetic email.
- Profile photos are stored too, but not via Firebase Storage (see "Known trade-offs" — that now needs the paid Blaze plan). Instead the client shrinks the photo to a small square JPEG and saves it as a data URL directly on the candidate doc, so it persists and everyone can see it, no billing required.
- There's no seed/mock data. A fresh Firebase project starts with an empty leaderboard; it fills up as real people sign up.

## Set up Firebase (one-time)

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com) (free Spark plan is enough).
2. **Build → Authentication → Get started** (don't skip this — until it's clicked, every sign-up fails with `CONFIGURATION_NOT_FOUND`). Then **Sign-in method → Email/Password → Enable**, or leave that part to the workflow below, which turns it on for you.
3. **Build → Firestore Database → Create database** (production mode, any region).
4. In Firestore's **Rules** tab, paste the contents of `../firestore.rules` (repo root) and **Publish**. This enforces: candidates are public to read, a voter can only edit their own profile fields, vote tallies can only move by one valid step per write, and nobody can vote for themselves.

   **Or automate it:** generate a service account key (Project settings → **Service accounts** → **Generate new private key**), add its full JSON content as a repository secret named `FIREBASE_SERVICE_ACCOUNT`, and `.github/workflows/firebase-backend.yml` will, on every push to `main` that touches `firestore.rules`, `.github/scripts/**` or `app/src/backend/**`: deploy the rules, make sure Email/Password sign-in is on (and `<owner>.github.io` is an authorized domain), then run an end-to-end smoke test as two throwaway users — sign up, save a leaderboard doc, vote, and confirm self-votes / editing others / inflating tallies are refused — deleting everything it created afterwards. Results appear as annotations on the workflow run. It calls the Firebase Rules API directly (`.github/scripts/deploy-firestore-rules.mjs`) rather than the `firebase` CLI, since the CLI's own pre-flight check needs a broader IAM role than the default Admin SDK service account has. Use a key generated just for this (repository secrets are encrypted at rest, but treat a service account key like a password — don't reuse one you've shared elsewhere, and delete/rotate it from that same Service accounts page if you ever suspect it leaked).
5. **Project settings → General → Your apps → Web (`</>`)** to register a web app, then copy the `firebaseConfig` values.
6. Add those 6 values as **repository secrets** (Settings → Secrets and variables → Actions → New repository secret) using these exact names — `.github/workflows/publish-app.yml` injects them at build time:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

   (These are public client identifiers, not sensitive secrets — using GitHub *secrets* here is just a convenient place to keep build config, not for confidentiality. Firestore security comes entirely from the rules in step 4.)
7. Push anything to `app/**` on `main` (or re-run the workflow manually from the Actions tab — `Publish app to GitHub Pages` → `Run workflow`) to rebuild with the new config. Until these are set, the deployed site shows a "Firebase 설정이 필요해요" notice instead of crashing.

For local dev, copy `.env.example` to `.env.local` and fill in the same values (it's git-ignored).

## Install as an app

The Home tab has an **앱 설치하기** card (hidden when already running as an app) that opens a sheet with two tabs:

- **아이폰**: steps for Safari's 홈 화면에 추가. The site is a PWA (`public/manifest.webmanifest`, icons in `public/icons/`, a no-cache `public/sw.js`), so it opens full-screen with its own icon. Apple doesn't allow installing apps from outside the App Store, so this is the free option on iPhone.
- **갤럭시**: a download button for `popular-vote.apk` from the `android-latest` GitHub release, plus Chrome's own "add to home screen" when available. `.github/workflows/android-apk.yml` builds it: a Capacitor shell (`capacitor.config.json`) that loads the live site, so site updates reach the app without a new APK. It only rebuilds when the shell changes (config, `android-res/` icons, `package.json`).

The APK is debug-signed with a key generated per CI run, so it's fine for sideloading, but a rebuilt APK can't install over an older one (uninstall first). Since the app shows the live site, that rarely matters. For stable signing (or the Play Store), add a release keystore as a secret and switch the build to `assembleRelease`.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
```

Preview options: `?tab=home|acct|rank`, `?palette=swap` (red 추천 / blue 비추천).

## Layout

- `src/firebase.ts`: Firebase app/auth/db init from `VITE_FIREBASE_*` env vars
- `src/backend/auth.ts`: sign up / log in / log out, id↔email mapping, Korean error messages
- `src/backend/candidates.ts`: live leaderboard + my-votes subscriptions, vote transaction, shop purchase/equip, profile update
- `src/model.ts`: maps Firestore rows + my votes into the `Person` shape the screens render
- `src/App.tsx`: auth state, tab routing, overlays
- `src/components/`: screens (`HomeScreen`, `RankScreen`, `AccountScreen`), `Overlays` (vote/profile/theme sheets, real-name rule and purchase dialogs, toast), `EditProfile` (frame/nameplate/skin shop), `Reveal` (TOP 3 drum reveal), `Avatar`, `Nameplate`, `TowerSkin`
- `src/data.ts`: static design constants — prices, skins, themes (no mock candidates anymore)
- `src/styles.css`: fonts, keyframes, glass theme layer (`[data-theme="glass"]` × `data-g` surface levels; see `../project/Glass Theme Spec.md`)
- `avatarArt.ts`, `plateArt.ts`, `drumArt.ts`: decorative SVG copied verbatim from the design (generated, don't hand-edit)

Static styles are kept as the prototype's CSS strings through `css()` in `src/css.ts`, so values stay identical to the design.

## Known trade-offs

- **Photos are small data-URL JPEGs on the doc, not Firebase Storage.** Real Storage now requires the pay-as-you-go Blaze plan even for light use, so `backend/image.ts` shrinks each photo to ~128px and embeds it as base64 (usually a few KB) instead. This keeps things on the free tier but doesn't scale well: `subscribeCandidates` fetches every candidate doc on every leaderboard load, so with many users each carrying a photo, that listener gets proportionally heavier. Fine for a small/hobby deployment; a real Storage bucket (with thumbnails) would be the fix if this grows.
- **Anti-cheat is rules-only.** The Firestore rules constrain vote writes to one valid step and block self-voting, but without Cloud Functions (also a Blaze feature) a determined attacker with browser devtools has more surface than a server-validated API would. Reasonable for a hobby/demo deployment, not for a high-stakes contest.

# 인기투표 (Popular Vote) — app

React + TypeScript + Vite build of `project/Popular Vote v2.dc.html` (Claude Design handoff), backed by **Firebase** (Auth + Firestore) so accounts, votes, the leaderboard and the point shop are real and shared across everyone who opens the site.

- Signing up creates a Firebase Auth account **and** a leaderboard entry for that person — every registered voter is also a candidate others can vote on (that's how the point shop, "받은 추천 1개가 1P", makes sense).
- **Voting:** one vote per person per week — 추천 or 비추천. Within the 7 days after casting it you can switch it or cancel it (the tally moves by exactly the difference); after that it counts for good and a new vote starts a new week, adding up. `firestore.rules` enforces it (`voteAction`, vote docs keep `weekAt` + `weekKind`); a season reset zeroes the tallies but keeps the current week.
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

## Admin

Sign up in the app with the id **admin** (admin@vote.local) — that account gets a **관리** tab on top of everything a normal account has (it stays on the leaderboard, votes and gets votes; it just can’t delete itself). Do this before anyone else can take the id; the `Firebase backend` workflow warns while no admin account exists.

- **시즌**: rename the season, or start a new one (all tallies → 0, each person's recommendations this season carry over as points). The reset records the ended season's final TOP 3 in `meta/season.last`, and everyone sees the drum-roll reveal once (per device, within a week of the reset).
- **사람 관리**: give or take points (any amount, ±1,000,000 max), rename someone (1–20 chars; login id, score and points unchanged), or delete an account (their votes are taken back, their entry removed, the uid banned from re-joining; `purge-deleted-accounts.yml` then deletes the login itself, hourly).

Every admin write goes through single-use tokens, enforced by `firestore.rules`: the app issues three tokens (seq 1–3) bound to the exact action and payload, reads each back to verify it, then commits one batch that writes `meta/adminLock` listing them, burns all three, and makes the change. Tokens expire after 2 minutes and can't be reused, and the rules reject any privileged write that doesn't come with a freshly written lock for its action. Big operations (season reset) run in several batches, each with its own three tokens. What this guards against: replayed, duplicated or altered requests, and anyone who isn't the admin. What it can't: someone who has the admin's password — keep it strong.

## Tests

- `npm run test:rules` (in `app/`): 22 tests of `firestore.rules` on the Firestore emulator (needs Java 21), using the app's own `src/backend` code — sign-up, voting and vote-integrity attacks, the shop's price/points checks, and every admin operation including token replay/forgery. CI runs these before deploying rules.
- `.github/scripts/smoke-test.mjs`: the same core flows plus a real 3-token admin grant against the live project, with throwaway users that are deleted afterwards.

## Messages

The **메시지** tab (paper-plane icon, red badge = chats with unread messages) holds 1:1 chats and group chats. Start a 1:1 from anyone's profile (랭킹 → profile → 메시지) or with **새 채팅**: pick one person for a 1:1, two or more (up to 9, so 10 with you) for a group with an optional name. The ≡ button in a chat opens its info panel: who's in it, a per-chat 알림 switch, and (groups only) 채팅방 나가기, which asks twice before leaving. 1:1 chats can't be left. Groups: invite more people (up to 10, only people who accept messages), change the group photo and name; anyone can pick a chat background (kept on their device). Photos can be sent (compressed JPEG in `chats/{id}/media/{messageId}`, ≤700 KB, loaded when shown). Tapping a person in a chat opens their profile; group chats show each sender's current rank. The chat pins itself to the visual viewport and locks the page behind it, so the keyboard doesn't scroll the page.

**메시지 받기** (switch at the top of the tab) turned off means nobody can open a 1:1 with you, add you to a new group or send in a 1:1 with you, you disappear from the 새 채팅 list, and you can't send either. `firestore.rules` enforces all of this (not just the UI), plus: only members can read a chat, messages can't be edited, forged or deleted, and deleted accounts can't be messaged.

For local end-to-end testing, build with `VITE_USE_EMULATORS=1` and run the Auth + Firestore emulators (`firebase.json` has both).

## Season end date and rewards

관리 → **시즌 끝나는 날짜 · 보상**: pick when the season ends and the rewards (defaults 🥇500 · 🥈300 · 🥉150 · 4–6등 90 · everyone who took part 50P; ties share a rank, the participation reward is added on top). Saved with the 3-token protocol in `meta/season` (`endsAt`, `rewards`). When `endsAt` passes, the background worker ends the season in one commit: pays rewards (plus the season's 추천 carried over as points), zeroes tallies, records the TOP 3 and `seasonResults/{n}`, and starts the next season (numbered, rename it in 관리). A manual 새 시즌 시작 pays the same rewards. **보상 공지하기** posts a notice filled in from the saved settings. Home shows a live countdown next to the season name.

## 답장, 포인트 선물 and photos in chats

Swipe a message to the right, or long-press / right-click it for **답장 · 복사**. A reply quotes the original (tap the quote to jump to it); `firestore.rules` only accepts a quote of a message that exists in the same chat.


The **+** button in a chat offers 사진 and 포인트 선물. A gift holds the sender's points (`spent += amount`) and shows as a card: in a 1:1 only the other person can take it (**받기**), in a group the first member to tap does; the sender can **취소하기** until then and gets the points back. Every step is checked in `firestore.rules` (`giftSend`/`giftClaim`/`giftCancel`, `match /gifts`). Photos open full-screen with **저장** (share sheet on iPhone/Galaxy app, download elsewhere).

## 공지 (notices)

관리 → **공지사항**: title + body → **공지 보내기** (3-token admin op). Everyone signed in with a real account sees it full-screen once, the next time they open the app (or right away if it's open); **확인했어요** records it in `noticeReads/{uid}`, after which `firestore.rules` refuses to hand that notice out again. Anonymous (상담) and signed-out visitors can't read notices.

## 상담 and password reset

로그인 → **비밀번호를 잊었어요** opens a chat with the admin (상담) without an account: the app signs in anonymously (`setup-auth.mjs` turns anonymous sign-in on) and asks for name and id once. The admin sees 상담 in the 관리 tab (badge + push), replies, and — when the id matches an account — taps **비밀번호 초기화**: a 3-token admin op writes an 8-digit one-time code to `pwResets/{uid}`, the worker sets it as the password (seconds), and the code is sent in the chat. Logging in with it opens **새 비밀번호를 정해주세요**; the new password replaces the code and the reset is cleared.

## Notifications

계정 → **알림**: 알림 받기 (this device), 새 메시지, 받은 추천·비추천 (never says who voted). A muted chat (≡ → 알림) is skipped. Works in the Galaxy app (native FCM; `android-firebase-config.mjs` registers the Android app in Firebase and fetches `google-services.json` during the APK build), in desktop/Android browsers, and on iPhone only in the app added to the home screen (iOS 16.4+).

Delivery: `.github/workflows/notify.yml` is a self-restarting worker (GitHub's cron never fired for this repo): each run polls Firestore every 10 s for ~25 min (`send-notifications.mjs`), sending through FCM HTTP v1 with the service account, then dispatches the next run; the backend workflow also kicks it after deploys. Progress is kept in `meta/notifyCursor`, dead device tokens are removed, and there's a short gap between runs. Truly instant delivery would need a Cloud Functions trigger (Blaze plan).

## Install as an app

The Home tab has an **앱 설치하기** card (hidden when already running as an app) that opens a sheet with two tabs:

- **아이폰**: steps for Safari's 홈 화면에 추가. The site is a PWA (`public/manifest.webmanifest`, icons in `public/icons/`, a no-cache `public/sw.js`), so it opens full-screen with its own icon. Apple doesn't allow installing apps from outside the App Store, so this is the free option on iPhone.
- **갤럭시**: a download button for `popular-vote.apk` from the `android-latest` GitHub release, plus Chrome's own "add to home screen" when available. `.github/workflows/android-apk.yml` builds it: a Capacitor shell (`capacitor.config.json`) that loads the live site, so site updates reach the app without a new APK. It only rebuilds when the shell changes (config, `android-res/` icons, `package.json`).
Updates are remote: both apps load the deployed site, and `src/main.tsx` checks the deployed `index.html` whenever the app comes back to the foreground (and every 5 minutes), reloading onto the new bundle if it changed. Only changing the app icon or name needs a new APK.


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

#!/usr/bin/env bash
# Keeps the Galaxy APK signed with the same key on every build, so a new APK
# installs as an update over the old one. (A fresh debug key per build made
# Android refuse to install updates — it looked like the install was "blocked".)
#
# The keystore lives in the repo only encrypted (android-signing/release.keystore.enc),
# with a password derived from the FIREBASE_SERVICE_ACCOUNT secret, so it's
# useless without that secret. The first run creates it and commits it.
# Note: replacing the service-account secret changes the password; keep the old
# secret around (or re-encrypt the keystore) before rotating it.
# Run from app/. Exports KEY_PASS and leaves the keystore at $RUNNER_TEMP/release.keystore.
set -euo pipefail
KEY_PASS=$(node -e "const c=require('crypto');const k=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT).private_key;process.stdout.write(c.createHmac('sha256',k).update('vote-apk-keystore-v1').digest('hex'))")
echo "::add-mask::$KEY_PASS"
echo "KEY_PASS=$KEY_PASS" >> "$GITHUB_ENV"
enc=android-signing/release.keystore.enc
out="$RUNNER_TEMP/release.keystore"
if [ -f "$enc" ]; then
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in "$enc" -out "$out" -pass env:KEY_PASS
  echo "Using the existing signing key."
else
  keytool -genkeypair -noprompt -keystore "$out" -storetype PKCS12 -alias vote -keyalg RSA -keysize 2048 -validity 36500 \
    -storepass "$KEY_PASS" -keypass "$KEY_PASS" -dname "CN=Popular Vote, OU=DevToolXD, O=DevToolXD, C=KR"
  mkdir -p android-signing
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -in "$out" -out "$enc" -pass env:KEY_PASS
  git config user.name "github-actions[bot]"
  git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
  git add "$enc"
  git commit -m "Add encrypted APK signing key [skip ci]"
  git pull --rebase origin main && git push origin HEAD:main
  echo "::notice::Created the APK signing key (committed encrypted). Phones with the old debug-signed APK need to uninstall it once."
fi

#!/usr/bin/env bash
# Swaps Capacitor's default launcher icons and splash for ours, after `npx cap add android`.
# Run from app/. Icons come from app/android-res (rendered from the same glyph as the web icons).
set -euo pipefail
res=android/app/src/main/res
for d in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  cp "android-res/mipmap-$d.png" "$res/mipmap-$d/ic_launcher.png"
  cp "android-res/mipmap-$d.png" "$res/mipmap-$d/ic_launcher_round.png"
done
# Adaptive-icon XML would override the PNGs above with Capacitor's foreground art.
rm -rf "$res/mipmap-anydpi-v26"
# Splash: white screen with our icon centred, instead of the Capacitor logo bitmaps.
rm -f "$res"/drawable*/splash.png
cat > "$res/drawable/splash.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item android:drawable="@android:color/white" />
  <item><bitmap android:gravity="center" android:src="@mipmap/ic_launcher" /></item>
</layer-list>
XML
# 음성 통화 (WebRTC in the web view): the microphone. Capacitor's web view asks for it at
# runtime when the page calls getUserMedia, but only for permissions the manifest lists.
manifest=android/app/src/main/AndroidManifest.xml
for perm in RECORD_AUDIO MODIFY_AUDIO_SETTINGS; do
  grep -q "android.permission.$perm" "$manifest" || sed -i "s#</manifest>#    <uses-permission android:name=\"android.permission.$perm\" />\n</manifest>#" "$manifest"
done
echo "Android branding applied."

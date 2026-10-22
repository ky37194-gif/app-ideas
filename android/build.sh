#!/usr/bin/env bash
# Builds AppIdeas.apk (a WebView that opens the live site) and (optionally) installs it on a phone.
#
#   bash build.sh              -> build only
#   bash build.sh <serial>     -> build + install on that device (see `adb devices`)
#
# Optional (makes the app join the shared space by itself, nothing to type):
#   APP_SPACE_KEY=<invite code> APP_NAME=<name> OUT=MyApp.apk bash build.sh <serial>
# Never upload an APK built with APP_SPACE_KEY publicly — the code is inside it.
#
# No Gradle needed: uses the Android SDK tools directly.
# IMPORTANT: keep appideas.keystore. Updates must be signed with the same key,
# otherwise you'd have to uninstall first (which deletes your saved ideas).
set -euo pipefail
cd "$(dirname "$0")"

SDK="${ANDROID_HOME:-D:/dev/android}"
BT="$SDK/build-tools/36.0.0"
JAR="$SDK/platforms/android-35/android.jar"
ADB="$SDK/platform-tools/adb.exe"
VERSION_CODE="${VERSION_CODE:-$(date +%s | cut -c1-9)}"   # grows every build, so updates install cleanly

rm -rf build && mkdir -p build/assets build/classes
cp ../index.html build/assets/index.html
if [ -n "${APP_SPACE_KEY:-}" ]; then
  CONFIG="<script>window.APP_CONFIG={spaceKey:'${APP_SPACE_KEY}',name:'${APP_NAME:-}'};</script>"
  sed -i "0,/<head>/s|<head>|<head>${CONFIG}|" build/assets/index.html
fi
OUT="${OUT:-AppIdeas.apk}"

echo "1/6 Compiling resources..."
"$BT/aapt2.exe" compile --dir res -o build/res.zip

echo "2/6 Linking manifest + resources + assets..."
"$BT/aapt2.exe" link -o build/unsigned.apk -I "$JAR" --manifest AndroidManifest.xml \
  -A build/assets build/res.zip \
  --min-sdk-version 29 --target-sdk-version 34 \
  --version-code "$VERSION_CODE" --version-name "1.0"

echo "3/6 Compiling Java..."
javac --release 11 -classpath "$JAR" -d build/classes src/com/ky/appideas/*.java 2>&1 | grep -v "^warning\|^Note\|^1 warning" || true

echo "4/6 Converting to Android bytecode (dex)..."
java -cp "$BT/lib/d8.jar" com.android.tools.r8.D8 --release --min-api 29 --lib "$JAR" \
  --output build $(find build/classes -name '*.class')
(cd build && "$BT/aapt.exe" add unsigned.apk classes.dex >/dev/null)

echo "5/6 Aligning + signing..."
if [ ! -f appideas.keystore ]; then
  keytool -genkeypair -keystore appideas.keystore -alias appideas -storepass appideas -keypass appideas \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=App Ideas" >/dev/null 2>&1
fi
"$BT/zipalign.exe" -p -f 4 build/unsigned.apk build/aligned.apk
java -jar "$BT/lib/apksigner.jar" sign --ks appideas.keystore --ks-pass pass:appideas \
  --out "$OUT" build/aligned.apk
echo "Built: $(pwd)/$OUT"

if [ -n "${1:-}" ]; then
  echo "6/6 Installing on $1..."
  "$ADB" -s "$1" install -r "$OUT"
  "$ADB" -s "$1" shell am start -n com.ky.appideas/.MainActivity >/dev/null
  echo "Installed and launched."
fi

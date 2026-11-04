#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$DIR/safari-extension/build"
APP_NAME="StudyBridge.app"
EXT_NAME="StudyBridge Extension.appex"
APP_DIR="$BUILD_DIR/$APP_NAME"
EXT_DIR="$APP_DIR/Contents/PlugIns/$EXT_NAME"
SDK_PATH="$(xcrun --show-sdk-path)"
HOST_ARCH="$(uname -m)"
if [ "$HOST_ARCH" = "x86_64" ]; then
  SWIFT_TARGET="x86_64-apple-macos13.0"
else
  SWIFT_TARGET="arm64-apple-macos13.0"
fi

echo "=== Building StudyBridge Safari Web Extension ==="
echo "Target: $BUILD_DIR (Architecture: $HOST_ARCH -> $SWIFT_TARGET)"

rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"
mkdir -p "$EXT_DIR/Contents/MacOS"
mkdir -p "$EXT_DIR/Contents/Resources"

# 1. Compile Extension binary
echo "[1/4] Compiling Safari Extension binary..."
swiftc \
  -sdk "$SDK_PATH" \
  -target "$SWIFT_TARGET" \
  -O \
  -framework SafariServices \
  -framework Foundation \
  -emit-library \
  "$DIR/safari-extension/xcode/Shared (Extension)/SafariWebExtensionHandler.swift" \
  -o "$EXT_DIR/Contents/MacOS/StudyBridge Extension"

# 2. Compile Container App binary
echo "[2/4] Compiling Container App binary..."
swiftc \
  -sdk "$SDK_PATH" \
  -target "$SWIFT_TARGET" \
  -O \
  -parse-as-library \
  -framework Cocoa \
  -framework SafariServices \
  "$DIR/safari-extension/xcode/Shared (App)/AppDelegate.swift" \
  -o "$APP_DIR/Contents/MacOS/StudyBridge"

# 3. Copy Plists and WebExtension Assets
echo "[3/4] Packaging extension assets & manifests..."
cp "$DIR/safari-extension/xcode/Shared (App)/Info.plist" "$APP_DIR/Contents/Info.plist"
cp "$DIR/safari-extension/xcode/Shared (Extension)/Info.plist" "$EXT_DIR/Contents/Info.plist"

# Copy WebExtension resources into extension Resources
cp "$DIR/safari-extension/manifest.json" "$EXT_DIR/Contents/Resources/"
cp -R "$DIR/safari-extension/popup" "$EXT_DIR/Contents/Resources/"
cp -R "$DIR/safari-extension/background" "$EXT_DIR/Contents/Resources/"
cp -R "$DIR/safari-extension/content" "$EXT_DIR/Contents/Resources/"
cp -R "$DIR/safari-extension/icons" "$EXT_DIR/Contents/Resources/"

# 4. Ad-hoc Codesign
echo "[4/4] Codesigning extension and container application..."
codesign -s - --force --deep "$EXT_DIR"
codesign -s - --force --deep "$APP_DIR"

echo "✓ Successfully built: $APP_DIR"
echo "✓ PlugIn created: $EXT_DIR"

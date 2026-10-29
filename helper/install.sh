#!/bin/bash
# Builds ~/Applications/ChromeCtrlTab.app and registers a LaunchAgent so Ctrl+Tab opens the tab switcher in Chrome.
# Usage: ./install.sh            build and (re)start
#        ./install.sh uninstall  stop and remove
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$HOME/Applications/ChromeCtrlTab.app"
LABEL="com.github.bendemartin97.chrome-ctrl-tab"
AGENT="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
if [[ "${1:-}" == "uninstall" ]]; then
  rm -f "$AGENT"
  rm -rf "$APP"
  echo "removed"
  exit 0
fi

mkdir -p "$APP/Contents/MacOS" "$HOME/Library/LaunchAgents"
swiftc -O "$D/CtrlTab.swift" -o "$APP/Contents/MacOS/ChromeCtrlTab"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>$LABEL</string>
  <key>CFBundleName</key><string>ChromeCtrlTab</string>
  <key>CFBundleExecutable</key><string>ChromeCtrlTab</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSUIElement</key><true/>
</dict></plist>
PLIST
# A stable signing identity keeps the Accessibility permission across rebuilds; ad-hoc signatures change every build.
SIGN_ID=$(security find-identity -v -p codesigning | awk -F'"' '/Apple Development/ { print $2; exit }')
codesign --force --sign "${SIGN_ID:--}" "$APP" >/dev/null 2>&1 || true

cat > "$AGENT" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$APP/Contents/MacOS/ChromeCtrlTab</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/ChromeCtrlTab.log</string>
</dict></plist>
PLIST
launchctl bootstrap "gui/$(id -u)" "$AGENT"
echo "running: $APP (grant Accessibility in System Settings → Privacy & Security if asked)"

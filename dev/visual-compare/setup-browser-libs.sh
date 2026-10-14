#!/usr/bin/env bash
# Unpacks the host libraries and fonts Playwright's WebKit and Chromium need into
# a user-owned directory, for machines without sudo. Nothing is installed
# system-wide: apt state, downloads, and the unpacked tree all live under ROOT's
# parent. Pass the result to compare.mjs with --browser-root (or VC_BROWSER_ROOT).
#
#   ./setup-browser-libs.sh [ROOT]     default ROOT: ~/.cache/vc-browser-root
set -euo pipefail

ROOT=${1:-$HOME/.cache/vc-browser-root}
APT=${ROOT}-apt
HERE="$(cd "$(dirname "$0")" && pwd)"
APT_OPTS=(-o "Dir::State::Lists=$APT/lists" -o "Dir::Cache=$APT" -o "Dir::Cache::Archives=$APT/archives" -o Debug::NoLocking=1)

mkdir -p "$APT/lists/partial" "$APT/archives/partial" "$ROOT"

# Playwright's dry run fails against the empty system package lists, but its
# errors name every package it would install.
packages=$(cd "$HERE" && npx playwright install-deps --dry-run webkit chromium 2>&1 \
  | sed -n 's/.*Unable to locate package \([^ ]*\).*/\1/p' | sort -u | grep -v '^xvfb$' || true)
if [ -z "$packages" ]; then
  echo "could not read the package list from 'npx playwright install-deps --dry-run'" >&2
  exit 1
fi

apt-get "${APT_OPTS[@]}" update
# shellcheck disable=SC2086
apt-get "${APT_OPTS[@]}" install --download-only -y --no-install-recommends $packages

for deb in "$APT"/archives/*.deb; do
  dpkg -x "$deb" "$ROOT"
done

cat > "$ROOT/fonts.conf" <<EOF
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>$ROOT/usr/share/fonts</dir>
  <include ignore_missing="yes">$ROOT/etc/fonts/conf.d</include>
  <cachedir>$HOME/.cache/fontconfig</cachedir>
</fontconfig>
EOF

echo "browser root ready: $ROOT"

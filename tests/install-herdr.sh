#!/usr/bin/env bash
# Installs one Herdr version for CI: downloads releases.herdr.dev's tarball for this machine,
# checks it against the SHA-256 in that version's manifest, unpacks it into <folder> and prints
# the path of its herdr-app.
#
#   tests/install-herdr.sh latest <folder>    the newest Herdr (app/latest.json)
#   tests/install-herdr.sh minimum <folder>   MIN_HERDR from mods/whistle/version.js
#   tests/install-herdr.sh 0.1.15 <folder>    that version (app/<v>/manifest.json)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
want="${1:?version: latest, minimum or x.y.z}"
dest="${2:?folder to unpack into}"

if [ "$want" = minimum ]; then
  want="$(sed -n 's/^export const MIN_HERDR = "\(.*\)";.*/\1/p' "$here/../mods/whistle/version.js")"
  [ -n "$want" ] || { echo "no MIN_HERDR in mods/whistle/version.js" >&2; exit 1; }
fi
if [ "$want" = latest ]; then manifest_url="https://releases.herdr.dev/app/latest.json"
else manifest_url="https://releases.herdr.dev/app/$want/manifest.json"; fi

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) target=linux-x86_64 ;;
  Linux-aarch64|Linux-arm64) target=linux-aarch64 ;;
  Darwin-arm64|Darwin-aarch64) target=macos-aarch64 ;;
  MINGW*|MSYS*|CYGWIN*) target=windows-x86_64 ;;
  *) echo "no Herdr build for $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac

manifest="$(curl -fsSL --retry 3 "$manifest_url")"
# The manifest's entry for this target: { "url": ..., "sha256": ... } (no jq needed).
entry="$(printf '%s' "$manifest" | tr -d '\n' | sed -n "s/.*\"$target\"[^{]*{\([^}]*\)}.*/\1/p")"
url="$(printf '%s' "$entry" | sed -n 's/.*"url"[^"]*"\([^"]*\)".*/\1/p')"
sum="$(printf '%s' "$entry" | sed -n 's/.*"sha256"[^"]*"\([0-9a-f]*\)".*/\1/p')"
[ -n "$url" ] && [ -n "$sum" ] || { echo "no $target build in $manifest_url" >&2; exit 1; }

mkdir -p "$dest"
tarball="$dest/herdr-app-$target.tar.gz"
curl -fsSL --retry 3 -o "$tarball" "$url"
# Hash stdin and keep only the hex digits: Windows' sha256sum puts a backslash before the hash
# of a path that has backslashes in it.
if command -v sha256sum >/dev/null; then got="$(sha256sum < "$tarball")"
else got="$(shasum -a 256 < "$tarball")"; fi
got="$(printf '%s' "${got%% *}" | tr -cd '0-9a-f')"
[ "$got" = "$sum" ] || { echo "SHA-256 mismatch for $url: got $got, want $sum" >&2; exit 1; }
# From inside dest: GNU tar on Windows reads "C:/..." as a remote host.
(cd "$dest" && tar -xzf "herdr-app-$target.tar.gz")
rm -f "$tarball"

# Linux and Windows ship a bare herdr-app; macOS ships Herdr.app with the executable in Contents/MacOS.
app="$(find "$dest" -type f \( -name herdr-app -o -name herdr-app.exe -o -path '*.app/Contents/MacOS/*' \) | head -n 1)"
[ -n "$app" ] || { echo "no herdr-app in $url" >&2; exit 1; }
chmod +x "$app" 2>/dev/null || true
echo "$app"

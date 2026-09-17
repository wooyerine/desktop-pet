#!/usr/bin/env bash
# Bump the Homebrew cask (wooyerine/homebrew-tap) to the version in package.json.
# Run after the GitHub release is published:  scripts/update-cask.sh
# Needs the dmg in dist/ (npm run dist) and the wooyerine gh account active.
set -euo pipefail

cd "$(dirname "$0")/.."
VERSION=$(node -p "require('./package.json').version")
DMG="dist/desktop-pet-${VERSION}-arm64.dmg"
[ -f "$DMG" ] || { echo "missing $DMG — run npm run dist first" >&2; exit 1; }
SHA=$(shasum -a 256 "$DMG" | cut -d' ' -f1)

TAP=$(mktemp -d)
trap 'rm -rf "$TAP"' EXIT
git clone --quiet --depth 1 https://github.com/wooyerine/homebrew-tap.git "$TAP"

CASK="$TAP/Casks/desktop-pet.rb"
sed -i '' -e "s/^  version \".*\"/  version \"${VERSION}\"/" \
          -e "s/^  sha256 \".*\"/  sha256 \"${SHA}\"/" "$CASK"

if git -C "$TAP" diff --quiet; then
  echo "cask already at v${VERSION}"; exit 0
fi

git -C "$TAP" add Casks/desktop-pet.rb
git -C "$TAP" commit --quiet -m "desktop-pet ${VERSION}"
git -C "$TAP" -c credential.helper= -c 'credential.helper=!gh auth git-credential' push --quiet origin HEAD
echo "cask bumped to v${VERSION} (${SHA})"

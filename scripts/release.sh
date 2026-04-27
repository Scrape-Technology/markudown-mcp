#!/usr/bin/env bash
# Usage: ./scripts/release.sh 1.1.0
# Bumps version in package.json, commits, tags, and pushes — triggering the publish workflow.

set -euo pipefail

VERSION="${1:-}"

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>   e.g. $0 1.1.0"
  exit 1
fi

TAG="v${VERSION}"

echo "🔖 Releasing markudown-engine ${TAG}..."

# Bump version directly in package.json
sed -i "s/\"version\": \".*\"/\"version\": \"${VERSION}\"/" package.json

# Commit
git add package.json
git commit -m "chore: release ${TAG}"

# Tag
git tag "${TAG}"

# Push commit + tag
git push origin HEAD
git push origin "${TAG}"

echo "✅ Pushed ${TAG} — GitHub Actions will publish to npm."

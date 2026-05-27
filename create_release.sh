#!/bin/bash
set -e

LATEST_VERSION=$(grep -oE '<h2 id="[0-9]+\.[0-9]+\.[0-9]+">' web_data/frontend/changelog.html | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')

if [ -z "$LATEST_VERSION" ]; then
    echo "Error: could not determine version from changelog.html"
    exit 1
fi

echo "Releasing v$LATEST_VERSION"
git checkout dev
git add .
git commit -m "pushing to major update"
git push
# Merge dev into main
git checkout main
git pull --no-rebase --no-edit origin main
git merge dev --no-edit

# Push main
git push origin main

# Tag and push
git tag -a "$LATEST_VERSION" -m "Version $LATEST_VERSION"
git push origin "$LATEST_VERSION"

# Create GitHub release
gh release create "$LATEST_VERSION" --title "v$LATEST_VERSION" --generate-notes

# Return to dev
git checkout dev

echo "Done — v$LATEST_VERSION released"

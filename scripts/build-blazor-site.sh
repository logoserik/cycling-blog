#!/usr/bin/env bash
# Build the Blazor static site for a given SITE_BASE into an output directory.
set -euo pipefail

SITE_BASE="/"
SOURCE_DIR="."
OUT_DIR="./publish/wwwroot"

usage() {
  cat <<'EOF'
Usage: build-blazor-site.sh --source DIR --out DIR --base PATH

  --source  Repo root containing CyclingBlog.csproj (default: .)
  --out     Directory that will contain the published wwwroot files
  --base    <base href> path, e.g. /cycling-blog/ or /cycling-blog/uat/
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source) SOURCE_DIR="$2"; shift 2 ;;
    --out) OUT_DIR="$2"; shift 2 ;;
    --base) SITE_BASE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 1 ;;
  esac
done

SOURCE_DIR="$(cd "$SOURCE_DIR" && pwd)"
mkdir -p "$(dirname "$OUT_DIR")"
OUT_DIR="$(mkdir -p "$OUT_DIR" && cd "$OUT_DIR" && pwd)"

echo "Building from $SOURCE_DIR"
echo "SITE_BASE=$SITE_BASE"
echo "OUT_DIR=$OUT_DIR"

cd "$SOURCE_DIR"

bash ./scripts/generate-post-index.sh

for f in wwwroot/index.html wwwroot/404.html; do
  test -f "$f"
  # Idempotent: replace whatever base href is present.
  sed -i "s|<base href=\"[^\"]*\" />|<base href=\"${SITE_BASE}\" />|" "$f"
  grep -q "<base href=\"${SITE_BASE}\" />" "$f"
  echo "Updated base href in $f"
done

rm -rf ./publish-tmp
dotnet publish ./CyclingBlog.csproj \
  -c Release \
  -o ./publish-tmp \
  -p:GenerateContentIndex=false \
  --verbosity minimal

SITE=./publish-tmp/wwwroot
required=(
  "$SITE/index.html"
  "$SITE/_framework/blazor.webassembly.js"
  "$SITE/content/index.json"
  "$SITE/admin/index.html"
  "$SITE/admin/config.yml"
)
for f in "${required[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "::error::Missing required publish file: $f" >&2
    find ./publish-tmp -maxdepth 4 -print >&2 || true
    exit 1
  fi
  echo "OK $f"
done

# SPA fallback for deep links on GitHub Pages.
cp "$SITE/index.html" "$SITE/404.html"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
cp -a "$SITE"/. "$OUT_DIR"/
rm -rf ./publish-tmp
echo "Published site to $OUT_DIR"

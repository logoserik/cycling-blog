#!/usr/bin/env bash
# Build production + UAT site trees and assemble them into one GitHub Pages artifact.
#
# Layout:
#   <out>/           → production (SITE_BASE=/cycling-blog/)
#   <out>/uat/       → UAT        (SITE_BASE=/cycling-blog/uat/)
set -euo pipefail

PROD_SOURCE=""
UAT_SOURCE=""
OUT_DIR=""
PROD_BASE="/cycling-blog/"
UAT_BASE="/cycling-blog/uat/"

usage() {
  cat <<'EOF'
Usage: assemble-dual-env-site.sh \
  --prod-source DIR \
  --uat-source DIR \
  --out DIR \
  [--prod-base PATH] \
  [--uat-base PATH]
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prod-source) PROD_SOURCE="$2"; shift 2 ;;
    --uat-source) UAT_SOURCE="$2"; shift 2 ;;
    --out) OUT_DIR="$2"; shift 2 ;;
    --prod-base) PROD_BASE="$2"; shift 2 ;;
    --uat-base) UAT_BASE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ -z "$PROD_SOURCE" || -z "$UAT_SOURCE" || -z "$OUT_DIR" ]]; then
  usage >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$ROOT/scripts/build-blazor-site.sh"

PROD_BUILD="$(mktemp -d)"
UAT_BUILD="$(mktemp -d)"
cleanup() {
  rm -rf "$PROD_BUILD" "$UAT_BUILD"
}
trap cleanup EXIT

bash "$BUILD" --source "$PROD_SOURCE" --out "$PROD_BUILD" --base "$PROD_BASE"
bash "$BUILD" --source "$UAT_SOURCE" --out "$UAT_BUILD" --base "$UAT_BASE"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
cp -a "$PROD_BUILD"/. "$OUT_DIR"/
rm -rf "$OUT_DIR/uat"
mkdir -p "$OUT_DIR/uat"
cp -a "$UAT_BUILD"/. "$OUT_DIR/uat"/

# Record which SHAs are live (written by the workflow when available).
cat > "$OUT_DIR/deploy-meta.json" <<EOF
{
  "assembledAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "prodBase": "${PROD_BASE}",
  "uatBase": "${UAT_BASE}"
}
EOF

echo "Assembled dual-env site at $OUT_DIR"
echo "  prod → ${PROD_BASE}"
echo "  uat  → ${UAT_BASE}"

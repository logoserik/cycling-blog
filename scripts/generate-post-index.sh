#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
POSTS_DIR="$ROOT/wwwroot/content/posts"
INDEX_PATH="$ROOT/wwwroot/content/index.json"

mkdir -p "$POSTS_DIR"

mapfile -t SLUGS < <(find "$POSTS_DIR" -maxdepth 1 -type f -name '*.md' -printf '%f\n' | sed 's/\.md$//' | sort)

GENERATED_AT="$(date -u +"%Y-%m-%dT%H:%M:%S.0000000Z")"

{
  printf '{\n'
  printf '  "generatedAt": "%s",\n' "$GENERATED_AT"
  printf '  "posts": [\n'

  count=${#SLUGS[@]}
  if [[ "$count" -eq 0 ]]; then
    :
  else
    for i in "${!SLUGS[@]}"; do
      slug="${SLUGS[$i]}"
      # Escape characters that would break JSON string values.
      slug_json=${slug//\\/\\\\}
      slug_json=${slug_json//\"/\\\"}
      if [[ "$i" -lt $((count - 1)) ]]; then
        printf '    {\n      "slug": "%s"\n    },\n' "$slug_json"
      else
        printf '    {\n      "slug": "%s"\n    }\n' "$slug_json"
      fi
    done
  fi

  printf '  ]\n'
  printf '}\n'
} > "$INDEX_PATH"

echo "Wrote ${#SLUGS[@]} post(s) to wwwroot/content/index.json"

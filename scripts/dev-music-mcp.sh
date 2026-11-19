#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# StrudelLM pins better-sqlite3 which does not support global Node 26 on this Mac.
MUSIC_NODE_BIN="${STRUDELLM_NODE_BIN:-/opt/homebrew/opt/node@24/bin}"
if [[ -x "$MUSIC_NODE_BIN/node" ]]; then
  MUSIC_PATH="$MUSIC_NODE_BIN:$PATH"
else
  MUSIC_PATH="$PATH"
  echo "Use Node 20–25 for the original StrudelLM dependencies; recommended: Node 24."
fi
if [[ ! -d integrations/strudellm/node_modules ]]; then
  echo "Installing original StrudelLM dependencies with npm ci..."
  (cd integrations/strudellm && PATH="$MUSIC_PATH" npm ci)
fi

echo "StrudelLM Next.js: http://127.0.0.1:3105/music/studio"
echo "CAFE + MCP + music: http://127.0.0.1:8787/music/studio"
(cd integrations/strudellm && PORT=3105 PATH="$MUSIC_PATH" npm run dev) &
NEXT_PID=$!
cleanup() {
  kill "$NEXT_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
pnpm dev:mcp

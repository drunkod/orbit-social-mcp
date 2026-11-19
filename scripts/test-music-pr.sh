#!/usr/bin/env bash
# Isolated pull-request E2E: original CAFE and original StrudelLM via shared MCP.
set -euo pipefail
cd "$(dirname "$0")/.."

MUSIC_APP_PORT="${MUSIC_APP_PORT:-8877}"
MUSIC_NEXT_PORT="${MUSIC_NEXT_PORT:-3107}"
MUSIC_ARTIFACT_DIR="${MUSIC_ARTIFACT_DIR:-/tmp/cafe-music-review}"
mkdir -p "$MUSIC_ARTIFACT_DIR"
export MUSIC_ARTIFACT_DIR
export MUSIC_DEMO_URL="http://127.0.0.1:$MUSIC_APP_PORT"
export MUSIC_MCP_URL="http://127.0.0.1:$MUSIC_APP_PORT/mcp"
export DEMO_URL="$MUSIC_DEMO_URL"
export MCP_ENDPOINT="$MUSIC_MCP_URL"
export BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-$(openssl rand -hex 32)}"

test -f integrations/strudellm/.next/BUILD_ID || { echo 'Build StrudelLM first: npm run build'; exit 1; }
test -f packages/frontend/dist/index.html || { echo 'Build CAFE first: pnpm --filter @cafe/live-mcp build'; exit 1; }

# A Mac can run the CAFE MCP service on Node 26 while StrudelLM requires Node 20–25.
next_node_bin="${STRUDELLM_NODE_BIN:-/opt/homebrew/opt/node@24/bin}"
if [[ -x "$next_node_bin/node" ]]; then
  (cd integrations/strudellm && PATH="$next_node_bin:$PATH" PORT="$MUSIC_NEXT_PORT" npm run start) > "$MUSIC_ARTIFACT_DIR/next.log" 2>&1 &
else
  (cd integrations/strudellm && PORT="$MUSIC_NEXT_PORT" npm run start) > "$MUSIC_ARTIFACT_DIR/next.log" 2>&1 &
fi
next_pid=$!
(cd packages/live-mcp && PORT="$MUSIC_APP_PORT" STRUDELLM_PORT="$MUSIC_NEXT_PORT" pnpm start) > "$MUSIC_ARTIFACT_DIR/mcp.log" 2>&1 &
mcp_pid=$!
cleanup() {
  kill "$mcp_pid" "$next_pid" 2>/dev/null || true
  wait "$mcp_pid" "$next_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait_for_http() {
  local url="$1"
  for ((i=0; i<90; i++)); do
    if curl --silent --fail --max-time 3 --output /dev/null "$url"; then return 0; fi
    if ! kill -0 "$mcp_pid" 2>/dev/null || ! kill -0 "$next_pid" 2>/dev/null; then
      echo 'A PR preview process exited unexpectedly'
      tail -60 "$MUSIC_ARTIFACT_DIR/"*.log
      return 1
    fi
    sleep 1
  done
  echo "HTTP readiness timed out: $url"
  tail -60 "$MUSIC_ARTIFACT_DIR/"*.log
  return 1
}
wait_for_http "$MUSIC_DEMO_URL/health"
wait_for_http "$MUSIC_DEMO_URL/music/studio"

echo '=== MCP API discovery and mutation ==='
pnpm --filter @cafe/live-mcp exec tsx scripts/smoke-music.ts
echo '=== Music Studio browser acceptance + Playwright video ==='
pnpm --filter @cafe/live-mcp exec tsx scripts/test-music-studio.ts
echo '=== Original CAFE chat and plugin browser regression ==='
pnpm --filter @cafe/live-mcp exec tsx scripts/test-cafe-plugins.ts

echo "Review artifacts: $MUSIC_ARTIFACT_DIR"
ls -lh "$MUSIC_ARTIFACT_DIR"

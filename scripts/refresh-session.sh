#!/usr/bin/env bash
# Refresh Taiga MCP session token to prevent expiry.
# Run via cron every few hours (e.g. every 6h):
#   0 */6 * * * /path/to/scripts/refresh-session.sh >> /var/log/taiga-mcp-refresh.log 2>&1
#
# Required env vars (or edit the defaults below):
#   TAIGA_MCP_URL      — base URL of the MCP server
#   TAIGA_MCP_TOKEN    — current Bearer token (session UUID)
#   TAIGA_USERNAME     — Taiga username (fallback re-login)
#   TAIGA_PASSWORD     — Taiga password (fallback re-login)
#   TOKEN_FILE         — path to file that stores the current token JSON

set -euo pipefail

TAIGA_MCP_URL="${TAIGA_MCP_URL:-http://localhost:3000}"
TOKEN_FILE="${TOKEN_FILE:-$HOME/.taiga-mcp-token.json}"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"

# Load token from file if TAIGA_MCP_TOKEN not set in env
if [ -z "${TAIGA_MCP_TOKEN:-}" ]; then
  if [ -f "$TOKEN_FILE" ]; then
    TAIGA_MCP_TOKEN=$(jq -r '.token' "$TOKEN_FILE" 2>/dev/null || echo "")
  fi
fi

refresh() {
  curl -sf -X POST "$TAIGA_MCP_URL/auth/refresh" \
    -H "Authorization: Bearer $TAIGA_MCP_TOKEN" \
    -H "Content-Type: application/json"
}

login() {
  local user="${TAIGA_USERNAME:-}"
  local pass="${TAIGA_PASSWORD:-}"

  if [ -z "$user" ] || [ -z "$pass" ]; then
    echo "$LOG_PREFIX ERROR: TAIGA_USERNAME / TAIGA_PASSWORD not set — cannot re-login" >&2
    exit 1
  fi

  curl -sf -X POST "$TAIGA_MCP_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$user\",\"password\":\"$pass\"}"
}

# --- Main ---

if [ -n "${TAIGA_MCP_TOKEN:-}" ]; then
  echo "$LOG_PREFIX Attempting token refresh..."
  RESPONSE=$(refresh 2>/dev/null || echo "")

  if echo "$RESPONSE" | jq -e '.token' > /dev/null 2>&1; then
    echo "$RESPONSE" | jq . > "$TOKEN_FILE"
    chmod 600 "$TOKEN_FILE"
    echo "$LOG_PREFIX Refresh OK — expires $(echo "$RESPONSE" | jq -r '.expires_at')"
    exit 0
  fi

  echo "$LOG_PREFIX Refresh failed (server restarted?) — falling back to login"
fi

echo "$LOG_PREFIX Logging in..."
RESPONSE=$(login)

if ! echo "$RESPONSE" | jq -e '.token' > /dev/null 2>&1; then
  echo "$LOG_PREFIX ERROR: Login failed — response: $RESPONSE" >&2
  exit 1
fi

echo "$RESPONSE" | jq . > "$TOKEN_FILE"
chmod 600 "$TOKEN_FILE"

NEW_TOKEN=$(echo "$RESPONSE" | jq -r '.token')
echo "$LOG_PREFIX Login OK — new token: $NEW_TOKEN"
echo "$LOG_PREFIX Expires: $(echo "$RESPONSE" | jq -r '.expires_at')"

# If LIBRECHAT_CONFIG is set, update the Bearer token in librechat.yaml
if [ -n "${LIBRECHAT_CONFIG:-}" ] && [ -f "$LIBRECHAT_CONFIG" ]; then
  sed -i.bak "s|Authorization: \"Bearer [^\"]*\"|Authorization: \"Bearer $NEW_TOKEN\"|g" "$LIBRECHAT_CONFIG"
  echo "$LOG_PREFIX Updated Bearer token in $LIBRECHAT_CONFIG"
fi

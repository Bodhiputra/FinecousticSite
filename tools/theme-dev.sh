#!/usr/bin/env bash
# Resilient wrapper for `shopify theme dev`.
# Retries when theme-kit-access TLS / sync fails (intermittent network or Shopify CLI proxy).
set -u

STORE="${SHOPIFY_STORE:-j5gawi-vu.myshopify.com}"
PORT="${SHOPIFY_THEME_DEV_PORT:-9292}"
MAX_RETRIES="${SHOPIFY_THEME_DEV_RETRIES:-8}"
RETRY_DELAY="${SHOPIFY_THEME_DEV_RETRY_DELAY:-5}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

if ! command -v shopify >/dev/null 2>&1; then
  echo "shopify CLI not found. Install: npm install -g @shopify/cli @shopify/theme" >&2
  exit 1
fi

free_port() {
  local pids
  pids="$(lsof -ti:"$PORT" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "Stopping existing process on port $PORT..."
    kill -9 $pids 2>/dev/null || true
    sleep 1
  fi
}

attempt=1
while [ "$attempt" -le "$MAX_RETRIES" ]; do
  free_port
  echo ""
  echo "Starting shopify theme dev (attempt $attempt/$MAX_RETRIES) → http://127.0.0.1:$PORT"
  echo "Store: $STORE"
  echo ""

  set +e
  shopify theme dev --store "$STORE" --port "$PORT" 2>&1 | tee /tmp/fc-theme-dev.log
  exit_code=${PIPESTATUS[0]}
  set -e

  if grep -q "Preview your theme" /tmp/fc-theme-dev.log 2>/dev/null && [ "$exit_code" -eq 0 ]; then
    exit 0
  fi

  if grep -qiE "TLS connection was established|theme-kit-access|502 \(Bad Gateway\)|fetch failed|initial theme synchronization" /tmp/fc-theme-dev.log 2>/dev/null; then
    echo ""
    echo "Theme dev stopped (network/TLS to Shopify). Retrying in ${RETRY_DELAY}s..."
    echo "Tip: disable VPN/proxy if this keeps happening."
    sleep "$RETRY_DELAY"
    attempt=$((attempt + 1))
    continue
  fi

  exit "$exit_code"
done

echo "theme-dev.sh: gave up after $MAX_RETRIES attempts." >&2
exit 1

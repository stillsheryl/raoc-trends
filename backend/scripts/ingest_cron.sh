#!/usr/bin/env bash
#
# Scheduled ingestion for RAOC Community Voices.
# Designed to be run by cron (or manually). Idempotent: safe to re-run.
#
# Usage:
#   scripts/ingest_cron.sh [day|week|month]   # default: week
#
# Environment overrides:
#   RAOC_INGEST_LOG   path to the log file (default: <backend>/logs/ingest.log)
#
set -euo pipefail

WINDOW="${1:-week}"

case "$WINDOW" in
  day|week|month) ;;
  *)
    echo "[ingest_cron] invalid window '$WINDOW' (expected: day|week|month)" >&2
    exit 2
    ;;
esac

# Resolve paths relative to this script so it works from any CWD (e.g. cron).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# cron runs with a minimal PATH; make sure uv is reachable.
if ! command -v uv >/dev/null 2>&1; then
  export PATH="$HOME/.local/bin:$PATH"
fi
if ! command -v uv >/dev/null 2>&1; then
  echo "[ingest_cron] 'uv' not found on PATH (looked in \$PATH and ~/.local/bin)" >&2
  exit 127
fi

LOG_FILE="${RAOC_INGEST_LOG:-$BACKEND_DIR/logs/ingest.log}"
mkdir -p "$(dirname "$LOG_FILE")"

cd "$BACKEND_DIR"

ts() { date '+%Y-%m-%dT%H:%M:%S%z'; }

{
  echo "[$(ts)] ingest start (window=$WINDOW)"
  if uv run python -m app.ingest --window "$WINDOW"; then
    echo "[$(ts)] ingest done"
  else
    code=$?
    echo "[$(ts)] ingest FAILED (exit $code)"
    exit "$code"
  fi
} >> "$LOG_FILE" 2>&1

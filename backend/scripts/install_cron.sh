#!/usr/bin/env bash
#
# Install (or update) the weekly ingestion cron entry for RAOC Community Voices.
# Idempotent: re-running replaces the existing managed entry instead of adding
# duplicates. Run scripts/uninstall_cron.sh to remove it.
#
# Defaults: run scripts/ingest_cron.sh with the "week" window every Monday 06:00.
#
# Environment overrides:
#   RAOC_CRON_SCHEDULE   cron schedule (default: "0 6 * * 1")
#   RAOC_CRON_WINDOW     ingest window day|week|month (default: week)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CRON_SCRIPT="$SCRIPT_DIR/ingest_cron.sh"

SCHEDULE="${RAOC_CRON_SCHEDULE:-0 6 * * 1}"
WINDOW="${RAOC_CRON_WINDOW:-week}"
MARKER="# raoc-trends-ingest"

chmod +x "$CRON_SCRIPT"

ENTRY="$SCHEDULE $CRON_SCRIPT $WINDOW $MARKER"

# Keep every existing line except our previously-managed one, then append.
current="$(crontab -l 2>/dev/null || true)"
kept="$(printf '%s\n' "$current" | grep -vF "$MARKER" || true)"

{
  printf '%s\n' "$kept" | sed '/^[[:space:]]*$/d'
  printf '%s\n' "$ENTRY"
} | crontab -

echo "Installed weekly ingestion cron entry:"
echo "  $ENTRY"
echo
echo "Verify with:  crontab -l"
echo "Logs:         $SCRIPT_DIR/../logs/ingest.log"

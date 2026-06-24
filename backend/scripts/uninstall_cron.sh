#!/usr/bin/env bash
#
# Remove the managed RAOC Community Voices ingestion cron entry.
# Idempotent: does nothing if no managed entry exists.
#
set -euo pipefail

MARKER="# raoc-trends-ingest"

current="$(crontab -l 2>/dev/null || true)"
if ! printf '%s\n' "$current" | grep -qF "$MARKER"; then
  echo "No managed cron entry found — nothing to remove."
  exit 0
fi

kept="$(printf '%s\n' "$current" | grep -vF "$MARKER" || true)"
printf '%s\n' "$kept" | sed '/^[[:space:]]*$/d' | crontab -
echo "Removed the RAOC ingestion cron entry."

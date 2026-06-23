#!/bin/bash
# SessionStart hook for Claude Code on the web.
# Installs npm dependencies so the TypeScript type-check and Vite build work.
set -euo pipefail

# Only needed in the remote (web) environment; local dev manages its own deps.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Idempotent: npm install is a no-op when node_modules is already current,
# and the container caches state after the hook completes.
npm install --no-audit --no-fund

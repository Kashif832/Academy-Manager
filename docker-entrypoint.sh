#!/bin/sh
set -e

# Apply pending database migrations before serving. `migrate deploy` is
# non-interactive and never resets data. Set RUN_MIGRATIONS=false to skip
# (e.g. when a dedicated migration job runs separately).
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] applying database migrations…"
  node node_modules/prisma/build/index.js migrate deploy
fi

echo "[entrypoint] starting server on :${PORT:-3000}"
exec node server.js

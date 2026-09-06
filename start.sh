#!/usr/bin/env bash
# Lance ChatDoc (serveur + UI). Arrêt : Ctrl+C ou : kill $(cat .pid)
cd "$(dirname "$0")"
if [ -f .pid ] && kill -0 "$(cat .pid)" 2>/dev/null; then
  echo "ChatDoc tourne déjà (PID $(cat .pid)) → http://localhost:${PORT:-4000}"
  exit 0
fi
node server.js &
echo $! > .pid
echo "ChatDoc démarré (PID $(cat .pid)) →  http://localhost:${PORT:-4000}"
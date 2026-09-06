#!/usr/bin/env bash
# Lance ChatDoc (server + UI). Arrêt :  kill -TERM $(cat .pid)
set -e
cd "$(dirname "$0")"
if [ -f .pid ] && kill -0 "$(cat .pid)" 2>/dev/null; then
  echo "ChatDoc tourne deja (PID $(cat .pid)) →  http://localhost:${PORT:-4000}"
  exit 0
fi
setsid nohup node server.js > /tmp/chatdoc.log 2>&1 < /dev/null &
echo $! > .pid
sleep 2
echo "ChatDoc demarre (PID $(cat .pid)) →  http://localhost:${PORT:-4000}"
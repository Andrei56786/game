#!/bin/sh
# ждёт окончания прогонов CI и печатает итоги
while :; do
  S=$(for r in "$@"; do curl -s "https://api.github.com/repos/Andrei56786/game/actions/runs/$r" | jq -r '"\(.id) \(.status) \(.conclusion)"'; done)
  if ! echo "$S" | grep -qv " completed "; then echo "$S"; break; fi
  sleep 30
done
for r in "$@"; do curl -s "https://api.github.com/repos/Andrei56786/game/actions/runs/$r/jobs" | jq -r '.jobs[] | "\(.id) \(.name): \(.conclusion) (\(.started_at) → \(.completed_at))"'; done

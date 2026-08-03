#!/usr/bin/env bash
# Install IH comment + post-queue crons on this machine (server).
# Usage (on server, from repo root):
#   bash scripts/ih-install-cron.sh
#   bash scripts/ih-install-cron.sh --hour-utc 14   # default: 14 UTC ≈ 22:00 Beijing
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOUR_UTC=14
COUNT=2
POST_HOUR_UTC="" # default: same hour + 30 min offset via separate minute

while [[ $# -gt 0 ]]; do
  case "$1" in
    --hour-utc) HOUR_UTC="$2"; shift 2 ;;
    --count) COUNT="$2"; shift 2 ;;
    --post-hour-utc) POST_HOUR_UTC="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ -z "$POST_HOUR_UTC" ]]; then
  POST_HOUR_UTC="$HOUR_UTC"
fi

if [[ ! -d "$ROOT/data/ih-auth/user-data" ]]; then
  echo "ERROR: missing $ROOT/data/ih-auth/user-data"
  echo "On a desktop: pnpm ih:login  then rsync data/ih-auth/ to this server."
  exit 1
fi

if [[ ! -f "$ROOT/content/indiehackers/calendar.md" ]]; then
  echo "ERROR: missing $ROOT/content/indiehackers/calendar.md"
  exit 1
fi

# Cron has a minimal PATH — include common user installs (.bashrc is not sourced).
export PATH="${HOME}/.npm-global/bin:${HOME}/.local/n/n/versions/node/22.22.3/bin:${HOME}/.local/node/bin:${HOME}/.local/bin:/usr/local/bin:/usr/bin:/bin:${PATH}"

NODE="$(command -v node || true)"
if [[ -z "$NODE" ]]; then
  echo "ERROR: node not found in PATH"
  exit 1
fi
COMMENT_CMD="${NODE} scripts/ih-daily-comment.mjs"
POST_CMD="${NODE} scripts/ih-publish-queue.mjs"

cd "$ROOT"

CHROME=""
for c in \
  "$HOME/apps/chrome/opt/google/chrome/google-chrome" \
  "$HOME/apps/chrome/opt/google/chrome/chrome" \
  /usr/bin/google-chrome-stable \
  /usr/bin/google-chrome; do
  if [[ -x "$c" ]]; then CHROME="$c"; break; fi
done
if [[ -z "$CHROME" ]]; then
  echo "WARN: no system Chrome found. On Ubuntu 26, extract Chrome to ~/apps/chrome (see README)."
  pnpm exec playwright install chromium >/dev/null || true
fi

MARKER_COMMENT="# forge-regex ih-daily-comment"
MARKER_POST="# forge-regex ih-publish-queue"
MARKER_NOTIFY="# forge-regex ih-notify-poll"

ENV_COMMON="IH_REMIND_TO=${IH_REMIND_TO:-34310374@qq.com} IH_JITTER_MAX_MINUTES=${IH_JITTER_MAX_MINUTES:-75} IH_AUTO_RESEED=1"
ENV_COMMENT="IH_COMMENT_COUNT=${COUNT} ${ENV_COMMON}"
ENV_POST="IH_AUTO_POST=1 IH_POST_MIN_GAP_DAYS=${IH_POST_MIN_GAP_DAYS:-3} ${ENV_COMMON}"
ENV_NOTIFY="IH_USERNAME=${IH_USERNAME:-coderlau} IH_NOTIFY_TYPES=${IH_NOTIFY_TYPES:-reply_post,reply_comment,follow,mention} IH_REMIND_TO=${IH_REMIND_TO:-34310374@qq.com} IH_AUTO_RESEED=0"
if [[ -n "$CHROME" ]]; then
  ENV_COMMENT="${ENV_COMMENT} IH_CHROME_PATH=${CHROME}"
  ENV_POST="${ENV_POST} IH_CHROME_PATH=${CHROME}"
  ENV_NOTIFY="${ENV_NOTIFY} IH_CHROME_PATH=${CHROME}"
fi

PROXY_URL="${IH_PROXY:-http://127.0.0.1:7890}"
PROXY_HOST_PORT="${PROXY_URL#*://}"
PROXY_HOST_PORT="${PROXY_HOST_PORT%%/*}"
PROXY_PORT="${PROXY_HOST_PORT##*:}"
if ss -lntp 2>/dev/null | grep -qE ":${PROXY_PORT}\\b" || \
   curl -sS -x "${PROXY_URL}" -o /dev/null -w '' --connect-timeout 3 \
     https://www.google.com/generate_204 2>/dev/null; then
  PROXY_ENV="IH_PROXY=${PROXY_URL} HTTP_PROXY=${PROXY_URL} HTTPS_PROXY=${PROXY_URL} ALL_PROXY=${PROXY_URL} NO_PROXY=localhost,127.0.0.1,::1"
  ENV_COMMENT="${ENV_COMMENT} ${PROXY_ENV}"
  ENV_POST="${ENV_POST} ${PROXY_ENV}"
  ENV_NOTIFY="${ENV_NOTIFY} ${PROXY_ENV}"
  echo "Proxy: ${PROXY_URL}"
else
  echo "WARN: proxy ${PROXY_URL} not reachable — cron will run without proxy (IH auth may fail)."
fi

CRON_PATH="${HOME}/.npm-global/bin:${HOME}/.local/n/n/versions/node/22.22.3/bin:${HOME}/.local/node/bin:${HOME}/.local/bin:/usr/local/bin:/usr/bin:/bin"
COMMENT_CMD="${NODE} scripts/ih-daily-comment.mjs"
POST_CMD="${NODE} scripts/ih-publish-queue.mjs"
NOTIFY_CMD="${NODE} scripts/ih-notify-poll.mjs"

# Comments :00 / Posts :30 / Notify every hour at :15
COMMENT_LINE="0 ${HOUR_UTC} * * * cd ${ROOT} && PATH=${CRON_PATH} ${ENV_COMMENT} ${COMMENT_CMD} >> ${ROOT}/data/ih-comments/cron.log 2>&1 ${MARKER_COMMENT}"
POST_LINE="30 ${POST_HOUR_UTC} * * * cd ${ROOT} && PATH=${CRON_PATH} ${ENV_POST} ${POST_CMD} >> ${ROOT}/data/ih-comments/posts-cron.log 2>&1 ${MARKER_POST}"
NOTIFY_LINE="15 * * * * cd ${ROOT} && PATH=${CRON_PATH} ${ENV_NOTIFY} ${NOTIFY_CMD} >> ${ROOT}/data/ih-comments/notify-cron.log 2>&1 ${MARKER_NOTIFY}"

TMP="$(mktemp)"
crontab -l 2>/dev/null \
  | grep -v "forge-regex ih-daily-comment" \
  | grep -v "forge-regex ih-publish-queue" \
  | grep -v "forge-regex ih-notify-poll" >"$TMP" || true
echo "$COMMENT_LINE" >>"$TMP"
echo "$POST_LINE" >>"$TMP"
echo "$NOTIFY_LINE" >>"$TMP"
crontab "$TMP"
rm -f "$TMP"

echo "Installed crontab entries:"
echo "  $COMMENT_LINE"
echo "  $POST_LINE"
echo "  $NOTIFY_LINE"
echo
echo "Test:"
echo "  cd $ROOT && PATH=${CRON_PATH} IH_PROXY=${PROXY_URL} ${COMMENT_CMD} --dry-run"
echo "  cd $ROOT && PATH=${CRON_PATH} IH_PROXY=${PROXY_URL} ${POST_CMD} --dry-run"
echo "  cd $ROOT && PATH=${CRON_PATH} IH_PROXY=${PROXY_URL} ${NOTIFY_CMD} --seed"

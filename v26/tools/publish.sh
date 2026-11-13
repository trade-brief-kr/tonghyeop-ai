#!/usr/bin/env bash
# v26을 GitHub Pages 레포(trade-brief-kr/tonghyeop-ai)로 재배포
# 사용: bash publish.sh [--api https://<worker>.workers.dev]
set -euo pipefail
cd "$(dirname "$0")"
REPO_DIR=${REPO_DIR:-/workspace/tonghyeop/publish}
python3 build_v26.py "$@"
mkdir -p "$REPO_DIR/data" "$REPO_DIR/worker/src" "$REPO_DIR/server" "$REPO_DIR/v26/src" "$REPO_DIR/v26/tools/seeds"
cp ../index.html "$REPO_DIR/index.html"; cp ../data/missions.json "$REPO_DIR/data/missions.json"
cp ../src/* "$REPO_DIR/v26/src/"; cp ../README.md "$REPO_DIR/v26/README.md"
cp README.md build_v26.py set_api.py publish.sh gen_missions.sh merge_missions.py regression.py mission_prompt.md mission_schema.json "$REPO_DIR/v26/tools/"
cp seeds/*.json "$REPO_DIR/v26/tools/seeds/"
cp ../../worker/src/*.js "$REPO_DIR/worker/src/"; cp ../../worker/wrangler.toml ../../worker/README.md "$REPO_DIR/worker/"
cp ../../server/local.mjs "$REPO_DIR/server/"
cd "$REPO_DIR"
if rg -n --hidden -g '!.git' 'AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|BEGIN [A-Z ]*PRIVATE KEY' .; then echo "비밀값 의심 문자열 발견 — 중단"; exit 1; fi
git add -A
[ "${NO_PUSH:-}" = 1 ] && { git status --short; exit 0; }
git diff --cached --quiet && { echo "변경 없음"; exit 0; }
git commit -q -m "v26 update $(date '+%Y-%m-%d %H:%M')" && git push -q origin main && echo "pushed"

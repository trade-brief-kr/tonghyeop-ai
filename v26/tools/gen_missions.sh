#!/usr/bin/env bash
# AI 상무관 15개 미션 사전 심층조사 재생성 (Codex CLI + 웹검색, ChatGPT 구독 로그인 사용)
# 사용법: bash gen_missions.sh [동시실행수=5] [대상 예: mn_supply ...]
# 결과: out/<cc>_<mission>.json -> merge_missions.py 가 ../data/missions.json 생성
set -uo pipefail
cd "$(dirname "$0")"
PAR=${1:-5}; shift || true
TARGETS=("$@"); [ ${#TARGETS[@]} -eq 0 ] && TARGETS=($(ls seeds | grep -E '^[a-z]{2}_(supply|entry|partner)\.json$' | sed 's/\.json$//'))
command -v codex >/dev/null || { echo "codex CLI 없음: npm i -g @openai/codex 후 codex login"; exit 1; }
codex login status >/dev/null 2>&1 || { echo "codex 로그인 필요: codex login"; exit 1; }
mkdir -p out logs
run_one(){
  t=$1
  prompt="$(cat mission_prompt.md)

<seed>
$(cat seeds/$t.json)
</seed>"
  if codex --search exec --skip-git-repo-check --ephemeral -s read-only \
       --output-schema mission_schema.json -o out/$t.json.tmp "$prompt" > logs/$t.log 2>&1 \
     && python3 -c "import json,sys;json.load(open('out/$t.json.tmp'))" 2>/dev/null; then
    mv out/$t.json.tmp out/$t.json; echo "OK  $t"
  else echo "FAIL $t (logs/$t.log)"; fi
}
export -f run_one
printf '%s\n' "${TARGETS[@]}" | xargs -P "$PAR" -I{} bash -c 'run_one {}'
python3 merge_missions.py

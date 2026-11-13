# tools — 사전조사 재생성 · 빌드 · 회귀 점검

| 파일 | 역할 |
|---|---|
| seeds/*.json | 21개국×3임무=63건 시드. 15건은 v25 시나리오, 48건은 국가별 조사 초점(focus)·분야 목록. Codex 입력 |
| mission_prompt.md, mission_schema.json | Codex 지시문과 출력 스키마 |
| gen_missions.sh | `codex --search exec`로 63건 생성(동시 6개 약 1시간) → out/ → merge_missions.py |
| check_urls.py | 출처 URL 자동 점검 → logs/url_check.json (merge 시 dead/blocked 표시) |
| live21.py | 21개국 라이브 점검(키르기스 반도체 요청·투르크메니스탄·폴란드, Gemini 약 4회) |
| merge_missions.py | out/*.json을 ../data/missions.json으로 병합 (v25 시나리오 판단·조치 포함). 출처 URL 검증 |
| build_v26.py | v25 원본에서 ../index.html 생성 (사전조사 내장본 갱신 포함) |
| set_api.py | 배포본 index.html의 `TGG_OFFICER_API` 한 줄만 교체 (v25 원본 없이 레포에서 실행 가능) |
| publish.sh | 빌드 → /workspace/tonghyeop/publish(레포 클론)로 복사 → 비밀값 스캔 → commit·push. `--api URL` 전달 가능 |
| smoke_live.py | 배포 URL 스모크 테스트 (PC·모바일) |
| regression.py | Playwright 회귀 점검 (PC 1280 / 모바일 390): 홈, 상무관(규칙·AI·폴백), 빨간펜 6종(즉시·AI·폴백), 전달, ODA·CSV, 정상외교, 콘솔 에러. `--no-ai`면 Gemini 호출 없음, 전체 실행 시 약 11회 호출 |

## 시연 전날 재실행 절차
```bash
cd v26/tools
codex login status                 # "Logged in using ChatGPT" 확인 (기존 ChatGPT 구독, 추가비용 없음)
bash gen_missions.sh 5             # 15건, 동시 5개, 약 4~5분. 특정 건만: bash gen_missions.sh 1 mn_supply
python3 build_v26.py               # index.html 다시 만들기 (배포 시 --api https://<worker>.workers.dev)
RATE_PER_MIN=30 node ../../server/local.mjs &   # 로컬 서버(연속 테스트용 분당 한도 완화)
python regression.py --no-ai       # 회귀 점검 (AI 1~2건까지 보려면 --no-ai 빼기)
```
- 실패한 건은 `logs/<건>.log`를 보고 그 건만 다시 실행합니다.
- 생성된 사실은 공개자료 기반이지만, 시연 전에 [확인 필요] 항목과 출처 링크를 한 번 눈으로 확인하세요.

## Worker 배포 후 AI 켜기
```bash
bash publish.sh --api https://tonghyeop-officer.<account>.workers.dev   # 작업폴더에서 빌드+push
# 또는 레포 클론에서: python3 v26/tools/set_api.py index.html https://… && git commit -am "set api" && git push
python smoke_live.py      # 1~2분 뒤 라이브 확인
```

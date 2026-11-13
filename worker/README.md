# Cloudflare Worker — AI 상무관 종합 + AI 빨간펜 프록시

- `POST /api/officer`: 브리프 이슈, 사전조사, 시나리오를 받아 모델이 만든 JSON 반환
- `POST /api/redpen`: `{text, reportType, audience, rules[]}` → `{overall, corrections[{original, revised, reason, category, matched, new_numbers}], verify[]}`
  - 엄격한 JSON 스키마로 받고, 서버에서 다시 검증합니다: 원문 일치 여부(`matched`), 원문에 없는 숫자(`new_numbers`), 빈 결과 거부. 형식이 틀리면 다음 모델로 재시도합니다.
  - 보고서 본문은 6,000자 한도(`src/redpen.js`의 `REDPEN_MAX_INPUT`).
- `GET /api/health`: 연결 확인
- 키는 Worker Secret에만 저장 (`GEMINI_API_KEY`, OpenAI로 바꾸면 `OPENAI_API_KEY`). 코드·HTML·로그에 키 값이 남지 않음.
- 모델 교체는 설정 하나로: `AI_PROVIDER = "gemini" | "openai"`, `AI_MODEL = "모델1,모델2"`(앞 모델 실패 시 다음 모델). 호출부는 `src/providers.js`. 엔드포인트별 프롬프트·스키마·검증은 `src/officer.js`, `src/redpen.js`.
- 보호장치(두 엔드포인트 공통): 허용 Origin(`ALLOWED_ORIGINS` + localhost/127.0.0.1), 요청 본문 최대 24,000자, 상무관 요청 문장 1,200자, 빨간펜 본문 6,000자, IP당 분당 10회(`RATE_PER_MIN`, 합산), 인스턴스당 하루 300회(인스턴스 메모리 기준이라 대략적인 값).
- 기본 모델: `gemini-flash-lite-latest` → `gemini-flash-latest` (무료 등급 Flash). `gemini-2.5-flash`는 이 키에서 "신규 사용자 사용 불가(404)" 응답을 받아 제외.

## 배포 (사용자 승인 후)
```bash
cd worker
npx wrangler login                          # Cloudflare 무료 계정
# wrangler.toml의 ALLOWED_ORIGINS를 배포 도메인으로 수정 (예: https://<user>.github.io)
npx wrangler secret put GEMINI_API_KEY      # 프롬프트에 키 붙여넣기 (파일에 쓰지 않음)
npx wrangler deploy                         # → https://tonghyeop-officer.<account>.workers.dev
```
그다음 `python3 v26/tools/build_v26.py --api https://tonghyeop-officer.<account>.workers.dev`로 프런트 상수를 넣고 정적 호스팅에 올립니다.

## 로컬 테스트
`node server/local.mjs` 실행. Worker와 같은 코드(`src/index.js`)를 Node에서 돌리는 방식입니다.

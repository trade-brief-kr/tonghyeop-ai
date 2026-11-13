# 통협꾹이의 AI로운 하루 v26

통상협력국 **2026 AI 활용사례 경진대회 시연용** 단일 HTML 웹앱입니다.
- 라이브: https://trade-brief-kr.github.io/tonghyeop-ai/
- 화면 구성: 글로벌 맞춤 브리핑(외부 [글로벌 통상 브리프](https://trade-brief-kr.github.io/trade-brief/) 연결), 배국장의 AI 빨간펜, AI 상무관 파견센터, 산업 ODA·정상외교 성과관리

## 데이터 안내
- 보고서 샘플, ODA 사업·예산, 정상외교 과제, 상무관 요청 상황은 모두 **시연용 가상 자료**입니다.
- AI 상무관 사전 심층조사(`data/missions.json`)는 공개자료를 웹검색으로 정리했고 출처 URL·확인일을 붙였습니다. 불확실한 내용은 [확인 필요]로 표시했습니다.
- 글로벌 통상 브리프는 공개 JSON을 읽기만 합니다.
- **비공개·대외비 자료를 입력하지 마세요.**

## AI 기능 (선택)
- `index.html`의 `window.TGG_OFFICER_API`가 비어 있으면 규칙 종합·규칙 점검으로만 동작합니다(현재 상태).
- Cloudflare Worker(`worker/`)를 배포한 뒤 `python3 v26/tools/set_api.py index.html https://<worker>.workers.dev`로 주소를 넣고 다시 push하면 Gemini 무료 등급 종합·첨삭이 켜집니다. 키는 Worker Secret에만 둡니다.

## 폴더
- `index.html`: 실행 파일 (v25 원본 + v26 추가분)
- `data/missions.json`: 상무관 15개 임무 사전조사
- `worker/`: AI 프록시 코드 (`/api/officer`, `/api/redpen`)
- `server/local.mjs`: 로컬 테스트 서버
- `v26/`: 추가 기능 원본(src)·재생성·빌드·회귀점검 도구. 빌드에는 v25 원본 파일이 필요해 레포 밖 작업폴더에서 실행합니다.

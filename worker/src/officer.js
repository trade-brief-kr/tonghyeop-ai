// AI 상무관 종합 단계: 프롬프트·응답 스키마·검증
export const OFFICER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['brief_lines', 'status', 'opportunities', 'risks', 'next_actions', 'verify', 'request_letter', 'sources_used'],
  properties: {
    brief_lines: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 },
    status: {
      type: 'object', additionalProperties: false, required: ['level', 'reason'],
      properties: { level: { type: 'string', enum: ['정상', '주의', '위험'] }, reason: { type: 'string' } }
    },
    opportunities: { type: 'array', maxItems: 4, items: { type: 'object', additionalProperties: false, required: ['text', 'refs'], properties: { text: { type: 'string' }, refs: { type: 'array', items: { type: 'string' } } } } },
    risks: { type: 'array', maxItems: 4, items: { type: 'object', additionalProperties: false, required: ['text', 'refs'], properties: { text: { type: 'string' }, refs: { type: 'array', items: { type: 'string' } } } } },
    next_actions: { type: 'array', maxItems: 5, items: { type: 'object', additionalProperties: false, required: ['action', 'when'], properties: { action: { type: 'string' }, when: { type: 'string' } } } },
    verify: { type: 'array', maxItems: 6, items: { type: 'string' } },
    request_letter: {
      type: 'object', additionalProperties: false, required: ['to', 'subject', 'body'],
      properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } }
    },
    sources_used: { type: 'array', items: { type: 'string' } }
  }
};

export const OFFICER_SYSTEM = `너는 대한민국 산업통상 부처 통상협력국의 'AI 상무관'이다. 국장에게 올릴 현지 조사 종합보고를 만든다.
입력: (1) 임무 카드(국가·임무·우리측 요청), (2) 오늘/최근 '글로벌 통상 브리프' 이슈 [B#], (3) 사전 심층조사 사실 [M#], (4) 기존 시나리오의 판단·조치.
규칙:
- 입력에 있는 내용만 사실로 쓴다. 새 수치·기관·일정·합의를 지어내지 않는다. 불확실하면 문장에 [확인 필요]를 붙인다.
- 우리측 요청과 시나리오의 기업 수요는 '가상 설정'이므로 확정 사실처럼 쓰지 않는다.
- brief_lines는 국장보고 3줄(①핵심 판단 ②오늘 브리프/현지 동향이 임무에 주는 의미 ③건의·다음 조치), 각 90자 이내 개조식.
- status.level: 임무 진척 여건(정상/주의/위험), reason 1문장.
- opportunities/risks는 근거 ID(B1, M2 등)를 refs에 넣는다. 근거 없는 항목은 만들지 않는다. 브리프 이슈가 임무와 무관하면 억지로 연결하지 말고 risks/verify에서 '직접 관련 이슈 없음'을 언급할 수 있다.
- next_actions 3~5개, when은 '이번 주', '2주 내' 등 상대적 기한.
- verify: 현지·공식 확인이 필요한 사항 3~6개.
- request_letter: 상대국 소관기관(입력의 기관 중 하나)에 보낼 영문 정보요청 서한 초안. 정중·간결, 확인 질문 3~5개 번호목록, 발신 기관명은 쓰지 말고 서명란은 [Agency / Officer]. 문단·번호 사이에 줄바꿈(\n) 사용. 약속·합의 표현 금지.
- sources_used: 실제 인용한 근거 ID 목록.
- 한국어(서한 제외). 비공개 정보·개인 연락처 금지.`;

const MAX = { request: 1200, items: 10, text: 600 };
const s = (x, n = MAX.text) => String(x ?? '').slice(0, n);

export function buildUserPrompt(p) {
  const brief = (p.brief?.items || []).slice(0, MAX.items).map((b, i) =>
    `[B${i + 1}] (${s(b.date, 12)}) ${s(b.title, 200)} — ${(b.bullets || []).slice(0, 3).map(x => s(x, 220)).join(' / ')}`).join('\n') || '(최근 브리프에서 해당 국가 직접 관련 이슈 없음)';
  const facts = (p.research?.facts || []).slice(0, 8).map((f, i) =>
    `[M${i + 1}] ${s(f.fact, 300)}${f.confidence === '확인 필요' ? ' [확인 필요]' : ''}`).join('\n') || '(사전조사 없음)';
  const agencies = (p.research?.agencies || []).slice(0, 5).map(a => `- ${s(a.name, 80)}: ${s(a.role, 160)}`).join('\n');
  const sc = p.scenario || {};
  return `## 임무 카드
- 국가: ${s(p.country, 40)} / 임무: ${s(p.missionTitle, 60)} / 과제명: ${s(sc.title, 120)}
- 우리측 요청(가상 설정): ${s(p.request, MAX.request)}

## 글로벌 통상 브리프 (기준일 ${s(p.brief?.date, 12)})
${brief}

## 사전 심층조사 (확인일 ${s(p.research?.checked_date, 12)})
요약: ${s(p.research?.summary, 500)}
${facts}
기회: ${(p.research?.opportunities || []).slice(0, 3).map(x => s(x, 200)).join(' / ')}
위험: ${(p.research?.risks || []).slice(0, 3).map(x => s(x, 200)).join(' / ')}
기관:
${agencies}
현지 확인 질문 후보: ${(p.research?.questions || []).slice(0, 5).map(x => s(x, 200)).join(' / ')}

## 기존 시나리오 판단·조치
- 판단: ${s(sc.decision, 300)}
- 조치: ${(sc.actions || []).slice(0, 4).map(x => s(x, 200)).join(' / ')}`;
}

export function validatePayload(p) {
  if (!p || typeof p !== 'object') return '잘못된 요청';
  if (!p.country || !p.missionTitle) return '국가·임무 누락';
  if (String(p.request || '').length > MAX.request) return '요청 문장이 너무 깁니다';
  return '';
}

export function sanitizeResult(r) {
  const arr = (x, n) => (Array.isArray(x) ? x : []).slice(0, n);
  const lines = arr(r.brief_lines, 3).map(x => s(x, 200));
  while (lines.length < 3) lines.push('[확인 필요]');
  const lvl = ['정상', '주의', '위험'].includes(r?.status?.level) ? r.status.level : '주의';
  const item = x => ({ text: s(x?.text, 300), refs: arr(x?.refs, 6).map(v => s(v, 6)) });
  return {
    brief_lines: lines,
    status: { level: lvl, reason: s(r?.status?.reason, 300) },
    opportunities: arr(r.opportunities, 4).map(item),
    risks: arr(r.risks, 4).map(item),
    next_actions: arr(r.next_actions, 5).map(x => ({ action: s(x?.action, 300), when: s(x?.when, 40) })),
    verify: arr(r.verify, 6).map(x => s(x, 300)),
    request_letter: { to: s(r?.request_letter?.to, 120), subject: s(r?.request_letter?.subject, 200), body: s(r?.request_letter?.body, 3000) },
    sources_used: arr(r.sources_used, 20).map(v => s(v, 6))
  };
}

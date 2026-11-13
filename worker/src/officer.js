// AI 상무관 종합 단계: 프롬프트·응답 스키마·검증
export const OFFICER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['request_answer', 'brief_lines', 'status', 'opportunities', 'risks', 'next_actions', 'verify', 'request_letter', 'sources_used'],
  properties: {
    request_answer: {
      type: 'object', additionalProperties: false, required: ['verdict', 'text', 'refs'],
      properties: { verdict: { type: 'string', enum: ['가능', '조건부 가능', '어려움', '판단 보류'] }, text: { type: 'string' }, refs: { type: 'array', items: { type: 'string' } } }
    },
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
입력: (1) 임무 카드(국가·임무·선택 분야·우리측 요청), (2) 오늘/최근 '글로벌 통상 브리프' 이슈 [B#], (3) Codex 사전 심층조사(공개자료·출처) 사실 [M#]·지표 [I#]·한국 협력 [K#], (4) 기존 시나리오의 판단·조치(있을 때만).
가장 중요한 원칙: 보고서는 '우리측 요청'(사용자가 직접 쓴 질문)에 대한 답이다. 요청에 나온 품목·산업·목적(예: 반도체, 규소, 광물 확보, 진출 가능성)을 중심으로 근거를 골라 쓰고, 요청과 무관한 일반론은 줄인다.
규칙:
- 입력에 있는 내용만 사실로 쓴다. 새 수치·기관·법령·일정·합의를 지어내지 않는다. 불확실하면 문장에 [확인 필요]를 붙인다.
- 우리측 요청의 기업 수요·상황은 시연용 가상 설정이므로 확정 사실처럼 쓰지 않는다. 그러나 질문 자체에는 반드시 답한다.
- request_answer: 요청 질문에 대한 직접 답. verdict는 가능/조건부 가능/어려움/판단 보류 중 하나. text는 3~5문장: 결론 → 근거(M#/I#/K#/B# 인용) → 성립 조건·핵심 제약 → 사전조사가 요청 주제를 직접 다루지 않으면 그 사실을 밝히고 무엇을 확인해야 하는지. refs에 근거 ID. 본문 문장 안에는 [M1] 같은 근거 ID를 쓰지 말고 refs 배열에만 넣는다.
- 사전조사가 '없음'이면 브리프와 요청만으로 판단하고 verdict는 대개 '판단 보류', text 첫 문장에 '사전조사 미확보'를 밝힌다.
- brief_lines는 국장보고 3줄(①요청에 대한 핵심 판단 ②오늘 브리프/현지 동향·사전조사가 요청에 주는 의미 ③건의·다음 조치), 각 90자 이내 개조식. 번호 기호는 붙이지 않는다.
- status.level: 요청 임무의 진척 여건(정상/주의/위험), reason 1문장.
- opportunities/risks는 요청 주제와 직접 관련된 것을 우선하고 근거 ID(B1, M2, I1, K1 등)를 refs에 넣는다. 근거 없는 항목은 만들지 않는다. 브리프 이슈가 요청과 무관하면 억지로 연결하지 말고 '직접 관련 이슈 없음'을 risks나 verify에 쓸 수 있다.
- next_actions 3~5개, 요청 목적에 맞는 구체 조치(기관·자료명 포함), when은 '이번 주', '2주 내' 등 상대적 기한.
- verify: 요청 판단에 필요한 현지·공식 확인 사항 3~6개.
- request_letter: 상대국 소관기관(입력의 기관 중 요청 주제에 가장 맞는 곳)에 보낼 영문 정보요청 서한 초안. 정중·간결, 요청 주제에 맞춘 확인 질문 3~5개 번호목록, 발신 기관명은 쓰지 말고 서명란은 [Agency / Officer]. 문단·번호 사이에 줄바꿈(\n) 사용. 약속·합의 표현 금지.
- sources_used: 실제 인용한 근거 ID 목록.
- 한국어(서한 제외). 비공개 정보·개인 연락처 금지.`;

const MAX = { request: 1200, items: 10, text: 600 };
const s = (x, n = MAX.text) => String(x ?? '').slice(0, n);
const REF_RE = /^[BMIK]\d{1,2}$/;
const noInlineRefs = x => String(x ?? '').replace(/\s*[\[(](?:\s*[BMIK]\d{1,2}\s*[,·/]?)+[\])]/g, '');

export function buildUserPrompt(p) {
  const brief = (p.brief?.items || []).slice(0, MAX.items).map((b, i) =>
    `[B${i + 1}] (${s(b.date, 12)}) ${s(b.title, 200)} — ${(b.bullets || []).slice(0, 3).map(x => s(x, 220)).join(' / ')}`).join('\n') || '(최근 브리프에서 해당 국가 직접 관련 이슈 없음)';
  const R = p.research;
  const has = !!(R && (R.facts || []).length);
  const facts = has ? (R.facts || []).slice(0, 8).map((f, i) =>
    `[M${i + 1}] ${s(f.fact, 320)}${f.source_title ? ` (출처: ${s(f.source_title, 80)}${f.published_or_updated && f.published_or_updated !== '미상' ? ', ' + s(f.published_or_updated, 12) : ''})` : ''}${f.confidence === '확인 필요' ? ' [확인 필요]' : ''}`).join('\n') : '(사전조사 없음)';
  const ind = has ? (R.indicators || []).slice(0, 3).map((x, i) => `[I${i + 1}] ${s(x.name, 80)}: ${s(x.value, 80)} (${s(x.as_of, 20)})`).join('\n') : '';
  const kor = has ? (R.korea_links || []).slice(0, 3).map((x, i) => `[K${i + 1}] ${s(x.text, 260)}`).join('\n') : '';
  const agencies = (R?.agencies || []).slice(0, 5).map(a => `- ${s(a.name, 80)}: ${s(a.role, 160)}`).join('\n');
  const sc = p.scenario || {};
  const scen = sc.decision || (sc.actions || []).length ? `\n## 기존 시나리오 판단·조치 (참고)\n- 판단: ${s(sc.decision, 300)}\n- 조치: ${(sc.actions || []).slice(0, 4).map(x => s(x, 200)).join(' / ')}` : '';
  return `## 우리측 요청 (이 질문에 답할 것 · 시연용 가상 설정)
"""
${s(p.request, MAX.request) || '(요청 문장 없음: 선택 분야 기준으로 일반 검토)'}
"""

## 임무 카드
- 국가: ${s(p.country, 40)} / 임무: ${s(p.missionTitle, 60)} / 선택 분야: ${s(p.sector, 60) || '미지정'}${sc.title ? ` / 과제명: ${s(sc.title, 120)}` : ''}
- 사전 심층조사: ${has ? `있음 (확인일 ${s(R.checked_date, 12)}, ${s(R.title, 120)})` : '없음 — 브리프와 요청만으로 판단하고 사전조사 미확보를 밝힐 것'}

## 사전 심층조사 (Codex 웹검색·공개자료)
${has ? `요약: ${s(R.summary, 600)}\n${facts}${ind ? '\n지표:\n' + ind : ''}${kor ? '\n한국 협력:\n' + kor : ''}
기회: ${(R.opportunities || []).slice(0, 3).map(x => s(x, 200)).join(' / ')}
위험: ${(R.risks || []).slice(0, 3).map(x => s(x, 200)).join(' / ')}
미확인: ${(R.uncertain || []).slice(0, 4).map(x => s(x, 160)).join(' / ') || '-'}` : '(사전조사 없음)'}
기관:
${agencies || '(사전조사 기관 정보 없음)'}
현지 확인 질문 후보: ${(R?.questions || []).slice(0, 5).map(x => s(x, 200)).join(' / ') || '-'}

## 글로벌 통상 브리프 (기준일 ${s(p.brief?.date, 12)})
${brief}${scen}`;
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
  const refs = (x, n) => arr(x, n).map(v => String(v ?? '').trim()).filter(v => REF_RE.test(v));
  const item = x => ({ text: s(noInlineRefs(x?.text), 300), refs: refs(x?.refs, 6) });
  const ra = r?.request_answer || {};
  return {
    request_answer: { verdict: ['가능', '조건부 가능', '어려움', '판단 보류'].includes(ra.verdict) ? ra.verdict : '판단 보류', text: s(noInlineRefs(ra.text), 900), refs: refs(ra.refs, 8) },
    brief_lines: lines,
    status: { level: lvl, reason: s(r?.status?.reason, 300) },
    opportunities: arr(r.opportunities, 4).map(item),
    risks: arr(r.risks, 4).map(item),
    next_actions: arr(r.next_actions, 5).map(x => ({ action: s(x?.action, 300), when: s(x?.when, 40) })),
    verify: arr(r.verify, 6).map(x => s(x, 300)),
    request_letter: { to: s(r?.request_letter?.to, 120), subject: s(r?.request_letter?.subject, 200), body: s(r?.request_letter?.body, 3000) },
    sources_used: refs(r.sources_used, 20)
  };
}

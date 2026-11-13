// 모델 호출부: 설정(AI_PROVIDER) 하나로 Gemini <-> OpenAI 교체.
// 반환: 파싱된 JSON 객체. 실패 시 Error(err.status = HTTP 상태) 던짐.

const GEMINI_DEFAULT = ['gemini-flash-lite-latest', 'gemini-flash-latest']; // 무료 등급 Flash 별칭(구 2.5는 신규 사용자 불가)
const OPENAI_DEFAULT = ['gpt-4.1-mini'];

export function providerConfig(env) {
  const provider = (env.AI_PROVIDER || 'gemini').toLowerCase();
  const list = (env.AI_MODEL ? String(env.AI_MODEL).split(',') : provider === 'openai' ? OPENAI_DEFAULT : GEMINI_DEFAULT)
    .map(s => s.trim()).filter(Boolean);
  return { provider, models: list };
}

export async function callModel(env, { system, user, schema, timeoutMs = 25000, check }) {
  // check(data): 형식 검증·정리 함수. 실패(throw)하면 다음 모델로 재시도
  const { provider, models } = providerConfig(env);
  let lastErr;
  for (const model of models) {
    try {
      const data = provider === 'openai'
        ? await callOpenAI(env, model, system, user, schema, timeoutMs)
        : await callGemini(env, model, system, user, schema, timeoutMs);
      return { data: check ? check(data) : data, provider, model };
    } catch (e) {
      lastErr = e;
      console.warn(`[model] ${provider}/${model} failed: ${e.status || e.name} ${String(e.message).slice(0, 80)}`);
      // 한도초과(429)·일시 오류(5xx)·타임아웃일 때만 다음 모델로
      if (!(e.status === 404 || e.status === 429 || e.status >= 500 || e.name === 'AbortError')) break;
    }
  }
  throw lastErr || new Error('model call failed');
}

async function withTimeout(ms, fn) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try { return await fn(ac.signal); } finally { clearTimeout(t); }
}

function httpError(status, msg) { const e = new Error(msg); e.status = status; return e; }

async function callGemini(env, model, system, user, schema, timeoutMs) {
  if (!env.GEMINI_API_KEY) throw httpError(500, 'GEMINI_API_KEY not configured');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      responseJsonSchema: schema
    }
  };
  const r = await withTimeout(timeoutMs, signal => fetch(url, {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify(body)
  }));
  if (!r.ok) {
    let detail = '';
    try { const j = await r.json(); detail = j?.error?.status || ''; } catch {}
    throw httpError(r.status, `gemini ${r.status} ${detail}`.trim());
  }
  const j = await r.json();
  const text = j?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  if (!text) throw httpError(502, 'gemini empty response');
  try { return JSON.parse(text); } catch { throw httpError(502, 'gemini invalid json'); }
}

async function callOpenAI(env, model, system, user, schema, timeoutMs) {
  if (!env.OPENAI_API_KEY) throw httpError(500, 'OPENAI_API_KEY not configured');
  const r = await withTimeout(timeoutMs, signal => fetch('https://api.openai.com/v1/responses', {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model,
      input: [{ role: 'system', content: system }, { role: 'user', content: user }],
      text: { format: { type: 'json_schema', name: 'officer_report', schema, strict: true } }
    })
  }));
  if (!r.ok) throw httpError(r.status, `openai ${r.status}`);
  const j = await r.json();
  const text = j.output_text || j.output?.flatMap(o => o.content || []).map(c => c.text || '').join('') || '';
  if (!text) throw httpError(502, 'openai empty response');
  return JSON.parse(text);
}

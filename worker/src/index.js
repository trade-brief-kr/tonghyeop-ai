// Cloudflare Worker: AI 상무관 종합(POST /api/officer) + AI 빨간펜(POST /api/redpen) 프록시, GET /api/health
// Secret: GEMINI_API_KEY (또는 OPENAI_API_KEY) / Vars: AI_PROVIDER, AI_MODEL, ALLOWED_ORIGINS, ALLOW_FILE_ORIGIN
import { callModel, providerConfig } from './providers.js';
import { OFFICER_SCHEMA, OFFICER_SYSTEM, buildUserPrompt, validatePayload, sanitizeResult } from './officer.js';
import { REDPEN_SCHEMA, REDPEN_SYSTEM, buildRedpenPrompt, validateRedpen, sanitizeRedpen } from './redpen.js';

const MAX_BODY = 24000;          // 요청 본문 최대 글자 수
const PER_MIN_DEFAULT = 10;      // IP당 분당 요청(두 엔드포인트 합산, env RATE_PER_MIN로 조정)
const DAILY_CAP = 300;           // 인스턴스당 일일 상한(무료 등급 보호)
const hits = new Map();
let day = '', dayCount = 0;

function allowedOrigin(origin, env) {
  if (!origin) return '';
  if (origin === 'null') return env.ALLOW_FILE_ORIGIN === 'true' ? 'null' : '';
  try {
    const u = new URL(origin);
    if (['localhost', '127.0.0.1'].includes(u.hostname)) return origin;
  } catch { return ''; }
  const list = String(env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim().replace(/\/$/, '')).filter(Boolean);
  return list.includes(origin) ? origin : '';
}

function json(data, status, origin) {
  const h = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  if (origin) { h['access-control-allow-origin'] = origin; h['vary'] = 'Origin'; }
  return new Response(JSON.stringify(data), { status, headers: h });
}

function limited(ip, env) {
  const PER_MIN = Number(env.RATE_PER_MIN) || PER_MIN_DEFAULT;
  const now = Date.now(), today = new Date().toISOString().slice(0, 10);
  if (today !== day) { day = today; dayCount = 0; }
  if (dayCount >= DAILY_CAP) return 'daily';
  const arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  if (arr.length >= PER_MIN) { hits.set(ip, arr); return 'minute'; }
  arr.push(now); hits.set(ip, arr); dayCount++;
  if (hits.size > 5000) hits.clear();
  return '';
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = allowedOrigin(request.headers.get('origin'), env);
    if (request.method === 'OPTIONS') {
      if (!origin) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: {
        'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST, GET, OPTIONS',
        'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400', vary: 'Origin' } });
    }
    if (url.pathname === '/api/health') {
      const { provider, models } = providerConfig(env);
      return json({ ok: true, provider, model: models[0] }, 200, origin);
    }
    const ROUTES = {
      '/api/officer': { validate: validatePayload, system: OFFICER_SYSTEM, prompt: buildUserPrompt, schema: OFFICER_SCHEMA, clean: (d) => sanitizeResult(d) },
      '/api/redpen': { validate: validateRedpen, system: REDPEN_SYSTEM, prompt: buildRedpenPrompt, schema: REDPEN_SCHEMA, clean: (d, p) => sanitizeRedpen(d, p.text) }
    };
    const route = ROUTES[url.pathname];
    if (!route) return json({ error: 'not_found' }, 404, origin);
    if (request.method !== 'POST') return json({ error: 'method' }, 405, origin);
    if (request.headers.get('origin') && !origin) return json({ error: 'origin_not_allowed' }, 403, '');
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'local';
    const lim = limited(ip, env);
    if (lim) return json({ error: 'rate_limited', scope: lim }, 429, origin);
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ error: 'too_large' }, 413, origin);
    let p; try { p = JSON.parse(raw); } catch { return json({ error: 'bad_json' }, 400, origin); }
    const bad = route.validate(p);
    if (bad) return json({ error: 'bad_request', message: bad }, 400, origin);
    try {
      const { data, provider, model } = await callModel(env, { system: route.system, user: route.prompt(p), schema: route.schema, check: d => route.clean(d, p) });
      return json({ ok: true, provider, model, result: data }, 200, origin);
    } catch (e) {
      const st = e.status === 429 ? 429 : 502;
      return json({ error: st === 429 ? 'upstream_quota' : 'upstream_error', message: String(e.message || e).slice(0, 120) }, st, origin);
    }
  }
};

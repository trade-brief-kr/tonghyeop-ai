// 로컬 테스트 서버: Cloudflare Worker와 동일 코드(worker/src/index.js)를 Node에서 실행
// 실행: GEMINI_API_KEY 환경변수 설정 후  node server/local.mjs  → http://localhost:8787
//   /api/*  → Worker 핸들러,  그 외 → v26 정적 파일
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../worker/src/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', 'v26');
const PORT = Number(process.env.PORT || 8787);
const env = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  AI_PROVIDER: process.env.AI_PROVIDER || 'gemini',
  AI_MODEL: process.env.AI_MODEL || '',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '',
  ALLOW_FILE_ORIGIN: process.env.ALLOW_FILE_ORIGIN || 'true',
  RATE_PER_MIN: process.env.RATE_PER_MIN || ''
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.js': 'text/javascript' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname.startsWith('/api/')) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks);
    const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
    headers.set('cf-connecting-ip', req.socket.remoteAddress || 'local');
    const r = await worker.fetch(new Request(url, { method: req.method, headers, body }), env);
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
    console.log(new Date().toISOString(), req.method, url.pathname, r.status);
    return;
  }
  let p = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  if (!p || p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  try { const data = await readFile(file); res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(data); }
  catch { res.writeHead(404); res.end('not found'); }
}).listen(PORT, () => console.log(`local server http://localhost:${PORT}  (provider=${env.AI_PROVIDER}, key=${env.GEMINI_API_KEY ? 'set' : 'missing'})`));

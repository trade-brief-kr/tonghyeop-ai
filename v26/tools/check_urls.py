#!/usr/bin/env python3
"""out/*.json 출처 URL 생존 확인. 사용: python3 check_urls.py [건 ...]  → logs/url_check.json
판정: ok(2xx/3xx), blocked(401/403/429/5xx/TLS·시간초과: 봇·해외IP 차단 의심, 링크 유지·수동 확인), dead(404/410/DNS 없음)."""
import json, glob, os, sys, concurrent.futures as cf, urllib.request, ssl
here = os.path.dirname(os.path.abspath(__file__))
keys = sys.argv[1:] or [os.path.basename(f)[:-5] for f in sorted(glob.glob(os.path.join(here, 'out', '*.json')))]
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
import subprocess
def probe(u):
    def c(extra):
        r = subprocess.run(['curl', '-s', '-L', '--max-redirs', '8', '-o', '/dev/null', '-m', '25', '-k', '-A', UA, '-w', '%{http_code}|%{exitcode}'] + extra + [u], capture_output=True, text=True)
        code, ex = (r.stdout.strip() or '000|99').split('|')
        return int(code), int(ex)
    code, ex = c(['-I'])
    if code in (0, 400, 403, 404, 405, 429, 501) or code >= 500: code, ex = c([])
    if code: return code
    return {6: 'ERR:DNS', 7: 'ERR:CONNECT', 28: 'ERR:TIMEOUT', 35: 'ERR:TLS', 52: 'ERR:EMPTY', 56: 'ERR:RECV'}.get(ex, f'ERR:{ex}')
urls = {}
for k in keys:
    d = json.load(open(os.path.join(here, 'out', k + '.json'), encoding='utf-8'))
    for x in d.get('key_facts', []) + d.get('indicators', []) + d.get('korea_links', []):
        urls.setdefault(x.get('source_url', ''), set()).add(k)
    for a in d.get('agencies', []): urls.setdefault(a.get('url', ''), set()).add(k)
urls.pop('', None)
res = {}
with cf.ThreadPoolExecutor(16) as ex:
    for u, st in zip(urls, ex.map(probe, urls)): res[u] = st
def cls(st):
    if isinstance(st, int) and st < 400: return 'ok'
    if st in (404, 410) or st == 'ERR:DNS': return 'dead'
    return 'blocked'   # 401/403/429/5xx/TLS·시간초과: 봇·해외IP 차단 가능성 → 링크 유지, 수동 확인
out = {u: {'status': st, 'class': cls(st), 'cards': sorted(urls[u])} for u, st in res.items()}
prev = os.path.join(here, 'logs', 'url_check.json')
old = json.load(open(prev)) if os.path.exists(prev) else {}
old.update(out); json.dump(old, open(prev, 'w'), ensure_ascii=False, indent=1)
from collections import Counter
print(Counter(v['class'] for v in out.values()), 'total', len(out))
for u, v in out.items():
    if v['class'] != 'ok': print(v['class'], v['status'], u, v['cards'])

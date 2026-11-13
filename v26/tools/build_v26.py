#!/usr/bin/env python3
"""v25 원본(읽기 전용)에서 v26/index.html 생성. 재실행 가능.
변경: <title>만 v26, <head>에 프록시 주소 상수 1줄, 빨간펜 안내문 1줄(AI 선택 기능 안내),
</body> 앞에 v26 CSS·사전조사 내장본·JS(상무관·빨간펜) 추가.
사용: python3 build_v26.py [--api https://<worker>.workers.dev]"""
import hashlib, json, os, sys
here = os.path.dirname(os.path.abspath(__file__)); v26 = os.path.dirname(here)
SRC = os.path.join(v26, '..', 'handover', 'pkg', 'index.html')
V25_SHA = '08235a5be31d8a31b60fdc14e4c2522e2c22e28cceba710aef7acc5abbaf4a82'
api = sys.argv[sys.argv.index('--api') + 1] if '--api' in sys.argv else ''
raw = open(SRC, 'rb').read()
assert hashlib.sha256(raw).hexdigest() == V25_SHA, 'v25 원본 해시 불일치'
s = raw.decode('utf-8')
old_title = '<title>통협꾹이의 AI로운 하루 v21 | 심층 실무보고 개선판</title>'
assert s.count(old_title) == 1
cfg = ('<title>통협꾹이의 AI로운 하루 v26 | 심층 실무보고 개선판</title>\n'
       '<script id="v26-config">/* AI 프록시 주소(Cloudflare Worker: /api/officer, /api/redpen). 비워두면 규칙 종합·규칙 점검으로 동작 */\n'
       f'window.TGG_OFFICER_API={json.dumps(api)};</script>')
s = s.replace(old_title, cfg, 1)
old_notice = '<div class="redpen-notice">※ <strong>규칙 기반 시연용 첨삭</strong>입니다. 문서 표현과 누락 단서 확인을 지원하며, 생성형 AI의 실시간 분석이나 사실 검증은 수행하지 않습니다.</div>'
new_notice = ('<div class="redpen-notice">※ <strong>규칙 기반 즉시 첨삭</strong>이 먼저 표시되고, AI 프록시가 연결되면 '
              '<strong>생성형 AI(Gemini 무료 등급) 문장 첨삭</strong>이 이어서 표시됩니다(선택 기능). 사실 검증은 수행하지 않으므로 원문·공식자료를 확인하세요.</div>')
assert s.count(old_notice) == 1
s = s.replace(old_notice, new_notice, 1)
rd = lambda n: open(os.path.join(v26, 'src', n), encoding='utf-8').read()
css = rd('v26-officer.css') + rd('v26-redpen.css')
js = rd('v26-officer.js')
js_rp = rd('v26-redpen.js')
missions = open(os.path.join(v26, 'data', 'missions.json'), encoding='utf-8').read()
missions = json.dumps(json.loads(missions), ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
tail = '</body></html>'
assert s.rstrip().endswith(tail)
inject = (f'<style id="v26-officer-style">\n{css}</style>\n'
          f'<script type="application/json" id="v26MissionsInline">{missions}</script>\n'
          f'<script id="v26OfficerModule">\n{js}</script>\n'
          f'<script id="v26RedpenModule">\n{js_rp}</script>\n')
i = s.rstrip().rfind(tail)
s = s[:i] + inject + s[i:]
open(os.path.join(v26, 'index.html'), 'w', encoding='utf-8').write(s)
print('v26/index.html', len(s.encode()), 'bytes · api =', api or '(미설정)')

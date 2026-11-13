#!/usr/bin/env python3
"""배포본 index.html의 프록시 주소 상수만 바꿉니다(v25 원본 없이도 실행 가능).
사용: python3 set_api.py <index.html 경로> https://tonghyeop-officer.<account>.workers.dev   (빈 문자열이면 해제)"""
import json, re, sys
path, api = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else '')
if api and not re.match(r'^https://[^\s"\'<>]+$', api): sys.exit('https:// 주소만 허용')
s = open(path, encoding='utf-8').read()
s2, n = re.subn(r'window\.TGG_OFFICER_API=("(?:[^"\\]|\\.)*");', 'window.TGG_OFFICER_API=' + json.dumps(api.rstrip('/')) + ';', s, count=1)
assert n == 1, '상수 줄을 찾지 못함'
open(path, 'w', encoding='utf-8').write(s2)
print('TGG_OFFICER_API =', api or '(미설정)')

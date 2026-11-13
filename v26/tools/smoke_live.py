#!/usr/bin/env python3
"""배포 URL 스모크 테스트 (PC 1280 / 모바일 390). 사용: python smoke_live.py [URL]"""
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'https://trade-brief-kr.github.io/tonghyeop-ai/'
SHOTS = '/workspace/tonghyeop/v26_shots'
res = []
def ok(n, c, i=''): res.append((n, bool(c))); print('PASS' if c else 'FAIL', n, i)
with sync_playwright() as p:
    br = p.chromium.launch()
    for name, vp, mob in [('pc', {'width': 1280, 'height': 900}, False), ('mobile', {'width': 390, 'height': 844}, True)]:
        errs = []
        ctx = br.new_context(viewport=vp, is_mobile=mob, has_touch=mob, device_scale_factor=2 if mob else 1)
        pg = ctx.new_page()
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        r = pg.goto(URL, wait_until='load'); pg.wait_for_timeout(1500)
        ok(f'{name} HTTP 200 · 제목 v26', r.status == 200 and 'v26' in pg.title(), pg.title())
        ok(f'{name} 홈 4개 카드', pg.locator('#storyNav .story-item').count() == 4)
        pg.evaluate("document.querySelector('.nav[data-go=\"officer\"]').click()"); pg.wait_for_timeout(400)
        pg.click('[data-v21-country="sa"]'); pg.click('#officer [data-mission="supply"]'); pg.click('#msDispatch')
        pg.wait_for_function('window.tggV26&&window.tggV26.state()&&document.querySelector("#v26Stage [data-v26-step=\\"3\\"]").classList.contains("done")', timeout=30000)
        st = pg.evaluate('window.tggV26.state()')
        ok(f'{name} 상무관 파견(사우디·공급망) 규칙 종합', st['mode'] == 'rule', json.dumps(st, ensure_ascii=False))
        ok(f'{name} 브리프 실시간 조회', st['brief'] is not None, f"brief={st['brief']}")
        if name == 'pc':
            pg.locator('#deepPanel').scroll_into_view_if_needed(); pg.wait_for_timeout(300)
            pg.screenshot(path=f'{SHOTS}/live_pc_officer.png')
        pg.evaluate("document.querySelector('.nav[data-go=\"report\"]').click()"); pg.wait_for_timeout(400)
        pg.select_option('#reportSample', '3'); pg.click('#reportLoad'); pg.click('#reportAnalyze'); pg.wait_for_timeout(600)
        ok(f'{name} 빨간펜 규칙 결과', len(pg.inner_text('#reportAfter')) > 80 and '개선' in pg.inner_text('#reportCheckTag'))
        panel = pg.inner_text('#v26RpPanel')
        ok(f'{name} 빨간펜 폴백 안내(AI 프록시 미설정)', 'AI 프록시 미설정' in panel and 'v25 기본' in panel)
        sw = pg.evaluate('document.documentElement.scrollWidth')
        ok(f'{name} 가로 넘침 없음', sw <= vp['width'] + 2, f'scrollWidth={sw}')
        if name == 'mobile':
            pg.locator('#v26RpPanel').scroll_into_view_if_needed(); pg.wait_for_timeout(300)
            pg.screenshot(path=f'{SHOTS}/live_mobile_redpen.png')
        bad = [e for e in errs if 'favicon' not in e]
        ok(f'{name} 콘솔 에러 없음', not bad, ' | '.join(bad)[:300])
        ctx.close()
    br.close()
print(f'\n결과: {sum(c for _, c in res)}/{len(res)} 통과')

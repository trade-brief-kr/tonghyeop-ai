#!/usr/bin/env python3
"""배포 URL AI 모드 스모크 (PC 1280 / 모바일 390). 실제 Worker 호출: 기기당 상무관 1 + 빨간펜 1 = 총 4회.
사용: python smoke_live_ai.py [URL]"""
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'https://trade-brief-kr.github.io/tonghyeop-ai/'
SHOTS = '/workspace/tonghyeop/v26_shots'
res = []
def ok(n, c, i=''): res.append((n, bool(c))); print('PASS' if c else 'FAIL', n, i)
with sync_playwright() as p:
    br = p.chromium.launch()
    for name, vp, mob, country, sample in [('pc', {'width': 1280, 'height': 900}, False, 'sa', '3'),
                                           ('mobile', {'width': 390, 'height': 844}, True, 'uz', '1')]:
        errs = []
        ctx = br.new_context(viewport=vp, is_mobile=mob, has_touch=mob, device_scale_factor=2 if mob else 1)
        pg = ctx.new_page()
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        r = pg.goto(URL + '?v=ai', wait_until='load'); pg.wait_for_timeout(1500)
        ok(f'{name} HTTP 200 · 제목 v26', r.status == 200 and 'v26' in pg.title(), pg.title())
        ok(f'{name} 홈 4개 카드', pg.locator('#storyNav .story-item').count() == 4)
        ok(f'{name} API URL 설정', 'workers.dev' in pg.evaluate('window.TGG_OFFICER_API||""'))
        pg.evaluate("document.querySelector('.nav[data-go=\"officer\"]').click()"); pg.wait_for_timeout(400)
        pg.click(f'[data-v21-country="{country}"]'); pg.click('#officer [data-mission="supply"]'); pg.click('#msDispatch')
        pg.wait_for_function('window.tggV26&&window.tggV26.state()&&document.querySelector("#v26Stage [data-v26-step=\\"3\\"]").classList.contains("done")', timeout=70000)
        st = pg.evaluate('window.tggV26.state()')
        ok(f'{name} 상무관 파견({country}·공급망) AI 종합', st['mode'] == 'ai', json.dumps(st, ensure_ascii=False))
        ok(f'{name} 브리프 실시간 조회', st['brief'] is not None, f"brief={st['brief']}")
        if name == 'pc':
            pg.locator('#deepPanel').scroll_into_view_if_needed(); pg.wait_for_timeout(300)
            pg.screenshot(path=f'{SHOTS}/live_ai_pc_officer.png')
        else:
            pg.screenshot(path=f'{SHOTS}/live_ai_mobile_officer.png')
        pg.evaluate("document.querySelector('.nav[data-go=\"report\"]').click()"); pg.wait_for_timeout(400)
        pg.select_option('#reportSample', sample); pg.click('#reportLoad'); pg.click('#reportAnalyze'); pg.wait_for_timeout(400)
        ok(f'{name} 빨간펜 규칙 결과 즉시 표시', len(pg.inner_text('#reportAfter')) > 80 and '개선' in pg.inner_text('#reportCheckTag'))
        pg.wait_for_function("(()=>{const p=document.getElementById('v26RpPanel');return p&&!p.hidden&&!p.querySelector('.v26-rp-wait')})()", timeout=70000)
        head = pg.inner_text('#v26RpPanel .v26-rp-head'); rs = pg.evaluate('window.tggV26Redpen.state()')
        ok(f'{name} 빨간펜 AI 첨삭', 'AI 첨삭' in head and rs['mode'] == 'ai', json.dumps(rs))
        sw = pg.evaluate('document.documentElement.scrollWidth')
        ok(f'{name} 가로 넘침 없음', sw <= vp['width'] + 2, f'scrollWidth={sw}')
        card = pg.locator('#v26RpPanel').locator('xpath=ancestor::div[contains(@class,"card")][1]')
        card.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
        if name == 'pc': card.screenshot(path=f'{SHOTS}/live_ai_pc_redpen.png')
        else: pg.locator('#v26RpPanel').scroll_into_view_if_needed(); pg.wait_for_timeout(200); pg.screenshot(path=f'{SHOTS}/live_ai_mobile_redpen.png')
        bad = [e for e in errs if 'favicon' not in e]
        ok(f'{name} 콘솔 에러 없음', not bad, ' | '.join(bad)[:300])
        ctx.close()
    br.close()
print(f'\n결과: {sum(c for _, c in res)}/{len(res)} 통과')

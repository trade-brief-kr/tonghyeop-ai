#!/usr/bin/env python3
"""21개국 확장 라이브 점검: 배포 URL에서 키르기스스탄 반도체 요청·투르크메니스탄·폴란드 AI 종합 (Gemini 약 4회)."""
import json, os, sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'https://trade-brief-kr.github.io/tonghyeop-ai/'
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'v26_shots')
KG_REQ = '한국의 반도체 기업이 키르기스스탄 광물 확보를 위해 진출하는 것이 가능할까?'
CASES = {
 'pc': [('kg', 'entry', 'semicon', KG_REQ, 'kg_semicon'), ('tm', 'supply', 'gas', '국내 산업용 가스·에너지 공급 차질에 대비해 투르크메니스탄 천연가스 관련 대체 공급 가능성과 협의 창구를 확인하고 싶습니다.', 'tm_supply')],
 'mobile': [('kg', 'entry', 'semicon', KG_REQ, 'kg_semicon'), ('pl', 'entry', 'battery', '한국 배터리 소재 기업이 폴란드에 공장을 세우려 합니다. EU 배터리 규정과 투자 인센티브, 지원기관을 알려 주세요.', 'pl_entry')]}
res = []; out = {}
def ok(n, c, i=''): res.append((n, bool(c))); print('PASS' if c else 'FAIL', n, i)
with sync_playwright() as p:
    br = p.chromium.launch()
    for name, vp in (('pc', {'width': 1280, 'height': 900}), ('mobile', {'width': 390, 'height': 844})):
        kw = dict(viewport=vp) if name == 'pc' else dict(viewport=vp, device_scale_factor=2, is_mobile=True, has_touch=True)
        ctx = br.new_context(**kw); pg = ctx.new_page(); errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + '?v=' + str(os.getpid()), wait_until='load'); pg.wait_for_timeout(1500)
        n = pg.evaluate("document.querySelectorAll('#msCountry option').length"); ok(f'{name} 파견 국가 21개', n == 21, str(n))
        for cc, m, sec, req, tag in CASES[name]:
            pg.evaluate("document.querySelector('.nav[data-go=\"officer\"]').click()"); pg.wait_for_timeout(400)
            pg.select_option('#msCountry', cc); pg.wait_for_timeout(150)
            pg.click(f'#officer [data-mission="{m}"]'); pg.wait_for_timeout(200)
            pg.select_option('#msSector', sec); pg.fill('#msRequest', req); pg.click('#msDispatch')
            pg.wait_for_function('window.tggV26 && window.tggV26.state() && document.querySelector("#v26Stage [data-v26-step=\\"3\\"]").classList.contains("done")', timeout=90000)
            st = pg.evaluate('window.tggV26.state()'); txt = pg.inner_text('#deepContent'); badge = pg.inner_text('#deepContent .v26-modebar')
            ok(f'{name} {tag} AI 종합 배지', st['mode'] == 'ai' and '🤖 AI 종합' in badge, json.dumps(st, ensure_ascii=False))
            ok(f'{name} {tag} 사전조사 카드 사용', st['card'] and st['facts'] >= 4)
            ok(f'{name} {tag} 요청 답변 블록', '요청에 대한 답변' in txt and st['verdict'])
            if cc == 'kg':
                hit = [w for w in ('규사', '석영', '실리콘', '규소', '반도체', '광물', '안티몬', '희토류') if w in txt]
                ok(f'{name} {tag} 규소·광물·반도체 내용', len(hit) >= 3, ','.join(hit))
            sw = pg.evaluate('document.documentElement.scrollWidth'); ok(f'{name} {tag} 가로 넘침 없음', sw <= vp['width'] + 2, str(sw))
            pg.locator('#deepPanel').scroll_into_view_if_needed(); pg.wait_for_timeout(300)
            if name == 'pc': pg.locator('#deepPanel').screenshot(path=f'{SHOTS}/live21_pc_{tag}.png')
            else:
                pg.locator('.v26-answer').scroll_into_view_if_needed(); pg.wait_for_timeout(200); pg.screenshot(path=f'{SHOTS}/live21_mobile_{tag}.png')
            out[f'{name}_{tag}'] = {'state': st, 'answer': pg.inner_text('.v26-answer'), 'preview': pg.inner_text('#msReportPreview')}
            if name == 'pc' and cc == 'kg':
                pg.click('#deepDetailBtn'); pg.wait_for_timeout(300); pg.locator('#deepPanel').screenshot(path=f'{SHOTS}/live21_pc_kg_semicon_detail.png'); pg.click('#deepBriefBtn')
            pg.wait_for_timeout(2500)
        bad = [e for e in errs if 'favicon' not in e]; ok(f'{name} 콘솔 에러 없음', not bad, ' | '.join(bad)[:300])
        ctx.close()
    br.close()
json.dump(out, open(f'{SHOTS}/live21_result.json', 'w'), ensure_ascii=False, indent=1)
print(f'\n결과: {sum(c for _, c in res)}/{len(res)} 통과')

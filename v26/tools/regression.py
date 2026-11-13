#!/usr/bin/env python3
"""v26 회귀 점검 (Playwright). 로컬 서버(node server/local.mjs, :8787) 실행 상태에서 사용.
사용: python regression.py [--no-ai]   (--no-ai: Gemini 호출 없이 규칙/폴백만)"""
import json, sys, time, os
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8787/'
SHOTS = os.path.join(os.path.dirname(__file__), '..', '..', 'v26_shots')
NOAI = '--no-ai' in sys.argv
results = []
def ok(name, cond, info=''):
    results.append((name, bool(cond), info)); print(('PASS' if cond else 'FAIL'), name, info)

def attach(page, errs):
    page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))

def go(page, target):
    page.evaluate(f"document.querySelector('.nav[data-go=\"{target}\"]')?.click()"); page.wait_for_timeout(400)

def dispatch(page, cc, m, shot=None, wait=60000, pdelay=450):
    go(page, 'officer')
    page.click(f'[data-v21-country="{cc}"]'); page.wait_for_timeout(200)
    page.click(f'#officer [data-mission="{m}"]'); page.wait_for_timeout(250)
    page.click('#msDispatch')
    if shot:
        page.wait_for_timeout(pdelay)
        page.locator('#v26Stage').scroll_into_view_if_needed()
        page.screenshot(path=f'{SHOTS}/{shot}_progress.png')
    page.wait_for_function('window.tggV26 && window.tggV26.state() && document.querySelector("#v26Stage [data-v26-step=\\"3\\"]").classList.contains("done")', timeout=wait)
    st = page.evaluate('window.tggV26.state()')
    if shot:
        page.locator('#v26Stage').scroll_into_view_if_needed(); page.wait_for_timeout(300)
        page.screenshot(path=f'{SHOTS}/{shot}_stage_done.png')
        page.locator('#deepPanel').scroll_into_view_if_needed(); page.wait_for_timeout(300)
        page.locator('#deepPanel').screenshot(path=f'{SHOTS}/{shot}_report.png')
    return st

def redpen_all(page, prefix):
    go(page, 'report')
    n = page.evaluate("document.querySelectorAll('#reportSample option').length")
    good = 0
    for i in range(n):
        page.select_option('#reportSample', str(i)); page.click('#reportLoad'); page.click('#reportAnalyze'); page.wait_for_timeout(150)
        after = page.inner_text('#reportAfter'); tag = page.inner_text('#reportCheckTag')
        if len(after) > 80 and '개선' in tag: good += 1
    ok(f'{prefix} 빨간펜 즉시 실행 {n}개 샘플', n == 6 and good == 6, f'{good}/{n}')

def redpen_ai(page, prefix, idxs, shot_prefix=None, expect='ai', wait=60000):
    go(page, 'report'); modes = []; immediate = 0; overflow = 0
    for i in idxs:
        page.select_option('#reportSample', str(i)); page.click('#reportLoad'); page.click('#reportAnalyze'); page.wait_for_timeout(250)
        if len(page.inner_text('#reportAfter')) > 80 and '개선' in page.inner_text('#reportCheckTag'): immediate += 1
        page.wait_for_function("(()=>{const p=document.getElementById('v26RpPanel');return p&&!p.hidden&&!p.querySelector('.v26-rp-wait')})()", timeout=wait)
        head = page.inner_text('#v26RpPanel .v26-rp-head')
        modes.append('ai' if 'AI 첨삭' in head else 'fallback')
        if page.evaluate('document.documentElement.scrollWidth') > page.viewport_size['width'] + 2: overflow += 1
        if shot_prefix:
            card = page.locator('#v26RpPanel').locator('xpath=ancestor::div[contains(@class,"card")][1]')
            card.scroll_into_view_if_needed(); page.wait_for_timeout(200)
            card.screenshot(path=f'{SHOTS}/{shot_prefix}_{i+1}.png')
        if expect == 'ai': page.wait_for_timeout(1500)   # 무료 등급 분당 한도 여유
    n = len(idxs); good = sum(1 for m in modes if m == expect)
    ok(f'{prefix} 빨간펜 규칙 결과 즉시 표시 {n}건', immediate == n, f'{immediate}/{n}')
    ok(f'{prefix} 빨간펜 {"AI 첨삭" if expect=="ai" else "폴백(규칙만)"} {n}건', good == n, ','.join(modes))
    ok(f'{prefix} 빨간펜 가로 넘침 없음', overflow == 0, f'overflow={overflow}')
    return good

AI_OK = 0
with sync_playwright() as p:
    br = p.chromium.launch()
    # ---------------- PC 1280 ----------------
    errs = []
    ctx = br.new_context(viewport={'width': 1280, 'height': 900}, accept_downloads=True)
    page = ctx.new_page(); attach(page, errs)
    page.goto(BASE, wait_until='load'); page.wait_for_timeout(1200)
    ok('PC 제목 v26', 'v26' in page.title(), page.title())
    ok('PC 홈 4개 업무 카드', page.locator('#storyNav .story-item').count() == 4, str(page.locator('#storyNav .story-item').count()))
    ok('PC 브리프 링크 유지', page.locator('#storyNav a[href="https://trade-brief-kr.github.io/trade-brief/"]').count() == 1)
    page.screenshot(path=f'{SHOTS}/pc_home.png')
    st = dispatch(page, 'mn', 'supply', 'pc_rule_mn_supply')
    ok('PC 상무관 몽골·공급망 (API 미설정 → 규칙 종합)', st and st['mode'] == 'rule', json.dumps(st, ensure_ascii=False))
    page.click('#deepDetailBtn'); page.wait_for_timeout(200); d = page.inner_text('#deepContent')
    ok('PC 상세보고 탭(사전조사 사실·출처)', '공개자료로 확인한 사실' in d and 'M1' in d)
    page.click('#deepFollowBtn'); page.wait_for_timeout(200); f = page.inner_text('#deepContent')
    ok('PC 후속조치 탭(요청서 초안)', '현지 확인 요청서 초안' in f)
    page.click('#deepBriefBtn'); page.wait_for_timeout(200)
    st = dispatch(page, 'in', 'entry')
    ok('PC 상무관 인도·기업진출 (규칙 종합)', st and st['mode'] == 'rule', json.dumps(st, ensure_ascii=False))
    # 21개국 확장: 카자흐스탄·키르기스스탄도 사전조사 카드로 v26 보고
    for cc, m in (('kz', 'supply'), ('kg', 'entry')):
        go(page, 'officer'); page.select_option('#msCountry', cc); page.wait_for_timeout(200); page.click(f'#officer [data-mission="{m}"]'); page.wait_for_timeout(200); page.click('#msDispatch')
        page.wait_for_function('window.tggV26 && window.tggV26.state() && document.querySelector("#v26Stage [data-v26-step=\\"3\\"]").classList.contains("done")', timeout=30000)
        st = page.evaluate('window.tggV26.state()')
        ok(f'PC 21개국 확장 {cc}_{m} 사전조사 카드 사용(규칙 종합)', st and st['cc'] == cc and st['card'] and st['facts'] >= 4 and st['mode'] == 'rule', json.dumps(st, ensure_ascii=False))
    # 상무관 → 빨간펜
    st = dispatch(page, 'id', 'supply')
    page.click('#deepSendRed'); page.wait_for_timeout(500)
    v = page.input_value('#reportInput')
    ok('PC 상무관→빨간펜 전달', page.evaluate("document.getElementById('report').classList.contains('active')") and '국장 보고' in v, v[:40].replace('\n', ' '))
    redpen_all(page, 'PC')
    # ODA 수정·CSV
    go(page, 'performance'); page.click('#perfTabOda'); page.wait_for_timeout(400)
    page.locator('#odaRows tr[data-oda-row]').first.click(); page.wait_for_timeout(300)
    page.fill('#odaEditNote', 'v26 회귀점검 메모'); page.click('#odaSave'); page.wait_for_timeout(300)
    saved = page.evaluate("localStorage.getItem('tonghyeop_oda_v14')||''")
    ok('PC ODA 관리카드 수정·저장(tonghyeop_oda_v14)', 'v26 회귀점검 메모' in saved)
    with page.expect_download(timeout=8000) as dl: page.evaluate("document.getElementById('odaExport').click()")
    ok('PC ODA CSV 내보내기', dl.value.suggested_filename.lower().endswith('.csv'), dl.value.suggested_filename)
    # 정상외교 필터
    page.click('#perfTabSummit'); page.wait_for_timeout(500)
    before = page.locator('#summitRows tr').count()
    opts = page.evaluate("[...document.querySelectorAll('#summitStatus option')].map(o=>o.value).filter(v=>v&&v!=='all')")
    page.select_option('#summitStatus', opts[0]); page.wait_for_timeout(400)
    after = page.locator('#summitRows tr').count()
    ok('PC 정상외교 이행상태 필터', before > 0 and after < before, f'{before}→{after} ({opts[0]})')
    page.screenshot(path=f'{SHOTS}/pc_summit_filter.png')
    ok('PC 콘솔 에러 없음(규칙 모드 세션)', not [e for e in errs if 'favicon' not in e], ' | '.join(errs)[:300])
    ctx.close()

    # ---------------- PC: 폴백 시나리오 ----------------
    errs2 = []
    ctx = br.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page(); attach(page, errs2)
    page.goto(BASE + '?officerApi=http://localhost:9', wait_until='load'); page.wait_for_timeout(800)
    st = dispatch(page, 'uz', 'partner', 'pc_fallback_uz_partner')
    why = page.inner_text('[data-v26-step="2"] small')
    ok('PC 폴백: AI 프록시 연결 실패 → 규칙 종합', st and st['mode'] == 'rule' and '규칙 종합 전환' in why, why)
    redpen_ai(page, 'PC 폴백(프록시 연결 실패)', range(6), 'pc_redpen_fallback', expect='fallback')
    page.route('**/api/redpen', lambda r: r.fulfill(status=502, content_type='application/json', body='{"error":"upstream_error"}'))
    page.goto(BASE + '?officerApi=http://localhost:8787', wait_until='load'); page.wait_for_timeout(600)
    redpen_ai(page, 'PC 폴백(AI 오류 502 응답)', [0], 'pc_redpen_fallback_502', expect='fallback')
    ok('PC 폴백 안내문(규칙 결과만)', '규칙 결과만' in page.inner_text('#v26RpPanel') or '결과만 표시' in page.inner_text('#v26RpPanel'))
    page.unroute('**/api/redpen')
    page.route('**/data/missions.json', lambda r: r.fulfill(status=404, body='x'))
    page.evaluate("document.getElementById('v26MissionsInline').textContent='null'")
    page.reload(wait_until='load'); page.route('**/data/missions.json', lambda r: r.fulfill(status=404, body='x'))
    page.evaluate("document.getElementById('v26MissionsInline').textContent='null'")
    page.route('**/api/officer', lambda r: r.fulfill(status=502, content_type='application/json', body='{"error":"upstream_error"}'))
    go(page, 'officer'); page.click('[data-v21-country="sa"]'); page.click('#officer [data-mission="entry"]'); page.click('#msDispatch')
    page.wait_for_function('document.querySelector("#v26Stage [data-v26-step=\\"3\\"]").classList.contains("done")', timeout=20000)
    ok('PC 폴백: 사전조사 없음 + AI 실패 → v25 시나리오', 'v25' in page.inner_text('#v26Mode') and len(page.inner_text('#deepContent')) > 100, page.inner_text('#v26Mode'))
    page.unroute('**/api/officer')
    FAKE = {"ok": True, "model": "mock", "result": {"request_answer": {"verdict": "판단 보류", "text": "사전조사 미확보로 판단 보류(모의 응답).", "refs": []}, "brief_lines": ["가", "나", "다"], "status": {"level": "주의", "reason": "모의"}, "opportunities": [], "risks": [], "next_actions": [{"action": "확인", "when": "이번 주"}], "verify": ["확인"], "request_letter": {"to": "x", "subject": "y", "body": "z"}, "sources_used": []}}
    page.route('**/api/officer', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(FAKE, ensure_ascii=False)))
    go(page, 'officer'); page.click('[data-v21-country="sa"]'); page.click('#officer [data-mission="partner"]'); page.click('#msDispatch')
    page.wait_for_function('window.tggV26.state() && document.querySelector("#v26Stage [data-v26-step=\\"3\\"]").classList.contains("done")', timeout=20000)
    st = page.evaluate('window.tggV26.state()'); txt = page.inner_text('#deepContent')
    ok('PC 사전조사 없음 → AI 종합(사전조사 없음 표시·요청 답변)', st and st['mode'] == 'ai' and not st['card'] and '사전 심층조사 없음' in txt and '요청에 대한 답변' in txt, json.dumps(st, ensure_ascii=False))
    page.unroute('**/api/officer')
    ok('PC 콘솔 에러(폴백 세션, 의도된 네트워크 실패 제외)', not [e for e in errs2 if 'favicon' not in e and 'Failed to load resource' not in e and 'ERR_CONNECTION_REFUSED' not in e], ' | '.join(errs2)[:300])
    ctx.close()

    # ---------------- PC: AI 모드 ----------------
    if not NOAI:
        errs3 = []
        ctx = br.new_context(viewport={'width': 1280, 'height': 900}); page = ctx.new_page(); attach(page, errs3)
        page.goto(BASE + '?officerApi=http://localhost:8787', wait_until='load'); page.wait_for_timeout(800)
        st = dispatch(page, 'sa', 'supply', 'pc_ai_sa_supply', wait=70000, pdelay=2300)
        ok('PC 상무관 사우디·공급망 AI 종합', st and st['mode'] == 'ai', json.dumps(st, ensure_ascii=False)); AI_OK += 1 if st and st['mode'] == 'ai' else 0
        page.click('#deepFollowBtn'); page.wait_for_timeout(300); page.locator('#deepPanel').screenshot(path=f'{SHOTS}/pc_ai_sa_supply_follow.png')
        page.click('#msEnglish'); page.wait_for_timeout(200)
        ok('PC 영문 요청서(AI 초안)', 'Subject:' in page.inner_text('#msReportPreview'))
        page.click('#deepBriefBtn'); page.wait_for_timeout(200)
        page.click('#deepSendRed'); page.wait_for_timeout(500)
        ok('PC 상무관(AI)→빨간펜 전달', '국장 보고' in page.input_value('#reportInput'))
        page.click('#reportAnalyze')
        page.wait_for_function("(()=>{const p=document.getElementById('v26RpPanel');return p&&!p.hidden&&!p.querySelector('.v26-rp-wait')})()", timeout=60000)
        hm = 'AI 첨삭' in page.inner_text('#v26RpPanel .v26-rp-head')
        ok('PC 전달받은 상무관 보고서 AI 첨삭', hm, page.inner_text('#v26RpPanel .v26-rp-head').replace('\n', ' '))
        AI_OK += 1 if hm else 0
        page.locator('#v26RpPanel').locator('xpath=ancestor::div[contains(@class,"card")][1]').screenshot(path=f'{SHOTS}/pc_redpen_ai_handoff.png')
        AI_OK += redpen_ai(page, 'PC AI', range(6), 'pc_redpen_ai')
        ok('PC 콘솔 에러 없음(AI 세션)', not [e for e in errs3 if 'favicon' not in e], ' | '.join(errs3)[:300])
        ctx.close()

    # ---------------- 모바일 390 ----------------
    errs4 = []
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page(); attach(page, errs4)
    q = '' if NOAI else '?officerApi=http://localhost:8787'
    page.goto(BASE + q, wait_until='load'); page.wait_for_timeout(1200)
    page.screenshot(path=f'{SHOTS}/mobile_home.png')
    ok('모바일 홈 4개 업무 카드', page.locator('#storyNav .story-item').count() == 4)
    st = dispatch(page, 'id', 'entry', 'mobile_officer_id_entry', wait=70000, pdelay=2300 if not NOAI else 450)
    ok('모바일 상무관 인도네시아·기업진출 ' + ('AI 종합' if not NOAI else '규칙 종합'), st and st['mode'] == ('rule' if NOAI else 'ai'), json.dumps(st, ensure_ascii=False)); AI_OK += 1 if st and st['mode'] == 'ai' else 0
    sw = page.evaluate('document.documentElement.scrollWidth')
    ok('모바일 가로 넘침 없음', sw <= 392, f'scrollWidth={sw}')
    if NOAI:
        redpen_all(page, '모바일')
    else:
        AI_OK += redpen_ai(page, '모바일 AI', [1, 3], 'mobile_redpen_ai')
        page.locator('#v26RpPanel').scroll_into_view_if_needed(); page.screenshot(path=f'{SHOTS}/mobile_redpen_ai_view.png')
        page.goto(BASE + '?officerApi=http://localhost:9', wait_until='load'); page.wait_for_timeout(600)
        redpen_ai(page, '모바일 폴백', range(6), None, expect='fallback')
        redpen_ai(page, '모바일 폴백(스크린샷)', [0], 'mobile_redpen_fallback', expect='fallback')
    go(page, 'report'); page.screenshot(path=f'{SHOTS}/mobile_redpen.png')
    ok('모바일 콘솔 에러 없음(의도된 프록시 차단 제외)', not [e for e in errs4 if 'favicon' not in e and 'ERR_UNSAFE_PORT' not in e and 'ERR_CONNECTION_REFUSED' not in e], ' | '.join(errs4)[:300])
    ctx.close(); br.close()

passed = sum(1 for r in results if r[1])
print(f'\n결과: {passed}/{len(results)} 통과 · AI 성공 {AI_OK}건')
json.dump([{'name': n, 'pass': c, 'info': i} for n, c, i in results], open(os.path.join(SHOTS, 'regression_result.json'), 'w'), ensure_ascii=False, indent=1)

#!/usr/bin/env python3
"""out/*.json(Codex 결과)을 ../data/missions.json 으로 병합하고 간단 검증."""
import json, glob, os, re, datetime
here = os.path.dirname(os.path.abspath(__file__))
items, problems = {}, []
for f in sorted(glob.glob(os.path.join(here, 'out', '*.json'))):
    k = os.path.basename(f)[:-5]
    try:
        d = json.load(open(f, encoding='utf-8'))
    except Exception as e:
        problems.append(f'{k}: JSON 오류 {e}'); continue
    for x in d.get('key_facts', []) + d.get('indicators', []) + d.get('korea_links', []):
        if not re.match(r'^https?://', x.get('source_url', '')):
            problems.append(f'{k}: 출처 URL 없음 -> {str(x)[:60]}')
    seed = os.path.join(here, 'seeds', k + '.json')
    if os.path.exists(seed):
        sc = json.load(open(seed, encoding='utf-8'))['case']
        d['scenario'] = {kk: sc.get(kk) for kk in ('title', 'sector', 'request', 'decision', 'actions', 'questions', 'gate')}
    items[k] = d
urls = {x['source_url'] for d in items.values() for x in d.get('key_facts', []) + d.get('indicators', []) + d.get('korea_links', []) if x.get('source_url')}
urls |= {a['url'] for d in items.values() for a in d.get('agencies', []) if a.get('url')}
out = {"version": "v26", "generated_by": "Codex CLI (codex --search exec, ChatGPT 구독)",
       "generated_at": datetime.datetime.now().astimezone().isoformat(timespec='seconds'),
       "count": len(items), "unique_sources": len(urls), "missions": items}
json.dump(out, open(os.path.join(here, '..', 'data', 'missions.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'missions.json: {len(items)}건, 고유 출처 {len(urls)}개')
for p in problems: print('  주의:', p)

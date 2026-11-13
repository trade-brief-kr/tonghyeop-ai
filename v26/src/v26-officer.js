/* v26 · AI 상무관 파견: ①글로벌 통상 브리프 공개 JSON 실시간 조회 ②Codex 사전 심층조사(missions.json)
   ③현지 도착→정보 수집→분석→보고 연출 ④Gemini 무료 등급 종합(프록시) ⑤실패 시 규칙 종합 → v25 시나리오 폴백.
   기존 v21~v25 기능·저장키는 그대로 두고, 5개 중점국 파견 시 보고서 표시만 덧씌운다. */
(()=>{'use strict';
const E=id=>document.getElementById(id);
const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=u=>{try{const a=new URL(u);return ['https:','http:'].includes(a.protocol)?a.href:''}catch{return ''}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const toast=x=>{const b=E('toast');if(!b)return;b.textContent=x;b.classList.add('show');setTimeout(()=>b.classList.remove('show'),2700)};
if(!E('msDispatch')||!E('deepPanel'))return;

const KEYS=['mn','uz','in','sa','id'];
const META={mn:{ko:'몽골',flag:'🇲🇳',iso:'MN',re:/몽골|Mongolia/i},uz:{ko:'우즈베키스탄',flag:'🇺🇿',iso:'UZ',re:/우즈베키스탄|우즈벡|Uzbekistan/i},
 in:{ko:'인도',flag:'🇮🇳',iso:'IN',re:/인도(?!네시아|태평양|양|차이나|적|주의|산)|\bIndia\b/i},sa:{ko:'사우디아라비아',flag:'🇸🇦',iso:'SA',re:/사우디|Saudi/i},id:{ko:'인도네시아',flag:'🇮🇩',iso:'ID',re:/인도네시아|Indonesia/i}};
const COUNTRY_TAG={mn:['몽골'],uz:['우즈베키스탄'],in:['인도'],sa:['사우디','사우디아라비아'],id:['인도네시아']};
const MTITLE={supply:'공급망 긴급 대응',entry:'우리 기업 해외진출 지원',partner:'정부 간 협력창구 발굴'};
const BRIEF='https://trade-brief-kr.github.io/trade-brief/';
const API=(()=>{const q=new URLSearchParams(location.search).get('officerApi');const v=String(q||window.TGG_OFFICER_API||'').trim().replace(/\/+$/,'');return safeUrl(v)?v:''})();
const mission=()=>document.querySelector('#officer [data-mission].selected')?.dataset.mission||'supply';

async function getJSON(url,ms=8000){const ac=new AbortController(),t=setTimeout(()=>ac.abort(),ms);try{const r=await fetch(url,{cache:'no-store',signal:ac.signal});if(!r.ok)throw Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(t)}}

// ---------- ② 사전 심층조사 (data/missions.json → 실패 시 HTML 내장본) ----------
let MISSIONS=null,missionSrc='';
async function loadMissions(){if(MISSIONS)return MISSIONS;
 try{const d=await getJSON('data/missions.json',5000);if(d&&d.missions){MISSIONS=d.missions;missionSrc='data/missions.json';return MISSIONS}}catch{}
 try{const d=JSON.parse(E('v26MissionsInline')?.textContent||'null');if(d&&d.missions){MISSIONS=d.missions;missionSrc='내장 사본';return MISSIONS}}catch{}
 return null}

// ---------- ① 글로벌 통상 브리프 공개 JSON ----------
const briefCache={};
function matchReport(rep,cc){const out=[],m=META[cc],tags=COUNTRY_TAG[cc];
 (rep.departments||[]).forEach(dep=>(dep.issues||[]).forEach(is=>{const text=`${is.title||''} ${(is.bullets||[]).map(b=>b.text).join(' ')}`;
  if((is.countries||[]).some(c=>tags.includes(c))||m.re.test(text))out.push({date:rep.date,title:String(is.title||''),category:is.category||'',bullets:(is.bullets||[]).slice(0,3).map(b=>String(b.text||'')),links:(is.bullets||[]).map(b=>({source:b.source,url:safeUrl(b.url)})).filter(x=>x.url).slice(0,2)})}));
 (rep.topIssues||[]).forEach(t=>{if(m.re.test(t.text||''))out.push({date:rep.date,title:String(t.text||''),category:'오늘의 TOP',bullets:[],links:safeUrl(t.url)?[{source:t.source,url:safeUrl(t.url)}]:[]})});
 return out}
async function loadBrief(cc){const c=briefCache[cc];if(c&&Date.now()-c.at<600000)return c.data;
 const latest=await getJSON(BRIEF+'data/report.json');
 if(!Array.isArray(latest.departments))throw Error('브리프 형식 확인 필요');
 let items=matchReport(latest,cc),scanned=1;
 if(items.length<3){try{const idx=await getJSON(BRIEF+'data/archive/index.json',6000);
  const dates=(Array.isArray(idx)?idx:idx.reports||idx.days||[]).map(x=>typeof x==='string'?x:x.date).filter(d=>/^\d{4}-\d\d-\d\d$/.test(d)&&d!==latest.date).slice(0,6);
  const reps=await Promise.allSettled(dates.map(d=>getJSON(BRIEF+'data/archive/'+d+'.json',6000)));
  reps.forEach(r=>{if(r.status==='fulfilled'){scanned++;items=items.concat(matchReport(r.value,cc))}})}catch{}}
 const seen=new Set();items=items.filter(x=>{const k=x.title.slice(0,40);if(seen.has(k))return false;seen.add(k);return true}).slice(0,6);
 const data={date:latest.date,generatedAt:latest.generatedAt,items,scanned};briefCache[cc]={at:Date.now(),data};return data}

// ---------- ③ 진행 연출 ----------
const stage=document.createElement('div');stage.id='v26Stage';stage.hidden=true;
stage.innerHTML=`<div class="v26-stage-head"><b>🛰️ AI 상무관 현지 파견 진행</b><span id="v26Mode" class="v26-badge run">● 진행 중</span></div>
<div class="v26-steps">${[['🛬','현지 도착'],['📡','정보 수집'],['🧠','분석'],['📑','보고']].map(([i,t],n)=>`<div class="v26-step" data-v26-step="${n}"><span class="v26-ico">${i}</span><strong>${t}</strong><small>대기</small></div>`).join('')}</div>`;
const out=E('msOutput');(out.querySelector('.mission-kpi-row')||out.firstElementChild)?.before(stage);
function step(n,cls,msg){const el=stage.querySelector(`[data-v26-step="${n}"]`);if(!el)return;el.classList.remove('active','done','fail');if(cls)el.classList.add(cls);if(msg!=null)el.querySelector('small').textContent=msg}
const MODE={ai:['ai','🤖 AI 종합 · Gemini 무료 등급'],rule:['rule','🧩 규칙 종합 · 브리프+사전조사'],v25:['v25','📁 v25 기본 시나리오'],run:['run','● 진행 중']};
function setMode(k,extra=''){const [c,t]=MODE[k];const b=E('v26Mode');b.className='v26-badge '+c;b.textContent=t+(extra?` · ${extra}`:'')}

// ---------- 상태 ----------
let run=0,cur=null,view='brief',checks={};
const disc=document.querySelector('#deepPanel .deep-disclaimer'),discOrig=disc?.innerHTML||'';
const label=document.querySelector('#deepPanel .deep-label'),labelOrig=label?.textContent||'';
function resetV26(){run++;cur=null;stage.hidden=true;if(disc)disc.innerHTML=discOrig;if(label)label.textContent=labelOrig}
E('msCountry').addEventListener('change',resetV26);E('msSector').addEventListener('change',resetV26);
document.querySelectorAll('#officer [data-mission]').forEach(b=>b.addEventListener('click',resetV26));

// ---------- ⑤ 규칙 종합 ----------
function ruleSynth(card,brief,cc){const sc=card.scenario||{},n=brief?.items?.length||0,co=META[cc].ko;
 const st=card.status_hint||{status:'주의',reason:'[확인 필요]'};
 const refsB=(brief?.items||[]).map((_,i)=>'B'+(i+1));
 return {brief_lines:[`(판단) ${sc.decision||card.summary}`.slice(0,160),
   n?`(동향) 글로벌 통상 브리프 최근 ${brief.scanned}일 중 ${co} 관련 이슈 ${n}건 — 「${brief.items[0].title.slice(0,50)}」 등, 임무 관련성 [확인 필요]`:`(동향) 글로벌 통상 브리프 최근 ${brief?brief.scanned+'일':'자료'}에서 ${co} 직접 관련 이슈 없음 — 사전조사 기준으로 판단`,
   `(건의) ${(sc.actions||[])[0]||'소관기관 확인 후 협의 착수 여부 결정'}`.slice(0,160)],
  status:{level:st.status,reason:st.reason},
  opportunities:(card.opportunities||[]).slice(0,3).map(t=>({text:t,refs:[]})),
  risks:(card.risks||[]).slice(0,3).map(t=>({text:t,refs:[]})).concat(n?[{text:`최근 브리프 동향(${brief.items.slice(0,2).map(x=>x.title.slice(0,30)).join(' / ')})의 임무 영향 점검 [확인 필요]`,refs:refsB.slice(0,2)}]:[]),
  next_actions:(sc.actions||[]).slice(0,4).map((a,i)=>({action:a,when:['이번 주','2주 내','1개월 내','후속'][i]})),
  verify:[...(card.uncertain||[]),...(card.questions||[])].slice(0,6),
  request_letter:{to:(card.agencies||[])[0]?.name||'소관기관',subject:`Request for Information — ${sc.title||card.title}`,
   body:`Dear Sir or Madam,\n\nWe are conducting a preliminary review based on public information regarding "${sc.title||card.title}". We would appreciate your guidance on the following points:\n\n${(card.questions||[]).slice(0,5).map((q,i)=>`${i+1}. ${q} (번역 필요)`).join('\n')}\n\nThis request is for information purposes only and does not imply any commitment.\n\nSincerely,\n[Agency / Officer]`},
  sources_used:[]}}

// ---------- ④ AI 종합 (프록시) ----------
async function callAI(payload){const ac=new AbortController(),t=setTimeout(()=>ac.abort(),55000);
 try{const r=await fetch(API+'/api/officer',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:ac.signal});
  const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok)throw Error(j.error==='rate_limited'||j.error==='upstream_quota'?'무료 한도 초과':j.error||('HTTP '+r.status));return j}
 catch(e){throw Error(e.name==='AbortError'?'응답 시간 초과':/Failed to fetch|NetworkError|Load failed/i.test(e.message)?'AI 서버 연결 실패':e.message)}finally{clearTimeout(t)}}

// ---------- 렌더링 ----------
function refLinks(refs){return (refs||[]).map(id=>{const s=cur.refs[id];return s?`<a class="v26-ref" href="${h(s.url)}" target="_blank" rel="noopener noreferrer" title="${h(s.title)}">${h(id)}</a>`:''}).join('')}
function modeNote(){return cur.mode==='ai'?`※ AI 종합(${h(cur.model||'Gemini')}): 아래 근거(B=글로벌 통상 브리프, M=사전 심층조사)만 사용하도록 지시한 생성 결과입니다. 수치·기관 소관·일정은 원문 확인 필요. 우리측 요청은 시연용 가상 설정입니다. 비공개 자료 입력 금지.`
 :`※ 규칙 종합${cur.why?` (AI 미사용: ${h(cur.why)})`:''}: 글로벌 통상 브리프 실시간 조회 결과와 Codex 사전 심층조사(확인일 ${h(cur.card.checked_date)})를 정해진 규칙으로 조합했습니다. 생성형 AI 분석이 아닙니다. 비공개 자료 입력 금지.`}
function briefBlock(){const b=cur.brief,co=META[cur.cc];
 const link=`<a href="${BRIEF}?tab=country&country=${co.iso}" target="_blank" rel="noopener noreferrer">글로벌 통상 브리프에서 ${h(co.ko)} 보기 ↗</a>`;
 if(!b)return `<div class="v21-box v21-sim">글로벌 통상 브리프 연결에 실패해 사전조사만으로 작성했습니다. ${link}</div>`;
 return (b.items.length?b.items.map((x,i)=>`<div class="v26-brief-item"><span class="v26-ref">B${i+1}</span> <b>${h(x.title)}</b><br><small>${h(x.date)} · ${h(x.category)}</small>${x.bullets.length?`<ul>${x.bullets.map(t=>`<li>${h(t)}</li>`).join('')}</ul>`:''}<div>${x.links.map(l=>`<a href="${h(l.url)}" target="_blank" rel="noopener noreferrer">${h(l.source||'원문')} ↗</a>`).join('')}</div></div>`).join('')
  :`<p>최근 ${b.scanned}일 브리프에서 ${h(co.ko)} 직접 관련 이슈가 없습니다.</p>`)+`<p class="v21-min">브리프 기준일 ${h(b.date)} · 원본 게시 ${h((b.generatedAt||'').replace('T',' ').slice(0,16))} · ${link}</p>`}
function sourcesBlock(){return Object.entries(cur.refs).map(([id,s])=>`<div class="v26-src">[${h(id)}] ${h(s.title)} · <a href="${h(s.url)}" target="_blank" rel="noopener noreferrer">${h(s.url)}</a></div>`).join('')}
function head(sub){const co=META[cur.cc],r=cur.result;return `<div class="deep-kicker">${co.flag} ${h(co.ko)} · ${h(MTITLE[cur.m])} · ${h(sub)}</div><div class="v26-modebar"><span class="v26-badge ${MODE[cur.mode][0]}">${MODE[cur.mode][1]}${cur.mode==='ai'&&cur.model?' · '+h(cur.model):''}</span><span class="v26-status s-${h(r.status.level)}">임무 진척 · ${h(r.status.level)}</span></div><h2>${h(cur.card.scenario?.title||cur.card.title)}</h2>`}
function briefHTML(){const r=cur.result;return `<div class="v21-report-panel v26-report">${head('국장 보고용 1페이지')}
 <div class="v21-lead"><b>국장 보고 3줄</b><ol class="v26-lines">${r.brief_lines.map(x=>`<li>${h(x)}</li>`).join('')}</ol></div>
 <h3>□ 임무 진척: ${h(r.status.level)}</h3><p>${h(r.status.reason)}</p>
 <h3>□ 새 기회</h3><ul>${r.opportunities.map(x=>`<li>${h(x.text)}${refLinks(x.refs)}</li>`).join('')||'<li>[확인 필요]</li>'}</ul>
 <h3>□ 새 위험</h3><ul>${r.risks.map(x=>`<li>${h(x.text)}${refLinks(x.refs)}</li>`).join('')||'<li>[확인 필요]</li>'}</ul>
 <h3>□ 오늘의 글로벌 통상 브리프 · ${h(META[cur.cc].ko)} 관련</h3>${briefBlock()}
 <h3>□ 근거 자료</h3>${sourcesBlock()}<div class="v21-min" style="margin-top:12px">${modeNote()}</div></div>`}
function detailHTML(){const c=cur.card,sc=c.scenario||{};let i=0;return `<div class="v21-report-panel v26-report">${head('실무 검토용 상세보고 · 사전 심층조사 확인일 '+c.checked_date)}
 <h3>1. 현황 요약 <span class="v21-verified">공개자료</span></h3><p>${h(c.summary)}</p>
 <h3>2. 공개자료로 확인한 사실</h3><div class="v21-box v21-facts"><ul>${(c.key_facts||[]).map(f=>`<li><span class="v26-conf ${f.confidence==='확인'?'ok':'chk'}">${h(f.confidence)}</span>${h(f.fact)} <span class="v26-ref">M${++i}</span> <a href="${h(safeUrl(f.source_url))}" target="_blank" rel="noopener noreferrer">${h(f.source_title)} ↗</a></li>`).join('')}</ul></div>
 ${(c.indicators||[]).length?`<h3>3. 주요 지표</h3><table class="v21-tbl"><thead><tr><th>지표</th><th>값</th><th>기준</th><th>출처</th></tr></thead><tbody>${c.indicators.map(x=>`<tr><td>${h(x.name)}</td><td>${h(x.value)}</td><td>${h(x.as_of)}</td><td><a href="${h(safeUrl(x.source_url))}" target="_blank" rel="noopener noreferrer">원문 ↗</a></td></tr>`).join('')}</tbody></table>`:''}
 <h3>4. 상대국 협의대상 기관</h3><table class="v21-tbl"><thead><tr><th>기관</th><th>역할</th><th>공식 참고</th></tr></thead><tbody>${(c.agencies||[]).map(a=>`<tr><td><b>${h(a.name)}</b></td><td>${h(a.role)}</td><td>${safeUrl(a.url)?`<a href="${h(a.url)}" target="_blank" rel="noopener noreferrer">링크 ↗</a>`:'[확인 필요]'}</td></tr>`).join('')}</tbody></table>
 <h3>5. 한국과의 협력 연결고리</h3><ul>${(c.korea_links||[]).map(k=>`<li>${h(k.text)} <a href="${h(safeUrl(k.source_url))}" target="_blank" rel="noopener noreferrer">근거 ↗</a></li>`).join('')}</ul>
 <h3>6. 기회 · 위험 (사전조사)</h3><ul>${(c.opportunities||[]).map(x=>`<li>🟢 ${h(x)}</li>`).join('')}${(c.risks||[]).map(x=>`<li>🔴 ${h(x)}</li>`).join('')}</ul>
 <h3>7. 확인 필요 사항</h3><ul>${(c.uncertain||[]).map(x=>`<li>${h(x)}</li>`).join('')||'<li>없음</li>'}</ul>
 <h3>8. v25 시나리오 판단 기준 <span class="v21-fixtag">가상 설정</span></h3><p><b>판단:</b> ${h(sc.decision)}</p><div class="v21-quote">진전 판단 조건 | ${h(sc.gate)}</div>
 <h3>9. 오늘의 글로벌 통상 브리프</h3>${briefBlock()}
 <p class="v21-min">사전 심층조사: Codex CLI 웹검색 생성(확인일 ${h(c.checked_date)}, ${h(missionSrc)}). 외부 사이트는 갱신될 수 있어 원문 재확인 필요.</p></div>`}
function followHTML(){const r=cur.result,k=cur.cc+'|'+cur.m,ch=checks[k]||{};return `<div class="v21-report-panel v26-report">${head('후속조치 관리카드')}
 <div class="v21-lead">${h(r.brief_lines[2])}</div><p>담당자가 직접 확인 여부를 표시합니다. 상대국 기관에 자동 연락하지 않습니다.</p>
 ${r.next_actions.map((a,i)=>`<label class="v21-follow-row"><input type="checkbox" data-v26-check="${i}" ${ch[i]?'checked':''}><span><b>조치 ${i+1}</b>${a.when?` · <em>${h(a.when)}</em>`:''} · ${h(a.action)}</span></label>`).join('')}
 <h3>현지·공식 확인 필요 사항</h3><ol>${r.verify.map(x=>`<li>${h(x)}</li>`).join('')}</ol>
 <h3>현지 확인 요청서 초안 <span class="v21-fixtag">발송 전 검토</span></h3><p class="v21-min">수신: ${h(r.request_letter.to)} · 제목: ${h(r.request_letter.subject)}</p><pre class="v26-letter" id="v26Letter">${h(r.request_letter.body)}</pre>
 <div class="buttons" style="margin-top:8px"><button class="ghost" type="button" id="v26LetterCopy">✉ 요청서 복사</button></div>
 <p class="v21-min">${modeNote()}</p></div>`}
function renderV26(){if(!cur)return;const c=E('deepContent');c.innerHTML=view==='detail'?detailHTML():view==='follow'?followHTML():briefHTML();
 Object.entries({brief:'deepBriefBtn',detail:'deepDetailBtn',follow:'deepFollowBtn'}).forEach(([k,id])=>E(id)?.classList.toggle('selected',view===k));
 c.querySelectorAll('[data-v26-check]').forEach(x=>x.addEventListener('change',()=>{(checks[cur.cc+'|'+cur.m]??={})[x.dataset.v26Check]=x.checked}));
 E('v26LetterCopy')?.addEventListener('click',async()=>{const t=`To: ${cur.result.request_letter.to}\nSubject: ${cur.result.request_letter.subject}\n\n${cur.result.request_letter.body}`;try{await navigator.clipboard.writeText(t);toast('요청서 초안을 복사했습니다.')}catch{toast('복사 권한이 없어 화면에서 직접 선택해 주세요.')}})}
function previewText(){const r=cur.result,co=META[cur.cc];return `${cur.card.scenario?.title||cur.card.title}\n[${MODE[cur.mode][1]}${cur.mode==='ai'&&cur.model?' · '+cur.model:''}]\n\n□ 국장 보고 3줄\n${r.brief_lines.map((x,i)=>` ${i+1}. ${x}`).join('\n')}\n\n□ 임무 진척: ${r.status.level} — ${r.status.reason}\n\n□ 새 기회\n${r.opportunities.map(x=>' ㅇ '+x.text+(x.refs.length?' ['+x.refs.join(',')+']':'')).join('\n')}\n\n□ 새 위험\n${r.risks.map(x=>' ㅇ '+x.text+(x.refs.length?' ['+x.refs.join(',')+']':'')).join('\n')}\n\n□ 오늘의 글로벌 통상 브리프 (${co.ko})\n${cur.brief?.items?.length?cur.brief.items.map((x,i)=>` [B${i+1}] ${x.date} ${x.title}`).join('\n'):' ㅇ 최근 직접 관련 이슈 없음'}\n\n□ 다음 조치\n${r.next_actions.map(a=>' ㅇ '+(a.when?`(${a.when}) `:'')+a.action).join('\n')}\n\n□ 근거\n${Object.entries(cur.refs).map(([id,s])=>` [${id}] ${s.title} ${s.url}`).join('\n')}\n\n※ 우리측 요청은 시연용 가상 설정. 수치·소관·일정은 원문 확인 필요.`}
function applyOutputs(){E('msResultChip').textContent=MODE[cur.mode][1];E('msReportPreview').textContent=previewText();
 E('msStatus').textContent=cur.mode==='ai'?'AI 상무관 보고 완료 · 브리프 실시간 조회 + 사전 심층조사 + AI 종합':'보고 완료 · 브리프 실시간 조회 + 사전 심층조사 규칙 종합';
 if(disc)disc.innerHTML=cur.mode==='ai'?'이 보고서는 <b>글로벌 통상 브리프(실시간 공개 JSON)</b>와 <b>사전 심층조사(공개자료·출처 포함)</b>를 근거로 <b>생성형 AI(Gemini 무료 등급)</b>가 종합한 검토초안입니다. AI 문장은 틀릴 수 있으므로 근거 링크 대조와 담당자 최종 검토가 필요합니다. 비공개 자료 입력 금지.':'이 보고서는 <b>글로벌 통상 브리프(실시간 공개 JSON)</b>와 <b>사전 심층조사(공개자료·출처 포함)</b>를 규칙으로 조합한 <b>시연용 검토초안</b>이며 생성형 AI 분석 결과가 아닙니다. 담당자의 공식자료 대조 및 최종 검토가 필요합니다.';
 if(label)label.textContent=cur.mode==='ai'?'AI 종합 · 검증 필요':'규칙 종합 · 검증 필요'}

// ---------- 파견 파이프라인 ----------
async function v26Dispatch(){const cc=E('msCountry').value,m=mission();if(!KEYS.includes(cc)){resetV26();return}
 const id=++run;cur=null;view='brief';stage.hidden=false;setMode('run');[0,1,2,3].forEach(n=>step(n,'','대기'));
 const co=META[cc];step(0,'active',`${co.flag} ${co.ko} 도착 · ${MTITLE[m]} 임무 접수`);
 setTimeout(()=>{if(id===run&&!cur)E('deepContent').innerHTML='<div class="v26-placeholder">🛰️ AI 상무관이 현지 자료를 수집·분석하고 있습니다…</div>'},260);
 await sleep(800);if(id!==run)return;step(0,'done');
 step(1,'active','글로벌 통상 브리프 공개 JSON · 사전 심층조사 수집 중…');
 const [bR,mR]=await Promise.allSettled([loadBrief(cc),loadMissions()]);if(id!==run)return;
 const brief=bR.status==='fulfilled'?bR.value:null,card=(mR.status==='fulfilled'&&mR.value)?mR.value[`${cc}_${m}`]:null;
 step(1,brief||card?'done':'fail',`브리프 ${brief?`${brief.items.length}건(최근 ${brief.scanned}일)`:'연결 실패'} · 사전조사 ${card?`사실 ${card.key_facts.length}건`:'없음'}`);
 if(!card){step(2,'fail','사전조사 없음 → v25 시나리오 사용');step(3,'done','v25 기본 보고서 표시');setMode('v25');E('deepContent').innerHTML='';E('deepBriefBtn')?.click();return}
 const refs={};(brief?.items||[]).forEach((x,i)=>{refs['B'+(i+1)]={title:`글로벌 통상 브리프 ${x.date} · ${x.title.slice(0,60)}`,url:x.links[0]?.url||`${BRIEF}#${x.date}`}});
 (card.key_facts||[]).forEach((f,i)=>{refs['M'+(i+1)]={title:f.source_title,url:safeUrl(f.source_url)}});
 let result=null,mode='rule',model='',why='';
 if(API){step(2,'active','Gemini 무료 등급으로 종합 분석 중…');
  const payload={country:co.ko,countryCode:cc,missionTitle:MTITLE[m],request:(E('msRequest').value||'').slice(0,1200),
   brief:brief?{date:brief.date,items:brief.items.map(x=>({date:x.date,title:x.title,bullets:x.bullets}))}:null,
   research:{checked_date:card.checked_date,summary:card.summary,facts:card.key_facts,opportunities:card.opportunities,risks:card.risks,agencies:card.agencies,questions:card.questions},
   scenario:card.scenario||{}};
  try{const j=await callAI(payload);result=j.result;mode='ai';model=j.model||''}catch(e){why=e.message}
  if(id!==run)return}else why='AI 프록시 미설정';
 if(!result){result=ruleSynth(card,brief,cc);mode='rule'}
 result.brief_lines=result.brief_lines.map(x=>String(x).replace(/^\s*(?:[①②③④]|\d+[.)])\s*/,''));
 step(2,mode==='ai'?'done':'fail',mode==='ai'?`AI 종합 완료 · ${model}`:`규칙 종합 전환 (${why})`);
 step(3,'active','국장 보고·상세·후속조치 작성');await sleep(350);if(id!==run)return;
 cur={cc,m,card,brief,result,mode,model,why,refs};setMode(mode,mode==='ai'?model:'');applyOutputs();
 E('deepPanel').hidden=false;renderV26();step(3,'done','보고 완료 · 아래 보고서 확인');
 toast(mode==='ai'?'AI 상무관 종합보고가 도착했습니다.':'AI 미연결 · 규칙 종합 보고서로 표시합니다.')}
E('msDispatch').addEventListener('click',()=>setTimeout(v26Dispatch,0));
document.querySelectorAll('[data-ms-case]').forEach(b=>b.addEventListener('click',()=>setTimeout(v26Dispatch,120)));

// 기존 탭·영문요청서 버튼: v26 결과가 있을 때만 가로채고, 없으면 기존(v21~v25) 동작 그대로
document.addEventListener('click',ev=>{if(!cur)return;const t=ev.target.closest?.('#deepBriefBtn,#deepDetailBtn,#deepFollowBtn,#msEnglish');if(!t)return;
 ev.stopImmediatePropagation();ev.preventDefault();
 if(t.id==='msEnglish'){const p=E('msReportPreview'),en=t.dataset.v26En!=='1';t.dataset.v26En=en?'1':'0';const L=cur.result.request_letter;p.textContent=en?`To: ${L.to}\nSubject: ${L.subject}\n\n${L.body}`:previewText();t.textContent=en?'🇰🇷 한국어 보고서':'✉ 영문 협조 요청서';return}
 view=t.id==='deepDetailBtn'?'detail':t.id==='deepFollowBtn'?'follow':'brief';renderV26()},true);
window.tggV26={version:'26',api:()=>API||'(미설정)',state:()=>cur&&{cc:cur.cc,m:cur.m,mode:cur.mode,model:cur.model,brief:cur.brief?.items?.length??null}};
})();

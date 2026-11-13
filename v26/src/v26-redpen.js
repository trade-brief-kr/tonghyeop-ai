/* v26 · 배국장의 AI 빨간펜: v25 규칙 첨삭(즉시) → 같은 프록시의 /api/redpen 으로 Gemini 문장 첨삭 추가.
   AI 실패·시간초과·미설정 시 규칙 결과만 유지. v25 빨간펜 코드는 수정·삭제하지 않음. */
(()=>{'use strict';
const E=id=>document.getElementById(id);
const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=u=>{try{const a=new URL(u);return ['https:','http:'].includes(a.protocol)?a.href:''}catch{return ''}};
const toast=x=>{const b=E('toast');if(!b)return;b.textContent=x;b.classList.add('show');setTimeout(()=>b.classList.remove('show'),2700)};
const input=E('reportInput'),analyze=E('reportAnalyze'),issues=E('reportIssues');
if(!input||!analyze||!issues)return;
const MAX=6000;
const API=(()=>{const q=new URLSearchParams(location.search).get('officerApi');const v=String(q||window.TGG_OFFICER_API||'').trim().replace(/\/+$/,'');return safeUrl(v)?v:''})();

// ---------- 안내문 + 글자 수 ----------
const note=document.createElement('div');note.id='v26RpNotice';note.className='v26-rp-notice';
note.innerHTML='<span>🔒 <b>공개·가상 문서만 넣으세요.</b> 실시간 AI 첨삭은 Gemini 무료 등급을 사용하며, 무료 등급 입력 내용은 Google의 서비스 개선에 활용될 수 있습니다. 비공개·대외비 자료 입력 금지.</span><span class="v26-rp-count" id="v26RpCount"></span>';
input.after(note);
function count(){const n=input.value.length,c=E('v26RpCount');c.textContent=`${n.toLocaleString()} / ${MAX.toLocaleString()}자${n>MAX?' · AI 첨삭 한도 초과':''}`;c.classList.toggle('over',n>MAX)}
input.addEventListener('input',count);count();
document.querySelectorAll('[data-go="report"]').forEach(b=>b.addEventListener('click',()=>setTimeout(count,60)));

// ---------- 결과 패널 ----------
const panel=document.createElement('div');panel.id='v26RpPanel';panel.hidden=true;panel.setAttribute('aria-live','polite');
(issues.closest('.detail')||issues).after(panel);
const BADGE={ai:['ai','🤖 AI 첨삭'],rule:['rule','🧩 규칙 점검'],v25:['v25','📁 v25 기본']};
const badge=(k,extra='')=>`<span class="v26-badge ${BADGE[k][0]}">${BADGE[k][1]}${extra?` · ${h(extra)}`:''}</span>`;
let run=0,last=null;
const baseMode=()=>/개선/.test(E('reportCheckTag')?.textContent||'')?'v25':'rule';
const baseLabel=k=>k==='v25'?'사전 작성 모범안(v25)':'규칙 기반 구조화';
function reset(){run++;last=null;panel.hidden=true;panel.innerHTML=''}
E('reportLoad')?.addEventListener('click',reset);E('reportSample')?.addEventListener('change',reset);
['msSendRed','deepSendRed'].forEach(id=>E(id)?.addEventListener('click',()=>setTimeout(()=>{reset();count()},30)));

function rules(){return [...document.querySelectorAll('#ruleList .rule-row')].map(r=>`${r.querySelector('b')?.textContent||''}: ${r.querySelector('.hint')?.textContent||''}`).filter(x=>x.length>2).slice(0,8)}
function waiting(base){panel.hidden=false;panel.innerHTML=`<div class="v26-rp-head"><b>배국장의 AI 문장 첨삭</b>${badge(base)}<span class="v26-badge run">● AI 요청 중</span></div><div class="v26-rp-wait">위 규칙 점검 결과를 먼저 표시했습니다. Gemini 무료 등급으로 문장별 첨삭을 받는 중…</div>`}
function fallback(base,why){panel.hidden=false;panel.innerHTML=`<div class="v26-rp-head"><b>배국장의 빨간펜 결과</b>${badge(base)}</div><div class="v26-rp-note">AI 문장 첨삭 미사용(${h(why)}) · 위 <b>${baseLabel(base)}</b> 결과만 표시합니다. 내용과 사실관계는 담당자가 확인해 주세요.</div>`}
function render(base,j){const r=j.result;last=r;panel.hidden=false;
 panel.innerHTML=`<div class="v26-rp-head"><b>배국장의 AI 문장 첨삭</b>${badge('ai',j.model||'Gemini')}${badge(base)}</div>
 <div class="v26-rp-overall"><b>국장 총평</b> · ${h(r.overall)}</div>
 ${r.corrections.map((c,i)=>`<div class="v26-rp-item"><div><span class="cat">${i+1}. ${h(c.category)}</span></div>
  <div><span class="v26-rp-lbl">원문</span> <span class="v26-rp-orig">${h(c.original)}</span></div>
  <div><span class="v26-rp-lbl">수정</span> <span class="v26-rp-rev">${h(c.revised)}</span></div>
  <div class="v26-rp-why">💬 ${h(c.reason)}</div>
  ${c.matched?'':'<span class="v26-rp-flag">원문 위치 [확인 필요]</span>'}${c.new_numbers?.length?`<span class="v26-rp-flag">원문에 없는 숫자 ${h(c.new_numbers.join(', '))} [확인 필요]</span>`:''}</div>`).join('')}
 ${r.verify?.length?`<div class="v26-rp-note"><b>보고 전 확인할 사항</b></div><ul class="v26-rp-verify">${r.verify.map(x=>`<li>${h(x)}</li>`).join('')}</ul>`:''}
 <div class="buttons" style="margin-top:9px"><button class="ghost" type="button" id="v26RpCopy">AI 첨삭 복사</button></div>
 <div class="v26-rp-note">※ 생성형 AI(Gemini 무료 등급) 첨삭은 틀릴 수 있습니다. 원문에 없는 사실은 [확인 필요]로 표시하도록 지시했으며, 최종 판단은 담당자가 합니다.</div>`;
 E('v26RpCopy').onclick=async()=>{const t=`[배국장의 AI 문장 첨삭]\n총평: ${r.overall}\n\n`+r.corrections.map((c,i)=>`${i+1}. (${c.category})\n- 원문: ${c.original}\n- 수정: ${c.revised}\n- 이유: ${c.reason}`).join('\n\n')+(r.verify.length?`\n\n[확인 필요]\n${r.verify.map(x=>'- '+x).join('\n')}`:'');
  try{await navigator.clipboard.writeText(t);toast('AI 첨삭을 복사했습니다.')}catch{toast('복사 권한이 없어 화면에서 직접 선택해 주세요.')}}}

async function runAI(){const text=input.value.trim();count();if(!text){reset();return}
 const id=++run,base=baseMode();
 if(!API){fallback(base,'AI 프록시 미설정');return}
 if(text.length>MAX){fallback(base,`${MAX.toLocaleString()}자 초과`);return}
 if(text.length<20){fallback(base,'문서가 너무 짧음');return}
 waiting(base);
 const ac=new AbortController(),t=setTimeout(()=>ac.abort(),45000);
 try{const r=await fetch(API+'/api/redpen',{method:'POST',headers:{'content-type':'application/json'},signal:ac.signal,
   body:JSON.stringify({text,reportType:E('reportType')?.value||'',audience:E('reportAudience')?.value||'',rules:rules()})});
  const j=await r.json().catch(()=>({}));if(id!==run)return;
  if(!r.ok||!j.ok||!j.result||!Array.isArray(j.result.corrections)||!j.result.corrections.length)throw Error(j.error==='rate_limited'||j.error==='upstream_quota'?'무료 한도 초과':j.message||j.error||('HTTP '+r.status));
  render(base,j);toast('배국장의 AI 문장 첨삭이 도착했습니다.')}
 catch(e){if(id!==run)return;fallback(base,e.name==='AbortError'?'응답 시간 초과':/Failed to fetch|NetworkError|Load failed/i.test(e.message)?'AI 서버 연결 실패':String(e.message||e).slice(0,60))}
 finally{clearTimeout(t)}}
analyze.addEventListener('click',()=>setTimeout(runAI,0));
window.tggV26Redpen={api:()=>API||'(미설정)',state:()=>({mode:last?'ai':(panel.hidden?null:'fallback'),n:last?.corrections?.length||0})};
})();

let PROMO_ALL=[];
let PROMO_CYCLES=[];
let PROMO_EVALUATIONS=new Map();
let PROMO_REVIEWS=new Map();
let PROMO_ACTIVE_CYCLE=null;

async function initPromotion(){
  APP.initHeader();
  PROMO_ALL=await APP.loadEmployees();
  fillPromotionFilters();
  bindPromotionFilters();
  renderPromotionStats();
  renderPromotionRows();
}
function isPromotionCandidate(e){return e.promotion_target_flag===true||e.promotion_target_flag==='true';}
function unique(v){return [...new Set(v.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'ja'));}
function fillPromoSelect(id,items,label){const el=document.getElementById(id);if(el)el.innerHTML=`<option value="">${label}</option>`+items.map(v=>`<option value="${APP.escape(v)}">${APP.escape(v)}</option>`).join('');}
function fillPromotionFilters(){
  fillPromoSelect('promo-center',unique(PROMO_ALL.map(e=>e.center)),'全センター');
  fillPromoSelect('promo-position',unique(PROMO_ALL.map(e=>e.position)),'全職種');
  fillPromoSelect('promo-grade',unique(PROMO_ALL.map(e=>e.current_grade)),'全等級');
}
function bindPromotionFilters(){
  ['promo-keyword','promo-center','promo-position','promo-grade','promo-scope','promo-tenure','promo-date-status','promo-sort','promo-decision'].forEach(id=>document.getElementById(id)?.addEventListener('input',()=>{renderPromotionStats();renderPromotionRows();}));
  document.getElementById('btn-clear-promo-filter')?.addEventListener('click',()=>{
    ['promo-keyword','promo-center','promo-position','promo-grade','promo-tenure','promo-date-status'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    const scope=document.getElementById('promo-scope');if(scope)scope.value='candidate';
    const sort=document.getElementById('promo-sort');if(sort)sort.value='tenure-desc';
    renderPromotionStats();renderPromotionRows();
  });
  document.getElementById('promo-cycle')?.addEventListener('change',async e=>selectPromotionCycle(e.target.value));
  document.getElementById('btn-export-promotion')?.addEventListener('click',exportPromotionCSV);
  document.getElementById('btn-save-promo-review')?.addEventListener('click',savePromotionReview);
}

function fiscalYearJST(){
  const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit'}).formatToParts(new Date());
  const y=Number(p.find(x=>x.type==='year')?.value),m=Number(p.find(x=>x.type==='month')?.value);
  return m>=4?y:y-1;
}
async function initAnnualPromotionManagement(){
  const sb=APP.client(),status=document.getElementById('promo-cycle-status'); if(!sb)return;
  const q=await sb.from('evaluation_cycles').select('*').order('fiscal_year',{ascending:false});
  if(q.error){APP.toast(q.error.message,'error');return;}
  PROMO_CYCLES=q.data||[]; const fy=fiscalYearJST();
  let c=PROMO_CYCLES.find(x=>Number(x.fiscal_year)===fy&&x.period_code==='annual');
  if(!c){
    const r=await sb.from('evaluation_cycles').insert({fiscal_year:fy,period_code:'annual',name:`${fy}年度 年次評価`,start_date:`${fy}-04-01`,end_date:`${fy+1}-03-31`,status:'open'}).select().single();
    if(r.error){APP.toast(r.error.message,'error');return;} c=r.data; PROMO_CYCLES.unshift(c);
  }
  const el=document.getElementById('promo-cycle');
  if(el)el.innerHTML=PROMO_CYCLES.map(x=>`<option value="${APP.escape(x.id)}"${x.id===c.id?' selected':''}>${APP.escape(x.name)}</option>`).join('');
  await selectPromotionCycle(c.id,false);
  if(status)status.textContent=`${c.name} / 年度別管理`;
}
async function selectPromotionCycle(id,rerender=true){
  PROMO_ACTIVE_CYCLE=PROMO_CYCLES.find(x=>x.id===id)||null; PROMO_EVALUATIONS=new Map(); PROMO_REVIEWS=new Map();
  if(!PROMO_ACTIVE_CYCLE)return; const sb=APP.client();
  const [a,b]=await Promise.all([sb.from('employee_evaluations').select('*').eq('evaluation_cycle_id',id),sb.from('employee_promotion_reviews').select('*').eq('evaluation_cycle_id',id)]);
  if(a.error||b.error){APP.toast((a.error||b.error).message,'error');return;}
  (a.data||[]).forEach(x=>PROMO_EVALUATIONS.set(x.employee_id,x)); (b.data||[]).forEach(x=>PROMO_REVIEWS.set(x.employee_id,x));
  const st=document.getElementById('promo-cycle-status'); if(st)st.textContent=`${PROMO_ACTIVE_CYCLE.name} / 評価 ${PROMO_EVALUATIONS.size}名・判断 ${PROMO_REVIEWS.size}名`;
  if(rerender){renderPromotionStats();renderPromotionRows();}
}
function reviewFor(e){return PROMO_REVIEWS.get(e.id)||null;}
function evaluationFor(e){return PROMO_EVALUATIONS.get(e.id)||null;}
function openPromotionReview(id){
  const e=PROMO_ALL.find(x=>x.id===id); if(!e||!PROMO_ACTIVE_CYCLE)return; const a=evaluationFor(e),b=reviewFor(e);
  document.getElementById('promo-review-employee-id').value=e.id;
  document.getElementById('promo-review-title').textContent=`${e.name}（${e.employee_code}）`;
  document.getElementById('promo-review-context').textContent=`${PROMO_ACTIVE_CYCLE.name} / ${e.current_grade||'等級未設定'} / 滞留 ${e.grade_tenure_label||'—'}`;
  document.getElementById('promo-review-rating').value=a?.rating||''; document.getElementById('promo-review-eval-status').value=a?.status||'未評価';
  document.getElementById('promo-review-comment').value=a?.comment||''; document.getElementById('promo-review-decision').value=b?.decision_status||'確認中'; document.getElementById('promo-review-note').value=b?.decision_note||'';
  Modal.open('promo-review-modal');
}
async function savePromotionReview(){
  const e=PROMO_ALL.find(x=>x.id===document.getElementById('promo-review-employee-id').value); if(!e||!PROMO_ACTIVE_CYCLE)return;
  if(PROMO_ACTIVE_CYCLE.status==='closed'){APP.toast('締切済み年度は更新できません','warning');return;}
  const sb=APP.client(),now=new Date().toISOString(),es=document.getElementById('promo-review-eval-status').value,ds=document.getElementById('promo-review-decision').value;
  const ep={employee_id:e.id,evaluation_cycle_id:PROMO_ACTIVE_CYCLE.id,rating:document.getElementById('promo-review-rating').value.trim()||null,comment:document.getElementById('promo-review-comment').value.trim()||null,status:es,evaluated_at:es==='確定'?now:null};
  const rp={employee_id:e.id,evaluation_cycle_id:PROMO_ACTIVE_CYCLE.id,current_grade_snapshot:e.current_grade||null,last_qualification_change_date:e.last_grade_change_date||null,qualification_tenure_months:Number.isFinite(e.grade_tenure_months)?e.grade_tenure_months:null,decision_status:ds,decision_note:document.getElementById('promo-review-note').value.trim()||null,decided_at:ds!=='確認中'?now:null};
  const [a,b]=await Promise.all([sb.from('employee_evaluations').upsert(ep,{onConflict:'employee_id,evaluation_cycle_id'}).select().single(),sb.from('employee_promotion_reviews').upsert(rp,{onConflict:'employee_id,evaluation_cycle_id'}).select().single()]);
  if(a.error||b.error){APP.toast((a.error||b.error).message,'error');return;} PROMO_EVALUATIONS.set(e.id,a.data); PROMO_REVIEWS.set(e.id,b.data); Modal.close('promo-review-modal'); APP.toast('年度評価・昇格判断を保存しました'); renderPromotionRows();
}

function scopedRows(){return document.getElementById('promo-scope')?.value==='all'?PROMO_ALL:PROMO_ALL.filter(isPromotionCandidate);}
function filteredPromotionRows(){
  const kw=(document.getElementById('promo-keyword')?.value||'').trim().toLowerCase();
  const center=document.getElementById('promo-center')?.value||'';
  const position=document.getElementById('promo-position')?.value||'';
  const grade=document.getElementById('promo-grade')?.value||'';
  const tenure=document.getElementById('promo-tenure')?.value||'';
  const dateStatus=document.getElementById('promo-date-status')?.value||'';
  const sort=document.getElementById('promo-sort')?.value||'tenure-desc';
  const minMonths=tenure?Number(tenure):null;
  const rows=scopedRows().filter(e=>{
    const hay=[e.employee_code,e.name,e.center,e.position,e.employment_type,e.current_grade].join(' ').toLowerCase();
    const dateKnown=!!e.last_grade_change_date;
    const dateUnknown=!dateKnown&&e.last_grade_change_label==='日付不明';
    const dateMissing=!dateKnown&&!dateUnknown;
    const dateOk=!dateStatus||(dateStatus==='known'&&dateKnown)||(dateStatus==='unknown'&&dateUnknown)||(dateStatus==='missing'&&dateMissing);
    const tenureOk=minMonths===null||(Number.isFinite(e.grade_tenure_months)&&e.grade_tenure_months>=minMonths);
    return (!kw||hay.includes(kw))&&(!center||e.center===center)&&(!position||e.position===position)&&(!grade||e.current_grade===grade)&&dateOk&&tenureOk;
  });
  const gradeNum=v=>{const m=String(v||'').match(/(\d+)級/);return m?Number(m[1]):-1;};
  rows.sort((a,b)=>{
    if(sort==='tenure-desc') return (b.grade_tenure_months??-1)-(a.grade_tenure_months??-1)||String(a.employee_code).localeCompare(String(b.employee_code));
    if(sort==='tenure-asc') return (a.grade_tenure_months??999999)-(b.grade_tenure_months??999999)||String(a.employee_code).localeCompare(String(b.employee_code));
    if(sort==='date-desc') return String(b.last_grade_change_date||'').localeCompare(String(a.last_grade_change_date||''));
    if(sort==='grade-desc') return gradeNum(b.current_grade)-gradeNum(a.current_grade)||String(a.employee_code).localeCompare(String(b.employee_code));
    return String(a.employee_code).localeCompare(String(b.employee_code));
  });
  return rows;
}
function renderPromotionStats(){
  const candidates=PROMO_ALL.filter(isPromotionCandidate);
  const base=scopedRows();
  const missingGrade=base.filter(e=>!String(e.current_grade||'').trim()).length;
  const missingDate=base.filter(e=>!e.last_grade_change_date&&!e.last_grade_change_label).length;
  [['promo-count',candidates.length],['promo-employee-count',PROMO_ALL.length],['promo-grade-missing',missingGrade],['promo-date-missing',missingDate]].forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.textContent=v;});
}
function renderPromotionRows(){
  const rows=filteredPromotionRows();const count=document.getElementById('promo-filtered-count');if(count)count.textContent=rows.length;
  const tbody=document.getElementById('promo-tbody');if(!tbody)return;
  tbody.innerHTML=rows.length?rows.map(e=>{const ev=evaluationFor(e),rv=reviewFor(e);return `<tr class="promo-row">
    <td><div class="name-cell"><div class="mini-avatar">${APP.escape((e.name||'?')[0])}</div><div><div class="cell-main">${APP.escape(e.name||'')}</div><div class="cell-sub">${APP.escape(e.employee_code||'')}</div></div></div></td>
    <td>${APP.escape(e.center||'—')}</td><td>${APP.escape(e.position||'—')}</td><td>${e.current_grade?APP.badge(e.current_grade,'gray'):'未設定'}</td>
    <td>${e.last_grade_change_date?APP.fmtDate(e.last_grade_change_date):(e.last_grade_change_label||'未設定')}</td><td>${APP.escape(e.grade_tenure_label||'—')}</td>
    <td>${APP.escape(ev?.rating||'未評価')}</td><td>${APP.badge(rv?.decision_status||'未判断','gray')}</td>
    <td class="promo-actions"><button class="btn btn-primary btn-sm" type="button" onclick="openPromotionReview('${APP.escape(e.id)}')">評価・判断</button><a class="btn btn-secondary btn-sm" href="employee_detail.html?id=${encodeURIComponent(e.id)}">社員詳細</a></td>
  </tr>`}).join(''):`<tr><td colspan="9" class="empty">条件に一致する社員はありません</td></tr>`;
}
function exportPromotionCSV(){
  const rows=filteredPromotionRows();
  const columns=[['employee_code','社員コード'],['name','氏名'],['center','所属センター'],['division','部門'],['position','職種'],['employment_type','雇用形態'],['current_grade','現在等級'],['last_grade_change_date','最終資格変更日'],['grade_tenure_label','資格滞留期間'],['promotion_status','候補状態']];
  const quote=v=>`"${String(v??'').replace(/"/g,'""')}"`;const lines=[columns.map(([,label])=>quote(label)).join(',')];
  rows.forEach(e=>{const row={...e,last_grade_change_date:e.last_grade_change_date||(e.last_grade_change_label||''),promotion_status:isPromotionCandidate(e)?'昇格候補':'通常'};lines.push(columns.map(([key])=>quote(row[key])).join(','));});
  const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');
  const stamp=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}).replaceAll('-','');a.href=URL.createObjectURL(blob);a.download=`人事評価昇格一覧_${stamp}.csv`;a.click();URL.revokeObjectURL(a.href);
}
window.initPromotion=initPromotion;window.exportPromotionCSV=exportPromotionCSV;window.openPromotionReview=openPromotionReview;

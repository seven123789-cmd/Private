let PROMO_ALL=[];

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
  ['promo-keyword','promo-center','promo-position','promo-grade','promo-scope','promo-tenure','promo-date-status','promo-sort'].forEach(id=>document.getElementById(id)?.addEventListener('input',()=>{renderPromotionStats();renderPromotionRows();}));
  document.getElementById('btn-clear-promo-filter')?.addEventListener('click',()=>{
    ['promo-keyword','promo-center','promo-position','promo-grade','promo-tenure','promo-date-status'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    const scope=document.getElementById('promo-scope');if(scope)scope.value='candidate';
    const sort=document.getElementById('promo-sort');if(sort)sort.value='tenure-desc';
    renderPromotionStats();renderPromotionRows();
  });
  document.getElementById('btn-export-promotion')?.addEventListener('click',exportPromotionCSV);
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
  const scopeAll=document.getElementById('promo-scope')?.value==='all';
  const note=document.getElementById('promo-table-note');if(note)note.textContent=scopeAll?'登録社員を条件に沿って表示':'候補者フラグが有効な社員のみ表示';
  const tbody=document.getElementById('promo-tbody');if(!tbody)return;
  tbody.innerHTML=rows.length?rows.map(e=>`<tr class="promo-row" onclick="location.href='employee_detail.html?id=${encodeURIComponent(e.id)}'">
    <td><div class="name-cell"><div class="mini-avatar">${APP.escape((e.name||'?')[0])}</div><div><div class="cell-main">${APP.escape(e.name||'')}</div><div class="cell-sub">${APP.escape(e.employee_code||'')}</div></div></div></td>
    <td>${APP.escape(e.center||'—')}</td><td>${APP.escape(e.position||'—')}</td><td>${APP.escape(e.employment_type||'—')}</td>
    <td>${e.current_grade?APP.badge(e.current_grade,'gray'):'<span class="data-missing">未設定</span>'}</td>
    <td>${e.last_grade_change_date?APP.fmtDate(e.last_grade_change_date):(e.last_grade_change_label?APP.escape(e.last_grade_change_label):'<span class="data-missing">未設定</span>')}</td>
    <td>${APP.escape(e.grade_tenure_label||'—')}</td>
    <td>${isPromotionCandidate(e)?APP.badge('昇格候補','primary'):APP.badge('通常','gray')}</td>
    <td><a class="btn btn-secondary btn-sm" href="employee_detail.html?id=${encodeURIComponent(e.id)}" onclick="event.stopPropagation()">社員詳細</a></td>
  </tr>`).join(''):`<tr><td colspan="9" class="empty">条件に一致する社員はありません</td></tr>`;
}
function exportPromotionCSV(){
  const rows=filteredPromotionRows();
  const columns=[['employee_code','社員コード'],['name','氏名'],['center','所属センター'],['division','部門'],['position','職種'],['employment_type','雇用形態'],['current_grade','現在等級'],['last_grade_change_date','最終資格変更日'],['grade_tenure_label','資格滞留期間'],['promotion_status','候補状態']];
  const quote=v=>`"${String(v??'').replace(/"/g,'""')}"`;const lines=[columns.map(([,label])=>quote(label)).join(',')];
  rows.forEach(e=>{const row={...e,last_grade_change_date:e.last_grade_change_date||(e.last_grade_change_label||''),promotion_status:isPromotionCandidate(e)?'昇格候補':'通常'};lines.push(columns.map(([key])=>quote(row[key])).join(','));});
  const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');
  const stamp=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}).replaceAll('-','');a.href=URL.createObjectURL(blob);a.download=`人事評価昇格一覧_${stamp}.csv`;a.click();URL.revokeObjectURL(a.href);
}
window.initPromotion=initPromotion;window.exportPromotionCSV=exportPromotionCSV;

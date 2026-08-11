let PROMO_ALL=[];
let PROMO_ROWS=[];

async function initPromotion(){
  APP.initHeader();
  PROMO_ALL=await APP.loadEmployees();
  PROMO_ROWS=PROMO_ALL.filter(isPromotionCandidate);
  fillPromotionFilters();
  bindPromotionFilters();
  renderPromotionStats();
  renderPromotionRows();
}

function isPromotionCandidate(e){return e.promotion_target_flag===true||e.promotion_target_flag==='true';}

function fillPromotionFilters(){
  fillPromoSelect('promo-center',unique(PROMO_ROWS.map(e=>e.center)),'全センター');
  fillPromoSelect('promo-position',unique(PROMO_ROWS.map(e=>e.position)),'全職種');
  fillPromoSelect('promo-grade',unique(PROMO_ROWS.map(e=>e.current_grade)),'全等級');
}
function unique(v){return [...new Set(v.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'ja'));}
function fillPromoSelect(id,items,label){
  const el=document.getElementById(id);if(!el)return;
  el.innerHTML=`<option value="">${label}</option>`+items.map(v=>`<option value="${APP.escape(v)}">${APP.escape(v)}</option>`).join('');
}

function bindPromotionFilters(){
  ['promo-keyword','promo-center','promo-position','promo-grade'].forEach(id=>document.getElementById(id)?.addEventListener('input',renderPromotionRows));
  document.getElementById('btn-clear-promo-filter')?.addEventListener('click',()=>{
    ['promo-keyword','promo-center','promo-position','promo-grade'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    renderPromotionRows();
  });
  document.getElementById('btn-export-promotion')?.addEventListener('click',exportPromotionCSV);
}

function renderPromotionStats(){
  const missingGrade=PROMO_ROWS.filter(e=>!String(e.current_grade||'').trim()).length;
  const missingDate=PROMO_ROWS.filter(e=>!e.last_promotion_date).length;
  [['promo-count',PROMO_ROWS.length],['promo-employee-count',PROMO_ALL.length],['promo-grade-missing',missingGrade],['promo-date-missing',missingDate]]
    .forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.textContent=v;});
}

function filteredPromotionRows(){
  const kw=(document.getElementById('promo-keyword')?.value||'').trim().toLowerCase();
  const center=document.getElementById('promo-center')?.value||'';
  const position=document.getElementById('promo-position')?.value||'';
  const grade=document.getElementById('promo-grade')?.value||'';
  return PROMO_ROWS.filter(e=>{
    const hay=[e.employee_code,e.name,e.center,e.position,e.employment_type,e.current_grade].join(' ').toLowerCase();
    return (!kw||hay.includes(kw))&&(!center||e.center===center)&&(!position||e.position===position)&&(!grade||e.current_grade===grade);
  });
}

function renderPromotionRows(){
  const rows=filteredPromotionRows();
  const count=document.getElementById('promo-filtered-count');if(count)count.textContent=rows.length;
  const tbody=document.getElementById('promo-tbody');if(!tbody)return;
  tbody.innerHTML=rows.length?rows.map(e=>`<tr class="promo-row" onclick="location.href='employee_detail.html?id=${encodeURIComponent(e.id)}'">
    <td><div class="name-cell"><div class="mini-avatar">${APP.escape((e.name||'?')[0])}</div><div><div class="cell-main">${APP.escape(e.name||'')}</div><div class="cell-sub">${APP.escape(e.employee_code||'')}</div></div></div></td>
    <td>${APP.escape(e.center||'—')}</td><td>${APP.escape(e.position||'—')}</td><td>${APP.escape(e.employment_type||'—')}</td>
    <td>${e.current_grade?APP.badge(e.current_grade,'gray'):'<span class="data-missing">未設定</span>'}</td>
    <td>${e.last_promotion_date?APP.fmtDate(e.last_promotion_date):'<span class="data-missing">未設定</span>'}</td>
    <td>${APP.badge('昇格候補','primary')}</td>
    <td><a class="btn btn-secondary btn-sm" href="employee_detail.html?id=${encodeURIComponent(e.id)}" onclick="event.stopPropagation()">社員詳細</a></td>
  </tr>`).join(''):`<tr><td colspan="8" class="empty">条件に一致する昇格候補者はありません</td></tr>`;
}

function exportPromotionCSV(){
  const rows=filteredPromotionRows();
  const columns=[['employee_code','社員コード'],['name','氏名'],['center','所属センター'],['division','部門'],['position','職種'],['employment_type','雇用形態'],['current_grade','現在等級'],['last_promotion_date','最終昇格日'],['promotion_status','候補状態']];
  const quote=v=>`"${String(v??'').replace(/"/g,'""')}"`;
  const lines=[columns.map(([,label])=>quote(label)).join(',')];
  rows.forEach(e=>{const row={...e,promotion_status:'昇格候補'};lines.push(columns.map(([key])=>quote(row[key])).join(','));});
  const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  const stamp=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}).replaceAll('-','');
  a.href=URL.createObjectURL(blob);a.download=`昇格候補一覧_${stamp}.csv`;a.click();URL.revokeObjectURL(a.href);
}
window.initPromotion=initPromotion;window.exportPromotionCSV=exportPromotionCSV;

let LIC_EMPLOYEES = [];
let LIC_MASTER = [];
let LIC_ROWS = [];
let LIC_FILTERED = [];
let licPage = 1;
const licPerPage = 20;

async function initLicenses() {
  APP.initHeader();
  [LIC_EMPLOYEES, LIC_MASTER, LIC_ROWS] = await Promise.all([
    APP.loadEmployees(), APP.loadLicenseMaster(), APP.loadLicenseRows()
  ]);
  fillLicenseSelects();
  bindLicenseFilters();
  bindLicenseActions();
  renderLicenseStats();
  renderLicenseRows();
}

function fillLicenseSelects() {
  fillSelect('license-employee', LIC_EMPLOYEES.map(e => ({
    value:e.id, label:`${e.employee_code || ''} ${e.name || ''}｜${e.center || ''}`
  })), '社員を選択');
  fillSelect('license-master', LIC_MASTER.filter(l => l.enabled !== false).map(l => ({
    value:l.id, label:`${l.license_name}｜${l.category_name || ''}`
  })), '資格を選択');
  fillSelect('filter-license', [...new Set(LIC_MASTER.map(l => l.license_name).filter(Boolean))].sort().map(v => ({value:v,label:v})), '全資格');
  fillSelect('filter-center', [...new Set(LIC_EMPLOYEES.map(e => e.center).filter(Boolean))].sort().map(v => ({value:v,label:v})), '全センター');
}
function fillSelect(id, items, first) {
  const el=document.getElementById(id); if(!el)return;
  el.innerHTML=`<option value="">${first}</option>`+items.map(i=>`<option value="${APP.escape(i.value)}">${APP.escape(i.label)}</option>`).join('');
}

function bindLicenseFilters() {
  ['filter-keyword','filter-license','filter-center','filter-status'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.oninput=()=>{licPage=1;syncStatSelection();renderLicenseRows();};
  });
  const clear=document.getElementById('btn-clear-filter');
  if(clear) clear.onclick=clearLicenseFilters;
  document.querySelectorAll('.stat-filter').forEach(card=>{
    card.onclick=()=>{
      const status=card.dataset.status || '';
      document.getElementById('filter-status').value=status;
      licPage=1; syncStatSelection(); renderLicenseRows();
    };
  });
  const form=document.getElementById('license-form');
  if(form) form.onsubmit=saveEmployeeLicense;
}

function bindLicenseActions() {
  const modal=document.getElementById('license-register-modal');
  const open=()=>{modal?.classList.remove('hidden');document.getElementById('license-employee')?.focus();};
  const close=()=>modal?.classList.add('hidden');
  document.getElementById('btn-open-license-form')?.addEventListener('click',open);
  document.getElementById('btn-close-license-form')?.addEventListener('click',close);
  document.getElementById('btn-cancel-license-form')?.addEventListener('click',close);
  modal?.addEventListener('click',e=>{if(e.target===modal)close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  document.getElementById('btn-export-license')?.addEventListener('click',exportLicenseCSV);
}

function clearLicenseFilters(){
  ['filter-keyword','filter-license','filter-center','filter-status'].forEach(id=>{
    const el=document.getElementById(id); if(el)el.value='';
  });
  licPage=1; syncStatSelection(); renderLicenseRows();
}

function syncStatSelection(){
  const current=document.getElementById('filter-status')?.value || '';
  document.querySelectorAll('.stat-filter').forEach(x=>x.classList.toggle('active',(x.dataset.status||'')===current));
}

function renderLicenseStats() {
  const statuses=LIC_ROWS.map(r=>APP.normStatus(r.alert_status,r.expiration_date));
  [['lic-total',LIC_ROWS.length],['lic-expired',statuses.filter(s=>s==='期限切れ').length],
   ['lic-30',statuses.filter(s=>s==='30日以内').length],['lic-90',statuses.filter(s=>s==='90日以内').length]]
  .forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.textContent=v;});
}

function getFilteredLicenseRows(){
  const kw=(document.getElementById('filter-keyword')?.value||'').trim().toLowerCase();
  const license=document.getElementById('filter-license')?.value||'';
  const center=document.getElementById('filter-center')?.value||'';
  const status=document.getElementById('filter-status')?.value||'';
  return LIC_ROWS.filter(r=>{
    const st=APP.normStatus(r.alert_status,r.expiration_date);
    const hay=[r.employee_code,r.employee_name,r.license_name,r.category_name,r.center,r.memo].join(' ').toLowerCase();
    return (!kw||hay.includes(kw))&&(!license||r.license_name===license)&&(!center||r.center===center)&&(!status||st===status);
  });
}

function renderLicenseRows() {
  LIC_FILTERED=getFilteredLicenseRows();
  const cnt=document.getElementById('license-count'); if(cnt)cnt.textContent=LIC_FILTERED.length;
  const tbody=document.getElementById('license-tbody'); if(!tbody)return;
  const start=(licPage-1)*licPerPage;
  const rows=LIC_FILTERED.slice(start,start+licPerPage);
  tbody.innerHTML=rows.length?rows.map(r=>{
    const st=APP.normStatus(r.alert_status,r.expiration_date);
    const days=APP.daysUntil(r.expiration_date);
    return `<tr>
      <td><div class="name-cell"><div class="mini-avatar">${APP.escape((r.employee_name||'?')[0])}</div><div><div class="cell-main">${APP.escape(r.employee_name||'')}</div><div class="cell-sub">${APP.escape(r.employee_code||'')}｜${APP.escape(r.center||'')}</div></div></div></td>
      <td><div class="cell-main">${APP.escape(r.license_name||'')}</div><div class="cell-sub">${APP.escape(r.category_name||'')}</div></td>
      <td>${APP.fmtDate(r.acquired_date)}</td><td>${APP.fmtDate(r.renewal_date)}</td><td>${APP.fmtDate(r.expiration_date)}</td>
      <td>${APP.alertBadge(st,r.expiration_date)}</td>
      <td>${days===null?'—':(days<0?`${Math.abs(days)}日超過`:`残り${days}日`)}</td>
      <td class="memo-cell">${APP.escape(r.memo||'')}</td>
    </tr>`;
  }).join(''):`<tr><td colspan="8" class="empty">条件に一致する資格・免許はありません</td></tr>`;
  renderLicPager();
}

function renderLicPager() {
  const p=document.getElementById('license-pagination'); if(!p)return;
  const pages=Math.max(1,Math.ceil(LIC_FILTERED.length/licPerPage));
  if(licPage>pages)licPage=pages;
  p.innerHTML=`<div class="row-meta">${LIC_FILTERED.length}件中 ${LIC_FILTERED.length?((licPage-1)*licPerPage+1):0}〜${Math.min(licPage*licPerPage,LIC_FILTERED.length)}件表示</div>
  <div style="display:flex;gap:6px"><button class="page-btn" ${licPage<=1?'disabled':''} onclick="licPage--;renderLicenseRows()">‹</button>
  ${Array.from({length:pages},(_,i)=>`<button class="page-btn ${i+1===licPage?'active':''}" onclick="licPage=${i+1};renderLicenseRows()">${i+1}</button>`).join('')}
  <button class="page-btn" ${licPage>=pages?'disabled':''} onclick="licPage++;renderLicenseRows()">›</button></div>`;
}

async function saveEmployeeLicense(ev) {
  ev.preventDefault();
  const payload={
    employee_id:document.getElementById('license-employee').value,
    license_id:document.getElementById('license-master').value,
    acquired_date:valueOrNull('license-acquired'),
    renewal_date:valueOrNull('license-renewal'),
    expiration_date:valueOrNull('license-expiration'),
    memo:document.getElementById('license-memo').value||null
  };
  if(!payload.employee_id||!payload.license_id)return APP.toast('社員と資格を選択してください','warning');
  const res=await APP.saveEmployeeLicense(payload);
  if(res.error)return APP.toast(res.error.message||'保存できませんでした','error');
  APP.toast('資格・免許を登録しました');
  document.getElementById('license-form').reset();
  document.getElementById('license-register-modal')?.classList.add('hidden');
  LIC_ROWS=await APP.loadLicenseRows();
  renderLicenseStats(); renderLicenseRows();
}

function exportLicenseCSV(){
  const rows=getFilteredLicenseRows();
  const columns=[
    ['employee_code','社員コード'],['employee_name','社員名'],['center','所属センター'],
    ['license_name','資格・免許名'],['category_name','資格区分'],['acquired_date','取得日'],
    ['renewal_date','最終更新日'],['expiration_date','有効期限'],['status','期限状態'],
    ['days_remaining','残日数'],['memo','メモ']
  ];
  const quote=v=>`"${String(v??'').replace(/"/g,'""')}"`;
  const lines=[columns.map(([,label])=>quote(label)).join(',')];
  rows.forEach(r=>{
    const status=APP.normStatus(r.alert_status,r.expiration_date);
    const days=APP.daysUntil(r.expiration_date);
    const obj={...r,status,days_remaining:days};
    lines.push(columns.map(([key])=>quote(obj[key])).join(','));
  });
  const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  const stamp=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}).replaceAll('-','');
  a.href=URL.createObjectURL(blob);a.download=`資格免許一覧_${stamp}.csv`;a.click();URL.revokeObjectURL(a.href);
}

function valueOrNull(id){return document.getElementById(id)?.value||null;}
window.initLicenses=initLicenses;window.renderLicenseRows=renderLicenseRows;window.exportLicenseCSV=exportLicenseCSV;

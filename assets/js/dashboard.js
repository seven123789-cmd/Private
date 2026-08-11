async function initDashboard() {
  APP.initHeader();
  setDashboardLoading(true);
  try {
    const [employees, alerts, licenses] = await Promise.all([
      APP.loadEmployees(), APP.loadAlertRows(), APP.loadLicenseRows()
    ]);
    const statusOf=r=>APP.normStatus(r.alert_status,r.expiration_date);
    const expired=alerts.filter(r=>statusOf(r)==='期限切れ').length;
    const critical=alerts.filter(r=>statusOf(r)==='30日以内').length;
    const warning=alerts.filter(r=>statusOf(r)==='90日以内').length;
    const promo=employees.filter(e=>e.promotion_target_flag===true||e.promotion_target_flag==='true').length;
    [['stat-expired',expired],['stat-critical',critical],['stat-warning',warning],['stat-promo',promo],['stat-employees',employees.length]]
      .forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.textContent=v;});

    renderPriorityAlerts(alerts);
    renderPromotions(employees);
    renderWorkforce(employees);
    renderCoverage(employees,licenses);
    renderMonthly(alerts);
    renderDataHealth(employees,licenses,alerts);
    const stamp=document.getElementById('dashboard-updated');
    if(stamp)stamp.textContent=`最終更新 ${new Intl.DateTimeFormat('ja-JP',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Tokyo'}).format(new Date())}`;
  } catch(err) {
    console.error(err);
    APP.toast('ダッシュボードの読み込みに失敗しました','error');
  } finally { setDashboardLoading(false); }
}
function setDashboardLoading(v){const b=document.getElementById('btn-dashboard-refresh');if(b){b.disabled=v;b.textContent=v?'読込中…':'再読込';}}
function renderPriorityAlerts(alerts){
  const el=document.getElementById('alert-list');if(!el)return;
  const rank={'期限切れ':0,'30日以内':1,'90日以内':2};
  const rows=alerts.filter(r=>rank[APP.normStatus(r.alert_status,r.expiration_date)]!==undefined)
    .sort((a,b)=>(a.days_remaining??APP.daysUntil(a.expiration_date)??99999)-(b.days_remaining??APP.daysUntil(b.expiration_date)??99999)).slice(0,8);
  el.innerHTML=rows.length?rows.map(r=>{
    const st=APP.normStatus(r.alert_status,r.expiration_date),days=r.days_remaining??APP.daysUntil(r.expiration_date);
    return `<a class="dashboard-task-row" href="alerts.html?status=${encodeURIComponent(st)}">
      <div class="task-status">${APP.alertBadge(st,r.expiration_date)}</div>
      <div class="task-main"><div class="row-title">${APP.escape(r.employee_name||'')}｜${APP.escape(r.license_name||'')}</div><div class="row-meta">${APP.escape(r.center||'')}　期限：${APP.fmtDate(r.expiration_date)}</div></div>
      <div class="task-days">${days===null?'—':days<0?`${Math.abs(days)}日超過`:`残り${days}日`}</div></a>`;
  }).join(''):`<div class="empty dashboard-good">現在、90日以内の資格更新対象はありません</div>`;
}
function renderPromotions(employees){
  const el=document.getElementById('promo-list');if(!el)return;
  const rows=employees.filter(e=>e.promotion_target_flag===true||e.promotion_target_flag==='true').slice(0,8);
  el.innerHTML=rows.length?rows.map(e=>`<a class="person-row dashboard-person-row" href="employee_detail.html?id=${encodeURIComponent(e.id)}">
    <div class="mini-avatar">${APP.escape((e.name||'?')[0])}</div><div class="person-grow"><div class="row-title">${APP.escape(e.name||'')}</div><div class="row-meta">${APP.escape(e.center||'')}｜${APP.escape(e.current_grade||'等級未設定')}｜${APP.escape(e.position||'')}</div></div><span class="text-link">詳細 →</span></a>`).join(''):`<div class="empty dashboard-good">現在、昇格候補者はいません</div>`;
}
function renderWorkforce(employees){
  const el=document.getElementById('workforce-list');if(!el)return;
  const counts=new Map();employees.forEach(e=>counts.set(e.center||'未設定',(counts.get(e.center||'未設定')||0)+1));
  const rows=[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ja'));
  const max=Math.max(1,...rows.map(r=>r[1]));
  el.innerHTML=rows.length?`<div class="bars">${rows.slice(0,10).map(([name,count])=>`<div class="bar-row"><div class="bar-head"><span>${APP.escape(name)}</span><span>${count}名</span></div><div class="bar"><span style="width:${Math.max(4,count/max*100)}%"></span></div></div>`).join('')}</div>`:`<div class="empty">社員データがありません</div>`;
}
function renderCoverage(employees,licenses){
  const el=document.getElementById('coverage-list');if(!el)return;
  const centers=new Map();
  employees.forEach(e=>centers.set(e.center||'未設定',{total:(centers.get(e.center||'未設定')?.total||0)+1,holders:new Set()}));
  licenses.forEach(r=>{const key=r.center||'未設定';if(!centers.has(key))centers.set(key,{total:0,holders:new Set()});const id=r.employee_id||r.employee_code||r.employee_name;if(id)centers.get(key).holders.add(String(id));});
  const rows=[...centers.entries()].map(([center,v])=>({center,total:v.total,holders:v.holders.size,rate:v.total?Math.round(v.holders.size/v.total*100):0}))
    .sort((a,b)=>b.rate-a.rate||a.center.localeCompare(b.center,'ja')).slice(0,10);
  el.innerHTML=rows.length?`<div class="bars">${rows.map(r=>`<div class="bar-row"><div class="bar-head"><span>${APP.escape(r.center)}</span><span>${r.holders}/${r.total}名</span></div><div class="bar"><span style="width:${Math.min(100,r.rate)}%"></span></div></div>`).join('')}</div>`:`<div class="empty">資格データがありません</div>`;
}
function renderMonthly(alerts){
  const el=document.getElementById('monthly-bars');if(!el)return;
  const now=new Date(),months=[];
  for(let i=0;i<6;i++){const d=new Date(now.getFullYear(),now.getMonth()+i,1);months.push({key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,label:`${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}`,count:0});}
  alerts.forEach(r=>{if(!r.expiration_date)return;const key=String(r.expiration_date).slice(0,7);const m=months.find(x=>x.key===key);if(m)m.count++;});
  const max=Math.max(1,...months.map(m=>m.count));
  el.innerHTML=`<div class="bars">${months.map(m=>`<div class="bar-row"><div class="bar-head"><span>${m.label}</span><span>${m.count}件</span></div><div class="bar"><span style="width:${m.count?Math.max(4,m.count/max*100):0}%"></span></div></div>`).join('')}</div>`;
}
function renderDataHealth(employees,licenses,alerts){
  const el=document.getElementById('data-health');if(!el)return;
  const connected=APP.isSupabaseReady();
  el.innerHTML=`<div class="data-health-list">
    <div class="data-health-row"><span>データ接続</span><strong><span class="health-dot ${connected?'ok':'demo'}"></span>${connected?'Supabase':'ローカル / デモ'}</strong></div>
    <div class="data-health-row"><span>社員レコード</span><strong>${employees.length}件</strong></div>
    <div class="data-health-row"><span>資格登録</span><strong>${licenses.length}件</strong></div>
    <div class="data-health-row"><span>期限管理対象</span><strong>${alerts.filter(r=>r.expiration_date).length}件</strong></div>
  </div><p class="data-health-note">${connected?'データベースの最新値を参照しています。':'Supabase未接続時はフォールバックデータを表示します。'}</p>`;
}
document.getElementById('btn-dashboard-refresh')?.addEventListener('click',initDashboard);
window.initDashboard=initDashboard;

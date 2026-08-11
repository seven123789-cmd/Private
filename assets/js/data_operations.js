async function initDataOperations(){
  const btn=document.getElementById('btn-health-refresh');if(btn){btn.disabled=true;btn.textContent='確認中…';}
  try{
    const [source,employees,licenses,alerts,user]=await Promise.all([APP.dataSourceStatus(),APP.loadEmployees(),APP.loadLicenseRows(),APP.loadAlertRows(),Auth.currentUser()]);
    document.getElementById('health-source').textContent=source.label;
    document.getElementById('health-auth').textContent=user ? 'ログイン済み' : (Auth.isRequired() ? '未ログイン' : '任意ログイン');
    document.getElementById('health-employees').textContent=employees.length;
    document.getElementById('health-licenses').textContent=licenses.length;
    document.getElementById('health-alerts').textContent=alerts.filter(x=>x.expiration_date).length;
    const duplicateCodes=[...new Set(employees.map(e=>String(e.employee_code||'').trim()).filter((v,i,a)=>v&&a.indexOf(v)!==i))];
    const missingCode=employees.filter(e=>!String(e.employee_code||'').trim()).length;
    const missingName=employees.filter(e=>!String(e.name||'').trim()).length;
    const orphanLicenses=licenses.filter(l=>!l.employee_id&&!l.employee_code).length;
    const checks=[
      ['データソース',source.mode==='supabase'?'DB接続済み':'フォールバック参照',source.mode==='supabase'],
      ['社員コード未設定',`${missingCode}件`,missingCode===0],
      ['氏名未設定',`${missingName}件`,missingName===0],
      ['社員コード重複',`${duplicateCodes.length}件`,duplicateCodes.length===0],
      ['社員識別子のない資格',`${orphanLicenses}件`,orphanLicenses===0]
    ];
    document.getElementById('health-checks').innerHTML=`<div class="ops-check-list">${checks.map(([label,value,ok])=>`<div class="ops-check-row"><span>${APP.escape(label)}</span><strong>${APP.badge(ok?'OK':'要確認',ok?'success':'warning')} ${APP.escape(value)}</strong></div>`).join('')}</div>`;
  }catch(e){console.error(e);APP.toast('データ運用確認に失敗しました','error');}
  finally{if(btn){btn.disabled=false;btn.textContent='再確認';}}
}
document.getElementById('btn-health-refresh')?.addEventListener('click',initDataOperations);
window.initDataOperations=initDataOperations;
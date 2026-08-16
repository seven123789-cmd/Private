async function initDataOperations(){
  const btn=document.getElementById('btn-health-refresh');
  if(btn){btn.disabled=true;btn.textContent='確認中…';}
  try{
    const [source,employees,licenses,alerts,user]=await Promise.all([APP.dataSourceStatus(),APP.loadEmployees(),APP.loadLicenseRows(),APP.loadAlertRows(),Auth.currentUser()]);
    document.getElementById('health-source').textContent=source.label;
    document.getElementById('health-auth').textContent=user?'ログイン済み':(Auth.isRequired()?'未ログイン':'任意ログイン');
    document.getElementById('health-employees').textContent=employees.length;
    document.getElementById('health-licenses').textContent=licenses.length;
    document.getElementById('health-alerts').textContent=alerts.filter(x=>x.expiration_date).length;
    const duplicateCodes=[...new Set(employees.map(e=>String(e.employee_code||'').trim()).filter((v,i,a)=>v&&a.indexOf(v)!==i))];
    const missingCode=employees.filter(e=>!String(e.employee_code||'').trim()).length;
    const missingName=employees.filter(e=>!String(e.name||'').trim()).length;
    const orphanLicenses=licenses.filter(l=>!l.employee_id&&!l.employee_code).length;
    const checks=[
      ['データソース',source.mode==='supabase'?'DB接続済み':'フォールバック参照',source.mode==='supabase'],
      ['社員コード未設定',`${missingCode}件`,missingCode===0],['氏名未設定',`${missingName}件`,missingName===0],
      ['社員コード重複',`${duplicateCodes.length}件`,duplicateCodes.length===0],
      ['社員識別子のない資格',`${orphanLicenses}件`,orphanLicenses===0]
    ];
    const sb=APP.client();
    if(sb&&user){
      const [versionRes,manifestRes,baselineRes,verifyRes]=await Promise.all([
        sb.from('schema_versions').select('version_code,phase,applied_at').order('applied_at',{ascending:false}).limit(1),
        sb.from('backup_restore_manifest').select('id',{count:'exact',head:true}).eq('backup_required',true),
        sb.from('restore_verification_snapshots').select('table_name',{count:'exact',head:true}).eq('snapshot_code','baseline-20260816-phase26i'),
        sb.rpc('verify_restore_baseline',{p_snapshot_code:'baseline-20260816-phase26i'})
      ]);
      const latest=versionRes.data?.[0];
      checks.push(['DBスキーマ版',latest?.version_code||'取得不可',!versionRes.error&&!!latest]);
      checks.push(['バックアップ対象',`${manifestRes.count??0}テーブル`,!manifestRes.error&&(manifestRes.count??0)>0]);
      checks.push(['復元基準',`${baselineRes.count??0}テーブル`,!baselineRes.error&&(baselineRes.count??0)>0]);
      if(verifyRes.error) checks.push(['復元整合チェック','実行エラー',false]);
      else{
        const bad=(verifyRes.data||[]).filter(r=>['NG','DIFF'].includes(r.result)&&!['public.schema_versions','public.backup_restore_manifest','public.restore_verification_snapshots'].includes(r.object_name));
        checks.push(['復元整合チェック',bad.length===0?'業務データ差異 0件':`業務データ差異 ${bad.length}件`,bad.length===0]);
      }
    }else checks.push(['長期運用DB監査','ログイン後に確認',false]);
    document.getElementById('health-checks').innerHTML=`<div class="ops-check-list">${checks.map(([label,value,ok])=>`<div class="ops-check-row"><span>${APP.escape(label)}</span><strong>${APP.badge(ok?'OK':'要確認',ok?'success':'warning')} ${APP.escape(value)}</strong></div>`).join('')}</div>`;
  }catch(e){console.error(e);APP.toast('データ運用確認に失敗しました','error');}
  finally{if(btn){btn.disabled=false;btn.textContent='再確認';}}
}
document.getElementById('btn-health-refresh')?.addEventListener('click',initDataOperations);
window.initDataOperations=initDataOperations;

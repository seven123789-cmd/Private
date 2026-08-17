let OPS_AUDIT_ROWS=[];

function opsFmtDateTime(v){
  if(!v) return '—';
  const d=new Date(v);
  if(Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Asia/Tokyo'}).format(d);
}
function opsShortJson(v){
  if(v===null||v===undefined) return '—';
  const s=typeof v==='string'?v:JSON.stringify(v);
  return s.length>160?s.slice(0,157)+'…':s;
}
function renderAuditRows(rows){
  const el=document.getElementById('audit-log-body');
  if(!el) return;
  if(!rows.length){el.innerHTML='<tr><td colspan="6" class="empty">監査ログはまだありません</td></tr>';return;}
  el.innerHTML=rows.map(r=>`<tr>
    <td>${APP.escape(opsFmtDateTime(r.changed_at))}</td>
    <td>${APP.escape(r.table_name||'')}</td>
    <td>${APP.escape(r.operation||'')}</td>
    <td>${APP.escape(r.record_id||'—')}</td>
    <td>${APP.escape(r.changed_by||'—')}</td>
    <td title="${APP.escape(opsShortJson(r.new_data||r.old_data))}">${APP.escape(opsShortJson(r.new_data||r.old_data))}</td>
  </tr>`).join('');
}
async function loadAuditLog(){
  const sb=APP.client(), user=await Auth.currentUser();
  if(!sb||!user){OPS_AUDIT_ROWS=[];renderAuditRows([]);return;}
  const r=await sb.from('audit_log')
    .select('id,table_name,record_id,operation,changed_by,changed_at,old_data,new_data')
    .order('changed_at',{ascending:false}).limit(200);
  if(r.error){console.error(r.error);OPS_AUDIT_ROWS=[];renderAuditRows([]);return;}
  OPS_AUDIT_ROWS=r.data||[];
  renderAuditRows(OPS_AUDIT_ROWS);
}
function exportAuditCSV(){
  if(!OPS_AUDIT_ROWS.length){APP.toast('出力できる監査ログがありません','warning');return;}
  APP.downloadCSV(`監査ログ_${APP.exportStamp()}.csv`,[
    {label:'変更日時',value:r=>opsFmtDateTime(r.changed_at)},
    {label:'テーブル',value:'table_name'},
    {label:'操作',value:'operation'},
    {label:'レコードID',value:'record_id'},
    {label:'変更者UID',value:'changed_by'},
    {label:'変更前JSON',value:r=>JSON.stringify(r.old_data??null)},
    {label:'変更後JSON',value:r=>JSON.stringify(r.new_data??null)}
  ],OPS_AUDIT_ROWS);
}


async function runAuditProbe(){
  const btn=document.getElementById('btn-audit-probe');
  const sb=APP.client(), user=await Auth.currentUser();
  if(!sb||!user){APP.toast('監査テストにはログインが必要です','warning');return;}
  if(btn){btn.disabled=true;btn.textContent='実行中…';}
  try{
    const r=await sb.rpc('audit_e2e_probe');
    if(r.error) throw r.error;
    APP.toast(`監査テストを記録しました（ID: ${r.data}）`,'success');
    await loadAuditLog();
  }catch(e){console.error(e);APP.toast('監査テストに失敗しました','error');}
  finally{if(btn){btn.disabled=false;btn.textContent='監査テスト';}}
}

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
      ['社員コード未設定',`${missingCode}件`,missingCode===0],
      ['氏名未設定',`${missingName}件`,missingName===0],
      ['社員コード重複',`${duplicateCodes.length}件`,duplicateCodes.length===0],
      ['社員識別子のない資格',`${orphanLicenses}件`,orphanLicenses===0]
    ];

    const sb=APP.client();
    if(sb&&user){
      const [versionRes,manifestRes,naturalKeyRes,baselineRes,verifyRes,auditCountRes,importBatchRes,promoReviewsRes,officialPromoRes,
        assignmentRes,licenseLinkRes,licenseMasterRes,centerRes,positionRes]=await Promise.all([
        sb.from('schema_versions').select('version_code,phase,applied_at').order('applied_at',{ascending:false}).limit(1),
        sb.from('backup_restore_manifest').select('id',{count:'exact',head:true}).eq('backup_required',true),
        sb.from('backup_restore_manifest').select('id',{count:'exact',head:true}).eq('schema_name','public').or('natural_key_hint.is.null,natural_key_hint.eq.'),
        sb.from('restore_verification_snapshots').select('table_name',{count:'exact',head:true}).eq('snapshot_code','baseline-20260817-phase26l-final'),
        sb.rpc('verify_restore_baseline',{p_snapshot_code:'baseline-20260817-phase26l-final'}),
        sb.from('audit_log').select('id',{count:'exact',head:true}),
        sb.from('employee_import_batches').select('id',{count:'exact',head:true}),
        sb.from('employee_promotion_reviews').select('id,employee_id,decision_status,result_hr_history_id'),
        sb.from('employee_hr_history_official').select('id,employee_id,effective_date,to_grade,status').eq('event_type','資格昇格'),
        sb.from('employee_assignment_history').select('id,employee_id,effective_from,effective_to,center_id,position_id'),
        sb.from('employee_licenses').select('id,employee_id,license_id'),
        sb.from('license_master').select('id'),
        sb.from('centers').select('id'),
        sb.from('positions').select('id')
      ]);
      const latest=versionRes.data?.[0];
      checks.push(['DBスキーマ版',latest?.version_code||'取得不可',!versionRes.error&&!!latest]);
      checks.push(['バックアップ対象',`${manifestRes.count??0}テーブル`,!manifestRes.error&&(manifestRes.count??0)>0]);
      checks.push(['Natural Key未設定',naturalKeyRes.error?'取得エラー':`${naturalKeyRes.count??0}テーブル`,!naturalKeyRes.error&&(naturalKeyRes.count??0)===0]);
      checks.push(['復元基準',`${baselineRes.count??0}テーブル`,!baselineRes.error&&(baselineRes.count??0)>0]);
      if(verifyRes.error) checks.push(['復元整合チェック','実行エラー',false]);
      else{
        const infraNames=new Set(['public.schema_versions','public.backup_restore_manifest','public.restore_verification_snapshots','schema_versions']);
        const businessBad=(verifyRes.data||[]).filter(r=>['NG','DIFF'].includes(r.result)&&!infraNames.has(r.object_name));
        const infraBad=(verifyRes.data||[]).filter(r=>['NG','DIFF'].includes(r.result)&&infraNames.has(r.object_name));
        checks.push(['復元整合チェック',`業務差異 ${businessBad.length}件 / 基盤差異 ${infraBad.length}件`,businessBad.length===0&&infraBad.length===0]);
      }
      checks.push(['監査ログ',auditCountRes.error?'取得エラー':`${auditCountRes.count??0}件`,!auditCountRes.error]);
      checks.push(['社員取込バッチ',importBatchRes.error?'取得エラー':`${importBatchRes.count??0}件`,!importBatchRes.error]);
      if(promoReviewsRes.error||officialPromoRes.error){
        checks.push(['評価・正式発令整合','取得エラー',false]);
      }else{
        const officialMap=new Map((officialPromoRes.data||[]).map(x=>[x.id,x]));
        const broken=(promoReviewsRes.data||[]).filter(r=>r.result_hr_history_id&&!officialMap.has(r.result_hr_history_id));
        const wrongEmployee=(promoReviewsRes.data||[]).filter(r=>{
          const o=officialMap.get(r.result_hr_history_id); return o&&String(o.employee_id)!==String(r.employee_id);
        });
        const decidedNotIssued=(promoReviewsRes.data||[]).filter(r=>r.decision_status==='昇格決定'&&!r.result_hr_history_id);
        checks.push(['正式発令リンク欠落',`${broken.length}件`,broken.length===0]);
        checks.push(['正式発令社員不一致',`${wrongEmployee.length}件`,wrongEmployee.length===0]);
        checks.push(['昇格決定・発令待ち',`${decidedNotIssued.length}件`,true]);
      }
      if(assignmentRes.error){
        checks.push(['所属履歴整合','取得エラー',false]);
      }else{
        const employeeIds=new Set(employees.map(e=>String(e.id)));
        const centerIds=new Set((centerRes.data||[]).map(x=>String(x.id)));
        const positionIds=new Set((positionRes.data||[]).map(x=>String(x.id)));
        const orphanAssignments=(assignmentRes.data||[]).filter(x=>!employeeIds.has(String(x.employee_id)));
        const badCenter=(assignmentRes.data||[]).filter(x=>x.center_id&&!centerIds.has(String(x.center_id)));
        const badPosition=(assignmentRes.data||[]).filter(x=>x.position_id&&!positionIds.has(String(x.position_id)));
        const activeByEmployee=new Map();
        (assignmentRes.data||[]).filter(x=>!x.effective_to).forEach(x=>{
          const k=String(x.employee_id); activeByEmployee.set(k,(activeByEmployee.get(k)||0)+1);
        });
        const multiActive=[...activeByEmployee.values()].filter(n=>n>1).length;
        checks.push(['所属履歴・社員参照切れ',`${orphanAssignments.length}件`,orphanAssignments.length===0]);
        checks.push(['所属履歴・センター参照切れ',`${badCenter.length}件`,badCenter.length===0]);
        checks.push(['所属履歴・役職参照切れ',`${badPosition.length}件`,badPosition.length===0]);
        checks.push(['所属履歴・現行レコード重複',`${multiActive}名`,multiActive===0]);
      }
      if(licenseLinkRes.error||licenseMasterRes.error){
        checks.push(['資格免許参照整合','取得エラー',false]);
      }else{
        const employeeIds=new Set(employees.map(e=>String(e.id)));
        const licenseIds=new Set((licenseMasterRes.data||[]).map(x=>String(x.id)));
        const orphanEmployee=(licenseLinkRes.data||[]).filter(x=>!employeeIds.has(String(x.employee_id)));
        const orphanMaster=(licenseLinkRes.data||[]).filter(x=>!licenseIds.has(String(x.license_id)));
        const duplicateLicenseKeys=new Map();
        (licenseLinkRes.data||[]).forEach(x=>{
          const k=`${x.employee_id}::${x.license_id}`; duplicateLicenseKeys.set(k,(duplicateLicenseKeys.get(k)||0)+1);
        });
        const duplicatePairs=[...duplicateLicenseKeys.values()].filter(n=>n>1).length;
        checks.push(['資格免許・社員参照切れ',`${orphanEmployee.length}件`,orphanEmployee.length===0]);
        checks.push(['資格免許・マスタ参照切れ',`${orphanMaster.length}件`,orphanMaster.length===0]);
        checks.push(['資格免許・同一社員同一資格重複',`${duplicatePairs}組`,duplicatePairs===0]);
      }
      const retired=employees.filter(e=>e.is_active===false||e.status==='retired'||e.status==='past'||!!e.retirement_date);
      const retiredMissingDate=retired.filter(e=>e.status!=='past'&&!e.retirement_date).length;
      const activeWithRetirement=employees.filter(e=>e.is_active!==false&&e.status!=='retired'&&e.status!=='past'&&!!e.retirement_date).length;
      checks.push(['退職者・退職日未設定',`${retiredMissingDate}名`,retiredMissingDate===0]);
      checks.push(['在籍状態・退職日矛盾',`${activeWithRetirement}名`,activeWithRetirement===0]);
    }else{
      checks.push(['長期運用DB監査','ログイン後に確認',false]);
    }
    document.getElementById('health-checks').innerHTML=`<div class="ops-check-list">${checks.map(([label,value,ok])=>`<div class="ops-check-row"><span>${APP.escape(label)}</span><strong>${APP.badge(ok?'OK':'要確認',ok?'success':'warning')} ${APP.escape(value)}</strong></div>`).join('')}</div>`;
    await loadAuditLog();
  }catch(e){console.error(e);APP.toast('データ運用確認に失敗しました','error');}
  finally{if(btn){btn.disabled=false;btn.textContent='再確認';}}
}
document.getElementById('btn-health-refresh')?.addEventListener('click',initDataOperations);
document.getElementById('btn-audit-export')?.addEventListener('click',exportAuditCSV);
document.getElementById('btn-audit-probe')?.addEventListener('click',runAuditProbe);
window.initDataOperations=initDataOperations;
window.exportAuditCSV=exportAuditCSV;
window.runAuditProbe=runAuditProbe;

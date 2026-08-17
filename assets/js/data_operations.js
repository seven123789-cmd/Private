let OPS_AUDIT_ROWS=[];
let OPS_HEALTH_ISSUES=new Map();
let OPS_ACTIVE_ISSUE_KEY=null;

function opsIssueKey(label){return String(label||'').replace(/[^\wぁ-んァ-ヶ一-龠々ー]+/g,'_');}
function setOpsIssue(label,rows,columns){
  const key=opsIssueKey(label);
  OPS_HEALTH_ISSUES.set(key,{label,rows:rows||[],columns:columns||[]});
  return key;
}
function clearOpsIssues(){
  OPS_HEALTH_ISSUES=new Map();
  OPS_ACTIVE_ISSUE_KEY=null;
  const panel=document.getElementById('ops-issue-panel');
  if(panel) panel.hidden=true;
}
function opsEmployeeLink(employeeId,name,code){
  if(!employeeId)return APP.escape(name||code||'—');
  const label=APP.escape(name||code||employeeId);
  return `<a href="employee_detail.html?id=${encodeURIComponent(employeeId)}">${label}</a>`;
}
function showOpsIssue(key){
  const issue=OPS_HEALTH_ISSUES.get(key),panel=document.getElementById('ops-issue-panel');
  if(!issue||!panel)return;
  OPS_ACTIVE_ISSUE_KEY=key;
  document.getElementById('ops-issue-title').textContent=issue.label;
  document.getElementById('ops-issue-count').textContent=`${issue.rows.length}件`;
  const head=document.getElementById('ops-issue-head'),body=document.getElementById('ops-issue-body');
  head.innerHTML=`<tr>${issue.columns.map(c=>`<th>${APP.escape(c.label)}</th>`).join('')}</tr>`;
  body.innerHTML=issue.rows.length?issue.rows.map(row=>`<tr>${issue.columns.map(c=>{
    let v=typeof c.value==='function'?c.value(row):row[c.value];
    if(c.type==='employee') return `<td>${opsEmployeeLink(row.employee_id,row.employee_name,row.employee_code)}</td>`;
    if(c.type==='date') v=v?APP.fmtDate(v):'—';
    return `<td>${APP.escape(v??'—')}</td>`;
  }).join('')}</tr>`).join(''):`<tr><td colspan="${Math.max(1,issue.columns.length)}" class="empty">対象はありません</td></tr>`;
  panel.hidden=false;
  panel.scrollIntoView({behavior:'smooth',block:'start'});
}
function exportOpsIssueCSV(){
  const issue=OPS_HEALTH_ISSUES.get(OPS_ACTIVE_ISSUE_KEY);
  if(!issue||!issue.rows.length){APP.toast('出力できる詳細データがありません','warning');return;}
  APP.downloadCSV(`整合監査_${issue.label}_${APP.exportStamp()}.csv`,
    issue.columns.map(c=>({label:c.label,value:r=>{
      if(c.type==='employee')return `${r.employee_code||''} ${r.employee_name||''}`.trim();
      const v=typeof c.value==='function'?c.value(r):r[c.value];
      return c.type==='date'&&v?APP.fmtDate(v):(v??'');
    }})),issue.rows);
}


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
    clearOpsIssues();
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
    if(missingCode){
      setOpsIssue('社員コード未設定',employees.filter(e=>!String(e.employee_code||'').trim()).map(e=>({employee_id:e.id,employee_name:e.name,employee_code:e.employee_code,center:e.center})),[
        {label:'社員',type:'employee'},{label:'所属',value:'center'}
      ]);
    }
    if(missingName){
      setOpsIssue('氏名未設定',employees.filter(e=>!String(e.name||'').trim()).map(e=>({employee_id:e.id,employee_name:e.name,employee_code:e.employee_code,center:e.center})),[
        {label:'社員',type:'employee'},{label:'所属',value:'center'}
      ]);
    }
    if(duplicateCodes.length){
      setOpsIssue('社員コード重複',employees.filter(e=>duplicateCodes.includes(String(e.employee_code||'').trim())).map(e=>({employee_id:e.id,employee_name:e.name,employee_code:e.employee_code,center:e.center,status:e.status})),[
        {label:'社員',type:'employee'},{label:'所属',value:'center'},{label:'状態',value:'status'}
      ]);
    }
    if(orphanLicenses){
      setOpsIssue('社員識別子のない資格',licenses.filter(l=>!l.employee_id&&!l.employee_code).map(l=>({license_id:l.id,license_name:l.license_name||l.name||'',expiration_date:l.expiration_date})),[
        {label:'資格レコードID',value:'license_id'},{label:'資格',value:'license_name'},{label:'期限',value:'expiration_date',type:'date'}
      ]);
    }

    const sb=APP.client();
    if(sb&&user){
      const [versionRes,manifestRes,naturalKeyRes,baselineRes,verifyRes,auditCountRes,importBatchRes,promoReviewsRes,officialPromoRes,
        assignmentRes,licenseLinkRes,licenseMasterRes,centerRes,positionRes,officialHrRes]=await Promise.all([
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
        sb.from('positions').select('id'),
        sb.from('employee_hr_history_official').select('id,employee_id,effective_date,effective_label,event_type,from_grade,to_grade,status').eq('status','active')
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
        const employeeById=new Map(employees.map(e=>[String(e.id),e]));
        if(broken.length){
          setOpsIssue('正式発令リンク欠落',broken.map(r=>{const e=employeeById.get(String(r.employee_id))||{};return {employee_id:r.employee_id,employee_name:e.name,employee_code:e.employee_code,review_id:r.id,history_id:r.result_hr_history_id,decision:r.decision_status};}),[
            {label:'社員',type:'employee'},{label:'昇格判断',value:'decision'},{label:'年度判断ID',value:'review_id'},{label:'正式履歴ID',value:'history_id'}
          ]);
        }
        if(wrongEmployee.length){
          setOpsIssue('正式発令社員不一致',wrongEmployee.map(r=>{const e=employeeById.get(String(r.employee_id))||{},o=officialMap.get(r.result_hr_history_id)||{};return {employee_id:r.employee_id,employee_name:e.name,employee_code:e.employee_code,review_id:r.id,history_id:r.result_hr_history_id,official_employee_id:o.employee_id};}),[
            {label:'判断側社員',type:'employee'},{label:'年度判断ID',value:'review_id'},{label:'正式履歴ID',value:'history_id'},{label:'正式履歴の社員ID',value:'official_employee_id'}
          ]);
        }
        if(decidedNotIssued.length){
          setOpsIssue('昇格決定・発令待ち',decidedNotIssued.map(r=>{const e=employeeById.get(String(r.employee_id))||{};return {employee_id:r.employee_id,employee_name:e.name,employee_code:e.employee_code,review_id:r.id,decision:r.decision_status};}),[
            {label:'社員',type:'employee'},{label:'状態',value:'decision'},{label:'年度判断ID',value:'review_id'}
          ]);
        }
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
        const employeeById=new Map(employees.map(e=>[String(e.id),e]));
        const decorateAssignment=x=>{const e=employeeById.get(String(x.employee_id))||{};return {...x,employee_name:e.name,employee_code:e.employee_code};};
        if(orphanAssignments.length)setOpsIssue('所属履歴・社員参照切れ',orphanAssignments.map(decorateAssignment),[
          {label:'履歴ID',value:'id'},{label:'社員ID',value:'employee_id'},{label:'開始日',value:'effective_from',type:'date'},{label:'終了日',value:'effective_to',type:'date'}
        ]);
        if(badCenter.length)setOpsIssue('所属履歴・センター参照切れ',badCenter.map(decorateAssignment),[
          {label:'社員',type:'employee'},{label:'履歴ID',value:'id'},{label:'センターID',value:'center_id'},{label:'開始日',value:'effective_from',type:'date'}
        ]);
        if(badPosition.length)setOpsIssue('所属履歴・役職参照切れ',badPosition.map(decorateAssignment),[
          {label:'社員',type:'employee'},{label:'履歴ID',value:'id'},{label:'役職ID',value:'position_id'},{label:'開始日',value:'effective_from',type:'date'}
        ]);
        const duplicateActiveRows=[];
        for(const [eid,n] of activeByEmployee.entries()){
          if(n>1){
            const e=employeeById.get(eid)||{};
            (assignmentRes.data||[]).filter(x=>String(x.employee_id)===eid&&!x.effective_to).forEach(x=>duplicateActiveRows.push({...x,employee_name:e.name,employee_code:e.employee_code}));
          }
        }
        if(duplicateActiveRows.length)setOpsIssue('所属履歴・現行レコード重複',duplicateActiveRows,[
          {label:'社員',type:'employee'},{label:'履歴ID',value:'id'},{label:'センターID',value:'center_id'},{label:'役職ID',value:'position_id'},{label:'開始日',value:'effective_from',type:'date'}
        ]);
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
        const employeeById=new Map(employees.map(e=>[String(e.id),e]));
        if(orphanEmployee.length)setOpsIssue('資格免許・社員参照切れ',orphanEmployee.map(x=>({license_row_id:x.id,employee_id:x.employee_id,license_id:x.license_id})),[
          {label:'資格登録ID',value:'license_row_id'},{label:'社員ID',value:'employee_id'},{label:'資格ID',value:'license_id'}
        ]);
        if(orphanMaster.length)setOpsIssue('資格免許・マスタ参照切れ',orphanMaster.map(x=>{const e=employeeById.get(String(x.employee_id))||{};return {...x,employee_name:e.name,employee_code:e.employee_code};}),[
          {label:'社員',type:'employee'},{label:'資格登録ID',value:'id'},{label:'資格ID',value:'license_id'}
        ]);
        const duplicateRows=[];
        for(const [k,n] of duplicateLicenseKeys.entries()){
          if(n>1){
            const [eid,lid]=k.split('::'),e=employeeById.get(String(eid))||{};
            (licenseLinkRes.data||[]).filter(x=>String(x.employee_id)===eid&&String(x.license_id)===lid).forEach(x=>duplicateRows.push({...x,employee_name:e.name,employee_code:e.employee_code}));
          }
        }
        if(duplicateRows.length)setOpsIssue('資格免許・同一社員同一資格重複',duplicateRows,[
          {label:'社員',type:'employee'},{label:'資格登録ID',value:'id'},{label:'資格ID',value:'license_id'}
        ]);
      }
      if(officialHrRes.error){
        checks.push(['現在等級・正式履歴整合','取得エラー',false]);
      }else{
        const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
        const employeeById=new Map(employees.map(e=>[String(e.id),e]));
        const gradeTypes=['資格昇格','入社時等級','正社員登用時等級','懲戒・降格','資格等級確認'];
        const isGradeRow=r=>{
          const before=String(r.from_grade||'').trim(),after=String(r.to_grade||'').trim();
          if(!after||before===after)return false;
          return gradeTypes.some(t=>String(r.event_type||'').includes(t));
        };
        const datedRows=(officialHrRes.data||[]).filter(r=>isGradeRow(r)&&r.effective_date&&r.effective_date<=today);
        const byEmployee=new Map();
        datedRows.forEach(r=>{
          const k=String(r.employee_id);
          if(!byEmployee.has(k))byEmployee.set(k,[]);
          byEmployee.get(k).push(r);
        });
        const mismatches=[];
        for(const [eid,rows] of byEmployee.entries()){
          const e=employeeById.get(eid);
          if(!e)continue;
          rows.sort((a,b)=>String(a.effective_date).localeCompare(String(b.effective_date)));
          const latest=rows.at(-1);
          const current=String(e.current_grade||'').trim(),official=String(latest.to_grade||'').trim();
          if(current!==official)mismatches.push({
            employee_id:e.id,employee_name:e.name,employee_code:e.employee_code,
            current_grade:current||'未設定',official_grade:official||'未設定',
            effective_date:latest.effective_date,event_type:latest.event_type,history_id:latest.id
          });
        }
        const undatedGrade=(officialHrRes.data||[]).filter(r=>isGradeRow(r)&&!r.effective_date);
        checks.push(['現在等級・正式履歴不一致',`${mismatches.length}名`,mismatches.length===0]);
        checks.push(['等級履歴・日付不明',`${undatedGrade.length}件`,true]);
        if(mismatches.length)setOpsIssue('現在等級・正式履歴不一致',mismatches,[
          {label:'社員',type:'employee'},{label:'現在等級',value:'current_grade'},{label:'正式履歴の最新等級',value:'official_grade'},
          {label:'発令日',value:'effective_date',type:'date'},{label:'種別',value:'event_type'},{label:'正式履歴ID',value:'history_id'}
        ]);
        if(undatedGrade.length)setOpsIssue('等級履歴・日付不明',undatedGrade.map(r=>{const e=employeeById.get(String(r.employee_id))||{};return {
          employee_id:r.employee_id,employee_name:e.name,employee_code:e.employee_code,event_type:r.event_type,
          from_grade:r.from_grade,to_grade:r.to_grade,effective_label:r.effective_label,history_id:r.id
        };}),[
          {label:'社員',type:'employee'},{label:'種別',value:'event_type'},{label:'変更前',value:'from_grade'},
          {label:'変更後',value:'to_grade'},{label:'日付表示',value:'effective_label'},{label:'正式履歴ID',value:'history_id'}
        ]);
      }
      const retired=employees.filter(e=>e.is_active===false||e.status==='retired'||e.status==='past'||!!e.retirement_date);
      const normalRetiredUnknown=retired.filter(e=>e.status!=='past'&&!e.retirement_date&&e.retirement_handling_type!=='administrative_retired');
      const administrativeRetired=retired.filter(e=>e.retirement_handling_type==='administrative_retired');
      const activeWithRetirement=employees.filter(e=>e.is_active!==false&&e.status!=='retired'&&e.status!=='past'&&!!e.retirement_date);
      checks.push(['退職日未確認',`${normalRetiredUnknown.length}名`,true]);
      checks.push(['マスタ上退職扱い',`${administrativeRetired.length}名`,true]);
      checks.push(['在籍状態・退職日矛盾',`${activeWithRetirement.length}名`,activeWithRetirement.length===0]);
      if(normalRetiredUnknown.length)setOpsIssue('退職日未確認',normalRetiredUnknown.map(e=>({
        employee_id:e.id,employee_name:e.name,employee_code:e.employee_code,center:e.center,status:e.status,
        retirement_date_status:e.retirement_date_status,retirement_note:e.retirement_note
      })),[
        {label:'社員',type:'employee'},{label:'所属',value:'center'},{label:'状態',value:'status'},
        {label:'退職日状態',value:'retirement_date_status'},{label:'備考',value:'retirement_note'}
      ]);
      if(administrativeRetired.length)setOpsIssue('マスタ上退職扱い',administrativeRetired.map(e=>({
        employee_id:e.id,employee_name:e.name,employee_code:e.employee_code,center:e.center,status:e.status,
        retirement_handling_type:e.retirement_handling_type,retirement_note:e.retirement_note
      })),[
        {label:'社員',type:'employee'},{label:'所属',value:'center'},{label:'状態',value:'status'},
        {label:'扱い',value:'retirement_handling_type'},{label:'備考',value:'retirement_note'}
      ]);
      if(activeWithRetirement.length)setOpsIssue('在籍状態・退職日矛盾',activeWithRetirement.map(e=>({
        employee_id:e.id,employee_name:e.name,employee_code:e.employee_code,center:e.center,
        retirement_date:e.retirement_date,status:e.status
      })),[
        {label:'社員',type:'employee'},{label:'所属',value:'center'},
        {label:'退職日',value:'retirement_date',type:'date'},{label:'状態',value:'status'}
      ]);
    }else{
      checks.push(['長期運用DB監査','ログイン後に確認',false]);
    }
    document.getElementById('health-checks').innerHTML=`<div class="ops-check-list">${checks.map(([label,value,ok])=>{
      const key=opsIssueKey(label),issue=OPS_HEALTH_ISSUES.get(key);
      const detail=issue&&issue.rows.length?`<button class="btn btn-secondary btn-xs ops-detail-btn" type="button" data-ops-issue="${APP.escape(key)}">詳細 ${issue.rows.length}</button>`:'';
      return `<div class="ops-check-row"><span>${APP.escape(label)}</span><div class="ops-check-result"><strong>${APP.badge(ok?'OK':'要確認',ok?'success':'warning')} ${APP.escape(value)}</strong>${detail}</div></div>`;
    }).join('')}</div>`;
    document.querySelectorAll('[data-ops-issue]').forEach(btn=>btn.addEventListener('click',()=>showOpsIssue(btn.dataset.opsIssue)));
    await loadAuditLog();
  }catch(e){console.error(e);APP.toast('データ運用確認に失敗しました','error');}
  finally{if(btn){btn.disabled=false;btn.textContent='再確認';}}
}
document.getElementById('btn-health-refresh')?.addEventListener('click',initDataOperations);
document.getElementById('btn-audit-export')?.addEventListener('click',exportAuditCSV);
document.getElementById('btn-ops-issue-export')?.addEventListener('click',exportOpsIssueCSV);
document.getElementById('btn-audit-probe')?.addEventListener('click',runAuditProbe);
window.initDataOperations=initDataOperations;
window.exportAuditCSV=exportAuditCSV;
window.runAuditProbe=runAuditProbe;
window.showOpsIssue=showOpsIssue;
window.exportOpsIssueCSV=exportOpsIssueCSV;

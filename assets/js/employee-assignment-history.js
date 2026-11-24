/* Phase16-E: 社員所属・職種・等級履歴 Repository / UI
   - 履歴表示
   - 異動・職種・等級・役職変更UI
   - Phase16-E DB RPCへ接続
*/
window.EmployeeAssignmentHistory = (() => {
  const typeLabel = {
    initial:'初期登録', hire:'入社', transfer:'異動', position_change:'役職変更',
    grade_change:'等級変更', correction:'訂正', other:'その他'
  };
  let currentEmployee = null;
  let currentHistory = null;
  let masterOptions = {centers:[],divisions:[],positions:[],grades:[],job_titles:[]};
  let currentJobTitles = [];
  let currentPrimaryJobTitleId = null;

  const fmt = v => APP.fmtDate(v) || '—';
  const esc = v => APP.escape(v ?? '');
  const strId = v => v == null ? '' : String(v);
  const todayJst = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());

  function addDays(dateString, days) {
    const d = new Date(`${dateString}T00:00:00+09:00`);
    d.setUTCDate(d.getUTCDate()+days);
    return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(d);
  }

  async function load(employeeId) {
    const sb = APP.client();
    if (!sb) return {data:[],error:new Error('Supabaseに接続されていません')};

    // Phase16-E RPCが未導入ならPhase16-Dの直接参照へフォールバックする。
    const rpc = await sb.rpc('get_employee_assignment_history_v2',{p_employee_id:employeeId});
    if (!rpc.error) return {data:rpc.data||[],error:null};

    console.warn('history v2 RPC unavailable; fallback to direct query', rpc.error);
    const [hist, centers, divisions, positions, grades] = await Promise.all([
      sb.from('employee_assignment_history').select('*').eq('employee_id',employeeId).order('effective_from',{ascending:false}),
      sb.from('centers').select('*'), sb.from('divisions').select('*'),
      sb.from('positions').select('*'), sb.from('grades').select('*')
    ]);
    if (hist.error) return {data:[],error:hist.error};
    const mapById = rows => new Map((rows||[]).map(x=>[String(x.id),x]));
    const labelOf = (row,candidates) => {
      if(!row) return '—';
      for(const k of candidates) if(row[k]!=null && String(row[k]).trim()) return String(row[k]);
      return '—';
    };
    const cm=mapById(centers.data), dm=mapById(divisions.data), pm=mapById(positions.data), gm=mapById(grades.data);
    return {data:(hist.data||[]).map(h=>({
      ...h,
      center_name:labelOf(cm.get(String(h.center_id)),['center_name','name','center_code']),
      division_name:labelOf(dm.get(String(h.division_id)),['division_name','name','division_code']),
      position_name:labelOf(pm.get(String(h.position_id)),['position_name','name','position_code']),
      grade_name:h.grade_id?labelOf(gm.get(String(h.grade_id)),['grade_name','name','grade_code']):'未設定'
    })),error:null};
  }

  function render(rows,target) {
    if(!target) return;
    if(!rows.length){
      target.innerHTML='<div class="empty">所属・職種・等級の履歴はありません</div>';
      return;
    }
    currentHistory = rows.find(r=>r.effective_to===null) || null;
    target.innerHTML=`<div class="assignment-history">${rows.map(r=>`
      <article class="assignment-history__item ${r.effective_to===null?'is-current':''}">
        <div class="assignment-history__rail"><span></span></div>
        <div class="assignment-history__content">
          <div class="assignment-history__head">
            <div><strong>${esc(fmt(r.effective_from))}</strong><span class="assignment-history__period">${r.effective_to?' ～ '+esc(fmt(r.effective_to)):' ～ 現在'}</span></div>
            ${r.effective_to===null?APP.badge('現在','success'):APP.badge(typeLabel[r.change_type]||r.change_type||'変更','secondary')}
          </div>
          <div class="assignment-history__grid">
            <div><span>センター</span><strong>${esc(r.center_name||'—')}</strong></div>
            <div><span>部門</span><strong>${esc(r.division_name||'—')}</strong></div>
            <div><span>職種</span><strong>${esc(r.position_name||'—')}</strong></div>
            <div><span>等級</span><strong>${esc(r.grade_name||'未設定')}</strong></div>
          </div>
          ${r.memo?`<div class="assignment-history__memo">${esc(r.memo)}</div>`:''}
        </div>
      </article>`).join('')}</div>`;
  }

  async function mount(employeeId,targetId='emp-assignment-history') {
    const target=document.getElementById(targetId);
    if(!target) return;
    target.innerHTML='<div class="empty">履歴を読み込んでいます…</div>';
    const result=await load(employeeId);
    if(result.error){
      console.error('employee assignment history load failed',result.error);
      target.innerHTML='<div class="empty">履歴を読み込めませんでした</div>';
      return;
    }
    render(result.data,target);
  }

  async function loadMasterOptions() {
    const sb=APP.client();
    if(!sb) throw new Error('Supabaseに接続されていません');
    const r=await sb.rpc('get_assignment_master_options');
    if(r.error) throw new Error('Phase16-E DB関数が未導入です。先に phase16e-db-functions.sql を実行してください。');
    const data=r.data||{};
    return {
      centers:Array.isArray(data.centers)?data.centers:[],
      divisions:Array.isArray(data.divisions)?data.divisions:[],
      positions:Array.isArray(data.positions)?data.positions:[],
      grades:Array.isArray(data.grades)?data.grades:[],
      job_titles:Array.isArray(data.job_titles)?data.job_titles:[]
    };
  }

  function fillSelect(id,rows,labelKey,blankLabel) {
    const el=document.getElementById(id);
    if(!el) return;
    el.innerHTML=(blankLabel!==null?`<option value="">${esc(blankLabel)}</option>`:'')+
      rows.map(x=>`<option value="${esc(x.id)}">${esc(x[labelKey]||'—')}</option>`).join('');
  }

  function optionLabel(selectId) {
    const el=document.getElementById(selectId);
    return el?.selectedOptions?.[0]?.textContent?.trim() || '—';
  }

  function detectChangeType(values) {
    if(!currentHistory) return 'other';
    if(strId(values.center_id)!==strId(currentHistory.center_id) ||
       strId(values.division_id)!==strId(currentHistory.division_id)) return 'transfer';
    if(strId(values.position_id)!==strId(currentHistory.position_id)) return 'position_change';
    if(strId(values.grade_id)!==strId(currentHistory.grade_id)) return 'grade_change';
    return 'other';
  }

  function collectForm() {
    return {
      effective_from:document.getElementById('assignment-effective-from')?.value||'',
      center_id:document.getElementById('assignment-center')?.value||'',
      division_id:document.getElementById('assignment-division')?.value||'',
      position_id:document.getElementById('assignment-position')?.value||'',
      grade_id:document.getElementById('assignment-grade')?.value||null,
      employment_type:document.getElementById('assignment-employment-type')?.value||'',
      memo:document.getElementById('assignment-memo')?.value?.trim()||null,
      job_title_ids:[...document.querySelectorAll('input[name="assignment-job-title"]:checked')].map(x=>x.value),
      primary_job_title_id:document.querySelector('input[name="assignment-primary-job-title"]:checked')?.value||null
    };
  }

  function diffItems(values) {
    if(!currentHistory) return [];
    const items=[];
    const push=(label,oldVal,newVal,oldId,newId)=>{
      if(strId(oldId)!==strId(newId)) items.push({label,oldVal:oldVal||'—',newVal:newVal||'—'});
    };
    push('センター',currentHistory.center_name,optionLabel('assignment-center'),currentHistory.center_id,values.center_id);
    push('部門',currentHistory.division_name,optionLabel('assignment-division'),currentHistory.division_id,values.division_id);
    push('職種',currentHistory.position_name,optionLabel('assignment-position'),currentHistory.position_id,values.position_id);
    const newGrade=values.grade_id?optionLabel('assignment-grade'):'未設定';
    push('等級',currentHistory.grade_name||'未設定',newGrade,currentHistory.grade_id,values.grade_id);
    push('雇用区分',currentEmployee.employment_type,values.employment_type,currentEmployee.employment_type,values.employment_type);
    const oldIds=currentJobTitles.map(x=>strId(x.job_title_id)).sort();
    const newIds=(values.job_title_ids||[]).map(strId).sort();
    const titleChanged=oldIds.join('|')!==newIds.join('|') || strId(currentPrimaryJobTitleId)!==strId(values.primary_job_title_id);
    if(titleChanged){
      const oldNames=currentJobTitles.map(x=>x.title_name+(x.is_primary?' ★':'')).join(' / ')||'なし';
      const newNames=(values.job_title_ids||[]).map(id=>{
        const row=masterOptions.job_titles.find(x=>strId(x.id)===strId(id));
        return (row?.title_name||'—')+(strId(id)===strId(values.primary_job_title_id)?' ★':'');
      }).join(' / ')||'なし';
      items.push({label:'役職',oldVal:oldNames,newVal:newNames});
    }
    return items;
  }

  function renderPreview() {
    const target=document.getElementById('assignment-change-preview-body');
    if(!target) return;
    const values=collectForm();
    const items=diffItems(values);
    if(!items.length){
      target.innerHTML='<span class="text-muted">現在の登録内容から変更はありません。</span>';
      return;
    }
    target.innerHTML=items.map(x=>`<div class="assignment-diff-row"><span>${esc(x.label)}</span><strong>${esc(x.oldVal)}</strong><i>→</i><strong>${esc(x.newVal)}</strong></div>`).join('');
  }

  async function loadJobTitles(employeeId) {
    const sb=APP.client();
    if(!sb) return {data:[],error:new Error('Supabaseに接続されていません')};
    const r=await sb.rpc('get_employee_job_title_history_v1',{p_employee_id:employeeId});
    if(r.error) return {data:[],error:r.error};
    return {data:r.data||[],error:null};
  }

  function renderJobTitleChoices(){
    const box=document.getElementById('assignment-job-titles');
    if(!box) return;
    box.innerHTML=masterOptions.job_titles.map(x=>`<label class="job-title-choice"><input type="checkbox" name="assignment-job-title" value="${esc(x.id)}"><span>${esc(x.title_name)}</span><input type="radio" name="assignment-primary-job-title" value="${esc(x.id)}" title="代表役職"><b>★</b></label>`).join('') || '<span class="text-muted">役職マスターがありません</span>';
    box.querySelectorAll('input').forEach(el=>el.addEventListener('change',()=>{syncPrimaryChoices();renderPreview();}));
  }

  function syncPrimaryChoices(){
    const selected=new Set([...document.querySelectorAll('input[name="assignment-job-title"]:checked')].map(x=>x.value));
    document.querySelectorAll('input[name="assignment-primary-job-title"]').forEach(r=>{
      r.disabled=!selected.has(r.value);
      if(r.checked && r.disabled) r.checked=false;
    });
    if(selected.size && !document.querySelector('input[name="assignment-primary-job-title"]:checked')){
      const first=[...document.querySelectorAll('input[name="assignment-primary-job-title"]')].find(r=>!r.disabled);
      if(first) first.checked=true;
    }
  }

  async function mountJobTitles(employeeId,targetId='emp-job-title-history'){
    const target=document.getElementById(targetId);
    const result=await loadJobTitles(employeeId);
    if(result.error){
      console.error('job title history load failed',result.error);
      if(target) target.innerHTML='<div class="empty">役職履歴を読み込めませんでした</div>';
      return;
    }
    const rows=result.data||[];
    currentJobTitles=rows.filter(x=>x.effective_to===null);
    currentPrimaryJobTitleId=currentJobTitles.find(x=>x.is_primary)?.job_title_id||null;
    const currentLabel=currentJobTitles.map(x=>`${x.title_name}${x.is_primary?' ★':''}`).join(' / ')||'—';
    const cur=document.getElementById('emp-job-title'); if(cur) cur.textContent=currentLabel;
    if(!target) return;
    if(!rows.length){target.innerHTML='<div class="empty">登録済みの役職履歴はありません</div>';return;}
    target.innerHTML=`<div class="assignment-history">${rows.map(r=>`<article class="assignment-history__item ${r.effective_to===null?'is-current':''}"><div class="assignment-history__rail"><span></span></div><div class="assignment-history__content"><div class="assignment-history__head"><div><strong>${esc(fmt(r.effective_from))}</strong><span class="assignment-history__period">${r.effective_to?' ～ '+esc(fmt(r.effective_to)):' ～ 現在'}</span></div>${r.is_primary?APP.badge('代表役職','primary'):APP.badge('兼務','gray')}</div><div class="assignment-history__grid"><div><span>役職</span><strong>${esc(r.title_name||'—')}</strong></div></div>${r.memo?`<div class="assignment-history__memo">${esc(r.memo)}</div>`:''}</div></article>`).join('')}</div>`;
  }

  function closeModal() {
    document.getElementById('assignment-change-modal')?.classList.add('hidden');
  }

  async function openModal() {
    if(!currentEmployee || !currentHistory){
      APP.toast('現在の人事履歴を確認できないため変更できません','error');
      return;
    }
    try{
      masterOptions=await loadMasterOptions();
    }catch(e){
      console.error(e);
      APP.toast(e.message||'マスタを読み込めませんでした','error');
      return;
    }

    fillSelect('assignment-center',masterOptions.centers,'center_name',null);
    fillSelect('assignment-division',masterOptions.divisions,'division_name',null);
    fillSelect('assignment-position',masterOptions.positions,'position_name',null);
    fillSelect('assignment-grade',masterOptions.grades,'grade_name','未設定');
    renderJobTitleChoices();
    let employment=document.getElementById('assignment-employment-type');
    if(!employment){
      const field=document.createElement('div');
      const label=document.createElement('label');label.htmlFor='assignment-employment-type';label.textContent='雇用区分（本日付のみ）';
      employment=document.createElement('select');employment.id='assignment-employment-type';employment.className=document.getElementById('assignment-grade').className;
      field.append(label,employment);document.getElementById('assignment-grade').parentElement.after(field);
      employment.addEventListener('change',renderPreview);
    }
    employment.replaceChildren();
    const currentType=currentEmployee.employment_type||'';
    for(const type of [...new Set([currentType,'正社員','準社員S','準社員A','準社員B','副社員'])]){const o=document.createElement('option');o.value=type;o.textContent=type||'未設定';employment.append(o);}
    employment.value=currentType;

    document.getElementById('assignment-center').value=strId(currentHistory.center_id);
    document.getElementById('assignment-division').value=strId(currentHistory.division_id);
    document.getElementById('assignment-position').value=strId(currentHistory.position_id);
    document.getElementById('assignment-grade').value=strId(currentHistory.grade_id);
    currentJobTitles.forEach(x=>{
      const cb=document.querySelector(`input[name="assignment-job-title"][value="${CSS.escape(strId(x.job_title_id))}"]`);
      if(cb) cb.checked=true;
    });
    if(currentPrimaryJobTitleId){
      const radio=document.querySelector(`input[name="assignment-primary-job-title"][value="${CSS.escape(strId(currentPrimaryJobTitleId))}"]`);
      if(radio) radio.checked=true;
    }
    syncPrimaryChoices();

    const minDate=currentHistory.effective_from;
    const today=todayJst();
    const dateEl=document.getElementById('assignment-effective-from');
    dateEl.removeAttribute('min');
    dateEl.max=today;
    dateEl.value=today >= minDate ? today : minDate;
    document.getElementById('assignment-date-help').textContent=`本日付・同日変更可。過去の役職訂正は登録時に確認します。所属等の変更は既存履歴開始日以降。`;
    document.getElementById('assignment-memo').value='';
    renderPreview();
    document.getElementById('assignment-change-modal').classList.remove('hidden');
    dateEl.focus();
  }

  async function submitChange(ev) {
    ev.preventDefault();
    const values=collectForm();
    if(!values.effective_from || !values.center_id || !values.division_id || !values.position_id){
      APP.toast('適用日・センター・部門・職種は必須です','warning');
      return;
    }
    if(values.effective_from > todayJst()){
      APP.toast('未来日の予約異動はこの画面では登録できません','warning');
      return;
    }
    const diffs=diffItems(values);
    if(!diffs.length){
      APP.toast('変更内容がありません','warning');
      return;
    }

    const summary=diffs.map(x=>`${x.label}: ${x.oldVal} → ${x.newVal}`).join('\n');
    const employmentChanged=diffs.some(x=>x.label==='雇用区分');
    if(employmentChanged && (values.effective_from!==todayJst() || !values.memo?.trim())){APP.toast('雇用区分変更は本日付と変更理由の入力が必要です','warning');return;}
    const titleOnly=diffs.every(x=>x.label==='役職');
    const correction=titleOnly && confirm('役職定年・登録漏れ・誤登録の訂正として、指定日以降の役職履歴を置き換えますか？\nOK：役職履歴訂正／キャンセル：通常の人事変更');
    if(!correction && values.effective_from < currentHistory.effective_from){
      APP.toast('所属等の遡及変更は未対応です','warning');return;
    }
    if(!confirm(`以下の人事変更を登録します。\n\n適用日: ${values.effective_from}\n${summary}\n\n登録しますか？`)) return;

    const btn=document.getElementById('btn-submit-assignment-change');
    btn.disabled=true; btn.textContent='登録中…';
    const sb=APP.client();
    const payload={
      p_employee_id:currentEmployee.id,
      p_effective_from:values.effective_from,
      p_center_id:values.center_id,
      p_division_id:values.division_id,
      p_position_id:values.position_id,
      p_grade_id:values.grade_id||null,
      p_change_type:detectChangeType(values),
      p_memo:values.memo
    };
    try {
      let result;
      if(correction){
        const h=await sb.from('employee_job_title_history').select('*').eq('employee_id',currentEmployee.id).order('id');
        if(h.error)throw h.error;
        const reason=prompt('変更理由を入力してください：役職定年／登録漏れ／登録訂正／その他','役職定年');
        if(!['役職定年','登録漏れ','登録訂正','その他'].includes(reason))throw Error('訂正を中止しました');
        if(!values.memo?.trim())throw Error('訂正理由の詳細をメモに入力してください');
        const affected=(h.data||[]).filter(x=>!x.effective_to||x.effective_to>=values.effective_from);
        const lines=affected.map(x=>x.effective_from+' ～ '+(x.effective_to||'現在')+'：'+(masterOptions.job_titles.find(t=>String(t.id)===String(x.job_title_id))?.title_name||x.job_title_id));
        if(!confirm('以下の役職履歴が訂正対象です。指定日以降の履歴は置き換えられます。正式発令原本は変更しません。\n'+lines.join('\n')+'\n実行しますか？'))throw Error('訂正を中止しました');
        result=await sb.rpc('correct_employee_job_titles_v2',{
          p_employee_id:currentEmployee.id,p_effective_from:values.effective_from,p_job_title_ids:values.job_title_ids||[],p_primary_job_title_id:values.primary_job_title_id||null,p_reason:reason,p_memo:values.memo,p_expected_history:h.data||[]
        });
      }else result=await sb.rpc('change_employee_hr_atomic_v2',{
        ...payload,
        p_job_title_ids:values.job_title_ids||[],
        p_primary_job_title_id:values.primary_job_title_id||null,
        p_assignment_changed:diffs.some(x=>!['役職','雇用区分'].includes(x.label)),
        p_employment_type:values.employment_type||null,
        p_employment_changed:employmentChanged,
        p_title_changed:diffs.some(x=>x.label==='役職'),
        p_details:{changes:diffs,center_id:values.center_id,division_id:values.division_id,position_id:values.position_id,grade_id:values.grade_id||null,job_title_ids:values.job_title_ids||[],primary_job_title_id:values.primary_job_title_id||null,memo:values.memo}
      });
      if(result.error)throw result.error;
      if(result.data?.success!==true)throw Error('登録結果を確認できません');
    } catch(error) {
      const msg=String(error.message||error);
      APP.toast('人事変更を登録できませんでした：'+(/effective_from.*later/.test(msg)?'発令日と既存履歴の開始日が整合しません。履歴を確認してください。':msg),'error');
      btn.disabled=false;btn.textContent='変更を登録';return;
    }
    APP.toast('人事変更を登録しました');
    closeModal();
    setTimeout(()=>location.reload(),450);
  }

  async function setupChangeUI(employee) {
    currentEmployee=employee;
    renderEmployeeStateAndActions(employee);
    document.getElementById('btn-open-assignment-change')?.addEventListener('click',openModal);
    document.getElementById('btn-close-assignment-change')?.addEventListener('click',closeModal);
    document.getElementById('btn-cancel-assignment-change')?.addEventListener('click',closeModal);
    document.getElementById('assignment-change-modal')?.addEventListener('click',e=>{
      if(e.target.id==='assignment-change-modal') closeModal();
    });
    document.getElementById('assignment-change-form')?.addEventListener('submit',submitChange);
    ['assignment-center','assignment-division','assignment-position','assignment-grade'].forEach(id=>
      document.getElementById(id)?.addEventListener('change',renderPreview)
    );
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape') closeModal();
    });
  }


  function isRetired(employee) {
    return employee?.is_active === false || employee?.status === 'retired' || !!employee?.retirement_date;
  }

  function renderEmployeeStateAndActions(employee) {
    const holder=document.getElementById('emp-retirement-status');
    const actions=document.getElementById('employee-action-group');
    if(isRetired(employee)){
      const date=APP.fmtDate(employee.retirement_date);
      if(holder) holder.innerHTML=`<span class="retirement-badge">退職済</span><span class="retirement-date">退職日：${esc(date||'—')}</span>`;
      if(actions) actions.replaceChildren();
      return;
    }
    if(holder) holder.replaceChildren();
    if(actions){
      actions.innerHTML='<button type="button" class="btn btn-secondary btn-sm" id="btn-open-assignment-change">異動・人事情報を変更</button><button type="button" class="btn btn-danger-subtle btn-sm" id="btn-open-retirement">退職処理</button>';
    }
  }

  function closeRetirementModal(){
    document.getElementById('retirement-modal')?.classList.add('hidden');
  }

  function openRetirementModal(){
    if(!currentEmployee) return;
    if(isRetired(currentEmployee)){
      APP.toast('この社員は既に退職処理されています','warning');
      return;
    }
    document.getElementById('retirement-person-name').textContent=currentEmployee.name||'—';
    document.getElementById('retirement-person-code').textContent=`社員コード ${currentEmployee.employee_code||'—'}`;
    const dateEl=document.getElementById('retirement-date');
    const today=todayJst();
    dateEl.max=today;
    if(currentEmployee.join_date) dateEl.min=currentEmployee.join_date;
    dateEl.value=today;
    document.getElementById('retirement-modal').classList.remove('hidden');
    dateEl.focus();
  }

  async function submitRetirement(ev){
    ev.preventDefault();
    if(!currentEmployee || isRetired(currentEmployee)) return;
    const date=document.getElementById('retirement-date')?.value||'';
    if(!date){APP.toast('退職日を入力してください','warning');return;}
    if(currentEmployee.join_date && date < currentEmployee.join_date){
      APP.toast('退職日を入社日より前には設定できません','warning');return;
    }
    if(date > todayJst()){
      APP.toast('未来日の退職処理は現在未対応です','warning');return;
    }
    const ok=confirm(`${currentEmployee.name||'対象社員'}さんを退職として登録します。\n\n退職日：${date}\n\n社員情報・資格・人事履歴は削除されません。\n\n登録しますか？`);
    if(!ok) return;
    const btn=document.getElementById('btn-submit-retirement');
    btn.disabled=true;btn.textContent='登録中…';
    const sb=APP.client();
    const r=await sb.rpc('retire_employee',{p_employee_id:currentEmployee.id,p_retirement_date:date});
    if(r.error){
      console.error('retire_employee failed',r.error);
      APP.toast(`退職処理に失敗しました：${r.error.message}`,'error');
      btn.disabled=false;btn.textContent='退職を登録';
      return;
    }
    APP.toast('退職処理を登録しました');
    closeRetirementModal();
    setTimeout(()=>location.reload(),450);
  }

  async function setupRetirementUI(employee){
    currentEmployee=employee;
    document.getElementById('btn-open-retirement')?.addEventListener('click',openRetirementModal);
    document.getElementById('btn-close-retirement')?.addEventListener('click',closeRetirementModal);
    document.getElementById('btn-cancel-retirement')?.addEventListener('click',closeRetirementModal);
    document.getElementById('retirement-modal')?.addEventListener('click',e=>{
      if(e.target.id==='retirement-modal') closeRetirementModal();
    });
    document.getElementById('retirement-form')?.addEventListener('submit',submitRetirement);
  }

  return {load,render,mount,mountJobTitles,setupChangeUI,setupRetirementUI};
})();

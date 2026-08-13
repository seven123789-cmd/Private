/* Phase16-E: 社員所属・役職・等級履歴 Repository / UI
   - 履歴表示
   - 異動・役職・等級変更UI
   - Phase16-E DB RPCへ接続
*/
window.EmployeeAssignmentHistory = (() => {
  const typeLabel = {
    initial:'初期登録', hire:'入社', transfer:'異動', position_change:'役職変更',
    grade_change:'等級変更', correction:'訂正', other:'その他'
  };
  let currentEmployee = null;
  let currentHistory = null;
  let masterOptions = {centers:[],divisions:[],positions:[],grades:[]};

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
      target.innerHTML='<div class="empty">所属・役職・等級の履歴はありません</div>';
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
            <div><span>役職・職種</span><strong>${esc(r.position_name||'—')}</strong></div>
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
      grades:Array.isArray(data.grades)?data.grades:[]
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
      memo:document.getElementById('assignment-memo')?.value?.trim()||null
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
    push('役職・職種',currentHistory.position_name,optionLabel('assignment-position'),currentHistory.position_id,values.position_id);
    const newGrade=values.grade_id?optionLabel('assignment-grade'):'未設定';
    push('等級',currentHistory.grade_name||'未設定',newGrade,currentHistory.grade_id,values.grade_id);
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

    document.getElementById('assignment-center').value=strId(currentHistory.center_id);
    document.getElementById('assignment-division').value=strId(currentHistory.division_id);
    document.getElementById('assignment-position').value=strId(currentHistory.position_id);
    document.getElementById('assignment-grade').value=strId(currentHistory.grade_id);

    const minDate=addDays(currentHistory.effective_from,1);
    const today=todayJst();
    const dateEl=document.getElementById('assignment-effective-from');
    dateEl.min=minDate;
    dateEl.max=today;
    dateEl.value=today >= minDate ? today : minDate;
    document.getElementById('assignment-date-help').textContent=`登録可能日：${fmt(minDate)} ～ ${fmt(today)}（未来日の予約異動は未対応）`;
    document.getElementById('assignment-memo').value='';
    renderPreview();
    document.getElementById('assignment-change-modal').classList.remove('hidden');
    dateEl.focus();
  }

  async function submitChange(ev) {
    ev.preventDefault();
    const values=collectForm();
    if(!values.effective_from || !values.center_id || !values.division_id || !values.position_id){
      APP.toast('適用日・センター・部門・役職/職種は必須です','warning');
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
    const r=await sb.rpc('change_employee_assignment_v2',payload);
    if(r.error){
      console.error('assignment change failed',r.error);
      APP.toast(`人事変更を登録できませんでした：${r.error.message}`,'error');
      btn.disabled=false; btn.textContent='変更を登録';
      return;
    }
    APP.toast('人事変更を登録しました');
    closeModal();
    setTimeout(()=>location.reload(),450);
  }

  async function setupChangeUI(employee) {
    currentEmployee=employee;
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

  function renderRetirementState(employee) {
    const holder=document.getElementById('emp-retirement-status');
    const changeBtn=document.getElementById('btn-open-assignment-change');
    const retireBtn=document.getElementById('btn-open-retirement');
    if(isRetired(employee)){
      const date=APP.fmtDate(employee.retirement_date);
      if(holder) holder.innerHTML=`<span class="retirement-badge">退職済</span><span class="retirement-date">退職日：${esc(date||'—')}</span>`;
      // 退職済社員は在職中の人事操作を行えないため、操作ボタン自体を表示しない。
      // 履歴・社員情報・資格情報は参照用としてそのまま保持する。
      if(changeBtn){changeBtn.hidden=true;changeBtn.disabled=true;changeBtn.title='';}
      if(retireBtn) retireBtn.hidden=true;
    }else{
      if(holder) holder.innerHTML='';
      if(changeBtn){changeBtn.hidden=false;changeBtn.disabled=false;changeBtn.title='';}
      if(retireBtn) retireBtn.hidden=false;
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
    renderRetirementState(employee);
    document.getElementById('btn-open-retirement')?.addEventListener('click',openRetirementModal);
    document.getElementById('btn-close-retirement')?.addEventListener('click',closeRetirementModal);
    document.getElementById('btn-cancel-retirement')?.addEventListener('click',closeRetirementModal);
    document.getElementById('retirement-modal')?.addEventListener('click',e=>{
      if(e.target.id==='retirement-modal') closeRetirementModal();
    });
    document.getElementById('retirement-form')?.addEventListener('submit',submitRetirement);
  }

  return {load,render,mount,setupChangeUI,setupRetirementUI};
})();

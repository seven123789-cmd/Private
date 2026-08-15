/* Phase22: 正式人事履歴
   - 正式履歴 employee_hr_history_official のみ表示
   - 監査原本 employee_hr_events は画面表示に使用しない
   - 所属 / 担当 / 等級 / 役職 / 兼務を独立表示
   - 変更していない項目は表示しない
   - 訂正・取消は元履歴を残す
*/
window.EmployeeHrTimeline=(()=>{
  let employee=null, rows=[];
  const esc=v=>APP.escape(v??'');
  const txt=v=>String(v??'').replace(/\s+/g,' ').trim();
  const uniq=a=>[...new Set((a||[]).map(txt).filter(Boolean))];
  const val=id=>document.getElementById(id)?.value?.trim()||'';
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v||''};
  const modal=()=>document.getElementById('hr-event-modal');
  const gradeName=g=>g==='3級'?'3級（副主任）':g==='4級'?'4級（主任）':g||'';
  const arrText=a=>uniq(a).join(' 兼 ');
  const same=(a,b)=>txt(a)===txt(b);
  const sameArr=(a,b)=>arrText(a)===arrText(b);
  const displayDate=r=>r.effective_date?APP.fmtDate(r.effective_date):(txt(r.effective_label)||'日付未設定');

  function diffs(r){
    const out=[];
    if(!same(r.from_affiliation,r.to_affiliation) && (txt(r.from_affiliation)||txt(r.to_affiliation)))
      out.push({label:'所属',before:txt(r.from_affiliation),after:txt(r.to_affiliation)});
    if(!same(r.from_assignment,r.to_assignment) && (txt(r.from_assignment)||txt(r.to_assignment)))
      out.push({label:'担当',before:txt(r.from_assignment),after:txt(r.to_assignment)});
    if(!same(r.from_grade,r.to_grade) && (txt(r.from_grade)||txt(r.to_grade)))
      out.push({label:'等級',before:gradeName(txt(r.from_grade)),after:gradeName(txt(r.to_grade))});
    if(!sameArr(r.from_job_titles,r.to_job_titles) && (uniq(r.from_job_titles).length||uniq(r.to_job_titles).length))
      out.push({label:'役職',before:arrText(r.from_job_titles),after:arrText(r.to_job_titles)});
    if(!sameArr(r.from_concurrent,r.to_concurrent) && (uniq(r.from_concurrent).length||uniq(r.to_concurrent).length))
      out.push({label:'兼務',before:arrText(r.from_concurrent),after:arrText(r.to_concurrent)});
    return out;
  }

  async function load(id){
    return APP.client().rpc('get_employee_hr_history_official_v1',{p_employee_id:id});
  }

  function changeHtml(d){
    if(d.before && d.after) return `${esc(d.before)} <span class="hr-arrow">→</span> ${esc(d.after)}`;
    if(d.after) return `${esc(d.after)}`;
    return `${esc(d.before)} <span class="hr-arrow">→</span> 解除`;
  }

  function render(){
    const box=document.getElementById('emp-hr-timeline'); if(!box)return;
    if(!rows.length){box.innerHTML='<div class="empty">正式な人事履歴はまだ登録されていません</div>';return;}
    box.innerHTML=`<div class="hr-timeline">${rows.map(r=>{
      const ds=diffs(r);
      return `<article class="hr-event">
        <div class="hr-event__rail"><span></span></div>
        <div class="hr-event__body">
          <div class="hr-event__top">
            <div class="hr-event__date">${esc(displayDate(r))}</div>
            <div class="hr-event__badges">${APP.badge(r.event_type||'人事変更','secondary')}</div>
          </div>
          <div class="hr-event__diffs">
            ${ds.map(d=>`<div class="hr-event__diff"><div class="hr-event__diff-label">${esc(d.label)}</div><div class="hr-event__diff-value">${changeHtml(d)}</div></div>`).join('')}
          </div>
          ${r.note?`<div class="hr-event__sub">${esc(r.note)}</div>`:''}
          <div class="hr-event__actions">
            <button class="btn btn-secondary btn-sm" data-hr-correct="${esc(r.id)}">訂正</button>
            <button class="btn btn-danger-subtle btn-sm" data-hr-cancel="${esc(r.id)}">取消</button>
          </div>
        </div>
      </article>`;
    }).join('')}</div>`;
    box.querySelectorAll('[data-hr-correct]').forEach(b=>b.onclick=()=>openCorrect(b.dataset.hrCorrect));
    box.querySelectorAll('[data-hr-cancel]').forEach(b=>b.onclick=()=>cancelEvent(b.dataset.hrCancel));
  }

  function splitList(v){return uniq(txt(v).split(/\s*兼\s*|[,、]/));}
  function resetForm(){
    ['hr-event-id','hr-event-date','hr-event-label','hr-before-affiliation','hr-after-affiliation',
     'hr-before-assignment','hr-after-assignment','hr-before-grade','hr-after-grade',
     'hr-before-roles','hr-after-roles','hr-before-concurrent','hr-after-concurrent',
     'hr-event-details','hr-event-reason'].forEach(x=>set(x,''));
    document.getElementById('hr-event-reason-group').hidden=true;
  }
  function openAdd(){
    resetForm();
    document.getElementById('hr-event-modal-title').textContent='人事履歴を追加';
    set('hr-event-date',new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date()));
    set('hr-event-type','人事異動');
    modal().classList.remove('hidden');
  }
  function openCorrect(id){
    const r=rows.find(x=>x.id===id); if(!r)return;
    resetForm();
    document.getElementById('hr-event-modal-title').textContent='人事履歴を訂正';
    set('hr-event-id',id); set('hr-event-date',r.effective_date); set('hr-event-label',r.effective_label);
    set('hr-event-type',r.event_type);
    set('hr-before-affiliation',r.from_affiliation); set('hr-after-affiliation',r.to_affiliation);
    set('hr-before-assignment',r.from_assignment); set('hr-after-assignment',r.to_assignment);
    set('hr-before-grade',r.from_grade); set('hr-after-grade',r.to_grade);
    set('hr-before-roles',arrText(r.from_job_titles)); set('hr-after-roles',arrText(r.to_job_titles));
    set('hr-before-concurrent',arrText(r.from_concurrent)); set('hr-after-concurrent',arrText(r.to_concurrent));
    set('hr-event-details',r.note);
    document.getElementById('hr-event-reason-group').hidden=false;
    modal().classList.remove('hidden');
  }
  async function cancelEvent(id){
    const reason=prompt('取消理由を入力してください。'); if(!reason)return;
    const r=await APP.client().rpc('cancel_employee_hr_history_official_v1',{p_id:id,p_reason:reason});
    if(r.error){APP.toast(r.error.message,'error');return;}
    await refresh();
    APP.toast('人事履歴を取消しました','success');
  }
  function payload(){
    return {
      p_effective_date:val('hr-event-date')||null,
      p_effective_label:val('hr-event-label')||null,
      p_event_type:val('hr-event-type'),
      p_from_affiliation:val('hr-before-affiliation')||null,
      p_to_affiliation:val('hr-after-affiliation')||null,
      p_from_grade:val('hr-before-grade')||null,
      p_to_grade:val('hr-after-grade')||null,
      p_from_job_titles:splitList(val('hr-before-roles')),
      p_to_job_titles:splitList(val('hr-after-roles')),
      p_from_assignment:val('hr-before-assignment')||null,
      p_to_assignment:val('hr-after-assignment')||null,
      p_from_concurrent:splitList(val('hr-before-concurrent')),
      p_to_concurrent:splitList(val('hr-after-concurrent')),
      p_note:val('hr-event-details')||null
    };
  }
  async function submit(ev){
    ev.preventDefault();
    const id=val('hr-event-id'), p=payload(), reason=val('hr-event-reason');
    if(!p.p_effective_date && !p.p_effective_label){APP.toast('発令日、または年度表記を入力してください','warning');return;}
    if(!p.p_event_type){APP.toast('種別を選択してください','warning');return;}
    const hasChange=[
      p.p_from_affiliation,p.p_to_affiliation,p.p_from_grade,p.p_to_grade,
      p.p_from_assignment,p.p_to_assignment,...p.p_from_job_titles,...p.p_to_job_titles,
      ...p.p_from_concurrent,...p.p_to_concurrent
    ].some(Boolean);
    if(!hasChange){APP.toast('変更内容を入力してください','warning');return;}
    const sb=APP.client(); let r;
    if(id){
      if(!reason){APP.toast('訂正理由は必須です','warning');return;}
      r=await sb.rpc('correct_employee_hr_history_official_v1',{p_id:id,...p,p_reason:reason});
    }else{
      r=await sb.rpc('add_employee_hr_history_official_v1',{p_employee_id:employee.id,...p});
    }
    if(r.error){APP.toast(r.error.message,'error');return;}
    modal().classList.add('hidden');
    await refresh();
    APP.toast(id?'人事履歴を訂正しました':'人事履歴を追加しました','success');
  }
  async function refresh(){
    const r=await load(employee.id);
    if(r.error){console.error(r.error);document.getElementById('emp-hr-timeline').innerHTML='<div class="empty">正式人事履歴を読み込めませんでした</div>';return;}
    rows=r.data||[]; render();
  }
  async function mount(e){employee=e;await refresh();document.getElementById('btn-add-hr-event')?.addEventListener('click',openAdd);}
  function setup(){
    document.getElementById('hr-event-form')?.addEventListener('submit',submit);
    document.getElementById('btn-close-hr-event')?.addEventListener('click',()=>modal().classList.add('hidden'));
    document.getElementById('btn-cancel-hr-event')?.addEventListener('click',()=>modal().classList.add('hidden'));
  }
  return {mount,setup};
})();
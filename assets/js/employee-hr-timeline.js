/* Phase20 UI refinement: readable HR timeline + structured manual entry */
window.EmployeeHrTimeline=(()=>{
  let employee=null, rows=[];
  const esc=v=>APP.escape(v??'');
  const clean=v=>String(v??'').replace(/家電物流事業部/g,'').replace(/業務職員/g,'職員').replace(/管理職員/g,'').replace(/\s+/g,' ').trim();
  const gradeLabel=v=>String(v||'').replace(/(^|\s|\/)(3級)(?=\s|\/|$)/g,'$1$2（副主任）').replace(/(^|\s|\/)(4級)(?=\s|\/|$)/g,'$1$2（主任）');
  const westernLabel=v=>{
    const s=String(v||'').trim();
    let m=s.match(/^平成(\d+)年度/); if(m)return `${1988+Number(m[1])}年度`;
    m=s.match(/^平成(\d+)年/); if(m)return s.replace(/^平成\d+年/,`${1988+Number(m[1])}年`);
    m=s.match(/^令和(\d+)年度/); if(m)return `${2018+Number(m[1])}年度`;
    m=s.match(/^令和(\d+)年/); if(m)return s.replace(/^令和\d+年/,`${2018+Number(m[1])}年`);
    return s;
  };
  const displayDate=r=>r.effective_date?APP.fmtDate(r.effective_date):westernLabel(r.effective_date_label);
  const typeLabel=t=>{
    const s=String(t||'');
    if(/正社員登用/.test(s)) return '正社員登用';
    if(/資格昇格|級昇格|暫定解除/.test(s)) return '資格昇格';
    if(/役職|兼務|担当/.test(s)) return '役職変更';
    if(/異動|transfer/.test(s)) return '人事異動';
    if(/職種|position_change/.test(s)) return '職種変更';
    if(/grade_change/.test(s)) return '資格昇格';
    return '人事変更';
  };
  const centers=v=>{
    const known=['北埼玉センター','南埼玉センター','東松山センター','戸田センター','練馬センター','船橋センター','東北センター','福島センター','群馬センター','静岡センター','三河センター','さいたまセンター'];
    return known.filter(x=>String(v||'').includes(x));
  };
  const roleText=v=>gradeLabel(clean(v).replace(/\b([1-6])\b/g,'$1級').replace(/（暫定）/g,'（暫定）'));
  const eventView=r=>{
    const d=r.details||{}, before=clean(d.before), after=clean(d.after), br=roleText(d.before_role), ar=roleText(d.after_role);
    const bc=centers(before), ac=centers(after), centerChanged=bc.join('|')!==ac.join('|') && (bc.length||ac.length);
    let primary='', secondary='';
    if(typeLabel(r.event_type)==='資格昇格') primary=[br,ar].filter(Boolean).length===2?`${br} → ${ar}`:(ar||gradeLabel(after)||d.memo||'資格昇格');
    else if(typeLabel(r.event_type)==='役職変更') primary=[br,ar].filter(Boolean).length===2?`${br} → ${ar}`:(ar||d.memo||'役職変更');
    else if(typeLabel(r.event_type)==='人事異動') primary=centerChanged?`${bc.join('・')||before||'—'} → ${ac.join('・')||after||'—'}`:`${before||'—'} → ${after||'—'}`;
    else primary=d.memo||([before,after].filter(Boolean).join(' → '))||ar||gradeLabel(after)||'人事変更';
    if(typeLabel(r.event_type)!=='人事異動' && centerChanged) secondary=`センター異動：${bc.join('・')||'—'} → ${ac.join('・')||'—'}`;
    else if(centerChanged) secondary='所属変更あり';
    else if(before||after) secondary='所属変更なし';
    return {primary,secondary,centerChanged,before,after,br,ar};
  };
  async function load(id){return APP.client().rpc('get_employee_hr_timeline_v1',{p_employee_id:id});}
  function render(){
    const box=document.getElementById('emp-hr-timeline'); if(!box)return;
    if(!rows.length){box.innerHTML='<div class="empty">人事履歴はありません</div>';return;}
    box.innerHTML=`<div class="hr-timeline">${rows.map(r=>{const v=eventView(r);return `<article class="hr-event ${r.status!=='active'?'is-muted':''}">
      <div class="hr-event__rail"><span></span></div><div class="hr-event__body">
      <div class="hr-event__top"><div class="hr-event__date">${esc(displayDate(r))}</div><div class="hr-event__badges">${APP.badge(r.status==='active'?typeLabel(r.event_type):r.status==='corrected'?'訂正済':'取消',r.status==='active'?'secondary':'gray')}${v.centerChanged?APP.badge('所属変更','primary'):''}</div></div>
      <div class="hr-event__change">${esc(v.primary)}</div>
      ${v.secondary?`<div class="hr-event__sub ${v.centerChanged?'has-transfer':''}">${esc(v.secondary)}</div>`:''}
      ${r.correction_reason?`<div class="hr-event__reason">訂正・取消理由：${esc(r.correction_reason)}</div>`:''}
      ${r.status==='active'?`<div class="hr-event__actions"><button class="btn btn-secondary btn-sm" data-hr-correct="${esc(r.id)}">訂正</button><button class="btn btn-danger-subtle btn-sm" data-hr-cancel="${esc(r.id)}">取消</button></div>`:''}
      </div></article>`}).join('')}</div>`;
    box.querySelectorAll('[data-hr-correct]').forEach(b=>b.onclick=()=>openCorrect(b.dataset.hrCorrect));
    box.querySelectorAll('[data-hr-cancel]').forEach(b=>b.onclick=()=>cancelEvent(b.dataset.hrCancel));
  }
  const val=id=>document.getElementById(id)?.value?.trim()||'';
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v||''};
  function resetForm(){['hr-before-center','hr-after-center','hr-before-grade-role','hr-after-grade-role','hr-event-details','hr-event-reason'].forEach(x=>set(x,''));document.getElementById('hr-event-reason-group').hidden=true;}
  function modal(){return document.getElementById('hr-event-modal')}
  function openAdd(){resetForm();document.getElementById('hr-event-modal-title').textContent='人事履歴を追加';set('hr-event-id','');set('hr-event-date',new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date()));set('hr-event-type','人事異動');modal().classList.remove('hidden');}
  function openCorrect(id){const r=rows.find(x=>x.id===id);if(!r)return;resetForm();const d=r.details||{};document.getElementById('hr-event-modal-title').textContent='人事履歴を訂正';set('hr-event-id',id);set('hr-event-date',r.effective_date||'');set('hr-event-type',typeLabel(r.event_type));set('hr-before-center',clean(d.before));set('hr-after-center',clean(d.after));set('hr-before-grade-role',roleText(d.before_role));set('hr-after-grade-role',roleText(d.after_role));set('hr-event-details',d.memo||'');document.getElementById('hr-event-reason-group').hidden=false;modal().classList.remove('hidden');}
  async function cancelEvent(id){const reason=prompt('取消理由を入力してください。');if(!reason)return;const r=await APP.client().rpc('cancel_employee_hr_event_v1',{p_event_id:id,p_reason:reason});if(r.error){APP.toast(r.error.message,'error');return;}location.reload();}
  async function submit(ev){ev.preventDefault();const id=val('hr-event-id'),date=val('hr-event-date'),type=val('hr-event-type'),reason=val('hr-event-reason');const details={before:val('hr-before-center'),after:val('hr-after-center'),before_role:val('hr-before-grade-role'),after_role:val('hr-after-grade-role'),memo:val('hr-event-details')};if(!date||!type){APP.toast('発令日・種別は必須です','warning');return;}if(!Object.values(details).some(Boolean)){APP.toast('変更前または変更後の内容を入力してください','warning');return;}const sb=APP.client();let r;if(id){if(!reason){APP.toast('訂正理由は必須です','warning');return;}r=await sb.rpc('correct_employee_hr_event_v1',{p_event_id:id,p_effective_date:date,p_event_type:type,p_details:details,p_reason:reason});}else{r=await sb.rpc('add_employee_hr_event_v1',{p_employee_id:employee.id,p_effective_date:date,p_event_type:type,p_details:details,p_memo:details.memo});}if(r.error){APP.toast(r.error.message,'error');return;}location.reload();}
  async function mount(e){employee=e;const r=await load(e.id);if(r.error){console.error(r.error);document.getElementById('emp-hr-timeline').innerHTML='<div class="empty">人事履歴を読み込めませんでした</div>';return;}rows=r.data||[];render();document.getElementById('btn-add-hr-event')?.addEventListener('click',openAdd);}
  function setup(){document.getElementById('hr-event-form')?.addEventListener('submit',submit);document.getElementById('btn-close-hr-event')?.addEventListener('click',()=>modal().classList.add('hidden'));document.getElementById('btn-cancel-hr-event')?.addEventListener('click',()=>modal().classList.add('hidden'));}
  return {mount,setup};
})();

/* Phase20: 人事履歴タイムライン
   - 復元済み確定イベントと今後の手入力を同じ台帳で表示
   - 3級=副主任、4級=主任は制度上の呼称として表示
   - 5級以上は実際の役職名を details.after_role 等から表示（自動決め打ちしない）
   - 訂正/取消は物理削除せず監査履歴を保持
*/
window.EmployeeHrTimeline=(()=>{
  let employee=null, rows=[];
  const esc=v=>APP.escape(v??'');
  const gradeLabel=text=>String(text||'').replace(/(^|\s|\/)(3級)(?=\s|\/|$)/g,'$1$2（副主任）').replace(/(^|\s|\/)(4級)(?=\s|\/|$)/g,'$1$2（主任）');
  const typeLabel=t=>({transfer:'異動',position_change:'職種変更',grade_change:'等級変更',other:'人事変更'}[t]||t||'人事変更');
  const eventSummary=r=>{
    const d=r.details||{};
    if(Array.isArray(d.changes)&&d.changes.length) return d.changes.map(x=>`${x.label}: ${x.oldVal} → ${x.newVal}`).join(' / ');
    const bits=[];
    if(d.after) bits.push(gradeLabel(d.after));
    if(d.after_role) bits.push(d.after_role);
    if(!bits.length&&d.memo) bits.push(d.memo);
    return bits.join(' / ')||'詳細記録あり';
  };
  async function load(id){const sb=APP.client();return sb.rpc('get_employee_hr_timeline_v1',{p_employee_id:id});}
  function render(){
    const box=document.getElementById('emp-hr-timeline'); if(!box)return;
    if(!rows.length){box.innerHTML='<div class="empty">人事履歴はありません</div>';return;}
    box.innerHTML=`<div class="assignment-history">${rows.map(r=>`<article class="assignment-history__item ${r.status!=='active'?'is-muted':''}">
      <div class="assignment-history__rail"><span></span></div><div class="assignment-history__content">
      <div class="assignment-history__head"><div><strong>${esc(r.effective_date?APP.fmtDate(r.effective_date):r.effective_date_label)}</strong></div>
      ${APP.badge(r.status==='active'?typeLabel(r.event_type):r.status==='corrected'?'訂正済':'取消','secondary')}</div>
      <div class="assignment-history__grid"><div><span>内容</span><strong>${esc(eventSummary(r))}</strong></div><div><span>種別</span><strong>${esc(typeLabel(r.event_type))}</strong></div></div>
      ${r.source_name?`<div class="assignment-history__memo">根拠：${esc(r.source_name)}</div>`:''}
      ${r.correction_reason?`<div class="assignment-history__memo">理由：${esc(r.correction_reason)}</div>`:''}
      ${r.status==='active'?`<div class="row-actions"><button class="btn btn-secondary btn-sm" data-hr-correct="${esc(r.id)}">訂正</button><button class="btn btn-danger-subtle btn-sm" data-hr-cancel="${esc(r.id)}">取消</button></div>`:''}
      </div></article>`).join('')}</div>`;
    box.querySelectorAll('[data-hr-correct]').forEach(b=>b.onclick=()=>openCorrect(b.dataset.hrCorrect));
    box.querySelectorAll('[data-hr-cancel]').forEach(b=>b.onclick=()=>cancelEvent(b.dataset.hrCancel));
  }
  async function mount(e){employee=e; const r=await load(e.id); if(r.error){console.error(r.error);document.getElementById('emp-hr-timeline').innerHTML='<div class="empty">人事履歴を読み込めませんでした</div>';return;} rows=r.data||[];render(); document.getElementById('btn-add-hr-event')?.addEventListener('click',openAdd);}
  function modal(){return document.getElementById('hr-event-modal')}
  function openAdd(){document.getElementById('hr-event-modal-title').textContent='人事履歴を追加';document.getElementById('hr-event-id').value='';document.getElementById('hr-event-date').value=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());document.getElementById('hr-event-type').value='人事異動';document.getElementById('hr-event-details').value='';document.getElementById('hr-event-reason').value='';document.getElementById('hr-event-reason-group').hidden=true;modal().classList.remove('hidden');}
  function openCorrect(id){const r=rows.find(x=>x.id===id);if(!r)return;document.getElementById('hr-event-modal-title').textContent='人事履歴を訂正';document.getElementById('hr-event-id').value=id;document.getElementById('hr-event-date').value=r.effective_date||'';document.getElementById('hr-event-type').value=r.event_type||'人事異動';document.getElementById('hr-event-details').value=eventSummary(r);document.getElementById('hr-event-reason').value='';document.getElementById('hr-event-reason-group').hidden=false;modal().classList.remove('hidden');}
  async function cancelEvent(id){const reason=prompt('取消理由を入力してください。');if(!reason)return;const r=await APP.client().rpc('cancel_employee_hr_event_v1',{p_event_id:id,p_reason:reason});if(r.error){APP.toast(r.error.message,'error');return;}location.reload();}
  async function submit(ev){ev.preventDefault();const id=document.getElementById('hr-event-id').value,date=document.getElementById('hr-event-date').value,type=document.getElementById('hr-event-type').value.trim(),text=document.getElementById('hr-event-details').value.trim(),reason=document.getElementById('hr-event-reason').value.trim();if(!date||!type||!text){APP.toast('発令日・種別・内容は必須です','warning');return;}const sb=APP.client();let r;if(id){if(!reason){APP.toast('訂正理由は必須です','warning');return;}r=await sb.rpc('correct_employee_hr_event_v1',{p_event_id:id,p_effective_date:date,p_event_type:type,p_details:{memo:text},p_reason:reason});}else{r=await sb.rpc('add_employee_hr_event_v1',{p_employee_id:employee.id,p_effective_date:date,p_event_type:type,p_details:{memo:text},p_memo:text});}if(r.error){APP.toast(r.error.message,'error');return;}location.reload();}
  function setup(){document.getElementById('hr-event-form')?.addEventListener('submit',submit);document.getElementById('btn-close-hr-event')?.addEventListener('click',()=>modal().classList.add('hidden'));document.getElementById('btn-cancel-hr-event')?.addEventListener('click',()=>modal().classList.add('hidden'));}
  return {mount,setup};
})();

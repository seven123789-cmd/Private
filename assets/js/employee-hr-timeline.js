/* Phase21: 人事履歴タイムライン
   - 同一発令日の複数イベントを1件に統合表示
   - 所属/担当/等級/役職を分離して差分表示
   - 3級=副主任、4級=主任。5級以上は実役職を表示
   - 役職追加も画面上は「役職変更」
   - job_title_history の兼務役職も同一タイムラインに統合
   - 手入力/訂正は構造化 details を保存
*/
window.EmployeeHrTimeline=(()=>{
  let employee=null, rows=[];
  const esc=v=>APP.escape(v??'');
  const txt=v=>String(v??'').replace(/\s+/g,' ').trim();
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const gradeName=g=>g==='3級'?'3級（副主任）':g==='4級'?'4級（主任）':g||'';
  const westernLabel=v=>{
    let s=txt(v),m=s.match(/^平成(\d+)年度/); if(m)return `${1988+Number(m[1])}年度`;
    m=s.match(/^平成(\d+)年/); if(m)return s.replace(/^平成\d+年/,`${1988+Number(m[1])}年`);
    m=s.match(/^令和(\d+)年度/); if(m)return `${2018+Number(m[1])}年度`;
    m=s.match(/^令和(\d+)年/); if(m)return s.replace(/^令和\d+年/,`${2018+Number(m[1])}年`);
    return s;
  };
  const displayDate=r=>r.effective_date?APP.fmtDate(r.effective_date):westernLabel(r.effective_date_label);
  const extractGrade=v=>{const s=txt(v),m=s.match(/(?:^|[^0-9])([1-7])級/);if(m)return `${m[1]}級`;const n=s.match(/(?:^|\s)([1-7])(?:\s|$|（|\()/);return n?`${n[1]}級`:''};
  const roleParts=v=>uniq(txt(v).replace(/\s*[1-7]級.*$/,'').replace(/\s+[1-7](?:\s*\(暫定\)|\s*（暫定）)?$/,'').replace(/（暫定）/g,'（暫定）').split(/\s*兼\s*|[・／/]/).map(x=>x.trim()).filter(x=>/主任|副長|課長|次長|部長|参与|センター長|副センター長|本部長|担当/.test(x)));
  const centerParts=v=>uniq([...txt(v).matchAll(/([一-龯ぁ-んァ-ヶA-Za-z0-9]+センター)/g)].map(m=>m[1]));
  const employeeType=v=>{const s=txt(v);return ['管理職員','業務職員','職員','内務員','外商員'].find(x=>s.includes(x))||''};
  const stripCommon=v=>txt(v)
    .replace(/家電物流事業部/g,'')
    .replace(/管理職員|業務職員|職員|内務員|外商員/g,'')
    .replace(/[1-7]級(?:（暫定）)?/g,'')
    .replace(/課長\s*兼\s*センター長|次長\s*兼\s*センター長|副長\s*兼\s*センター長|課長|次長|副長|主任|副主任|専任部長|部長|参与|センター長|副センター長/g,'')
    .replace(/[（）()]/g,' ').replace(/\s+/g,' ').trim();
  const baseAffiliation=v=>{
    const s=txt(v), cs=centerParts(s);
    if(cs.length) return cs.join(' 兼 ');
    if(s.includes('家電物流事業部')) return '家電物流事業部 本部';
    return '';
  };
  const dutyText=v=>{
    let s=stripCommon(v);
    centerParts(s).forEach(c=>{s=s.replaceAll(c,'')});
    s=s.replace(/^[\s・兼]+|[\s・兼]+$/g,'').trim();
    return s;
  };
  const normalizeRow=r=>{
    const d=r.details||{}, before=txt(d.before), after=txt(d.after);
    const beforeGrade=txt(d.before_grade)||extractGrade(d.before_role)||extractGrade(before);
    const afterGrade=txt(d.after_grade)||extractGrade(d.after_role)||extractGrade(after);
    const beforeRoles=uniq([...(d.before_roles||[]),...roleParts(d.before_role)]);
    const afterRoles=uniq([...(d.after_roles||[]),...roleParts(d.after_role)]);
    const beforeAff=txt(d.before_affiliation)||baseAffiliation(before);
    const afterAff=txt(d.after_affiliation)||baseAffiliation(after);
    const beforeDuty=txt(d.before_assignment)||dutyText(before);
    const afterDuty=txt(d.after_assignment)||dutyText(after);
    const beforeType=txt(d.before_employee_type)||employeeType(before);
    const afterType=txt(d.after_employee_type)||employeeType(after);
    return {...r,_:{before,after,beforeGrade,afterGrade,beforeRoles,afterRoles,beforeAff,afterAff,beforeDuty,afterDuty,beforeType,afterType}};
  };
  const changed=(a,b)=>txt(a)!==txt(b) && (!!txt(a)||!!txt(b));
  const arrChanged=(a,b)=>uniq(a).join('|')!==uniq(b).join('|') && (a.length||b.length);
  const diffFor=r=>{
    const x=r._, items=[];
    if(changed(x.beforeAff,x.afterAff)) items.push({kind:'affiliation',label:'所属',before:x.beforeAff||'—',after:x.afterAff||'—'});
    if(changed(x.beforeDuty,x.afterDuty)) items.push({kind:'assignment',label:'担当・兼務',before:x.beforeDuty||'—',after:x.afterDuty||'—'});
    if(changed(x.beforeType,x.afterType)) items.push({kind:'employeeType',label:'職種区分',before:x.beforeType||'—',after:x.afterType||'—'});
    if(changed(x.beforeGrade,x.afterGrade)) items.push({kind:'grade',label:'等級',before:gradeName(x.beforeGrade)||'—',after:gradeName(x.afterGrade)||'—'});
    if(arrChanged(x.beforeRoles,x.afterRoles)) items.push({kind:'role',label:'役職',before:x.beforeRoles.join(' 兼 ')||'—',after:x.afterRoles.join(' 兼 ')||'—'});
    if(!items.length && r.details?.memo) items.push({kind:'memo',label:'内容',before:'',after:txt(r.details.memo)});
    return items;
  };
  const eventLabels=items=>{
    const kinds=new Set(items.map(x=>x.kind)), out=[];
    if(kinds.has('affiliation')) out.push('人事異動');
    if(kinds.has('assignment')) out.push('担当変更');
    if(kinds.has('employeeType')) out.push('職種変更');
    if(kinds.has('grade')) out.push('資格昇格');
    if(kinds.has('role')) out.push('役職変更');
    if(!out.length) out.push('人事変更');
    return out;
  };
  const groupRows=input=>{
    const map=new Map();
    input.filter(r=>r.status!=='corrected').map(normalizeRow).forEach(r=>{
      const key=`${r.effective_date||''}|${westernLabel(r.effective_date_label)||''}`;
      if(!map.has(key)) map.set(key,{key,date:displayDate(r),effective_date:r.effective_date,label:r.effective_date_label,rows:[],items:[],statuses:[]});
      const g=map.get(key); g.rows.push(r); g.statuses.push(r.status); g.items.push(...diffFor(r));
    });
    return [...map.values()].map(g=>{
      const seen=new Set(); g.items=g.items.filter(x=>{const k=`${x.kind}|${x.before}|${x.after}`;if(seen.has(k))return false;seen.add(k);return true});
      g.labels=eventLabels(g.items);
      return g;
    }).sort((a,b)=>String(b.effective_date||b.label||'').localeCompare(String(a.effective_date||a.label||'')));
  };
  async function load(id){
    const sb=APP.client();
    let r=await sb.rpc('get_employee_hr_timeline_v2',{p_employee_id:id});
    if(r.error) r=await sb.rpc('get_employee_hr_timeline_v1',{p_employee_id:id});
    return r;
  }
  function render(){
    const box=document.getElementById('emp-hr-timeline'); if(!box)return;
    const groups=groupRows(rows);
    if(!groups.length){box.innerHTML='<div class="empty">人事履歴はありません</div>';return;}
    box.innerHTML=`<div class="hr-timeline">${groups.map(g=>`<article class="hr-event ${g.statuses.every(x=>x!=='active')?'is-muted':''}">
      <div class="hr-event__rail"><span></span></div><div class="hr-event__body">
      <div class="hr-event__top"><div class="hr-event__date">${esc(g.date)}</div><div class="hr-event__badges">${g.labels.map(x=>APP.badge(x,x==='人事異動'?'primary':'secondary')).join('')}</div></div>
      <div class="hr-event__diffs">${g.items.map(x=>`<div class="hr-event__diff"><div class="hr-event__diff-label">${esc(x.label)}</div><div class="hr-event__diff-value">${x.before?`${esc(x.before)} <span class="hr-arrow">→</span> `:''}${esc(x.after)}</div></div>`).join('')}</div>
      ${g.items.some(x=>x.kind==='affiliation')?'<div class="hr-event__transfer-note">所属変更あり</div>':'<div class="hr-event__transfer-note is-none">所属変更なし</div>'}
      <div class="hr-event__actions">${g.rows.filter(r=>r.status==='active'&&r.id).map(r=>`<button class="btn btn-secondary btn-sm" data-hr-correct="${esc(r.id)}">訂正</button><button class="btn btn-danger-subtle btn-sm" data-hr-cancel="${esc(r.id)}">取消</button>`).join('')}</div>
      </div></article>`).join('')}</div>`;
    box.querySelectorAll('[data-hr-correct]').forEach(b=>b.onclick=()=>openCorrect(b.dataset.hrCorrect));
    box.querySelectorAll('[data-hr-cancel]').forEach(b=>b.onclick=()=>cancelEvent(b.dataset.hrCancel));
  }
  const val=id=>document.getElementById(id)?.value?.trim()||'';
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v||''};
  const splitRoles=v=>uniq(txt(v).split(/\s*兼\s*|[,、]/).map(x=>x.trim()));
  function resetForm(){['hr-before-affiliation','hr-after-affiliation','hr-before-assignment','hr-after-assignment','hr-before-grade','hr-after-grade','hr-before-roles','hr-after-roles','hr-event-details','hr-event-reason'].forEach(x=>set(x,''));document.getElementById('hr-event-reason-group').hidden=true;}
  function modal(){return document.getElementById('hr-event-modal')}
  function openAdd(){resetForm();document.getElementById('hr-event-modal-title').textContent='人事履歴を追加';set('hr-event-id','');set('hr-event-date',new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date()));set('hr-event-type','人事異動');modal().classList.remove('hidden');}
  function openCorrect(id){const r=rows.find(x=>x.id===id);if(!r)return;resetForm();const n=normalizeRow(r),x=n._;document.getElementById('hr-event-modal-title').textContent='人事履歴を訂正';set('hr-event-id',id);set('hr-event-date',r.effective_date||'');set('hr-event-type',eventLabels(diffFor(n))[0]);set('hr-before-affiliation',x.beforeAff);set('hr-after-affiliation',x.afterAff);set('hr-before-assignment',x.beforeDuty);set('hr-after-assignment',x.afterDuty);set('hr-before-grade',x.beforeGrade);set('hr-after-grade',x.afterGrade);set('hr-before-roles',x.beforeRoles.join(' 兼 '));set('hr-after-roles',x.afterRoles.join(' 兼 '));set('hr-event-details',r.details?.memo||'');document.getElementById('hr-event-reason-group').hidden=false;modal().classList.remove('hidden');}
  async function cancelEvent(id){const reason=prompt('取消理由を入力してください。');if(!reason)return;const r=await APP.client().rpc('cancel_employee_hr_event_v1',{p_event_id:id,p_reason:reason});if(r.error){APP.toast(r.error.message,'error');return;}location.reload();}
  async function submit(ev){ev.preventDefault();const id=val('hr-event-id'),date=val('hr-event-date'),type=val('hr-event-type'),reason=val('hr-event-reason');const details={before_affiliation:val('hr-before-affiliation'),after_affiliation:val('hr-after-affiliation'),before_assignment:val('hr-before-assignment'),after_assignment:val('hr-after-assignment'),before_grade:val('hr-before-grade'),after_grade:val('hr-after-grade'),before_roles:splitRoles(val('hr-before-roles')),after_roles:splitRoles(val('hr-after-roles')),memo:val('hr-event-details')};if(!date||!type){APP.toast('発令日・種別は必須です','warning');return;}if(!Object.values(details).some(v=>Array.isArray(v)?v.length:!!v)){APP.toast('変更内容を入力してください','warning');return;}const sb=APP.client();let r;if(id){if(!reason){APP.toast('訂正理由は必須です','warning');return;}r=await sb.rpc('correct_employee_hr_event_v2',{p_event_id:id,p_effective_date:date,p_event_type:type,p_details:details,p_reason:reason});if(r.error)r=await sb.rpc('correct_employee_hr_event_v1',{p_event_id:id,p_effective_date:date,p_event_type:type,p_details:details,p_reason:reason});}else{r=await sb.rpc('add_employee_hr_event_v2',{p_employee_id:employee.id,p_effective_date:date,p_event_type:type,p_details:details,p_memo:details.memo});if(r.error)r=await sb.rpc('add_employee_hr_event_v1',{p_employee_id:employee.id,p_effective_date:date,p_event_type:type,p_details:details,p_memo:details.memo});}if(r.error){APP.toast(r.error.message,'error');return;}location.reload();}
  async function mount(e){employee=e;const r=await load(e.id);if(r.error){console.error(r.error);document.getElementById('emp-hr-timeline').innerHTML='<div class="empty">人事履歴を読み込めませんでした</div>';return;}rows=r.data||[];render();document.getElementById('btn-add-hr-event')?.addEventListener('click',openAdd);}
  function setup(){document.getElementById('hr-event-form')?.addEventListener('submit',submit);document.getElementById('btn-close-hr-event')?.addEventListener('click',()=>modal().classList.add('hidden'));document.getElementById('btn-cancel-hr-event')?.addEventListener('click',()=>modal().classList.add('hidden'));}
  return {mount,setup};
})();

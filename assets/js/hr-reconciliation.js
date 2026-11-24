/* Pure reconciliation logic. No writes, no embedded employee data. */
(function(root){
'use strict';
const code=v=>String(v??'').normalize('NFKC').trim().replace(/^0+(?=\d+$)/,'');
const date=v=>String(v??'').slice(0,10);
const norm=v=>String(v??'').normalize('NFKC').replace(/\s/g,'');
function reconcile({month,employees,attendance,assignments=[],fields={},historyComplete=false}){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('対象月が不正です');
 const start=month+'-01', [y,m]=month.split('-').map(Number), end=month+'-'+new Date(Date.UTC(y,m,0)).getUTCDate();
 const issues=[], unknown=[];
 const add=(type,c,e,a,detail)=>issues.push({type,code:c,employeeId:e?.id??null,detail});
 const group=(rows,key)=>{const map=new Map();for(const r of rows){const c=key(r);if(!map.has(c))map.set(c,[]);map.get(c).push(r);}return map;};
 const em=group(employees,e=>code(e.employee_code));
 const am=group(attendance.filter(a=>String(a.month??'').slice(0,7)===month),a=>code(a.personnel_code));
 const hm=group(assignments,h=>String(h.employee_id));
 for(const c of new Set([...em.keys(),...am.keys()])){
  const es=em.get(c)||[], as=am.get(c)||[];
  if(!c){add('missing_code',c,null,null,'社員コード未設定');continue;}
  if(es.length>1){add('duplicate_master',c,null,null,'人事マスタの社員コード重複');continue;}
  if(as.length>1){add('multiple_attendance',c,es[0],null,'同月に複数勤怠行。分割計上の可能性を確認');}
  const e=es[0];
  if(!e){add('missing_master',c,null,as[0],'人事マスタ未登録');continue;}
  const joined=date(e.join_date), retired=date(e.retirement_date);
  if((joined&&joined>end)||(retired&&retired<start)){
   if(as.length)add('outside_employment',c,e,as[0],'在籍期間外の勤怠掲載');continue;
  }
  if(!as.length){
   if(joined&&(e.is_active!==false||retired))add('missing_attendance',c,e,null,'在籍期間と重なる月に勤怠掲載なし');
   else unknown.push({code:c,reason:'在籍期間未確定'});
   continue;
  }
  const hs=(hm.get(String(e.id))||[]).filter(h=>date(h.effective_from)<=end&&(!h.effective_to||date(h.effective_to)>=start));
  for(const [kind,field,historyField] of [['center',fields.center,'center_id'],['occupation',fields.occupation,'position_id']]){
   if(!field||!historyComplete||!hs.length){unknown.push({code:c,reason:kind+'の照合条件未確定'});continue;}
   const allowed=new Set(hs.map(h=>norm(h[historyField])).filter(Boolean));
   for(const a of as){const actual=norm(a[field]);if(!actual||!allowed.size){unknown.push({code:c,reason:kind+'未取得'});continue;}if(!allowed.has(actual))add(kind+'_mismatch',c,e,a,'対象月の人事履歴と不一致');}
  }
  if(fields.employment)unknown.push({code:c,reason:'雇用区分の時点履歴未整備'});
 }
 return {month,issues,unknown,counts:issues.reduce((o,i)=>(o[i.type]=(o[i.type]||0)+1,o),{})};
}
root.HrReconciliation={reconcile};
})(typeof globalThis==='object'?globalThis:this);

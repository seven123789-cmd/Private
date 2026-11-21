/* Monthly management: no embedded personnel data. Authenticated Supabase reads only. */
const MonthlyManagement=(()=>{
const $=id=>document.getElementById(id), esc=v=>APP.escape(v??''), norm=v=>String(v??'').normalize('NFKC').replace(/[\s　]/g,'').toLowerCase();
let employees=[],attendance=[],selectedCenter='',chosenCode='',dataError='';
const num=v=>v===null||v===undefined||v===''?null:Number(v);
const code=v=>{const s=String(v??'').trim();return /^\d+$/.test(s)?s.replace(/^0+(?=\d)/,''):s};
const job=v=>{const s=norm(v);if(/外商/.test(s))return '外商員';if(/内務/.test(s))return '内務員';if(/職員|管理|正管|s管|副長|次長|課長|部長/.test(s))return '職員';return 'その他'};
const grade=v=>{const m=String(v??'').match(/(\d+)\s*級/);return m?Number(m[1]):Number(String(v??'').match(/^\d+$/)?.[0]||0)};
const monthKey=v=>String(v??'').slice(0,7);
const minutes=v=>v===null||v===undefined?'未取得':(v<0?'-':'')+Math.floor(Math.abs(v)/60)+':'+String(Math.abs(v)%60).padStart(2,'0');
const ymd=(y,m)=>y+'-'+String(m).padStart(2,'0');
function years(m){const [y,mm]=m.split('-').map(Number);return {leaveStart:ymd(mm>=4?y:y-1,4),overtimeStart:ymd(mm>=5?y:y-1,5)}}
async function allRows(table,fields){const sb=APP.client();if(!sb)throw Error('Supabase接続がありません');let out=[];for(let from=0;from<10000;from+=500){const {data,error}=await sb.from(table).select(fields).range(from,from+499);if(error)throw Error(table+': '+error.message);out.push(...(data||[]));if((data||[]).length<500)break;}return out}
function grouped(){const m=$('m-month').value;const {leaveStart,overtimeStart}=years(m);const map=new Map();for(const r of attendance){const c=code(r.personnel_code),key=monthKey(r.month);if(!map.has(c))map.set(c,[]);map.get(c).push({...r,key});}
const emp=new Map(employees.filter(e=>e.employee_code).map(e=>[code(e.employee_code),e]));
const codes=new Set([...map.keys(),...emp.keys()]);return [...codes].map(c=>{const a=(map.get(c)||[]).sort((x,y)=>x.key.localeCompare(y.key)),latest=a.filter(r=>r.key<=m).at(-1),current=a.find(r=>r.key===m),e=emp.get(c)||{},j=job(e.position||current?.occupation_code||latest?.occupation_code||current?.employment_category),hours=num(current?.monthly_overtime_minutes),limit=j==='外商員'?60*60:j==='職員'||j==='内務員'?42*60:null;
const used=a.filter(r=>r.key>=overtimeStart&&r.key<=m&&num(r.monthly_overtime_minutes)!==null).filter(r=>{const jj=job(e.position||r.occupation_code||r.employment_category);const lim=jj==='外商員'?3600:jj==='職員'||jj==='内務員'?2520:null;return lim!==null&&Number(r.monthly_overtime_minutes)>lim}).length;
const leave=a.filter(r=>r.key>=leaveStart&&r.key<=m).reduce((n,r)=>n+(num(r.paid_leave_days)||0),0);
return {code:c,name:e.name||current?.employee_name||latest?.employee_name||'氏名未登録',center:e.center||'未設定',job:j,grade:grade(e.current_grade),current,all:a,hours,limit,used,leave,employeeId:e.id};});}
function render(){const m=$('m-month').value,query=norm($('m-search').value),occupation=$('m-occupation').value,mode=$('m-mode').value;const rows=grouped();const current=rows.filter(r=>r.current);const centers=[...new Set(current.map(r=>r.center))].sort((a,b)=>a.localeCompare(b,'ja'));if(selectedCenter&&!centers.includes(selectedCenter))selectedCenter='';
$('m-centers').innerHTML='<button class="month-center" data-center="" aria-pressed="'+(!selectedCenter)+'"><strong>すべて</strong><span>'+current.length+'名</span></button>'+centers.map(c=>'<button class="month-center" data-center="'+esc(c)+'" aria-pressed="'+(selectedCenter===c)+'"><strong>'+esc(c)+'</strong><span>'+current.filter(r=>r.center===c).length+'名</span></button>').join('');
$('m-centers').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{selectedCenter=b.dataset.center;render()}));
let shown=current.filter(r=>(!selectedCenter||r.center===selectedCenter)&&(!occupation||(occupation==='その他'?r.job==='その他':r.job===occupation))&&(!query||norm(r.name).includes(query)||norm(r.code).includes(query)));
if(mode==='overtime')shown=shown.filter(r=>r.limit!==null&&r.hours!==null&&r.hours>r.limit);if(mode==='leave')shown=shown.filter(r=>r.leave<5);if(mode==='missing')shown=shown.filter(r=>r.hours===null);
const order={'職員':0,'外商員':1,'内務員':2,'その他':3};shown.sort((a,b)=>(order[a.job]-order[b.job])||(b.grade-a.grade)||a.name.localeCompare(b.name,'ja'));
$('m-summary').innerHTML=[['選択月の勤怠掲載',current.length+'名'],['時間外通常基準超過',current.filter(r=>r.limit!==null&&r.hours!==null&&r.hours>r.limit).length+'名'],['年休5日未達（途中経過）',current.filter(r=>r.leave<5).length+'名'],['時間外未取得',current.filter(r=>r.hours===null).length+'名']].map(([k,v])=>'<article><span>'+esc(k)+'</span><strong>'+esc(v)+'</strong></article>').join('');
$('m-count').textContent='（'+shown.length+'名）';
$('m-rows').innerHTML=shown.map(r=>'<tr data-code="'+esc(r.code)+'"><td>'+esc(r.code)+'</td><td>'+esc(r.name)+'</td><td>'+esc(r.center)+'</td><td>'+esc(r.job)+'</td><td>'+(r.grade?r.grade+'級':'—')+'</td><td>'+minutes(r.hours)+'</td><td>'+(!r.limit?'区分未確認':r.hours===null?'未判定':r.hours>r.limit?'通常基準超過':'基準内')+'</td><td>'+r.used+' / 6回</td><td>'+r.leave.toFixed(1)+'日</td></tr>').join('')||'<tr><td colspan="9">該当者がいません</td></tr>';
$('m-rows').querySelectorAll('tr[data-code]').forEach(tr=>tr.addEventListener('click',()=>{chosenCode=tr.dataset.code;detail(rows.find(r=>r.code===chosenCode))}));
if(chosenCode){const r=rows.find(x=>x.code===chosenCode);if(r)detail(r);}
}
function detail(r){const el=$('m-detail');el.hidden=false;el.innerHTML='<h3>'+esc(r.name)+'（'+esc(r.code)+'）</h3><p>'+esc(r.center)+' / '+esc(r.job)+' / '+(r.grade?r.grade+'級':'等級未設定')+'</p><h4>月別実績</h4><div class="month-table-wrap"><table class="month-table"><thead><tr><th>年月</th><th>時間外</th><th>年休取得</th></tr></thead><tbody>'+r.all.map(a=>'<tr><td>'+esc(a.key)+'</td><td>'+minutes(num(a.monthly_overtime_minutes))+'</td><td>'+esc(a.paid_leave_days??'未取得')+'</td></tr>').join('')+'</tbody></table></div>'+(r.employeeId?'<p><a href="employee_detail.html?id='+encodeURIComponent(r.employeeId)+'">社員詳細へ</a></p>':'');}
async function init(){try{const sb=APP.client();const {data}=await sb.auth.getSession();if(!data?.session)throw Error('ログインが必要です');[employees,attendance]=await Promise.all([allRows('employees','id,employee_code,name,center,position,current_grade'),allRows('hr_monthly_attendance','month,personnel_code,employee_name,employment_category,occupation_code,monthly_overtime_minutes,paid_leave_days')]);$('m-status').textContent=attendance.length?'勤怠データ '+attendance.length+'件を読み込みました。':'勤怠データが0件です。閲覧権限（RLS）を確認してください。';render();}catch(e){dataError=e.message;$('m-status').textContent='データを読み込めません：'+dataError;$('m-status').classList.add('month-error');}}
['m-month','m-search','m-occupation','m-mode'].forEach(id=>document.getElementById(id)?.addEventListener(id==='m-search'?'input':'change',render));
return {init};
})();
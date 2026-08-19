/* Phase26N-89B — 社員詳細：雇用・契約履歴 */
window.EmployeeEmploymentContracts = (() => {
  const TABLE = 'employee_employment_contracts';
  let employeeId = null;
  let editingId = null;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = (v) => v ? (window.APP?.fmtDate ? APP.fmtDate(v) : String(v).replaceAll('-','/')) : '—';
  const client = () => window.APP?.client ? APP.client() : (window.getSupabaseClient ? getSupabaseClient() : null);
  const toast = (m,t='info') => window.APP?.toast ? APP.toast(m,t) : alert(m);

  function cardHtml(){
    return `<section class="card employment-contract-card" id="employment-contract-card">
      <div class="card-header card-header-navy"><div>
        <div class="card-title">雇用・契約</div>
        <div class="card-sub">雇用契約の期間・更新状況・契約書類を履歴で管理</div>
      </div><button type="button" class="btn btn-secondary btn-sm" id="btn-add-employment-contract">契約を追加</button></div>
      <div class="card-body" id="employment-contract-body"><div class="empty">読込中…</div></div>
    </section>`;
  }

  function modalHtml(){
    return `<div class="modal-backdrop hidden" id="employment-contract-modal" role="dialog" aria-modal="true">
      <div class="modal employment-contract-modal"><div class="modal-header"><div>
        <div class="card-title" id="employment-contract-modal-title">雇用契約を追加</div>
        <div class="card-sub">契約内容を履歴として保存します。</div>
      </div><button type="button" class="modal-close" data-contract-close aria-label="閉じる">×</button></div>
      <form id="employment-contract-form"><div class="modal-body">
        <div class="form-grid employment-contract-grid">
          <div class="form-group"><label class="form-label">契約区分 <span class="required-mark">必須</span></label>
            <input class="form-control" id="contract-type" maxlength="100" placeholder="例：正社員、準社員、パート" required></div>
          <div class="form-group"><label class="form-label">契約開始日 <span class="required-mark">必須</span></label>
            <input type="date" class="form-control" id="contract-start-date" required></div>
          <div class="form-group"><label class="form-label">有期／無期</label>
            <select class="form-control" id="contract-fixed"><option value="false">無期</option><option value="true">有期</option></select></div>
          <div class="form-group"><label class="form-label">契約終了日</label>
            <input type="date" class="form-control" id="contract-end-date"></div>
          <div class="form-group"><label class="form-label">更新状況</label>
            <input class="form-control" id="contract-renewal-status" maxlength="100" placeholder="例：更新予定、更新済、更新なし"></div>
          <div class="form-group employment-contract-memo"><label class="form-label">備考</label>
            <textarea class="form-control" id="contract-memo" rows="3" maxlength="500"></textarea></div>
        </div></div>
        <div class="modal-footer"><button type="button" class="btn btn-secondary" data-contract-close>キャンセル</button>
        <button type="submit" class="btn btn-primary" id="btn-save-employment-contract">登録</button></div>
      </form></div></div>`;
  }

  function inject(){
    if (document.getElementById('employment-contract-card')) return;
    const hr = document.querySelector('.employee-hr-history-card');
    if (!hr) return;
    hr.insertAdjacentHTML('beforebegin', cardHtml());
    document.body.insertAdjacentHTML('beforeend', modalHtml());
    document.getElementById('btn-add-employment-contract')?.addEventListener('click', () => openForm());
    document.querySelectorAll('[data-contract-close]').forEach(x => x.addEventListener('click', closeForm));
    document.getElementById('employment-contract-form')?.addEventListener('submit', save);
    document.getElementById('contract-fixed')?.addEventListener('change', syncFixed);
  }

  function syncFixed(){
    const fixed = document.getElementById('contract-fixed')?.value === 'true';
    const end = document.getElementById('contract-end-date');
    if (!end) return;
    end.disabled = !fixed;
    if (!fixed) end.value = '';
  }

  function openForm(row=null){
    editingId = row?.id || null;
    document.getElementById('employment-contract-modal-title').textContent = editingId ? '雇用契約を編集' : '雇用契約を追加';
    document.getElementById('contract-type').value = row?.contract_type || '';
    document.getElementById('contract-start-date').value = row?.start_date || '';
    document.getElementById('contract-fixed').value = row?.is_fixed_term ? 'true':'false';
    document.getElementById('contract-end-date').value = row?.end_date || '';
    document.getElementById('contract-renewal-status').value = row?.renewal_status || '';
    document.getElementById('contract-memo').value = row?.memo || '';
    syncFixed();
    document.getElementById('employment-contract-modal').classList.remove('hidden');
  }
  function closeForm(){ document.getElementById('employment-contract-modal')?.classList.add('hidden'); editingId=null; }

  async function load(){
    const sb=client(), body=document.getElementById('employment-contract-body');
    if (!sb || !body) return;
    body.innerHTML='<div class="empty">読込中…</div>';
    const {data,error}=await sb.from(TABLE).select('*').eq('employee_id',employeeId).order('start_date',{ascending:false});
    if(error){ console.error('[employment-contracts] load failed',error); body.innerHTML='<div class="empty">契約履歴を読み込めませんでした。</div>'; return; }
    render(data||[]);
  }

  function render(rows){
    const body=document.getElementById('employment-contract-body');
    if(!rows.length){ body.innerHTML='<div class="empty">登録済みの雇用契約はありません</div>'; return; }
    body.innerHTML=`<div class="table-wrap"><table class="employment-contract-table"><thead><tr>
      <th>契約区分</th><th>開始日</th><th>終了日</th><th>期間</th><th>更新状況</th><th>書類</th><th>操作</th>
      </tr></thead><tbody>${rows.map(r=>`<tr data-contract-id="${esc(r.id)}">
        <td><strong>${esc(r.contract_type)}</strong>${r.memo?`<div class="contract-note">${esc(r.memo)}</div>`:''}</td>
        <td>${fmt(r.start_date)}</td><td>${fmt(r.end_date)}</td><td>${r.is_fixed_term?'有期':'無期'}</td>
        <td>${esc(r.renewal_status||'—')}</td>
        <td><button type="button" class="btn btn-secondary btn-sm" data-contract-doc="${esc(r.id)}">書類管理</button></td>
        <td class="contract-actions"><button type="button" class="btn btn-secondary btn-sm" data-contract-edit="${esc(r.id)}">編集</button>
        <button type="button" class="btn btn-danger btn-sm" data-contract-delete="${esc(r.id)}">削除</button></td>
      </tr>`).join('')}</tbody></table></div>`;
    body.querySelectorAll('[data-contract-edit]').forEach(b=>b.addEventListener('click',()=>openForm(rows.find(r=>String(r.id)===b.dataset.contractEdit))));
    body.querySelectorAll('[data-contract-delete]').forEach(b=>b.addEventListener('click',()=>remove(b.dataset.contractDelete)));
    body.querySelectorAll('[data-contract-doc]').forEach(b=>b.addEventListener('click',()=>openDocuments(rows.find(r=>String(r.id)===b.dataset.contractDoc))));
  }

  async function save(e){
    e.preventDefault();
    const sb=client(); if(!sb){toast('DB接続を確認できません。登録していません。','error');return;}
    const isFixed=document.getElementById('contract-fixed').value==='true';
    const start=document.getElementById('contract-start-date').value;
    const end=document.getElementById('contract-end-date').value || null;
    if(isFixed && !end){toast('有期契約は契約終了日を入力してください。','error');return;}
    if(end && end < start){toast('契約終了日は契約開始日以降を指定してください。','error');return;}
    const payload={employee_id:employeeId,contract_type:document.getElementById('contract-type').value.trim(),
      start_date:start,end_date:isFixed?end:null,is_fixed_term:isFixed,
      renewal_status:document.getElementById('contract-renewal-status').value.trim()||null,
      memo:document.getElementById('contract-memo').value.trim()||null,updated_at:new Date().toISOString()};
    let q;
    if(editingId) q=sb.from(TABLE).update(payload).eq('id',editingId);
    else { delete payload.updated_at; q=sb.from(TABLE).insert(payload); }
    const {error}=await q;
    if(error){console.error('[employment-contracts] save failed',error);toast('雇用契約を登録できませんでした。管理者へお問い合わせください。','error');return;}
    toast(editingId?'雇用契約を更新しました':'雇用契約を登録しました','success'); closeForm(); await load();
  }

  async function remove(id){
    if(!confirm('この雇用契約を削除しますか？\n契約に添付書類がある場合は、先に書類を削除してください。')) return;
    const sb=client(); if(!sb) return;
    const links=await sb.from('document_links').select('id').eq('entity_type','employee_employment_contract').eq('entity_id',id).limit(1);
    if(links.error){console.error(links.error);toast('添付書類の確認に失敗したため削除していません。','error');return;}
    if(links.data?.length){toast('契約書類が登録されています。先に「書類管理」から書類を削除してください。','error');return;}
    const {error}=await sb.from(TABLE).delete().eq('id',id);
    if(error){console.error(error);toast('雇用契約を削除できませんでした。','error');return;}
    toast('雇用契約を削除しました','success'); await load();
  }

  function openDocuments(row){
    if(!row?.id || !window.EmployeeDocuments?.openEntityDialog){toast('書類管理を読み込めませんでした。画面を再読み込みしてください。','error');return;}
    EmployeeDocuments.openEntityDialog({type:'employee_employment_contract',id:row.id},{
      title:'雇用契約の書類',
      subtitle:`${row.contract_type || '雇用契約'} / ${fmt(row.start_date)}`,
      defaultDocumentType:'雇用・契約書類'
    });
  }

  async function mount(id){ employeeId=String(id||''); if(!employeeId)return; inject(); await load(); }
  return {mount,load};
})();

(() => {
  const run=()=>{const id=new URLSearchParams(location.search).get('id'); if(id) EmployeeEmploymentContracts.mount(id).catch(console.error);};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true}); else run();
})();
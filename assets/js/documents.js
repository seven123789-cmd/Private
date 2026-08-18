/* Phase26N-85B — 添付書類共通基盤
   documents / document_links + private Supabase Storage を使用する。
   初期UIは社員詳細に実装。将来 employee_license / employee_hr_history_official へ同じAPIを展開する。
*/
window.EmployeeDocuments = (() => {
  const BUCKET = 'employee-documents';
  const MAX_BYTES = 20 * 1024 * 1024;
  const ACCEPT = new Set(['application/pdf','image/jpeg','image/png','image/webp']);
  let mounted = false;
  let currentEntity = null;
  let rows = [];

  const esc = v => (window.APP ? APP.escape(v ?? '') : String(v ?? ''));
  const fmtBytes = n => {
    const v = Number(n || 0);
    if (!v) return '—';
    if (v < 1024) return `${v} B`;
    if (v < 1024*1024) return `${(v/1024).toFixed(1)} KB`;
    return `${(v/1024/1024).toFixed(1)} MB`;
  };
  const fmtDateTime = v => {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('ja-JP',{
      year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',
      timeZone:'Asia/Tokyo'
    }).format(d);
  };
  const safeName = name => String(name || 'file')
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|]+/g,'_')
    .replace(/\s+/g,' ')
    .trim()
    .slice(0,120) || 'file';

  async function sha256(file) {
    if (!crypto?.subtle) return null;
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
  }

  function injectEmployeeCard() {
    if (document.getElementById('employee-documents-card')) return;
    const anchor = document.querySelector('.employee-hr-history-card');
    if (!anchor) return;

    const section = document.createElement('section');
    section.className = 'card employee-documents-card';
    section.id = 'employee-documents-card';
    section.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">添付書類</div>
          <div class="card-sub">資格証・免許証・辞令・社員関連資料を非公開Storageで管理</div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-document-add">書類を追加</button>
      </div>
      <div class="card-body">
        <div id="employee-documents-state" class="document-state">読込中…</div>
        <div id="employee-documents-list"></div>
      </div>`;
    anchor.parentNode.insertBefore(section, anchor);

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop hidden';
    modal.id = 'document-upload-modal';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.innerHTML = `
      <div class="modal document-upload-modal">
        <div class="modal-header">
          <div>
            <div class="card-title">添付書類を追加</div>
            <div class="card-sub">PDF / JPEG / PNG / WebP、20MB以下</div>
          </div>
          <button type="button" class="modal-close" id="btn-document-close" aria-label="閉じる">×</button>
        </div>
        <form id="document-upload-form">
          <div class="modal-body">
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">書類区分 <span class="required-mark">必須</span></label>
                <select id="document-type" class="form-control" required>
                  <option value="資格証・免許証">資格証・免許証</option>
                  <option value="辞令・人事通知">辞令・人事通知</option>
                  <option value="雇用・契約書類">雇用・契約書類</option>
                  <option value="教育・受講記録">教育・受講記録</option>
                  <option value="その他">その他</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">書類日付</label>
                <input id="document-date" class="form-control" type="date">
              </div>
              <div class="form-group form-full">
                <label class="form-label">タイトル</label>
                <input id="document-title" class="form-control" maxlength="200" placeholder="未入力なら元ファイル名を使用">
              </div>
              <div class="form-group form-full">
                <label class="form-label">ファイル <span class="required-mark">必須</span></label>
                <input id="document-file" class="form-control" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" required>
                <div class="form-help">1ファイル20MB以下。個人情報を含むため公開URLでは保存しません。</div>
              </div>
              <div class="form-group form-full">
                <label class="form-label">備考</label>
                <textarea id="document-note" class="form-control" rows="3" maxlength="500"></textarea>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="btn-document-cancel">キャンセル</button>
            <button type="submit" class="btn btn-primary" id="btn-document-submit">登録</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(modal);

    document.getElementById('btn-document-add')?.addEventListener('click', openModal);
    document.getElementById('btn-document-close')?.addEventListener('click', closeModal);
    document.getElementById('btn-document-cancel')?.addEventListener('click', closeModal);
    document.getElementById('document-upload-form')?.addEventListener('submit', submitUpload);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  }

  function openModal() {
    const form = document.getElementById('document-upload-form');
    if (form) form.reset();
    document.getElementById('document-upload-modal')?.classList.remove('hidden');
  }
  function closeModal() {
    document.getElementById('document-upload-modal')?.classList.add('hidden');
  }

  async function loadRows() {
    const sb = APP.client();
    if (!sb || !currentEntity) return [];
    const links = await sb.from('document_links')
      .select('document_id,link_role')
      .eq('entity_type', currentEntity.type)
      .eq('entity_id', currentEntity.id);
    if (links.error) throw links.error;

    const ids = [...new Set((links.data || []).map(x=>x.document_id).filter(Boolean))];
    if (!ids.length) return [];
    const docs = await sb.from('documents')
      .select('id,document_type,title,original_file_name,storage_bucket,storage_path,mime_type,file_size_bytes,sha256,document_date,note,status,version_no,uploaded_at,updated_at')
      .in('id', ids)
      .neq('status','deleted')
      .order('document_date',{ascending:false,nullsFirst:false})
      .order('uploaded_at',{ascending:false});
    if (docs.error) throw docs.error;
    return docs.data || [];
  }

  function render() {
    const state = document.getElementById('employee-documents-state');
    const list = document.getElementById('employee-documents-list');
    if (!state || !list) return;

    if (!rows.length) {
      state.textContent = '登録済みの添付書類はありません';
      state.hidden = false;
      list.innerHTML = '';
      return;
    }
    state.hidden = true;
    list.innerHTML = `<div class="document-list">${rows.map(r=>`
      <div class="document-row" data-document-id="${esc(r.id)}">
        <div class="document-row__main">
          <div class="document-row__top">
            <span class="badge badge-gray">${esc(r.document_type || 'その他')}</span>
            <strong>${esc(r.title || r.original_file_name)}</strong>
          </div>
          <div class="document-row__meta">
            <span>${r.document_date ? `書類日付 ${esc(APP.fmtDate(r.document_date))}` : '書類日付 —'}</span>
            <span>${esc(r.original_file_name)}</span>
            <span>${esc(fmtBytes(r.file_size_bytes))}</span>
            <span>登録 ${esc(fmtDateTime(r.uploaded_at))}</span>
          </div>
          ${r.note ? `<div class="document-row__note">${esc(r.note)}</div>` : ''}
        </div>
        <div class="document-row__actions">
          <button type="button" class="btn btn-secondary btn-sm" data-doc-open="${esc(r.id)}">開く</button>
          <button type="button" class="btn btn-secondary btn-sm" data-doc-retire="${esc(r.id)}">無効化</button>
        </div>
      </div>`).join('')}</div>`;

    list.querySelectorAll('[data-doc-open]').forEach(btn=>{
      btn.addEventListener('click',()=>openDocument(btn.dataset.docOpen));
    });
    list.querySelectorAll('[data-doc-retire]').forEach(btn=>{
      btn.addEventListener('click',()=>retireDocument(btn.dataset.docRetire));
    });
  }

  async function refresh() {
    const state = document.getElementById('employee-documents-state');
    if (state) { state.hidden = false; state.textContent = '読込中…'; }
    try {
      rows = await loadRows();
      render();
    } catch (e) {
      console.error(e);
      if (state) state.textContent = '添付書類を取得できませんでした';
    }
  }

  async function submitUpload(ev) {
    ev.preventDefault();
    const sb = APP.client();
    if (!sb || !currentEntity) {
      APP.toast('DB接続または社員情報を確認できません','error');
      return;
    }
    const file = document.getElementById('document-file')?.files?.[0];
    if (!file) { APP.toast('ファイルを選択してください','warning'); return; }
    if (file.size > MAX_BYTES) { APP.toast('20MBを超えるファイルは登録できません','error'); return; }
    if (!ACCEPT.has(file.type)) { APP.toast('対応していないファイル形式です','error'); return; }

    const btn = document.getElementById('btn-document-submit');
    if (btn) { btn.disabled = true; btn.textContent = '登録中…'; }

    let storagePath = null;
    try {
      const { data:{ user } } = await sb.auth.getUser();
      if (!user) throw new Error('ログインが必要です');

      const hash = await sha256(file);
      const stamp = new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14);
      const random = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      storagePath = `${currentEntity.type}/${currentEntity.id}/${stamp}_${random}_${safeName(file.name)}`;

      const up = await sb.storage.from(BUCKET).upload(storagePath,file,{
        cacheControl:'3600',
        upsert:false,
        contentType:file.type
      });
      if (up.error) throw up.error;

      const title = document.getElementById('document-title')?.value?.trim() || file.name;
      const docInsert = await sb.from('documents').insert({
        document_type: document.getElementById('document-type')?.value || 'その他',
        title,
        original_file_name: file.name,
        storage_bucket: BUCKET,
        storage_path: storagePath,
        mime_type: file.type || null,
        file_size_bytes: file.size,
        sha256: hash,
        document_date: document.getElementById('document-date')?.value || null,
        note: document.getElementById('document-note')?.value?.trim() || null,
        status:'active',
        uploaded_by:user.id
      }).select('id').single();
      if (docInsert.error) throw docInsert.error;

      const linkInsert = await sb.from('document_links').insert({
        document_id:docInsert.data.id,
        entity_type:currentEntity.type,
        entity_id:currentEntity.id,
        link_role:'attachment',
        created_by:user.id
      });
      if (linkInsert.error) {
        await sb.from('documents').update({status:'deleted',deleted_at:new Date().toISOString(),deleted_by:user.id})
          .eq('id',docInsert.data.id);
        throw linkInsert.error;
      }

      closeModal();
      APP.toast('添付書類を登録しました','success');
      await refresh();
    } catch (e) {
      console.error(e);
      if (storagePath) {
        try { await sb.storage.from(BUCKET).remove([storagePath]); } catch (_) {}
      }
      APP.toast(`添付書類の登録に失敗しました${e?.message ? '：'+e.message : ''}`,'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '登録'; }
    }
  }

  async function openDocument(id) {
    const sb = APP.client();
    const doc = rows.find(x=>String(x.id)===String(id));
    if (!sb || !doc) return;
    try {
      const signed = await sb.storage.from(doc.storage_bucket || BUCKET)
        .createSignedUrl(doc.storage_path, 60);
      if (signed.error) throw signed.error;
      window.open(signed.data.signedUrl,'_blank','noopener,noreferrer');
    } catch (e) {
      console.error(e);
      APP.toast('書類を開けませんでした','error');
    }
  }

  async function retireDocument(id) {
    const sb = APP.client();
    const doc = rows.find(x=>String(x.id)===String(id));
    if (!sb || !doc) return;
    if (!confirm(`「${doc.title || doc.original_file_name}」を無効化しますか？\nファイル本体は監査・復元のため即時削除しません。`)) return;

    try {
      const { data:{ user } } = await sb.auth.getUser();
      const r = await sb.from('documents').update({
        status:'deleted',
        deleted_at:new Date().toISOString(),
        deleted_by:user?.id || null
      }).eq('id',id);
      if (r.error) throw r.error;
      APP.toast('添付書類を無効化しました','success');
      await refresh();
    } catch (e) {
      console.error(e);
      APP.toast('添付書類を無効化できませんでした','error');
    }
  }

  async function mount(entity) {
    if (!entity?.type || !entity?.id) return;
    currentEntity = {type:String(entity.type),id:String(entity.id)};
    if (currentEntity.type === 'employee') injectEmployeeCard();
    mounted = true;
    await refresh();
  }

  async function autoMountEmployee() {
    if (mounted || !window.APP) return;
    const page = String(location.pathname || '').split('/').pop();
    if (page !== 'employee_detail.html') return;
    const id = new URLSearchParams(location.search).get('id');
    if (!id) return;
    await mount({type:'employee',id});
  }

  window.addEventListener('load',()=>{ setTimeout(()=>autoMountEmployee().catch(console.error),0); });
  if (document.readyState === 'complete') {
    setTimeout(()=>autoMountEmployee().catch(console.error),0);
  }

  return { mount, refresh, openDocument };
})();

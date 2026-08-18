/* Phase26N-88B — 書類コンテキスト修正
   documents / document_links + private Supabase Storage を使用する。
   初期UIは社員詳細に実装。将来 employee_license / employee_hr_history_official へ同じAPIを展開する。
   StorageキーはASCIIのみで構成し、元ファイル名はDBへ保持する。
*/
window.EmployeeDocuments = (() => {
  const BUCKET = 'employee-documents';
  const MAX_BYTES = 20 * 1024 * 1024;
  const ACCEPT = new Set(['application/pdf','image/jpeg','image/png','image/webp']);
  const EXT_BY_MIME = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  };
  let mounted = false;
  let currentEntity = null;
  let employeeEntity = null;
  let rows = [];
  let returnToEntityDialog = false;

  const esc = v => (typeof APP !== 'undefined' ? APP.escape(v ?? '') : String(v ?? ''));
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
          <div class="card-title">社員書類</div>
          <div class="card-sub">雇用・契約・教育など、この社員本人に直接紐づく書類を管理</div>
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
            <div class="card-title" id="document-upload-title">社員書類を追加</div>
            <div class="card-sub" id="document-upload-subtitle">PDF / JPEG / PNG / WebP、20MB以下</div>
          </div>
          <button type="button" class="modal-close" id="btn-document-close" aria-label="閉じる">×</button>
        </div>
        <form id="document-upload-form">
          <div class="modal-body">
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">書類区分 <span class="required-mark">必須</span></label>
                <select id="document-type" class="form-control" required>
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

  async function openEntityDialog(entity, options = {}) {
    if (!entity?.type || !entity?.id) return;
    const sb = APP.client();
    if (!sb) {
      APP.toast('DB接続を確認できません','error');
      return;
    }
    currentEntity = {type:String(entity.type),id:String(entity.id)};

    const title = options.title || '添付書類';
    const subtitle = options.subtitle || '';
    const defaultType = options.defaultDocumentType || 'その他';

    let modal = document.getElementById('entity-document-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal-backdrop hidden';
      modal.id = 'entity-document-modal';
      modal.setAttribute('role','dialog');
      modal.setAttribute('aria-modal','true');
      modal.innerHTML = `
        <div class="modal document-upload-modal entity-document-modal">
          <div class="modal-header">
            <div>
              <div class="card-title" id="entity-document-title">添付書類</div>
              <div class="card-sub" id="entity-document-subtitle"></div>
            </div>
            <button type="button" class="modal-close" id="btn-entity-document-close" aria-label="閉じる">×</button>
          </div>
          <div class="modal-body">
            <div id="entity-document-state" class="document-state">読込中…</div>
            <div id="entity-document-list"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="btn-entity-document-add">書類を追加</button>
            <button type="button" class="btn btn-secondary" id="btn-entity-document-done">閉じる</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      const close = () => modal.classList.add('hidden');
      document.getElementById('btn-entity-document-close')?.addEventListener('click', close);
      document.getElementById('btn-entity-document-done')?.addEventListener('click', close);
      modal.addEventListener('click', e => { if (e.target === modal) close(); });
      document.getElementById('btn-entity-document-add')?.addEventListener('click', () => {
        returnToEntityDialog = true;
        modal.classList.add('hidden');
        openUploadModal();
      });
    }

    document.getElementById('entity-document-title').textContent = title;
    document.getElementById('entity-document-subtitle').textContent = subtitle;
    modal.dataset.defaultDocumentType = defaultType;
    modal.classList.remove('hidden');
    await refreshEntityDialog();
  }

  async function refreshEntityDialog() {
    const state = document.getElementById('entity-document-state');
    const list = document.getElementById('entity-document-list');
    if (!state || !list) return;
    state.hidden = false;
    state.textContent = '読込中…';
    try {
      const entityRows = await loadRows();
      if (!entityRows.length) {
        state.textContent = '登録済みの添付書類はありません';
        list.innerHTML = '';
        return;
      }
      state.textContent = '';
      state.hidden = true;
      list.innerHTML = `<div class="document-list">${entityRows.map(r=>`
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
            </div>
          </div>
          <div class="document-row__actions">
            <button type="button" class="btn btn-secondary btn-sm" data-entity-doc-open="${esc(r.id)}">開く</button>
            <button type="button" class="btn btn-secondary btn-sm" data-entity-doc-download="${esc(r.id)}">保存</button>
            <button type="button" class="btn btn-secondary btn-sm" data-entity-doc-delete="${esc(r.id)}">削除</button>
          </div>
        </div>`).join('')}</div>`;
      list.querySelectorAll('[data-entity-doc-open]').forEach(btn=>{
        btn.addEventListener('click',()=>openDocument(btn.dataset.entityDocOpen));
      });
      list.querySelectorAll('[data-entity-doc-download]').forEach(btn=>{
        btn.addEventListener('click',()=>downloadDocument(btn.dataset.entityDocDownload));
      });
      list.querySelectorAll('[data-entity-doc-delete]').forEach(btn=>{
        btn.addEventListener('click',async()=>{
          await deleteDocument(btn.dataset.entityDocDelete);
          await refreshEntityDialog();
        });
      });
    } catch (e) {
      console.error(e);
      state.textContent = '添付書類を取得できませんでした';
    }
  }

  function documentTypeOptions(entityType) {
    if (entityType === 'employee_license') {
      return [{value:'資格証・免許証', label:'資格証・免許証'}];
    }
    if (entityType === 'employee_hr_history_official') {
      return [
        {value:'辞令・人事通知', label:'辞令・人事通知'},
        {value:'その他人事書類', label:'その他人事書類'}
      ];
    }
    return [
      {value:'雇用・契約書類', label:'雇用・契約書類'},
      {value:'教育・受講記録', label:'教育・受講記録'},
      {value:'その他', label:'その他'}
    ];
  }

  function configureUploadContext() {
    const type = currentEntity?.type || 'employee';
    const title = document.getElementById('document-upload-title');
    const subtitle = document.getElementById('document-upload-subtitle');
    const typeEl = document.getElementById('document-type');
    const options = documentTypeOptions(type);

    if (title) {
      title.textContent =
        type === 'employee_license' ? '資格・免許の書類を追加' :
        type === 'employee_hr_history_official' ? '人事履歴の書類を追加' :
        '社員書類を追加';
    }
    if (subtitle) {
      subtitle.textContent =
        type === 'employee_license' ? 'この資格・免許に直接紐づけて保存します' :
        type === 'employee_hr_history_official' ? 'この人事履歴に直接紐づけて保存します' :
        'この社員本人に直接紐づく書類を保存します';
    }
    if (typeEl) {
      typeEl.innerHTML = options.map(x =>
        `<option value="${esc(x.value)}">${esc(x.label)}</option>`
      ).join('');
      typeEl.disabled = options.length === 1;
    }
  }

  function openUploadModal() {
    const form = document.getElementById('document-upload-form');
    if (form) form.reset();
    configureUploadContext();
    document.getElementById('document-upload-modal')?.classList.remove('hidden');
  }

  function openModal() {
    returnToEntityDialog = false;
    if (!employeeEntity?.id) {
      APP.toast('社員情報を確認できません。画面を再読み込みしてください。','error');
      return;
    }
    currentEntity = {type:'employee', id:String(employeeEntity.id)};
    openUploadModal();
  }

  function closeModal() {
    document.getElementById('document-upload-modal')?.classList.add('hidden');
    if (returnToEntityDialog) {
      document.getElementById('entity-document-modal')?.classList.remove('hidden');
      returnToEntityDialog = false;
    }
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
      state.textContent = '登録済みの社員書類はありません';
      state.hidden = false;
      list.innerHTML = '';
      return;
    }
    state.textContent = '';
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
          <button type="button" class="btn btn-secondary btn-sm" data-doc-download="${esc(r.id)}">保存</button>
          <button type="button" class="btn btn-secondary btn-sm" data-doc-delete="${esc(r.id)}">削除</button>
        </div>
      </div>`).join('')}</div>`;

    list.querySelectorAll('[data-doc-open]').forEach(btn=>{
      btn.addEventListener('click',()=>openDocument(btn.dataset.docOpen));
    });
    list.querySelectorAll('[data-doc-download]').forEach(btn=>{
      btn.addEventListener('click',()=>downloadDocument(btn.dataset.docDownload));
    });
    list.querySelectorAll('[data-doc-delete]').forEach(btn=>{
      btn.addEventListener('click',()=>deleteDocument(btn.dataset.docDelete));
    });
  }

  async function refresh() {
    const state = document.getElementById('employee-documents-state');
    if (state) { state.hidden = false; state.textContent = '読込中…'; }
    try {
      if (!employeeEntity?.id) throw new Error('EMPLOYEE_ENTITY_NOT_SET');
      const previousEntity = currentEntity;
      currentEntity = {type:'employee', id:String(employeeEntity.id)};
      rows = await loadRows();
      currentEntity = previousEntity;
      render();
    } catch (e) {
      console.error(e);
      if (state) state.textContent = '社員書類を取得できませんでした';
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
      const ext = EXT_BY_MIME[file.type];
      if (!ext) throw new Error('対応していないファイル形式です');
      storagePath = `${currentEntity.type}/${currentEntity.id}/${stamp}_${random}.${ext}`;

      const up = await sb.storage.from(BUCKET).upload(storagePath,file,{
        cacheControl:'3600',
        upsert:false,
        contentType:file.type
      });
      if (up.error) throw up.error;

      const title = document.getElementById('document-title')?.value?.trim() || file.name;
      const docInsert = await sb.from('documents').insert({
        document_type: document.getElementById('document-type')?.value || documentTypeOptions(currentEntity.type)[0]?.value || 'その他',
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
      if (currentEntity.type === 'employee') await refresh();
      const entityModal = document.getElementById('entity-document-modal');
      if (entityModal && !entityModal.classList.contains('hidden')) await refreshEntityDialog();
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

  async function resolveDocument(id) {
    const sb = APP.client();
    if (!sb) throw new Error('DB_CLIENT_UNAVAILABLE');
    const cached = rows.find(x=>String(x.id)===String(id));
    if (cached) return cached;

    const result = await sb.from('documents')
      .select('id,document_type,title,original_file_name,storage_bucket,storage_path,mime_type,file_size_bytes,status')
      .eq('id', id)
      .neq('status','deleted')
      .maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) throw new Error('DOCUMENT_NOT_FOUND');
    return result.data;
  }

  function fileErrorMessage(action, error) {
    const raw = `${error?.message || ''} ${error?.error || ''}`.toLowerCase();
    if (String(error?.message || '') === 'DOCUMENT_NOT_FOUND' || raw.includes('not found') || raw.includes('object not found')) {
      return '保存ファイルが見つかりません。管理者へお問い合わせください。';
    }
    if (raw.includes('permission') || raw.includes('not authorized') || raw.includes('unauthorized') || raw.includes('forbidden') || raw.includes('row-level security')) {
      return 'このファイルを操作する権限がありません。';
    }
    if (raw.includes('network') || raw.includes('failed to fetch') || raw.includes('load failed')) {
      return '通信エラーが発生しました。時間をおいて再度お試しください。';
    }
    return `ファイルを${action}ませんでした。管理者へお問い合わせください。`;
  }

  async function openDocument(id) {
    if (!id) {
      APP.toast('対象ファイルを特定できませんでした。管理者へお問い合わせください。','error');
      return;
    }
    const popup = window.open('about:blank','_blank');
    if (!popup) {
      APP.toast('ブラウザでポップアップがブロックされています。このサイトのポップアップを許可して再度お試しください。','error');
      return;
    }
    try {
      popup.document.title = 'ファイルを開いています…';
      APP.toast('ファイルを開いています…','info');
      const sb = APP.client();
      if (!sb) throw new Error('DB_CLIENT_UNAVAILABLE');
      const doc = await resolveDocument(id);
      if (!doc.storage_path) throw new Error('DOCUMENT_NOT_FOUND');

      const signed = await sb.storage.from(doc.storage_bucket || BUCKET)
        .createSignedUrl(doc.storage_path, 60);
      if (signed.error) throw signed.error;
      if (!signed.data?.signedUrl) throw new Error('SIGNED_URL_NOT_CREATED');

      popup.location.replace(signed.data.signedUrl);
      APP.toast('ファイルを開きました','success');
    } catch (e) {
      try { popup.close(); } catch (_) {}
      console.error('[documents] open failed', {documentId:id, entity:currentEntity, error:e});
      APP.toast(fileErrorMessage('開け', e),'error');
    }
  }

  async function downloadDocument(id) {
    if (!id) {
      APP.toast('対象ファイルを特定できませんでした。管理者へお問い合わせください。','error');
      return;
    }
    try {
      APP.toast('保存の準備をしています…','info');
      const sb = APP.client();
      if (!sb) throw new Error('DB_CLIENT_UNAVAILABLE');
      const doc = await resolveDocument(id);
      if (!doc.storage_path) throw new Error('DOCUMENT_NOT_FOUND');

      const result = await sb.storage.from(doc.storage_bucket || BUCKET).download(doc.storage_path);
      if (result.error) throw result.error;
      if (!result.data) throw new Error('DOCUMENT_NOT_FOUND');

      const blobUrl = URL.createObjectURL(result.data);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = doc.original_file_name || doc.title || 'document';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(blobUrl), 3000);
      APP.toast('保存を開始しました','success');
    } catch (e) {
      console.error('[documents] download failed', {documentId:id, entity:currentEntity, error:e});
      APP.toast(fileErrorMessage('保存でき', e),'error');
    }
  }

  async function deleteDocument(id) {
    if (!id || !currentEntity?.type || !currentEntity?.id) {
      APP.toast('削除対象を特定できませんでした。管理者へお問い合わせください。','error');
      return;
    }

    let doc;
    try {
      doc = await resolveDocument(id);
    } catch (e) {
      console.error('[documents] delete resolve failed', {documentId:id, entity:currentEntity, error:e});
      APP.toast(fileErrorMessage('削除でき', e),'error');
      return;
    }

    if (!confirm(`「${doc.title || doc.original_file_name}」を削除しますか？\nこの操作は元に戻せません。`)) return;

    const sb = APP.client();
    if (!sb) {
      APP.toast('DB接続を確認できません。削除していません。','error');
      return;
    }

    try {
      APP.toast('ファイルを削除しています…','info');

      const linksResult = await sb.from('document_links')
        .select('document_id,entity_type,entity_id')
        .eq('document_id', id);
      if (linksResult.error) throw linksResult.error;

      const allLinks = linksResult.data || [];
      const targetLinks = allLinks.filter(link =>
        String(link.entity_type) === String(currentEntity.type) &&
        String(link.entity_id) === String(currentEntity.id)
      );
      if (!targetLinks.length) throw new Error('DOCUMENT_LINK_NOT_FOUND');

      const unlink = await sb.from('document_links')
        .delete()
        .eq('document_id', id)
        .eq('entity_type', currentEntity.type)
        .eq('entity_id', currentEntity.id);
      if (unlink.error) throw unlink.error;

      const remainingLinks = allLinks.length - targetLinks.length;
      if (remainingLinks <= 0) {
        if (doc.storage_path) {
          const storageDelete = await sb.storage
            .from(doc.storage_bucket || BUCKET)
            .remove([doc.storage_path]);
          if (storageDelete.error) {
            console.error('[documents] storage cleanup failed after unlink', {
              documentId:id, storagePath:doc.storage_path, error:storageDelete.error
            });
            APP.toast('紐付けは削除しましたが、保存ファイルの削除に失敗しました。管理者による確認が必要です。','error');
            if (currentEntity.type === 'employee') await refresh();
            else await refreshEntityDialog();
            return;
          }
        }

        const deleteRow = await sb.from('documents').delete().eq('id', id);
        if (deleteRow.error) {
          console.error('[documents] document row cleanup failed', {documentId:id, error:deleteRow.error});
          APP.toast('保存ファイルは削除しましたが、管理情報の削除に失敗しました。管理者による確認が必要です。','error');
          if (currentEntity.type === 'employee') await refresh();
          else await refreshEntityDialog();
          return;
        }
      }

      APP.toast(remainingLinks > 0
        ? 'この資格・社員との添付を削除しました。ファイルは他の登録で使用中のため保持しています。'
        : '添付書類を削除しました','success');

      if (currentEntity.type === 'employee') await refresh();
      else await refreshEntityDialog();
    } catch (e) {
      console.error('[documents] delete failed', {documentId:id, entity:currentEntity, error:e});
      const raw = `${e?.message || ''}`.toLowerCase();
      if (raw.includes('permission') || raw.includes('authorized') || raw.includes('forbidden') || raw.includes('row-level security')) {
        APP.toast('削除する権限がありません。','error');
      } else if (raw.includes('network') || raw.includes('failed to fetch')) {
        APP.toast('通信エラーが発生しました。削除結果を確認してから再度お試しください。','error');
      } else {
        APP.toast('添付書類を削除できませんでした。管理者へお問い合わせください。','error');
      }
    }
  }

  async function mount(entity) {
    if (!entity?.type || !entity?.id) return;
    currentEntity = {type:String(entity.type),id:String(entity.id)};
    if (currentEntity.type === 'employee') {
      employeeEntity = {type:'employee', id:String(entity.id)};
      injectEmployeeCard();
    }
    mounted = true;
    await refresh();
  }

  async function autoMountEmployee() {
    if (mounted || typeof APP === 'undefined') return;
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

  return { mount, refresh, openDocument, downloadDocument, deleteDocument, openEntityDialog };
})();

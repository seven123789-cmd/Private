/* Phase16-D: 社員所属・役職・等級履歴 Repository / UI
   既存社員詳細の読込処理から分離し、履歴参照のみを担当する。
*/
window.EmployeeAssignmentHistory = (() => {
  const labelOf = (row, candidates) => {
    if (!row) return '—';
    for (const key of candidates) if (row[key] !== null && row[key] !== undefined && String(row[key]).trim()) return String(row[key]);
    return '—';
  };
  const mapById = rows => new Map((rows || []).map(x => [String(x.id), x]));
  const fmt = v => APP.fmtDate(v) || '—';
  const typeLabel = {
    initial:'初期登録', hire:'入社', transfer:'異動', position_change:'役職変更',
    grade_change:'等級変更', correction:'訂正', other:'その他'
  };

  async function load(employeeId) {
    const sb = APP.client();
    if (!sb) return { data:[], error:new Error('Supabaseに接続されていません') };
    const [hist, centers, divisions, positions, grades] = await Promise.all([
      sb.from('employee_assignment_history').select('*').eq('employee_id', employeeId).order('effective_from',{ascending:false}),
      sb.from('centers').select('*'), sb.from('divisions').select('*'),
      sb.from('positions').select('*'), sb.from('grades').select('*')
    ]);
    if (hist.error) return {data:[], error:hist.error};
    const cm=mapById(centers.data), dm=mapById(divisions.data), pm=mapById(positions.data), gm=mapById(grades.data);
    const rows=(hist.data||[]).map(h => ({
      ...h,
      center_name: labelOf(cm.get(String(h.center_id)), ['center_name','name','center_code']),
      division_name: labelOf(dm.get(String(h.division_id)), ['division_name','name','division_code']),
      position_name: labelOf(pm.get(String(h.position_id)), ['position_name','name','position_code']),
      grade_name: h.grade_id ? labelOf(gm.get(String(h.grade_id)), ['grade_name','name','grade_code']) : '未設定'
    }));
    return {data:rows,error:null};
  }

  function render(rows, target) {
    if (!target) return;
    if (!rows.length) {
      target.innerHTML='<div class="empty">所属・役職・等級の履歴はありません</div>';
      return;
    }
    target.innerHTML=`<div class="assignment-history">${rows.map((r,i)=>`
      <article class="assignment-history__item ${r.effective_to===null?'is-current':''}">
        <div class="assignment-history__rail"><span></span></div>
        <div class="assignment-history__content">
          <div class="assignment-history__head">
            <div><strong>${APP.escape(fmt(r.effective_from))}</strong><span class="assignment-history__period">${r.effective_to ? ' ～ '+APP.escape(fmt(r.effective_to)) : ' ～ 現在'}</span></div>
            ${r.effective_to===null ? APP.badge('現在','success') : APP.badge(typeLabel[r.change_type]||r.change_type||'変更','secondary')}
          </div>
          <div class="assignment-history__grid">
            <div><span>センター</span><strong>${APP.escape(r.center_name)}</strong></div>
            <div><span>部門</span><strong>${APP.escape(r.division_name)}</strong></div>
            <div><span>役職・職種</span><strong>${APP.escape(r.position_name)}</strong></div>
            <div><span>等級</span><strong>${APP.escape(r.grade_name)}</strong></div>
          </div>
          ${r.memo ? `<div class="assignment-history__memo">${APP.escape(r.memo)}</div>` : ''}
        </div>
      </article>`).join('')}</div>`;
  }

  async function mount(employeeId, targetId='emp-assignment-history') {
    const target=document.getElementById(targetId);
    if (!target) return;
    target.innerHTML='<div class="empty">履歴を読み込んでいます…</div>';
    const result=await load(employeeId);
    if (result.error) {
      console.error('employee assignment history load failed', result.error);
      target.innerHTML='<div class="empty">履歴を読み込めませんでした</div>';
      return;
    }
    render(result.data,target);
  }
  return {load,render,mount};
})();

/* Phase26N-88A — 正式人事履歴レコード単位の添付書類 */
window.EmployeeHrDocuments = (() => {
  function labelForRow(r) {
    const date = r?.effective_date ? APP.fmtDate(r.effective_date) : (r?.effective_label || '日付未設定');
    const type = String(r?.event_type || '人事変更').trim();
    return `${date} / ${type}`;
  }

  function enhance(root, rows) {
    if (!root || !Array.isArray(rows) || !rows.length || !window.EmployeeDocuments?.openEntityDialog) return;

    const table = root.querySelector('table.hr-history-table');
    if (!table) return;
    const head = table.querySelector('thead tr');
    const trs = [...table.querySelectorAll('tbody tr')];
    if (!head || trs.length !== rows.length) {
      console.error('[hr-documents] 正式人事履歴の行数とDB行数が一致しません', {domRows:trs.length, dataRows:rows.length});
      return;
    }

    if (!head.querySelector('[data-hr-doc-head]')) {
      const th = document.createElement('th');
      th.dataset.hrDocHead = '1';
      th.textContent = '書類';
      head.appendChild(th);
    }

    trs.forEach((tr, index) => {
      if (tr.querySelector('[data-hr-doc-cell]')) return;
      const r = rows[index];
      if (!r?.id) return;
      const td = document.createElement('td');
      td.dataset.hrDocCell = '1';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-secondary btn-sm';
      btn.textContent = '書類管理';
      btn.addEventListener('click', () => {
        window.EmployeeDocuments.openEntityDialog(
          {type:'employee_hr_history_official', id:r.id},
          {
            title:'人事履歴の書類',
            subtitle:labelForRow(r),
            defaultDocumentType:'辞令・人事通知'
          }
        );
      });
      td.appendChild(btn);
      tr.appendChild(td);
    });
  }

  return { enhance };
})();

/* Phase26N-88A — 社員詳細の資格・免許レコードへ証明書を紐付ける */
window.EmployeeLicenseDocuments = (() => {
  async function enhance(employeeId) {
    if (typeof APP === 'undefined' || !window.EmployeeDocuments) return;
    const body = document.getElementById('emp-licenses-body');
    if (!body) return;

    const rows = await APP.loadLicenseRows();
    const myLics = (rows || []).filter(r => String(r.employee_id) === String(employeeId));
    if (!myLics.length) return;

    const table = body.querySelector('table');
    if (!table) return;
    const headRow = table.querySelector('thead tr');
    const bodyRows = [...table.querySelectorAll('tbody tr')];
    if (!headRow || bodyRows.length !== myLics.length) return;

    if (!headRow.querySelector('[data-license-doc-head]')) {
      const th = document.createElement('th');
      th.dataset.licenseDocHead = '1';
      th.textContent = '証明書';
      headRow.appendChild(th);
    }

    bodyRows.forEach((tr, index) => {
      const lic = myLics[index];
      if (!lic?.id || tr.querySelector('[data-license-doc-cell]')) return;
      const td = document.createElement('td');
      td.dataset.licenseDocCell = '1';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-secondary btn-sm';
      btn.textContent = '書類管理';
      btn.addEventListener('click', () => EmployeeDocuments.openEntityDialog(
        {type:'employee_license', id:lic.id},
        {
          title:'資格・免許の書類',
          subtitle: lic.license_name || '',
          defaultDocumentType:'資格証・免許証'
        }
      ));
      td.appendChild(btn);
      tr.appendChild(td);
    });
  }

  return { enhance };
})();

(() => {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) return;
  const target = document.getElementById('emp-licenses-body');
  if (!target) return;
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    try { await window.EmployeeLicenseDocuments?.enhance(id); }
    catch (e) { console.error(e); }
    finally { busy = false; }
  };
  const observer = new MutationObserver(() => run());
  observer.observe(target, {childList:true, subtree:true});
  setTimeout(run, 0);
})();

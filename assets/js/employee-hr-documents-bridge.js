/* Phase26N-87A — 正式人事履歴添付の接続ブリッジ
   EmployeeHrTimelineが描画した実DOMと、RPCと同じ正式履歴を再取得してID単位で接続する。
*/
(() => {
  async function run() {
    if (typeof APP === 'undefined' || !window.EmployeeHrDocuments) return;
    const employeeId = new URLSearchParams(location.search).get('id');
    const root = document.getElementById('emp-hr-timeline');
    if (!employeeId || !root || !root.querySelector('table.hr-history-table')) return;
    try {
      const result = await APP.client().rpc('get_employee_hr_history_official_v1', {p_employee_id:employeeId});
      if (result.error) throw result.error;
      window.EmployeeHrDocuments.enhance(root, result.data || []);
    } catch (e) {
      console.error('[hr-documents] 正式人事履歴添付の初期化に失敗', e);
    }
  }

  const start = () => {
    const root = document.getElementById('emp-hr-timeline');
    if (!root) return;
    const observer = new MutationObserver(() => run());
    observer.observe(root, {childList:true, subtree:true});
    run();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();

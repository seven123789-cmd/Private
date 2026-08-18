/* Supabase接続設定
   公開用の publishable key のみ使用しています。
   secret key / service_role key はブラウザ側に入れないでください。
*/
window.SUPABASE_URL = 'https://acxlkqlhlyzctmpmffrd.supabase.co';
window.SUPABASE_ANON_KEY = 'sb_publishable_8ZRFizSdMmGkTs_Yk-mQCA_wf5_vSPY';

window.getSupabaseClient = function getSupabaseClient() {
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY || !window.supabase) return null;
  if (!window.__licenseSupabaseClient) {
    window.__licenseSupabaseClient = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY
    );
  }
  return window.__licenseSupabaseClient;
};


/* 認証移行設定
   Phase11では既存運用を止めないため optional で開始します。
   初回管理者アカウントのログイン確認後に true へ変更します。
*/
window.AUTH_REQUIRED = true;
window.AUTH_LOGIN_URL = 'login.html';

/* Phase26N-85D — employee document module
   85CでDOMContentLoaded後の読込に変更したが、documents.js自身のautoMountが
   window.load待ちのため、動的読込完了とload発火の競合が残っていた。
   documents.jsのload完了時に公開API mount()を明示実行し、社員詳細へ確実に接続する。
*/
(() => {
  const path = String(location.pathname || '').split('/').pop();
  if (path !== 'employee_detail.html') return;

  const loadEmployeeDocuments = () => {
    if (!document.querySelector('link[data-employee-documents]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'assets/css/documents.css';
      css.dataset.employeeDocuments = '1';
      document.head.appendChild(css);
    }

    if (!document.querySelector('script[data-employee-documents]')) {
      const js = document.createElement('script');
      js.src = 'assets/js/documents.js';
      js.dataset.employeeDocuments = '1';
      js.addEventListener('load', () => {
        const id = new URLSearchParams(location.search).get('id');
        if (!id || !window.EmployeeDocuments?.mount) return;
        window.EmployeeDocuments.mount({ type: 'employee', id }).catch(console.error);
      }, { once: true });
      document.body.appendChild(js);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadEmployeeDocuments, { once: true });
  } else {
    loadEmployeeDocuments();
  }
})();

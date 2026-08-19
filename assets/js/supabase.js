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

/* Phase26N-87B — employee / license / HR document modules
   社員詳細では documents.js の既存有無に関係なく、資格・免許証明書モジュールまで
   必ず読み込む。86Aで documents.js が先に存在する場合に license module の読込経路が
   実行されないケースがあったため、ローダーを分離して冪等化した。
*/
(() => {
  const path = String(location.pathname || '').split('/').pop();
  if (path !== 'employee_detail.html') return;

  const getEmployeeId = () => new URLSearchParams(location.search).get('id');

  const ensureLicenseDocuments = () => {
    if (window.EmployeeLicenseDocuments) {
      const id = getEmployeeId();
      if (id) window.EmployeeLicenseDocuments.enhance(id).catch(console.error);
      return;
    }
    if (document.querySelector('script[data-employee-license-documents]')) return;

    const licenseJs = document.createElement('script');
    licenseJs.src = 'assets/js/employee-license-documents.js';
    licenseJs.dataset.employeeLicenseDocuments = '1';
    document.body.appendChild(licenseJs);
  };

  const ensureHrDocuments = () => {
    if (document.querySelector('script[data-employee-hr-documents]')) return;
    const hrJs = document.createElement('script');
    hrJs.src = 'assets/js/employee-hr-documents.js';
    hrJs.dataset.employeeHrDocuments = '1';
    hrJs.addEventListener('load', () => {
      if (document.querySelector('script[data-employee-hr-documents-bridge]')) return;
      const bridgeJs = document.createElement('script');
      bridgeJs.src = 'assets/js/employee-hr-documents-bridge.js';
      bridgeJs.dataset.employeeHrDocumentsBridge = '1';
      document.body.appendChild(bridgeJs);
    }, { once: true });
    document.body.appendChild(hrJs);
  };

  const mountEmployeeDocuments = () => {
    const id = getEmployeeId();
    if (id && window.EmployeeDocuments?.mount) {
      window.EmployeeDocuments.mount({ type: 'employee', id }).catch(console.error);
    }
    ensureLicenseDocuments();
    ensureHrDocuments();
  };

  const loadEmployeeDocuments = () => {
    if (!document.querySelector('link[data-employee-documents]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'assets/css/documents.css';
      css.dataset.employeeDocuments = '1';
      document.head.appendChild(css);
    }

    if (window.EmployeeDocuments) {
      mountEmployeeDocuments();
      return;
    }

    const existing = document.querySelector('script[data-employee-documents]');
    if (existing) {
      existing.addEventListener('load', mountEmployeeDocuments, { once: true });
      /* 既にload済みだが公開API生成直前/直後のケースも吸収 */
      setTimeout(() => {
        if (window.EmployeeDocuments) mountEmployeeDocuments();
        else ensureLicenseDocuments();
      }, 0);
      return;
    }

    const js = document.createElement('script');
    js.src = 'assets/js/documents.js';
    js.dataset.employeeDocuments = '1';
    js.addEventListener('load', mountEmployeeDocuments, { once: true });
    document.body.appendChild(js);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadEmployeeDocuments, { once: true });
  } else {
    loadEmployeeDocuments();
  }
})();

/* Phase26N-89B-FIX — employee employment contracts
   最新mainのsupabase.jsへ統合。社員詳細で雇用・契約モジュールを確実に読み込む。
*/
(() => {
  const path = String(location.pathname || '').split('/').pop();
  if (path !== 'employee_detail.html') return;

  const loadEmploymentContracts = () => {
    if (!document.querySelector('link[data-employment-contracts]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'assets/css/employee-employment-contracts.css';
      css.dataset.employmentContracts = '1';
      document.head.appendChild(css);
    }

    const id = new URLSearchParams(location.search).get('id');
    if (window.EmployeeEmploymentContracts) {
      if (id) window.EmployeeEmploymentContracts.mount(id).catch(console.error);
      return;
    }

    if (document.querySelector('script[data-employment-contracts]')) return;
    const js = document.createElement('script');
    js.src = 'assets/js/employee-employment-contracts.js';
    js.dataset.employmentContracts = '1';
    document.body.appendChild(js);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadEmploymentContracts, { once: true });
  } else {
    loadEmploymentContracts();
  }
})();

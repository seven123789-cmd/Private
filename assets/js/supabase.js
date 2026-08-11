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
window.AUTH_REQUIRED = false;
window.AUTH_LOGIN_URL = 'login.html';
